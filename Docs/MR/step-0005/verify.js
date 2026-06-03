/* ============================================================
 * step-0005 헤드리스 검증 (Node):  node verify.js <mode> <seed> [args]
 *  회귀:
 *    reg  <seed>              — 미시 단독: step-0004 코어와 비트 단위 동일한가
 *    regc <seed>              — 미시+거시(wDown=0): step-0004 결합과 비트 단위 동일한가
 *  하향 에너지 채널:
 *    thsweep <seed>           — thE₂ 스윕: 거시 발화를 "사건"으로 만드는 임계 찾기 (발화/1k)
 *    dis  <seed> <wDown> [thE2] — 재앙 전파: 거시 발화 → 미시 T 주입 → 미시 사망 (wDown=0 대조 포함)
 *    war  <seed> <wDown> [thE2] — 사회 간: 두 사회, 한쪽을 과식시켜 발화 → 재앙이 이웃에 닿는가
 * 시드 [42, 7, 1234, 99, 2026].
 * ============================================================ */
const C = require('./sim-core.js');
const f = (x, d = 2) => (typeof x === 'number' ? x.toFixed(d) : String(x));
function wdist(N, ax, ay, bx, by) {
  let dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy);
  return Math.sqrt(dx * dx + dy * dy);
}

/* ---------- reg: 미시 단독, step-0004 코어와 비트 단위 비교 ---------- */
function expReg(seed) {
  const OLD = require('../step-0004/sim-core.js');
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  for (const wE of [0, 0.5]) {
    const o = OLD.sweepWindow(64, rates, 1500, seed, { wE });
    const n = C.sweepWindow(64, rates, 1500, seed, { wE });
    const maxd = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
    console.log(`seed=${seed} wE=${wE} 미시 최대차이=${maxd} ${maxd === 0 ? 'OK' : 'DIFF!'}`);
  }
}

/* ---------- regc: 미시+거시(wDown=0), step-0004 결합과 비트 단위 비교 ---------- */
function expRegc(seed) {
  const OLD = require('../step-0004/sim-core.js');
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  const o = OLD.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);
  const n = C.sweepWindow(64, rates, 1500, seed, { wE: 0.5 }, true);   // wDown=0 기본
  const du = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
  const dm = Math.max(...rates.map((r, i) => Math.abs(o[i].macroLiving - n[i].macroLiving)));
  console.log(`seed=${seed} 미시차이=${du} 거시차이=${dm} ${du === 0 && dm === 0 ? 'OK' : 'DIFF!'}`);
}

/* ---------- ② 공통: 군도 시나리오 ---------- */
function archipelago(sim) {
  sim.sources.length = 0; sim.sinks.length = 0;
  C.addSource(sim, 16, 16, 3, 0.04); C.addSource(sim, 48, 16, 3, 0.04);
  C.addSource(sim, 16, 48, 3, 0.04); C.addSource(sim, 48, 48, 3, 0.04);
  C.addSink(sim, 32, 32, 4, 0.10);
}

/* ---------- thsweep: thE₂ 스윕 — 거시 발화를 사건으로 만드는 임계 ---------- */
function expThsweep(seed) {
  console.log(`seed=${seed}  thE₂  거시발화/1k  거시living  미시잔차  거시잔차`);
  for (const thE2 of [0.9, 2.0, 3.4, 5, 7, 10, 14]) {
    const sim = C.createSim(64, { seed, params: { wE: 0.5 } });
    const macro = C.createMacro(sim, { params: { thE: thE2 } });
    archipelago(sim);
    let bur = 0, mLiv = 0, mN = 0;
    for (let t = 0; t < 4000; t++) {
      C.stepCoupled(sim, macro);
      if (t >= 1000 && macro.stats && (t + 1) % 4 === 0) { bur += macro.stats.bursts; mLiv += macro.stats.livingCount; mN++; }
    }
    const per1k = bur / (3000 / 1000);   // 1000~4000 = 3000 미시 tick
    console.log(`  ${f(thE2, 1)}   ${f(per1k, 1)}   ${f(mN ? mLiv / mN : 0, 2)}   ${Math.abs(sim.stats.resid).toExponential(1)}  ${Math.abs(macro.stats.resid).toExponential(1)}`);
  }
}

