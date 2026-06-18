// eye-capture.js — 헤드리스 *눈 검증* 자동화 (render 트랙).
//   smoke.js 가 *번역 로직*(헤드리스 수치)을 검증한다면, 이 도구는 *실제 픽셀*을 검증한다 —
//   headless chromium(playwright)으로 **실제 viewer.html 을 띄워** 그 캔버스를 스크린샷 + 픽셀
//   readback 으로 자동 단언한다. 별도 하네스 HTML 없음(단일 뷰어 원칙·SPINE §6.1): viewer 가
//   이미 window.HGO(엔진)·window.HGORender(렌더)를 전역 로드하므로, 그 전역 모듈로 *결정적 테스트
//   장면*을 만들어 viewer 의 진짜 캔버스(#cv)에 그린다. 픽셀 골든(환경마다 AA·폰트로 깨짐)이 아니라
//   *상대 비교*(깊이 배치 vs 평면 붕괴·드리프트 전 vs 후)라 환경 독립적.
//
//   실행: node engine/validate/eye-capture.js            # 기본 3D 깊이 단언 + 스크린샷
//        node engine/validate/eye-capture.js <sceneId> [ticks] [seed]   # 임의 등록 장면 캡처
//
//   브라우저 없으면 *우아하게 skip*(exit 0·smoke 와 동형) — CI/머신마다 안 깨지게.
'use strict';
const fs = require('fs');
const path = require('path');

const VIEWER = 'file://' + path.resolve(__dirname, '../../../viewer.html');   // 실 단일 뷰어
const OUT_DIR = path.resolve(__dirname, '../../captures');                    // render/captures/ (PNG 는 .gitignore)

// ── playwright + 브라우저 자가 탐색(머신 무관·없으면 skip) ──────────────────
function loadPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright', process.env.PLAYWRIGHT_GLOBAL || '']) {
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

