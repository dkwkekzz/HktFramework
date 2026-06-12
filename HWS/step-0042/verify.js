/* HWS step-0042 헤드리스 검증 — 생명 z-이동: 주화성의 연직축 일반화(VOXEL.md V5+ — 생명이 3D 순환의 승객으로 오른다).
 * 0035~0041 이 에너지(별→빛→비→바다→지면→새 별)와 물질(쌓임↔풍화)을 둘 다 완전 순환 고리로 닫았다. 그 3D 세계 위를 *생명*이 산다 —
 *   그런데 0041 까지 생명은 z=0 평면에만 갇혀 있었다(move 가 4-이웃[2D]만 봄). 이 step 은 move 의 주화성(run)을 *6-이웃*으로 일반화한다:
 *   생명이 제 (x,y) 의 위/아래(z±1) 이웃 E 도 비교해 *더 높은 에너지를 향해 오른다/내린다* = 연직 주화성. 에너지·물질 고리가 닫혔으니
 *   이제 생명이 그 순환의 *승객*으로 연직 에너지(천장의 별빛·바닥의 바다)를 쫓아 3D 를 오른다(SPINE 다섯째 축 — 생명이 substrate 위에 탑승).
 * 이 step 은 `move` 법칙을 *제자리 확장*한다(ignite 의 kStarRise z-확장과 같은 형식 — 새 LAW_ORDER 자리 없음) + 노브 `kMoveZ` 1개.
 *   회귀(이중 가드): kMoveZ=0 → z 이웃 후보 미진입(생명이 z=0 평면에만·move 가 2D 이웃만 = 직전 step 비트 동일·agent.z 미설정→해시 skip) / D=1 → z±1 이 z 벽 밖이라 후보 0.
 *
 * 사용: node step-0042/verify.js <reg|climb|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kMoveZ=0 → 생명이 z=0 평면에 갇힘(meanZ=0)·2회 실행 비트 동일. *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든(전 시나리오 std@~weq@ 비트 불변 — 새 노브=0 → 2D 경로)이 권위.
 *  - climb    : 가설 — *연직 E 구배가 있으면 생명이 위로 오른다*. kMoveZ off vs on 비교: off 면 z=0 평면에 갇힘(meanZ=0)·
 *               on 이면 천장(z=D−1)까지 오른다(meanZ→D−1·꼭대기 분율→1) = 주화성이 연직축으로 일반화.
 *  - conserve : 보존 — z-이동은 위치만(장부 거래 0) — 닫힌 장부 잔차 < 1e-11(move 는 E·R 을 안 건드림).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — agent.z 포함).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H, DZ = 8;

/* 생명 z-이동 3D 아레나 — verify-sim-engine.js mvzArena() 와 동일 상수(골든 mvz@ 와 일치).
 * D=8 voxel, 연직 E 구배(E(z)=1+z — 위로 갈수록 높음·정적: 확산·중력·대사 다 off 라 안 변함), z=0 평면에 생명 9 마리(3×3 distinct x,y).
 * 순수 z-주화성 격리(흡수 kL=0·대사 0 → 구배 불변·생명 안 죽음·번식 off → 각자 제 기둥을 오른다). kMoveZ 만 토글. */
function mvzArena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, kL: 0, lifeR: 0,
    life: true, move: true, repro: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 정적 연직 E 구배 — E(z)=1+z (위로 갈수록 높음). 확산·중력·대사 다 off 라 안 변함(정적). E0 장부 baseline 에 산입. */
function seedGradient(sim) {
  var E = sim.E, D = sim.p.D;
  for (var z = 0; z < D; z++) { var base = 1 + z; for (var i = 0; i < WH; i++) { E[z * WH + i] = base; sim.E0 += base; } }
}
/* z=0 평면에 생명 9 마리 — distinct (x,y) 3×3 격자(각자 제 기둥을 독립으로 오른다·서로 안 막힘). */
function seedLife(sim) {
  for (var gx = 0; gx < 3; gx++) for (var gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 20 + gx * 4, 20 + gy * 4);
  return sim.agents.length;
}
function meanZ(sim) { var ag = sim.agents, s = 0; for (var k = 0; k < ag.length; k++) s += (ag[k].z || 0); return ag.length ? s / ag.length : 0; }
function topFrac(sim) { var ag = sim.agents, top = sim.p.D - 1, n = 0; for (var k = 0; k < ag.length; k++) if ((ag[k].z || 0) === top) n++; return ag.length ? n / ag.length : 0; }
function build(seed, kMZ) { var s = ENG.createSim(seed, mvzArena({ kMoveZ: kMZ })); seedGradient(s); seedLife(s); return s; }

