/* HWS step-0046 헤드리스 검증 — 3D 생물량 공유(share 의 risk-pooling 을 연직축으로, VOXEL.md V5+).
 * 0045 가 z>0 거주 생명을 3D 로 kin 정렬했다(adhere z-일반화 — 같은 유전형이 3D 액적으로 뭉침). 그러나 생물량 공유(share, step-0019 = 굶주린 kin 을 떠받치는 risk-pooling)는 여전히 2D였다 —
 *   occ 그리드가 W·H(2D)·kin 쌍이 우(+x)/하(+y) 4-인접이라 z>0 생명은 occ[a.center] 가 범위 밖이라 *무시*됐다. 그래서 위/아래로 쌓인 kin 은 서로 떠받치지 못했다(3D risk-pooling 누수).
 *   이 step 은 share 의 occ 그리드 W·H→W·H·D·kin 쌍에 위(+z) 추가(4-인접→6-인접) 로 *제자리 일반화*한다(0044 crowd·0045 adhere 와 같은 형식) + 노브 kShareZ:
 *   z>0 굶주린 kin 도 제 z±1 안전 kin 에게 구조된다 = 0045 가 정렬한 3D 액적이 비로소 *단위로* 생존(risk-pooling 의 연직 일반화·step-0019 의 3D 짝).
 *   회귀(이중 가드): kShareZ=0 → 3D 블록 미진입(2D 경로·직전 step 비트 동일·z>0 컬럼 kin 은 occ 범위 밖이라 못 떠받쳐 *얼어붙음*) / D=1 → z 이웃 없어 2D 등가.
 *
 * 사용: node step-0046/verify.js <reg|pool|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kShareZ=0 → z>0 컬럼 kin 이 2D occ 범위 밖이라 구조 0(굶주린 kin 얼어붙음)·2회 실행 비트 동일. *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든(전 시나리오 std@~adh3@ 비트 불변 — 새 노브=0 → 2D 경로)이 권위.
 *  - pool     : 가설 — *z>0 굶주린 kin 이 z±1 안전 kin 에게 구조된다(연직 risk-pooling)*. kShareZ off vs on 비교: off 면
 *               컬럼이 서로 안 닿아 구조 0(굶주린 kin 의 최소 m 초기값 그대로) → on 이면 위/아래 안전 kin 이 떠받쳐 구조>0·최소 m↑.
 *  - conserve : 보존 — 구조는 m 쌍 거래(부유→궁핍) — 닫힌 장부 잔차 < 1e-11(share 는 E·R 안 건드림).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — m 이 구조를 반영).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H, DZ = 8;

/* 3D 생물량 공유 아레나 — verify-sim-engine.js poolArena()/seedKinColumns 와 동일 상수(골든 shr3@ 와 일치).
 * D=8 voxel. 생명 외 모든 동역학 off(이동·번식·흡수·대사세·혼잡·응집 off → m 은 *구조*로만 바뀜). share 만 켜고 kShareZ 토글.
 * 생명을 *수직 kin 컬럼*(같은 (x,y)·같은 태그·z=0..D−1)으로 두되 m 을 z 짝수=안전(1.0)·홀수=궁핍(0.2)으로 — 2D 투영으론 한 칸이라 못 떠받침, 3D 론 z±1 안전 kin 이 궁핍 kin 을 구조. */
function poolArena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0.1, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0, crowdR: 3, kCrowdZ: 0,
    kAdhesion: 0, adhesionLambda: 1.0, adhesionGain: 0.5, kAdhereZ: 0,
    kShare: 0.5, coopFit0: 1.0, coopFitStep: 0.0, kShareZ: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 균일 E 장 + 수직 kin 컬럼 3개(같은 (x,y)·태그 1·z=0..D−1). m: z 짝수=안전(1.0)·홀수=궁핍(0.2<danger=mDeath·3=0.3). 컬럼 간격 6 → 2D 론 컬럼끼리도 안 닿음(순수 연직 risk-pooling 격리). */
