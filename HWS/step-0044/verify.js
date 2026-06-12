/* HWS step-0044 헤드리스 검증 — 3D 자기제한: 혼잡 carrying capacity 의 연직 일반화(VOXEL.md V5+).
 * 0042·0043 이 생명을 z>0 에 올렸다(이동·번식으로 3D 거주). 그러나 혼잡(crowd, step-0012 carrying capacity)은 여전히 2D 평면만 봤다 —
 *   밀도 그리드·disc 가 W·H(2D)라 z>0 생명은 occ[a.center] 가 범위 밖이라 *무시*됐다. 그래서 생명이 같은 (x,y) 에 *수직으로 무한 적층*해도 혼잡세가 0(carrying capacity 누수).
 *   이 step 은 crowd 의 밀도 셈을 disc[2D]→ball[3D]·occ 그리드 W·H→W·H·D 로 *제자리 일반화*한다(move kMoveZ·reproduce kDivZ 와 같은 형식) + 노브 kCrowdZ:
 *   수직으로 쌓인 생명도 제 z±이웃을 세 혼잡세를 낸다 = 0012(2D 공멸 방지 자기제한)의 연직 짝(3D 생명이 무한 적층 못 함).
 *   회귀(이중 가드): kCrowdZ=0 → 3D 블록 미진입(2D 경로·직전 step 비트 동일) / D=1 → ball 의 z 항 소멸(2D 등가).
 *
 * 사용: node step-0044/verify.js <reg|cap|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kCrowdZ=0 → 수직 컬럼이 2D 평면만 봄(혼잡세 0)·2회 실행 비트 동일. *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든(전 시나리오 std@~div3@ 비트 불변 — 새 노브=0 → 2D 경로)이 권위.
 *  - cap      : 가설 — *수직으로 적층한 생명이 3D 혼잡세를 낸다(연직 carrying capacity)*. kCrowdZ off vs on 비교: off 면
 *               컬럼이 서로 안 보임(혼잡세 0·meanM 불변) → on 이면 z±이웃을 세 혼잡세를 내 m 이 깎인다(혼잡세>0·meanM↓) = 자기제한이 연직축으로.
 *  - conserve : 보존 — 혼잡세는 m→metabolized 쌍 거래(소산 sink) — 닫힌 장부 잔차 < 1e-11(crowd 는 E·R 안 건드림).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — m 이 혼잡세를 반영).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H, DZ = 8;

/* 3D 혼잡 아레나 — verify-sim-engine.js capArena() 와 동일 상수(골든 cap3@ 와 일치).
 * D=8 voxel. 생명 외 모든 동역학 off(이동·번식·흡수·대사 다 off → m 은 *혼잡세*로만 변함). crowd 만 켜고 kCrowdZ 토글.
 * 생명을 *수직 컬럼*(같은 (x,y), z=0..D−1)으로 둔다 — 2D 투영으론 한 칸이라 혼잡 0, 3D 론 서로 z-이웃. */
function capArena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    repro: false, mDiv: 1.2, divR: 1, popCap: 4096, kDivZ: 0,
    kCrowd: 0.02, crowdR: 3, kCrowdZ: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kFSM: 0, kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 균일 E 장 + 생명 수직 컬럼 3개(distinct (x,y), 각 z=0..D−1 적층). 균일 E 라 흡수 off 와 무관(정적). E0 장부 baseline 산입.
 * 각 생명 m=1 은 제 z-칸 E 에서 끌어온다(닫힌 장부 — 제 칸 E↓ m↑). 컬럼 간격 6 > crowdR=3 → 2D 론 컬럼끼리도 안 보임(순수 연직 혼잡 격리). */
