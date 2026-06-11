/* HWS step-0038 헤드리스 검증 — 별 죽음·일몰사(VOXEL.md V5+ — 0036 하강 + 0013 FSM ash 연계. 0036 은 진 별이 z=0 서 *계속 탔다*[정직한 한계]. 이 step 은 떴다 진 별이 바닥[지평선]에 닿으면 *꺼지게* 해 활성도 축을 *닫힌 궤적*으로 만든다 — born→천장→set→死→다음 별).
 * 새 노브(law-pipeline): ignite 법칙에 일몰사 z-항. 노브 1개(kStarSet) + LAW_ORDER 무변경(ignite 제자리 확장, 0035·0036 위에 얹음).
 *   변경점: DEFAULTS.kStarSet(일몰사 게이트, 기본 0) · 떠올랐다(st.rose) 다시 지는(dying) 별이 z=0(지평선)에 닿으면 꺼진다(FSM on=ash·off=즉시 제거). 연료 남아도 *짐* 자체가 죽음. 빈 starCap 자리에 R 핵서 다음 별 점화 → 세대 순환(出沒生死).
 *   kStarSet=0 이면 죽음·st.rose 미진입(0037 비트 동일). D=1·rise off 면 st.z 가 1 못 됨 → st.rose 안 켜짐 → 죽음 미발생 = 비트 동일(이중 가드). hashState 는 st.rose·st.z 미해싱(x·y·fuel·state 만).
 *   장부: 별 연료 F 는 장부 방정식(sumE+M+R+evap+sunk+metab−injected=E0)에 *안 든다* — 외부 질량이라 burned 될 때만 injected 로 산입. 그래서 연료 남긴 채 죽어도 보존 무관(미연소 연료=애초에 장부에 없던 대기 에너지).
 *
 * 사용: node step-0038/verify.js <reg|death|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — D=1 에선 kStarSet 값 무관 비트 동일(st.z 가 1 못 됨 → st.rose 안 켜짐 → 죽음 미발생). *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든 해시(전 D=1 시나리오 std@~rain@ 비트 불변 — 새 노브=0)가 권위.
 *  - death    : 가설 — *떴다 진 별이 지평선(z=0)에 닿으면 꺼지고, 빈 자리에 다음 별이 난다(세대 순환)*. z=0 R 핵서 별 점화·부력·하강(=0036) 위에 일몰사 켜고/끄고 비교:
 *               off(=0036) 면 진 별이 z=0 서 계속 타 200t 안 안 죽음(출생 1·사망 0) — on 이면 지며 꺼지고 R 핵서 다음 별 점화(출생↑·사망↑) = 出沒生死 순환.
 *  - conserve : 보존 — D=8 일몰사에서 닫힌 장부 잔차 < 1e-11(별 죽음은 위치/상태만·연료 F 는 장부 항 아님 → 연료 남기고 죽어도 보존).
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
/* 별 일몰사 아레나(골든 death@ 와 동일) — fallArena(=0036 별 일생) 위에 일몰사(kStarSet=1)를 켠다.
 *   떠올랐다 다시 지는 별이 z=0(지평선)에 닿으면 꺼지고, 빈 starCap 자리에 R 핵서 다음 별이 난다(세대 순환). kStarSet=0 이면 죽음 미진입 → fallArena 비트 동일(회귀). */
function deathArena(extra) { return fallArena(Object.assign({ kStarSet: 1 }, extra || {})); }
/* z=0 정적 R 핵(점화 신호 — 별이 여기서 태어나 떠오른다·죽으면 다음 별이 또 여기서 난다). R 은 E0(장부 baseline)에 산입. verify-sim-engine.js seedSunCore() 와 동일. */
var SUN_RVAL = 2.0;
function seedSunCore(sim) {
  var disc = ENG.discCells(W, H, (W / 2) | 0, (H / 2) | 0, 2);   // z=0 평면 원판(인덱스 y·W+x = z=0; siting 은 2D 라 z=0 핵만 본다)
  for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += SUN_RVAL; sim.E0 += SUN_RVAL; }
}

/* ── reg: D=1 에선 kStarSet 값이 비트 동일을 안 깬다(st.z 가 1 못 됨 → st.rose 안 켜짐 → 죽음 미발생). 전체 스택(별 부력·하강 포함)을 굴려 확인 — 일몰사가 2D 레거시를 한 비트도 안 건드림. ── */
function reg(seed) {
  function go(kSet) {
    var s = ENG.createSim(seed, {
      D: 1, initE: 1.0, noise: 0.5, drive: true,
      source: { x: 16, y: 16, r: 3, rate: 0.05 }, sink: { x: 48, y: 48, r: 4, rate: 0.10 },
      kD: 0.2, kEvap: 0.001, kA: 0.45, aggMc: 1.1, aggW: 0.7, baseCost: 0.05,
      kCryst: 0.01, crystThresh: 2.0, kWeather: 0.0003, kRelief: 1.0, pTumble: 1.0,
      kIgnite: 1, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 10, starGap: 6, starR: 3, starDriftPeriod: 20,
      kCrowd: 0.20, kFSM: 1, kFlux: 1, kTemplate: 1, kInherit: 1, kStarRise: 1, kStarFall: 1, starFallThresh: 0.5, kStarSet: kSet
    });
    ENG.run(s, 800); return ENG.hashState(s);
  }
  var h0 = go(0), h1 = go(1);
  return { seed: seed, hashSet0: h0, hashSet1: h1, pass: h0 === h1 };
}

