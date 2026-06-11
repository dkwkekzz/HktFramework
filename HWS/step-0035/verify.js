/* HWS step-0035 헤드리스 검증 — 별 부력 상승(VOXEL.md V5+: 소산 극단[별]이 떠올라 高z 하늘 배회=태양. step-0034 저장 극단[R] 침강의 짝 — 활성도 축이 연직축).
 * 새 노브(law-pipeline): ignite 법칙에 부력 z-상승 + 3D ball 방출. 노브 1개(kStarRise) + LAW_ORDER 무변경(ignite 제자리 확장).
 *   변경점: DEFAULTS.kStarRise(상승률 0~, 기본 0) · 점화 시 z=0(지면 R 핵) + 매 tick 천장(z=D−1)까지 상승 + 제 z 의 discCells3 3D ball 방출.
 *   kStarRise=0 이면 별이 z 미설정·2D disc 방출·서행만(부력 코드 미진입·sun@ 가법 skip·골든 무관). D=1 이면 D−1=0 이라 상승 0 + discCells3≡discCells = 비트 동일(이중 가드).
 *
 * 사용: node step-0035/verify.js <reg|sun|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kStarRise 값 무관 비트 동일(D−1=0 → 상승 0·discCells3(z=0,D=1)≡discCells). *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든 해시(전 D=1 시나리오 std@~coll@ 비트 불변)가 권위.
 *  - sun      : 가설 — *부력이 별을 하늘로 띄워 高z 에서 E 를 뿜는다*. z=0 R 핵에서 별 점화(중력 off 로 격리):
 *               상승 off 면 별이 z=0 에 머물러 E 가 바닥에만(별 최고 z=0·E 무게중심 z≈0) — 상승 on 이면 별이 천장(z=D−1)까지 떠올라 E 가 위에(별 최고 z=D−1·E 무게중심 z 높음) = 태양.
 *  - conserve : 보존 — D=8 부력에서 닫힌 장부 잔차 < 1e-11(상승은 별 *위치*만 — 거래 0. 방출은 fuel→E 외부 경계, injected 추적).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H;

/* 표준 별 부력 3D 아레나 — verify-sim-engine.js sunArena() 와 동일 상수(골든 sun@ 와 일치).
 * D=8 voxel 상자, 빈 세계 + z=0 R 핵(점화 신호) + 별 점화·부력 — 중력·결정화·생명 다 off(순수 부력+방출 격리).
 * kGravity=0 으로 격리(방출 E 가 제자리 — 별이 떠오른 높이에 E 가 남아 부력을 또렷이 본다). starCap=1 단일 별. */
function sunArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kIgnite: 1, kStarRise: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 1, starGap: 6, starR: 2, starDriftPeriod: 20,
    kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* z=0 정적 R 핵(점화 신호 — 별이 여기서 태어나 떠오른다). R 은 E0(장부 baseline)에 산입. verify-sim-engine.js seedSunCore() 와 동일. */
var SUN_RVAL = 2.0;
function seedSunCore(sim) {
  var disc = ENG.discCells(W, H, (W / 2) | 0, (H / 2) | 0, 2);   // z=0 평면 원판(인덱스 y·W+x = z=0; siting 은 2D 라 z=0 핵만 본다)
  for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += SUN_RVAL; sim.E0 += SUN_RVAL; }
}
function planeEsums(sim, D) { var s = []; for (var z = 0; z < D; z++) { var t = 0; for (var k = 0; k < WH; k++) t += sim.E[z * WH + k]; s.push(t); } return s; }
/* E 무게중심 z(평면별 E 합 가중) — 바닥 방출(off)이면 ≈0, 하늘 방출(on)이면 高z. */
function comZ(es) { var num = 0, den = 0; for (var z = 0; z < es.length; z++) { num += z * es[z]; den += es[z]; } return den > 0 ? num / den : -1; }

/* ── reg: D=1 에선 kStarRise 값이 비트 동일을 안 깬다(D−1=0 → 상승 0·discCells3(z=0,D=1)≡discCells). 전체 스택을 굴려 확인. ── */
function reg(seed) {
  function go(kRise) {
    var s = ENG.createSim(seed, {
      D: 1, initE: 1.0, noise: 0.5, drive: true,
      source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
      kD: 0.2, kEvap: 0.001, kA: 0.45, aggMc: 1.1, aggW: 0.7, baseCost: 0.05,
      kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0,
      kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20,
      kCrowd: 0.20, kFSM: 1, kFlux: 1, kTemplate: 1, kInherit: 1, kStarRise: kRise
    });
    ENG.run(s, 800); return ENG.hashState(s);
  }
  var h0 = go(0), h1 = go(1);
  return { seed: seed, hashRise0: h0, hashRise1: h1, pass: h0 === h1 };
}

