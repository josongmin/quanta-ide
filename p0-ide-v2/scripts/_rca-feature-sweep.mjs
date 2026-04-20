// Feature-sweep RCA. Opens v1 Code Universe, enumerates every
// feature-flag checkbox in the Layers panel, toggles each, and
// checks responsiveness after every toggle. On first hang: pauses
// the main thread via CDP and dumps the native stack, then stops.
//
// Run: node scripts/_rca-feature-sweep.mjs
//   RCA_URL=http://localhost:5174/ide/ node scripts/_rca-feature-sweep.mjs

import { chromium } from '@playwright/test';

const URL = process.env.RCA_URL ?? 'http://localhost:5174/ide/';

const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout(${label},${ms}ms)`)), ms)),
  ]);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const cdp = await page.context().newCDPSession(page);
await cdp.send('Debugger.enable');
await cdp.send('Runtime.enable');
const scripts = new Map();
cdp.on('Debugger.scriptParsed', (s) => scripts.set(s.scriptId, s));
let paused = null;
cdp.on('Debugger.paused', (p) => (paused = p));

console.log(`[sweep] goto ${URL}`);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20_000 });
await page.waitForTimeout(2500);

console.log('[sweep] click Code Universe tab (v1, exact label)');
try {
  await page.getByRole('tab', { name: 'Code Universe', exact: true }).click({ timeout: 5000 });
} catch (e) { console.log('[sweep] open-tab:', e.message); }
await page.waitForTimeout(2500);

if (!(await page.locator('.workspace-app__canvas').count())) {
  console.log('[sweep] workspace-app__canvas not mounted — aborting.');
  try { await browser.close(); } catch {}
  process.exit(0);
}

// Ensure figmaShell is on so the left rail renders.
await page.evaluate(() => {
  try {
    const raw = localStorage.getItem('quanta.canvas.featureFlags.v2');
    const flags = raw ? JSON.parse(raw) : {};
    flags['power.figmaShell'] = true;
    localStorage.setItem('quanta.canvas.featureFlags.v2', JSON.stringify(flags));
  } catch {}
});
// Re-mount by re-clicking the tab (cheaper than reload).
// Actually, keep it simple — reload.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.getByRole('tab', { name: 'Code Universe', exact: true }).click({ timeout: 5000 });
await page.waitForTimeout(2500);

console.log('[sweep] open Layers rail');
try {
  // The "Layers" tab is the first button in the left rail.
  await page.locator('aside.ws-figma-left button').nth(0).click({ timeout: 4000 });
} catch (e) { console.log('[sweep] open-layers:', e.message); }
await page.waitForTimeout(500);

// LayersTab only allows ONE expanded category at a time (state
// `expandedCat` holds a single id). So we iterate category-by-
// category: expand, enumerate its rows, sweep, move on.
const categoryCount = await page.locator('button.ws-figma-panel__group-head').count();
console.log(`[sweep] ${categoryCount} category headers`);

// Probe: run a trivial JS eval with a 1s timeout. If it times out,
// the main thread is stuck.
async function probe(tag) {
  try {
    await withTimeout(
      cdp.send('Runtime.evaluate', { expression: '1+1', returnByValue: true }),
      1200, `probe:${tag}`,
    );
    return true;
  } catch {
    return false;
  }
}

async function dumpStackThenResume(reason) {
  console.log(`\n[sweep] *** HANG DETECTED (${reason}) ***`);
  try { await withTimeout(cdp.send('Debugger.pause'), 3000, 'pause'); } catch (e) { console.log('[sweep] pause:', e.message); }
  const t0 = Date.now();
  while (!paused && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 100));
  if (paused) {
    console.log(`[sweep] PAUSED reason=${paused.reason}`);
    for (const [i, f] of (paused.callFrames ?? []).slice(0, 40).entries()) {
      const s = scripts.get(f.location.scriptId);
      console.log(`  #${i} ${f.functionName || '(anon)'}  ${s?.url || '?'}:${f.location.lineNumber + 1}:${(f.location.columnNumber ?? 0) + 1}`);
    }
    try { await cdp.send('Debugger.resume'); } catch {}
  } else {
    console.log('[sweep] no pause captured (thread did not suspend)');
  }
}

// Skip features that disable the rail itself and thus abort the sweep.
const SKIP = new Set(['Figma shell (P0)']);

