/* ============================================================
 * step-0010 헤드리스 검증 (Node):  node verify.js <mode> <seed> [args]
 *  회귀 (재귀의 기본 = step-0009 결합과 비트 동일):
 *    reg  <seed>              — 미시 단독(점화 off/on)·사슬·두-사슬 충돌이 step-0009 코어와 비트 동일.
 *    regc <seed>              — 미시+거시 기본 결합(거시 점화 off, promoteComp off)이 step-0009 와 비트 동일.
 *    regm <seed>              — 거시 *사슬*(거시 점화 on) 이어도 promoteComp off 면 step-0009 코어와 비트 동일 —
 *                               거시 점화는 새 코드가 아니라 같은 ignite() 의 거시 params 적용임을 증명.
 *    reg0 <seed>              — 층간 트레이서 중립성: promoteComp on(미시 φ=1) + 거시 igniteHeatB=null 이
 *                               promoteComp off 와 거시 동역학 비트 동일 — 기질 승급도 순수 측정.
 *  재귀 (미시 사슬 → 거시 사슬, 기질 승급):
 *    recur <seed>             — 미시 φ=1 단일 사슬이 거시 사슬을 만드는가? 미시별 φ → 거시별 φ (기질 유전 up).
 *    fate  <seed>             — 미시 기질(φ 0/1) × 거시 igniteHeatB(0.05/0.5): 미시 종류가 거시 사슬의
 *                               종류(빛/열)를 가르는가. 계수는 오직 φ 경유로만 작동하는가.
 *    dual  <seed> [heatB]     — 두 미시 사슬(좌 16,32 + 우 48,32) → 한 거시 사슬. 빛+빛/빛+열/열+열 의
 *                               거시별 φ — 미시에서 안 섞이던 두 기질이 거시에서 혼혈로 융합하는가?
 *    cons  <seed>             — 보존: 두 층 E+T 잔차 + 거시 rhoB ≤ rho (층간 트레이서 건전성).
 * 시드 [42, 7, 1234, 99, 2026]. 사슬 연료·노브 = step-0007 (E=0.030, rho=0.020, ejR=6, thIgn=0.40).
 * 메타-사슬 결합 노브(META) = N2=32, every=2, kPromote=0.5, scaleM=2.0, cE=3.0, 거시 ejR=3, thIgn₂=0.20.
 * ============================================================ */
const C = require('./sim-core.js');
const C9 = require('../step-0009/sim-core.js');
const f = (x, d = 2) => (typeof x === 'number' && isFinite(x) ? x.toFixed(d) : String(x));

const CHAIN_PARAMS = {
  wE: 1.0, thIgn: 0.40, burnFrac: 0.6, ejectFrac: 0.85, massToE: 5.0,
  igniteSpread: 0.92, igniteHeat: 0.05, igniteRadius: 0,
};
// ★ 메타-사슬 결합 프리셋: 거시도 사슬을 돌리려면 승급이 거시 source 노릇을 할 만큼 강해야 한다(결합 계수).
//   거시 params 는 CHAIN_PARAMS 와 *같은 사슬 법칙* + 거시 격자에 맞춘 ejR/thIgn — 거시는 또 하나의 장.
const META = { N2: 32, every: 2, kPromote: 0.5, scaleM: 2.0, cE: 3.0, macroEjR: 3, thIgn2: 0.20 };
function macroOpts(over) {
  return Object.assign({
    N2: META.N2, every: META.every, kPromote: META.kPromote, scaleM: META.scaleM, cE: META.cE,
    params: Object.assign({}, CHAIN_PARAMS, { thIgn: META.thIgn2, ejectRadius: META.macroEjR }),
  }, over || {});
}

