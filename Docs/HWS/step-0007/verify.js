/* HWS step-0007 헤드리스 검증
 * 사용: node verify.js <reg|conserve|det|track|churn|chase|all> [seed]
 *  - reg      : 회귀 0 — srcJump=0 step-0007 == step-0006 비트 단위 동일
 *               (에이전트 0·구동 on/off, 그리고 에이전트 있음·번식·이동·baseCost on·srcJump=0 둘 다)
 *  - conserve : V1 보존 — 떠도는 자원(srcJump on)에서도 닫힌 장부(재배치는 주입 위치만 옮김) 잔차 < 1e-6
 *  - det      : V2 결정론 — srcJump on, 같은 시드 2회 실행 비트 단위 동일(E+에이전트)
 *  - track    : ③ 추적 — 개체군 무게중심이 떠도는 source 의 궤적을 *추적*하는가(추적 거리 유계·개체 생존),
 *               source 가 실제로 세계를 가로지르는 동안(srcX 대폭 이동) 무게중심이 곁을 따라간다.
 *  - churn    : ① 정착 동결 해소 — 떠도는 자원(srcJump=6) 위에선 정착 후에도 출생>0 AND 사망>0 지속(G2 해소).
 *               대조: srcJump=0(step-0006 정적)·srcJump=1(≈연속 균일 표류)은 둘 다 출생=사망=0 으로 *얼어붙는다*
 *               — 매끄러운 균일 표류는 함께 움직이는 좌표계에서 정적과 같다(갈릴레이). 이산 재배치라야 churn 한다.
 *  - chase    : ② 따라가야 산다 — 떠도는 source 를 이동 on 이면 *추적해 살고*, 이동 off 면 옛 자리에 뒤처져 *굶어 죽는다*(멸종).
 *  - all      : 전 모드 + 요약
 * 응집 시나리오 상수: kA=0.45, aggMc=1.1, aggW=0.7 (step-0002 그대로).
 * 생명 시나리오 상수: kL=0.05, mMaint=0.03, mDeath=0.05, mSeed=0.5, lifeR=1 (step-0003 그대로).
 * 번식 시나리오 상수: mDiv=1.2, divR=1 (step-0004). 이동: moveR=1, moveThresh=0.02 (step-0005). 기초대사비: baseCost=0.08 (step-0006).
 * 떠도는 자원 시나리오 상수: srcJump=6, srcPeriod=150 (step-0007 신규).
 */
'use strict';
var core = require('./sim-core.js');
var core6 = require('../step-0006/sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var FORM = 8000;                                  // 고임 형성에 필요한 tick
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };    // 응집 on (step-0002 와 동일)
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };              // 번식 (step-0004)
var MOVE = { moveR: 1, moveThresh: 0.02 };        // 이동 (step-0005)
var BASE = 0.08;                                  // 기초대사비 (step-0006)
var JUMP = { srcJump: 6, srcPeriod: 150 };        // 떠도는 자원 (step-0007 신규) — 재배치 6칸/150tick
var POOL = { minE: 1.5, prom: 0.3 };
var W = core.DEFAULTS.W, H = core.DEFAULTS.H, N = W * H;

/* 떠도는 자원까지 켠 표준 시나리오. 회귀(reg)는 srcJump=0 으로 따로 만든다. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, { baseCost: BASE }, JUMP, extra || {}); }
function avg(rows, key) { return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length; }

/* 가장 강한 고임(들)에 에이전트를 놓는다 — core 를 인자로 받아 step-0006/step-0007 양쪽에 쓴다. */
function spawnStrongest(C, sim, k) {
  var pools = C.detectPools(sim, POOL);
  var n = Math.min(k || 1, pools.length);
  for (var i = 0; i < n; i++) C.spawnAgent(sim, pools[i].x, pools[i].y);
  return n;
}

/* 정착 구간(establish 후 WIN tick)의 인구학적 turnover(출생·사망 증가분)·최소 개체수·추적 거리.
 * G2(동결) 해소의 핵심 측정 — 정착 후에도 출생>0 AND 사망>0 이면 churn 이 멈추지 않는다. */
function settledStats(sim, win) {
  var b0 = sim.births, d0 = sim.deaths, mo0 = sim.moves;
  var minPop = Infinity, trackSum = 0, trackN = 0;
  for (var t = 0; t < win; t++) {
    core.run(sim, 1);
    if (sim.agents.length < minPop) minPop = sim.agents.length;
    var td = core.trackDist(sim); if (td != null) { trackSum += td; trackN++; }
  }
  return { births: sim.births - b0, deaths: sim.deaths - d0, moves: sim.moves - mo0,
    minPop: minPop === Infinity ? 0 : minPop, pop: sim.agents.length,
    avgTrack: trackN ? trackSum / trackN : NaN };
}

