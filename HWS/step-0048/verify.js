/* HWS step-0048 헤드리스 검증 — 3D 막/flux 결합(couple 의 kin E-공유를 연직축으로, VOXEL.md V5+).
 * 0045 가 z>0 거주 생명을 3D 로 kin 정렬했고(adhere z-일반화), 0046·0047 이 생물량 공유·유전 상속을 z 로 풀었다. 그러나 막/flux 결합(couple, step-0018 = kin 끼리 필드 E 를 공유해 막이 표면으로 창발)은 여전히 2D 평면만 봤다 —
 *   kin 쌍이 우(+x)/하(+y) 4-인접인데 하 dc=((y+1)%H)·W+x 가 z 성분을 떨궈(z=0 평면) z>0 kin 은 위/아래 동료와 E 를 공유 못 했다(3D 막 누수 — z 액적 내부가 연직으로 안 균질).
 *   이 step 은 couple 의 occ 그리드 W·H→W·H·D·kin 쌍에 위(+z) 추가(하 dc 도 z 평면 키로 교정·4-인접→6-인접) 로 *제자리 일반화*한다(0046 share·0047 inherit 와 같은 형식) + 노브 kCoupleZ:
 *   z>0 kin 이 위/아래 동료와 필드 E 를 공유한다 = 0045 가 정렬한 3D 액적이 비로소 *연직으로 균질한 내부*(막의 연직 일반화·step-0018 의 3D 짝)를 갖는다.
 *   회귀(이중 가드): kCoupleZ=0 → 3D 블록 미진입(2D 경로·직전 step 비트 동일·z>0 kin 은 하 dc 가 z=0 평면이라 위/아래 동료와 공유 못 함) / D=1 → z 이웃 없어 2D 등가.
 *
 * 사용: node step-0048/verify.js <reg|mix|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kCoupleZ=0 → z>0 kin 이 2D 평면(하 dc=z=0)이라 위/아래 동료와 공유 0(E 연직 불균질 그대로)·2회 실행 비트 동일. *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든(전 시나리오 std@~inh3@ 비트 불변 — 새 노브=0 → 2D 경로)이 권위.
 *  - mix      : 가설 — *z>0 kin 이 위/아래(z±1) 동료와 필드 E 를 공유한다(연직 막 균질화)*. kCoupleZ off vs on 비교: off 면
 *               수직 컬럼이 서로 안 닿아 공유 0(E 짝/홀 z 교번 그대로·spread 큼) → on 이면 위/아래 kin 이 E 를 균등화(공유>0·spread↓).
 *  - conserve : 보존 — 공유는 E 쌍 거래(균등화·나간 만큼 들어옴) — 닫힌 장부 잔차 < 1e-11(couple 은 R·m 안 건드림).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — E 가 공유를 반영).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H, DZ = 8;

/* 3D 막/flux 결합 아레나 — verify-sim-engine.js cplArena()/seedCoupleColumns 와 동일 상수(골든 cpl3@ 와 일치).
 * D=8 voxel. couple 외 모든 동역학 off(확산·중력·증발·이동·번식·흡수·혼잡·응집·공유 off → 필드 E 는 couple 로만 흐른다). couple 만 켜고 kCoupleZ 토글.
 * 생명을 *수직 kin 컬럼*(같은 (x,y)·같은 태그·z=0..D−1)으로 두되 제 칸 E 를 z 짝수=고(2.5)·홀수=저(0.5)로 — 2D 투영으론 한 칸이라 위/아래 못 닿고, 3D 론 z±1 kin 이 E 를 균등화(컬럼 평균 1.5 로). */
function cplArena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0, crowdR: 3, kCrowdZ: 0,
    kAdhesion: 0, adhesionLambda: 1.0, adhesionGain: 0.5, kAdhereZ: 0,
    kShare: 0, coopFit0: 1.0, coopFitStep: 0.0, kShareZ: 0,
    kInherit: 0, inheritMu: 0, inheritCost: 0, kInheritZ: 0,
    kMembrane: 0.5, kCoupleZ: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0,
    kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 수직 kin 컬럼 3개(같은 (x,y)·태그 1·z=0..D−1). 제 칸 E: z 짝수=3.0·홀수=1.0, 거기서 m=0.5 떼옴(닫힌 장부) → 짝수 2.5·홀수 0.5. 컬럼 간격 6 → 2D 론 컬럼끼리도 안 닿음(순수 연직 막 격리). */
