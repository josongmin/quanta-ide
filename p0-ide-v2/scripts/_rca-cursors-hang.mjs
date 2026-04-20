// Repro for the "toggle Realtime cursors → canvas hangs" issue.
import { chromium } from '@playwright/test';

const URL = process.env.RCA_URL ?? 'http://localhost:5174/ide/#catalog';

const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout(${label}, ${ms}ms)`)), ms)),
  ]);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1453, height: 934 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const cdp = await page.context().newCDPSession(page);
await cdp.send('Debugger.enable');
await cdp.send('Runtime.enable');
const scripts = new Map();
cdp.on('Debugger.scriptParsed', (s) => scripts.set(s.scriptId, s));
let paused = null;
cdp.on('Debugger.paused', (p) => (paused = p));

console.log(`[rca] goto ${URL}`);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20_000 });
await page.waitForTimeout(2000);

console.log('[rca] open v1 Code Universe tab (exact label, not v2)');
try {
  await page.getByRole('tab', { name: 'Code Universe', exact: true }).click({ timeout: 5000 });
} catch (e) { console.log('[rca] open-tab:', e.message); }
await page.waitForTimeout(3000);

const survey = await page.evaluate(() => ({
  title: document.title,
  canvases: document.querySelectorAll('canvas').length,
  workspaceAppCanvasBox: !!document.querySelector('.workspace-app__canvas'),
  leftRail: !!document.querySelector('aside.ws-figma-left'),
  rootFirst: document.getElementById('root')?.firstElementChild?.className ?? null,
  shellTabs: [...document.querySelectorAll('[role="tab"]')].map(t => t.textContent?.trim().slice(0, 30)),
  hash: location.hash,
  flags: JSON.parse(localStorage.getItem('quanta.canvas.featureFlags.v2') ?? '{}'),
}));
console.log('[rca] survey:', JSON.stringify(survey, null, 2));

await page.screenshot({ path: '/tmp/rca-pre.png', fullPage: false });

if (!survey.workspaceAppCanvasBox) {
  console.log('[rca] workspace-app__canvas not present — cannot replay recording.');
  console.log('[rca] last logs:', logs.slice(-10).join('\n  '));
  try { await browser.close(); } catch {}
  process.exit(0);
}

console.log('[rca] click canvas (370,436)');
try {
  await page.locator('.workspace-app__canvas canvas').first()
    .click({ position: { x: 370, y: 436 }, timeout: 4000, force: true });
} catch (e) { console.log('[rca] canvas click1:', e.message); }
await page.waitForTimeout(400);

console.log('[rca] open Layers');
try {
  await page.locator('aside.ws-figma-left button').nth(0).click({ timeout: 4000 });
} catch (e) { console.log('[rca] layers:', e.message); }
await page.waitForTimeout(300);

console.log('[rca] toggle Realtime cursors');
try {
  await page.getByText('Realtime cursors').click({ timeout: 4000 });
} catch (e) { console.log('[rca] cursors label:', e.message); }
await page.waitForTimeout(500);

const post = await page.evaluate(() => ({
  flags: JSON.parse(localStorage.getItem('quanta.canvas.featureFlags.v2') ?? '{}'),
  wsCursor: document.querySelectorAll('.ws-cursor').length,
  cursorsLayer: !!document.querySelector('.workspace-canvas__cursors-layer'),
}));
console.log('[rca] post-toggle:', JSON.stringify(post, null, 2));

console.log('[rca] click canvas (764,645)');
const click2 = page.locator('.workspace-app__canvas canvas').first()
  .click({ position: { x: 764, y: 645 }, timeout: 6000, force: true })
  .then(() => console.log('[rca] click2 RESOLVED'))
  .catch((e) => console.log('[rca] click2:', e.message));

await page.waitForTimeout(800);

console.log('[rca] Debugger.pause');
try { await withTimeout(cdp.send('Debugger.pause'), 3000, 'pause'); } catch (e) { console.log('[rca] pause:', e.message); }
const t0 = Date.now();
while (!paused && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 100));
if (paused) {
  console.log(`[rca] PAUSED reason=${paused.reason}`);
  for (const [i, f] of (paused.callFrames ?? []).slice(0, 40).entries()) {
    const s = scripts.get(f.location.scriptId);
    console.log(`  #${i} ${f.functionName || '(anon)'}  ${s?.url || '?'}:${f.location.lineNumber + 1}:${(f.location.columnNumber ?? 0) + 1}`);
  }
  try { await cdp.send('Debugger.resume'); } catch {}
} else {
  console.log('[rca] no pause');
}

try {
  const r = await withTimeout(cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify({ href: location.href, canvases: document.querySelectorAll('canvas').length, cursors: document.querySelectorAll('.ws-cursor').length })`,
    returnByValue: true, timeout: 3000,
  }), 4000, 'evaluate');
  console.log('[rca] dom:', r.result?.value);
} catch (e) { console.log('[rca] evaluate:', e.message); }

try {
  const ss = await withTimeout(cdp.send('Page.captureScreenshot', { format: 'png' }), 4000, 'ss');
  const buf = Buffer.from(ss.data, 'base64');
  (await import('node:fs')).writeFileSync('/tmp/rca-cursors-hang.png', buf);
  console.log('[rca] screenshot /tmp/rca-cursors-hang.png', buf.length);
} catch (e) { console.log('[rca] screenshot:', e.message); }

await click2;

console.log('\n[rca] logs (last 30):');
for (const l of logs.slice(-30)) console.log('  ' + l);

try { await withTimeout(browser.close(), 3000, 'close'); } catch { process.exit(2); }
