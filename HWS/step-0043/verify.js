/* HWS step-0043 헤드리스 검증 — 3D 번식: 자식의 연직 출생(VOXEL.md V5+ — 생명이 *번식으로* 3D 를 오른다).
 * 0042 가 생명의 *이동*을 z 로 풀었다(개체가 에너지를 향해 올라감). 그러나 번식은 여전히 자식을 z=0 평면에 떨궜다 — 부모가 z>0 으로 올라가도 자식이 바닥으로 추락.
 *   이 step 은 reproduce 의 자식 배치를 4-이웃[2D 평면]→6-이웃[3D]으로 일반화한다: 부모 z-평면 + 위/아래(z±1) 후보 중 E 최고 칸에 자식을 둔다(번식이 연직축으로).
 *   연직 E 구배가 있으면 자식이 *더 높은 에너지 쪽(위)에 태어난다* → 개체군이 *번식으로* 상승한다(0042 의 *이동* 상승과 짝 — 다세포가 substrate 위에 탑승하는 두 경로).
 * 이 step 은 `reproduce` 법칙을 *제자리 확장*한다(move 의 kMoveZ z-이동과 같은 형식 — 새 LAW_ORDER 자리 없음) + 노브 `kDivZ` 1개.
 *   회귀(이중 가드): kDivZ=0 → pz 강제 0 → 자식 인덱스가 기존 2D 와 비트 동일(자식이 z=0 평면)·agent.z 미설정→해시 skip / D=1 → z±1 이 z 벽 밖이라 후보 0.
 *
 * 사용: node step-0043/verify.js <reg|climb|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kDivZ=0 → 자식이 z=0 평면에만 태어남(maxZ=0)·2회 실행 비트 동일. *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든(전 시나리오 std@~mvz@ 비트 불변 — 새 노브=0 → 2D 경로)이 권위.
 *  - climb    : 가설 — *연직 E 구배가 있으면 자식이 위로 태어나 개체군이 번식으로 상승한다*. kDivZ off vs on 비교: off 면
 *               자식이 z=0 평면에 갇힘(maxZ=0·meanZ=0) → on 이면 자식이 천장(z=D−1)까지 줄지어 태어난다(maxZ→D−1·meanZ↑) = 번식이 연직축으로 일반화.
 *  - conserve : 보존 — 3D 번식은 m 만 반분(쌍 거래 보존)·위치만(E·R 안 건드림) — 닫힌 장부 잔차 < 1e-11.
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — agent.z 포함, moveZInit 가법 해시).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H, DZ = 8;

/* 3D 번식 아레나 — verify-sim-engine.js div3Arena() 와 동일 상수(골든 div3@ 와 일치).
 * D=8 voxel, 정적 연직 E 구배(E(z)=1+z — 위로 갈수록 높음·정적: 확산·중력·대사 다 off 라 안 변함), z=0 평면에 생명 9 마리(3×3 distinct x,y).
 * 순수 z-번식 격리(흡수 kL=0·대사 0·이동 off → 구배 불변·생명 안 죽음·*번식만* z 를 바꾼다). mDiv 작게(분열 여러 세대 → 위로 줄지어). kDivZ 만 토글. */
function div3Arena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: true, mDiv: 0.005, divR: 1, popCap: 4096, kDivZ: 0,
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
/* z=0 평면에 생명 9 마리 — distinct (x,y) 3×3 격자(각자 제 기둥을 독립으로 오른다). */
function seedLife(sim) {
  for (var gx = 0; gx < 3; gx++) for (var gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 16 + gx * 6, 16 + gy * 6);
  return sim.agents.length;
}
function meanZ(sim) { var ag = sim.agents, s = 0; for (var k = 0; k < ag.length; k++) s += (ag[k].z || 0); return ag.length ? s / ag.length : 0; }
function maxZ(sim) { var ag = sim.agents, m = 0; for (var k = 0; k < ag.length; k++) { var z = ag[k].z || 0; if (z > m) m = z; } return m; }
function aboveFrac(sim) { var ag = sim.agents, n = 0; for (var k = 0; k < ag.length; k++) if ((ag[k].z || 0) > 0) n++; return ag.length ? n / ag.length : 0; }
function build(seed, kDZ) { var s = ENG.createSim(seed, div3Arena({ kDivZ: kDZ })); seedGradient(s); seedLife(s); return s; }