function seedColumns(sim) {
  var E = sim.E, D = sim.p.D, N = WH * D;
  for (var i = 0; i < N; i++) { E[i] = 2; sim.E0 += 2; }                 // 균일 E=2(컬럼당 m=1 끌어와도 남음)
  var cols = [[16, 16], [22, 22], [28, 28]];
  for (var c = 0; c < cols.length; c++) for (var z = 0; z < D; z++) {
    var x = cols[c][0], y = cols[c][1], center = z * WH + y * W + x;
    var seedM = sim.E[center] < 1 ? sim.E[center] : 1;
    sim.E[center] -= seedM;
    sim.agents.push({ x: x, y: y, z: z, m: seedM, cells: [center], center: center, bornTick: sim.tick });
  }
  return sim.agents.length;
}
function meanM(sim) { var ag = sim.agents, s = 0; for (var k = 0; k < ag.length; k++) s += ag[k].m; return ag.length ? s / ag.length : 0; }
function build(seed, kCZ, ticks) { var s = ENG.createSim(seed, capArena({ kCrowdZ: kCZ })); seedColumns(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* ── reg: 회귀 0 — kCrowdZ=0 → 수직 컬럼이 2D 평면만 봄 → 혼잡세 0(meanM 불변)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, 8), b = build(seed, 0, 8);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, tax: a.metabolized, meanM: meanM(a), hashA: ha, hashB: hb, pass: ha === hb && a.metabolized === 0 };
}

/* ── cap: 가설 — 수직 적층 생명이 3D 혼잡세를 낸다(연직 carrying capacity). kCrowdZ off vs on 비교. ── */
function cap(seed) {
  var off = build(seed, 0, 8), on = build(seed, 1, 8);
  return {
    seed: seed, taxOff: off.metabolized, taxOn: on.metabolized, meanMoff: meanM(off), meanMon: meanM(on),
    /* off: 컬럼이 서로 안 보임(혼잡세 0·meanM 1). on: z-이웃 세 혼잡세>0·meanM<1. */
    pass: off.metabolized === 0 && on.metabolized > 0 && meanM(on) < meanM(off)
  };
}

/* ── conserve: 혼잡세는 m→metabolized 쌍 거래(소산 sink) — 닫힌 장부 잔차(crowd 는 E·R 안 건드림). ── */
function conserve(seed) {
  var s = build(seed, 1, 8);
  var L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, tax: s.metabolized, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(m 이 혼잡세를 반영). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 1, 8)), hb = ENG.hashState(build(seed, 1, 8));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'tax', 'meanM', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kCrowdZ=0 → 수직 컬럼이 2D 평면만 봄 → 혼잡세 0(meanM 불변)·2회 실행 비트 동일. 이 step 은 crowd *제자리 확장*(move kMoveZ·reproduce kDivZ 와 같은 형식·새 LAW_ORDER 자리 없음) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~div3@ 비트 불변·새 노브=0→2D 경로)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'cap') {
    var rb = seeds.map(cap); table(rb, ['seed', 'taxOff', 'taxOn', 'meanMoff', 'meanMon', 'pass']);
    console.log('수직으로 적층한 생명이 3D 혼잡세를 낸다(자기제한의 연직축 일반화·0012 carrying capacity 의 3D 짝): D=8·생명 수직 컬럼 3개(각 z=0..7)·crowd 만 on — kCrowdZ OFF 면 컬럼이 2D 평면 투영상 한 칸이라 서로 안 보여 혼잡세 ' + avg(rb, 'taxOff').toFixed(2) + '(meanM ' + avg(rb, 'meanMoff').toFixed(2) + ' 불변) → ON 이면 제 z±이웃을 세 혼잡세 ' + avg(rb, 'taxOn').toFixed(2) + ' 를 내 meanM ' + avg(rb, 'meanMon').toFixed(2) + ' 로 깎인다 = 3D 생명이 무한 적층 못 함(carrying capacity). crowd 의 밀도 셈이 disc[2D]→ball[3D]·occ W·H→W·H·D 로 일반화. 혼잡세 m→metabolized 쌍 거래(소산 sink).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'tax', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (혼잡세는 m→metabolized 쌍 거래[소산 sink] — crowd 는 E·R 을 안 건드린다, baseCost 와 같은 닫힌 장부 경계. 3D 혼잡세 ' + avg(rc, 'tax').toFixed(2) + ' 가 나가도 장부 불변).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(m 이 3D 혼잡세를 반영·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'cap', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
