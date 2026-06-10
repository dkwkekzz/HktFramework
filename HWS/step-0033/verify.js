/* HWS step-0033 헤드리스 검증 — R 차폐(VOXEL.md V5: 중력으로 흐르는 E 가 아래 R[지면]에 막혀 위에 고임 = 바다가 지면 *위에*).
 * 새 구조(law-pipeline): 이 step 은 *법칙을 더하지 않는다* — gravity 의 하향 유출에 차폐 게이트를 더한다(게이트 노브 1개 + 문턱 1개, in-place).
 *   변경점: DEFAULTS.kOcclude(마스터 0/1, 기본 0) · occludeThresh(차폐 문턱) · gravity 가 kOcclude>0 이면 아래 칸 R≥문턱 시 하향 유출 차단.
 *   kOcclude=0 이면 gravity 가 V3 순수 하향(occ 검사 short-circuit·grav@/support@ 비트 동일). D=1 이면 gravity 자체가 z 벽으로 early-return = 비트 동일(이중 가드).
 *
 * 사용: node step-0033/verify.js <reg|bath|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kOcclude 값 무관 비트 동일(gravity 가 z 벽 early-return). *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든 해시(전 D=1 시나리오 std@~support@ 비트 불변)가 권위.
 *  - bath     : 가설 — *차폐가 E 를 지면 위에 고이게 한다*. z=3 전 평면에 정적 R 지면 슬랩 + 그 위(z=4..7) E 주입 + 중력:
 *               차폐 off 면 E 가 지면을 *통과해* 바닥(z=0)으로 침전(지면 위 분율 ≈0%) — 차폐 on 이면 지면 *위에* 막혀 고임(지면 위 분율 ≈100%) = 바다가 지면 위에.
 *  - conserve : 보존 — D=8 중력+차폐에서 닫힌 장부 잔차 < 1e-11(차폐는 하향 쌍 거래를 *막기만* 함 — 양 안 바꿈, 장부 무관).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H;

/* 표준 R 차폐 3D 아레나 — verify-sim-engine.js occludeArena() 와 동일 상수(골든 occl@ 와 일치).
 * D=8 voxel 상자, 빈 세계(initE=0) + 정적 R 지면 슬랩 + 그 위 E 주입 + 중력 + 차폐 — 다른 법칙 다 off(순수 차폐 격리).
 * 결정화·풍화 off(kCryst=0·kWeather=0) → R 슬랩이 정적(차폐 *판정* 대상만 — 침착·풍화와 직교). */
function occludeArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kGravity: 0.2, kOcclude: 1, occludeThresh: 0.5,
    kCryst: 0, kWeather: 0, kSupport: 0,
    kCrowd: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 정적 R 지면 슬랩(z=GZ 전 평면) + 그 위(z>GZ) E 주입 — 둘 다 E0(장부 baseline)에 산입. verify-sim-engine.js seedOcclude() 와 동일. */
var GZ = 3, RVAL = 1.0, EVAL = 2.0;
function seedOcclude(sim) {
  var D = sim.p.D, k, z, i;
  for (k = 0; k < WH; k++) { i = GZ * WH + k; sim.R[i] = RVAL; sim.E0 += RVAL; }                 // z=3 지면(고체 R)
  for (z = GZ + 1; z < D; z++) for (k = 0; k < WH; k++) { i = z * WH + k; sim.E[i] += EVAL; sim.E0 += EVAL; }  // z=4..7 그 위 E
}
function planeEsums(sim, D) { var s = []; for (var z = 0; z < D; z++) { var t = 0; for (var k = 0; k < WH; k++) t += sim.E[z * WH + k]; s.push(t); } return s; }

/* ── reg: D=1 에선 kOcclude 값이 비트 동일을 안 깬다(gravity 가 z 벽으로 early-return). 전체 스택을 굴려 확인. ── */
function reg(seed) {
  function go(kOcc) {
    var s = ENG.createSim(seed, {
      D: 1, initE: 1.0, noise: 0.5, drive: true,
      source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
      kD: 0.2, kEvap: 0.001, kA: 0.45, aggMc: 1.1, aggW: 0.7, baseCost: 0.05,
      kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0,
      kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20,
      kCrowd: 0.20, kFSM: 1, kFlux: 1, kTemplate: 1, kInherit: 1, kGravity: 0.2, kSupport: 1, supportThresh: 0.5, kOcclude: kOcc
    });
    ENG.run(s, 800); return ENG.hashState(s);
  }
  var h0 = go(0), h1 = go(1);
  return { seed: seed, hashOcc0: h0, hashOcc1: h1, pass: h0 === h1 };
}

