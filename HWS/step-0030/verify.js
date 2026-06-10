/* HWS step-0030 헤드리스 검증 — 6-이웃 확산(VOXEL.md V2: 흐름·응집 stencil 에 z 항을 더해 상위 평면이 살아난다).
 * 새 구조(law-pipeline): 이 step 은 *법칙*을 더하지 않는다 — diffuse 의 선형 확산 stencil 을 z=0 평면에서 W×H×D 상자로 일반화한다(4-이웃→6-이웃).
 *   변경점: DEFAULTS.kDz(z 확산 계수, 기본 0) · diffuse 의 simple 경로(kRelief=0)가 전 평면을 z 항(상하 이웃)과 함께 처리.
 *   D=1 이면 z 이웃이 없어 z 항이 *산술로* 0 = 회귀 0(전 골든 D=1 비트 불변). kDz=kD 면 등방 확산(x·y·z 동일 계수).
 *
 * 사용: node step-0030/verify.js <reg|zdiffuse|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kDz 값 무관 비트 동일(z 항 산술 0). *교차 버전* 회귀(엔진 변경≢과거 재현)는
 *               `node engine/validate/verify-sim-engine.js` 의 골든 해시(전 D=1 시나리오 std@~tselect@ 비트 불변)가 권위.
 *  - zdiffuse : 가설 — *z 확산이 등방이고 상위 평면을 깨운다*. ① climb: z=0 한 점 주입 후 순수 확산 — kDz=0 이면 상위 평면 E=0(z 결합 없음),
 *               kDz>0 이면 E 가 z 로 올라가 상위 평면이 살아난다(상위 평면 분율 > 0). ② isotropy: 중간 z 한 점 주입 — kDz=kD 면 x-이웃 ≡ z-이웃(등방, 비율 1).
 *  - conserve : 보존 — D=8 등방 확산 + z=0 구동 + 응집에서 닫힌 장부 잔차 < 1e-11(z 쌍 거래 cancel → 보존).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H;

/* 표준 z-확산 3D 아레나 — verify-sim-engine.js zdiffScn 과 동일 상수(골든 zdiff@ 와 일치). D=8 등방 확산 + z=0 source + 응집. */
function zArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 1.0, noise: 0.5, drive: true,
    source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
    kD: 0.15, kDz: 0.15, kEvap: 0.001, kA: 0.3, aggMc: 1.1, aggW: 0.7, baseCost: 0, life: false,
    repro: false, move: false,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
/* 깨끗한 점 주입 아레나 — E=0 에서 시작해 한 점만 주입하고 *순수 확산*(구동·증발·응집 다 off)으로 퍼짐을 격리 측정. */
function pointArena(D, kDz) { return zArena({ D: D, kDz: kDz, initE: 0, noise: 0, drive: false, source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 }, kEvap: 0, kA: 0 }); }
/* 인덱스 (z·H+y)·W+x. 중심 (cx,cy,cz) 에 E 한 덩이 주입(외부 질량이라 E0 보정). */
function inject(sim, cx, cy, cz, amount) { var i = (cz * H + cy) * W + cx; sim.E[i] += amount; sim.E0 += amount; }
function planeSums(sim, D) { var s = []; for (var z = 0; z < D; z++) { var t = 0; for (var k = 0; k < WH; k++) t += sim.E[z * WH + k]; s.push(t); } return s; }
function at(sim, x, y, z) { return sim.E[(z * H + y) * W + x]; }

/* ── reg: D=1 에선 kDz 값이 비트 동일을 안 깬다(z 항 산술 0). 전체 스택을 굴려 확인. ── */
function reg(seed) {
  function go(kDz) { var s = ENG.createSim(seed, zArena({ D: 1, kDz: kDz })); ENG.run(s, 800); return ENG.hashState(s); }
  var h0 = go(0), h1 = go(0.2);
  return { seed: seed, hashKdz0: h0, hashKdz02: h1, pass: h0 === h1 };
}

