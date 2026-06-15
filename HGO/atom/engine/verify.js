// verify.js — 공용 헤드리스 검증 (장면 id 인자). per-step verify.js 복사 없음.
//   node engine/verify.js <scene-id>     예: node engine/verify.js step-0001
// 검증 4기둥(SPINE §9): ① 회귀 0  ② 닫힌 장부(Q·B·L·E·px·py)  ③ 결정론  ④ 가설(장면 assert)
'use strict';
const K = require('./hgo-kernel.js');
const S = require('./hgo-sim.js');
const { SCENES } = require('./scenes.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const LEDGER_KEYS = ['Q', 'B', 'L', 'E', 'px', 'py'];
const LEDGER_TOL = 1e-9;

function simulate(scene, seed) {
  const rng = K.mulberry32(seed);
  const spec = scene.init(rng, K);
  const sim = S.createSim(spec);
  const atoms0 = S.cloneAtoms(sim.atoms);
  const hashBefore = K.hashState(sim);
  const ledgerBefore = K.ledger(sim);
  S.run(sim, scene.ticks);
  return { sim, spec, atoms0, hashBefore, hashAfter: K.hashState(sim), ledgerBefore, ledgerAfter: K.ledger(sim) };
}

function ledgerResidual(a, b) {
  let max = 0; for (const k of LEDGER_KEYS) max = Math.max(max, Math.abs(a[k] - b[k]));
  return max;
}

function hypothesisCtx(r) {
  const W = r.spec.W, H = r.spec.H;
  let disp = 0, bounded = true, maxC = 0;
  for (let i = 0; i < r.sim.atoms.length; i++) {
    const a = r.sim.atoms[i], b = r.atoms0[i];
    disp += Math.hypot(K.minImage(a.rx - b.rx, W), K.minImage(a.ry - b.ry, H));
    if (!(a.rx >= 0 && a.rx < W && a.ry >= 0 && a.ry < H)) bounded = false;
    maxC = Math.max(maxC, a.rx, a.ry);
  }
  return { meanDisp: disp / r.sim.atoms.length, allBounded: bounded, maxCoord: maxC, hashChanged: r.hashBefore !== r.hashAfter };
}

function main() {
  const id = process.argv[2];
  const scene = SCENES[id];
  if (!scene) { console.error(`알 수 없는 장면: ${id}\n사용 가능: ${Object.keys(SCENES).join(', ')}`); process.exit(2); }

  console.log(`\n=== verify ${scene.id} — ${scene.title} ===`);
  console.log(`시드 ${JSON.stringify(SEEDS)} · ${scene.ticks} tick\n`);

  let determinism = true, maxResidual = 0;
  const watchAvg = {}, checkAgg = {};   // ④ 가설: 이름→{pass:전 시드 통과, value:시드42 값}

  for (const seed of SEEDS) {
    const r1 = simulate(scene, seed);
    const r2 = simulate(scene, seed);                 // ③ 결정론: 같은 시드 2회
    if (r1.hashAfter !== r2.hashAfter) determinism = false;
    maxResidual = Math.max(maxResidual, ledgerResidual(r1.ledgerBefore, r1.ledgerAfter)); // ②
    for (const c of scene.assert(hypothesisCtx(r1), K)) { // ④ 전 시드 집계
      const a = checkAgg[c.name] || (checkAgg[c.name] = { pass: true, value: c.value });
      if (!c.pass) a.pass = false;
      if (seed === SEEDS[0]) a.value = c.value;
    }
    const w = scene.watch(r1.sim, K);
    for (const k in w) watchAvg[k] = (watchAvg[k] || 0) + w[k] / SEEDS.length;
  }
  const hypoPass = Object.values(checkAgg).every(c => c.pass);

  const hasKnobLaw = require('./hgo-laws.js').LAW_ORDER.length > 0;
  console.log(`① 회귀 0 : ${hasKnobLaw ? '(상위 step 에서 새 노브=0 → 직전 비트 동일 검사)' : 'N/A — 부트스트랩(첫 step). 결정론·보존이 앵커.'}`);
  console.log(`② 닫힌 장부 : 잔차 ${maxResidual.toExponential(2)}  ${maxResidual <= LEDGER_TOL ? 'PASS' : 'FAIL'}  (Q·B·L·E·px·py, 임계 ${LEDGER_TOL})`);
  console.log(`③ 결정론 : ${determinism ? 'PASS' : 'FAIL'}  (같은 시드 2회 → 상태 해시 일치)`);
  console.log(`④ 가설 (전 시드 통과 여부, 값=시드 ${SEEDS[0]}):`);
  for (const name of Object.keys(checkAgg))
    console.log(`     ${checkAgg[name].pass ? 'PASS' : 'FAIL'}  ${name} = ${checkAgg[name].value}`);
  console.log(`\n관찰(시드 평균):`, JSON.stringify(watchAvg));

  const ok = determinism && maxResidual <= LEDGER_TOL && hypoPass;
  console.log(`\n결과: ${ok ? 'PASS ✅' : 'FAIL ❌'}\n`);
  process.exit(ok ? 0 : 1);
}

main();
