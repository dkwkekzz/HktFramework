/* HWS step-0041 헤드리스 검증 — 풍화 평형: 물질 순환의 carrying capacity(VOXEL.md V5+ — SPINE 척도분리 *느린 재구성*).
 * 0035~0040 이 에너지를 *별→빛→비→바다→지면→새 별*로 완전 폐합했다. 그러나 그 고리는 물질(R)을 한 방향으로만 쌓는다 —
 *   결정화(E→R)가 바다를 지면/씨앗으로 굳히면 R 은 *영구 누적*(0040 격리 아레나 kWeather=0). 전부 비가역이면 세계는 죽은 바위로
 *   *래칫*되어 새 동결(SPINE G2 재발)에 빠진다. 이 step 은 그 고리의 *마지막 반쪽* = **느린 재구성(풍화)** 을 닫는다:
 *   풍화(kWeather, R→E·step-0008 부터 존재)가 굳은 바위를 천천히 흐르는 E 로 되돌려, 물질이 *쌓임↔풍화*의 동적 평형(carrying
 *   capacity)에 든다. SPINE 척도분리("개체 척도=빠른 비가역 / 세계 척도=느린 순환")의 물질판 — 0012(개체수 자기제한)의 *물질* 짝.
 * 이 step 은 hws-laws.js 를 *건드리지 않는다* — 풍화는 이미 crystallize 안에 있다(step-0008). 검증된 부품(중력·지지 침착·결정화·*풍화*)을
 *   *합성*해, 닫힌 저장소(외부 연료 주입 없는 closed 아레나)에서 *둘만으론 안 나는 제3 현상*(물질이 동결 대신 끝없이 E↔R 순환)을 창발시키는 통합 step.
 *   통합 게이트 = 기존 노브 kWeather. kWeather=0 → 풍화 분기 no-op(rel=R·0=0) → 물질이 통째로 R 로 동결(0040 까지의 동역학 그대로) = 회귀.
 *
 * 핵심 대조(closed 아레나 — 균일 E 저장소, 별·생명 off, 중력→바다·지지 침착→지면, D=8):
 *   - 풍화 OFF(kWeather=0): 결정화가 모든 가용 E 를 R 로 굳힌다 → R 이 천장(155648)에 래칫·E 가 굶어(8192) **세계가 바위로 동결**(풍화 0).
 *   - 풍화 ON(kWeather=0.01): R 이 더 낮은 평형(129489)에 멈추고(carrying capacity·천장 ↓) E 가 4.19배 더(34351) *흐름에 남는다*.
 *     R 이 평형이어도 풍화 flux 는 멈추지 않는다(1000~2000 tick 사이 풍화량 ~1.3e6) — 정적 동결 아니라 **동적 순환**(세계 척도 churn 영속).
 *
 * 사용: node step-0041/verify.js <reg|equil|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — 풍화(kWeather)를 끄면(0) weqArena 가 *풍화 없는 결정화 아레나*(물질 통째 동결)로 비트 환원(풍화 분기 no-op).
 *               weathered===0 확인 + 2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든(법칙 무변경 → std@~ring@ 전 해시 비트 불변)이 권위.
 *  - equil    : 가설 — *풍화가 물질에 carrying capacity 를 주고 동결을 막는다*. OFF vs ON 비교: OFF 면 R 이 천장에 래칫·E 굶어 동결(풍화 0)·
 *               ON 이면 R 평형 ↓·E 흐름 4배↑·풍화 flux 영속(R 평형이어도 churn 안 멈춤) = 쌓임↔풍화 동적 평형.
 *  - conserve : 보존 — closed 아레나(외부 주입 0)에서 닫힌 장부 잔차 < 1e-11(결정화 E→R·풍화 R→E 모두 셀 안 쌍 거래[보존]).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H;

/* 풍화 평형 closed 아레나 — verify-sim-engine.js weqArena() 와 동일 상수(골든 weq@ 와 일치).
 * 외부 연료 주입 0(별·source 다 off)인 *닫힌 저장소*: 균일 초기 E(initE=5) 가 중력으로 z=0 바다로 고이고 → 지지 침착으로 지면 R 로 굳고
 *   → 풍화(kWeather)로 R 이 천천히 E 로 되돌아온다. 외부 주입이 없어야 *쌓임↔풍화* 의 순수 carrying capacity 가 드러난다(0040 의 open
 *   고리는 별 연료가 끝없이 들어와 R 총량이 안 멈춘다 — 평형을 가리는 교란). 풍화 게이트 = 기존 노브 kWeather. */
function weqArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 5.0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 1, starGap: 6, starR: 2, starDriftPeriod: 20,
    kFSM: 0, kGravity: 0.2, kCollapse: 0, kCryst: 0.05, crystThresh: 2.0, kSupport: 1, supportThresh: 0.5, kWeather: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
var WEATHER_ON = 0.01;   // 데모 풍화율(carrying capacity 가 ~1000 tick 안에 또렷하게 드러나는 값). 정전 기본(0.0003)은 완화시간 ~3300 tick 로 느려 데모엔 부적합.
function totalR(sim) { var R = sim.R, s = 0; for (var k = 0; k < R.length; k++) s += R[k]; return s; }
function totalE(sim) { var E = sim.E, s = 0; for (var k = 0; k < E.length; k++) s += E[k]; return s; }
function runTo(sim, t) { while (sim.tick < t) ENG.step(sim); }

