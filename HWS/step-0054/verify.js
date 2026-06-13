/* HWS step-0054 헤드리스 검증 — 명시적 질 배출(kQExport — 생명이 먹은 자리 residual q 강등, SPINE 여섯째 축의 슈뢰딩거 *엔트로피 export* 완성).
 * 0049 강등·0050 별 생산·0051 수송이 질 축을 깔고, 0052 주화성(질 따라 모임)·0053 대사(질 따라 먹음)로 생명이 질로 가고 질로 산다. 그러나 0049~0053 까지 생명은 q 를 *읽기만* 했다 — 먹어도 남은 E 의 질은 그대로였다(엔트로피 배출 미명시).
 *   이 step 은 생명이 *처음으로 q 를 쓴다*: metabolize(⑦)가 take 를 흡수할 때, 먹은 비율만큼 *남은 E 의 질을 깎는다* q[idx] *= (1 − kQExport·(take/Ebefore)). 생명은 고질(엑서지 높은) 크림을 걷어먹고(0053) 자리에 *저질 찌꺼기*만 남긴다 = 슈뢰딩거의 핵심(생명은 자유에너지를 먹어 제 질서를 유지하고 *그 대가로 환경에 엔트로피를 배출*한다). degrade(둘째 법칙·균일 식음)와 달리 *생명이 일한 자리에서만* 깎임 = 생명이 능동적으로 파는 *저질 그림자*.
 *   척추: q 는 E 에 올라탄 intensive 속성(단일 척추)·국소(제 disc 칸 q)·q 는 *비율*이라 강등은 E·m 미접촉(닫힌 장부 — degrade·advection 과 같은 경계, 엑서지 X 는 *파괴되는* 측정량). q 의 *첫 동역학적 쓰기*(0049 degrade 는 생명 무관 균일 강등·0050~0053 은 q 읽기/source).
 *   회귀(이중 가드): kQExport=0 → q[idx] 미접촉 바이트 동일(원식 그대로). qInit=false(degrade off)면 미진입. *교차 버전* 회귀는 verify-sim-engine.js 골든(qexp@ 포함 전 시나리오 비트 불변)이 권위.
 *
 * 사용: node step-0054/verify.js <reg|export|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kQExport=0 → q[idx] 미접촉(0053 비트 동일)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든이 권위.
 *  - export   : 가설 — *생명이 먹은 자리 질이 깎인다*. kQExport off vs on: 고질(q 0.9) 위 무리 footprint q. off 면 균일 강등만(q 높게 유지) → on 이면 무리가 자리 q 를 *능동적으로* 깎음(qFoot↓·저질 그림자).
 *  - conserve : 보존 — q-쓰기는 E·m 미접촉(q 는 비율) — 닫힌 장부 잔차 < 1e-12.
 *  - det      : 결정론 — 같은 시드 2회 비트 동일(상태 해시 일치 — q·agent.m 산입).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 질 배출 아레나 — verify-sim-engine.js qmetArena()/seedQMetab() 와 동일 상수(골든 qexp@ 와 일치 — qexp@ = qmet 셋업 + kQExport=1).
 * 2D(D=1), 평탄 E=2 + 두 q 구역(고질 0.9·저질 0.1·같은 E) + 정착 생명 두 무리(고질 위 3×3·저질 위 3×3·move off — 흡수 격리) + degrade(질 축 alive) + kQMetab=5(고질 우선 흡수) + mMaint 0(순수 m 누적). qInit0=0. 이 step 노브 kQExport 만 토글. */
