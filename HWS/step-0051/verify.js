/* HWS step-0051 헤드리스 검증 — q advection(kQAdvect — 질이 gravity 하향 유출에 동승 → 침강 hot plume, SPINE 여섯째 축의 *수송* 짝).
 * 0049 가 질 축 q∈[0,1] + 둘째 법칙 강등(sink)을, 0050 이 별 질 생산(source)을 깔았다. 그러나 질은 아직 *셀 고정* — E 가 움직여도 q 는 제자리(하강 E 가 제 열을 *안* 데려감 → 질이 떠난 자리에 stranded).
 *   이 step 은 질을 E 흐름에 *동승*시킨다: gravity(①g)가 셀 E 의 일부를 아래(z−1)로 유출할 때, 그 흐른 E 의 질(donor q)을 받는 칸에 질량가중 혼합으로 싣는다 → 하강하는 고질 E 가 제 열을 데리고 내려간다 = 침강 hot plume(별빛 hot rain 이 질을 데리고 바다로).
 *   척추: q 는 E 에 올라탄 intensive 속성(단일 척추)·국소(제 z−1 한 칸)·혼합은 E 미접촉(장부 불변 — gravity 가 이미 옮긴 E 의 *질*만 따라감, q 는 비율). 0050 source·0049 sink 의 *수송* 짝.
 *   회귀(이중 가드): kQAdvect=0 → advection 미진입(0050 비트 동일·하강 E 가 질 안 데려감). qInit=false(degrade off)면 미진입. *교차 버전* 회귀는 verify-sim-engine.js 골든(qadv@ 포함 전 시나리오 비트 불변)이 권위.
 *
 * 사용: node step-0051/verify.js <reg|plume|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kQAdvect=0 → 하강 E 가 질 안 데려감(바닥 질 qPool≈0)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든이 권위.
 *  - plume    : 가설 — *질이 E 흐름에 동승한다*. kQAdvect off vs on: 둘 다 gravity 가 천장 E 를 z=0 바다로 침전(ePoolFrac↑·같음). off 면 질이 천장에 stranded(바닥 qPool≈0) → on 이면 질이 E 따라 내려와 바닥이 고질(qPool↑) = 침강 hot plume.
 *  - conserve : 보존 — advection 은 E 미접촉(gravity 가 옮긴 E 의 질만 따라감) — 닫힌 장부 잔차 < 1e-12.
 *  - det      : 결정론 — D=8 같은 시드 2회 비트 동일(상태 해시 일치 — q 가 해시에 산입).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H, DZ = 8;

/* q advection 아레나 — verify-sim-engine.js qadvArena()/seedQTop() 와 동일 상수(골든 qadv@ 와 일치).
 * D=8 voxel, 천장(z=D−1) 고질 E 블록 + gravity(하향 침전) + degrade(질 축 alive) + kQAdvect(질 동승). 확산·별·생명 다 off(순수 하향 수송). qInit0=0(냉각 — 천장만 고질). */
