// capture.js — HTJ 기반 무대의 헤드리스 *눈 검증* + 캡처 (playwright chromium).
//
//   실제 viewer.html 을 띄워 그 캔버스(#cv)를 스크린샷하고, 픽셀 readback 으로 자동 단언한다.
//   별도 하네스 HTML 없음 — viewer 가 노출한 window.HTJViewer 훅으로 시드·카메라를 고정해 그린다.
//   픽셀 골든(환경마다 AA 로 깨짐)이 아니라 *상대 비교*(켜짐 픽셀 수·밝기 대비·회전 전후 차)라 환경 독립.
//
//   확인용(viewer) 도구다 — 세계(engine)는 이것 없이도 돌고 검증된다(verify.js). 단방향 의존.
//
//   실행:
//     node viewer/capture.js [outPng] [N] [seed]
//       기본 outPng = steps/step_0001/capture.png · N=32 · seed=42
//
//   브라우저 없으면 *우아하게 skip*(exit 0) — 머신마다 안 깨지게.
'use strict';
const fs = require('fs');
const path = require('path');

const VIEWER = 'file://' + path.resolve(__dirname, '../viewer.html');

function loadPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright',
                   '/usr/lib/node_modules/playwright', process.env.PLAYWRIGHT_GLOBAL || '']) {
    if (!c) continue; try { return require(c); } catch (e) {}
  }
  return null;
}
function browserPath() {
  for (const p of [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers',
                   path.join(process.env.HOME || '', '.cache/ms-playwright')]) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

// 캔버스 픽셀 분석 — 켜진(배경 위) 픽셀 수 + 밝기 분산(면 음영=깊이감 신호).
function analyzeSrc() {
  window.__analyze = function () {
    const cv = document.getElementById('cv');
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height, d = ctx.getImageData(0, 0, w, h).data;
    let lit = 0, bMin = 1e9, bMax = -1, minX = w, maxX = -1, minY = h, maxY = -1;
    const bg = 0x0a + 0x0c + 0x10;                 // 배경 합(#0a0c10)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, sum = d[i] + d[i + 1] + d[i + 2];
      if (sum > bg + 24) {                          // 배경 + 와이어보다 밝은 = 큐브 픽셀
        lit++;
        if (sum < bMin) bMin = sum; if (sum > bMax) bMax = sum;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    return { lit, bSpread: bMax < 0 ? 0 : bMax - bMin, w, h,
             bw: maxX < 0 ? 0 : maxX - minX, bh: maxY < 0 ? 0 : maxY - minY };
  };
}

async function main() {
  const pw = loadPlaywright(), bp = browserPath();
  const outArg = process.argv[2] || path.resolve(__dirname, '../steps/step_0001/capture.png');
  const N = parseInt(process.argv[3] || '32', 10);
  const seed = parseInt(process.argv[4] || '42', 10);
  const out = path.resolve(outArg);

  if (!pw || !bp) {
    console.log(`\n캡처/눈 검증: ${!pw ? 'playwright 모듈' : 'chromium 브라우저'} 없음 — SKIP(비-치명).`);
    console.log(`  설치: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium`);
    process.exit(0);
  }
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = bp;
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  await page.goto(VIEWER);
  await page.waitForFunction('window.HTJViewer && window.HTJWorld && window.HTJRender');
  await page.evaluate(analyzeSrc);

  // 고정 시드·크기·카메라로 그린다(viewer 의 진짜 캔버스).
  await page.evaluate(([n, s]) => {
    const V = window.HTJViewer;
    V.setSize(700, 700);
    V.reseed(n, s);
    V.setCamera({ yaw: 0.7, pitch: 0.55, zoom: 1.0, panX: 0, panY: 0 });
    V.render();
  }, [N, seed]);

  const cv = page.locator('#cv');
  await cv.screenshot({ path: out });
  const a = await page.evaluate(() => window.__analyze());

  // 회전해서 다른 그림이 나오는지(시점이 실제로 작동 = 3D) — yaw 를 크게 돌려 픽셀 변화 단언.
  const before = await page.evaluate(() => { const c = document.getElementById('cv'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice(); });
  await page.evaluate(() => { window.HTJViewer.setCamera({ yaw: 0.7 + Math.PI / 2 }); window.HTJViewer.render(); });
  const changed = await page.evaluate((b) => {
    const c = document.getElementById('cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let diff = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - b[i]) + Math.abs(d[i + 1] - b[i + 1]) + Math.abs(d[i + 2] - b[i + 2]) > 24) diff++;
    return diff;
  }, Array.from(before));

  await browser.close();

  // ── 단언 ──
  const total = a.w * a.h;
  const checks = [
    { name: `큐브 픽셀 존재(공이 화면에 보임)`, pass: a.lit > total * 0.05, value: `lit ${a.lit} (${(100 * a.lit / total).toFixed(1)}%)` },
    { name: `면 음영 = 깊이감(밝기 대비 > 0)`, pass: a.bSpread > 60, value: `대비 ${a.bSpread}` },
    { name: `공의 화면 크기 합당(가로·세로 폭 존재)`, pass: a.bw > 100 && a.bh > 100, value: `${a.bw}×${a.bh}px` },
    { name: `시점 회전이 그림을 바꿈(3D — 90° yaw 후 픽셀 변화)`, pass: changed > total * 0.02, value: `변화 ${changed}px` },
  ];
  console.log(`\n=== 눈 검증: HTJ 기반 무대 (N=${N}·seed=${seed}) ===`);
  for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name} = ${c.value}`);
  console.log(`  스크린샷: ${path.relative(process.cwd(), out)}`);
  const ok = checks.every(c => c.pass);
  console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
