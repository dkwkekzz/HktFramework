/* HWS step-0014 헤드리스 검증 — 활성도 계량(flux: 척추 변수 E 의 통과 throughput 측정, SPINE 결정1·2).
 * 새 구조(law-pipeline): 시뮬 로직은 engine/hws-laws.js 의 flux 법칙 1개(LAW_ORDER 맨 끝). 이 verify 는 그 위에서 돈다.
 *
 * 사용: node step-0014/verify.js <reg|conserve|det|flux|sustain|all> [seed]
 *  - reg     : 회귀 0 — kFlux=0 이면 step-0013 과 비트 동일(flux 통째 skip·A 필드 미적분). 연소 FSM 스택 해시를 golden fsm@ 와 대조.
 *  - conserve: 보존 — flux(활성도 적분이 도는 내내) 닫힌 장부 잔차 < 1e-6. A 는 *속도*(에너지 아님) → 거래 0(장부 불변).
 *  - det     : 결정론 — kFlux on 같은 시드 2회 비트 동일(E+R+에이전트+별+상태라벨+*활성도 필드 A*가 해시에).
 *  - flux    : 결정1·2 가설 — (1)A 가 E 의 flux(dE/dt) 로 적분된 *연속 활성도 축* · (2)분류 창발: 저장체(정착 R, 흐름 끊김 → A≈0)와
 *              소산(별 연소, 흐름 격렬 → A 높음)이 *측정*으로 갈린다(authored enum 없이). 같은 stored E 라도 흐름이 지나면 소산·끊기면 저장체.
 *  - sustain : flux(읽기 전용 계기)가 step-0013 의 끝없는 churn 을 *깨지 않는가*(공멸 없이 지평선 생존·후반 출생≈사망>0). 부수 검증.
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = step-0013 그대로(외부 source off, 별 내생 구동 + 자기제한 + 연소 FSM) + 활성도 계량(kFlux 1, aFlux 0.1).
 * A[i] ← (1−aFlux)·A[i] + aFlux·|E[i]−Eprev[i]|  (EMA of net dE/dt). A 는 읽기 전용 — E/R/agent 동역학에 되먹이지 않는다.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(flux 법칙 포함)
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
var FSM = { kFSM: 1, livingFrac: 0.55, burnOn: 0.6, burnOff: 0.4 };
var FLUX = { kFlux: 1, aFlux: 0.1 };                        // step-0014 신규 — 활성도 계량
var POOL = { minE: 1.5, prom: 0.3 };
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;
var HORIZON = 40000;

/* 내생(외부 source off, 별+자기제한+연소 FSM) + 활성도 계량. extra 로 kFlux=0 주면 step-0013 회귀. */
function scn(extra) { return Object.assign({}, AGG, LIFE, REPRO, MOVE, STAGE, STAR, CROWD, FSM, FLUX, { drive: false, kEvap: 0.001, baseCost: 0.05 }, extra || {}); }
function avg(rows, k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; }
function spawnLife(sim, k) { var pl = ENG.detectPools(sim, POOL), n = Math.min(k, pl.length); for (var i = 0; i < n; i++) ENG.spawnAgent(sim, pl[i].x, pl[i].y); return n; }
function seedStars(sim, k) { for (var i = 0; i < k; i++) ENG.spawnStar(sim, (i * 53) % W, (i * 29) % H); }

/* ── reg: kFlux=0 → step-0013 비트 동일. golden fsm@ 해시(연소 FSM 스택, flux 추가 전 동결)와 대조. ── */
function reg(seed) {
  var gold = JSON.parse(fs.readFileSync(path.join(__dirname, '../engine/validate/golden-sim.json'), 'utf8'));
  /* golden fsm@ 와 *동일 절차*(verify-sim-engine.js runGolden 의 fsm): 별 6 + run 2000 + 생명 5 + run 3000, FSM on·kFlux=0. */
  var sim = ENG.createSim(seed, scn({ kFlux: 0 })); seedStars(sim, 6); ENG.run(sim, 2000); spawnLife(sim, 5); ENG.run(sim, 3000);
  var h = ENG.hashState(sim), g = gold['fsm@' + seed];
  return { seed: seed, hash: h, golden: g, pass: h === g };
}