/* ---------- reg: 미시 단독이 step-0009 코어와 비트 동일 ---------- */
function expReg(seed) {
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  for (const wE of [0, 0.5]) {
    const o0 = C9.sweepWindow(64, rates, 1500, seed, { wE });
    const n0 = C.sweepWindow(64, rates, 1500, seed, { wE });
    const md0 = Math.max(...rates.map((r, i) => Math.abs(o0[i].living - n0[i].living)));
    const o1 = C9.sweepWindow(64, rates, 1500, seed, { wE, thIgn: 0.45 });
    const n1 = C.sweepWindow(64, rates, 1500, seed, { wE, thIgn: 0.45 });
    const md1 = Math.max(...rates.map((r, i) => Math.abs(o1[i].living - n1[i].living)));
    console.log(`seed=${seed} wE=${wE}  점화off 최대차이=${md0}  점화on(thIgn=0.45) 최대차이=${md1}  ${md0 === 0 && md1 === 0 ? 'OK' : 'DIFF!'}`);
  }
  const dr = chainRegDiff(seed);
  console.log(`seed=${seed} 사슬(ejR=6) step-0009 대비 최대차이: totalRho=${dr.rho.toExponential(2)} deaths=${dr.deaths} living=${dr.living}  ${dr.ok ? 'OK' : 'DIFF!'}`);
}
function chainRegDiff(seed) {
  const mk = (Core) => {
    const sim = Core.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
    Core.singleChainScenario(sim, { phi: 1 });
    let rho = 0, deaths = 0, living = 0;
    for (let t = 1; t <= 2000; t++) { const s = Core.step(sim); rho = s.totalRho; deaths = s.deathsTotal; living = s.livingCount; }
    return { rho, deaths, living };
  };
  const a = mk(C9), b = mk(C);
  return { rho: Math.abs(a.rho - b.rho), deaths: Math.abs(a.deaths - b.deaths), living: Math.abs(a.living - b.living),
    ok: a.rho === b.rho && a.deaths === b.deaths && a.living === b.living };
}

/* ---------- regc: 기본 결합(거시 점화 off, promoteComp off)이 step-0009 와 비트 동일 ---------- */
function expRegc(seed) {
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  const o = C9.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const n = C.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const du = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
  const dm = Math.max(...rates.map((r, i) => Math.abs(o[i].macroLiving - n[i].macroLiving)));
  console.log(`seed=${seed} 기본 결합 미시차이=${du} 거시차이=${dm} ${du === 0 && dm === 0 ? 'OK' : 'DIFF!'}`);
}

/* ---------- regm: 거시 *사슬*(거시 점화 on, promoteComp off)이 step-0009 코어와 비트 동일 ----------
 * 거시 점화는 새 코드가 아니다 — 같은 ignite() 에 거시 params(thIgn₂·ejR)를 줬을 뿐.
 * promoteComp off 면 승급에 rhoB 연산이 0 이므로 step-0009 코어로 같은 결합을 짜면 비트 동일해야 한다. */
function macroChainSig(Core, seed) {
  const sim = Core.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
  Core.singleChainScenario(sim, { phi: 1 });
  const macro = Core.createMacro(sim, macroOpts());   // promoteComp 기본 off
  let uRho = 0, mRho = 0, mE = 0, mStars = 0;
  for (let t = 1; t <= 2000; t++) {
    Core.stepCoupled(sim, macro);
    uRho = sim.stats.totalRho;
    if (macro.stats) { mRho = macro.stats.totalRho; mE = macro.stats.totalE; mStars += macro.lastIgnite.length; }
  }
  return { uRho, mRho, mE, mStars };
}
function expRegm(seed) {
  const a = macroChainSig(C9, seed), b = macroChainSig(C, seed);
  const ok = a.uRho === b.uRho && a.mRho === b.mRho && a.mE === b.mE && a.mStars === b.mStars;
  console.log(`seed=${seed} 거시사슬(promoteComp off) step-0009 대비: 미시ρ=${Math.abs(a.uRho - b.uRho).toExponential(2)} 거시ρ₂=${Math.abs(a.mRho - b.mRho).toExponential(2)} 거시E=${Math.abs(a.mE - b.mE).toExponential(2)} 거시별수=${Math.abs(a.mStars - b.mStars)}  ${ok ? 'OK' : 'DIFF!'}`);
}

/* ---------- reg0: 층간 트레이서 중립성 ----------
 * promoteComp on (미시 φ=1 이 매 승급마다 거시 rhoB 로 동승) + 거시 igniteHeatB=null →
 * 거시 rho/E/T 가 promoteComp off 와 비트 동일. 기질 승급도 *측정*이고, 거시 동역학을 바꾸는 것은
 * 오직 거시 계수(igniteHeatB)다 — 양(rhoB)과 법칙(보간)의 분리가 층간 채널에서도 성립. */