/* ── bath: 가설 — 차폐가 E 를 지면 위에 고이게 한다(통과 vs 고임). ── */
function bath(seed) {
  var D = 8, TICK = 600, eps = 1e-9;
  /* 차폐 off(kOcclude=0): E 가 지면(z=3) 통과해 바닥(z=0)으로 침전. on(kOcclude=1): 지면 위(z=4)에 막혀 고임. */
  var off = ENG.createSim(seed, occludeArena({ kOcclude: 0 })); seedOcclude(off); ENG.run(off, TICK);
  var on  = ENG.createSim(seed, occludeArena({ kOcclude: 1 })); seedOcclude(on);  ENG.run(on,  TICK);
  var eOff = planeEsums(off, D), eOn = planeEsums(on, D);
  var totOff = eOff.reduce(function (a, b) { return a + b; }, 0), totOn = eOn.reduce(function (a, b) { return a + b; }, 0);
  /* 지면 위(z>GZ) E 분율 — on 이면 차폐로 위에 고여 ↑(≈100%), off 면 통과해 바닥으로 ↓(≈0%). */
  function aboveFrac(es, tot) { var s = 0; for (var z = GZ + 1; z < D; z++) s += es[z]; return tot > 0 ? s / tot : 0; }
  var aboveOff = aboveFrac(eOff, totOff), aboveOn = aboveFrac(eOn, totOn);
  /* 최저 E 평면(eps 초과) — off 면 0(바닥 침전), on 면 GZ+1(지면 바로 위). */
  function lowestE(es) { for (var z = 0; z < D; z++) if (es[z] > eps) return z; return -1; }
  var loOff = lowestE(eOff), loOn = lowestE(eOn);
  return {
    seed: seed, aboveOff: aboveOff, aboveOn: aboveOn, loOff: loOff, loOn: loOn,
    /* 차폐 on: E 가 지면 위(분율 ≈1)·최저 E 평면 = 지면 바로 위(GZ+1). off: 지면 통과해 바닥(분율 ≈0·최저 z=0). */
    pass: aboveOn > 0.99 && aboveOff < 0.01 && loOn === GZ + 1 && loOff === 0
  };
}

/* ── conserve: D=8 중력+차폐에서 닫힌 장부 잔차(차폐는 하향 쌍 거래를 막기만 함 — 양 안 바꿈). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, occludeArena()); seedOcclude(sim); ENG.run(sim, 600);
  var L = ENG.ledger(sim), es = planeEsums(sim, 8), tot = es.reduce(function (a, b) { return a + b; }, 0);
  var above = 0; for (var z = GZ + 1; z < 8; z++) above += es[z];
  return { seed: seed, residual: L.residual, sumE: L.sumE, sumR: L.store, aboveFrac: tot > 0 ? above / tot : 0, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, occludeArena()); seedOcclude(s); ENG.run(s, 600); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashOcc0', 'hashOcc1', 'pass']);
    console.log('회귀 0: D=1 에선 kOcclude=0 과 kOcclude=1 이 비트 동일(gravity 가 z 벽으로 early-return — 하향 유출 자체가 없음). *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 D=1 시나리오)가 권위 — 비트 불변 확인.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'bath') {
    var rb = seeds.map(bath); table(rb, ['seed', 'aboveOff', 'aboveOn', 'loOff', 'loOn', 'pass']);
    console.log('차폐가 E 를 지면 위에 고이게 한다: z=3 정적 R 지면 + 그 위 E 주입 + 중력 → 차폐 off 면 E 가 지면 통과해 바닥으로(지면 위 분율 ' + (avg(rb, 'aboveOff') * 100).toFixed(1) + '%·최저 E 평면 z=' + avg(rb, 'loOff').toFixed(0) + ') → 차폐 on 이면 지면 위(z=' + avg(rb, 'loOn').toFixed(0) + ')에 막혀 고임(지면 위 분율 ' + (avg(rb, 'aboveOn') * 100).toFixed(1) + '%) = 바다가 지면 위에. V3 중력(바다)을 완성 — E 가 지면을 통과 못 한다.');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'sumR', 'aboveFrac', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 중력+차폐 — 차폐는 하향 쌍 거래[E↔E]를 *막기만* 함·양 안 바꿈, 닫힌 장부 유지. 지면 위 E 분율 ' + (avg(rc, 'aboveFrac') * 100).toFixed(1) + '% — 바다가 지면 위에).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(R 차폐도 결정론 보존 — Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'bath', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
