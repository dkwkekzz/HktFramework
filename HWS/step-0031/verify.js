/* HWS step-0031 헤드리스 검증 — 중력 구배(VOXEL.md V3: E 의 하향 선호 흐름. z 확산[V2, 등방]에 *방향*을 줘 골에 고인 E = 바다 원형).
 * 새 구조(law-pipeline): 이 step 은 *법칙 1개*(gravity)를 더한다 — 각 셀이 제 E 의 kGravity 비율을 아래(z−1) 이웃으로 유출(donor-제한 쌍 거래, 보존).
 *   변경점: DEFAULTS.kGravity(중력 계수, 기본 0) · gravity 법칙 함수 + LAW_ORDER 한 자리(①diffuse 뒤).
 *   kGravity=0 이면 early-return = 회귀 0(직전 step V2 비트 동일). D=1 이면 아래 이웃 없어(z=0 벽) 산술 0(이중 가드).
 *
 * 사용: node step-0031/verify.js <reg|settle|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kGravity 값 무관 비트 동일(z 이웃 없어 gravity 산술 0). *교차 버전* 회귀(엔진 변경≢과거 재현)는
 *               `node engine/validate/verify-sim-engine.js` 의 골든 해시(전 D=1 시나리오 std@~zdiff@ 비트 불변)가 권위.
 *  - settle   : 가설 — *중력이 E 를 바닥에 침전시킨다(바다 원형)*. 균일 E(D=8) 에서 순수 중력만:
 *               kGravity=0 이면 평면이 균일 유지(바닥 분율 = 1/D = 0.125, 정확히) — kGravity>0 이면 E 가 z=0 바닥에 고여 바닥 분율 ↑·천장 분율 ↓.
 *  - conserve : 보존 — D=8 중력 침전에서 닫힌 장부 잔차 < 1e-11(하향 쌍 거래가 보존). 침전 후에도 sumE 불변.
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H;

/* 표준 중력 침전 3D 아레나 — verify-sim-engine.js gravArena() 와 동일 상수(골든 grav@ 와 일치).
 * D=8 voxel 상자, 균일 E(noise 섭동) + 중력 하향 침전(kGravity=0.2) — 확산 포함 다른 법칙 다 off(순수 중력 격리). */
function gravArena(extra) {
  return Object.assign({}, {
    D: 8, initE: 1.0, noise: 0.5, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kGravity: 0.2,
    kCrowd: 0, kCryst: 0, kWeather: 0, kRelief: 0, kIgnite: 0, kFSM: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
  }, extra || {});
}
function planeSums(sim, D) { var s = []; for (var z = 0; z < D; z++) { var t = 0; for (var k = 0; k < WH; k++) t += sim.E[z * WH + k]; s.push(t); } return s; }

/* ── reg: D=1 에선 kGravity 값이 비트 동일을 안 깬다(z 이웃 없어 gravity 산술 0). 전체 스택을 굴려 확인. ── */
function reg(seed) {
  /* 전체 스택(step-0030 zArena 류 D=1) — kGravity 만 0↔0.2 로 토글. gravity 가 early-return 이면 동일. */
  function go(kG) {
    var s = ENG.createSim(seed, {
      D: 1, initE: 1.0, noise: 0.5, drive: true,
      source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
      kD: 0.2, kEvap: 0.001, kA: 0.45, aggMc: 1.1, aggW: 0.7, baseCost: 0.05,
      kCryst: 0.01, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0,
      kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20,
      kCrowd: 0.20, kFSM: 1, kFlux: 1, kTemplate: 1, kInherit: 1, kGravity: kG
    });
    ENG.run(s, 800); return ENG.hashState(s);
  }
  var h0 = go(0), h1 = go(0.2);
  return { seed: seed, hashKg0: h0, hashKg02: h1, pass: h0 === h1 };
}

/* ── settle: 가설 — 중력이 균일 E 를 z=0 바닥에 침전시킨다(바다 원형). ── */
function settle(seed) {
  var D = 8, TICK = 400;
  var off = ENG.createSim(seed, gravArena({ kGravity: 0 })); ENG.run(off, TICK);
  var on = ENG.createSim(seed, gravArena({ kGravity: 0.2 })); ENG.run(on, TICK);
  var sOff = planeSums(off, D), sOn = planeSums(on, D);
  var totOff = sOff.reduce(function (a, b) { return a + b; }, 0), totOn = sOn.reduce(function (a, b) { return a + b; }, 0);
  var botOff = sOff[0] / totOff, botOn = sOn[0] / totOn;       // 바닥 평면(z=0) 분율 — 균일이면 1/D, 침전하면 ↑
  var topOff = sOff[D - 1] / totOff, topOn = sOn[D - 1] / totOn;  // 천장 평면(z=D−1) 분율 — 침전하면 ↓
  return {
    seed: seed, botOff: botOff, botOn: botOn, topOff: topOff, topOn: topOn,
    /* kGravity=0: 평면 균일(바닥 ≈ 1/D — 다른 법칙 다 off 라 init noise 그대로 유지) · kGravity>0: 바닥에 고임(바닥 분율 ≫ 1/D, 천장 비움). */
    pass: Math.abs(botOff - 1 / D) < 0.01 && botOn > 0.5 && botOn > botOff && topOn < topOff && topOn < 0.02
  };
}

/* ── conserve: D=8 중력 침전에서 닫힌 장부 잔차(하향 쌍 거래가 보존). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, gravArena()); ENG.run(sim, 600);
  var L = ENG.ledger(sim), s = planeSums(sim, 8), tot = s.reduce(function (a, b) { return a + b; }, 0);
  return { seed: seed, residual: L.residual, sumE: L.sumE, botFrac: s[0] / tot, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, gravArena()); ENG.run(s, 600); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashKg0', 'hashKg02', 'pass']);
    console.log('회귀 0: D=1 에선 kGravity=0 과 kGravity=0.2 가 비트 동일(z 이웃 없어 gravity 산술 0). *교차 버전* 회귀(엔진 변경≢과거 재현)는 verify-sim-engine.js 골든 해시(전 D=1 시나리오)가 권위 — 비트 불변 확인.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'settle') {
    var rs = seeds.map(settle); table(rs, ['seed', 'botOff', 'botOn', 'topOff', 'topOn', 'pass']);
    console.log('중력이 E 를 바닥에 침전시킨다(바다 원형): 균일 E(D=8) → kGravity=0 이면 바닥 평면 분율 = ' + avg(rs, 'botOff').toFixed(4) + '(=1/D, 균일) → kGravity=0.2 면 ' + (avg(rs, 'botOn') * 100).toFixed(1) + '%(z=0 바닥에 고임), 천장 분율 ' + avg(rs, 'topOff').toFixed(4) + '→' + avg(rs, 'topOn').toExponential(1) + '(비움). E 가 가라앉아 바닥부터 차오른다 = 바다.');
    return rs.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'botFrac', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 중력 침전 — 하향 쌍 거래[셀↔아래 셀]가 보존, 닫힌 장부 유지. 바닥 분율 ' + (avg(rc, 'botFrac') * 100).toFixed(1) + '% — E 가 z=0 바닥에 고였다).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(중력도 결정론 보존 — Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'settle', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