function macroSig(comp, seed, heatB) {
  const sim = C.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
  C.singleChainScenario(sim, { phi: 1 });
  const macro = C.createMacro(sim, macroOpts({ promoteComp: comp, params: Object.assign({}, CHAIN_PARAMS, { thIgn: META.thIgn2, ejectRadius: META.macroEjR, igniteHeatB: heatB }) }));
  let mRho = 0, mE = 0, mT = 0, mStars = 0;
  for (let t = 1; t <= 2500; t++) {
    C.stepCoupled(sim, macro);
    if (macro.stats) { mRho = macro.stats.totalRho; mE = macro.stats.totalE; mT = macro.stats.totalT; mStars += macro.lastIgnite.length; }
  }
  return { mRho, mE, mT, mStars };
}
function expReg0(seed) {
  const off = macroSig(false, seed, null), on = macroSig(true, seed, null);
  const ok = off.mRho === on.mRho && off.mE === on.mE && off.mT === on.mT && off.mStars === on.mStars;
  console.log(`seed=${seed} promoteComp off→on (미시 φ=1, 거시 igniteHeatB=null)  거시차이: ρ₂=${Math.abs(off.mRho - on.mRho).toExponential(2)} E=${Math.abs(off.mE - on.mE).toExponential(2)} T=${Math.abs(off.mT - on.mT).toExponential(2)} 별수=${Math.abs(off.mStars - on.mStars)}  ${ok ? 'OK (층간 트레이서=순수 측정)' : 'DIFF!'}`);
}

/* ---------- recur: 미시 사슬 → 거시 사슬, 기질 유전 (up the layer) ----------
 * 미시 φ=1 단일 사슬 + 거시 점화(promoteComp on, 거시 igniteHeatB=null = 계수 off, 측정만).
 * 거시별/t > 0 + 거시별 위치 std > 0 면 거시 사슬이 *굴러간다*. 미시별 φ → 거시별 φ 면 기질이 층을 탄다. */
function runRecur(seed, microPhi, ticks) {
  const sim = C.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
  C.singleChainScenario(sim, { phi: microPhi });
  const macro = C.createMacro(sim, macroOpts({ promoteComp: true }));   // 거시 igniteHeatB=null (계수 off)
  ticks = ticks || 3000;
  const tail = Math.floor(ticks * 0.6);
  let uStarPhi = 0, uN = 0, mStars = 0, mLiving = 0, mPhi = 0, mPhiN = 0, n = 0, mResid = 0, uResid = 0;
  const xs = [], ys = [];
  for (let t = 1; t <= ticks; t++) {
    C.stepCoupled(sim, macro);
    uResid = Math.max(uResid, Math.abs(sim.stats.resid));
    if (t >= tail) {
      for (const b of sim.lastIgnite) { uStarPhi += b.phi; uN++; }
      if (macro.stats) {
        mResid = Math.max(mResid, Math.abs(macro.stats.resid));
        mStars += macro.lastIgnite.length; mLiving += macro.stats.livingCount;
        for (const b of macro.lastIgnite) { xs.push(b.i % META.N2); ys.push((b.i / META.N2) | 0); mPhi += b.phi; mPhiN++; }
        n++;
      }
    }
  }
  let std = 0;
  if (xs.length > 1) {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let v = 0; for (let i = 0; i < xs.length; i++) v += (xs[i] - mx) ** 2 + (ys[i] - my) ** 2;
    std = Math.sqrt(v / xs.length);
  }
  const fieldPhi2 = macro.stats && macro.stats.totalRho > 0 ? macro.stats.totalRhoB / macro.stats.totalRho : 0;
  return { uStarPhi: uN ? uStarPhi / uN : 0, mStars: n ? mStars / n : 0, mLiving: n ? mLiving / n : 0,
    mStarPhi: mPhiN ? mPhi / mPhiN : 0, fieldPhi2, std, mResid, uResid };
}
function expRecur(seed) {
  const r = runRecur(seed, 1, 3000);
  console.log(`seed=${seed} 미시 φ=1 단일 사슬 → 거시 사슬 (거시 igniteHeatB=null), 3000 tick 후반:`);
  console.log(`  거시별/t=${f(r.mStars, 2)} 거시별 위치std=${f(r.std, 2)} (>0 = 거시 사슬이 굴러간다)  거시living=${f(r.mLiving, 2)}`);
  console.log(`  미시별 φ=${f(r.uStarPhi, 3)} → 거시별 φ=${f(r.mStarPhi, 3)} (거시장 φ=${f(r.fieldPhi2, 3)})  — 기질이 층을 타고 올라가는가`);
  console.log(`  잔차: 미시=${r.uResid.toExponential(2)} 거시=${r.mResid.toExponential(2)}`);
}