/* ── conserve: 활성도 적분이 도는 내내 닫힌 장부. ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn()); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); ENG.run(sim, 8000);
  var led = ENG.ledger(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, fluxSum: sim.fluxSum, fluxPeak: sim.fluxPeak, pop: sim.agents.length, pass: led.residual < 1e-6 };
}

/* ── det: kFlux on 같은 시드 2회 비트 동일(활성도 필드 A 가 해시에). ── */
function det(seed) {
  function build() { var s = ENG.createSim(seed, scn()); seedStars(s, 6); ENG.run(s, 4000); spawnLife(s, 5); ENG.run(s, 4000); return s; }
  var a = build(), b = build();
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i] || a.R[i] !== b.R[i] || a.A[i] !== b.A[i]) { bit = false; break; }
  return { seed: seed, hashA: ENG.hashState(a), hashB: ENG.hashState(b), pass: bit && ENG.hashState(a) === ENG.hashState(b) };
}

/* 별 disc 점유 마스크 — 각 셀이 (어떤 별 disc 안인가, 그중 burning 인 별 disc 안인가). */
function starMasks(sim) {
  var N = sim.p.W * sim.p.H, inAny = new Uint8Array(N), inBurn = new Uint8Array(N), st = sim.stars;
  for (var s = 0; s < st.length; s++) {
    var cells = st[s].cells, burn = st[s].state === 1;
    for (var c = 0; c < cells.length; c++) { inAny[cells[c]] = 1; if (burn) inBurn[cells[c]] = 1; }
  }
  return { inAny: inAny, inBurn: inBurn };
}

/* ── flux: 결정1·2 가설 — 활성도 축(A) 위에서 저장체↔소산이 *측정*으로 갈린다. ──
 *  한 시드, 측정 창 동안 매 샘플마다 A 를 R/별 라벨로 *읽어* 평균을 모은다(A 계산엔 R/별 안 들어감 — E 만):
 *   - A_burn  : burning 별 disc 셀 평균 A (소산 극단 — 흐름 격렬).
 *   - A_store : 정착 R 셀(R>Rthr, *어떤 별 disc 도 아님*) 평균 A (저장체 극단 — 흐름 끊김, "존재하되 활성도≈0").
 *   - A_quiet : 정착 세계 전체(별 disc 아님) 평균 A (저장체+배경 — 흐름이 가라앉은 곳).
 *   - fracBR  : burning 셀 중 R-rich(R>Rthr) 비율 — *별 연소 셀도 stored E(R) 위*임을 보인다(같은 substance!).
 *  ratio = A_burn / A_store. 분류는 *측정으로* 창발 — 코드에 enum 없이 A 문턱이 두 극단을 가른다. 핵심(결정2): 별 연소 셀이
 *  거의 다 R-rich(fracBR≈1)인데도 *측정 A* 가 저장체보다 ratio 배 높다 → 흐름(활성도)이 정체성(R 보유)보다 분류를 가른다. */
