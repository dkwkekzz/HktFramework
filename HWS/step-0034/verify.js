/* HWS step-0034 헤드리스 검증 — 부유 R 붕괴(VOXEL.md V5+: 지지 잃은 R[공중 바위]이 아래로 무너진다 = R 의 중력의 동역학 짝).
 * 새 법칙(law-pipeline): collapse 1개 + 노브 1개(kCollapse) + 문턱 1개(collapseThresh) + LAW_ORDER 한 자리(gravity 뒤).
 *   변경점: DEFAULTS.kCollapse(붕괴율 0~1, 기본 0) · collapseThresh(지지 문턱) · collapse 가 kCollapse>0 이면 아래(z−1) 칸 R<문턱(비지지) 시 제 R 의 kCollapse 비율을 아래로 떨군다(R↔R 쌍 거래).
 *   kCollapse=0 이면 collapse 통째 early-return(R 불변·coll@ 가법 skip·골든 무관). D=1 이면 z 벽으로 early-return = 비트 동일(이중 가드).
 *
 * 사용: node step-0034/verify.js <reg|fall|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kCollapse 값 무관 비트 동일(collapse 가 z 벽 early-return). *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든 해시(전 D=1 시나리오 std@~occl@ 비트 불변)가 권위.
 *  - fall     : 가설 — *붕괴가 부유 R 을 바닥으로 무너뜨린다*. z=5 전 평면에 공중 R 슬랩(아래 z=0..4 빈칸):
 *               붕괴 off 면 R 이 공중에 그대로 떠 있음(R 무게중심 z≈5·최저 R 평면 5) — 붕괴 on 이면 바닥으로 무너져 쌓임(무게중심 z→낮음·최저 R 평면 0).
 *  - conserve : 보존 — D=8 붕괴에서 닫힌 장부 잔차 < 1e-11(붕괴는 R↔R 하향 쌍 거래 — 총 R 보존, 낙하는 비가역이라도 양 보존).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H;

/* 표준 부유 R 붕괴 3D 아레나 — verify-sim-engine.js collapseArena() 와 동일 상수(골든 coll@ 와 일치).
 * D=8 voxel 상자, 빈 세계(initE=0·R 0) + 공중 R 슬랩 + 붕괴 — 다른 법칙 다 off(순수 붕괴 격리).
 * 중력·결정화 off(kGravity=0·kCryst=0) → E 안 흐름·R 안 생김(붕괴 *판정* 대상 R 슬랩만 — 침착·중력과 직교). */
function collapseArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kCollapse: 0.2, collapseThresh: 0.5,
    kGravity: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 공중에 뜬 R 슬랩(z=GZ 전 평면, 아래 z=0..GZ−1 빈칸) — R 은 E0(장부 baseline)에 산입. verify-sim-engine.js seedFloatR() 와 동일. */
var GZ = 5, RVAL = 1.0;
function seedFloatR(sim) {
  var k, i;
  for (k = 0; k < WH; k++) { i = GZ * WH + k; sim.R[i] = RVAL; sim.E0 += RVAL; }   // z=5 공중 R(아래는 전부 빈칸 — 지지 없음)
}
function planeRsums(sim, D) { var s = []; for (var z = 0; z < D; z++) { var t = 0; for (var k = 0; k < WH; k++) t += sim.R[z * WH + k]; s.push(t); } return s; }
/* R 무게중심 z(평면별 R 합 가중) — 공중(off)이면 ≈GZ, 바닥으로 무너지면(on) →0 근처. */
function comZ(rs) { var num = 0, den = 0; for (var z = 0; z < rs.length; z++) { num += z * rs[z]; den += rs[z]; } return den > 0 ? num / den : -1; }

/* ── reg: D=1 에선 kCollapse 값이 비트 동일을 안 깬다(collapse 가 z 벽으로 early-return). 전체 스택을 굴려 확인. ── */
function reg(seed) {
  function go(kCol) {
    var s = ENG.createSim(seed, {
      D: 1, initE: 1.0, noise: 0.5, drive: true,
      source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
      kD: 0.2, kEvap: 0.001, kA: 0.45, aggMc: 1.1, aggW: 0.7, baseCost: 0.05,
      kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0,
      kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20,
      kCrowd: 0.20, kFSM: 1, kFlux: 1, kTemplate: 1, kInherit: 1, kGravity: 0.2, kSupport: 1, supportThresh: 0.5, kOcclude: 1, occludeThresh: 0.5,
      kCollapse: kCol, collapseThresh: 0.5
    });
    ENG.run(s, 800); return ENG.hashState(s);
  }
  var h0 = go(0), h1 = go(0.2);
  return { seed: seed, hashCol0: h0, hashCol1: h1, pass: h0 === h1 };
}

