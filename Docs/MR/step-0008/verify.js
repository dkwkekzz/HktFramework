/* ============================================================
 * step-0008 헤드리스 검증 (Node):  node verify.js <mode> <seed> [args]
 *  회귀 (코어가 step-0007 과 *비트 동일* — 법칙·계수 변경 0):
 *    reg  <seed>              — 미시 단독: 점화 off + 점화 on(thIgn=0.45) + 사슬 모두 step-0007 동일
 *    regc <seed>              — 미시+거시: step-0007 결합과 비트 동일
 *  충돌 (두 사슬, ejectRadius=6):
 *    collide <seed> [ejR]     — 거리 스윕. 경계(cx=32, |x-32|<=3) 별 비율·living·경계 living.
 *                               가까우면 공유 별(border%↑), 멀면 공유 자식 사회(borderLiving↑).
 *    child   <seed> [dist]    — 인과 대조: 두 사슬 vs 왼쪽 사슬만. 경계 자식 사회가 둘이 함께 만든 것인가?
 *    repel   <seed>           — 밀어냄? 좌 사슬 별 무게중심 x 가 source 에서 경계 반대로 밀리는가 (거리 스윕).
 *    series  <seed> [dist]    — 시계열 (경계의 일생): 경계 별수·경계 living·totalRho.
 *    cons    <seed> [dist]    — 보존: E+T 잔차(~1e-5).
 * 시드 [42, 7, 1234, 99, 2026]. 표준 충돌 좌표 = step-0004 ③ (좌 16,32 · 우 48,32 · sink 32,8).
 * ============================================================ */
const C = require('./sim-core.js');
const C7 = require('../step-0007/sim-core.js');
const f = (x, d = 2) => (typeof x === 'number' && isFinite(x) ? x.toFixed(d) : String(x));

const CHAIN_PARAMS = {
  wE: 1.0, thIgn: 0.40, burnFrac: 0.6, ejectFrac: 0.85, massToE: 5.0,
  igniteSpread: 0.92, igniteHeat: 0.05, igniteRadius: 0,
};

/* ---------- reg: step-0008 코어 == step-0007 코어 (비트 동일) ---------- */
function expReg(seed) {
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  for (const wE of [0, 0.5]) {
    const o0 = C7.sweepWindow(64, rates, 1500, seed, { wE });
    const n0 = C.sweepWindow(64, rates, 1500, seed, { wE });
    const md0 = Math.max(...rates.map((r, i) => Math.abs(o0[i].living - n0[i].living)));
    const o1 = C7.sweepWindow(64, rates, 1500, seed, { wE, thIgn: 0.45 });
    const n1 = C.sweepWindow(64, rates, 1500, seed, { wE, thIgn: 0.45 });
    const md1 = Math.max(...rates.map((r, i) => Math.abs(o1[i].living - n1[i].living)));
    console.log(`seed=${seed} wE=${wE}  점화off 최대차이=${md0}  점화on(thIgn=0.45) 최대차이=${md1}  ${md0 === 0 && md1 === 0 ? 'OK' : 'DIFF!'}`);
  }
  // 사슬(ejectRadius=6) 도 step-0007 과 비트 동일한지 확인 — 같은 시드·시나리오로 stats 비교
  const dr = chainRegDiff(seed);
  console.log(`seed=${seed} 사슬(ejR=6) step-0007 대비 최대차이: totalRho=${dr.rho.toExponential(2)} deaths=${dr.deaths} living=${dr.living}  ${dr.ok ? 'OK' : 'DIFF!'}`);
}
function chainRegDiff(seed) {
  const mk = (Core) => {
    const sim = Core.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
    Core.addSource(sim, 16, 32, 2, 0.030, 0.020); Core.addSink(sim, 48, 48, 4, 0.10);
    let rho = 0, deaths = 0, living = 0;
    for (let t = 1; t <= 2000; t++) { const s = Core.step(sim); rho = s.totalRho; deaths = s.deathsTotal; living = s.livingCount; }
    return { rho, deaths, living };
  };
  const a = mk(C7), b = mk(C);
  return { rho: Math.abs(a.rho - b.rho), deaths: Math.abs(a.deaths - b.deaths), living: Math.abs(a.living - b.living),
    ok: a.rho === b.rho && a.deaths === b.deaths && a.living === b.living };
}
function expRegc(seed) {
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  const o = C7.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const n = C.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const du = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
  const dm = Math.max(...rates.map((r, i) => Math.abs(o[i].macroLiving - n[i].macroLiving)));
  console.log(`seed=${seed} 미시차이=${du} 거시차이=${dm} ${du === 0 && dm === 0 ? 'OK' : 'DIFF!'}`);
}

