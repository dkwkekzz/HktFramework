/* HWS step-0045 헤드리스 검증 — 3D 차등 응집(adhere 의 kin 정렬을 연직축으로, VOXEL.md V5+).
 * 0042·0043 이 생명을 z>0 에 올렸다(이동·번식으로 3D 거주). 그러나 차등 응집(adhere, step-0017 = 다세포 kin 정렬)은 여전히 2D 평면만 봤다 —
 *   occ 그리드가 W·H(2D)·이동 후보 4-이웃·kin 점수 8-이웃(Moore 평면)이라 z>0 생명은 occ[a.center] 가 범위 밖이라 *무시*됐다. 그래서 z>0 에 올라온 생명은
 *   서로 위/아래(z±1) kin 을 못 세 *정렬을 못 했다*(다세포 액적이 2D 평면에 갇힘 = 3D 다세포 누수). 0044 가 crowd 만 z-일반화했고 adhere 는 caveat 로 남아 있었다.
 *   이 step 은 adhere 의 occ 그리드 W·H→W·H·D·이동 후보 4→6-이웃·kin 점수 셈 8(Moore 평면)→26(Moore 3D) 로 *제자리 일반화*한다(0044 crowd kCrowdZ 와 같은 형식) + 노브 kAdhereZ:
 *   z>0 으로 올라온 생명도 제 z±이웃 kin 을 세 정렬한다 = 같은 유전형이 3D 액적으로 뭉침(cell sorting 의 연직 일반화·Steinberg DAH 의 3D 짝).
 *   회귀(이중 가드): kAdhereZ=0 → 3D 블록 미진입(2D 경로·직전 step 비트 동일·z≥1 생명은 occ 범위 밖이라 정렬 못 해 *얼어붙음*) / D=1 → z 이웃 없어 2D 등가.
 *
 * 사용: node step-0045/verify.js <reg|sort|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kAdhereZ=0 → z≥1 거주 생명이 2D occ 범위 밖이라 정렬 0(이동 0·얼어붙음)·2회 실행 비트 동일. *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든(전 시나리오 std@~cap3@ 비트 불변 — 새 노브=0 → 2D 경로)이 권위.
 *  - sort     : 가설 — *z>0 거주 생명이 3D 에서 kin 정렬한다(연직 cell sorting)*. kAdhereZ off vs on 비교: off 면
 *               2D occ 가 z>0 을 무시해 정렬 0(kin 접촉 초기값 그대로·얼어붙음) → on 이면 z±이웃 kin 을 세 정렬해 kin 접촉이 오른다(같은 태그가 3D 로 뭉침).
 *  - conserve : 보존 — adhere 는 *위치만* 바꿈(E·R·m 거래 0) — 닫힌 장부 잔차 < 1e-11(2D adhere 와 같은 경계).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — 위치 x·y·z 가 정렬을 반영).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');
var K = require('../engine/hws-kernel.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H, DZ = 8;

/* kin 접촉 셈용 26-이웃(Moore 3D) — verify 측정 전용(법칙의 ADHERE_NB26 와 같은 집합). */
var NB26 = (function () { var a = []; for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { if (dx || dy || dz) a.push([dx, dy, dz]); } return a; })();

/* 3D 차등 응집 아레나 — verify-sim-engine.js sortArena() 와 동일 상수(골든 adh3@ 와 일치).
 * D=8 voxel. 생명 외 모든 동역학 off(이동·번식·흡수·대사·혼잡 다 off → 위치는 *adhere 정렬*로만 바뀜). adhere 만 켜고 kAdhereZ 토글.
 * 생명을 *z≥1 의 3D 블록*(두 유전형이 z-체커보드로 섞임·빈칸 여유)에 둔다 — z=0 평면엔 안 둬 2D 경로(off)가 깨끗한 no-op(occ 범위 밖이라 정렬 0). */
function sortArena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0, crowdR: 3, kCrowdZ: 0,
    kAdhesion: 1, adhesionLambda: 1.0, adhesionGain: 0.5, kAdhereZ: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 균일 E 장 + 두 유전형 생명을 z≥1 3D 블록에 *z-체커보드*로 섞어 둔다(빈칸 여유로 정렬 공간 확보).
 * 블록: x∈[12,24)·y∈[12,24)·z∈[1,7)(z=0 평면엔 안 둠 → 2D 경로가 no-op). 약 60% 채움(결정론적 패턴, 시드 무관 = 정적 배치).
 * 태그 = 1 + ((x+y+z)&1)(체커보드 → 초기 kin 접촉 낮음·이웃이 주로 이종) → adhere 가 같은 태그를 3D 로 뭉쳐 kin 접촉을 올린다. */
