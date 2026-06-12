/* HWS step-0039 헤드리스 검증 — 죽은 별 잔해→새 씨앗(VOXEL.md V5+ — 0038 일몰사 위에 얹음. 0038 은 진 별이 z=0 서 *흔적 없이* 사라졌다[잔해 없음]. 이 step 은 일몰사로 지는 별이 무덤[z=0]에 미연소 외부 연료의 일부를 저장체 R 로 남겨 다음 별의 점화 씨앗이 되게 한다 — 出沒生死 → 잔해 → 재구성 → 다음 별).
 * 새 노브(law-pipeline): ignite 법칙에 잔해 침착 z-항. 노브 1개(kAshSeed) + LAW_ORDER 무변경(ignite 제자리 확장, 0035·0036·0038 위에 얹음).
 *   변경점: DEFAULTS.kAshSeed(잔해→씨앗 분율, 기본 0) · 일몰사로 z=0 에서 꺼지는 별의 미연소 연료 × kAshSeed 가 그 자리(무덤) R 로 가라앉는다(+E0 같은 만큼 보정=닫힌 장부).
 *   kAshSeed=0 이면 잔해 침착 미진입(0038 비트 동일). D=1·rise off 면 일몰사 미발생(st.rose 안 켜짐) → 잔해 침착 도달 못 함 = 비트 동일(이중 가드).
 *   장부: 별 연료 F 는 외부 질량(lhs 밖) → R 로 들이며 E0 를 같은 만큼 올려 보존(seedSunCore·source harvest 와 같은 외부 유입 보정 — sunk 의 역). 비가역 死라도 장부 닫힘.
 *
 * 사용: node step-0039/verify.js <reg|remnant|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kAshSeed 값 무관 비트 동일(일몰사 미발생 → 잔해 침착 미진입). *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든 해시(전 D=1 시나리오 std@~death@ 비트 불변 — 새 노브=0)가 권위.
 *  - remnant  : 가설 — *진 별이 무덤(z=0)에 R 잔해를 남겨 세계의 저장체가 늘어난다(씨앗 갱신)*. 일몰사(=0038) 위에 잔해 침착 켜고/끄고 비교:
 *               off(=0038) 면 진 별이 흔적 없이 사라져 R 증가 0(ΔR≈0) — on 이면 무덤마다 R 잔해가 쌓여 R 증가>0(ΔR>0) = 出沒生死 → 잔해 재구성.
 *  - conserve : 보존 — D=8 잔해 침착에서 닫힌 장부 잔차 < 1e-11(연료 F[외부 질량]가 R 로 들며 E0 보정 → 닫힌 장부 유지).
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, WH = W * H;

/* 표준 별 부력 3D 아레나 — verify-sim-engine.js sunArena() 와 동일 상수(골든 sun@ 와 일치).
 * D=8 voxel 상자, 빈 세계 + z=0 R 핵(점화 신호) + 별 점화·부력 — 중력·결정화·생명 다 off(순수 부력+방출+죽음+잔해 격리). starCap=1 단일 별. */
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
/* 별 하강·일생 아레나(골든 fall@) · 일몰사 아레나(골든 death@) · 잔해→씨앗 아레나(골든 remn@) — 한 칸씩 얹는다. */
function fallArena(extra) { return sunArena(Object.assign({ kStarFall: 1, starFallThresh: 0.5 }, extra || {})); }
function deathArena(extra) { return fallArena(Object.assign({ kStarSet: 1 }, extra || {})); }
/* 죽은 별 잔해→씨앗 아레나(골든 remn@) — deathArena(=0038 일몰사) 위에 잔해 침착(kAshSeed=0.5)을 켠다.
 *   일몰사로 지는 별이 z=0 무덤에서 꺼질 때 미연소 연료 절반을 그 자리 R 로 남긴다. kAshSeed=0 이면 침착 미진입 → deathArena 비트 동일(회귀). */
function remnArena(extra) { return deathArena(Object.assign({ kAshSeed: 0.5 }, extra || {})); }
/* z=0 정적 R 핵(점화 신호 — 별이 여기서 태어나 떠오른다·죽으면 다음 별이 또 여기서 난다). R 은 E0(장부 baseline)에 산입. verify-sim-engine.js seedSunCore() 와 동일. */
var SUN_RVAL = 2.0;
function seedSunCore(sim) {
  var disc = ENG.discCells(W, H, (W / 2) | 0, (H / 2) | 0, 2);   // z=0 평면 원판(인덱스 y·W+x = z=0; siting 은 2D 라 z=0 핵만 본다)
  for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += SUN_RVAL; sim.E0 += SUN_RVAL; }
}
function totalR(sim) { var R = sim.R, s = 0; for (var i = 0; i < R.length; i++) s += R[i]; return s; }