/* ── zdiffuse: 가설 — climb(상위 평면 깨움) + isotropy(kDz=kD 등방). ── */
function zdiffuse(seed) {
  var D = 8, amt = 100, TICK = 200;
  /* climb: z=0 중심 한 점 주입 → 순수 확산. kDz=0 이면 상위 평면 E=0(z 결합 없음), kDz=0.15 면 z 로 올라간다. */
  var off = ENG.createSim(seed, pointArena(D, 0)); inject(off, 32, 32, 0, amt); ENG.run(off, TICK);
  var on = ENG.createSim(seed, pointArena(D, 0.15)); inject(on, 32, 32, 0, amt); ENG.run(on, TICK);
  var sOff = planeSums(off, D), sOn = planeSums(on, D);
  var totOff = sOff.reduce(function (a, b) { return a + b; }, 0), totOn = sOn.reduce(function (a, b) { return a + b; }, 0);
  var upperOff = (totOff - sOff[0]) / totOff, upperOn = (totOn - sOn[0]) / totOn;
  var topOn = sOn[D - 1] / totOn;   // 천장(z=D−1)까지 도달한 분율(z 로 끝까지 퍼졌나)
  /* isotropy: 중간 z 한 점 주입 후 짧게 확산(벽 미도달) → x-이웃 ≡ z-이웃(kDz=kD 등방). */
  var iso = ENG.createSim(seed, pointArena(D, 0.15)); inject(iso, 32, 32, 4, amt); ENG.run(iso, 2);
  var ex = at(iso, 33, 32, 4), ey = at(iso, 32, 33, 4), ez = at(iso, 32, 32, 5);
  /* x·y·z 세 축 이웃이 모두 같아야 등방(kDz=kD). z 를 x·y 둘 다와 비교. */
  var isoRatio = ex > 1e-12 ? ez / ex : 0, isoRel = ex > 1e-12 ? Math.max(Math.abs(ez - ex), Math.abs(ez - ey)) / ex : 1;
  /* anisotropy 대조: kDz=0 이면 z-이웃은 0(climb 없음), x-이웃은 > 0. */
  var an = ENG.createSim(seed, pointArena(D, 0)); inject(an, 32, 32, 4, amt); ENG.run(an, 2);
  var anEx = at(an, 33, 32, 4), anEz = at(an, 32, 32, 5);
  return {
    seed: seed, upperOff: upperOff, upperOn: upperOn, topOn: topOn,
    isoRatio: isoRatio, isoRel: isoRel, anZneighbor: anEz, anXneighbor: anEx,
    pass: upperOff < 1e-12 && upperOn > 0.05 && topOn > 1e-6 && isoRel < 1e-9 && anEz === 0 && anEx > 0
  };
}

/* ── conserve: D=8 등방 확산 + z=0 구동 + 응집 — 닫힌 장부 잔차(z 쌍 거래 cancel → 보존). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, zArena()); ENG.run(sim, 600);
  var L = ENG.ledger(sim), s = planeSums(sim, 8), tot = s.reduce(function (a, b) { return a + b; }, 0);
  return { seed: seed, residual: L.residual, sumE: L.sumE, upperFrac: (tot - s[0]) / tot, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, zArena()); ENG.run(s, 600); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashKdz0', 'hashKdz02', 'pass']);
    console.log('회귀 0: D=1 에선 kDz=0 과 kDz=0.2 가 비트 동일(z 이웃 없어 z 항 산술 0). *교차 버전* 회귀(엔진 변경≢과거 재현)는 verify-sim-engine.js 골든 해시(전 D=1 시나리오)가 권위 — 비트 불변 확인.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'zdiffuse') {
    var rz = seeds.map(zdiffuse); table(rz, ['seed', 'upperOff', 'upperOn', 'topOn', 'isoRatio', 'isoRel', 'anZneighbor', 'anXneighbor', 'pass']);
    console.log('z 확산이 상위 평면을 깨운다: z=0 한 점 주입 후 상위 평면 분율 = ' + avg(rz, 'upperOff').toExponential(1) + '(kDz=0, z 결합 없음) → ' + (avg(rz, 'upperOn') * 100).toFixed(1) + '%(kDz=0.15, z 로 올라감, 천장 도달 ' + avg(rz, 'topOn').toExponential(1) + ').');
    console.log('등방: 중간 z 주입 후 z-이웃/x-이웃 비율 = ' + avg(rz, 'isoRatio').toFixed(4) + '(kDz=kD → 1, 상대오차 ' + avg(rz, 'isoRel').toExponential(1) + '). 대조(kDz=0): z-이웃 ' + avg(rz, 'anZneighbor').toExponential(1) + '(climb 없음) vs x-이웃 ' + avg(rz, 'anXneighbor').toFixed(3) + '. kDz 가 z 결합을 켠다.');
    return rz.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'upperFrac', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 등방 확산 + z=0 구동 — z 항 상하 쌍 거래가 cancel 되어 닫힌 장부 유지. 상위 평면 분율 ' + (avg(rc, 'upperFrac') * 100).toFixed(1) + '% — z 확산이 3D 상자를 채운다).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(z 확산도 결정론 보존 — Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'zdiffuse', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
