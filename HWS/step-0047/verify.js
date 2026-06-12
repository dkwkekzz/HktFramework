/* HWS step-0047 헤드리스 검증 — 에너지의 질(자유에너지·둘째 법칙, SPINE 여섯째 축).
 * 지금까지 E 는 무차별 스칼라 하나였다 — 별의 뜨거운 E 한 단위와 식은 바다의 E 한 단위가 비트 동일(질 구별 0).
 *   그러나 생명을 굴리는 건 에너지의 *양*이 아니라 *질*(자유에너지·낮은 엔트로피)이다(슈뢰딩거·프리고진). 양은 닫힌 장부서 보존돼 "다 쓸" 수 없고, 실제로 소비되는 건 질이다.
 *   이 step 은 새 법칙 `degrade` + 노브 kQual 로 *연속 질 축*을 더한다: 매 tick 자유 E 의 kQual 비율이 E→Eth(열 에너지, 저질)로 *일방 강등*(둘째 법칙)·쌍 거래(총 E+Eth 불변·양 보존·질만 떨어짐).
 *   자유 E 생산은 source/별 주입(고질 유입). 질 = q = E/(E+Eth). 렌더 L-Q(흑체 색온도)가 이 q 를 읽는다(RENDER §8) — 시뮬이 q 를 내보내야 색온도가 author 0 으로 켜진다(렌더→시뮬 단방향 게이트).
 *   회귀(가드): kQual=0 → degrade early-return = 직전 step(0046) 비트 동일(Eth 영원히 0·qualInit 미설정 → hashState Eth skip).
 *
 * 사용: node step-0047/verify.js <reg|qual|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kQual=0 → Eth 0·열화 0·2회 실행 비트 동일. *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든(전 시나리오 std@~shr3@ 비트 불변 — 새 노브=0)이 권위.
 *  - qual     : 가설 — *생산(source)이 둘째 법칙 붕괴에 맞서 질을 유지한다*(슈뢰딩거 핵심·far-from-equilibrium). kQual off vs on:
 *               off 면 Eth 0·q=1 전역(질 구별 없음) → on 이면 자유 E 가 열화(thermalFrac>0)하되 *보충받는 source 셀*은 질이 *미보충 배경*보다 높게 유지(qSource > qBg) = 흐름이 질을 떠받친다.
 *  - conserve : 보존 — 강등은 E→Eth 쌍 거래(질만 down, 양 보존) — 닫힌 장부 잔차(ledger 가 sumEth 가법) < 1e-9.
 *  - det      : 결정론 — 같은 시드 2회 비트 동일(Eth 분포 포함).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var QW = 32, QH = 32;

/* 에너지 질 강등 아레나 — verify-sim-engine.js qualArena() 와 동일 상수(골든 qual@ 와 일치).
 * 확산·증발 off → 순수 국소(advection 없음 — 정직: 질이 아직 E 와 함께 안 흐른다). 균일 E=1 + source(16,16 r2)가 그 자리 자유 E 보충.
 * → source 셀: 보충받아 질 유지 / 배경 셀: 보충 없이 둘째 법칙으로 q=E/(E+Eth) 붕괴. */
function qualArena(extra) {
  return Object.assign({
    W: QW, H: QH, D: 1, initE: 1, noise: 0, kEvap: 0, kD: 0, kDz: 0,
    drive: true, source: { x: 16, y: 16, r: 2, rate: 0.2 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kQual: 0
  }, extra || {});
}

/* 2D 디스크 셀 인덱스(D=1) — (cx,cy) 중심 반경 r 안. */
function discIdx(cx, cy, r) {
  var out = [];
  for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    var x = ((cx + dx) % QW + QW) % QW, y = ((cy + dy) % QH + QH) % QH;
    out.push(y * QW + x);
  }
  return out;
}
var SRC = discIdx(16, 16, 2);   // 보충받는 source 디스크
var BG = discIdx(4, 4, 2);      // 보충 없는 배경 디스크(source 와 멀고 겹치지 않음)