/* ── reg: 회귀 0 — kDivZ=0 → 자식 연직 후보 미진입 → 자식이 z=0 평면에만 태어남(maxZ=0)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0); for (var t = 0; t < 30; t++) ENG.step(a);
  var b = build(seed, 0); for (var u = 0; u < 30; u++) ENG.step(b);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, maxZ: maxZ(a), hashA: ha, hashB: hb, pass: ha === hb && maxZ(a) === 0 };
}

/* ── climb: 가설 — 연직 E 구배가 있으면 자식이 위로 태어나 개체군이 번식으로 상승한다. kDivZ off vs on 비교. ── */
function climb(seed) {
  function go(kDZ) { var s = build(seed, kDZ); for (var t = 0; t < 30; t++) ENG.step(s); return { maxZ: maxZ(s), meanZ: meanZ(s), above: aboveFrac(s), pop: s.agents.length }; }
  var off = go(0), on = go(1), top = DZ - 1;
  return {
    seed: seed, maxZoff: off.maxZ, maxZon: on.maxZ, meanZon: on.meanZ, aboveOn: on.above, popOn: on.pop,
    /* off: z=0 평면 갇힘(maxZ=0·meanZ=0). on: 천장(z=7)까지 줄지어 태어남(maxZ→7·일부 z>0). */
    pass: off.maxZ === 0 && on.maxZ >= top && on.meanZ > 0 && on.above > 0
  };
}

/* ── conserve: 3D 번식은 m 만 반분(쌍 거래)·위치만 — 닫힌 장부 잔차(reproduce 는 E·R 안 건드림). ── */
function conserve(seed) {
  var s = build(seed, 1); for (var t = 0; t < 30; t++) ENG.step(s);
  var L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, maxZ: maxZ(s), pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(agent.z 포함 — moveZInit 가법 해시·reproduce 가 설정). ── */
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
    var rr = seeds.map(reg); table(rr, ['seed', 'maxZ', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kDivZ=0 → 자식 연직 후보 미진입 → 자식이 z=0 평면에만 태어남(maxZ=0)·2회 실행 비트 동일. 이 step 은 reproduce *제자리 확장*(move kMoveZ 와 같은 형식·새 LAW_ORDER 자리 없음) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~mvz@ 비트 불변·새 노브=0→2D 경로)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'climb') {
    var rb = seeds.map(climb); table(rb, ['seed', 'maxZoff', 'maxZon', 'meanZon', 'aboveOn', 'popOn', 'pass']);
    console.log('연직 E 구배가 있으면 자식이 위로 태어나 개체군이 *번식으로* 상승한다(번식의 연직축 일반화·SPINE 다섯째 축 — 다세포가 3D 순환에 번식으로 탑승): 정적 구배 E(z)=1+z 에서 z=0 평면 생명 9 마리가 — kDivZ OFF 면 자식이 z=0 평면에 갇혀 안 오름(maxZ ' + avg(rb, 'maxZoff').toFixed(2) + ') → ON 이면 자식이 천장(z=7)까지 줄지어 태어난다(maxZ ' + avg(rb, 'maxZon').toFixed(2) + '·meanZ ' + avg(rb, 'meanZon').toFixed(2) + '·z>0 분율 ' + avg(rb, 'aboveOn').toFixed(2) + '). reproduce 의 자식 배치가 4-이웃[2D]→6-이웃[3D]으로 일반화 = 번식이 *연직축*으로. m 만 반분(쌍 거래 보존)·위치만(장부 거래 0).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'maxZ', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (3D 번식은 m 만 반분[쌍 거래 보존]·위치만 — reproduce 는 E·R 을 안 건드린다. 자식이 z=0→' + avg(rc, 'maxZ').toFixed(2) + ' 까지 줄지어 태어나도 닫힌 장부 불변).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(agent.z 포함 — moveZInit 가법 해시·reproduce 가 설정·Math.random 0).');
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
