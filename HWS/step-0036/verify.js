/* HWS step-0036 헤드리스 검증 — 별 하강·일생(VOXEL.md V5+: 별 부력이 *활성도[연료 잔량]의 함수*가 된다. 0035 의 on/off 상승을 *연직 궤적*으로 완성 — 태어나 떠올랐다 식으며 진다 = 일출·일몰).
 * 새 노브(law-pipeline): ignite 법칙에 하강(연료 쇠퇴 시 침강) z-항. 노브 1개(kStarFall) + 딸린 문턱 starFallThresh + LAW_ORDER 무변경(ignite 제자리 확장, 0035 부력 위에 얹음).
 *   변경점: DEFAULTS.kStarFall(하강 게이트, 기본 0)·starFallThresh(하강 개시 연료 분율, 기본 0.5) · 연료 < starFuel0·starFallThresh 인 *죽어가는* 별이 매 tick z 한 칸씩 가라앉으며(z=0 까지) 그 z 에서 계속 방출.
 *   kStarFall=0 이면 dying 늘 false → 상승 분기 `!dying` 항상 참(0035 무변경)·하강 분기 미진입(회귀 0·fall@ 가법 skip·골든 무관). D=1 이면 st.z=0 고정(상승도 하강도 z 벽에 막힘) = 비트 동일(이중 가드). 상승(kStarRise) 위에 얹힘 — 떠오른 별(st.z 존재)만 진다.
 *
 * 사용: node step-0036/verify.js <reg|set|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kStarFall 값 무관 비트 동일(st.z=0 고정 → 하강도 막힘·상승도 막힘). *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든 해시(전 D=1 시나리오 std@~sun@ 비트 불변)가 권위.
 *  - set      : 가설 — *연료 쇠퇴가 별의 부력을 꺼 다시 가라앉힌다(일몰)*. z=0 R 핵에서 별 점화(중력 off 로 격리):
 *               하강 off 면 별이 천장(z=D−1)까지 떠올라 *거기 머문다*(최종 z=D−1·E 무게중심 高z) — 하강 on 이면 연료가 절반 아래로 쇠하면 다시 *바닥까지 가라앉는다*(최고 z=D−1 찍고 최종 z=0·하강 중 방출로 E 무게중심 끌려 내려옴) = 일출·일몰.
 *  - conserve : 보존 — D=8 하강에서 닫힌 장부 잔차 < 1e-11(하강도 별 *위치*만 — 거래 0. 방출은 fuel→E 외부 경계, injected 추적).
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
/* 별 하강·일생 아레나(골든 fall@ 와 동일) — sunArena 위에 하강(kStarFall=1·starFallThresh=0.5)을 켠다. */
function fallArena(extra) { return sunArena(Object.assign({ kStarFall: 1, starFallThresh: 0.5 }, extra || {})); }
/* z=0 정적 R 핵(점화 신호 — 별이 여기서 태어나 떠오른다). R 은 E0(장부 baseline)에 산입. verify-sim-engine.js seedSunCore() 와 동일. */
var SUN_RVAL = 2.0;
function seedSunCore(sim) {
  var disc = ENG.discCells(W, H, (W / 2) | 0, (H / 2) | 0, 2);   // z=0 평면 원판(인덱스 y·W+x = z=0; siting 은 2D 라 z=0 핵만 본다)
  for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += SUN_RVAL; sim.E0 += SUN_RVAL; }
}
function planeEsums(sim, D) { var s = []; for (var z = 0; z < D; z++) { var t = 0; for (var k = 0; k < WH; k++) t += sim.E[z * WH + k]; s.push(t); } return s; }
/* E 무게중심 z(평면별 E 합 가중) — 바닥 방출(off)이면 ≈0, 하늘 방출(on)이면 高z. */
function comZ(es) { var num = 0, den = 0; for (var z = 0; z < es.length; z++) { num += z * es[z]; den += es[z]; } return den > 0 ? num / den : -1; }

/* ── reg: D=1 에선 kStarFall 값이 비트 동일을 안 깬다(st.z=0 고정 → 상승도 하강도 z 벽에 막힘). 전체 스택을 굴려 확인. ── */
function reg(seed) {
  function go(kFall) {
    var s = ENG.createSim(seed, {
      D: 1, initE: 1.0, noise: 0.5, drive: true,
      source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
      kD: 0.2, kEvap: 0.001, kA: 0.45, aggMc: 1.1, aggW: 0.7, baseCost: 0.05,
      kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0,
      kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20,
      kCrowd: 0.20, kFSM: 1, kFlux: 1, kTemplate: 1, kInherit: 1, kStarRise: 1, kStarFall: kFall, starFallThresh: 0.5
    });
    ENG.run(s, 800); return ENG.hashState(s);
  }
  var h0 = go(0), h1 = go(1);
  return { seed: seed, hashFall0: h0, hashFall1: h1, pass: h0 === h1 };
}

