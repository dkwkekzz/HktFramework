/* HWS step-0037 헤드리스 검증 — 태양빛 비: 부력+중력 통합(VOXEL.md V5+ — 0035 상승·0036 하강이 "중력 off 격리"로 닫혔던 것을, 중력을 켜 *통합*한다. 별이 떴다 지며 高z 에서 뿌린 E 를 중력[V3 kGravity]이 비처럼 끌어내려 z=0 바닥에 고이게 한다 = 바다).
 * 이 step 은 hws-laws.js 를 *건드리지 않는다* — 이미 검증된 두 법칙(별 부력/일생 ignite·중력 gravity)을 *합성*해 둘 중 어느 하나만으론 안 나는 제3의 현상(별빛→비→바다)을 창발시키는 *통합 step* 이다. 통합 게이트 = 기존 노브 kGravity.
 *   회귀(이중 가드, 기존 노브 그대로): kGravity=0 이면 gravity 통째 skip(방출 E 가 제자리 = 0036 fall 비트 동일) / D=1 이면 gravity 가 D<2 early-return(z 이웃 없음 → kGravity 값 무관 = 2D 레거시 비트 불변). *교차 버전* 회귀는 verify-sim-engine.js 골든(법칙 무변경 → std@~fall@ 전 해시 비트 불변)이 권위.
 *   닫힌 고리: 별이 z=0(R 핵)서 나(0035) → 천장까지 뜨고(0035) → 연료 쇠해 도로 진다(0036) → 진 별이 뿌린 E 가 중력으로 내려 바다로 고인다(0037). "구동이 세계서 나고 진다"가 *에너지 순환*으로 닫힘.
 *
 * 사용: node step-0037/verify.js <reg|rain|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kGravity 값 무관 비트 동일(gravity 가 D<2 early-return → z 이웃 없어 2D 레거시 불변). *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든 해시(전 D=1 시나리오 std@~fall@ 비트 불변 — 이 step 은 법칙 무변경)가 권위.
 *  - rain     : 가설 — *지는 별이 뿌린 E 가 중력으로 비처럼 내려 바다로 고인다*. z=0 R 핵서 별 점화·부력·하강(=0036) 위에 중력을 켜고/끄고 비교:
 *               중력 off(=0036) 면 방출 E 가 별의 z-궤적에 머문다(E 무게중심 高z·바닥 z=0 분율 낮음) — 중력 on 이면 高z 방출 E 가 z=0 바닥으로 내려 고인다(바닥 분율 ↑·E 무게중심 ↓) = 별빛이 바다가 됨.
 *  - conserve : 보존 — D=8 통합에서 닫힌 장부 잔차 < 1e-11(중력은 E↔E 쌍 거래[보존]·별 방출은 fuel→E 외부 경계[injected 추적]).
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
/* 태양빛 비 아레나(골든 rain@ 와 동일) — fallArena(=0036 별 일생) 위에 중력(kGravity=0.2)을 켜 *통합*한다.
 *   별이 떴다 지며 高z 에서 뿌린 E 를 중력이 z=0 바닥으로 끌어내려 고이게 한다 = 바다. kGravity=0 이면 gravity skip → fallArena 비트 동일(회귀). 법칙 무변경(두 기존 법칙 합성). */
function rainArena(extra) { return fallArena(Object.assign({ kGravity: 0.2 }, extra || {})); }
/* z=0 정적 R 핵(점화 신호 — 별이 여기서 태어나 떠오른다). R 은 E0(장부 baseline)에 산입. verify-sim-engine.js seedSunCore() 와 동일. */
var SUN_RVAL = 2.0;
function seedSunCore(sim) {
  var disc = ENG.discCells(W, H, (W / 2) | 0, (H / 2) | 0, 2);   // z=0 평면 원판(인덱스 y·W+x = z=0; siting 은 2D 라 z=0 핵만 본다)
  for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += SUN_RVAL; sim.E0 += SUN_RVAL; }
}
function planeEsums(sim, D) { var s = []; for (var z = 0; z < D; z++) { var t = 0; for (var k = 0; k < WH; k++) t += sim.E[z * WH + k]; s.push(t); } return s; }
/* E 무게중심 z(평면별 E 합 가중) — 바닥 방출(off)이면 ≈0, 하늘 방출(on)이면 高z. */
function comZ(es) { var num = 0, den = 0; for (var z = 0; z < es.length; z++) { num += z * es[z]; den += es[z]; } return den > 0 ? num / den : -1; }
/* 바닥 평면(z=0) E 분율 — 중력이 별빛을 바다로 고이게 했나(별빛→비→바다)의 직접 지표. 중력 off 면 E 가 별 z-궤적에 머물러 낮음·on 이면 z=0 에 고여 높음. */
function bottomFrac(es) { var den = 0; for (var z = 0; z < es.length; z++) den += es[z]; return den > 0 ? es[0] / den : 0; }

