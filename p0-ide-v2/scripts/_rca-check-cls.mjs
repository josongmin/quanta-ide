import { chromium } from '@playwright/test';

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1453, height: 934 } });
const p = await ctx.newPage();
await p.goto('http://localhost:5174/ide/#catalog');
await p.waitForTimeout(2000);
await p.getByRole('tab', { name: 'Code Universe', exact: true }).click();
await p.waitForTimeout(3000);
await p.locator('aside.ws-figma-left button').nth(0).click();
await p.waitForTimeout(400);
const before = await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => [...e.classList].includes('cls')).map(e => e.tagName + '.' + e.className));
await p.getByText('Realtime cursors').click();
await p.waitForTimeout(800);
const after = await p.evaluate(() => ({
  clsTagged: [...document.querySelectorAll('*')].filter(e => [...e.classList].includes('cls')).map(e => e.tagName + '.' + e.className),
  anyStartingCls: [...document.querySelectorAll('*')].filter(e => [...e.classList].some(c => c === 'cls' || c.startsWith('cls-'))).slice(0, 20).map(e => e.tagName + '.' + e.className),
  totalEls: document.querySelectorAll('*').length,
}));
console.log(JSON.stringify({ before, after }, null, 2));
await b.close();
