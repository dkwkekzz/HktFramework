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

// ── step_0002: 에너지 흐름(확산) 시계열 눈 검증 ──
//   t=0(중앙 집중) 과 t=T(퍼짐) 두 프레임을 캡처해 *흐름*을 픽셀로 단언한다:
//     · 총 에너지 보존(stat) · 엔트로피 증가(stat) · 점유 픽셀/덩어리가 *퍼진다*(눈).
//   실행: node viewer/capture.js --energy [N] [steps]
async function mainEnergy() {
  const pw = loadPlaywright(), bp = browserPath();
  const pos = process.argv.slice(2).filter(a => a !== '--energy');
  const N = parseInt(pos[0] || '24', 10);
  const STEPS = parseInt(pos[1] || '160', 10);
  const dir = path.resolve(__dirname, '../steps/step_0002');
  const out = path.join(dir, 'capture.png'), out0 = path.join(dir, 'capture_t0.png');

  if (!pw || !bp) {
    console.log(`\n캡처/눈 검증: ${!pw ? 'playwright 모듈' : 'chromium 브라우저'} 없음 — SKIP(비-치명).`);
    process.exit(0);
  }
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = bp;
  fs.mkdirSync(dir, { recursive: true });

  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  await page.goto(VIEWER);
  await page.waitForFunction('window.HTJViewer && window.HTJWorld && window.HTJEnergy && window.HTJRender');
  await page.evaluate(analyzeSrc);

  // t=0: 중앙 단일 핫셀. (render() 가 UI 색 기준에 의존하므로 *상대* 로 고정 — 기본 step 무관 재현성)
  await page.evaluate(([n]) => {
    const V = window.HTJViewer;
    document.getElementById('colorScale').value = 'relative';
    V.setSize(700, 700);
    V.energyInit(n, { E0: 1000, half: 0 });
    V.setCamera({ yaw: 0.7, pitch: 0.55, zoom: 1.0, panX: 0, panY: 0 });
    V.render();
  }, [N]);
  await page.locator('#cv').screenshot({ path: out0 });
  const a0 = await page.evaluate(() => window.__analyze());
  const m0 = await page.evaluate(() => ({ E: window.HTJViewer.totalEnergy(), S: window.HTJViewer.entropy(), max: window.HTJViewer.maxEnergy() }));

  // t=T: 확산 STEPS 회 → 퍼짐.
  await page.evaluate(([alpha, steps]) => { window.HTJViewer.diffuse(alpha, steps); window.HTJViewer.render(); }, [1 / 7, STEPS]);
  await page.locator('#cv').screenshot({ path: out });
  const aT = await page.evaluate(() => window.__analyze());
  const mT = await page.evaluate(() => ({ E: window.HTJViewer.totalEnergy(), S: window.HTJViewer.entropy(), max: window.HTJViewer.maxEnergy() }));

  await browser.close();

  const relErr = Math.abs(mT.E - m0.E) / m0.E;
  const checks = [
    { name: `t=0 에너지가 화면에 보임(핫셀 집중)`, pass: a0.lit > 0, value: `lit ${a0.lit}px` },
    { name: `흐름 — 점유 픽셀이 퍼진다(t=T > 2·t=0)`, pass: aT.lit > a0.lit * 2, value: `${a0.lit} → ${aT.lit}px` },
    { name: `흐름 — 피크가 식는다(최대 에너지 하락)`, pass: mT.max < m0.max * 0.5, value: `${m0.max.toFixed(2)} → ${mT.max.toFixed(2)}` },
    { name: `제1법칙 — 총 에너지 보존(stat)`, pass: relErr < 1e-6, value: `ΔE/E0 = ${relErr.toExponential(2)}` },
    { name: `제2법칙 — 엔트로피 증가(stat)`, pass: mT.S > m0.S, value: `${m0.S.toFixed(3)} → ${mT.S.toFixed(3)} nats` },
  ];
  console.log(`\n=== 눈 검증: HTJ 에너지 흐름 (N=${N}·${STEPS}스텝·α=1/7) ===`);
  for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name} = ${c.value}`);
  console.log(`  스크린샷: ${path.relative(process.cwd(), out0)} (t=0) · ${path.relative(process.cwd(), out)} (t=${STEPS})`);
  const ok = checks.every(c => c.pass);
  console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
  process.exit(ok ? 0 : 1);
}

// ── step_0003: 에너지의 탄생(잠재력 방출) 시계열 눈 검증 ──
//   t=0: 중앙 *잠재력 저장고*(potential 장 — 빛남) + 에너지 0(energy 장 — 검음).
//   t=T: 방출+확산 후 — 잠재력이 풀려(↓) 에너지가 태어나(↑) 퍼진다. *총합 보존*.
//   캡처: capture_t0.png = 잠재력 저장고 / capture_energy0.png = 초기 에너지(검음) / capture.png = 태어난 에너지.
//   실행: node viewer/capture.js --potential [N] [steps]
async function mainPotential() {
  const pw = loadPlaywright(), bp = browserPath();
  const pos = process.argv.slice(2).filter(a => a !== '--potential');
  const N = parseInt(pos[0] || '24', 10);
  const STEPS = parseInt(pos[1] || '160', 10);
  const dir = path.resolve(__dirname, '../steps/step_0003');
  const out = path.join(dir, 'capture.png'), outPot = path.join(dir, 'capture_t0.png'), outE0 = path.join(dir, 'capture_energy0.png');

  if (!pw || !bp) {
    console.log(`\n캡처/눈 검증: ${!pw ? 'playwright 모듈' : 'chromium 브라우저'} 없음 — SKIP(비-치명).`);
    process.exit(0);
  }
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = bp;
  fs.mkdirSync(dir, { recursive: true });

  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  await page.goto(VIEWER);
  await page.waitForFunction('window.HTJViewer && window.HTJWorld && window.HTJEnergy && window.HTJPotential && window.HTJRender');
  await page.evaluate(analyzeSrc);

  // t=0: 중앙 잠재력 저장고. 카메라 고정.
  await page.evaluate(([n]) => {
    const V = window.HTJViewer;
    V.setSize(700, 700);
    V.potentialInit(n, { P0: 1000, r: n * 0.18 });
    V.setCamera({ yaw: 0.7, pitch: 0.55, zoom: 1.0, panX: 0, panY: 0 });
  }, [N]);
  // 잠재력 저장고(빛남) 캡처.
  await page.evaluate(() => window.HTJViewer.drawField('potential'));
  await page.locator('#cv').screenshot({ path: outPot });
  const aPot = await page.evaluate(() => window.__analyze());
  // 초기 에너지(0 → 검음) 캡처.
  await page.evaluate(() => window.HTJViewer.drawField('energy'));
  await page.locator('#cv').screenshot({ path: outE0 });
  const aE0 = await page.evaluate(() => window.__analyze());
  const m0 = await page.evaluate(() => ({ P: window.HTJViewer.totalField('potential'), E: window.HTJViewer.totalField('energy') }));

  // t=T: 방출+확산 STEPS 회 → 탄생+퍼짐.
  await page.evaluate(([rate, alpha, steps]) => { window.HTJViewer.release(rate, alpha, steps); }, [0.02, 1 / 7, STEPS]);
  await page.evaluate(() => window.HTJViewer.drawField('energy'));
  await page.locator('#cv').screenshot({ path: out });
  const aT = await page.evaluate(() => window.__analyze());
  const mT = await page.evaluate(() => ({ P: window.HTJViewer.totalField('potential'), E: window.HTJViewer.totalField('energy') }));

  await browser.close();

  const sum0 = m0.P + m0.E, sumT = mT.P + mT.E, relErr = Math.abs(sumT - sum0) / sum0;
  const checks = [
    { name: `t=0 잠재력 저장고가 화면에 보임(큐브)`, pass: aPot.lit > 0, value: `lit ${aPot.lit}px` },
    { name: `t=0 에너지는 아직 0(큐브 없음·와이어만)`, pass: m0.E === 0 && aE0.lit < aPot.lit * 0.5, value: `E=${m0.E.toFixed(2)} · lit ${aE0.lit}px(와이어) ≪ 저장고 ${aPot.lit}px` },
    { name: `탄생 — 에너지 큐브가 나타나 퍼진다(t=T ≫ t=0)`, pass: aT.lit > aE0.lit * 5, value: `${aE0.lit} → ${aT.lit}px` },
    { name: `탄생 — 잠재력↓ + 에너지↑`, pass: mT.P < m0.P && mT.E > m0.E, value: `P ${m0.P.toFixed(1)}→${mT.P.toFixed(1)} · E ${m0.E.toFixed(1)}→${mT.E.toFixed(1)}` },
    { name: `보존 — 총합 Σ(P+E) 불변(생성=형태 변환)`, pass: relErr < 1e-6, value: `ΔΣ/Σ0 = ${relErr.toExponential(2)}` },
  ];
  console.log(`\n=== 눈 검증: HTJ 에너지의 탄생 (N=${N}·${STEPS}스텝·rate=0.02·α=1/7) ===`);
  for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name} = ${c.value}`);
  console.log(`  스크린샷: ${path.relative(process.cwd(), outPot)} (잠재력) · ${path.relative(process.cwd(), outE0)} (E t=0) · ${path.relative(process.cwd(), out)} (E t=${STEPS})`);
  const ok = checks.every(c => c.pass);
  console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
  process.exit(ok ? 0 : 1);
}

