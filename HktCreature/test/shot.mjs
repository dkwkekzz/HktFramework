// shot.mjs — 픽셀 레벨 검증 게이트(실제 브라우저 렌더).
//
// 목적: "데이터는 맞는데 화면은 비었다" 류의 회귀를 잡는다. vite preview 를 띄우고
// pre-installed Chromium 으로 무대를 렌더 → 스크린샷 저장(육안용) + **자동 판정**:
//   1) 크리처가 실제로 그려졌는가(배경 아닌 픽셀 비율 임계 이상),
//   2) 클립별로 포즈가 실제로 달라지는가(프레임 차이),
//   3) 페이지 에러 0(파비콘 404 제외).
// 하나라도 실패하면 exit 1. → 모든 세션이 `npm run shot` 로 시각 회귀를 막을 수 있다.
//
// 스크린샷은 test/out/*.png (gitignore). 육안 확인은 그 파일을 열어 본다.

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'out');
const PORT = 5199;
const BG = { r: 0x1a, g: 0x1d, b: 0x24 };     // scene.background
const MIN_COVER = 0.03;                         // 크리처가 화면의 최소 3% 는 덮어야
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

// pre-installed Chromium 경로를 버전에 무관하게 해석(chromium-<rev>/chrome-linux/chrome).
function findChrome() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const dir = readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
  if (!dir) throw new Error('Chromium 미발견: ' + base);
  return join(base, dir, 'chrome-linux', 'chrome');
}

// 캔버스 픽셀에서 (배경 아닌 면적 비율, 상단-중앙 창 서명) 계산.
//  cover: 크리처+그리드가 화면을 덮은 비율,
//  sig:   창(캐릭터가 서는 화면 상단-중앙) 의 밝기 합 — 포즈가 바뀌면 값이 달라진다.
const GRID = 24;   // 크리처 창을 24×24 셀로 다운샘플 → 셀별 밝기로 포즈 변화 감지
async function sample(page) {
  return page.evaluate((args) => {
    const { bg, GRID } = args;
    const c = document.querySelector('#app canvas');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    const w = c.width, h = c.height;
    const px = new Uint8Array(w * h * 4);
    g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px);
    // 크리처가 서는 창(가로 35~78%, 세로 12~80%).
    const x0 = w * 0.35, x1 = w * 0.78, y0 = h * 0.12, y1 = h * 0.80;
    const grid = new Float64Array(GRID * GRID), cnt = new Float64Array(GRID * GRID);
    let n = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (Math.abs(px[i] - bg.r) + Math.abs(px[i + 1] - bg.g) + Math.abs(px[i + 2] - bg.b) > 24) n++;
        if (x >= x0 && x < x1 && y >= y0 && y < y1) {
          const gx = Math.floor((x - x0) / (x1 - x0) * GRID);
          const gy = Math.floor((y - y0) / (y1 - y0) * GRID);
          const k = gy * GRID + gx;
          grid[k] += px[i] + px[i + 1] + px[i + 2]; cnt[k]++;
        }
      }
    }
    for (let k = 0; k < grid.length; k++) grid[k] = cnt[k] ? grid[k] / cnt[k] : 0;
    return { cover: n / (w * h), grid: Array.from(grid) };
  }, { bg: BG, GRID });
}

// 두 포즈의 셀 그리드가 얼마나 다른가(셀별 밝기 절대차 평균) — 전역 합과 달리 상쇄 없음.
function gridDelta(a, b) {
  let s = 0; for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]);
  return s / a.length;
}

// dev 서버(vite)로 소스를 직접 서빙 → 스테일 dist 로 인한 오검증 방지.
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));

const browser = await chromium.launch({ executablePath: findChrome() });
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|404/i.test(m.text())) errs.push('console: ' + m.text());
  });
  // preserveDrawingBuffer 없이도 readPixels 가 유효하도록, 캡처 직전 렌더를 강제한다.
  await page.goto(`http://localhost:${PORT}/?capture=1`, { waitUntil: 'load' });
  // 베이스 FBX 로드(약 1.7MB) + 살 생성까지 대기.
  await page.waitForFunction(() => window.__hkt && window.__hkt.ch && window.__hkt.ch.flesh, null, { timeout: 60000 });
  await page.evaluate(() => { window.__hkt.state.pause = true; });

  const shot = async (clip, name, advance) => {
    await page.evaluate(async (c) => { await window.__hkt.playAnim(c, 0); }, clip);
    await page.evaluate((dt) => window.__hkt.ch.mixer.update(dt), advance);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const s = await sample(page);
    await page.screenshot({ path: join(OUT, name) });
    ok(s.cover >= MIN_COVER, `${name}: 크리처 렌더 확인 (화면의 ${(s.cover * 100).toFixed(1)}% 덮음)`);
    return s;
  };

  const idle = await shot('대기', 'idle.png', 0.4);
  const walk = await shot('걷기', 'walk.png', 0.5);
  await shot('뛰기', 'run.png', 0.4);
  // 셀 그리드가 대기≠걷기 → 살이 실제로 Mixamo 포즈를 따라 변형함(그리드만 보이는 게 아님).
  const dPose = gridDelta(idle.grid, walk.grid);
  ok(dPose > 3, `포즈가 클립에 따라 변형 (대기↔걷기 셀차 평균 ${dPose.toFixed(1)})`);
  // 본 오버레이
  await page.evaluate(() => document.getElementById('t-bones').click());
  await shot('걷기', 'walk-bones.png', 0.5);

  ok(errs.length === 0, '페이지 에러 0' + (errs.length ? ': ' + errs.join(' | ') : ''));
} finally {
  await browser.close();
  server.kill('SIGKILL');
}

console.log('\n' + (fail === 0 ? '✅ 픽셀 검증 통과 — test/out/*.png 로 육안 확인'
                                : `❌ ${fail}개 실패`));
process.exit(fail === 0 ? 0 : 1);