function fluxTest(seed) {
  var p = scn();
  var sim = ENG.createSim(seed, p); seedStars(sim, 6); ENG.run(sim, 4000); spawnLife(sim, 5); ENG.run(sim, 2000);  // A 발달
  var Rthr = 0.5;                                    // 정착 R 문턱(저장체로 셈)
  var sBurn = 0, nBurn = 0, burnR = 0, sStore = 0, nStore = 0, sQuiet = 0, nQuiet = 0;
  var SAMPLES = 60, GAP = 100;
  for (var k = 0; k < SAMPLES; k++) {
    ENG.run(sim, GAP);
    var A = sim.A, R = sim.R, N = W * H, m = starMasks(sim);
    for (var i = 0; i < N; i++) {
      var inAny = m.inAny[i], inBurn = m.inBurn[i], r = R[i], a = A[i];
      if (inBurn) { sBurn += a; nBurn++; if (r > Rthr) burnR++; }
      if (!inAny) { sQuiet += a; nQuiet++; if (r > Rthr) { sStore += a; nStore++; } }
    }
  }
  var A_burn = nBurn ? sBurn / nBurn : 0, A_store = nStore ? sStore / nStore : 0, A_quiet = nQuiet ? sQuiet / nQuiet : 0;
  var ratio = A_store > 0 ? A_burn / A_store : 0, fracBR = nBurn ? burnR / nBurn : 0;
  var pass = nBurn > 0 && nStore > 0 && A_burn > A_store && A_burn > A_quiet && ratio > 5 && fracBR > 0.5;
  return { seed: seed, A_burn: A_burn, A_store: A_store, A_quiet: A_quiet, ratio: ratio, fracBR: fracBR, nBurn: nBurn, nStore: nStore, pass: pass };
}

/* 한 시드: 별 점화 후 pop 을 지평선까지 추적, 공멸(pop=0) tick + 후반 창 출생·사망. */
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

/* ── sustain: flux on 이 끝없는 churn 을 유지(공멸 없이 40k 생존·후반 출생≈사망>0). ── */
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
    console.log('회귀 0: kFlux=0 step-0014 == step-0013 (연소 FSM 스택 해시 == golden fsm@, flux 법칙 skip·A 필드 미적분)');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'fluxSum', 'fluxPeak', 'pop', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (A 는 *속도*지 에너지 아님 — 거래 0, 읽기 전용 계기. sumE+M+R+evap+sunk+metab−injected=E0)');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 비트 동일(활성도 필드 A 도 해시에 — 가법, kFlux=0 면 fsm@ 불변).');
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'flux') {
    var rf = seeds.map(fluxTest); table(rf, ['seed', 'A_burn', 'A_store', 'A_quiet', 'ratio', 'fracBR', 'nStore', 'pass']);
    console.log('(1) 활성도 축: A = E 의 flux(|dE/dt|) EMA 적분 — 재고(E)와 흐름(A)을 분리해 *읽어낸다*(SPINE 결정1, 차이슨 energy rate density).');
    console.log('(2) 분류 창발: A_burn/A_store = ' + avg(rf, 'ratio').toFixed(1) + '(소산/저장체) — 별 연소(흐름 격렬, A=' + avg(rf, 'A_burn').toFixed(3) + ') vs 정착 R(흐름 끊김, A=' + avg(rf, 'A_store').toFixed(4) + ') 이 *측정*으로 갈린다(authored enum 없이, 결정2).');
    console.log('(2b) 흐름이 정체성보다 분류를 가른다: burning 셀의 ' + (avg(rf, 'fracBR') * 100).toFixed(0) + '%가 R-rich(stored E 위)인데도 A 가 저장체보다 ' + avg(rf, 'ratio').toFixed(0) + '배 — *같은 substance(R)* 라도 흐름이 지나면 소산·끊기면 저장체(SPINE: 이름 아닌 활성도가 분류).');
    return rf.every(function (r) { return r.pass; });
  } else if (mode === 'sustain') {
    var r = sustainTest();
    console.log('step-0014 (flux on, kFlux=1 aFlux=0.1):'); table(r.on, ['seed', 'peak', 'finPop', 'finStars', 'lateBirths', 'lateDeaths']);
    console.log('flux on *공멸 없음*(지평선 ' + HORIZON + ' 전 시드 생존). 후반 창 출생/사망 ' + avg(r.on, 'lateBirths').toFixed(0) + '/' + avg(r.on, 'lateDeaths').toFixed(0) +
      ' (≈균형 — carrying capacity ~' + avg(r.on, 'finPop').toFixed(0) + '). 읽기 전용 계기(A)가 동역학을 안 바꾼다(측정은 부작용 0).');
    return r.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'conserve', 'det', 'flux', 'sustain'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
