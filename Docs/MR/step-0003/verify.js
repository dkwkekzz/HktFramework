/* ============================================================
 * step-0003 헤드리스 검증 (Node):  node verify.js <mode>
 *  mode: reg    — 회귀: wE=0이 step-0002 코어와 동일한가 (비트 단위 비교)
 *        win    — wE=0 생명의 창 (step-0002 재현, ~1분)
 *        beh    — 행동: wE 스윕 — 속도·생멸 회전·경합사망 (~1분)
 *        herd   — 목동: 걷는 source를 따라가는가 (행동의 결정적 증거)
 *        comp   — 경쟁: source 차단 후 군락 간 다툼 (질량 흡수)
 *        mac    — 재귀 2층: 거시 자기유지 구조 + 거시 보존
 *        macwin — 거시 생명의 창: 미시 source 스윕 → 거시 living (느림, 수 분)
 *        cut    — 층간 결합: 미시 source 차단 → 거시 붕괴 전파 (느림)
 * 모든 수치는 시드 [42, 7, 1234, 99, 2026] 평균으로 재현 가능.
 * ============================================================ */
const C = require('./sim-core.js');
const SEEDS = [42, 7, 1234, 99, 2026];
const f = (x, d = 2) => (typeof x === 'number' ? x.toFixed(d) : String(x));
const dd = (N, ax, ay, bx, by) => {
  let dx = Math.min(Math.abs(ax - bx), N - Math.abs(ax - bx));
  let dy = Math.min(Math.abs(ay - by), N - Math.abs(ay - by));
  return Math.sqrt(dx * dx + dy * dy);
};
function avgOver(seedFn) {
  const rows = SEEDS.map(seedFn), out = {};
  for (const k of Object.keys(rows[0])) out[k] = rows.reduce((s, r) => s + r[k], 0) / rows.length;
  return out;
}

/* ---------- reg: 구 코어와 비트 단위 비교 ---------- */
function expReg() {
  console.log('=== [reg] 회귀: wE=0 vs step-0002 코어 (같은 시드, living 수 차이) ===');
  let OLD;
  try { OLD = require('../step-0001/sim-core.js'); }
  catch (e) { console.log('  ../step-0001/sim-core.js 없음 — 건너뜀'); return; }
  const rates = [0, 0.01, 0.04, 0.12, 0.35];
  for (const seed of [42, 7, 99]) {
    const o = OLD.sweepWindow(64, rates, 1500, seed);
    const n = C.sweepWindow(64, rates, 1500, seed, { wE: 0 });
    const maxd = Math.max(...rates.map((r, i) => Math.abs(o[i].living - n[i].living)));
    console.log(`  seed=${seed}  최대 차이=${maxd}  ${maxd === 0 ? '✓ 동일' : '✗ 다름!'}`);
  }
}

/* ---------- win: wE=0 생명의 창 ---------- */
function expWin() {
  console.log('=== [win] wE=0 생명의 창 (3000 ticks, 5 seeds) ===');
  const rates = [0, 0.005, 0.01, 0.02, 0.04, 0.07, 0.12, 0.2, 0.35, 0.6];
  const acc = rates.map(() => ({ living: 0, resid: 0 }));
  for (const seed of SEEDS) {
    const rows = C.sweepWindow(64, rates, 3000, seed, { wE: 0 });
    rows.forEach((r, i) => { acc[i].living += r.living / SEEDS.length; acc[i].resid = Math.max(acc[i].resid, r.maxResid); });
  }
  console.log('  rate  : ' + rates.map(r => String(r).padStart(6)).join(''));
  console.log('  living: ' + acc.map(a => f(a.living, 1).padStart(6)).join(''));
  console.log('  maxResid: ' + Math.max(...acc.map(a => a.resid)).toExponential(1));
}

