/* ============================================================
 * step-0006 헤드리스 검증 (Node):  node verify.js <mode> <seed> [args]
 *  회귀:
 *    reg  <seed>              — 미시 단독: 점화 off(thIgn=∞) → step-0005 와 비트 동일
 *    regc <seed>              — 미시+거시(점화 off): step-0005 결합과 비트 동일
 *  내생적 발산(점화 = 별):
 *    ignsweep <seed>          — thIgn 스윕: "점화의 창" (너무 낮으면 폭주, 너무 높으면 침묵)
 *    life     <seed> [thIgn]  — 영구 생멸: 정착 후(6k~10k) 생멸이 0 이 아닌가 (freeze 해소). 점화 off 대조
 *    cycle    <seed> [thIgn]  — 점화-소진-암흑 주기: 최대 rho·별 개수 시계열의 진동
 *    cons     <seed> [thIgn]  — 보존: E+T 장부 잔차(~1e-6) + 물질 흐름(점화 결손/방출)
 * 시드 [42, 7, 1234, 99, 2026].
 * ============================================================ */
const C = require('./sim-core.js');
const f = (x, d = 2) => (typeof x === 'number' && isFinite(x) ? x.toFixed(d) : String(x));

/* ---------- reg: 미시 단독, step-0005 코어와 비트 단위 비교 ---------- */
function expReg(seed) {
  const OLD = require('../step-0005/sim-core.js');
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  for (const wE of [0, 0.5]) {
    const o = OLD.sweepWindow(64, rates, 1500, seed, { wE });
    const n = C.sweepWindow(64, rates, 1500, seed, { wE });
    const maxd = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
    console.log(`seed=${seed} wE=${wE} 미시 최대차이=${maxd} ${maxd === 0 ? 'OK' : 'DIFF!'}`);
  }
}
function expRegc(seed) {
  const OLD = require('../step-0005/sim-core.js');
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  const o = OLD.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const n = C.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const du = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
  const dm = Math.max(...rates.map((r, i) => Math.abs(o[i].macroLiving - n[i].macroLiving)));
  console.log(`seed=${seed} 미시차이=${du} 거시차이=${dm} ${du === 0 && dm === 0 ? 'OK' : 'DIFF!'}`);
}

/* 표준 시나리오로 사회를 세우고 정착 후 후반 통계를 모은다.
 * 반환: 후반(t0~t1) 생멸/별/잔차/물질 측정 */
function runStd(seed, params, ticks, t0) {
  const sim = C.createSim(64, { seed, params: Object.assign({ wE: 0.5 }, params || {}) });
  C.defaultScenario(sim, 0.04);
  let d0 = 0, b0 = 0, prev = null, churn = 0, n = 0, starTickSum = 0, maxResid = 0;
  let rhoMin = 1e9, rhoMax = 0, livingSum = 0;
  for (let t = 1; t <= ticks; t++) {
    const st = C.step(sim);
    maxResid = Math.max(maxResid, Math.abs(st.resid));
    if (t === t0) { d0 = st.deathsTotal; b0 = st.births; }
    if (t > t0) {
      let c = 0; if (prev) for (let i = 0; i < sim.M; i++) c += Math.abs(sim.rho[i] - prev[i]);
      prev = Float32Array.from(sim.rho); if (c) churn += c; n++;
      starTickSum += st.stars; livingSum += st.livingCount;
      rhoMin = Math.min(rhoMin, st.totalRho); rhoMax = Math.max(rhoMax, st.totalRho);
    }
  }
  return {
    births: sim.births - b0, deaths: sim.deathsTotal - d0,
    churn: churn / n, starsPerTick: starTickSum / n, living: livingSum / n,
    totalRho: sim.stats.totalRho, burnedTotal: sim.burnedTotal,
    rhoMin, rhoMax, maxResid,
  };
}

/* ---------- ignsweep: 점화의 창 — thIgn 을 낮추며 폭주~침묵 사이 ---------- */
function expIgnsweep(seed) {
  console.log(`seed=${seed}  thIgn   별/tick   후반생멸(b/d)  후반living  totalRho(끝)  잔차`);
  for (const thIgn of [Infinity, 1.0, 0.7, 0.55, 0.45, 0.35, 0.25]) {
    const r = runStd(seed, { thIgn }, 8000, 5000);
    console.log(`  ${String(thIgn).padStart(5)}   ${f(r.starsPerTick, 2).padStart(6)}    ${String(r.births).padStart(3)}/${String(r.deaths).padEnd(3)}     ${f(r.living, 2).padStart(5)}      ${f(r.totalRho, 1).padStart(6)}     ${r.maxResid.toExponential(1)}`);
  }
}

/* ---------- life: freeze 해소 — 점화 on vs off, 정착 후(6k~10k) 생멸 ---------- */
function expLife(seed, thIgn) {
  thIgn = thIgn == null ? 0.55 : +thIgn;
  const on = runStd(seed, { thIgn }, 10000, 6000);
  const off = runStd(seed, { thIgn: Infinity }, 10000, 6000);
  console.log(`seed=${seed} thIgn=${thIgn}  후반(6k~10k) 생멸:`);
  console.log(`  점화 ON  → births=${on.births} deaths=${on.deaths}  별/tick=${f(on.starsPerTick,2)} churn=${f(on.churn,2)} living=${f(on.living,2)}`);
  console.log(`  점화 OFF → births=${off.births} deaths=${off.deaths}  (대조=freeze)  잔차 on=${on.maxResid.toExponential(1)}`);
}

/* ---------- cycle: 점화-소진-암흑 주기 시계열 ---------- */
function expCycle(seed, thIgn) {
  thIgn = thIgn == null ? 0.55 : +thIgn;
  const sim = C.createSim(64, { seed, params: { wE: 0.5, thIgn } });
  C.defaultScenario(sim, 0.04);
  console.log(`seed=${seed} thIgn=${thIgn}  tick  별수  living  사망누계  최대rho  totalRho`);
  for (let t = 1; t <= 10000; t++) {
    const st = C.step(sim);
    if (t >= 7000 && t % 250 === 0) {
      let mx = 0; for (let i = 0; i < sim.M; i++) if (sim.rho[i] > mx) mx = sim.rho[i];
      console.log(`  ${String(t).padStart(5)}   ${String(st.stars).padStart(3)}    ${String(st.livingCount).padStart(3)}     ${String(st.deathsTotal).padStart(4)}    ${f(mx,2)}    ${f(st.totalRho,1)}`);
    }
  }
}

/* ---------- cons: 보존 — E+T 잔차 + 물질 흐름 ---------- */
function expCons(seed, thIgn) {
  thIgn = thIgn == null ? 0.55 : +thIgn;
  const r = runStd(seed, { thIgn }, 10000, 6000);
  console.log(`seed=${seed} thIgn=${thIgn}  E+T 최대잔차=${r.maxResid.toExponential(2)} (목표 ~1e-6)`);
  console.log(`  물질: totalRho 끝=${f(r.totalRho,2)}  점화 누적결손(rho→E)=${f(r.burnedTotal,2)}  후반 totalRho 범위 ${f(r.rhoMin,1)}~${f(r.rhoMax,1)}`);
}

const MODES = { reg: expReg, regc: expRegc, ignsweep: expIgnsweep, life: expLife, cycle: expCycle, cons: expCons };
const [, , m, ...args] = process.argv;
if (MODES[m]) MODES[m](+args[0], ...args.slice(1));
else console.log('usage: node verify.js <reg|regc|ignsweep|life|cycle|cons> <seed> [args]');