/* ── reg: 회귀 0 — srcJump=0 면 step-0006 와 비트 단위 동일 ──
 * (A) 에이전트 0, 구동 on/off: E 비트 + 기본 장부 정확 일치.
 * (B) 에이전트 있음(강고임 1, 번식·이동·baseCost on), srcJump=0, +4000 tick: 전체 상태 해시 일치. */
function reg(seed) {
  var maxd = 0, ok = true;
  /* (A) 에이전트 0 */
  [true, false].forEach(function (drive) {
    var a = core6.createSim(seed, Object.assign({ drive: drive }, AGG, LIFE, REPRO, MOVE, { baseCost: BASE })); core6.run(a, 10000);
    var b = core.createSim(seed, Object.assign({ drive: drive, srcJump: 0 }, AGG, LIFE, REPRO, MOVE, { baseCost: BASE })); core.run(b, 10000);
    for (var i = 0; i < a.E.length; i++) maxd = Math.max(maxd, Math.abs(a.E[i] - b.E[i]));
    if (core6.hashState(a) !== core.hashState(b)) ok = false;
    if (a.injected !== b.injected || a.evaporated !== b.evaporated || a.sunk !== b.sunk) ok = false;
  });
  /* (B) 에이전트 있음, 번식·이동·baseCost on, srcJump=0 */
  var a6 = core6.createSim(seed, Object.assign({}, AGG, LIFE, REPRO, MOVE, { baseCost: BASE })); core6.run(a6, FORM);
  var b7 = core.createSim(seed, Object.assign({ srcJump: 0 }, AGG, LIFE, REPRO, MOVE, { baseCost: BASE })); core.run(b7, FORM);
  spawnStrongest(core6, a6, 1); spawnStrongest(core, b7, 1);
  core6.run(a6, 4000); core.run(b7, 4000);
  for (var j = 0; j < a6.E.length; j++) maxd = Math.max(maxd, Math.abs(a6.E[j] - b7.E[j]));
  if (core6.hashState(a6) !== core.hashState(b7)) ok = false;
  return { seed: seed, maxDiff: maxd, pass: maxd === 0 && ok };
}

/* ── conserve: 떠도는 자원 on, 닫힌 장부(재배치는 주입 위치만 옮김 → 새 장부 항 없음) ── */
function conserve(seed) {
  var sim = core.createSim(seed, scn()); core.run(sim, FORM);
  spawnStrongest(core, sim, 1);
  core.run(sim, 8000);                            // 추적·churn 이 섞인 긴 구간
  var led = core.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, biomass: led.biomass,
    pop: sim.agents.length, deaths: sim.deaths, births: sim.births,
    metabolized: sim.metabolized, pass: led.residual < 1e-6 };
}

/* ── det: 떠도는 자원 on, 결정론(비트 동일) ── */
function det(seed) {
  function build() {
    var s = core.createSim(seed, scn()); core.run(s, FORM); spawnStrongest(core, s, 1); core.run(s, 4000); return s;
  }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i]) { bit = false; break; }
  return { seed: seed, hashA: core.hashState(a), hashB: core.hashState(b),
    pass: bit && core.hashState(a) === core.hashState(b) };
}

/* ── track: ③ 무게중심이 떠도는 source 의 궤적을 추적하는가 ──
 * 개체군을 키운 뒤 6000 tick. source 는 6칸/150tick 으로 +x 를 돌아 세계를 가로지른다(srcX 대폭 이동).
 * 추적이 되면 무게중심-source 거리가 작고 유계로 머물고 개체가 산다; 안 되면 발산하거나 멸종. */
function track(seed) {
  var s = core.createSim(seed, scn()); core.run(s, FORM);
  spawnStrongest(core, s, 1); core.run(s, 4000);
  var x0 = s.p.source.x;
  var st = settledStats(s, 6000);
  /* source 가 6000tick 동안 옮겨다닌 누적 칸수(점프 횟수×6) — 세계를 여러 바퀴 가로지른다 */
  var jumps = Math.floor(6000 / JUMP.srcPeriod) * JUMP.srcJump;
  return { seed: seed, srcTravel: jumps, x0: x0, srcXend: s.p.source.x,
    avgTrack: st.avgTrack, minPop: st.minPop, pop: st.pop,
    /* 추적: source 가 멀리(>=W) 옮겨다니는 동안 무게중심이 곁(<3)에 유계로 머물고 개체가 산다 */
    pass: st.minPop > 0 && st.avgTrack < 3 && jumps >= W };
}

/* ── churn: ① 정착 동결 해소 — 떠도는 자원이 끝없는 turnover 를 만드는가(G2 해소) ──
 * 세 시나리오의 *정착 후* 구간(establish 4000 후 4000tick) 출생·사망 증가분 비교:
 *  (on)   srcJump=6 srcPeriod=150 : 출생>0 AND 사망>0 — churn 이 멈추지 않는다.
 *  (off)  srcJump=0               : 출생=사망=0 — step-0006 처럼 얼어붙는다(정적 자원 풍경).
 *  (cont) srcJump=1 srcPeriod=20  : 출생=사망=0 — ≈연속 균일 표류는 갈릴레이 불변으로 얼어붙는다.
 * → 이산 재배치(충분한 점프)라야 동결이 풀린다. */