/* ---------- beh: wE 스윕 ---------- */
function expBeh() {
  console.log('=== [beh] 행동: wE 스윕 (source=0.04, 3000 ticks, 5 seeds) ===');
  console.log('  wE      속도(셀/tk)  평균수명  탄생/1k  사망/1k  경합%  living');
  for (const wE of [0, 0.1, 0.25, 0.5, 1.0, 2.0]) {
    const r = avgOver(seed => {
      const sim = C.createSim(64, { seed, params: { wE } });
      C.defaultScenario(sim, 0.04);
      let liv = 0, age = 0, spd = 0, n = 0;
      for (let t = 0; t < 3000; t++) {
        const s = C.step(sim);
        if (t >= 2000) { liv += s.livingCount; age += s.meanAge; spd += s.meanSpeed; n++; }
      }
      return {
        spd: spd / n, age: age / n, liv: liv / n,
        bpk: sim.births / 3, dpk: sim.deathsTotal / 3,
        con: sim.deathsTotal ? sim.contested / sim.deathsTotal * 100 : 0,
      };
    });
    console.log('  ' + String(wE).padEnd(8) + f(r.spd, 4).padStart(8) + f(r.age, 0).padStart(10) +
      f(r.bpk, 1).padStart(9) + f(r.dpk, 1).padStart(9) + f(r.con, 0).padStart(7) + f(r.liv, 1).padStart(8));
  }
}

/* ---------- herd: 목동 실험 ---------- */
function expHerd() {
  console.log('=== [herd] 목동: source가 80tick마다 1셀씩 32셀 걸어감 — 따라가는가 ===');
  for (const wE of [0, 0.5, 1, 2]) {
    let surv = 0, n = 0, fin = 0, travel = 0;
    for (const seed of SEEDS) {
      const sim = C.createSim(64, { seed, params: { wE } });
      C.addSource(sim, 16, 16, 3, 0.04); C.addSink(sim, 48, 48, 4, 0.10);
      for (let t = 0; t < 1500; t++) C.step(sim);
      const olds = sim.agents.filter(a => a.alive).map(a => a.id);
      let sx = 16;
      for (let t = 0; t < 3700; t++) {
        if (t % 80 === 0 && sx < 48) { sx++; sim.sources.length = 0; C.addSource(sim, sx, 16, 3, 0.04); }
        C.step(sim);
      }
      for (const id of olds) {
        const a = sim.agents.find(x => x.id === id && x.alive);
        n++;
        if (a) { surv++; fin += dd(64, a.cx, a.cy, 48, 16); travel += a.dist; }
      }
    }
    console.log(`  wE=${String(wE).padEnd(4)} 생존 ${f(surv / Math.max(1, n) * 100, 0).padStart(3)}%  누적이동 ${surv ? f(travel / surv, 1) : '-'}셀  최종 source까지 ${surv ? f(fin / surv, 1) : '-'}셀`);
  }
}

/* ---------- comp: 경쟁 실험 ---------- */
function expComp() {
  console.log('=== [comp] 경쟁: source 2개 → 1500 tick 뒤 왼쪽 차단 (seed 42 상세) ===');
  for (const wE of [0, 0.5, 1]) {
    const sim = C.createSim(64, { seed: 42, params: { wE } });
    C.addSource(sim, 16, 32, 3, 0.04); C.addSource(sim, 40, 32, 3, 0.04); C.addSink(sim, 56, 56, 3, 0.10);
    for (let t = 0; t < 1500; t++) C.step(sim);
    const before = sim.agents.filter(a => a.alive).map(a => `(${f(a.cx, 0)},${f(a.cy, 0)} m=${f(a.mass, 1)})`);
    sim.sources.splice(0, 1);
    const d0 = sim.deathsTotal, c0 = sim.contested;
    for (let t = 0; t < 2500; t++) C.step(sim);
    const after = sim.agents.filter(a => a.alive).map(a => `(${f(a.cx, 0)},${f(a.cy, 0)} m=${f(a.mass, 1)})`);
    console.log(`  wE=${String(wE).padEnd(4)} 차단전 ${before.length}개 ${before.join(' ')}`);
    console.log(`          차단후 ${after.length}개 ${after.join(' ')}  사망=${sim.deathsTotal - d0} 경합=${sim.contested - c0}`);
  }
}

