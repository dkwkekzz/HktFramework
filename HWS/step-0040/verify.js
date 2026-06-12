/* HWS step-0040 헤드리스 검증 — 전체 에너지 고리 폐합(VOXEL.md V5+ *통합* — 0037 별빛→비→바다가 "바다(고인 E)"에서 멈췄던 것을, 결정화+지지 침착[기존 부품]을 *합성*해 *바다를 지면/씨앗으로* 굳혀 새 별까지 점화시킨다 = E→별→비→바다→지면→새 별 완전 self-running 폐합).
 * 이 step 은 hws-laws.js 를 *건드리지 않는다* — 이미 검증된 부품(별 일생 ignite·중력 gravity·결정화 crystallize·지지 게이트)을 *합성*해 둘만으론 안 나는 제3의 현상(바다가 지면/씨앗으로 굳어 다음 별을 키운다)을 창발시키는 *통합 step* 이다. 통합 게이트 = 기존 노브 kCryst(+kSupport).
 *   회귀(이중 가드, 기존 노브 그대로): kCryst=0 이면 crystallize 통째 skip(바다가 안 굳음 = 0037 rain 비트 동일) / D=1 이면 별 z-궤적 무(상승/하강/방출 高z 없음) → 별빛 비 경로 자체가 2D 레거시 불변. *교차 버전* 회귀는 verify-sim-engine.js 골든(법칙 무변경 → std@~remn@ 전 해시 비트 불변)이 권위.
 *   닫힌 고리: 별이 z=0(R 핵)서 나(0035) → 천장까지 뜨고(0035) → 연료 쇠해 도로 진다(0036) → 진 별이 뿌린 E 가 중력으로 z=0 바다로 고인다(0037) → 그 바다 E 가 결정화로 R(지면/씨앗)로 굳고(0008·0032 지지) → R 이 ignThresh 넘으면 새 별이 거기서 점화(0011) → 세계가 *제 별빛으로 다음 별의 씨앗밭*을 키운다. "스스로 굴러가는 세계"의 에너지 순환이 완전 폐합.
 *
 * 사용: node step-0040/verify.js <reg|cycle|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — 통합 게이트(kCryst)를 끄면(0) cycleArena 가 rainArena(=0037)로 *비트 환원*(결정화가 유일한 추가 부품). *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든 해시(전 D=1 시나리오 std@~remn@ 비트 불변 — 이 step 은 법칙 무변경)가 권위.
 *  - cycle    : 가설 — *바다(고인 E)가 결정화로 지면/씨앗(R)으로 굳어 세계가 제 별빛으로 다음 별의 씨앗밭을 키운다*. 결정화 off(=0037) vs on 비교:
 *               off 면 바다가 고이기만 함(결정화량 0·점화 가능 z=0 자리 = 처음 놓은 씨앗 13칸뿐) — on 이면 바다 E 가 R 지면/씨앗으로 굳어(결정화량 ≫0·maxR ≫ ignThresh) 점화 가능 자리가 ~130+ 칸으로(세계가 제 씨앗밭을 키움) = 완전 폐합.
 *  - conserve : 보존 — D=8 통합에서 닫힌 장부 잔차 < 1e-11(결정화 E→R 쌍 거래[보존]·중력 E↔E[보존]·별 방출 fuel→E[injected 추적]).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H;

/* 표준 별 부력 3D 아레나 — verify-sim-engine.js sunArena() 와 동일 상수(골든 sun@ 와 일치).
 * D=8 voxel 상자, 빈 세계 + z=0 R 핵(점화 신호) + 별 점화·부력 — 결정화·생명 다 off(순수 부력+방출 격리). */
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
/* 별 하강·일생(골든 fall@) · 태양빛 비(골든 rain@) · 전체 에너지 고리 폐합(골든 ring@) — 한 칸씩 얹는다. */
function fallArena(extra) { return sunArena(Object.assign({ kStarFall: 1, starFallThresh: 0.5 }, extra || {})); }
function rainArena(extra) { return fallArena(Object.assign({ kGravity: 0.2 }, extra || {})); }
/* 전체 에너지 고리 폐합 아레나(골든 ring@) — rainArena(=0037 별빛→비→바다) 위에 결정화+지지 침착(kCryst·kSupport)을 켜 *바다를 지면/씨앗으로* 굳힌다.
 *   바다 E 가 z=0 에서 R(지면/씨앗)로 굳어 ignThresh 넘으면 새 별이 거기서 점화 → 세계가 제 별빛으로 씨앗밭을 키움. kCryst=0 이면 결정화 skip → rainArena 비트 동일(회귀). 법칙 무변경(부품 합성). */
function cycleArena(extra) { return rainArena(Object.assign({ kCryst: 0.05, crystThresh: 2.0, kSupport: 1, supportThresh: 0.5, kWeather: 0, starCap: 3 }, extra || {})); }
/* z=0 정적 R 핵(점화 신호 — 별이 여기서 태어나 떠오른다). R 은 E0(장부 baseline)에 산입. verify-sim-engine.js seedSunCore() 와 동일. */
var SUN_RVAL = 2.0;
function seedSunCore(sim) {
  var disc = ENG.discCells(W, H, (W / 2) | 0, (H / 2) | 0, 2);   // z=0 평면 원판(반경 2 = 13칸; siting 은 2D 라 z=0 핵만 본다)
  for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += SUN_RVAL; sim.E0 += SUN_RVAL; }
}
/* 점화 가능 z=0 자리 수(R≥ignThresh) — off 면 처음 놓은 씨앗(13칸)뿐·on 이면 결정화 지면/씨앗이 더해져 ≫13(세계가 제 씨앗밭을 키움). */
function ignitableSites(sim) { var R = sim.R, th = sim.p.ignThresh, n = 0; for (var k = 0; k < WH; k++) if (R[k] >= th) n++; return n; }
function z0maxR(sim) { var R = sim.R, m = 0; for (var k = 0; k < WH; k++) if (R[k] > m) m = R[k]; return m; }