// ── step_0004: 별의 점화(임계 방출) 시계열 눈 검증 ──
//   t=0: 별밭(코어+옅은 가스)의 잠재력 장. t=점화: 임계 넘긴 코어만 빛남(=별), 가스는 어둡다.
//   t=확산: 별빛이 가스로 퍼진다. 캡처: capture_t0(잠재력)·capture_star(점화 직후)·capture(확산 후).
//   실행: node viewer/capture.js --star [N] [steps]
async function mainStar() {
  const pw = loadPlaywright(), bp = browserPath();
  const pos = process.argv.slice(2).filter(a => a !== '--star');
  const N = parseInt(pos[0] || '28', 10);
  const STEPS = parseInt(pos[1] || '120', 10);
  const RATE = 0.05, CRIT = 300, ALPHA = 1 / 7;
  const dir = path.resolve(__dirname, '../steps/step_0004');
  const out = path.join(dir, 'capture.png'), outPot = path.join(dir, 'capture_t0.png'), outStar = path.join(dir, 'capture_star.png');

  if (!pw || !bp) {
    console.log(`\n캡처/눈 검증: ${!pw ? 'playwright 모듈' : 'chromium 브라우저'} 없음 — SKIP(비-치명).`);
    process.exit(0);
  }
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = bp;
  fs.mkdirSync(dir, { recursive: true });

  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  await page.goto(VIEWER);
  await page.waitForFunction('window.HTJViewer && window.HTJWorld && window.HTJEnergy && window.HTJPotential && window.HTJRender');
  await page.evaluate(analyzeSrc);

  // t=0: 별밭(코어+가스) 잠재력 장.
  await page.evaluate(([n]) => {
    const V = window.HTJViewer;
    V.setSize(700, 700);
    V.starInit(n, { core: 1000, background: 50, r: n * 0.25 });
    V.setCamera({ yaw: 0.7, pitch: 0.55, zoom: 1.0, panX: 0, panY: 0 });
  }, [N]);
  await page.evaluate(() => window.HTJViewer.drawField('potential'));
  await page.locator('#cv').screenshot({ path: outPot });
  const aPot = await page.evaluate(() => window.__analyze());

  // 점화 직후(확산 거의 없이) — 코어만 빛난다(별의 형태).
  await page.evaluate(([rate, crit]) => { window.HTJViewer.igniteRun(rate, crit, 0, 12); window.HTJViewer.drawField('energy'); }, [RATE, CRIT]);
  await page.locator('#cv').screenshot({ path: outStar });
  const aStar = await page.evaluate(() => window.__analyze());

  // 확산 후 — 별빛이 가스로 퍼진다.
  await page.evaluate(([rate, crit, alpha, steps]) => { window.HTJViewer.igniteRun(rate, crit, alpha, steps); window.HTJViewer.drawField('energy'); }, [RATE, CRIT, ALPHA, STEPS]);
  await page.locator('#cv').screenshot({ path: out });
  const aT = await page.evaluate(() => window.__analyze());
  const mT = await page.evaluate(() => ({ P: window.HTJViewer.totalField('potential'), E: window.HTJViewer.totalField('energy'), maxP: window.HTJViewer.maxField('potential') }));

  await browser.close();

  const checks = [
    { name: `t=0 별밭(잠재력)이 화면에 보임`, pass: aPot.lit > 0, value: `lit ${aPot.lit}px` },
    { name: `점화 — 코어만 빛남(별 < 별밭 전체)`, pass: aStar.lit > 0 && aStar.lit < aPot.lit, value: `별 ${aStar.lit}px < 별밭 ${aPot.lit}px` },
    { name: `확산 — 별빛이 가스로 퍼진다(t=T > 점화 직후)`, pass: aT.lit > aStar.lit, value: `${aStar.lit} → ${aT.lit}px` },
    { name: `수명 — 별이 다 타 점화 정지(max P < crit)`, pass: mT.maxP < CRIT, value: `max P=${mT.maxP.toFixed(1)} < ${CRIT}` },
    { name: `에너지가 태어남(E > 0)`, pass: mT.E > 0, value: `E=${mT.E.toFixed(1)}` },
  ];
  console.log(`\n=== 눈 검증: HTJ 별의 점화 (N=${N}·rate=${RATE}·crit=${CRIT}·α=1/7) ===`);
  for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name} = ${c.value}`);
  console.log(`  스크린샷: ${path.relative(process.cwd(), outPot)} (잠재력) · ${path.relative(process.cwd(), outStar)} (점화) · ${path.relative(process.cwd(), out)} (확산)`);
  const ok = checks.every(c => c.pass);
  console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
  process.exit(ok ? 0 : 1);
}

// ── step_0005: 지속적으로 빛나는 별(경계 복사 sink) 눈 검증 ──
//   큰 연료 코어가 계속 점화 + 확산 + 경계 복사(우주로). 절대 색 스케일로 캡처해
//   *중심은 꾸준히 밝고 바깥은 어둡다*(영구 그래디언트) + 에너지가 빠져나가는 걸 본다.
//   캡처: capture.png(빛나는 별, 절대색) · capture_closed.png(복사=0 대조, 균일).
//   실행: node viewer/capture.js --steady [N] [steps]
async function mainSteady() {
  const pw = loadPlaywright(), bp = browserPath();
  const pos = process.argv.slice(2).filter(a => a !== '--steady');
  const N = parseInt(pos[0] || '24', 10);
  const STEPS = parseInt(pos[1] || '400', 10);
  const RATE = 0.02, CRIT = 300, ALPHA = 1 / 7, RAD = 0.2, ABS = 4000;
  const dir = path.resolve(__dirname, '../steps/step_0005');
  const out = path.join(dir, 'capture.png'), outClosed = path.join(dir, 'capture_closed.png');

  if (!pw || !bp) {
    console.log(`\n캡처/눈 검증: ${!pw ? 'playwright 모듈' : 'chromium 브라우저'} 없음 — SKIP(비-치명).`);
    process.exit(0);
  }
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = bp;
  fs.mkdirSync(dir, { recursive: true });

  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  await page.goto(VIEWER);
  await page.waitForFunction('window.HTJViewer && window.HTJPotential && window.HTJRadiate && window.HTJRender');
  await page.evaluate(analyzeSrc);

  // 별 + 복사(sink) — 절대 색으로 캡처.
  const sink = await page.evaluate(([n, rate, crit, alpha, rad, steps, abs]) => {
    const V = window.HTJViewer; V.setSize(700, 700);
    V.starInit(n, { core: 1e7, background: 0, r: n * 0.16 });
    V.setCamera({ yaw: 0.7, pitch: 0.55, zoom: 1.0, panX: 0, panY: 0 });
    V.steadyRun(rate, crit, alpha, rad, steps);
    V.drawField('energy', abs);
    return { lit: window.__analyze().lit, radiated: V.radiated(), E: V.totalField('energy') };
  }, [N, RATE, CRIT, ALPHA, RAD, STEPS, ABS]);
  await page.locator('#cv').screenshot({ path: out });

  // 대조: 복사=0(닫힌 상자) — 같은 절대 색.
  const closed = await page.evaluate(([n, rate, crit, alpha, steps, abs]) => {
    const V = window.HTJViewer;
    V.starInit(n, { core: 1e7, background: 0, r: n * 0.16 });
    V.steadyRun(rate, crit, alpha, 0, steps);   // rad=0
    V.drawField('energy', abs);
    return { lit: window.__analyze().lit, radiated: V.radiated() };
  }, [N, RATE, CRIT, ALPHA, STEPS, ABS]);
  await page.locator('#cv').screenshot({ path: outClosed });

  await browser.close();

  const checks = [
    { name: `별이 화면에 빛난다(절대색, 점등 픽셀 존재)`, pass: sink.lit > 0, value: `lit ${sink.lit}px` },
    { name: `sink — 에너지가 우주로 빠져나간다(radiated > 0)`, pass: sink.radiated > 0, value: `radiated ${sink.radiated.toFixed(0)}` },
    { name: `sink 有 < 닫힌(복사0): 빛 영역이 더 작다(국소 별 vs 균일)`, pass: sink.lit < closed.lit, value: `sink ${sink.lit}px < 닫힘 ${closed.lit}px` },
    { name: `대조 — 닫힌 상자는 복사 0(radiated=0)`, pass: closed.radiated === 0, value: `radiated ${closed.radiated}` },
  ];
  console.log(`\n=== 눈 검증: HTJ 빛나는 별 (N=${N}·${STEPS}스텝·복사=${RAD}·절대색=${ABS}) ===`);
  for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name} = ${c.value}`);
  console.log(`  스크린샷: ${path.relative(process.cwd(), out)} (빛나는 별) · ${path.relative(process.cwd(), outClosed)} (닫힌 대조)`);
  const ok = checks.every(c => c.pass);
  console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
  process.exit(ok ? 0 : 1);
}

(process.argv.includes('--steady') ? mainSteady()
  : process.argv.includes('--star') ? mainStar()
  : process.argv.includes('--potential') ? mainPotential()
  : process.argv.includes('--energy') ? mainEnergy() : main())
  .catch(e => { console.error(e); process.exit(1); });