function seedCoupleColumns(sim) {
  var E = sim.E, D = sim.p.D, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 0; }                              // 배경 E=0(컬럼만 E 보유 → spread 가 또렷)
  var cols = [[16, 16], [22, 22], [28, 28]];
  for (var c = 0; c < cols.length; c++) for (var z = 0; z < D; z++) {
    var x = cols[c][0], y = cols[c][1], center = z * WH + y * W + x;
    E[center] = (z & 1) ? 1.0 : 3.0; sim.E0 += E[center];               // 짝수 z=고 E(3.0)·홀수 z=저 E(1.0)
    E[center] -= 0.5;                                                    // 생물량 m=0.5 는 E 서 떼온다(닫힌 장부)
    sim.agents.push({ x: x, y: y, z: z, m: 0.5, g: 1, cells: [center], center: center, bornTick: sim.tick });
  }
  return sim.agents.length;
}
/* E spread = 생명 칸 E 의 (최대−최소). couple 이 연직으로 균질화하면 spread↓(컬럼이 평균 1.5 로 모임). */
function eSpread(sim) {
  var ag = sim.agents, E = sim.E, mn = Infinity, mx = -Infinity;
  for (var k = 0; k < ag.length; k++) { var e = E[ag[k].center]; if (e < mn) mn = e; if (e > mx) mx = e; }
  return ag.length ? mx - mn : 0;
}
function build(seed, kCZ, ticks) { var s = ENG.createSim(seed, cplArena({ kCoupleZ: kCZ })); seedCoupleColumns(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }
var TICKS = 20;

/* ── reg: 회귀 0 — kCoupleZ=0 → z>0 kin 이 2D 평면(하 dc=z=0)이라 위/아래 동료와 공유 0(E 연직 불균질 그대로)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, coupled: a.coupled, spread: eSpread(a), hashA: ha, hashB: hb, pass: ha === hb && a.coupled === 0 };
}

/* ── mix: 가설 — z>0 kin 이 위/아래(z±1) 동료와 필드 E 를 공유한다(연직 막 균질화). kCoupleZ off vs on 비교. ── */
function mix(seed) {
  var off = build(seed, 0, TICKS), on = build(seed, 1, TICKS);
  return {
    seed: seed, coupledOff: off.coupled, coupledOn: on.coupled, spreadOff: eSpread(off), spreadOn: eSpread(on),
    /* off: 컬럼이 서로 안 닿아 공유 0(E spread 2.0 그대로). on: z±1 kin 이 E 균등화 → spread↓. */
    pass: off.coupled === 0 && on.coupled > 0 && eSpread(on) < eSpread(off)
  };
}

/* ── conserve: 공유는 E 쌍 거래(균등화·나간 만큼 들어옴) — 닫힌 장부 잔차(couple 은 R·m 안 건드림). ── */
function conserve(seed) {
  var s = build(seed, 1, TICKS);
  var L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, coupled: s.coupled, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(E 가 공유를 반영). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 1, TICKS)), hb = ENG.hashState(build(seed, 1, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'coupled', 'spread', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kCoupleZ=0 → z>0 kin 이 2D 평면(하 dc=((y+1)%H)·W+x = z=0 평면)이라 제 위/아래 동료와 공유 0(E 연직 불균질 그대로 — 옛 2D couple 이 z>0 kin 을 못 잇던 그 caveat)·2회 실행 비트 동일. 이 step 은 couple *제자리 확장*(0046 share·0047 inherit 와 같은 형식·새 LAW_ORDER 자리 없음) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~inh3@ 비트 불변·새 노브=0→2D 경로)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'mix') {
    var rb = seeds.map(mix); table(rb, ['seed', 'coupledOff', 'coupledOn', 'spreadOff', 'spreadOn', 'pass']);
    console.log('z>0 kin 이 위/아래(z±1) 동료와 필드 E 를 공유한다(막의 연직축 일반화·step-0018 의 3D 짝): D=8·수직 kin 컬럼 3개(태그 1·z 짝수 고 E=2.5·홀수 저 E=0.5)·couple 만 on — kCoupleZ OFF 면 컬럼이 2D 평면 투영상 한 칸이라 서로 안 닿아 공유 ' + avg(rb, 'coupledOff').toFixed(2) + '(E spread ' + avg(rb, 'spreadOff').toFixed(2) + ' 그대로) → ON 이면 위/아래(z±1) kin 이 E 를 균등화해 공유 ' + avg(rb, 'coupledOn').toFixed(2) + '·spread ' + avg(rb, 'spreadOn').toFixed(2) + ' 로 내린다(컬럼 평균 1.5 로 모임) = 0045 가 정렬한 3D 액적이 연직으로 균질한 내부(막)를 가짐. couple 의 occ 셈이 W·H→W·H·D·kin 쌍 4→6-인접(위 +z 추가·하 dc z 평면 교정). E 쌍 거래(균등화·보존).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'coupled', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (공유는 E 쌍 거래[균등화·나간 만큼 들어옴] — couple 은 R·m 을 안 건드린다, 닫힌 장부 경계. 3D 공유 ' + avg(rc, 'coupled').toFixed(2) + ' 가 일어나도 sumE 불변).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(E 가 3D 공유를 반영·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'mix', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
