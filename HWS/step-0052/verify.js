/* HWS step-0052 헤드리스 검증 — 질-구배 주화성(kQTaxis — 생명이 *질 구배*[엑서지]를 따라 오른다, SPINE 여섯째 축의 *동역학 첫 되먹임*·슈뢰딩거 낙차).
 * 0049 가 질 축 q∈[0,1] + 둘째 법칙 강등을, 0050 이 별 질 생산을, 0051 이 질 수송(advection)을 깔았다 — 질이 만들어지고·사라지고·흐르는 완전한 물리장이 됐다. 그러나 질은 아직 *읽기 전용*(생명이 질 무관 — 그저 E 많은 곳을 쫓음).
 *   이 step 은 질을 처음으로 *동역학에 되먹인다*: move(주화성 run)의 이웃 비교를 *질 가중 끌개* att = E·(1 + kQTaxis·q) 로 바꾼다 → 생명이 그저 E 많은 곳이 아니라 *질 좋은(고 q = 엑서지 높은) E* 로 모인다(슈뢰딩거: 생명은 *자유에너지*[저엔트로피 질]로 산다 — 양이 아니라 질의 낙차로).
 *   척추: q 는 E 에 올라탄 intensive 상태변수(측정값 아님 — 둘째 척추 아님·SPINE 여섯째 축이 의도한 동역학화)·국소(제 이웃 q 만)·move 는 여전히 q 를 *읽기만*(미수정·E 미접촉·위치만 — 장부 거래 0).
 *   회귀(이중 가드): kQTaxis=0 → att = E·(1+0) = E 바이트 동일(순수 E 주화성·q 미참조). qInit=false(degrade off)면 미진입. *교차 버전* 회귀는 verify-sim-engine.js 골든(qtax@ 포함 전 시나리오 비트 불변)이 권위.
 *
 * 사용: node step-0052/verify.js <reg|taxis|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kQTaxis=0 → 순수 E 주화성(평탄 E 라 생명 안 움직임·meanQ=초기 베이스라인 낮음)·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든이 권위.
 *  - taxis    : 가설 — *생명이 질 구배를 따라 오른다*. kQTaxis off vs on: 평탄 E·방사형 고질 q 원뿔. off 면 생명이 안 움직여 시작 자리 저질에 머묾(meanQ↓) → on 이면 q 따라 중앙 고질로 모임(meanQ↑) = 엑서지 추종.
 *  - conserve : 보존 — 주화성은 위치만(q 읽기·E 미접촉) — 닫힌 장부 잔차 < 1e-12.
 *  - det      : 결정론 — 같은 시드 2회 비트 동일(상태 해시 일치 — q·agent 위치가 해시에 산입).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var W = ENG.DEFAULTS.W, H = ENG.DEFAULTS.H;

/* 질-구배 주화성 아레나 — verify-sim-engine.js qtaxArena()/seedQHill() 와 동일 상수(골든 qtax@ 와 일치).
 * 2D(D=1), 평탄 E=1(noise 0·kL 0·drive off — E 가 안 변해 *유일한* 방향 신호가 q) + 중앙(32,32) 방사형 고질 q 원뿔(반경 24) + degrade(질 축 alive) + 생명 3×3(중심서 ~17칸). qInit0=0. */
