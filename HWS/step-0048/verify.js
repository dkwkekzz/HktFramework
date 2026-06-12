/* HWS step-0048 헤드리스 검증 — 생명의 폐열(슈뢰딩거 음엔트로피: 생명이 질로 산다).
 * step-0045 가 E 에 질 축(자유 E ↔ 열 E[Eth])을 열었으나, 질은 아직 *측정 토대*였다 — 동역학에 안 먹였다(정직한 한계 ②).
 *   이 step 은 그 질 축을 *생명 동역학에 연동*한다: 생명은 이미 고질 자유 E 만 먹는다(흡수 kL 이 sim.E[자유 풀]서만 끌어옴 — Eth 는 못 먹음, 구조적). 이 step 은 그 짝을 더한다 —
 *   대사 손실(cost = m·mMaint + baseCost)의 kLifeHeat 분율이 *세계 밖 소멸(metabolized)* 대신 *저질 열 Eth* 로 제자리(a.center)에 머문다.
 *   = 생명은 고질을 먹고 m 을 유지하며 *저질 엔트로피(열)를 환경에 배출*한다(슈뢰딩거 "생명은 음엔트로피를 먹는다"·far-from-equilibrium 소산구조). metabolize 제자리 확장 + 노브 kLifeHeat(새 LAW_ORDER 자리 없음).
 *   회귀: kLifeHeat=0 → heat 0 → metabolized += cost = 직전 step(0047) 비트 동일(Eth 무변경·qualInit 미설정 → Eth 해시 skip).
 *
 * 사용: node step-0048/verify.js <reg|heat|conserve|det|all> [seed]
 *  - reg      : 회귀 0 — kLifeHeat=0 → Eth 0·2회 실행 비트 동일. *교차 버전* 회귀는
 *               `node engine/validate/verify-sim-engine.js` 골든(전 시나리오 std@~qual@ 비트 불변 — 새 노브=0)이 권위.
 *  - heat     : 가설 — *생명이 저질 폐열을 배출한다*(슈뢰딩거 음엔트로피·소산구조). kLifeHeat off vs on:
 *               off 면 대사 손실이 전부 세계 밖 소멸(Eth 0) → on 이면 그 일부가 저질 열 Eth 로 생명 자리에 쌓인다(Eth>0·생명 칸 집중·확산 off 라 제자리).
 *  - conserve : 보존 — cost 가 heat(→Eth) + (cost−heat)(→metabolized) 로 쌍 분배(둘 다 장부) — 닫힌 장부 잔차 < 1e-9.
 *  - det      : 결정론 — 같은 시드 2회 비트 동일(Eth 폐열 분포 포함).
 *  - all      : 전 모드 + 요약
 */
'use strict';
var ENG = require('../engine/hws-sim.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var HW = 32;

/* 생명 폐열 아레나 — verify-sim-engine.js lifeHeatArena() 와 동일 상수(골든 heat@ 와 일치).
 * 균일 E=2 + 정적 생명 5(이동·번식 off)·확산 off(Eth 제자리)·kQual=0(자발 강등 격리 → Eth 의 유일한 출처 = 생명 폐열). kLifeHeat 토글. */
function lifeHeatArena(extra) {
  return Object.assign({
    W: HW, H: HW, D: 1, initE: 2, noise: 0, drive: false,
    source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
    kD: 0, kDz: 0, kEvap: 0, kQual: 0,
    life: true, kL: 0.05, mMaint: 0.03, mDeath: 0.05, baseCost: 0, lifeR: 1,
    move: false, repro: false, pTumble: 0, kA: 0, kRelief: 0,
    kLifeHeat: 0
  }, extra || {});
}
function seedLifeHeat(sim) {   // 정적 생명 5 마리(고정 위치·각 m≤0.5 를 제 칸 E 서)
  var W = sim.p.W, pts = [[8, 8], [16, 16], [24, 24], [8, 24], [24, 8]];
  for (var i = 0; i < pts.length; i++) { var x = pts[i][0], y = pts[i][1], c = y * W + x, m = Math.min(0.5, sim.E[c]); sim.E[c] -= m; sim.agents.push({ x: x, y: y, z: 0, m: m, cells: [c], center: c, bornTick: 0 }); }
  return sim.agents.length;
}
function totalEth(sim) { var Eth = sim.Eth, s = 0, N = Eth.length; for (var i = 0; i < N; i++) s += Eth[i]; return s; }
function ethAtLife(sim) { var Eth = sim.Eth, ag = sim.agents, s = 0; for (var k = 0; k < ag.length; k++) s += Eth[ag[k].center]; return s; }
function build(seed, kH, ticks) { var s = ENG.createSim(seed, lifeHeatArena({ kLifeHeat: kH })); seedLifeHeat(s); for (var t = 0; t < ticks; t++) ENG.step(s); return s; }

/* ── reg: 회귀 0 — kLifeHeat=0 → Eth 0·2회 실행 비트 동일. 교차 버전은 골든이 권위. ── */
function reg(seed) {
  var a = build(seed, 0, 20), b = build(seed, 0, 20);
  var ha = ENG.hashState(a), hb = ENG.hashState(b);
  return { seed: seed, eth: totalEth(a), hashA: ha, hashB: hb, pass: ha === hb && totalEth(a) === 0 };
}

/* ── heat: 가설 — 생명이 저질 폐열을 배출한다(슈뢰딩거 음엔트로피). kLifeHeat off vs on. ── */
function heat(seed) {
  var off = build(seed, 0, 20), on = build(seed, 0.3, 20);
  return {
    seed: seed, ethOff: totalEth(off), ethOn: totalEth(on), ethLifeOn: ethAtLife(on), metabOn: on.metabolized,
    /* off: 대사 손실 전부 세계 밖(Eth 0). on: 일부가 저질 열 Eth 로 생명 자리에(>0·확산 off 라 제자리 = ethAtLife≈totalEth). */
    pass: totalEth(off) === 0 && totalEth(on) > 0 && Math.abs(ethAtLife(on) - totalEth(on)) < 1e-12
  };
}

/* ── conserve: cost 가 heat(→Eth) + (cost−heat)(→metabolized) 쌍 분배(둘 다 장부) — 닫힌 장부 잔차. ── */
function conserve(seed) {
  var s = build(seed, 0.3, 20);
  var L = ENG.ledger(s);
  return { seed: seed, residual: L.residual, thermal: L.thermal, metab: s.metabolized, pass: L.residual < 1e-9 };
}

/* ── det: 같은 시드 2회 비트 동일(Eth 폐열 분포 포함). ── */
function det(seed) {
  var ha = ENG.hashState(build(seed, 0.3, 20)), hb = ENG.hashState(build(seed, 0.3, 20));
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb };
}