/* ---------- fate: 미시 기질이 거시 사슬의 종류(빛/열)를 가른다 ----------
 * 미시 φ ∈ {0,1} × 거시 igniteHeatB ∈ {0.05, 0.5}. φ=0(빛 사회) 이면 heatB 와 무관(계수는 φ 경유로만).
 * φ=1(열 사회) + heatB=0.5 면 거시 사슬이 발산을 열로 돌린다 → 거시 E 하락 = 거시 운명이 갈린다. */
function runFate(seed, microPhi, heatB, ticks) {
  const sim = C.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
  C.singleChainScenario(sim, { phi: microPhi });
  const macro = C.createMacro(sim, macroOpts({ promoteComp: true, params: Object.assign({}, CHAIN_PARAMS, { thIgn: META.thIgn2, ejectRadius: META.macroEjR, igniteHeatB: heatB }) }));
  ticks = ticks || 3000;
  const tail = Math.floor(ticks * 0.6);
  let mStars = 0, mRho = 0, mT = 0, mE = 0, mPhi = 0, mPhiN = 0, n = 0;
  for (let t = 1; t <= ticks; t++) {
    C.stepCoupled(sim, macro);
    if (t >= tail && macro.stats) {
      mStars += macro.lastIgnite.length; mRho += macro.stats.totalRho; mT += macro.stats.totalT; mE += macro.stats.totalE;
      for (const b of macro.lastIgnite) { mPhi += b.phi; mPhiN++; } n++;
    }
  }
  return { mStars: n ? mStars / n : 0, mRho: n ? mRho / n : 0, mT: n ? mT / n : 0, mE: n ? mE / n : 0, mPhi: mPhiN ? mPhi / mPhiN : 0 };
}
function expFate(seed) {
  console.log(`seed=${seed} 거시 운명: 미시 기질(φ) × 거시 igniteHeatB (거시 사슬의 종류):`);
  console.log('미시φ heatB | 거시별/t  거시ρ₂합  거시T합   거시E합   거시별φ');
  for (const [mp, hb] of [[0, 0.05], [0, 0.50], [1, 0.05], [1, 0.50]]) {
    const r = runFate(seed, mp, hb, 3000);
    console.log(`  ${mp}   ${f(hb, 2)} |  ${f(r.mStars, 2).padStart(5)}    ${f(r.mRho, 2).padStart(5)}   ${f(r.mT, 2).padStart(6)}  ${f(r.mE, 2).padStart(6)}   ${f(r.mPhi, 2)}`);
  }
  console.log('  (φ=0 행은 heatB 와 무관해야 = 계수는 φ 경유로만; φ=1 + heatB=0.5 면 거시 E 하락 = 열 사슬)');
}

/* ---------- dual: 두 미시 사슬 → 한 거시 사슬 (기질의 융합) ----------
 * step-0008/0009 에서 두 미시 사슬의 성분은 16셀 거리에서도 *섞이지 않았다*(좌 φ0 / 우 φ1).
 * 그 둘이 함께 거시로 승급하면 거시 별의 φ 는 어디로 가는가 — 한쪽인가, 혼혈인가?
 * 빛+빛(φ0+φ0)·빛+열(φ0+φ1)·열+열(φ1+φ1). 거시별 φ 가 빛+열에서 중간값이면 거시에서 융합. */
