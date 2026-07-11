// shot.mjs — 실제 브라우저에서 무대를 렌더해 스크린샷을 남긴다(육안 검증용).
// vite preview 서버를 띄우고 pre-installed Chromium 으로 캡처.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 5199;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));

const browser = await chromium.launch({ executablePath: CHROME });
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hkt && window.__hkt.creature, null, { timeout: 30000 });

  const shot = async (clip, name, advance = 0.6) => {
    await page.evaluate(async (c) => { await window.__hkt.playClip(c); }, clip);
    // 클립을 advance 초만큼 진행시켜 포즈가 T-포즈 밖으로 나오게
    await page.evaluate((dt) => {
      const c = window.__hkt.creature; c.mixer.update(dt);
    }, advance);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: join(HERE, 'out', name) });
    console.log('shot', name);
  };
  await page.evaluate(() => { window.__hkt.state.pause = true; });
  await shot('대기', 'idle.png', 0.4);
  await shot('걷기', 'walk.png', 0.5);
  await shot('뛰기', 'run.png', 0.4);
  // 본 표시 + 살 반투명 느낌: 본 토글
  await page.evaluate(() => { document.getElementById('t-bones').click(); });
  await shot('걷기', 'walk-bones.png', 0.5);

  console.log(errs.length ? '⚠ page errors:\n' + errs.join('\n') : '✅ 페이지 에러 0');
} finally {
  await browser.close();
  server.kill('SIGKILL');
}