/* ── reg: D=1 에선 kAshSeed 값이 비트 동일을 안 깬다(일몰사 미발생 → 잔해 침착 미진입). 전체 스택(별 부력·하강·일몰사 포함)을 굴려 확인 — 잔해 침착이 2D 레거시를 한 비트도 안 건드림. ── */
function reg(seed) {
  function go(kSeed) {
    var s = ENG.createSim(seed, {
      D: 1, initE: 1.0, noise: 0.5, drive: true,
      source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
      kD: 0.2, kEvap: 0.001, kA: 0.45, aggMc: 1.1, aggW: 0.7, baseCost: 0.05,
      kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0,
      kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20,
      kCrowd: 0.20, kFSM: 1, kFlux: 1, kTemplate: 1, kInherit: 1, kStarRise: 1, kStarFall: 1, starFallThresh: 0.5, kStarSet: 1, kAshSeed: kSeed
    });
    ENG.run(s, 800); return ENG.hashState(s);
  }
  var h0 = go(0), h1 = go(0.5);
  return { seed: seed, hashSeed0: h0, hashSeed1: h1, pass: h0 === h1 };
}

/* ── remnant: 가설 — 진 별이 무덤(z=0)에 R 잔해를 남겨 세계 저장체가 늘어난다(씨앗 갱신). 잔해 침착 off(=0038) vs on 비교. ── */
function remnant(seed) {
  var TICK = 200;
  /* off(kAshSeed=0 = deathArena = 0038): 진 별이 흔적 없이 사라짐 → R 증가 없음(ΔR≈0). on(kAshSeed=0.5): 무덤마다 미연소 연료 절반이 R 로 → R 증가>0(ΔR>0). */
  function go(kSeed) {
    var s = ENG.createSim(seed, deathArena({ kAshSeed: kSeed })); seedSunCore(s);
    var R0 = totalR(s);   // 초기 R(seedSunCore 핵)
    ENG.run(s, TICK);
    return { dR: totalR(s) - R0, deaths: s.starDeaths || 0, seeded: s.ashSeeded || 0, births: s.starBirths || 0 };
  }
  var off = go(0), on = go(0.5);
  return {
    seed: seed, dROff: off.dR, dROn: on.dR, deathsOff: off.deaths, deathsOn: on.deaths, seededOn: on.seeded, birthsOn: on.births,
    /* off: 죽어도 R 잔해 0(ΔR≈0). on: 무덤마다 R 잔해(ΔR>0·seeded>0) = 出沒生死 → 잔해 재구성 → 다음 별 씨앗. */
    pass: on.dR > 1.0 && Math.abs(off.dR) < 1e-9 && on.seeded > 0 && on.deaths > 0
  };
}

/* ── conserve: D=8 잔해 침착에서 닫힌 장부 잔차(연료 F[외부 질량]가 R 로 들며 E0 보정 → 닫힌 장부 유지). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, remnArena()); seedSunCore(sim); ENG.run(sim, 200);
  var L = ENG.ledger(sim);
  return { seed: seed, residual: L.residual, store: L.store, seeded: sim.ashSeeded || 0, deaths: sim.starDeaths || 0, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, remnArena()); seedSunCore(s); ENG.run(s, 200); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashSeed0', 'hashSeed1', 'pass']);
    console.log('회귀 0: D=1 에선 kAshSeed=0 과 0.5 가 비트 동일(일몰사 미발생 → 잔해 침착 미진입 = 2D 레거시 불변). *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 D=1 시나리오 std@~death@, 새 노브=0)가 권위·비트 불변.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'remnant') {
    var rb = seeds.map(remnant); table(rb, ['seed', 'dROff', 'dROn', 'deathsOff', 'deathsOn', 'seededOn', 'pass']);
    console.log('진 별이 무덤(z=0)에 R 잔해를 남겨 세계 저장체가 늘어난다(씨앗 갱신): 일몰사(0038)로 별이 z=0 서 꺼질 때 → 잔해 침착 off 면 흔적 없이 사라져 R 증가 ' + avg(rb, 'dROff').toExponential(2) + '(≈0) → on 이면 무덤마다 미연소 연료 절반이 R 로 가라앉아 R 증가 ' + avg(rb, 'dROn').toFixed(1) + '(누적 잔해 ' + avg(rb, 'seededOn').toFixed(1) + '·사망 ' + avg(rb, 'deathsOn').toFixed(0) + '회). 出沒生死 → 잔해 → 재구성: 별의 외부 질량이 세계 안 저장체로 내생화 → 다음 별의 점화 씨앗.');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'store', 'seeded', 'deaths', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 잔해 침착 — 연료 F[외부 질량]가 R 로 들며 E0 를 같은 만큼 올려 닫힌 장부 유지. 누적 잔해 ' + avg(rc, 'seeded').toFixed(1) + '·사망 ' + avg(rc, 'deaths').toFixed(0) + '회 — 비가역 死라도 보존).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(별 잔해→씨앗·세대 재구성도 결정론 보존 — Math.random 0, 무덤 위치는 별의 결정론 궤적).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'remnant', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