let firstHang = null;
let totalSwept = 0;
for (let catIdx = 0; catIdx < categoryCount && !firstHang; catIdx++) {
  const header = page.locator('button.ws-figma-panel__group-head').nth(catIdx);
  const catLabel = (await header.locator('.ws-figma-panel__group-lbl').textContent())?.trim() ?? `cat#${catIdx}`;
  const className = (await header.getAttribute('class')) ?? '';
  if (!className.includes('is-open')) {
    try { await header.click({ timeout: 2000 }); } catch {}
  }
  await page.waitForTimeout(180);

  const rows = await page.locator('label.ws-figma-row').all();
  console.log(`\n[sweep] category "${catLabel}": ${rows.length} rows`);

  for (let i = 0; i < rows.length && !firstHang; i++) {
    const row = rows[i];
    const label = (await row.locator('.ws-figma-row__lbl').first().textContent())?.trim() ?? `row#${i}`;
    if (SKIP.has(label)) { console.log(`\n[sweep] skipping "${label}" (would disable rail)`); continue; }

    for (const phase of ['on', 'off']) {
      const clickStart = Date.now();
      try {
        await row.click({ timeout: 2500, force: true });
      } catch (e) {
        console.log(`\n[sweep] click failed on "${label}" (${phase}): ${e.message}`);
      }

      let responsive = false;
      const deadline = Date.now() + 3500;
      while (Date.now() < deadline) {
        if (await probe(label)) { responsive = true; break; }
      }
      if (!responsive) {
        firstHang = { label, phase, category: catLabel };
        console.log(`\n[sweep] HANG after toggling "${label}" (${phase}) in "${catLabel}"`);
        await dumpStackThenResume(`${catLabel}:${label}:${phase}`);
        break;
      }
      const took = Date.now() - clickStart;
      process.stdout.write(`\r[sweep] ${catLabel} ${i + 1}/${rows.length} "${label}" (${phase}) ok in ${took}ms           `);
      totalSwept++;
    }
  }
}
console.log();
console.log(`[sweep] total toggles swept: ${totalSwept}`);

if (!firstHang) {
  console.log('[sweep] no single toggle hung. Sweeping preset chips now.');
  const chips = await page.locator('button.ws-figma-chip').all();
  console.log(`[sweep] ${chips.length} preset chips`);
  for (let i = 0; i < chips.length && !firstHang; i++) {
    const chip = chips[i];
    const label = (await chip.textContent())?.trim() ?? `chip#${i}`;
    try { await chip.click({ timeout: 2000 }); } catch (e) {
      console.log(`\n[sweep] chip "${label}" click failed: ${e.message}`);
      continue;
    }
    // After a preset, 50+ setFlag emits fire in a loop. Probe for ≤5s.
    let responsive = false;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (await probe(`preset:${label}`)) { responsive = true; break; }
    }
    if (!responsive) {
      firstHang = { label: `preset:${label}`, phase: 'apply', category: 'Presets' };
      console.log(`\n[sweep] HANG after applying preset "${label}"`);
      await dumpStackThenResume(`preset:${label}`);
      break;
    }
    // Now click on the canvas once to exercise a typical follow-up interaction.
    try {
      await page.locator('.workspace-app__canvas canvas').first()
        .click({ position: { x: 600 + i * 20, y: 500 }, timeout: 2500, force: true });
    } catch {}
    if (!(await probe(`post-click-${label}`))) {
      firstHang = { label: `click-after-preset:${label}`, phase: 'canvas-click', category: 'Presets' };
      console.log(`\n[sweep] HANG on canvas click after preset "${label}"`);
      await dumpStackThenResume(`canvas-after-preset:${label}`);
      break;
    }
    process.stdout.write(`\r[sweep] preset "${label}" + canvas-click ok           `);
  }
  console.log();
}

try {
  const ss = await withTimeout(cdp.send('Page.captureScreenshot', { format: 'png' }), 4000, 'ss');
  (await import('node:fs')).writeFileSync('/tmp/rca-feature-sweep.png', Buffer.from(ss.data, 'base64'));
  console.log('[sweep] screenshot /tmp/rca-feature-sweep.png');
} catch {}

console.log('\n[sweep] last 20 logs:');
for (const l of logs.slice(-20)) console.log('  ' + l);

try { await withTimeout(browser.close(), 3000, 'close'); } catch { process.exit(2); }