function churn(seed) {
  function trial(extra) {
    var s = core.createSim(seed, scn(extra)); core.run(s, FORM);
    spawnStrongest(core, s, 1); core.run(s, 4000);  // establish
    return settledStats(s, 4000);
  }
  var on = trial({});
  var off = trial({ srcJump: 0 });
  var cont = trial({ srcJump: 1, srcPeriod: 20 });
  return { seed: seed,
    onB: on.births, onD: on.deaths, onPop: on.minPop,
    offB: off.births, offD: off.deaths, offPop: off.minPop,
    contB: cont.births, contD: cont.deaths, contPop: cont.minPop,
    /* G2 해소: on 은 출생>0 AND 사망>0(동결 안 됨) · off·cont 는 둘 다 0(동결) · 셋 다 개체 생존.
     * off·cont 의 개체 생존을 *함께* 단언해야 그 0/0 이 "멸종"이 아니라 "살아있는 동결"임이 증명된다
     * (멸종해도 출생=사망=0 이 되므로 — 갈릴레이 동결 주장이 우연히 멸종으로 통과하지 않게 한다). */
    pass: on.births > 0 && on.deaths > 0 && on.minPop > 0 &&
          off.births === 0 && off.deaths === 0 && off.minPop > 0 &&
          cont.births === 0 && cont.deaths === 0 && cont.minPop > 0 };
}

/* ── chase: ② 따라가야 산다 — 떠도는 source 를 이동 on 은 추적해 살고, 이동 off 는 뒤처져 멸종 ── */
function chase(seed) {
  function trial(move) {
    var s = core.createSim(seed, scn({ move: move })); core.run(s, FORM);
    spawnStrongest(core, s, 1);
    core.run(s, 3000);                              // source 가 여러 번 재배치되는 동안
    var alive = s.agents.length > 0;
    return { alive: alive, track: alive ? core.trackDist(s) : null };
  }
  var on = trial(true), off = trial(false);
  return { seed: seed, aliveOn: on.alive, trackOn: on.track, aliveOff: off.alive,
    /* 이동 on 은 떠도는 자원을 추적해 살고(거리 유계), 이동 off 는 옛 자리에 뒤처져 굶어 죽는다(멸종) */
    pass: on.alive && on.track != null && on.track < 5 && !off.alive };
}

function fmt(x) {
  if (typeof x !== 'number') return String(x);
  if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3);
  return x.toFixed(4);
}
function table(rows, cols) {
  console.log(cols.join('\t'));
  rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); });
}

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'maxDiff', 'pass']);
    console.log('회귀 0: srcJump=0 step-0007 == step-0006 (에이전트 0 구동 on/off + 에이전트 있음 번식·이동·baseCost on srcJump=0)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'biomass', 'pop', 'deaths', 'births', 'metabolized', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (재배치는 주입 위치만 옮김 → 새 장부 항 없음; sumE+M+evap+sunk+metab-injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'track') {
    var rt = seeds.map(track); table(rt, ['seed', 'srcTravel', 'x0', 'srcXend', 'avgTrack', 'minPop', 'pop', 'pass']);
    console.log('avg track=' + avg(rt, 'avgTrack').toFixed(2) + ' (source 가 ' + rt[0].srcTravel + '칸 옮겨다니는 동안 무게중심이 곁을 유계 추적, 개체 생존 — ③ 추적)');
    return rt.every(function (r) { return r.pass; });
  } else if (mode === 'churn') {
    var rh = seeds.map(churn); table(rh, ['seed', 'onB', 'onD', 'onPop', 'offB', 'offD', 'offPop', 'contB', 'contD', 'contPop', 'pass']);
    console.log('정착 후 4000tick: on(srcJump=6) 출생=' + avg(rh, 'onB').toFixed(0) + '·사망=' + avg(rh, 'onD').toFixed(0) +
      ' (churn 지속) vs off(=step-0006)·cont(≈연속표류) 모두 0 (살아있는 동결 — offPop·contPop>0) — G2 해소, 이산 재배치라야 churn');
    return rh.every(function (r) { return r.pass; });
  } else if (mode === 'chase') {
    var rs = seeds.map(chase); table(rs, ['seed', 'aliveOn', 'trackOn', 'aliveOff', 'pass']);
    console.log('이동 on: 떠도는 자원 추적 생존(거리 유계) / 이동 off: 옛 자리에 뒤처져 멸종 — ② 따라가야 산다');
    return rs.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['reg', 'conserve', 'det', 'track', 'churn', 'chase'].every(function (m) {
    console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r;
  });
} else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
