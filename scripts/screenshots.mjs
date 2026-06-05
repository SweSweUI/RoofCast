// Capture real app screenshots for the submission package.
// Requires the dev server running at http://localhost:3000 (Supabase + auth mode).
//   node scripts/screenshots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'submission', 'screenshots');
mkdirSync(OUT, { recursive: true });

const EMAIL = 'cfo@altis.demo';
const PASSWORD = 'AltisDemo!2026';
const done = [];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL('**/cfo', { timeout: 20000 });
}

async function shot(page, name, url, { full = true, settle = 2600, selector } = {}) {
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
    if (selector) await page.waitForSelector(selector, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(settle);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
    done.push(name);
    console.log(`  ✓ ${name}.png`);
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message.split('\n')[0]}`);
  }
}

async function element(page, name, selectorText) {
  try {
    const el = page.locator(`section:has-text("${selectorText}")`).first();
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await el.screenshot({ path: path.join(OUT, `${name}.png`) });
    done.push(name);
    console.log(`  ✓ ${name}.png (element)`);
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message.split('\n')[0]}`);
  }
}

const browser = await chromium.launch();

// --- login page (unauthenticated) ---
const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const ap = await anon.newPage();
await shot(ap, 'login', '/login', { full: false, settle: 1200 });
await anon.close();

// --- desktop, authenticated as CFO (can see all non-admin views) ---
const desk = await browser.newContext({ viewport: { width: 1440, height: 980 } });
const page = await desk.newPage();
await login(page);

await shot(page, 'cfo', '/cfo?company=portfolio&scenario=base', { selector: 'text=Risk overview' });
await element(page, 'risk-cards', 'Risk overview');
await element(page, 'scenario-compare', 'Scenario comparison');
await shot(page, 'board', '/board?scenario=wet_quarter', { selector: 'text=Risk overview' });
await shot(page, 'opco', '/opco?company=opco-gilde&scenario=wet_quarter', { selector: 'text=Covenant headroom' });
await shot(page, 'project', '/project?company=ummels&scenario=base', { selector: 'text=weather-risk calendar' });
await shot(page, 'methodology', '/methodology?company=ummels', { selector: 'text=Methodology' });
await shot(page, 'data-quality', '/data-quality', { selector: 'text=Companies detected' });

// trace drawer: single company, open a week
try {
  await page.goto(`${BASE}/cfo?company=ummels&scenario=wet_quarter`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const row = page.locator('section:has-text("Weekly detail") table tbody tr').nth(8);
  await row.click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'trace-drawer.png'), fullPage: false });
  done.push('trace-drawer');
  console.log('  ✓ trace-drawer.png');
} catch (e) {
  console.log(`  ✗ trace-drawer: ${e.message.split('\n')[0]}`);
}
await desk.close();

// --- mobile, authenticated ---
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
const mp = await mob.newPage();
await login(mp);
await shot(mp, 'mobile-cfo', '/cfo?company=portfolio&scenario=base', { full: false, selector: 'text=Risk overview' });
await shot(mp, 'mobile-board', '/board?scenario=wet_quarter', { full: false, selector: 'text=Risk overview' });
await mob.close();

await browser.close();
console.log(`\nCaptured ${done.length} screenshots to submission/screenshots/`);