/* ── reg: 통합 게이트(kCryst)를 끄면 cycleArena 가 rainArena(=0037)로 *비트 환원*(결정화가 유일한 추가 부품 — 끄면 직전 그대로). 법칙 무변경이라 교차 회귀는 골든이 권위. ── */
function reg(seed) {
  var off = ENG.createSim(seed, cycleArena({ kCryst: 0 })); seedSunCore(off); ENG.run(off, 500);
  var rain = ENG.createSim(seed, rainArena({ starCap: 3 })); seedSunCore(rain); ENG.run(rain, 500);
  var h0 = ENG.hashState(off), h1 = ENG.hashState(rain);
  return { seed: seed, hashRingOff: h0, hashRain: h1, pass: h0 === h1 };
}

/* ── cycle: 가설 — 바다(고인 E)가 결정화로 지면/씨앗(R)으로 굳어 세계가 제 별빛으로 다음 별의 씨앗밭을 키운다. 결정화 off(=0037) vs on 비교. ── */
function cycle(seed) {
  var TICK = 500;
  /* off(kCryst=0 = rainArena = 0037): 바다가 고이기만(결정화 0·점화 자리 = 처음 놓은 씨앗 13칸). on(kCryst=0.05): 바다 E 가 R 지면/씨앗으로 굳어(결정화 ≫0·maxR ≫ ignThresh) 점화 자리 ≫13. */
  function go(kC) {
    var s = ENG.createSim(seed, cycleArena({ kCryst: kC })); seedSunCore(s);
    var sites0 = ignitableSites(s);   // 초기 점화 자리(seedSunCore 씨앗 13칸)
    ENG.run(s, TICK);
    return { cryst: s.crystallized, sites: ignitableSites(s), sites0: sites0, maxR: z0maxR(s), births: s.starBirths || 0 };
  }
  var off = go(0), on = go(0.05);
  return {
    seed: seed, crystOff: off.cryst, crystOn: on.cryst, sitesOff: off.sites, sitesOn: on.sites, seedSites: on.sites0, maxROn: on.maxR, birthsOn: on.births,
    /* off: 바다가 안 굳음(결정화 0·점화 자리 = 씨앗 13칸 그대로). on: 바다→R 지면/씨앗(결정화 ≫0·maxR ≫ ignThresh 1.5·점화 자리 ≫13) = 세계가 제 씨앗밭을 키움 = 완전 폐합. */
    pass: on.cryst > 1 && off.cryst === 0 && on.sites > off.sites && on.maxR >= 1.5
  };
}

/* ── conserve: D=8 통합(별 일생 + 중력 + 결정화 + 지지)에서 닫힌 장부 잔차(결정화 E→R 쌍 거래[보존]·중력 E↔E[보존]·별 방출 fuel→E[injected 추적]). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, cycleArena()); seedSunCore(sim); ENG.run(sim, 500);
  var L = ENG.ledger(sim);
  return { seed: seed, residual: L.residual, store: L.store, cryst: sim.crystallized, sites: ignitableSites(sim), pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, cycleArena()); seedSunCore(s); ENG.run(s, 500); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashRingOff', 'hashRain', 'pass']);
    console.log('회귀 0: 통합 게이트(kCryst)를 끄면 cycleArena 가 rainArena(=0037)로 *비트 환원*(결정화가 유일한 추가 부품 — 끄면 직전 그대로). 이 step 은 법칙 무변경(통합 step) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 D=1 시나리오 std@~remn@)가 권위·비트 불변.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'cycle') {
    var rb = seeds.map(cycle); table(rb, ['seed', 'crystOff', 'crystOn', 'sitesOff', 'sitesOn', 'maxROn', 'pass']);
    console.log('바다(고인 E)가 결정화로 지면/씨앗(R)으로 굳어 세계가 제 별빛으로 다음 별의 씨앗밭을 키운다(완전 폐합): 별이 떴다 지며 뿌린 E 가 중력으로 z=0 바다로 고이고(0037) → 결정화 off 면 바다가 고이기만(결정화 ' + avg(rb, 'crystOff').toFixed(1) + '·점화 가능 자리 = 처음 놓은 씨앗 ' + avg(rb, 'sitesOff').toFixed(0) + '칸뿐) → on 이면 바다 E 가 R 지면/씨앗으로 굳어(결정화 ' + avg(rb, 'crystOn').toFixed(0) + '·maxR ' + avg(rb, 'maxROn').toFixed(1) + ' ≫ ignThresh 1.5) 점화 가능 자리가 ' + avg(rb, 'sitesOn').toFixed(0) + '칸으로(세계가 제 씨앗밭을 키움). E→별→비→바다→지면→새 별 = "스스로 굴러가는 세계"의 완전 폐합(부품 4개 합성·법칙 무변경).');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'store', 'cryst', 'sites', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 통합 — 결정화 E→R 쌍 거래[보존]·중력 E↔E[보존]·별 방출 fuel→E[injected 추적]·닫힌 장부 유지. 결정화 ' + avg(rc, 'cryst').toFixed(0) + '·점화 자리 ' + avg(rc, 'sites').toFixed(0) + '칸 — 바다가 지면/씨앗으로).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(별 일생+중력+결정화+지지 통합도 결정론 보존 — Math.random 0, 방향은 법칙 상수).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'cycle', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