/* ---------- dis: 재앙 전파 — 거시 발화 → 미시 T → 미시 사망 ----------
 * 표준 시나리오에서 사회를 세우고(t<3000), t=3000에 승급 소득을 ×flare(200tick) 폭증시켜
 * 거시 E₂를 끌어올려 발화시킨다. wDown>0이면 그 발화가 미시 T로 내려와 사망을 일으킨다.
 * 같은 시드로 wDown=0(대조)도 돌려 "채널이 있어야 재앙이 내려온다"를 가른다. */
function expDis(seed, wDown, thE2) {
  wDown = wDown == null ? 0.8 : +wDown;
  thE2 = thE2 == null ? 5 : +thE2;     // 발화=사건화 임계 (이 이상이면 평시 발화 0, thsweep)
  const flare = 8;
  const run = (wD) => {
    const sim = C.createSim(64, { seed, params: { wE: 0.5 } });
    const macro = C.createMacro(sim, { wDown: wD, params: { thE: thE2 } });
    C.defaultScenario(sim, 0.04);
    const cE0 = macro.couple.cE;
    let burA = 0, dPrev = 0, livPre = 0, nPre = 0, livEnd = 0, nEnd = 0, minLiv = 1e9, maxResid = 0;
    for (let t = 0; t < 4400; t++) {
      if (t === 3000) { dPrev = sim.deathsTotal; macro.couple.cE = cE0 * flare; }
      if (t === 3200) macro.couple.cE = cE0;
      C.stepCoupled(sim, macro);
      maxResid = Math.max(maxResid, Math.abs(sim.stats.resid));
      if (macro.stats && (t + 1) % 4 === 0 && t >= 3000) burA += macro.stats.bursts;
      if (t >= 2700 && t < 3000) { livPre += sim.stats.livingCount; nPre++; }       // 재앙 직전
      if (t >= 3000 && t < 3700) minLiv = Math.min(minLiv, sim.stats.livingCount);  // 재앙 중 최저
      if (t >= 4000) { livEnd += sim.stats.livingCount; nEnd++; }                    // 회복 후
    }
    return { burA, dA: sim.deathsTotal - dPrev, livPre: livPre / nPre, minLiv, livEnd: livEnd / nEnd, maxResid };
  };
  const on = run(wDown), off = run(0);
  console.log(`seed=${seed} thE₂=${thE2} flare=×${flare}  거시발화 후1.4k=${on.burA}(평시 0)`);
  console.log(`  living 재앙직전→최저→회복:  wDown=${wDown} → ${f(on.livPre, 1)}→${on.minLiv}→${f(on.livEnd, 1)}   wDown=0(대조) → ${f(off.livPre, 1)}→${off.minLiv}→${f(off.livEnd, 1)}`);
  console.log(`  재앙 1.4k 미시사망:  wDown=${wDown} → ${on.dA}   대조 → ${off.dA}   미시잔차=${on.maxResid.toExponential(1)}`);
}

/* ---------- war: 사회 간 — 한 사회의 거시 셀을 부풀려 발화시키고, 재앙이 이웃에 닿는가 ----------
 * 두 사회(좌 micro16 / 우 micro48, 거시 4 / 12, 거리 8 거시셀)를 세운 뒤, t=2500에 *거시* 좌측 셀에만
 * 에너지 source 를 꽂아(미시는 건드리지 않음 — 순수 사회 A 의 boom) 좌 거시 발화를 일으킨다.
 * wDown 채널이 좌 미시에 재앙을 내리는 것은 ②로 확인됨. 질문은: 그 발화가 거시 장을 가로질러
 * 우 거시까지 번져 우 미시에도 재앙이 닿는가(사회 간 전파)? 인자: seed [wDown] [거리=좌우 micro X] */
