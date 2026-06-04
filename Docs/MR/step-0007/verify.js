/* ============================================================
 * step-0007 헤드리스 검증 (Node):  node verify.js <mode> <seed> [args]
 *  회귀 (ejectRadius=0 기본 — step-0006 4-이웃 분배와 비트 동일):
 *    reg  <seed>              — 미시 단독: 점화 off + 점화 on(thIgn=0.45) 둘 다 step-0006 동일
 *    regc <seed>              — 미시+거시: step-0006 결합과 비트 동일
 *  사슬 (source→별→생명→거름→새 별, ejectRadius>0):
 *    chain <seed> [ejR]       — 외부 트리거 0 으로 10000 tick. 별의 위치 분산·후반 별/tick·생멸.
 *    move  <seed> [ejR]       — 별의 *이동* 거리: 연속 점화 셀 간 거리의 평균/분포
 *    cons  <seed> [ejR]       — 보존: E+T 잔차(~1e-6) + 물질 흐름(burnedTotal vs rho 감소)
 * 시드 [42, 7, 1234, 99, 2026].
 * ============================================================ */
const C = require('./sim-core.js');
const C6 = require('../step-0006/sim-core.js');
const f = (x, d = 2) => (typeof x === 'number' && isFinite(x) ? x.toFixed(d) : String(x));

/* ---------- reg: 점화 off + 점화 on (ejR=0 기본) 모두 step-0006 비트 동일 ---------- */
function expReg(seed) {
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  for (const wE of [0, 0.5]) {
    // ① 점화 off (thIgn=∞ 기본) — step-0005 까지의 회귀
    const o0 = C6.sweepWindow(64, rates, 1500, seed, { wE });
    const n0 = C.sweepWindow(64, rates, 1500, seed, { wE });
    const md0 = Math.max(...rates.map((r, i) => Math.abs(o0[i].living - n0[i].living)));
    // ② 점화 on (thIgn=0.45, ejectRadius=0 기본) — step-0006 동일
    const o1 = C6.sweepWindow(64, rates, 1500, seed, { wE, thIgn: 0.45 });
    const n1 = C.sweepWindow(64, rates, 1500, seed, { wE, thIgn: 0.45 });
    const md1 = Math.max(...rates.map((r, i) => Math.abs(o1[i].living - n1[i].living)));
    console.log(`seed=${seed} wE=${wE}  점화off 최대차이=${md0}  점화on(thIgn=0.45) 최대차이=${md1}  ${md0 === 0 && md1 === 0 ? 'OK' : 'DIFF!'}`);
  }
}
function expRegc(seed) {
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  const o = C6.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const n = C.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const du = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
  const dm = Math.max(...rates.map((r, i) => Math.abs(o[i].macroLiving - n[i].macroLiving)));
  console.log(`seed=${seed} 미시차이=${du} 거시차이=${dm} ${du === 0 && dm === 0 ? 'OK' : 'DIFF!'}`);
}

/* ---------- chain: 외부 트리거 0 으로 사슬이 굴러간다 ---------- */
function chainScenario(sim, opts) {
  // 단일 source — 씨앗(E + 약한 rho). 점화 후 사슬이 ejected rho 로 자기지속.
  sim.sources.length = 0; sim.sinks.length = 0;
  const N = sim.N;
  const sx = opts.srcX != null ? opts.srcX : 16, sy = opts.srcY != null ? opts.srcY : 32;
  C.addSource(sim, sx, sy, opts.srcR || 2, opts.srcE != null ? opts.srcE : 0.030, opts.srcRho != null ? opts.srcRho : 0.020);
  C.addSink(sim, 48, 48, 4, 0.10);
}

function runChain(seed, opts) {
  const params = Object.assign({
    wE: 1.0, thIgn: 0.40, burnFrac: 0.6, ejectFrac: 0.85, massToE: 5.0,
    igniteSpread: 0.92, igniteHeat: 0.05,
    ejectRadius: opts.ejectRadius != null ? opts.ejectRadius : 4,
    igniteRadius: opts.igniteRadius != null ? opts.igniteRadius : 0,
  }, opts.params || {});
  const sim = C.createSim(64, { seed, params });
  chainScenario(sim, opts);
  const ticks = opts.ticks || 10000;
  const tailStart = Math.floor(ticks * 0.6);
  const starXs = [], starYs = [];
  let starsLate = 0, livingSum = 0, livingN = 0;
  let bdAtTail = null;
  let maxResid = 0;
  for (let t = 1; t <= ticks; t++) {
    const st = C.step(sim);
    maxResid = Math.max(maxResid, Math.abs(st.resid));
    if (t >= tailStart) {
      for (const b of sim.lastIgnite) {
        starXs.push(b.i % 64); starYs.push((b.i / 64) | 0);
      }
      starsLate += sim.lastIgnite.length;
      livingSum += sim.stats.livingCount; livingN++;
    }
    if (t === tailStart) bdAtTail = { b: sim.births, d: sim.deathsTotal };
  }
  let starStd = 0, starCov = 0;
  if (starXs.length > 1) {
    const mx = starXs.reduce((s, v) => s + v, 0) / starXs.length;
    const my = starYs.reduce((s, v) => s + v, 0) / starYs.length;
    let v2 = 0;
    const occ = new Set();
    for (let i = 0; i < starXs.length; i++) {
      const dx = starXs[i] - mx, dy = starYs[i] - my;
      v2 += dx * dx + dy * dy;
      occ.add(starYs[i] * 64 + starXs[i]);
    }
    starStd = Math.sqrt(v2 / starXs.length);
    starCov = occ.size;
  }
  return {
    starStd, starCov,
    starsLatePerTick: starsLate / livingN,
    livingLate: livingSum / livingN,
    birthsLate: sim.births - bdAtTail.b, deathsLate: sim.deathsTotal - bdAtTail.d,
    totalRho: sim.stats.totalRho, burnedTotal: sim.burnedTotal,
    maxResid,
  };
}