function seedKinColumns(sim) {
  var E = sim.E, D = sim.p.D, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 2; sim.E0 += 2; }                 // 균일 E=2(컬럼당 m 끌어와도 남음)
  var cols = [[16, 16], [22, 22], [28, 28]];
  for (var c = 0; c < cols.length; c++) for (var z = 0; z < D; z++) {
    var x = cols[c][0], y = cols[c][1], center = z * WH + y * W + x;
    var want = (z & 1) ? 0.2 : 1.0;                                      // 홀수 z = 궁핍(0.2)·짝수 z = 안전(1.0)
    var seedM = sim.E[center] < want ? sim.E[center] : want;
    sim.E[center] -= seedM;
    sim.agents.push({ x: x, y: y, z: z, m: seedM, g: 1, cells: [center], center: center, bornTick: sim.tick });
  }
  return sim.agents.length;
}
function minM(sim) { var ag = sim.agents, mn = Infinity; for (var k = 0; k < ag.length; k++) if (ag[k].m < mn) mn = ag[k].m; return ag.length ? mn : 0; }
function build(seed, kSZ, ticks) { var s = ENG.createSim(seed, poolArena({ kShareZ: kSZ })); seedKinColumns(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }
var TICKS = 8;

/* ── reg: 회귀 0 — kShareZ=0 → z>0 컬럼 kin 이 2D occ 범위 밖이라 구조 0(굶주린 kin 얼어붙음)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, shared: a.shared, minM: minM(a), hashA: ha, hashB: hb, pass: ha === hb && a.shared === 0 };
}

/* ── pool: 가설 — z>0 굶주린 kin 이 z±1 안전 kin 에게 구조된다(연직 risk-pooling). kShareZ off vs on 비교. ── */
function pool(seed) {
  var off = build(seed, 0, TICKS), on = build(seed, 1, TICKS);
  return {
    seed: seed, sharedOff: off.shared, sharedOn: on.shared, minMoff: minM(off), minMon: minM(on),
    /* off: 컬럼이 서로 안 닿아 구조 0(최소 m 0.2 그대로). on: z±1 안전 kin 이 떠받쳐 구조>0·최소 m↑. */
    pass: off.shared === 0 && on.shared > 0 && minM(on) > minM(off)
  };
}

/* ── conserve: 구조는 m 쌍 거래(부유→궁핍) — 닫힌 장부 잔차(share 는 E·R 안 건드림). ── */
function conserve(seed) {
  var s = build(seed, 1, TICKS);
  var L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, shared: s.shared, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(m 이 구조를 반영). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 1, TICKS)), hb = ENG.hashState(build(seed, 1, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'shared', 'minM', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kShareZ=0 → z>0 컬럼 kin 이 2D occ 범위 밖이라 구조 0(굶주린 kin 얼어붙음 — 옛 2D share 가 z>0 kin 을 못 떠받치던 그 caveat)·2회 실행 비트 동일. 이 step 은 share *제자리 확장*(0044 crowd·0045 adhere 와 같은 형식·새 LAW_ORDER 자리 없음) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~adh3@ 비트 불변·새 노브=0→2D 경로)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'pool') {
    var rb = seeds.map(pool); table(rb, ['seed', 'sharedOff', 'sharedOn', 'minMoff', 'minMon', 'pass']);
    console.log('z>0 굶주린 kin 이 z±1 안전 kin 에게 구조된다(risk-pooling 의 연직축 일반화·step-0019 의 3D 짝): D=8·수직 kin 컬럼 3개(태그 1·z 짝수 안전 m=1.0·홀수 궁핍 m=0.2)·share 만 on — kShareZ OFF 면 컬럼이 2D 평면 투영상 한 칸이라 서로 안 닿아 구조 ' + avg(rb, 'sharedOff').toFixed(2) + '(최소 m ' + avg(rb, 'minMoff').toFixed(2) + ' 그대로) → ON 이면 위/아래(z±1) 안전 kin 이 떠받쳐 구조 ' + avg(rb, 'sharedOn').toFixed(2) + '·최소 m ' + avg(rb, 'minMon').toFixed(2) + ' 로 오른다 = 0045 가 정렬한 3D 액적이 *단위로* 생존. share 의 occ 셈이 W·H→W·H·D·kin 쌍 4→6-인접(위 +z 추가). m 쌍 거래(부유→궁핍·보존).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'shared', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (구조는 m 쌍 거래[부유→궁핍·나간 만큼 들어옴] — share 는 E·R 을 안 건드린다, couple 의 m-아날로그 닫힌 장부 경계. 3D 구조 ' + avg(rc, 'shared').toFixed(2) + ' 가 일어나도 sumM 불변).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(m 이 3D 구조를 반영·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'pool', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