// 페이지 컨텍스트에 주입할 캡처 헬퍼 — viewer 의 전역 모듈(window.HGO·HGORender)과 진짜 캔버스(#cv)를 쓴다.
//   복사 아님: viewer 가 이미 로드한 모듈을 *재사용*해 임의 sim 을 그린다(별도 HTML 0).
function installCap() {
  const K = window.HGO.kernel, S = window.HGO.sim, SC = window.HGO.scenes, R = window.HGORender.render;
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const setCam = () => { R.camState.yaw = 0.7; R.camState.pitch = 0.62; R.camState.distScale = 1.7; R.camState.panX = 0; R.camState.panY = 0; };
  const draw = (sim) => { setCam(); R.draw(ctx, sim, K); };
  const analyze = () => {                                   // 밝은 구(원자)만 집계 — 격자(~57)·배경 제외
    const w = cv.width, h = cv.height, d = ctx.getImageData(0, 0, w, h).data;
    let minY = h, maxY = -1, lit = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (d[i] + d[i + 1] + d[i + 2] > 140) { lit++; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    return { lit, vSpread: maxY < 0 ? 0 : maxY - minY };
  };
  window.__cap = (kind, opt) => {
    opt = opt || {}; let sim;
    if (kind === 'column') {                                 // 같은 (x,y)·rz 다름(flat → rz=0 대조군)
      const a = []; for (let i = 0; i < 6; i++) a.push({ Z: [1, 2, 6, 8, 7, 10][i], N: 1, e: 1, x: 0, rx: 50, ry: 50, rz: opt.flat ? 0 : 8 + i * 16, vx: 0, vy: 0, vz: 0, lep: 0, nuc: 0 });
      sim = S.createSim({ W: 100, H: 100, D: 100, atoms: a, knobs: { drift3d: 1 } });
    } else if (kind === 'drift') {                           // 한 깊이(rz=50)서 vz 로 흩어짐
      const rng = K.mulberry32(42), a = [];
      for (let i = 0; i < 12; i++) a.push({ Z: (i % 6) + 1, N: 1, e: 1, x: 0, rx: 35 + rng() * 30, ry: 35 + rng() * 30, rz: 50, vx: 0, vy: 0, vz: (rng() - 0.5) * 2.2, lep: 0, nuc: 0 });
      sim = S.createSim({ W: 100, H: 100, D: 100, atoms: a, knobs: { drift3d: 1, dt: 1 } });
      for (let t = 0; t < (opt.ticks || 0); t++) S.step(sim);
    } else if (kind === 'scene') {                           // 등록 장면(viewer 와 동형)
      sim = S.createSim(SC.SCENES[opt.id].init(K.mulberry32((opt.seed >>> 0) || 42), K));
      for (let t = 0; t < (opt.ticks || 0); t++) S.step(sim);
    }
    draw(sim);
    return analyze();
  };
}

async function main() {
  const pw = loadPlaywright(), bp = browserPath();
  if (!pw || !bp) {
    console.log(`\n눈 검증 하네스: ${!pw ? 'playwright 모듈' : 'chromium 브라우저'} 없음 — SKIP(비-치명).`);
    console.log(`  설치: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium`);
    process.exit(0);
  }
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = bp;
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  await page.goto(VIEWER);
  await page.waitForFunction('window.HGO && window.HGORender && window.HGORender.render');
  await page.evaluate(installCap);                          // 전역 모듈로 캡처 헬퍼 설치(별도 HTML 0)
  const cv = page.locator('#cv');
  const shot = (name) => cv.screenshot({ path: path.join(OUT_DIR, name) });
  const cap = (kind, opt) => page.evaluate(([k, o]) => window.__cap(k, o), [kind, opt]);

  const checks = [];
  const argScene = process.argv[2];

  if (argScene) {                                            // 임의 등록 장면 스크린샷(사람 일별용)
    const ticks = parseInt(process.argv[3] || '0', 10), seed = parseInt(process.argv[4] || '42', 10);
    const a = await cap('scene', { id: argScene, seed, ticks });
    await shot(`${argScene}-t${ticks}.png`);
    console.log(`\n캡처: ${argScene} (seed ${seed}·${ticks}tick) → captures/${argScene}-t${ticks}.png · lit=${a.lit}·세로분산=${a.vSpread}px`);
  } else {                                                   // 기본: L-3d 깊이 렌더 자동 눈 단언
    console.log('\n=== 눈 검증: L-3d 깊이 렌더 (실 viewer 픽셀 단언) ===');
    const col = await cap('column', { flat: false });  await shot('depth-column.png');
    const flat = await cap('column', { flat: true });  await shot('depth-flat.png');
    checks.push({ name: `깊이 컬럼 — 같은 (x,y)·rz 8→88 가 세로로 흩어짐(평면 z=0 대비 ${(col.vSpread / Math.max(1, flat.vSpread)).toFixed(1)}배)`,
      pass: col.vSpread > flat.vSpread * 2.5 && col.vSpread > 120, value: `깊이 ${col.vSpread}px vs 평면 ${flat.vSpread}px` });

    const t0 = await cap('drift', { ticks: 0 });   await shot('depth-drift-t0.png');
    const t40 = await cap('drift', { ticks: 40 });  await shot('depth-drift-t40.png');
    checks.push({ name: `깊이 드리프트 — vz 로 t0→t40 깊이 흩어짐(세로분산 ${t0.vSpread}→${t40.vSpread}px)`,
      pass: t40.vSpread > t0.vSpread + 40, value: `+${t40.vSpread - t0.vSpread}px` });

    checks.push({ name: `2D 회귀 — rz=0(평면) 원자는 좁은 세로분산 유지(2D 장면 표현 보존)`,
      pass: flat.vSpread < 90 && flat.lit > 0, value: `${flat.vSpread}px·lit ${flat.lit}` });

    for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name} = ${c.value}`);
    console.log(`  스크린샷: captures/{depth-column,depth-flat,depth-drift-t0,depth-drift-t40}.png`);
  }

  await browser.close();
  const ok = checks.every(c => c.pass);
  console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