function qmetArena(extra) {
  return Object.assign({}, {
    D: 1, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0.05, lifeR: 0,
    life: true, move: false, repro: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kStarQual: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kDegrade: 0.01, qInit0: 0, kQAdvect: 0, kQTaxis: 0, kQMetab: 5
  }, extra || {});
}
function seedQMetab(sim) {   // 평탄 E=2 + 고질(0.9)/저질(0.1) 두 구역 + 정착 생명 두 무리(고질 위 y=26~30·저질 위 y=36~40). q 축 alive.
  var p = sim.p, N = W * H, E = sim.E, q = sim.q, i, gx, gy;
  for (i = 0; i < N; i++) { E[i] = 2; sim.E0 += 2; q[i] = 0.1; }
  for (var y = 24; y < 32; y++) for (var x = 16; x < 26; x++) q[y * W + x] = 0.9;   // 고질 구역
  sim.qInit = true;
  for (gx = 0; gx < 3; gx++) for (gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 18 + gx * 2, 26 + gy * 2);   // 고질 무리(q 0.9)
  for (gx = 0; gx < 3; gx++) for (gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 18 + gx * 2, 36 + gy * 2);   // 저질 무리(q 0.1)
}
var TICKS = 12;
function build(seed, kqx, ticks) { var s = ENG.createSim(seed, qmetArena({ kQExport: kqx })); seedQMetab(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* footprint 질 — 고질 무리(center y<33)·저질 무리(y≥33) 가 차지한 칸의 평균 q. 위치로 분류(q 자체가 배출로 변하므로 q≥0.5 분류 불가).
 * 질 배출 척도: kQExport on 이면 무리가 *먹은 자리* q 가 깎여 qFoot↓ (생명이 판 저질 그림자). off 면 균일 강등만(높게 유지). */
function footStats(sim) {
  var ag = sim.agents, q = sim.q, W2 = sim.p.W, sh = 0, nh = 0, sl = 0, nl = 0;
  for (var i = 0; i < ag.length; i++) {
    var a = ag[i], y = Math.floor((a.center % (W2 * sim.p.H)) / W2);
    if (y < 33) { sh += q[a.center]; nh++; } else { sl += q[a.center]; nl++; }
  }
  return { qHigh: nh ? sh / nh : 0, qLow: nl ? sl / nl : 0, nHigh: nh, nLow: nl };
}

/* ── reg: 회귀 0 — kQExport=0 → q[idx] 미접촉(0053 비트 동일)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b), st = footStats(a);
  return { seed: seed, qHigh: st.qHigh, qLow: st.qLow, hashA: ha, hashB: hb, pass: ha === hb };
}

/* ── export: 가설 — 생명이 먹은 자리 질이 깎인다. kQExport off vs on(둘 다 kQMetab=5·고질/저질 두 무리). ── */
function exportH(seed) {
  var on = build(seed, 1, TICKS), off = build(seed, 0, TICKS);
  var sOn = footStats(on), sOff = footStats(off);
  var dHigh = sOff.qHigh - sOn.qHigh, dLow = sOff.qLow - sOn.qLow;   // 배출로 깎인 양(off−on) — 고질 자리서 훨씬 큼(걷어먹은 크림이 많아서)
  return {
    seed: seed, qHighOn: sOn.qHigh, qHighOff: sOff.qHigh, dHigh: dHigh, dLow: dLow,
    /* on: 고질 무리가 자리 q 를 능동적으로 깎음(qHighOn ≪ qHighOff). off: 균일 강등만 → 고질 자리 q 여전히 높음(>0.5). 배출은 *먹은 질에 비례*(dHigh ≫ dLow — 고질 크림을 더 걷어먹어 더 깎임). */
    pass: sOn.qHigh < sOff.qHigh * 0.5 && sOff.qHigh > 0.5 && dHigh > dLow * 3
  };
}

/* ── conserve: q-쓰기는 E·m 미접촉(q 는 비율) — 닫힌 장부 잔차. ── */
function conserve(seed) {
  var s = build(seed, 1, TICKS), L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, pass: L.residual < 1e-12 };
}

/* ── det: 같은 시드 2회 비트 동일(q·agent.m 가 해시에 산입). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 1, TICKS)), hb = ENG.hashState(build(seed, 1, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'qHigh', 'qLow', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kQExport=0 → q[idx] 미접촉(원식 그대로·0053 비트 동일) → 고질 무리 자리 q 균일 강등만 유지(qHigh≈' + avg(rr, 'qHigh').toFixed(3) + ')·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(qexp@ 포함 전 시나리오 비트 불변·새 노브 kQExport=0 → q 미접촉)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'export') {
    var rp = seeds.map(exportH); table(rp, ['seed', 'qHighOn', 'qHighOff', 'dHigh', 'dLow', 'pass']);
    console.log('생명이 *먹은 자리 질을 깎는다*(SPINE 여섯째 축 슈뢰딩거 엔트로피 export): D=1·평탄 E=2·고질(q 0.9)/저질(q 0.1) 두 구역·정착 생명 두 무리(kQMetab=5)·' + TICKS + ' tick. kQExport OFF 면 균일 강등만이라 고질 무리 자리 q 높게 유지(qHigh ' + avg(rp, 'qHighOff').toFixed(3) + '>0.5) → ON 이면 무리가 제 자리 q 를 능동적으로 깎음(qHigh ' + avg(rp, 'qHighOn').toFixed(3) + ' ≪ OFF). 배출은 *먹은 질에 비례*(고질 자리 깎임 ' + avg(rp, 'dHigh').toFixed(3) + ' ≫ 저질 자리 ' + avg(rp, 'dLow').toFixed(3) + ' — 고질 크림을 더 걷어먹어) = 생명이 자유에너지를 먹고 엔트로피를 *배출*한다(저질 그림자). q-쓰기는 E·m 미접촉(q 는 비율)·국소(제 disc 칸)·생명이 일한 자리에서만(degrade 균일과 대비).');
    return rp.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (q-쓰기는 E·m 미접촉 — q 는 *비율*[strength 1−frac 곱은 질만, 에너지 아님·degrade·advection 과 같은 읽기/쓰기 경계]. 닫힌 장부 유지·엑서지 X 는 파괴되는 측정량).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 상태 해시 일치(q·agent.m 가 해시에 산입·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'export', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