/* ── death: 가설 — 떴다 진 별이 지평선(z=0)에 닿으면 꺼지고, 빈 자리에 다음 별이 난다(出沒生死 순환). 일몰사 off(=0036) vs on 비교. ── */
function death(seed) {
  var TICK = 200;
  /* off(kStarSet=0 = fallArena = 0036): 진 별이 z=0 서 *계속 탄다* → 200t 안 연료 소진 전이라 안 죽음(출생 1·사망 0). on(kStarSet=1): 지며 꺼지고 R 핵서 다음 별 점화 → 세대 순환(출생↑·사망↑). */
  function go(kSet) {
    var s = ENG.createSim(seed, fallArena({ kStarSet: kSet })); seedSunCore(s);
    ENG.run(s, TICK);
    return { births: s.starBirths || 0, deaths: s.starDeaths || 0, alive: s.stars.length };
  }
  var off = go(0), on = go(1);
  return {
    seed: seed, birthsOff: off.births, birthsOn: on.births, deathsOff: off.deaths, deathsOn: on.deaths, aliveOff: off.alive, aliveOn: on.alive,
    /* off: 한 별이 죽지 않고 계속 탐(출생 1·사망 0). on: 지며 죽고 다음 별이 남(출생>off·사망>off) = 활성도 축의 닫힌 궤적·세대 순환. */
    pass: on.deaths > off.deaths && on.births > off.births
  };
}

/* ── conserve: D=8 일몰사에서 닫힌 장부 잔차(별 죽음은 위치/상태만 — 연료 F 는 장부 항 아님[외부 질량] → 연료 남기고 죽어도 보존). ── */
function conserve(seed) {
  var sim = ENG.createSim(seed, deathArena()); seedSunCore(sim); ENG.run(sim, 200);
  var L = ENG.ledger(sim);
  return { seed: seed, residual: L.residual, sumE: L.sumE, injected: sim.injected, deaths: sim.starDeaths || 0, pass: L.residual < 1e-11 };
}

/* ── det: D=8 같은 시드 2회 비트 동일. ── */
function det(seed) {
  function go() { var s = ENG.createSim(seed, deathArena()); seedSunCore(s); ENG.run(s, 200); return ENG.hashState(s); }
  var ha = go(), hb = go();
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'hashSet0', 'hashSet1', 'pass']);
    console.log('회귀 0: D=1 에선 kStarSet=0 과 1 이 비트 동일(st.z 가 1 못 됨 → st.rose 안 켜짐 → 일몰사 미발생 = 2D 레거시 불변). *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 D=1 시나리오 std@~rain@, 새 노브=0)가 권위·비트 불변.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'death') {
    var rb = seeds.map(death); table(rb, ['seed', 'birthsOff', 'birthsOn', 'deathsOff', 'deathsOn', 'aliveOn', 'pass']);
    console.log('떴다 진 별이 지평선(z=0)에 닿으면 꺼지고 빈 자리에 다음 별이 난다(出沒生死 순환): z=0 R 핵서 별이 떴다 지며(0036) → 일몰사 off 면 진 별이 z=0 서 계속 타 200t 안 안 죽음(출생 ' + avg(rb, 'birthsOff').toFixed(0) + '·사망 ' + avg(rb, 'deathsOff').toFixed(0) + ') → on 이면 지며 꺼지고 R 핵서 다음 별 점화(출생 ' + avg(rb, 'birthsOn').toFixed(0) + '·사망 ' + avg(rb, 'deathsOn').toFixed(0) + '). 활성도 연속축이 *닫힌 궤적*(born→천장→set→死→다음)으로 — "구동이 세계서 나고 진다"가 *세대 순환*으로.');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'injected', 'deaths', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (D=8 일몰사 — 별 죽음은 위치/상태만, 연료 F 는 장부 항 아님[외부 질량·burned 될 때만 injected]·닫힌 장부 유지. 사망 ' + avg(rc, 'deaths').toFixed(0) + '회 — 연료 남기고 죽어도 보존).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(별 일몰사·세대 순환도 결정론 보존 — Math.random 0, 방향은 법칙 상수).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'death', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