/* ---------- 두 사슬 충돌 실행 ---------- */
function runCollide(seed, dist, ejR, ticks, single) {
  const params = Object.assign({ ejectRadius: ejR }, CHAIN_PARAMS);
  const sim = C.createSim(64, { seed, params });
  const sc = single
    ? (C.singleChainScenario(sim, { x: 32 - (dist >> 1), y: 32 }), { cx: 32 })
    : C.twoChainScenario(sim, { dist });
  const cx = sc.cx;
  const tail = Math.floor(ticks * 0.6);
  let border = 0, all = 0, living = 0, cross = 0, n = 0, maxResid = 0;
  for (let t = 1; t <= ticks; t++) {
    const st = C.step(sim);
    maxResid = Math.max(maxResid, Math.abs(st.resid));
    if (t >= tail) {
      for (const b of sim.lastIgnite) { all++; if (Math.abs(b.i % 64 - cx) <= 3) border++; }
      living += st.livingCount;
      for (const a of sim.agents) if (a.alive && Math.abs(a.cx - cx) <= 3) cross++;
      n++;
    }
  }
  return { borderFrac: all ? border / all : 0, living: living / n, cross: cross / n, maxResid };
}

/* ---------- collide: 거리 스윕 ---------- */
function expCollide(seed, ejR) {
  ejR = ejR == null ? 6 : +ejR;
  console.log(`seed=${seed} ejR=${ejR}  두 사슬, 경계 cx=32 (|x-32|<=3=border)`);
  console.log('dist | border%  living  borderLiving | (border%↑=공유 별, borderLiving↑=공유 자식)');
  for (const d of [12, 16, 20, 24, 32]) {
    const r = runCollide(seed, d, ejR, 6000, false);
    console.log(`${String(d).padStart(4)} | ${f(r.borderFrac * 100, 1).padStart(5)}   ${f(r.living, 2).padStart(5)}   ${f(r.cross, 2).padStart(5)}`);
  }
}

/* ---------- child: 인과 대조 (두 사슬 vs 왼쪽만) ---------- */
function expChild(seed, dist) {
  dist = dist == null ? 32 : +dist;
  const two = runCollide(seed, dist, 6, 6000, false);
  const one = runCollide(seed, dist, 6, 6000, true);
  console.log(`seed=${seed} dist=${dist}  경계 자식 사회 인과 대조:`);
  console.log(`  두 사슬 borderLiving=${f(two.cross, 2)}  vs  왼쪽 사슬만=${f(one.cross, 2)}  → 인과 기여=${f(two.cross - one.cross, 2)}`);
  console.log(`  (양쪽 모두 cx=32 의 |x-32|<=3. 기여>0 이면 자식은 둘이 *함께* 만든 것)`);
}

/* ---------- repel: 두 사슬이 밀어내는가 (좌 사슬 별 무게중심 vs source) ---------- */
function expRepel(seed) {
  console.log(`seed=${seed}  좌 사슬 별 무게중심 x 가 source 에서 경계(cx=32) 반대로 밀리는가?`);
  console.log('dist     src x   별 무게중심 x   밀림 Δ (>0 = 경계서 멀어짐)');
  for (const dist of [12, 16, 20, 24, 32]) {
    const sim = C.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
    const sc = C.twoChainScenario(sim, { dist });
    const ticks = 6000, tail = Math.floor(ticks * 0.6);
    let sx = 0, sn = 0;
    for (let t = 1; t <= ticks; t++) {
      C.step(sim);
      if (t >= tail) for (const b of sim.lastIgnite) { const x = b.i % 64; if (x < sc.cx) { sx += x; sn++; } }
    }
    const centroid = sn ? sx / sn : 0, push = sc.lx - centroid;
    console.log(`${String(dist).padStart(4)}    ${String(sc.lx).padStart(4)}     ${f(centroid, 1).padStart(6)}        ${f(push, 1)}`);
  }
}

/* ---------- series: 경계의 일생 ---------- */
function expSeries(seed, dist) {
  dist = dist == null ? 32 : +dist;
  const sim = C.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
  const sc = C.twoChainScenario(sim, { dist });
  console.log(`seed=${seed} dist=${dist}  tick   별수  경계별  경계living  totalRho`);
  for (let t = 1; t <= 10000; t++) {
    const st = C.step(sim);
    if (t >= 7000 && t % 1000 === 0) {
      let bs = 0; for (const b of sim.lastIgnite) if (Math.abs(b.i % 64 - sc.cx) <= 3) bs++;
      let bl = 0; for (const a of sim.agents) if (a.alive && Math.abs(a.cx - sc.cx) <= 3) bl++;
      console.log(`             ${String(t).padStart(5)}   ${String(st.stars).padStart(3)}    ${String(bs).padStart(3)}     ${String(bl).padStart(3)}      ${f(st.totalRho, 1)}`);
    }
  }
}

/* ---------- cons: 보존 ---------- */
function expCons(seed, dist) {
  dist = dist == null ? 32 : +dist;
  const r = runCollide(seed, dist, 6, 8000, false);
  console.log(`seed=${seed} dist=${dist}  E+T 최대잔차=${r.maxResid.toExponential(2)} (목표 ~1e-5, 1e-3 한참 아래)`);
}

const MODES = { reg: expReg, regc: expRegc, collide: expCollide, child: expChild, repel: expRepel, series: expSeries, cons: expCons };
const [, , m, ...args] = process.argv;
if (MODES[m]) MODES[m](+args[0], ...args.slice(1));
else console.log('usage: node verify.js <reg|regc|collide|child|repel|series|cons> <seed> [args]');