/* ── reg: 회귀 0 — 풍화를 끄면(kWeather=0) 풍화 분기가 no-op(rel=R·0=0) → weqArena 가 *풍화 없는 결정화 아레나*(물질 통째 동결)로 비트 환원.
 *   weathered===0(R→E 전이 0) + 같은 설정 2회 실행 비트 동일을 확인. 법칙 무변경이라 *교차 버전* 회귀는 골든(std@~ring@ 비트 불변)이 권위. ── */
function reg(seed) {
  var a = ENG.createSim(seed, weqArena({ kWeather: 0 })); runTo(a, 1000);
  var b = ENG.createSim(seed, weqArena({ kWeather: 0 })); runTo(b, 1000);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, weathered: a.weathered, hashA: ha, hashB: hb, pass: ha === hb && a.weathered === 0 };
}

/* ── equil: 가설 — 풍화가 물질에 carrying capacity 를 주고 동결을 막는다. OFF(kWeather=0) vs ON(0.01) 비교. ── */
function equil(seed) {
  function go(kW) {
    var s = ENG.createSim(seed, weqArena({ kWeather: kW }));
    runTo(s, 1000); var R1 = totalR(s), w1 = s.weathered;
    runTo(s, 2000); var R2 = totalR(s), E2 = totalE(s), w2 = s.weathered;
    return { Req: R2, growth: R2 - R1, Ecirc: E2, weath: w2, wflux: w2 - w1 };   // growth≈0 = 평형 도달; wflux = 평형서도 도는 풍화 flux
  }
  var off = go(0), on = go(WEATHER_ON);
  return {
    seed: seed, ReqOff: off.Req, ReqOn: on.Req, EcircOff: off.Ecirc, EcircOn: on.Ecirc,
    weathOn: on.weath, wfluxOn: on.wflux, growthOff: off.growth, growthOn: on.growth,
    Eratio: on.Ecirc / off.Ecirc,
    /* OFF: 풍화 0(weathered=0)·E 굶어 동결. ON: R 평형 ↓(carrying capacity)·E 흐름 ≫OFF·풍화 flux 영속(평형이어도 R↔E churn). 둘 다 평형(growth≈0). */
    pass: off.weath === 0 && on.weath > 0 && on.wflux > 0 && on.Ecirc > off.Ecirc * 1.5 && on.Req < off.Req && Math.abs(on.growth) < off.Req * 0.01
  };
}

/* ── conserve: closed 아레나(외부 주입 0)에서 닫힌 장부 잔차(결정화 E→R·풍화 R→E 모두 셀 안 쌍 거래[보존]). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, weqArena({ kWeather: WEATHER_ON })); runTo(sim, 2000);
  var L = ENG.ledger(sim);
  return { seed: seed, residual: L.residual, store: L.store, weathered: sim.weathered, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, weqArena({ kWeather: WEATHER_ON })); runTo(s, 1000); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'weathered', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: 풍화(kWeather)를 끄면(0) 풍화 분기 no-op(rel=R·0=0) → weqArena 가 *풍화 없는 결정화 아레나*(물질 통째 동결)로 비트 환원(weathered=0·2회 실행 비트 동일). 이 step 은 법칙 무변경(통합 step) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(std@~ring@ 전 시나리오)가 권위·비트 불변.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'equil') {
    var rb = seeds.map(equil); table(rb, ['seed', 'ReqOff', 'ReqOn', 'EcircOff', 'EcircOn', 'wfluxOn', 'pass']);
    console.log('풍화가 물질에 carrying capacity 를 주고 동결을 막는다(SPINE 척도분리 느린 재구성·0012 의 물질 짝): closed 저장소(외부 주입 0)에서 — 풍화 OFF 면 결정화가 모든 가용 E 를 R 로 굳혀 R 이 천장(' + avg(rb, 'ReqOff').toFixed(0) + ')에 래칫·E 가 굶어(' + avg(rb, 'EcircOff').toFixed(0) + ') 세계가 바위로 *동결*(풍화량 0) → ON 이면 R 이 더 낮은 평형(' + avg(rb, 'ReqOn').toFixed(0) + ' = carrying capacity·천장 ↓)에 멈추고 E 가 ' + avg(rb, 'Eratio').toFixed(2) + '배(' + avg(rb, 'EcircOn').toFixed(0) + ') 더 *흐름에 남는다*. R 이 평형(growth≈' + avg(rb, 'growthOn').toFixed(1) + ')이어도 풍화 flux(1000~2000 tick: ' + avg(rb, 'wfluxOn').toExponential(2) + ')는 안 멈춘다 — 정적 동결 아니라 **동적 순환**(세계 척도 churn 영속). 쌓임↔풍화 = 물질 순환의 carrying capacity.');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'store', 'weathered', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (closed 아레나·외부 주입 0 — 결정화 E→R·풍화 R→E 모두 셀 안 쌍 거래[보존]·닫힌 장부 유지. 풍화량 ' + avg(rc, 'weathered').toExponential(2) + ' 가 R↔E 로 돌아도 잔차는 임계 이내 — 비가역 ≠ 비보존).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(중력+지지 침착+결정화+풍화 통합도 결정론 보존 — Math.random 0, 방향은 법칙 상수).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'equil', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