/* 셀 집합의 평균 질 q = ΣE / Σ(E+Eth). E+Eth=0 이면 1(질 정의 안 됨 → 만점). */
function meanQ(sim, cells) {
  var E = sim.E, Eth = sim.Eth, sE = 0, sT = 0;
  for (var k = 0; k < cells.length; k++) { sE += E[cells[k]]; sT += Eth[cells[k]]; }
  return (sE + sT) > 0 ? sE / (sE + sT) : 1;
}
/* 전역 열화 분율 = ΣEth / Σ(E+Eth). */
function thermalFrac(sim) {
  var E = sim.E, Eth = sim.Eth, sE = 0, sT = 0, N = E.length;
  for (var i = 0; i < N; i++) { sE += E[i]; sT += Eth[i]; }
  return (sE + sT) > 0 ? sT / (sE + sT) : 0;
}
function build(seed, kQ, ticks) { var s = ENG.createSim(seed, qualArena({ kQual: kQ })); ENG.run(s, ticks); return s; }

/* ── reg: 회귀 0 — kQual=0 → Eth 0·열화 0·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, 40), b = build(seed, 0, 40);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, therm: a.thermalized, frac: thermalFrac(a), hashA: ha, hashB: hb, pass: ha === hb && a.thermalized === 0 && thermalFrac(a) === 0 };
}

/* ── qual: 가설 — 생산이 둘째 법칙 붕괴에 맞서 질을 유지한다. kQual off vs on. ── */
function qual(seed) {
  var off = build(seed, 0, 40), on = build(seed, 0.05, 40);
  return {
    seed: seed,
    fracOff: thermalFrac(off), fracOn: thermalFrac(on),
    qSrcOff: meanQ(off, SRC), qBgOff: meanQ(off, BG),
    qSrc: meanQ(on, SRC), qBg: meanQ(on, BG),
    /* off: 열화 0·q=1 전역(질 구별 없음). on: 열화>0·보충받는 source 질이 배경보다 높음(흐름이 질 떠받침). */
    pass: thermalFrac(off) === 0 && meanQ(off, SRC) === 1 && meanQ(off, BG) === 1
      && thermalFrac(on) > 0 && meanQ(on, SRC) > meanQ(on, BG)
  };
}

/* ── conserve: 강등은 E→Eth 쌍 거래(양 보존·질만 down) — 닫힌 장부 잔차(ledger 가 sumEth 가법). ── */
function conserve(seed) {
  var s = build(seed, 0.05, 40);
  var L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, thermal: L.thermal, frac: thermalFrac(s), pass: L.residual < 1e-9 };
}

/* ── det: 같은 시드 2회 비트 동일(Eth 분포 포함). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 0.05, 40)), hb = ENG.hashState(build(seed, 0.05, 40));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'therm', 'frac', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kQual=0 → degrade early-return → Eth 0·열화 0·2회 실행 비트 동일. 새 법칙 degrade(LAW_ORDER evaporate 뒤·노브 kQual) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~shr3@ 비트 불변·새 노브=0→degrade 미진입·qualInit=false→Eth 해시 skip)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'qual') {
    var rb = seeds.map(qual); table(rb, ['seed', 'fracOn', 'qSrc', 'qBg', 'pass']);
    console.log('생산(source)이 둘째 법칙 붕괴에 맞서 질을 유지한다(슈뢰딩거 핵심·far-from-equilibrium): 균일 E=1·source(16,16 r2) 보충·확산 off — kQual OFF 면 Eth 0·q=1 전역(질 구별 없음·thermalFrac ' + avg(rb, 'fracOff').toFixed(2) + ') → ON 이면 자유 E 가 열화(thermalFrac ' + avg(rb, 'fracOn').toFixed(2) + ')하되 *보충받는 source 셀*의 질 q ' + avg(rb, 'qSrc').toFixed(3) + ' 가 *미보충 배경* q ' + avg(rb, 'qBg').toFixed(3) + ' 보다 높게 유지 = 흐름(throughput)이 질을 떠받친다(소산구조). 양은 보존(E→Eth 쌍 거래)·질만 떨어진다. *한계: advection 없음(질이 E 와 안 흐름)·생명 동역학 미연동·Eth 재활용 없음(열사 위험) — 후속 step.');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'thermal', 'frac', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (강등은 E→Eth 쌍 거래[양 보존·질만 down] — ledger 가 sumEth 를 가법해 닫힌 장부 유지. 누적 열 에너지 ' + avg(rc, 'thermal').toFixed(2) + '·열화 분율 ' + avg(rc, 'frac').toFixed(2) + ' 가 쌓여도 총 E+Eth 불변).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 상태 해시 일치(Eth 열화 분포 포함·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'qual', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