/* ── reg: D=1 에선 kGravity 값이 비트 동일을 안 깬다(gravity 가 D<2 early-return → z 이웃 없어 하향 유출 불가). 전체 스택(별 부력·하강 포함)을 굴려 확인 — 통합이 2D 레거시를 한 비트도 안 건드림. ── */
function reg(seed) {
  function go(kGrav) {
    var s = ENG.createSim(seed, {
      D: 1, initE: 1.0, noise: 0.5, drive: true,
      source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
      kD: 0.2, kEvap: 0.001, kA: 0.45, aggMc: 1.1, aggW: 0.7, baseCost: 0.05,
      kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0,
      kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20,
      kCrowd: 0.20, kFSM: 1, kFlux: 1, kTemplate: 1, kInherit: 1, kStarRise: 1, kStarFall: 1, starFallThresh: 0.5, kGravity: kGrav
    });
    ENG.run(s, 800); return ENG.hashState(s);
  }
  var h0 = go(0), h1 = go(0.2);
  return { seed: seed, hashGrav0: h0, hashGrav02: h1, pass: h0 === h1 };
}

/* ── rain: 가설 — 지는 별이 高z 에서 뿌린 E 를 중력이 비처럼 끌어내려 바다로 고이게 한다(별빛→비→바다). 중력 off(=0036) vs on 비교. ── */
function rain(seed) {
  var D = 8, TICK = 200;
  /* 중력 off(kGravity=0 = fallArena = 0036): 방출 E 가 별의 z-궤적에 머문다(무게중심 高z·바닥 분율 낮음). on(kGravity=0.2): 高z 방출 E 가 z=0 바닥으로 내려 고인다(무게중심 ↓·바닥 분율 ↑). */
  function go(kGrav) {
    var s = ENG.createSim(seed, rainArena({ kGravity: kGrav })); seedSunCore(s);
    ENG.run(s, TICK);
    var es = planeEsums(s, D);
    return { comEz: comZ(es), botFrac: bottomFrac(es) };
  }
  var off = go(0), on = go(0.2);
  return {
    seed: seed, comOff: off.comEz, comOn: on.comEz, botOff: off.botFrac, botOn: on.botFrac,
    /* off: E 가 별 궤적 따라 高z(무게중심 5.83·바닥 분율 작음). on: 중력이 별빛을 z=0 으로 끌어내려 고임(무게중심 ↓·바닥 분율 ≫ off = 바다). */
    pass: on.botFrac > off.botFrac && on.comEz < off.comEz && on.botFrac > 0.4
  };
}

/* ── conserve: D=8 통합(별 일생 + 중력)에서 닫힌 장부 잔차(중력은 E↔E 쌍 거래[보존]; 별 방출은 fuel→E 외부 경계 injected 추적). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, rainArena()); seedSunCore(sim); ENG.run(sim, 200);
  var L = ENG.ledger(sim), es = planeEsums(sim, 8);
  return { seed: seed, residual: L.residual, sumE: L.sumE, injected: sim.injected, botFrac: bottomFrac(es), pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, rainArena()); seedSunCore(s); ENG.run(s, 200); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashGrav0', 'hashGrav02', 'pass']);
    console.log('회귀 0: D=1 에선 kGravity=0 과 0.2 가 비트 동일(gravity 가 D<2 early-return → z 이웃 없어 하향 유출 불가 = 2D 레거시 불변). 이 step 은 법칙 무변경(통합 step) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 D=1 시나리오 std@~fall@)가 권위·비트 불변.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'rain') {
    var rb = seeds.map(rain); table(rb, ['seed', 'comOff', 'comOn', 'botOff', 'botOn', 'pass']);
    console.log('지는 별이 뿌린 E 가 중력으로 비처럼 내려 바다로 고인다(별빛→비→바다): z=0 R 핵서 별이 떴다 지며(0036) 방출 → 중력 off 면 그 E 가 별 z-궤적에 머물고(E 무게중심 z=' + avg(rb, 'comOff').toFixed(2) + '·바닥 z=0 분율 ' + (avg(rb, 'botOff') * 100).toFixed(0) + '%) → 중력 on 이면 高z 방출 E 가 z=0 바닥으로 내려 고인다(무게중심 z=' + avg(rb, 'comOn').toFixed(2) + ' < off·바닥 분율 ' + (avg(rb, 'botOn') * 100).toFixed(0) + '% = 바다). 두 기존 법칙(별 일생·중력)의 *합성*이 빚은 제3의 현상 — 에너지 순환의 가시적 폐합.');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'injected', 'botFrac', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 통합 — 중력은 E↔E 쌍 거래[보존], 별 방출은 fuel→E 외부 경계[injected 추적]·닫힌 장부 유지. 바닥 z=0 분율 ' + (avg(rc, 'botFrac') * 100).toFixed(0) + '% — 별빛이 바다로 고임).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(별 일생+중력 통합도 결정론 보존 — Math.random 0, 방향은 법칙 상수).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'rain', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