function expChain(seed, ejR) {
  ejR = ejR == null ? 4 : +ejR;
  const r = runChain(seed, { ejectRadius: ejR, ticks: 10000 });
  console.log(`seed=${seed} ejectRadius=${ejR}  ticks=10000  외부 트리거 0`);
  console.log(`  별 위치 std=${f(r.starStd, 1)} 셀  점유 셀=${r.starCov}  후반 별/tick=${f(r.starsLatePerTick, 2)}  후반 living=${f(r.livingLate, 2)}`);
  console.log(`  후반 생멸=${r.birthsLate}/${r.deathsLate}  totalRho 끝=${f(r.totalRho, 1)} burned=${f(r.burnedTotal, 1)}  E+T 잔차 max=${r.maxResid.toExponential(2)}`);
}

/* ---------- move: 별이 *얼마나 멀리* 옮겨가는가 (연속 점화의 평균 거리) ---------- */
function expMove(seed, ejR) {
  ejR = ejR == null ? 4 : +ejR;
  const params = {
    wE: 1.0, thIgn: 0.40, burnFrac: 0.6, ejectFrac: 0.85, massToE: 5.0,
    igniteSpread: 0.92, igniteHeat: 0.05, ejectRadius: ejR,
  };
  const sim = C.createSim(64, { seed, params });
  chainScenario(sim, {});
  let prev = null;
  const dists = [];
  for (let t = 1; t <= 5000; t++) {
    C.step(sim);
    if (sim.lastIgnite.length) {
      // 같은 tick 의 점화 중심 평균
      let mx = 0, my = 0; for (const b of sim.lastIgnite) { mx += b.i % 64; my += (b.i / 64) | 0; }
      mx /= sim.lastIgnite.length; my /= sim.lastIgnite.length;
      if (prev) {
        let dx = Math.abs(mx - prev.x), dy = Math.abs(my - prev.y);
        dx = Math.min(dx, 64 - dx); dy = Math.min(dy, 64 - dy);
        dists.push(Math.sqrt(dx * dx + dy * dy));
      }
      prev = { x: mx, y: my };
    }
  }
  dists.sort((a, b) => a - b);
  const mean = dists.length ? dists.reduce((s, v) => s + v, 0) / dists.length : 0;
  const med = dists.length ? dists[dists.length >> 1] : 0;
  const max = dists.length ? dists[dists.length - 1] : 0;
  console.log(`seed=${seed} ejR=${ejR}  연속 점화 거리: n=${dists.length}  평균=${f(mean, 2)}셀  중앙=${f(med, 2)}  최대=${f(max, 2)}`);
}

/* ---------- cons: 보존 잔차 + 물질 회계 ---------- */
function expCons(seed, ejR) {
  ejR = ejR == null ? 4 : +ejR;
  const r = runChain(seed, { ejectRadius: ejR, ticks: 8000 });
  console.log(`seed=${seed} ejR=${ejR}  E+T 최대잔차=${r.maxResid.toExponential(2)} (목표 ~1e-6)`);
  console.log(`  burnedTotal=${f(r.burnedTotal, 2)}  totalRho 끝=${f(r.totalRho, 2)}`);
}

/* ---------- series: 시계열 (별의 일생) — §3 표 검증용 ---------- */
function expSeries(seed, ejR) {
  ejR = ejR == null ? 6 : +ejR;
  const params = {
    wE: 1.0, thIgn: 0.40, burnFrac: 0.6, ejectFrac: 0.85, massToE: 5.0,
    igniteSpread: 0.92, igniteHeat: 0.05, ejectRadius: ejR,
  };
  const sim = C.createSim(64, { seed, params });
  chainScenario(sim, {});
  console.log(`seed=${seed} ejR=${ejR}  tick   별수  사회수  사망누계  totalRho`);
  for (let t = 1; t <= 10000; t++) {
    const st = C.step(sim);
    if (t >= 7000 && t % 1000 === 0) {
      console.log(`             ${String(t).padStart(5)}   ${String(st.stars).padStart(3)}    ${String(st.livingCount).padStart(3)}     ${String(st.deathsTotal).padStart(5)}     ${f(st.totalRho, 1)}`);
    }
  }
}

const MODES = { reg: expReg, regc: expRegc, chain: expChain, move: expMove, cons: expCons, series: expSeries };
const [, , m, ...args] = process.argv;
if (MODES[m]) MODES[m](+args[0], ...args.slice(1));
else console.log('usage: node verify.js <reg|regc|chain|move|cons> <seed> [args]');