function runDual(seed, phiL, phiR, heatB, ticks) {
  const sim = C.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
  C.twoChainScenario(sim, { dist: 32, phiL, phiR });
  const macro = C.createMacro(sim, macroOpts({ promoteComp: true, params: Object.assign({}, CHAIN_PARAMS, { thIgn: META.thIgn2, ejectRadius: META.macroEjR, igniteHeatB: heatB }) }));
  ticks = ticks || 3000;
  const tail = Math.floor(ticks * 0.6);
  let mStars = 0, mPhi = 0, mPhiN = 0, mE = 0, n = 0;
  const xs = [], ys = [];
  for (let t = 1; t <= ticks; t++) {
    C.stepCoupled(sim, macro);
    if (t >= tail && macro.stats) {
      mStars += macro.lastIgnite.length; mE += macro.stats.totalE;
      for (const b of macro.lastIgnite) { xs.push(b.i % META.N2); ys.push((b.i / META.N2) | 0); mPhi += b.phi; mPhiN++; } n++;
    }
  }
  let std = 0;
  if (xs.length > 1) {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let v = 0; for (let i = 0; i < xs.length; i++) v += (xs[i] - mx) ** 2 + (ys[i] - my) ** 2;
    std = Math.sqrt(v / xs.length);
  }
  return { mStars: n ? mStars / n : 0, mPhi: mPhiN ? mPhi / mPhiN : 0, std, mE: n ? mE / n : 0 };
}
function expDual(seed, heatB) {
  heatB = heatB == null ? 0.5 : +heatB;
  console.log(`seed=${seed} 두 미시 사슬(좌 16,32 + 우 48,32) → 한 거시 사슬, heatB=${heatB}:`);
  console.log('조합 | 거시별/t  거시별φ(올라온 기질)  거시별std  거시E합');
  for (const [nm, pL, pR] of [['빛+빛', 0, 0], ['빛+열', 0, 1], ['열+열', 1, 1]]) {
    const r = runDual(seed, pL, pR, heatB, 3000);
    console.log(`${nm} |  ${f(r.mStars, 2).padStart(5)}      ${f(r.mPhi, 2)}          ${f(r.std, 2).padStart(5)}    ${f(r.mE, 1)}`);
  }
  console.log('  (빛+열 의 거시별 φ 가 중간값이면 — 미시에서 안 섞이던 두 기질이 거시에서 혼혈로 융합)');
}

/* ---------- cons: 두 층 보존 + 층간 트레이서 건전성 ---------- */
function expCons(seed) {
  const sim = C.createSim(64, { seed, params: Object.assign({ ejectRadius: 6 }, CHAIN_PARAMS) });
  C.singleChainScenario(sim, { phi: 1 });
  const macro = C.createMacro(sim, macroOpts({ promoteComp: true, params: Object.assign({}, CHAIN_PARAMS, { thIgn: META.thIgn2, ejectRadius: META.macroEjR, igniteHeatB: 0.5 }) }));
  let uResid = 0, mResid = 0, maxOver = 0;
  for (let t = 1; t <= 5000; t++) {
    C.stepCoupled(sim, macro);
    uResid = Math.max(uResid, Math.abs(sim.stats.resid));
    if (macro.stats) mResid = Math.max(mResid, Math.abs(macro.stats.resid));
    if (t % 500 === 0 && macro.rhoB) {
      for (let i = 0; i < macro.M; i++) { const over = macro.rhoB[i] - macro.rho[i]; if (over > maxOver) maxOver = over; }
    }
  }
  console.log(`seed=${seed} 메타-사슬 (미시 φ=1, 거시 heatB=0.5)  미시 E+T 잔차=${uResid.toExponential(2)}  거시 E+T 잔차=${mResid.toExponential(2)}`);
  console.log(`  층간 트레이서 건전성: max(거시 rhoB - 거시 rho)=${maxOver.toExponential(2)} (φ≤1 위반량 — 0 또는 부동소수점 잡음)`);
}

const MODES = { reg: expReg, regc: expRegc, regm: expRegm, reg0: expReg0, recur: expRecur, fate: expFate, dual: expDual, cons: expCons };
const [, , m, ...args] = process.argv;
if (MODES[m]) MODES[m](+args[0], ...args.slice(1));
else console.log('usage: node verify.js <reg|regc|regm|reg0|recur|fate|cons> <seed> [args]');