function seedKinBlock(sim) {
  var E = sim.E, D = sim.p.D, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 2; sim.E0 += 2; }                       // 균일 E=2(생명 m=1 끌어와도 남음)
  for (var z = 1; z < 7; z++) for (var y = 12; y < 24; y++) for (var x = 12; x < 24; x++) {
    if (((x * 3 + y * 5 + z * 7) % 5) >= 3) continue;                          // ≈60% 채움(결정론적 — 정적 배치·시드 무관)
    var center = z * WH + y * W + x, tag = 1 + ((x + y + z) & 1);              // z-체커보드 태그(초기 이종 이웃 多 = kin 접촉 낮음)
    var seedM = sim.E[center] < 1 ? sim.E[center] : 1;
    sim.E[center] -= seedM;                                                    // m 은 제 칸 E 에서(닫힌 장부)
    sim.agents.push({ x: x, y: y, z: z, m: seedM, g: tag, cells: [center], center: center, bornTick: sim.tick });
  }
  return sim.agents.length;
}
/* 3D kin 접촉 분율 = (같은 태그 이웃 접촉 수) / (전체 점유 이웃 접촉 수) — 26-이웃(Moore 3D)·z 벽. 정렬되면 오른다. */
function kinContact3(sim) {
  var ag = sim.agents, W2 = sim.p.W, H2 = sim.p.H, D = sim.p.D, WH2 = W2 * H2, N = WH2 * D;
  var occ = new Int16Array(N); occ.fill(-1);
  for (var i = 0; i < ag.length; i++) occ[ag[i].center] = ag[i].g | 0;
  var kinSum = 0, totSum = 0;
  for (var k = 0; k < ag.length; k++) {
    var a = ag[k], t = a.g | 0, az = a.z || 0; if (t <= 0) continue;
    for (var d = 0; d < 26; d++) {
      var nz = az + NB26[d][2]; if (nz < 0 || nz >= D) continue;
      var nx = (a.x + NB26[d][0] + W2) % W2, ny = (a.y + NB26[d][1] + H2) % H2, o = occ[nz * WH2 + ny * W2 + nx];
      if (o <= 0) continue;                                                    // 빈칸(-1)·무유전(0) 제외
      totSum++; if (o === t) kinSum++;
    }
  }
  return totSum > 0 ? kinSum / totSum : 0;
}
function build(seed, kAZ, ticks) { var s = ENG.createSim(seed, sortArena({ kAdhereZ: kAZ })); seedKinBlock(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }
var TICKS = 40;

/* ── reg: 회귀 0 — kAdhereZ=0 → z≥1 거주 생명이 2D occ 범위 밖이라 정렬 0(이동 0·얼어붙음)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, adheres: a.adheres, kc: kinContact3(a), hashA: ha, hashB: hb, pass: ha === hb && a.adheres === 0 };
}

/* ── sort: 가설 — z>0 거주 생명이 3D 에서 kin 정렬한다(연직 cell sorting). kAdhereZ off vs on 비교. ── */
function sort(seed) {
  var init = ENG.createSim(seed, sortArena({ kAdhereZ: 1 })); seedKinBlock(init);     // 0 tick = 초기 kin 접촉(섞인 상태)
  var off = build(seed, 0, TICKS), on = build(seed, 1, TICKS);
  var kc0 = kinContact3(init), kcOff = kinContact3(off), kcOn = kinContact3(on);
  return {
    seed: seed, kc0: kc0, kcOff: kcOff, kcOn: kcOn, adheresOff: off.adheres, adheresOn: on.adheres,
    /* off: 2D 가 z>0 무시 → 정렬 0(kc 초기값 그대로). on: z±이웃 kin 정렬 → kc 상승. */
    pass: off.adheres === 0 && on.adheres > 0 && kcOn > kc0 && kcOn > kcOff
  };
}

/* ── conserve: adhere 는 위치만 바꿈(E·R·m 거래 0) — 닫힌 장부 잔차(2D adhere 와 같은 경계). ── */
function conserve(seed) {
  var s = build(seed, 1, TICKS);
  var L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, adheres: s.adheres, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(위치 x·y·z 가 정렬을 반영·moveZInit→a.z 해싱). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 1, TICKS)), hb = ENG.hashState(build(seed, 1, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'adheres', 'kc', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kAdhereZ=0 → z≥1 거주 생명이 2D occ 범위 밖이라 정렬 0(이동 0·얼어붙음 — 옛 2D adhere 가 z>0 생명을 못 정렬하던 그 caveat)·2회 실행 비트 동일. 이 step 은 adhere *제자리 확장*(0044 crowd kCrowdZ 와 같은 형식·새 LAW_ORDER 자리 없음) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~cap3@ 비트 불변·새 노브=0→2D 경로)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'sort') {
    var rb = seeds.map(sort); table(rb, ['seed', 'kc0', 'kcOff', 'kcOn', 'adheresOff', 'adheresOn', 'pass']);
    console.log('z>0 거주 생명이 3D 에서 kin 정렬한다(차등 응집의 연직축 일반화·Steinberg DAH 의 3D 짝): D=8·두 유전형 z-체커보드 블록(z∈[1,7))·adhere 만 on — kAdhereZ OFF 면 2D occ 가 z>0 을 무시해 정렬 ' + avg(rb, 'adheresOff').toFixed(0) + '(kin 접촉 ' + avg(rb, 'kcOff').toFixed(3) + ' = 초기값 ' + avg(rb, 'kc0').toFixed(3) + ' 그대로·얼어붙음) → ON 이면 z±이웃 kin 을 세 ' + avg(rb, 'adheresOn').toFixed(0) + '회 정렬해 kin 접촉 ' + avg(rb, 'kc0').toFixed(3) + ' → ' + avg(rb, 'kcOn').toFixed(3) + ' 로 오른다 = 같은 태그가 3D 액적으로 뭉침. adhere 의 occ W·H→W·H·D·이동 4→6-이웃·점수 8→26-이웃 일반화. 위치만(장부 거래 0).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'adheres', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (adhere 는 *위치만* 바꾼다[E·R·m 거래 0] — 2D adhere 와 같은 닫힌 장부 경계. 3D 정렬 ' + avg(rc, 'adheres').toFixed(0) + '회가 일어나도 장부 불변).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(위치 x·y·z 가 3D 정렬을 반영·moveZInit→a.z 가법 해싱·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'sort', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