/* ── set: 가설 — 연료 쇠퇴가 별의 부력을 꺼 다시 가라앉힌다(일출·일몰). 하강 off=천장 머묾 vs on=떠올랐다 가라앉음. ── */
function set(seed) {
  var D = 8, TICK = 200;
  /* 하강 off(kStarFall=0): 별이 천장(z=7)까지 떠올라 *거기 머문다*. on(kStarFall=1): 연료 쇠하면 다시 바닥(z=0)까지 가라앉는다. */
  function go(kFall) {
    var s = ENG.createSim(seed, fallArena({ kStarFall: kFall })); seedSunCore(s);
    var maxZ = 0;
    for (var t = 0; t < TICK; t++) { ENG.run(s, 1); for (var i = 0; i < s.stars.length; i++) { var z = s.stars[i].z || 0; if (z > maxZ) maxZ = z; } }
    var fz = s.stars.length ? (s.stars[0].z || 0) : -1, es = planeEsums(s, D);
    return { maxStarZ: maxZ, finalStarZ: fz, comEz: comZ(es) };
  }
  var off = go(0), on = go(1);
  return {
    seed: seed, maxZoff: off.maxStarZ, maxZon: on.maxStarZ, finalZoff: off.finalStarZ, finalZon: on.finalStarZ, comOff: off.comEz, comOn: on.comEz,
    /* 둘 다 천장(z=7)까지 떠오른다(maxZ=7). off: 거기 머문다(최종 z=7·E 무게중심 高z). on: 연료 쇠해 바닥까지 진다(최종 z=0·하강 방출로 E 무게중심 끌려 내려옴). */
    pass: off.maxStarZ === D - 1 && on.maxStarZ === D - 1 && off.finalStarZ === D - 1 && on.finalStarZ === 0 && on.comEz < off.comEz
  };
}

/* ── conserve: D=8 하강에서 닫힌 장부 잔차(하강은 위치만·거래 0; 방출은 fuel→E 외부 경계 injected 추적). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, fallArena()); seedSunCore(sim); ENG.run(sim, 200);
  var L = ENG.ledger(sim), es = planeEsums(sim, 8);
  return { seed: seed, residual: L.residual, sumE: L.sumE, injected: sim.injected, comEz: comZ(es), pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, fallArena()); seedSunCore(s); ENG.run(s, 200); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashFall0', 'hashFall1', 'pass']);
    console.log('회귀 0: D=1 에선 kStarFall=0 과 1 이 비트 동일(st.z=0 고정 → 상승도 하강도 z 벽에 막힘). *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 D=1 시나리오)가 권위 — 비트 불변 확인.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'set') {
    var rb = seeds.map(set); table(rb, ['seed', 'maxZoff', 'maxZon', 'finalZoff', 'finalZon', 'comOff', 'comOn', 'pass']);
    console.log('연료 쇠퇴가 별의 부력을 꺼 다시 가라앉힌다(일출·일몰): z=0 R 핵에서 점화 → 둘 다 천장(z=' + avg(rb, 'maxZon').toFixed(0) + ')까지 떠오르나 → 하강 off 면 거기 머물고(최종 z=' + avg(rb, 'finalZoff').toFixed(0) + '·E 무게중심 z=' + avg(rb, 'comOff').toFixed(2) + ') → 하강 on 이면 연료가 절반 아래로 쇠해 다시 바닥(최종 z=' + avg(rb, 'finalZon').toFixed(0) + ')까지 가라앉으며 방출(E 무게중심 z=' + avg(rb, 'comOn').toFixed(2) + ' < off). 부력 = 활성도(연료)의 함수 — 활성도 연속축이 *연직 궤적*(出·沒)으로 완성. step-0035 on/off 상승의 *시간축 닫음*.');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'injected', 'comEz', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 하강 — 하강은 별 *위치*만[거래 0], 방출은 fuel→E 외부 경계[injected 추적]·닫힌 장부 유지. E 무게중심 z=' + avg(rc, 'comEz').toFixed(2) + ' — 별이 떴다 지며 뿜음).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(별 하강도 결정론 보존 — Math.random 0, 방향은 법칙 상수).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'set', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
