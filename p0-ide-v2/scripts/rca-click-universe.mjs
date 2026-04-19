// Reproduce the Code Universe hang: load dev server, click the
// "Code Universe" tab, then probe main-thread responsiveness.

import { chromium } from '@playwright/test';

const URL = process.env.RCA_URL ?? 'http://localhost:5174/ide/';
const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout(${label}, ${ms}ms)`)), ms))]);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const cdp = await page.context().newCDPSession(page);
await cdp.send('Debugger.enable');
await cdp.send('Runtime.enable');
await cdp.send('Performance.enable');

const scripts = new Map();
cdp.on('Debugger.scriptParsed', (s) => scripts.set(s.scriptId, s));

console.log(`[rca] goto ${URL}`);
try { await withTimeout(page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20_000 }), 25_000, 'goto'); }
catch (e) { console.log(`[rca] goto: ${e.message}`); }

console.log('[rca] wait 3s for initial boot');
await new Promise((r) => setTimeout(r, 3000));

const baseline = await cdp.send('Performance.getMetrics');
const pickB = (n) => baseline.metrics.find((x) => x.name === n)?.value;
const baseScriptMs = (pickB('ScriptDuration') ?? 0) * 1000;
console.log(`[rca] baseline scriptMs=${baseScriptMs.toFixed(1)}`);

const initialScriptCount = scripts.size;

console.log('[rca] click Code Universe tab');
const t0 = Date.now();
try {
  await withTimeout(page.getByText('Code Universe', { exact: false }).first().click({ timeout: 8000 }), 10_000, 'click');
} catch (e) {
  console.log(`[rca] click: ${e.message}`);
}

// Poll responsiveness every 500ms for up to 30s
console.log('[rca] polling evaluate responsiveness');
let lastResponsiveT = Date.now();
for (let i = 0; i < 60; i++) {
  const dt = Date.now() - t0;
  try {
    await withTimeout(
      cdp.send('Runtime.evaluate', { expression: '1+1', returnByValue: true, timeout: 500 }),
      700,
      'poll',
    );
    lastResponsiveT = Date.now();
    process.stdout.write(`\r[rca] +${dt}ms responsive`);
  } catch (e) {
    process.stdout.write(`\r[rca] +${dt}ms BLOCKED (${Date.now() - lastResponsiveT}ms since last ok)            `);
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.log();

const final = await cdp.send('Performance.getMetrics');
const pickF = (n) => final.metrics.find((x) => x.name === n)?.value;
const finalScriptMs = (pickF('ScriptDuration') ?? 0) * 1000;
console.log(`[rca] after click scriptMs=${finalScriptMs.toFixed(1)}  Δ=${(finalScriptMs - baseScriptMs).toFixed(1)}ms`);

const newScripts = [...scripts.values()]
  .map((s) => s.url)
  .filter((u) => u && (u.includes('sample-graph') || u.includes('canvas-engine') || u.includes('WorkspaceApp') || u.includes('workspace-canvas') || u.includes('canvas-pixi') || u.includes('canvas-worker')));
console.log(`[rca] scripts after click: ${scripts.size} total (+${scripts.size - initialScriptCount} new)`);
console.log('[rca] workspace-related:');
for (const u of newScripts) console.log('  ' + u);

try {
  const ss = await withTimeout(cdp.send('Page.captureScreenshot', { format: 'png' }), 4000, 'screenshot');
  (await import('node:fs')).writeFileSync('/tmp/rca-code-universe-after-click.png', Buffer.from(ss.data, 'base64'));
  console.log('[rca] screenshot -> /tmp/rca-code-universe-after-click.png');
} catch (e) { console.log(`[rca] screenshot: ${e.message}`); }

console.log('\n[rca] console/pageerror:');
for (const l of logs) console.log('  ' + l);

try { await withTimeout(browser.close(), 3000, 'close'); } catch { process.exit(2); }
