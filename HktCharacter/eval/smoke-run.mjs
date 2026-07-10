// 일회용 스모크: standard 프리셋(캡슐 경로) / 손가락 토글 / 걷기 클립 프레임 렌더
import { chromium } from 'playwright-core';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChromium, ensureServer } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'eval', 'out');
const PORT = process.env.HKT_EVAL_PORT ?? 5187;
const server = await ensureServer(ROOT, PORT);
const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage({ viewport: { width: 300, height: 520 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(server.url + '/?paused=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hkt, null, { timeout: 120000 });
  await page.evaluate(() => {
    document.querySelectorAll('.panel,.hud,.foot').forEach(el => el.style.display = 'none');
  });
  const frame = async name => {
    await page.evaluate(() => { window.__hkt.st.pause = false; });
    await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
    await page.evaluate(() => { window.__hkt.st.pause = true; });
    const canvas = await page.$('#app canvas');
    await canvas.screenshot({ path: join(OUT, name) });
    console.log('OK', name);
  };
  await page.evaluate(() => { const h = window.__hkt; h.setPreset('standard'); h.st.clip = 'apose'; h.st.az = 0; h.st.dist = 3.4; });
  await frame('smoke-standard.png');
  await page.evaluate(() => { const h = window.__hkt; h.setPreset('reference'); h.st.fingers = true; });
  await frame('smoke-fingers.png');
  await page.evaluate(() => { const h = window.__hkt; h.st.fingers = false; h.st.clip = 'walk'; h.st.speed = 1; h.st.az = 0.7; });
  await frame('smoke-walk.png');
  if (errs.length) { console.error('페이지 오류:', errs); process.exit(1); }
  console.log('스모크 통과 — 페이지 오류 없음');
} finally {
  await browser.close();
  server.proc?.kill();
}
