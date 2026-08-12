// Playable Verification 드라이버 — 실제 브라우저에서 Cycle Goal 을 수행한다 (§31, Rule 13).
// dist/ 정적 서빙 → Chromium 로드 → 키 입력(WASD)으로 광맥 접근 → E 로 채굴
// → expected 3층 (world 는 designer trace / observable / gameview HUD) 실측 → 스크린샷.
//
// 사용: node tests/playable.driver.mjs  (사전: npm run build)

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'tests', '.artifacts');
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
};

const server = createServer((req, res) => {
  const path = req.url === '/' ? '/index.html' : (req.url ?? '/index.html').split('?')[0];
  try {
    const body = readFileSync(join(DIST, path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(4188, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--use-gl=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const failures = [];
const check = (name, cond, actual) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : ` (actual: ${JSON.stringify(actual)})`}`);
  if (!cond) failures.push(name);
};

await page.goto('http://127.0.0.1:4188/');
await page.waitForFunction(() => window.__hkt !== undefined);
await page.waitForTimeout(300);

// ── setup 확인: Stone 0, 채굴 불가(멀다) ──
let obs = await page.evaluate(() => window.__hkt.observable());
check('setup: Stone = 0', obs.actor.inventoryStone === 0, obs.actor.inventoryStone);
check(
  'setup: OUT_OF_RANGE',
  obs.mineAvailability.status === 'UNAVAILABLE' && obs.mineAvailability.reason === 'OUT_OF_RANGE',
  obs.mineAvailability,
);
let hud = await page.textContent('#hud-stone');
check('setup HUD: "⛏ Stone: 0"', hud.trim() === '⛏ Stone: 0', hud);

// ── step 1: 광맥으로 이동 (실제 키 입력 — 플레이어처럼 화면을 보고 조향) ──
const held = new Set();
async function steer(want) {
  for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    if (want.has(key) && !held.has(key)) {
      await page.keyboard.down(key);
      held.add(key);
    } else if (!want.has(key) && held.has(key)) {
      await page.keyboard.up(key);
      held.delete(key);
    }
  }
}
const steerDeadline = Date.now() + 20000;
for (;;) {
  obs = await page.evaluate(() => window.__hkt.observable());
  if (obs.mineAvailability.status === 'AVAILABLE') break;
  if (Date.now() > steerDeadline) break;
  const deposit = obs.visibleDeposits[0];
  const dx = deposit.position.x - obs.actor.position.x;
  const dz = deposit.position.z - obs.actor.position.z;
  const want = new Set();
  if (dx > 0.3) want.add('KeyD');
  if (dx < -0.3) want.add('KeyA');
  if (dz < -0.3) want.add('KeyW');
  if (dz > 0.3) want.add('KeyS');
  await steer(want);
  await page.waitForTimeout(80);
}
await steer(new Set());
obs = await page.evaluate(() => window.__hkt.observable());
check('approach: AVAILABLE(deposit-1)', obs.mineAvailability.target === 'deposit-1', obs.mineAvailability);
const hint = await page.textContent('#hud-hint');
check('approach HUD hint: "[E] 채굴"', hint.trim() === '[E] 채굴', hint);

// ── step 2: E 로 채굴 ──
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__hkt.observable().actor.inventoryStone >= 1, undefined, {
  timeout: 3000,
});
await page.waitForTimeout(150); // 렌더/HUD 반영 여유

// ── expected 3층 실측 ──
obs = await page.evaluate(() => window.__hkt.observable());
const designer = await page.evaluate(() => window.__hkt.designer());

// world 층 — Designer Observer 의 Authoritative Transition 기록으로 확인
const mineT = designer.transitions.filter((t) => t.selectedRule === 'RULE-MINE-001').pop();
check('world: RULE-MINE-001 SUCCESS', !!mineT && mineT.failureReason === null, mineT);
check(
  'world: Deposit 5 → 4',
  mineT?.beforeState?.['Deposit.ResourceAmount'] === 5 &&
    mineT?.afterState?.['Deposit.ResourceAmount'] === 4,
  mineT,
);

// observable 층
check('observable: Actor.Inventory.Stone = 1', obs.actor.inventoryStone === 1, obs.actor.inventoryStone);
check(
  'observable: Deposit.ResourceAmount = 4',
  obs.visibleDeposits[0]?.resourceAmount === 4,
  obs.visibleDeposits,
);

// gameview 층 — 플레이어가 실제로 본 것 (DOM HUD)
hud = await page.textContent('#hud-stone');
check('gameview HUD: "⛏ Stone: 1"', hud.trim() === '⛏ Stone: 1', hud);
const feedback = await page.textContent('#hud-feedback');
check('gameview feedback: "+1 Stone 획득!"', feedback.trim() === '+1 Stone 획득!', feedback);

// ── 증거 저장 ──
mkdirSync(OUT_DIR, { recursive: true });
await page.screenshot({ path: join(OUT_DIR, 'playable_screenshot.png') });
writeFileSync(
  join(OUT_DIR, 'playable_measured.json'),
  JSON.stringify({ observable: obs, mineTransition: mineT }, null, 2),
);

await browser.close();
server.close();

console.log(failures.length === 0 ? '\nPLAYABLE: ALL PASS' : `\nPLAYABLE: ${failures.length} FAIL`);
process.exit(failures.length === 0 ? 0 : 1);