/* ── fall: 가설 — 붕괴가 부유 R 을 바닥으로 무너뜨린다(공중 vs 낙하). ── */
function fall(seed) {
  var D = 8, TICK = 600, eps = 1e-9;
  /* 붕괴 off(kCollapse=0): R 이 공중(z=5)에 그대로. on(kCollapse=0.2): 바닥(z=0)으로 무너져 쌓임. */
  var off = ENG.createSim(seed, collapseArena({ kCollapse: 0 }));   seedFloatR(off); ENG.run(off, TICK);
  var on  = ENG.createSim(seed, collapseArena({ kCollapse: 0.2 })); seedFloatR(on);  ENG.run(on,  TICK);
  var rOff = planeRsums(off, D), rOn = planeRsums(on, D);
  var comOff = comZ(rOff), comOn = comZ(rOn);
  /* 최저 R 평면(eps 초과) — off 면 GZ(공중 그대로), on 면 0(바닥까지 무너짐). */
  function lowestR(rs) { for (var z = 0; z < D; z++) if (rs[z] > eps) return z; return -1; }
  var loOff = lowestR(rOff), loOn = lowestR(rOn);
  /* 바닥(z=0) R 분율 — on 이면 무너져 ↑(대부분 바닥), off 면 0(공중에 떠 있음). */
  var totOff = rOff.reduce(function (a, b) { return a + b; }, 0), totOn = rOn.reduce(function (a, b) { return a + b; }, 0);
  var floorOn = totOn > 0 ? rOn[0] / totOn : 0, floorOff = totOff > 0 ? rOff[0] / totOff : 0;
  /* 바닥 2층(z=0,1) R 분율 — on 이면 ≈1(R 이 바닥부터 쌓임: z=0 이 문턱 넘어 고체가 되고 넘침이 그 위 z=1 에 안착). */
  var bot2On = totOn > 0 ? (rOn[0] + rOn[1]) / totOn : 0;
  return {
    seed: seed, comOff: comOff, comOn: comOn, loOff: loOff, loOn: loOn, floorOn: floorOn, bot2On: bot2On, floorOff: floorOff,
    /* 붕괴 on: R 이 바닥부터 쌓임(무게중심 z<1·최저 R 평면 0·바닥 z=0 이 과반·바닥 2층이 거의 전부). off: 공중 그대로(무게중심 ≈5·최저 5·바닥 0). */
    pass: comOff > GZ - 0.01 && comOn < 1.0 && loOff === GZ && loOn === 0 && floorOn > 0.5 && bot2On > 0.99 && floorOff < 0.01
  };
}

/* ── conserve: D=8 붕괴에서 닫힌 장부 잔차(붕괴는 R↔R 하향 쌍 거래 — 총 R 보존). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, collapseArena()); seedFloatR(sim); ENG.run(sim, 600);
  var L = ENG.ledger(sim), rs = planeRsums(sim, 8), tot = rs.reduce(function (a, b) { return a + b; }, 0);
  return { seed: seed, residual: L.residual, sumE: L.sumE, sumR: L.store, floorFrac: tot > 0 ? rs[0] / tot : 0, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, collapseArena()); seedFloatR(s); ENG.run(s, 600); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashCol0', 'hashCol1', 'pass']);
    console.log('회귀 0: D=1 에선 kCollapse=0 과 kCollapse=0.2 가 비트 동일(collapse 가 z 벽으로 early-return — 낙하 자체가 없음). *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 D=1 시나리오)가 권위 — 비트 불변 확인.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'fall') {
    var rb = seeds.map(fall); table(rb, ['seed', 'comOff', 'comOn', 'loOff', 'loOn', 'floorOn', 'bot2On', 'pass']);
    console.log('붕괴가 부유 R 을 바닥으로 무너뜨린다: z=5 공중 R 슬랩(아래 빈칸) → 붕괴 off 면 R 이 공중에 그대로(무게중심 z=' + avg(rb, 'comOff').toFixed(2) + '·최저 R 평면 z=' + avg(rb, 'loOff').toFixed(0) + ') → 붕괴 on 이면 바닥(z=' + avg(rb, 'loOn').toFixed(0) + ')부터 쌓임(무게중심 z=' + avg(rb, 'comOn').toFixed(2) + '·바닥 z=0 분율 ' + (avg(rb, 'floorOn') * 100).toFixed(1) + '%·바닥 2층[z=0,1] 분율 ' + (avg(rb, 'bot2On') * 100).toFixed(1) + '%) = R 의 중력. 한 기둥 R(=1.0)이 문턱(0.5) 넘어 z=0 이 고체 지면이 되고 넘침이 그 위 z=1 에 안착 → *바닥부터 쌓이는 지면*. V4 지지 침착(정적·R 이 생길 때 막음)의 동역학 짝(이미 뜬 R 을 무너뜨림).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'sumR', 'floorFrac', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 붕괴 — R↔R 하향 쌍 거래[나간 만큼 들어옴]·총 R 보존, 닫힌 장부 유지. 낙하는 비가역이라도 양 보존. 바닥 R 분율 ' + (avg(rc, 'floorFrac') * 100).toFixed(1) + '% — R 이 바닥에 쌓임).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(부유 R 붕괴도 결정론 보존 — Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'fall', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