function qtaxArena(extra) {
  return Object.assign({}, {
    D: 1, initE: 0, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, mMaint: 0, mDeath: 0, kL: 0, lifeR: 0,
    life: true, move: true, repro: false, moveR: 1, moveThresh: 0.02, pTumble: 0, kMoveZ: 0,
    kGravity: 0, kCollapse: 0, kCryst: 0, kWeather: 0, kSupport: 0, kOcclude: 0,
    kIgnite: 0, kStarRise: 0, kStarFall: 0, kStarSet: 0, kAshSeed: 0, kStarQual: 0, kFSM: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
    kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0,
    kDivZ: 0, kCrowdZ: 0, kAdhereZ: 0, kShareZ: 0, kInheritZ: 0, kCoupleZ: 0,
    kDegrade: 0.01, qInit0: 0, kQAdvect: 0, kQTaxis: 5
  }, extra || {});
}
function seedQHill(sim) {   // 평탄 E=1 + 중앙(32,32) 방사형 고질 q 원뿔(반경 24 내 선형) + 생명 3×3(중심서 ~17칸 — 원뿔 안). q 축 alive.
  var p = sim.p, N = W * H, E = sim.E, q = sim.q, cx = 32, cy = 32, RQ = 24, qHi = 0.95, qLo = 0.05, i, x, y;
  for (i = 0; i < N; i++) { E[i] = 1; sim.E0 += 1; }
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var dx = Math.min((x - cx + W) % W, (cx - x + W) % W), dy = Math.min((y - cy + H) % H, (cy - y + H) % H);   // 토러스 거리
    var d = Math.sqrt(dx * dx + dy * dy), t = d < RQ ? 1 - d / RQ : 0;     // 원뿔(반경 밖 평탄 qLo)
    q[(y * W + x)] = qLo + (qHi - qLo) * t;
  }
  sim.qInit = true;
  for (var gx = 0; gx < 3; gx++) for (var gy = 0; gy < 3; gy++) ENG.spawnAgent(sim, 18 + gx * 2, 18 + gy * 2);   // 중심서 ~17칸(원뿔 안) → 질 따라 중앙으로 오른다
}
var TICKS = 24;
function build(seed, kqt, ticks) { var s = ENG.createSim(seed, qtaxArena({ kQTaxis: kqt })); seedQHill(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* 생명 통계: meanQ(생명 점유 칸의 평균 질 — 질 추종 척도)·meanDist(생명의 중심[32,32]까지 평균 거리 — 모임 척도). */
function lifeStats(sim) {
  var ag = sim.agents, q = sim.q, n = ag.length, sq = 0, sd = 0;
  for (var i = 0; i < n; i++) {
    var a = ag[i]; sq += q[a.center];
    var dx = Math.min((a.x - 32 + W) % W, (32 - a.x + W) % W), dy = Math.min((a.y - 32 + H) % H, (32 - a.y + H) % H);
    sd += Math.sqrt(dx * dx + dy * dy);
  }
  return { meanQ: n ? sq / n : 0, meanDist: n ? sd / n : 0, n: n };
}

/* ── reg: 회귀 0 — kQTaxis=0 → 순수 E 주화성(평탄 E 라 생명 안 움직임·meanQ 낮음)·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, TICKS), b = build(seed, 0, TICKS);
  var ha = ENG.hashState(a), hb = ENG.hashState(b), st = lifeStats(a);
  return { seed: seed, meanQ: st.meanQ, meanDist: st.meanDist, hashA: ha, hashB: hb, pass: ha === hb && st.meanQ < 0.4 };
}

/* ── taxis: 가설 — 생명이 질 구배를 따라 오른다. kQTaxis off vs on(둘 다 평탄 E·방사형 q 원뿔). ── */
function taxis(seed) {
  var on = build(seed, 5, TICKS), off = build(seed, 0, TICKS);
  var sOn = lifeStats(on), sOff = lifeStats(off);
  return {
    seed: seed, meanQOn: sOn.meanQ, meanQOff: sOff.meanQ, distOn: sOn.meanDist, distOff: sOff.meanDist,
    /* on: q 따라 중앙 고질로 모임(meanQ↑·meanDist↓). off: 평탄 E 라 안 움직임(시작 저질 자리 유지·meanQ↓·meanDist 그대로). */
    pass: sOn.meanQ > 0.6 && sOff.meanQ < 0.4 && sOn.meanQ > sOff.meanQ && sOn.meanDist < sOff.meanDist
  };
}

/* ── conserve: 주화성은 위치만(q 읽기·E 미접촉) — 닫힌 장부 잔차. ── */
function conserve(seed) {
  var s = build(seed, 5, TICKS), L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, pass: L.residual < 1e-12 };
}

/* ── det: 같은 시드 2회 비트 동일(q·agent 위치가 해시에 산입). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 5, TICKS)), hb = ENG.hashState(build(seed, 5, TICKS));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'meanQ', 'meanDist', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kQTaxis=0 → att=E·(1+0)=E 바이트 동일(순수 E 주화성·q 미참조) → 평탄 E 라 생명 안 움직임(시작 저질 자리·meanQ≈' + avg(rr, 'meanQ').toFixed(3) + ')·2회 실행 비트 동일. *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(qtax@ 포함 전 시나리오 비트 불변·새 노브 kQTaxis=0 → attr=E)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'taxis') {
    var rp = seeds.map(taxis); table(rp, ['seed', 'meanQOn', 'meanQOff', 'distOn', 'distOff', 'pass']);
    console.log('생명이 *질 구배*를 따라 오른다(SPINE 여섯째 축 동역학 첫 되먹임·슈뢰딩거 낙차): D=1·평탄 E=1·중앙 방사형 고질 q 원뿔·생명 3×3(중심서 ~17칸)·' + TICKS + ' tick. kQTaxis OFF 면 평탄 E 라 생명 안 움직임(시작 저질 자리 유지·meanQ ' + avg(rp, 'meanQOff').toFixed(3) + '·거리 ' + avg(rp, 'distOff').toFixed(2) + ') → ON 이면 q 따라 중앙 고질로 모임(meanQ ' + avg(rp, 'meanQOn').toFixed(3) + '·거리 ' + avg(rp, 'distOn').toFixed(2) + ') = 엑서지 추종(생명은 *질* 좋은 E 로 산다). 주화성은 위치만(q 읽기·E 미접촉)·국소(제 이웃 q)·q 는 E 의 intensive 상태변수(단일 척추).');
    return rp.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (주화성은 위치만 — q 를 *읽기만* 하고 E 는 안 건드린다[A·강등·별 질·수송과 같은 읽기 경계]. 닫힌 장부 유지).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 상태 해시 일치(q·agent 위치가 해시에 산입·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'taxis', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
