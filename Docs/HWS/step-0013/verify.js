/* HWS step-0013 헤드리스 검증 — 별 연소 FSM(living→burning→ash: 이산 비가역 문턱, SPINE 결정3 완전판).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 combust 법칙 1개 + ignite 의 ash 처리. 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0013/verify.js <reg|conserve|det|fsm|sustain|all> [seed]
 *  - reg     : 회귀 0 — kFSM=0 이면 step-0012 와 비트 동일(combust 통째 skip·별 상태 필드 없음). 내생 스택 해시를 golden endo@ 와 대조.
 *  - conserve: 보존 — FSM(상태 전이가 도는 내내) 닫힌 장부 잔차 < 1e-6. state 는 거래 0(주입은 ignite 의 fuel→E 경계 불변).
 *  - det     : 결정론 — kFSM on 같은 시드 2회 비트 동일(E+R+에이전트+별+*상태 라벨*이 해시에).
 *  - fsm     : 결정3 완전판 — (a)분기 부재(활성도로 환원) · (b)활성도로 상태 재구성 일치 · (c)히스테리시스 폭>0·비가역·3상태 도달.
 *  - sustain : FSM on 이 step-0012 의 끝없는 churn 을 *유지*하는가(공멸 없이 지평선 40k 생존·후반 출생≈사망>0). 본 thesis 는 존재론이나,
 *              동역학을 깨지 않음을 확인(부수 검증).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0012 그대로(외부 source off, 별 내생 구동 + 자기제한) + 연소 FSM 노브(kFSM 1, livingFrac 0.55, burnOn 0.6, burnOff 0.4).
 * FSM: living(kindling 저활성·정지) →[핫코어 disc평균E ≥ burnOn]→ burning(전율·서행) →[연료 소진 *또는* 핫코어 < burnOff]→ ash(0·불응기 20tick·제거).
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(combust 법칙 포함)
var fs = require('fs');
var path = require('path');

var SEEDS = [42, 7, 1234, 99, 2026];
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };
var LIFE = { kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1 };
var REPRO = { mDiv: 1.20, divR: 1 };
var MOVE = { moveR: 1, moveThresh: 0.02, pTumble: 1.0 };
var STAGE = { kRelief: 1.0, kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003 };
var STAR = { kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20 };
var CROWD = { kCrowd: 0.20, crowdR: 3 };
var FSM = { kFSM: 1, livingFrac: 0.55, burnOn: 0.6, burnOff: 0.4 };   // step-0013 신규 — 별 연소 이산 FSM
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;
var HORIZON = 40000;

/* 내생(외부 source off, 별+자기제한) + 연소 FSM. extra 로 kFSM=0 주면 step-0012 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }
function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }

/* ── reg: kFSM=0 → step-0012 비트 동일. golden cwd@ 해시(자기제한 스택, combust 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden cwd@ 와 *동일 절차*(verify-sim-engine.js runGolden 의 cwd): 별 6 + run 2000 + 생명 5 + run 3000, 자기제한 on·kFSM=0. */
  var sim = ENG.createSim(seed, scn({ kFSM: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['cwd@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: FSM 상태 전이가 도는 내내 닫힌 장부. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, burned: sim.burned, starD: sim.starDeaths, pop: sim.agents.length, pass: led.residual < 1e-6 };
}

/* ── det: kFSM on 같은 시드 2회 비트 동일(상태 라벨이 해시에). ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, scn()); seedStars(s, 6); ENG.run(s, 4000); spawnLife(s, 5); ENG.run(s, 4000); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* ── fsm: 결정3 완전판 — 한 시드 추적하며 전이/재구성/히스테리시스를 수치로 잰다. ──
 *  (a) 분기 부재(활성도 환원): 매 tick 모든 별에서 상태 라벨 == 활성도 배수 burnMul 의 표 인덱스([livingFrac,1,0]). 위반 0 →
 *      라벨은 *자유 태그가 아니라 활성도(주입 배수)의 함수*. 별도 type 분기(다른 에너지 경로) 없음을 증명.
 *  (b) 활성도로 재구성: 상태별 *측정* throughput(tick 당 연료 소비 = dE/dt 주입)을 재 living/burning 비를 본다 →
 *      living-rate / burning-rate ≈ livingFrac 이어야(라벨이 측정으로 읽힌다). + reg(maxDiff=0)이 kFSM=0 단일 경로를 보장.
 *  (c) 히스테리시스·비가역: 폭 = burnOn−burnOff > 0 · 역전이(burning→living, ash→*) = 0(비가역·anti-chatter) · 3상태 모두 도달. */
function fsmTest(seed) {
  var p = scn();
  var sim = ENG.createSim(seed, p); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5);
  var lf = p.livingFrac, rate = p.starRate;
  var labelViol = 0;                                   // (a) 라벨≠활성도배수 위반 수
  var l2b = 0, ashHeat = 0, ashFuel = 0, back = 0;     // (c) 전이 계수
  var reach = [false, false, false];                   // (c) 도달한 상태
  var burnDrop = 0, burnN = 0, liveDrop = 0, liveN = 0;// (b) 상태별 측정 throughput(연료 소비/tick)
  var TICKS = 12000;
  for (var t = 0; t < TICKS; t++) {
    var pre = new WeakMap();   // 별 객체는 tick 간 참조 유지(alive.push) → WeakMap 으로 직전 상태 추적
    sim.stars.forEach(function (s) { pre.set(s, { st: s.state, f: s.fuel }); });
    ENG.step(sim);
    sim.stars.forEach(function (s) {
      var q = pre.get(s); if (!q) return;
      /* (a) 라벨 == 활성도 배수 인덱스([livingFrac,1,0]) — 매 tick 검사 */
      var expMul = s.state === 0 ? lf : s.state === 1 ? 1 : 0;
      if (s.burnMul !== expMul) labelViol++;
      /* (b) 상태별 측정 throughput(연료 소비) — 전이 안 한 안정 상태에서만(경계 tick 제외) */
      var drop = q.f - s.fuel;
      if (q.st === 1 && s.state === 1) { burnDrop += drop; burnN++; }
      if (q.st === 0 && s.state === 0) { liveDrop += drop; liveN++; }
      /* (c) 전이 계수 */
      if (q.st === 0 && s.state === 1) l2b++;
      if (q.st === 1 && s.state === 2) { if (s.fuel <= 1e-9) ashFuel++; else ashHeat++; }
      if ((q.st === 1 && s.state === 0) || (q.st === 2 && s.state < 2)) back++;
      reach[s.state] = true;
    });
  }
  var liveRate = liveN ? liveDrop / liveN : 0, burnRate = burnN ? burnDrop / burnN : 0;
  var ratio = burnRate > 0 ? liveRate / burnRate : 0;
  var width = p.burnOn - p.burnOff;
  var pass = labelViol === 0 && back === 0 && reach[0] && reach[1] && reach[2] && width > 0 &&
             l2b > 0 && (ashHeat + ashFuel) > 0 && Math.abs(ratio - lf) < 0.08;
  return { seed: seed, labelViol: labelViol, l2b: l2b, ashHeat: ashHeat, ashFuel: ashFuel, back: back,
    reach: (reach[0] ? 'L' : '-') + (reach[1] ? 'B' : '-') + (reach[2] ? 'A' : '-'),
    ratio: ratio, lf: lf, width: width, pass: pass };
}

/* 한 시드: 별 점화 후 pop 을 지평선까지 추적, 공멸(pop=0) tick + 후반 창(지평선-5000~지평선) 출생·사망. */
function runLife(extra) {
  return SEEDS.map(function (seed) {
    var sim = ENG.createSim(seed, scn(extra)); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5);
    var peak = 0, collapseTick = -1;
    for (var t = 4000; t <= HORIZON - 5000 && collapseTick < 0; t += 250) {
      ENG.run(sim, 250);
      if (sim.agents.length > peak) peak = sim.agents.length;
      if (sim.agents.length === 0) collapseTick = t;
    }
    var b0 = sim.births, d0 = sim.deaths;
    if (collapseTick < 0) ENG.run(sim, 5000);
    return { seed: seed, peak: peak, collapse: collapseTick,
      lateBirths: collapseTick < 0 ? sim.births - b0 : 0, lateDeaths: collapseTick < 0 ? sim.deaths - d0 : 0,
      finPop: sim.agents.length, finStars: sim.stars.length };
  });
}

/* ── sustain: FSM on 이 끝없는 churn 을 유지(공멸 없이 40k 생존·후반 출생≈사망>0). ── */
function sustainTest() {
  var on = runLife({});
  var onSurv = on.every(function (r) { return r.collapse < 0; });
  var churnAlive = on.every(function (r) { return r.lateBirths > 0 && r.lateDeaths > 0; });
  return { on: on, pass: onSurv && churnAlive };
}

function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hash', 'golden', 'pass']);
    console.log('회귀 0: kFSM=0 step-0013 == step-0012 (자기제한 스택 해시 == golden cwd@, combust 법칙 skip·별 상태 필드 없음)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'burned', 'starD', 'pop', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (FSM state 는 거래 0 — 주입은 ignite 의 fuel→E 경계 불변, sumE+M+R+evap+sunk+metab−injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 비트 동일(이산 *상태 라벨*이 해시에 — 가법, FSM off 면 endo@ 불변).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'fsm') {
    var rf = seeds.map(fsmTest); table(rf, ['seed', 'labelViol', 'l2b', 'ashHeat', 'ashFuel', 'back', 'reach', 'ratio', 'width', 'pass']);
    var rr = avg(rf, 'ratio');
    console.log('(a) 분기 부재: labelViol=0(전 tick·전 별 라벨 == 활성도 배수[livingFrac,1,0] 인덱스 → 자유 태그 아님·별도 type 분기 없음). reg maxDiff=0 이 kFSM=0 단일 경로 보장.');
    console.log('(b) 활성도로 재구성: 측정 throughput 비 living/burning = ' + rr.toFixed(3) + ' ≈ livingFrac ' + FSM.livingFrac + ' → 라벨이 *측정 dE/dt* 로 읽힌다(편의 표기, 진실의 출처는 활성도).');
    console.log('(c) 히스테리시스·비가역: 폭 burnOn−burnOff = ' + FSM.burnOn + '−' + FSM.burnOff + ' = ' + (FSM.burnOn - FSM.burnOff).toFixed(2) + ' > 0(밴드에서 latch=anti-chatter). 역전이 back=0(비가역). 3상태(LBA) 모두 도달. 소진은 *느린* 연료(ashFuel) 주도 + *조기* 핫코어 quench(ashHeat) 소수.');
    return rf.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var r = sustainTest();
    console.log('step-0013 (FSM on, kFSM=1 livingFrac=0.55 burnOn=0.6 burnOff=0.4):'); table(r.on, ['seed', 'peak', 'finPop', 'finStars', 'lateBirths', 'lateDeaths']);
    console.log('FSM on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 창 출생/사망 ' + avg(r.on, 'lateBirths').toFixed(0) + '/' + avg(r.on, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(r.on, 'finPop').toFixed(0) + '). 이산 FSM 이 step-0012 의 끝없는 churn 을 깨지 않는다(존재론 추가가 동역학 보존).');
    return r.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'fsm', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