function expWar(seed, wDown, thE2, dist, N2) {
  wDown = wDown == null ? 25 : +wDown;
  thE2 = thE2 == null ? 5 : +thE2;
  dist = dist == null ? 32 : +dist;            // 좌우 micro 간 거리 (기본 군도 거리)
  N2 = N2 == null ? 16 : +N2;                  // 거시 격자 (압축 = 64/N2). 16=4× 기본, 8=8×
  const LX = 32 - dist / 2, RX = 32 + dist / 2;
  // 좌/우 사회 살아있는 질량(연속량 — living 카운트보다 잡음 적음)
  const regMass = (sim, L) => sim.agents.filter(a => a.alive && (L ? a.cx < 32 : a.cx >= 32)).reduce((s, a) => s + a.mass, 0);
  const run = (boom) => {
    const sim = C.createSim(64, { seed, params: { wE: 0.5 } });
    const macro = C.createMacro(sim, { N2, wDown, params: { thE: thE2 } });
    sim.sources.length = 0; sim.sinks.length = 0;
    C.addSource(sim, LX, 32, 3, 0.04); C.addSource(sim, RX, 32, 3, 0.04); C.addSink(sim, 32, 8, 4, 0.10);
    const ff = N2 / sim.N;
    const lmx = Math.min(N2 - 1, (LX * ff) | 0), lmy = Math.min(N2 - 1, (32 * ff) | 0);
    let lPre = 0, rPre = 0, nPre = 0, lMin = 1e9, rMin = 1e9, lBurst = 0, rBurst = 0, maxResid = 0;
    for (let t = 0; t < 4400; t++) {
      if (t === 2500 && boom) { macro.sources.length = 0; C.addSource(macro, lmx, lmy, 1, 3.0); }   // ★ 좌 거시 셀에만 주입 (좌 사회 boom)
      if (t === 2900 && boom) macro.sources.length = 0;
      C.stepCoupled(sim, macro);
      maxResid = Math.max(maxResid, Math.abs(sim.stats.resid));
      if (t >= 2200 && t < 2500) { lPre += regMass(sim, true); rPre += regMass(sim, false); nPre++; }
      if (t >= 2500 && t < 3400) { lMin = Math.min(lMin, regMass(sim, true)); rMin = Math.min(rMin, regMass(sim, false)); }
      if (macro.lastBurst.length) for (const b of macro.lastBurst) { (b.i % N2) < N2 / 2 ? lBurst++ : rBurst++; }
    }
    return { lPre: lPre / nPre, rPre: rPre / nPre, lMin, rMin, lBurst, rBurst, maxResid };
  };
  const on = run(true), off = run(false);
  console.log(`seed=${seed} wDown=${wDown} thE₂=${thE2} 거리=${dist}micro(=거시 ${(dist * N2 / 64)}셀) N2=${N2}(${64 / N2}×압축)`);
  console.log(`  거시발화 좌 ${on.lBurst} / 우 ${on.rBurst}(대조 ${off.rBurst})   [우 발화≈대조 = 재앙이 옆으로 안 번짐]`);
  console.log(`  좌 사회(발화 바로 아래) 질량 직전→최저:  boom ${f(on.lPre, 1)}→${f(on.lMin, 1)}   대조 ${f(off.lPre, 1)}→${f(off.lMin, 1)}`);
  console.log(`  우 사회(이웃) 질량 직전→최저:           boom ${f(on.rPre, 1)}→${f(on.rMin, 1)}   대조 ${f(off.rPre, 1)}→${f(off.rMin, 1)}   미시잔차=${on.maxResid.toExponential(1)}`);
}

const MODES = { reg: expReg, regc: expRegc, thsweep: expThsweep, dis: expDis, war: expWar };
const [, , m, ...args] = process.argv;
if (MODES[m]) MODES[m](+args[0], ...args.slice(1));
else console.log('usage: node verify.js <reg|regc|thsweep|dis> <seed> [args]');
