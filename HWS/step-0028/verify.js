/* HWS step-0028 헤드리스 검증 — 격자 z-일반화(VOXEL.md V1: 시뮬 공간을 W×H×D voxel 로).
 * 새 구조(law-pipeline): 이 step 은 *법칙*을 더하지 않는다 — 터(Ground)의 차원을 일반화한다.
 *   변경점: DEFAULTS.D(기본 1) · createSim 의 N=W·H·D 와 buf=E 복사본 · 커널 가법 헬퍼(discCells3·ballOffsets·tumbleHash3).
 *   법칙 산술은 무수정 — 법칙들은 N=W·H 로 z=0 평면만 처리한다(z 확산은 V2, 중력은 V3). 상위 평면은 V1 에선 불활성(초기 noise 보존).
 *
 * 사용: node step-0028/verify.js <reg|voxel|conserve|det|all> [seed]
 *  - reg     : 회귀 0 — D 미지정 == D:1 명시(기본값 1), 같은 시드 비트 동일. *교차 버전* 회귀(엔진 변경이 과거 재현을 안 바꿈)는
 *              `node engine/validate/verify-sim-engine.js` 의 골든 해시(전 시나리오 D=1)가 권위 — D 추가·buf 복사·N=W·H·D 가 D=1 에서 비트 동일임을 증명.
 *  - voxel   : 가설 — *격자 일반화가 깨끗하다*. ① D=4 의 z=0 평면이 D=1 전체 세계와 *비트 동일*(maxDiff=0 — 같은 시드의 첫 W·H rng draw·법칙이 x·y 만 봄)
 *              ② 3D 헬퍼 정합: discCells3(…,D=1,…,cz=0) ≡ discCells · tumbleHash3(x,y,0,…) ≡ tumbleHash · discCells3 가 D>1 에서 z 층을 실제로 연다.
 *  - conserve: 보존 — D=4 에서 닫힌 장부 잔차 < 1e-12(상위 평면은 불활성이라 상수 기여 — z=0 평면 동역학만 보존, 2D 와 동급).
 *  - det     : 결정론 — D=4 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all     : 전 모드 + 요약
 *
 * 표준 시나리오 = 고전 스택(확산·증발·구동·결정화·기복·생명·번식·이동·탐사) — z=0 평면에서 D=1 과 D=4 가 같음을 보이기 충분.
 */
'use strict';
var ENG = require('../engine/hws-sim.js');                 // law-pipeline 코어(D 노브·3D 헬퍼 포함)
var K = require('../engine/hws-kernel.js');                 // 커널 헬퍼(discCells·discCells3·tumbleHash·tumbleHash3)

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 고전 스택 시나리오(step-0010 등가) — z=0 평면 동역학이 여러 법칙을 거치게 한다. */
function scn(extra) {
  return Object.assign({}, {
    kA: 0.45, aggMc: 1.1, aggW: 0.7,
    kL: 0.05, mMaint: 0.03, mDeath: 0.05, mSeed: 0.50, lifeR: 1,
    mDiv: 1.20, divR: 1, moveR: 1, moveThresh: 0.02, baseCost: 0.08,
    srcJump: 0, srcPeriod: 150,
    kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0
  }, extra || {});
}
/* 고정 좌표 스폰(결정론·D 무관 — detectPools 는 D>1 에서 전 평면을 훑어 D=1 과 갈릴 수 있어 쓰지 않는다). 모두 z=0 평면. */
function seedFixed(core, sim) {
  core.spawnAgent(sim, 16, 16); core.spawnAgent(sim, 40, 24); core.spawnAgent(sim, 28, 44);
}

var FORM = 600, POST = 400;

/* z=0 평면을 두 sim 에서 비트 비교(maxDiff). a = D=1 전체, b = D≥1 의 z=0 평면(첫 W·H 셀). */
function comparePlane0(a, b) {
  var maxd = 0, i, NP = W * H;
  for (i = 0; i < NP; i++) { var de = Math.abs(a.E[i] - b.E[i]); if (de > maxd) maxd = de; var dr = Math.abs(a.R[i] - b.R[i]); if (dr > maxd) maxd = dr; }
  var ok = maxd === 0 && a.agents.length === b.agents.length;
  if (ok) for (var k = 0; k < a.agents.length; k++) { var p = a.agents[k], q = b.agents[k]; if (p.x !== q.x || p.y !== q.y || p.m !== q.m) ok = false; }
  return { maxDiff: maxd, pass: ok };
}