/* ── reg: 회귀 0 — kMoveZ=0 → z 이웃 후보 미진입 → 생명이 z=0 평면에 갇힘(meanZ=0)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0); for (var t = 0; t < 30; t++) ENG.step(a);
  var b = build(seed, 0); for (var u = 0; u < 30; u++) ENG.step(b);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, meanZ: meanZ(a), hashA: ha, hashB: hb, pass: ha === hb && meanZ(a) === 0 };
}

/* ── climb: 가설 — 연직 E 구배가 있으면 생명이 위로 오른다. kMoveZ off vs on 비교. ── */
function climb(seed) {
  function go(kMZ) { var s = build(seed, kMZ); for (var t = 0; t < 30; t++) ENG.step(s); return { meanZ: meanZ(s), top: topFrac(s), moves: s.moves }; }
  var off = go(0), on = go(1), top = DZ - 1;
  return {
    seed: seed, meanZoff: off.meanZ, meanZon: on.meanZ, topFracOn: on.top, movesOn: on.moves,
    /* off: z=0 평면 갇힘(meanZ=0). on: 천장(z=7)까지 오름(meanZ→7·꼭대기 분율→1). */
    pass: off.meanZ === 0 && on.meanZ > top * 0.8 && on.top > 0.8
  };
}

/* ── conserve: z-이동은 위치만(장부 거래 0) — 닫힌 장부 잔차(move 는 E·R 안 건드림). ── */
function conserve(seed) {
  var s = build(seed, 1); for (var t = 0; t < 30; t++) ENG.step(s);
  var L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, meanZ: meanZ(s), pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(agent.z 포함 — moveZInit 가법 해시). ── */
function det(seed) {
  function go() { var s = build(seed, 1); for (var t = 0; t < 30; t++) ENG.step(s); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'meanZ', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kMoveZ=0 → z 이웃 후보 미진입 → 생명이 z=0 평면에 갇힘(meanZ=0)·2회 실행 비트 동일. 이 step 은 move *제자리 확장*(ignite kStarRise 와 같은 형식·새 LAW_ORDER 자리 없음) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~weq@ 비트 불변·새 노브=0→2D 경로)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'climb') {
    var rb = seeds.map(climb); table(rb, ['seed', 'meanZoff', 'meanZon', 'topFracOn', 'movesOn', 'pass']);
    console.log('연직 E 구배가 있으면 생명이 위로 오른다(주화성의 연직축 일반화·SPINE 다섯째 축 — 생명이 3D 순환의 승객으로): 정적 구배 E(z)=1+z 에서 z=0 평면 생명 9 마리가 — kMoveZ OFF 면 z=0 평면에 갇혀 안 오름(meanZ ' + avg(rb, 'meanZoff').toFixed(2) + ') → ON 이면 천장(z=7)까지 오른다(meanZ ' + avg(rb, 'meanZon').toFixed(2) + '·꼭대기 분율 ' + avg(rb, 'topFracOn').toFixed(2) + '). move 의 run 이 4-이웃[2D]→6-이웃[3D]으로 일반화 = 에너지를 향한 주화성이 *연직축*으로. 위치만(장부 거래 0).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'meanZ', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (z-이동은 위치만 — move 는 E·R 을 안 건드린다, run/tumble 과 같은 경계. 생명이 z=0→' + avg(rc, 'meanZ').toFixed(2) + ' 로 올라도 닫힌 장부 불변).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(agent.z 포함 — moveZInit 가법 해시·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'climb', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