function avg(rows, k) { var s = 0; for (var i = 0; i < rows.length; i++) s += rows[i][k]; return s / rows.length; }
function fmt(x) { if (typeof x === 'boolean') return x ? 'true' : 'false'; if (typeof x !== 'number') return String(x); if (!isFinite(x)) return String(x); if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3); return x.toFixed(4); }
function table(rows, cols) { console.log(cols.join('\t')); rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); }); }

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rr = seeds.map(reg); table(rr, ['seed', 'eth', 'hashA', 'hashB', 'pass']);
    console.log('회귀 0: kLifeHeat=0 → heat 0 → metabolized += cost(종전) → Eth 0·2회 실행 비트 동일. metabolize *제자리 확장*(새 LAW_ORDER 자리 없음·노브 kLifeHeat) — *교차 버전* 회귀는 verify-sim-engine.js 골든 해시(전 시나리오 std@~qual@ 비트 불변·새 노브=0)가 권위.');
    return rr.every(function (r) { return r.pass; });
  } else if (mode === 'heat') {
    var rb = seeds.map(heat); table(rb, ['seed', 'ethOff', 'ethOn', 'ethLifeOn', 'pass']);
    console.log('생명이 저질 폐열을 배출한다(슈뢰딩거 "생명은 음엔트로피를 먹는다"·far-from-equilibrium 소산구조): 균일 E=2·정적 생명 5·확산 off·kQual=0(자발 강등 격리) — kLifeHeat OFF 면 대사 손실이 전부 세계 밖 소멸(Eth ' + avg(rb, 'ethOff').toFixed(2) + ') → ON 이면 그 일부가 저질 열 Eth ' + avg(rb, 'ethOn').toFixed(2) + ' 로 *생명 자리*에 쌓인다(ethAtLife ' + avg(rb, 'ethLifeOn').toFixed(2) + ' ≈ 전체 — 확산 off 라 제자리). 생명은 고질 자유 E 를 먹어(흡수) m 유지·저질 엔트로피를 환경에 배출 = 질 축(0045)이 비로소 생명 동역학에 연동. *한계: 열 advection·재활용 없음·생명이 *남의* Eth 를 못 씀(여전히 자유 E 만) — 후속.');
    return rb.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'thermal', 'metab', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' (대사 손실 cost 가 heat[→Eth ' + avg(rc, 'thermal').toFixed(2) + '] + (cost−heat)[→metabolized ' + avg(rc, 'metab').toFixed(2) + '] 로 쌍 분배 — 둘 다 장부 lhs 라 보존. 폐열이 세계 안에 머물러도[Eth] 총량 불변).');
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    console.log('결정론: 같은 시드 2회 상태 해시 일치(Eth 폐열 분포 포함·Math.random 0).');
    return rd.every(function (r) { return r.pass; });
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') { ok = ['reg', 'heat', 'conserve', 'det'].every(function (m) { console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r; }); }
else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