/* ── reg: D 미지정 == D:1 명시(기본값이 1임을 문서화) — 같은 시드 비트 동일. ── */
function reg(seed) {
  var a = ENG.createSim(seed, scn());            // D 미지정 → 기본 1
  var b = ENG.createSim(seed, scn({ D: 1 }));    // D=1 명시
  ENG.run(a, FORM); seedFixed(ENG, a); ENG.run(a, POST);
  ENG.run(b, FORM); seedFixed(ENG, b); ENG.run(b, POST);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, hashDefault: ha, hashD1: hb, pass: ha === hb };
}

/* ── voxel: 가설 — D=4 의 z=0 평면 ≡ D=1 전체. + 3D 헬퍼 정합. ── */
function voxel(seed) {
  var a = ENG.createSim(seed, scn());            // D=1 (전체 세계 = z=0 평면)
  var b = ENG.createSim(seed, scn({ D: 4 }));    // D=4 (z=0 평면이 a 와 같아야)
  ENG.run(a, FORM); seedFixed(ENG, a); ENG.run(a, POST);
  ENG.run(b, FORM); seedFixed(ENG, b); ENG.run(b, POST);
  var cmp = comparePlane0(a, b);
  /* 3D 헬퍼 정합 — D=1·cz=0 이면 2D 와 비트 동일(셀·순서), D>1 이면 z 층을 실제로 연다. */
  var c2 = K.discCells(W, H, 20, 20, 3), c3 = K.discCells3(W, H, 1, 20, 20, 0, 3);
  var discEq = c2.length === c3.length; if (discEq) for (var i = 0; i < c2.length; i++) if (c2[i] !== c3[i]) discEq = false;
  var hashEq = K.tumbleHash3(11, 22, 0, 5, seed) === K.tumbleHash(11, 22, 5, seed);
  var ball3D = K.discCells3(W, H, 8, 20, 20, 4, 2);      // D=8, cz=4, r=2 → 여러 z 층
  var zSet = {}; for (var j = 0; j < ball3D.length; j++) zSet[Math.floor(ball3D[j] / (W * H))] = 1;
  var zLayers = Object.keys(zSet).length;
  return {
    seed: seed, maxDiff: cmp.maxDiff, plane0Eq: cmp.pass,
    discEq: discEq, hashEq: hashEq, zLayers: zLayers,
    pass: cmp.pass && discEq && hashEq && zLayers >= 3
  };
}

/* ── conserve: D=4 닫힌 장부 잔차(z=0 평면 동역학 + 불활성 상위 평면 = 상수). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, scn({ D: 4 }));
  ENG.run(sim, FORM); seedFixed(ENG, sim); ENG.run(sim, POST);
  var L = ENG.ledger(sim);
  return { seed: seed, residual: L.residual, sumE: L.sumE, store: L.store, biomass: L.biomass, pop: sim.agents.length, pass: L.residual < 1e-12 };
}

/* ── det: D=4 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, scn({ D: 4 })); ENG.run(s, FORM); seedFixed(ENG, s); ENG.run(s, POST); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashDefault', 'hashD1', 'pass']);
    console.log('회귀 0: D 미지정 == D:1 명시(기본값 1) 비트 동일. *교차 버전* 회귀(엔진 변경≢과거 재현 변화)는 verify-sim-engine.js 골든 해시(D=1 전 시나리오)가 권위 — 비트 불변 확인.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'voxel') {
    var rv = seeds.map(voxel); table(rv, ['seed', 'maxDiff', 'plane0Eq', 'discEq', 'hashEq', 'zLayers', 'pass']);
    console.log('격자 일반화가 깨끗하다: D=4 의 z=0 평면이 D=1 전체 세계와 *비트 동일*(maxDiff=' + avg(rv, 'maxDiff').toExponential(1) +
      ' — 같은 시드의 첫 W·H rng draw 동일·법칙이 x·y 만 봄). 3D 헬퍼 정합: discCells3(D=1)≡discCells·tumbleHash3(z=0)≡tumbleHash·discCells3 가 D>1 서 z 층 ' + avg(rv, 'zLayers').toFixed(0) + '개를 연다.');
    return rv.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'store', 'biomass', 'pop', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=4 — z=0 평면 동역학은 2D 와 동급 보존, 불활성 상위 평면은 초기 noise 를 상수로 보존[buf=E 복사본 덕]. 격자 확장이 닫힌 장부를 안 깬다).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=4 같은 시드 2회 상태 해시 일치(voxel 격자도 결정론 보존 — Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'voxel', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