function qadvArena(extra) {
  return Object.assign({}, {
    D: DZ, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
    kGravity: 0.3, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kStarQual: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kMoveZ: 0, kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kDegrade: 0.01, qInit0: 0, kQAdvect: 0
  }, extra || {});
}
function seedQTop(sim) {   // 천장(z=D−1) 평면에 고질 E 블록 — gravity 가 침전시키며 advection 이 질을 데리고 내려간다. q 축 alive.
  var p = sim.p, WH = p.W * p.H, top = (p.D - 1) * WH, k;
  for (k = 0; k < WH; k++) { sim.E[top + k] = 10; sim.E0 += 10; sim.q[top + k] = 1; }
  sim.qInit = true;
}
var TICKS = 30;
function build(seed, kqa, ticks) { var s = ENG.createSim(seed, qadvArena({ kQAdvect: kqa })); seedQTop(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* 바닥(z=0) 평면 통계: ePoolFrac(전체 E 중 z=0 분율 — gravity 침전 척도)·qPool(z=0 의 엑서지가중 평균 질 — advection 이 질을 데려왔는가). */
function poolStats(sim) {
  var p = sim.p, WH = p.W * p.H, E = sim.E, q = sim.q, N = E.length, eps = 1e-9, i;
  var tot = 0; for (i = 0; i < N; i++) tot += E[i];
  var sw = 0, swq = 0;
  for (i = 0; i < WH; i++) { if (E[i] <= eps) continue; sw += E[i]; swq += q[i] * E[i]; }
  return { ePoolFrac: tot > 0 ? sw / tot : 0, qPool: sw > 0 ? swq / sw : 0 };
}

/* ── reg: 회귀 0 — kQAdvect=0 → 하강 E 가 질 안 데려감(바닥 qPool≈0)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b), st = poolStats(a);
  return { seed: seed, qPool: st.qPool, ePoolFrac: st.ePoolFrac, hashA: ha, hashB: hb, pass: ha === hb && st.qPool < 0.01 };
}

/* ── plume: 가설 — 질이 E 흐름에 동승한다. kQAdvect off vs on 비교(둘 다 gravity 침전). ── */
function plume(seed) {
  var on = build(seed, 1, TICKS), off = build(seed, 0, TICKS);
  var sOn = poolStats(on), sOff = poolStats(off);
  return {
    seed: seed, qPoolOn: sOn.qPool, qPoolOff: sOff.qPool, ePoolOn: sOn.ePoolFrac, ePoolOff: sOff.ePoolFrac,
    /* on: 질이 E 따라 내려와 바닥 고질(qPool↑). off: 질이 천장에 stranded(바닥 qPool≈0). 둘 다 gravity 가 E 를 z=0 으로 침전(ePoolFrac 같음). */
    pass: sOn.qPool > 0.5 && sOff.qPool < 0.01 && sOn.ePoolFrac > 0.8 && Math.abs(sOn.ePoolFrac - sOff.ePoolFrac) < 1e-9
  };
}

/* ── conserve: advection 은 E 미접촉 — 닫힌 장부 잔차. ── */
function conserve(seed) {
  var s = build(seed, 1, TICKS), L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, pass: L.residual < 1e-12 };
}

/* ── det: D=8 같은 시드 2회 비트 동일(q 가 해시에 산입). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 1, TICKS)), hb = ENG.hashState(build(seed, 1, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'qPool', 'ePoolFrac', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kQAdvect=0 → advection 미진입 → 하강 E 가 질 안 데려감(바닥 qPool≈0 — 천장에 stranded)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(qadv@ 포함 전 시나리오 비트 불변·새 노브 kQAdvect=0 → q 미접촉)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'plume') {
    var rp = seeds.map(plume); table(rp, ['seed', 'qPoolOn', 'qPoolOff', 'ePoolOn', 'ePoolOff', 'pass']);
    console.log('질이 E 흐름에 *동승*한다(SPINE 여섯째 축 수송 짝): D=8·천장 고질 E 블록·gravity 0.3·degrade 0.01·' + TICKS + ' tick. 둘 다 gravity 가 천장 E 를 z=0 바다로 침전(ePoolFrac ' + avg(rp, 'ePoolOn').toFixed(3) + '·동일) — kQAdvect OFF 면 질이 천장에 stranded(바닥 qPool ' + avg(rp, 'qPoolOff').toFixed(3) + ') → ON 이면 질이 E 따라 내려와 바닥이 고질(qPool ' + avg(rp, 'qPoolOn').toFixed(3) + ') = 침강 hot plume(하강 E 가 제 열을 데리고 내려감). advection 은 E 미접촉(질만 동승)·국소(제 z−1 한 칸)·intensive(단일 척추).');
    return rp.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (advection 은 E 를 안 건드린다 — gravity 가 이미 옮긴 E 의 *질*만 따라감, q 는 비율[A·강등·별 질과 같은 경계]. 닫힌 장부 유지).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: D=8 같은 시드 2회 상태 해시 일치(q 가 해시에 산입·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'plume', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