/* ── sun: 가설 — 부력이 별을 하늘로 띄워 高z 에서 E 를 뿜는다(바닥 방출 vs 하늘 방출). ── */
function sun(seed) {
  var D = 8, TICK = 200;
  /* 상승 off(kStarRise=0): 별이 z=0 에 머물러 E 바닥에만. on(kStarRise=1): 별이 천장(z=7)까지 떠올라 E 위에. */
  function go(kRise) {
    var s = ENG.createSim(seed, sunArena({ kStarRise: kRise })); seedSunCore(s);
    var maxZ = 0;
    for (var t = 0; t < TICK; t++) { ENG.run(s, 1); for (var i = 0; i < s.stars.length; i++) { var z = s.stars[i].z || 0; if (z > maxZ) maxZ = z; } }
    var es = planeEsums(s, D), tot = es.reduce(function (a, b) { return a + b; }, 0);
    return { maxStarZ: maxZ, comEz: comZ(es), topFrac: tot > 0 ? es[D - 1] / tot : 0, botFrac: tot > 0 ? es[0] / tot : 0 };
  }
  var off = go(0), on = go(1);
  return {
    seed: seed, maxZoff: off.maxStarZ, maxZon: on.maxStarZ, comOff: off.comEz, comOn: on.comEz, topOff: off.topFrac, topOn: on.topFrac, botOff: off.botFrac, botOn: on.botFrac,
    /* 상승 on: 별이 천장(z=7)까지·E 무게중심 高z(>5)·천장 분율 큼·바닥 분율 ≈0. off: 별 z=0·E 바닥(무게중심 0·바닥 분율 ≈1). */
    pass: off.maxStarZ === 0 && on.maxStarZ === D - 1 && off.comEz < 0.01 && on.comEz > 5.0 && on.topFrac > 0.4 && off.botFrac > 0.99
  };
}

/* ── conserve: D=8 부력에서 닫힌 장부 잔차(상승은 위치만·거래 0; 방출은 fuel→E 외부 경계 injected 추적). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, sunArena()); seedSunCore(sim); ENG.run(sim, 200);
  var L = ENG.ledger(sim), es = planeEsums(sim, 8);
  return { seed: seed, residual: L.residual, sumE: L.sumE, injected: sim.injected, comEz: comZ(es), pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, sunArena()); seedSunCore(s); ENG.run(s, 200); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashRise0', 'hashRise1', 'pass']);
    console.log('회귀 0: D=1 에선 kStarRise=0 과 1 이 비트 동일(D−1=0 → st.z<0 거짓 = 상승 0·discCells3(cz=0,D=1)≡discCells 2D). *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 D=1 시나리오)가 권위 — 비트 불변 확인.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'sun') {
    var rb = seeds.map(sun); table(rb, ['seed', 'maxZoff', 'maxZon', 'comOff', 'comOn', 'topOn', 'botOn', 'pass']);
    console.log('부력이 별을 하늘로 띄워 高z 에서 E 를 뿜는다: z=0 R 핵에서 점화 → 상승 off 면 별이 z=' + avg(rb, 'maxZoff').toFixed(0) + ' 에 머물러 E 가 바닥에만(E 무게중심 z=' + avg(rb, 'comOff').toFixed(2) + '·바닥 분율 ' + (avg(rb, 'botOff') * 100).toFixed(1) + '%) → 상승 on 이면 별이 천장(z=' + avg(rb, 'maxZon').toFixed(0) + ')까지 떠올라 E 가 위에(E 무게중심 z=' + avg(rb, 'comOn').toFixed(2) + '·천장 분율 ' + (avg(rb, 'topOn') * 100).toFixed(1) + '%) = 태양. 소산 극단(별)이 떠오름 — step-0034 저장 극단(R) 침강의 짝(활성도 축이 연직축). 중력(V3)을 켜면 이 高z E 가 비처럼 내린다(별도 검증).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'injected', 'comEz', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 부력 — 상승은 별 *위치*만[거래 0], 방출은 fuel→E 외부 경계[injected 추적]·닫힌 장부 유지. E 무게중심 z=' + avg(rc, 'comEz').toFixed(2) + ' — 별이 하늘서 뿜음).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(별 부력도 결정론 보존 — Math.random 0, 방향은 법칙 상수).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'sun', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
