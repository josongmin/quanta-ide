// One-off RCA probe: load the dev server in Playwright, capture console,
// page errors, failed requests, and attempt CDP Debugger.pause to read the
// main-thread stack. Times out every step so a truly frozen main thread
// still returns diagnostics rather than leaving the script wedged.
//
// Usage:   node scripts/rca-cdp-pause.mjs [waitMs]
//   waitMs  how long to wait after domcontentloaded before pausing (default 4000)

import { chromium } from '@playwright/test';

const WAIT_MS = Number(process.argv[2] ?? 4000);
const URL = process.env.RCA_URL ?? 'http://localhost:5174/ide/';

const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout(${label}, ${ms}ms)`)), ms)),
  ]);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

const logs = [];
const net = [];
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => net.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText ?? ''}`));
page.on('response', async (r) => {
  if (r.status() >= 400) net.push(`[http ${r.status()}] ${r.url()}`);
});

const cdp = await page.context().newCDPSession(page);
await cdp.send('Debugger.enable');
await cdp.send('Runtime.enable');
await cdp.send('Performance.enable');
await cdp.send('Network.enable');

const scripts = new Map();
cdp.on('Debugger.scriptParsed', (s) => scripts.set(s.scriptId, s));

const netOpen = new Map();
cdp.on('Network.requestWillBeSent', (e) => netOpen.set(e.requestId, { url: e.request.url, started: Date.now() }));
cdp.on('Network.responseReceived', (e) => netOpen.delete(e.requestId));
cdp.on('Network.loadingFailed', (e) => netOpen.delete(e.requestId));

let paused = null;
cdp.once('Debugger.paused', (p) => (paused = p));

console.log(`[rca] goto ${URL}`);
try {
  await withTimeout(page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20_000 }), 25_000, 'goto');
} catch (e) {
  console.log(`[rca] goto: ${e.message}`);
}

console.log(`[rca] sleep ${WAIT_MS}ms`);
await new Promise((r) => setTimeout(r, WAIT_MS));

console.log('[rca] Debugger.pause');
try {
  await withTimeout(cdp.send('Debugger.pause'), 3000, 'Debugger.pause');
} catch (e) {
  console.log(`[rca] pause send: ${e.message}`);
}
const t0 = Date.now();
while (!paused && Date.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 100));

if (paused) {
  console.log(`[rca] PAUSED reason=${paused.reason}`);
  for (const [i, f] of (paused.callFrames ?? []).entries()) {
    const s = scripts.get(f.location.scriptId);
    console.log(`  #${i} ${f.functionName || '(anon)'}  ${s?.url || '?'}:${f.location.lineNumber + 1}:${(f.location.columnNumber ?? 0) + 1}`);
  }
  try { await cdp.send('Debugger.resume'); } catch {}
} else {
  console.log('[rca] no pause — JS either idle, or in native, or VM unresponsive');
}

// Runtime.evaluate with a server-side timeout so a hung VM returns fast.
console.log('[rca] Runtime.evaluate (timeout 3s)');
try {
  const res = await withTimeout(
    cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        title: document.title,
        bodyKids: document.body?.children.length ?? -1,
        rootLen: document.getElementById('root')?.innerHTML.length ?? -1,
        rootTag: document.getElementById('root')?.firstElementChild?.tagName ?? null,
        canvases: document.querySelectorAll('canvas').length,
        href: location.href,
        readyState: document.readyState,
      })`,
      returnByValue: true,
      timeout: 3000,
    }),
    4000,
    'Runtime.evaluate',
  );
  console.log('[rca] dom:', res.result?.value ?? res.exceptionDetails?.text ?? res);
} catch (e) {
  console.log(`[rca] evaluate blocked: ${e.message}  ← strong signal main thread hung`);
}

// Performance metrics — cheap, does not need main thread
try {
  const m = await withTimeout(cdp.send('Performance.getMetrics'), 2000, 'perfMetrics');
  const pick = (n) => m.metrics.find((x) => x.name === n)?.value;
  console.log(`[rca] perf: TaskDuration=${pick('TaskDuration')?.toFixed(2)} ScriptDuration=${pick('ScriptDuration')?.toFixed(2)} Tasks=${pick('TaskDuration')} Nodes=${pick('Nodes')} JSEventListeners=${pick('JSEventListeners')}`);
} catch (e) {
  console.log(`[rca] perf: ${e.message}`);
}

// Scripts that made it through parse — if app modules are missing from this
// list, the hang probably happened during a module the VM never finished
// compiling/evaluating.
const projectScripts = [...scripts.values()]
  .map((s) => s.url)
  .filter((u) => u && (u.includes('/src/') || u.includes('/packages/') || u.includes('/products/') || u.includes('/libs/')));
console.log(`\n[rca] parsed project scripts (${projectScripts.length}), first 25:`);
for (const u of projectScripts.slice(0, 25)) console.log('  ' + u);
console.log(`[rca] ... last 25:`);
for (const u of projectScripts.slice(-25)) console.log('  ' + u);

// Screenshot — uses compositor, works even when main thread is hung.
try {
  const ss = await withTimeout(cdp.send('Page.captureScreenshot', { format: 'png' }), 4000, 'screenshot');
  const buf = Buffer.from(ss.data, 'base64');
  const path = '/tmp/rca-canvas-hang.png';
  (await import('node:fs')).writeFileSync(path, buf);
  console.log(`[rca] screenshot: ${path} (${buf.length} bytes)`);
} catch (e) {
  console.log(`[rca] screenshot: ${e.message}`);
}

console.log(`\n[rca] in-flight requests (${netOpen.size}):`);
const now = Date.now();
for (const [, r] of netOpen) console.log(`  ${Math.round((now - r.started) / 100) / 10}s  ${r.url}`);

console.log('\n[rca] console/pageerror:');
for (const l of logs) console.log('  ' + l);
console.log('[rca] network failures:');
for (const n of net) console.log('  ' + n);

try { await withTimeout(browser.close(), 3000, 'browser.close'); }
catch (e) { console.log(`[rca] browser close: ${e.message}`); process.exit(2); }
