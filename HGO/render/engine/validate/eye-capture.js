// eye-capture.js — 헤드리스 *눈 검증* 자동화 (render 트랙).
//   smoke.js 가 *번역 로직*(헤드리스 수치)을 검증한다면, 이 도구는 *실제 픽셀*을 검증한다 —
//   headless chromium 으로 eye-harness.html(실 엔진 + 실 render 모듈)을 그려 캔버스를 스크린샷 +
//   픽셀 readback 으로 자동 단언한다. 픽셀 골든 비교(환경마다 AA·폰트로 깨짐)가 아니라 *상대 비교*
//   (깊이 배치 vs 평면 붕괴·드리프트 전 vs 후)라 환경 독립적.
//
//   실행: node engine/validate/eye-capture.js            # 기본 3D 깊이 단언 + 스크린샷
//        node engine/validate/eye-capture.js <sceneId> [ticks] [seed]   # 임의 등록 장면 캡처
//
//   브라우저 없으면 *우아하게 skip*(exit 0·smoke 와 동형) — CI/머신마다 안 깨지게.
'use strict';
const fs = require('fs');
const path = require('path');

const HARNESS = 'file://' + path.resolve(__dirname, 'eye-harness.html');
const OUT_DIR = path.resolve(__dirname, '../../captures');   // render/captures/ (PNG 는 .gitignore — 스크래치)

// ── playwright + 브라우저 자가 탐색(머신 무관·없으면 skip) ──────────────────
function loadPlaywright() {
  const cands = ['playwright',
    '/opt/node22/lib/node_modules/playwright',
    process.env.PLAYWRIGHT_GLOBAL || ''];
  for (const c of cands) { if (!c) continue; try { return require(c); } catch (e) {} }
  return null;
}
function browserPath() {
  for (const p of [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers',
                   path.join(process.env.HOME || '', '.cache/ms-playwright')]) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const pw = loadPlaywright();
  const bp = browserPath();
  if (!pw || !bp) {
    console.log(`\n눈 검증 하네스: ${!pw ? 'playwright 모듈' : 'chromium 브라우저'} 없음 — SKIP(비-치명).`);
    console.log(`  설치: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium`);
    process.exit(0);   // smoke 와 동형 — 환경 없으면 통과(눈 검증은 옵트인)
  }
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = bp;
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  await page.goto(HARNESS);
  await page.waitForFunction('window.__ready === true');
  const cv = page.locator('#cv');
  const shot = (name) => cv.screenshot({ path: path.join(OUT_DIR, name) });
  const build = (kind, opt) => page.evaluate(([k, o]) => window.__build(k, o), [kind, opt]);

  const checks = [];
  const argScene = process.argv[2];

  if (argScene) {
    // 임의 등록 장면 캡처(스크린샷만 — 사람 일별용)
    const ticks = parseInt(process.argv[3] || '0', 10), seed = parseInt(process.argv[4] || '42', 10);
    const r = await build('scene', { id: argScene, seed, ticks });
    await shot(`${argScene}-t${ticks}.png`);
    console.log(`\n캡처: ${argScene} (seed ${seed}·${ticks}tick) → captures/${argScene}-t${ticks}.png`);
    console.log(`  픽셀: lit=${r.analysis.lit}·세로분산=${r.analysis.vSpread}·가로분산=${r.analysis.hSpread}`);
  } else {
    // ── 기본: 3D 깊이가 *실제로 그려지는가* 자동 눈 단언 ──
    console.log('\n=== 눈 검증: L-3d 깊이 렌더 (실제 픽셀 단언) ===');

    // ① 깊이 컬럼 vs 평면 붕괴 — 같은 (x,y), rz 다름 → 세로로 흩어져야(평면 z=0 이면 한 점 겹침).
    const col = await build('column', { flat: false });
    await shot('depth-column.png');
    const flat = await build('column', { flat: true });
    await shot('depth-flat.png');
    const depthDrawn = col.analysis.vSpread > flat.analysis.vSpread * 2.5 && col.analysis.vSpread > 120;
    checks.push({ name: `깊이 컬럼 — 같은 (x,y)·rz 8→88 가 세로로 흩어짐(평면 z=0 대비 ${(col.analysis.vSpread/Math.max(1,flat.analysis.vSpread)).toFixed(1)}배)`,
      pass: depthDrawn, value: `깊이 ${col.analysis.vSpread}px vs 평면 ${flat.analysis.vSpread}px` });

    // ② 깊이 드리프트 — t=0(한 깊이 뭉침) → t=40(vz 로 깊이 흩어짐) 세로분산 증가.
    const t0 = await build('drift', { ticks: 0 });
    await shot('depth-drift-t0.png');
    const t40 = await build('drift', { ticks: 40 });
    await shot('depth-drift-t40.png');
    const drifted = t40.analysis.vSpread > t0.analysis.vSpread + 40;
    checks.push({ name: `깊이 드리프트 — vz 로 t0→t40 깊이 흩어짐(세로분산 ${t0.analysis.vSpread}→${t40.analysis.vSpread}px)`,
      pass: drifted, value: `+${t40.analysis.vSpread - t0.analysis.vSpread}px` });

    // ③ 회귀 — 평면(rz=0) 배치는 여전히 좁은 세로분산(2D 장면 표현 안 깨짐).
    const flatOK = flat.analysis.vSpread < 90 && flat.analysis.lit > 0;
    checks.push({ name: `2D 회귀 — rz=0(평면) 원자는 좁은 세로분산 유지(2D 장면 표현 보존)`,
      pass: flatOK, value: `${flat.analysis.vSpread}px·lit ${flat.analysis.lit}` });

    for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name} = ${c.value}`);
    console.log(`  스크린샷: captures/{depth-column,depth-flat,depth-drift-t0,depth-drift-t40}.png`);
  }

  await browser.close();
  const ok = checks.every(c => c.pass);
  console.log(`\n결과: ${ok ? '눈 검증 PASS ✅' : 'FAIL ❌'}\n`);
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