/* ---------- mac: 거시 자기유지 ---------- */
function expMac() {
  console.log('=== [mac] 재귀 2층: 거시 자기유지 (기본 시나리오, wE=0.5, 4000 ticks, 5 seeds) ===');
  const r = avgOver(seed => {
    const sim = C.createSim(64, { seed, params: { wE: 0.5 } });
    const macro = C.createMacro(sim);
    C.defaultScenario(sim, 0.04);
    let mLiv = 0, mN = 0, uLiv = 0, n = 0;
    for (let t = 0; t < 4000; t++) {
      const s = C.stepCoupled(sim, macro);
      if (t >= 2600) {
        uLiv += s.livingCount; n++;
        if (macro.stats) { mLiv += macro.stats.livingCount; mN++; }
      }
    }
    return {
      micro: uLiv / n, macro: mLiv / mN, mB: macro.births, mD: macro.deathsTotal,
      mRes: Math.abs(macro.stats.resid), uRes: Math.abs(sim.stats.resid),
    };
  });
  console.log(`  미시 living=${f(r.micro, 1)}  거시 living=${f(r.macro, 2)}  거시 탄생/사망=${f(r.mB, 1)}/${f(r.mD, 1)}`);
  console.log(`  보존 잔차: 미시=${r.uRes.toExponential(1)}  거시=${r.mRes.toExponential(1)}`);
}

/* ---------- macwin: 거시 생명의 창 ---------- */
function expMacWin() {
  console.log('=== [macwin] 거시 생명의 창: 미시 source 스윕 (wE=0.5, 3000 ticks, 5 seeds) ===');
  const rates = [0, 0.005, 0.01, 0.02, 0.04, 0.07, 0.12, 0.2, 0.35, 0.6];
  const accU = rates.map(() => 0), accM = rates.map(() => 0);
  for (const seed of SEEDS) {
    const rows = C.sweepWindow(64, rates, 3000, seed, { wE: 0.5 }, true);
    rows.forEach((r, i) => { accU[i] += r.living / SEEDS.length; accM[i] += r.macroLiving / SEEDS.length; });
  }
  console.log('  rate      : ' + rates.map(r => String(r).padStart(7)).join(''));
  console.log('  미시 living: ' + accU.map(v => f(v, 1).padStart(7)).join(''));
  console.log('  거시 living: ' + accM.map(v => f(v, 2).padStart(7)).join(''));
}

/* ---------- cut: 층간 결합 ---------- */
function expCut() {
  console.log('=== [cut] 층간 결합: tick 3000에 미시 source 차단 → 거시 붕괴 (5 seeds) ===');
  const r = avgOver(seed => {
    const sim = C.createSim(64, { seed, params: { wE: 0.5 } });
    const macro = C.createMacro(sim);
    C.defaultScenario(sim, 0.04);
    let mBefore = 0, nB = 0, collapse = -1;
    for (let t = 0; t < 5000; t++) {
      if (t === 3000) sim.sources.length = 0;
      C.stepCoupled(sim, macro);
      if (t >= 2000 && t < 3000 && macro.stats) { mBefore += macro.stats.livingCount; nB++; }
      if (t > 3000 && collapse < 0 && macro.stats && macro.stats.livingCount === 0 && sim.stats.livingCount === 0) collapse = t - 3000;
    }
    return { before: mBefore / nB, collapse: collapse < 0 ? 2000 : collapse };
  });
  console.log(`  차단 전 거시 living=${f(r.before, 2)} → 차단 후 평균 ${f(r.collapse, 0)} tick 만에 미시·거시 모두 0 (2000=미붕괴)`);
}

const MODES = { reg: expReg, win: expWin, beh: expBeh, herd: expHerd, comp: expComp, mac: expMac, macwin: expMacWin, cut: expCut };
const m = process.argv[2];
if (MODES[m]) MODES[m]();
else console.log('usage: node verify.js <' + Object.keys(MODES).join('|') + '>');
