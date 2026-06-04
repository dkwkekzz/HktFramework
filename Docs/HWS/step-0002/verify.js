/* HWS step-0002 헤드리스 검증
 * 사용: node verify.js <reg|conserve|det|pool|harvest|seed|all> [seed]
 *  - reg      : 회귀 0 — kA=0 step-0002 == step-0001 비트 단위 동일 (구동 on/off)
 *  - conserve : V1 보존 — 응집 on 에서도 닫힌 장부 잔차 < 1e-6 (10000 tick)
 *  - det      : V2 결정론 — 응집 on, 같은 시드 2회 실행 비트 단위 동일
 *  - pool     : ① 고임 — source 아닌 곳에 지속되는 국소 봉우리가 떠오르는가
 *  - harvest  : ② 재생 자원 — 고임을 수확하면 같은 자리에 되살아나는가 (장부 닫힘)
 *  - seed     : ④ 세계가 시드를 기억하는가 — 고임 배치가 시드마다 다른가
 *  - all      : 전 모드 + 요약
 * 응집 시나리오 상수: kA=0.45, aggMc=1.1, aggW=0.7 (step-0002.md §2).
 */
'use strict';
var core = require('./sim-core.js');
var core1 = require('../step-0001/sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var TICKS = 10000;
var AGG = { kA: 0.45, aggMc: 1.1, aggW: 0.7 };   // 응집 on 시나리오 (고정)
var POOL = { minE: 1.5, prom: 0.3 };             // 고임 검출 임계 (고정)

function withAgg(extra) { return Object.assign({}, AGG, extra || {}); }
function near(ax, ay, bx, by, r) {
  var dx = Math.min(Math.abs(ax - bx), 64 - Math.abs(ax - bx));
  var dy = Math.min(Math.abs(ay - by), 64 - Math.abs(ay - by));
  return dx * dx + dy * dy <= r * r;
}
function fieldRange(sim) {
  var E = sim.E, mn = Infinity, mx = -Infinity;
  for (var i = 0; i < E.length; i++) { if (E[i] < mn) mn = E[i]; if (E[i] > mx) mx = E[i]; }
  return { minE: mn, maxE: mx };
}
function avg(rows, key) { return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length; }

/* ── reg: 회귀 0 — kA=0 이면 step-0001 과 비트 단위 동일 ── */
function reg(seed) {
  var maxd = 0, hashOK = true;
  [true, false].forEach(function (drive) {
    var a = core1.createSim(seed, { drive: drive }); core1.run(a, TICKS);
    var b = core.createSim(seed, { drive: drive }); core.run(b, TICKS);   // kA=0 기본
    for (var i = 0; i < a.E.length; i++) maxd = Math.max(maxd, Math.abs(a.E[i] - b.E[i]));
    if (core1.hashState(a) !== core.hashState(b)) hashOK = false;
  });
  return { seed: seed, maxDiff: maxd, pass: maxd === 0 && hashOK };
}

/* ── conserve: 응집 on, 닫힌 장부 ── */
function conserve(seed) {
  var sim = core.createSim(seed, withAgg()); core.run(sim, TICKS);
  var led = core.ledger(sim), r = fieldRange(sim);
  return { seed: seed, residual: led.residual, sumE: led.sumE, maxE: r.maxE, minE: r.minE,
    pass: led.residual < 1e-6 };
}

/* ── det: 응집 on, 결정론(비트 동일) ── */
function det(seed) {
  var a = core.createSim(seed, withAgg()); core.run(a, TICKS);
  var b = core.createSim(seed, withAgg()); core.run(b, TICKS);
  var bit = true;
  for (var i = 0; i < a.E.length; i++) if (a.E[i] !== b.E[i]) { bit = false; break; }
  return { seed: seed, hashA: core.hashState(a), hashB: core.hashState(b), pass: bit && core.hashState(a) === core.hashState(b) };
}

/* ── pool: ① 고임이 떠오르고 지속되는가 (8000→10000 tick 안정성) ── */
function pool(seed) {
  var sim = core.createSim(seed, withAgg()); core.run(sim, 8000);
  var p1 = core.detectPools(sim, POOL);
  core.run(sim, 2000);
  var p2 = core.detectPools(sim, POOL);
  var r = fieldRange(sim);
  /* 지속성: p2 의 봉우리 중 p1 시점에도 3셀 안에 봉우리가 있던 비율 (정상 standing 구조) */
  var stay = 0;
  p2.forEach(function (b) {
    if (p1.some(function (a) { return near(a.x, a.y, b.x, b.y, 3); })) stay++;
  });
  var persist = p2.length ? stay / p2.length : 0;
  return { seed: seed, pools: p2.length, persist: persist, minE: r.minE, maxE: r.maxE,
    pass: p2.length >= 1 && persist >= 0.5 && r.minE > -1e-6 };
}

/* ── harvest: ② 수확하면 자원이 되살아나는가 + 장부 닫힘 ──
 * 재생의 두 층위: (population) 고임 개체수가 무수확 대조군 수준으로 회복하는가,
 *               (sameSpot)  그 회복이 같은 자리에서 일어나는가.
 * 통과 기준은 population (시스템 수준의 재생 자원). sameSpot 은 관찰값으로 보고. */
function harvest(seed) {
  var sim = core.createSim(seed, withAgg()); core.run(sim, 8000);
  var pools = core.detectPools(sim, POOL);
  if (!pools.length) return { seed: seed, e0: 0, pass: false };
  var t = pools[0], e0 = t.e;
  var resBefore = core.ledger(sim).residual;
  core.harvest(sim, t.x, t.y, 3);             // 고임 제거 (장부 sunk 기록)
  var resAfter = core.ledger(sim).residual;
  var gone = core.detectPools(sim, POOL).filter(function (p) { return near(p.x, p.y, t.x, t.y, 5); }).length;
  core.run(sim, 3000);                        // 재생 대기
  var after = core.detectPools(sim, POOL);
  var sameSpot = after.filter(function (p) { return near(p.x, p.y, t.x, t.y, 5); })
    .reduce(function (m, p) { return Math.max(m, p.e); }, 0);
  /* 무수확 대조군 — 같은 총 tick 까지 수확 없이 진행 */
  var ctl = core.createSim(seed, withAgg()); core.run(ctl, 11000);
  var ctlCount = core.detectPools(ctl, POOL).length;
  var need = Math.max(1, Math.floor(0.5 * ctlCount));
  return { seed: seed, e0: e0, goneAfter: gone, ctlCount: ctlCount, regenCount: after.length,
    sameSpot: sameSpot, resAfter: resAfter,
    pass: gone === 0 && after.length >= need && resAfter < 1e-6 && resBefore < 1e-6 };
}

/* ── seed: ④ 세계가 시드를 기억하는가 — 고임 배치가 시드마다 다른가 ──
 * (step-0001 은 구동이 시드를 지워 정상상태가 시드 무관이었다. 비선형이 이를 깨는가?) */
function seedMemory() {
  var sets = SEEDS.map(function (s) {
    var sim = core.createSim(s, withAgg()); core.run(sim, 10000);
    return core.detectPools(sim, POOL).map(function (p) { return p.x + ',' + p.y; });
  });
  var shared = 0, pairs = 0;
  for (var i = 0; i < sets.length; i++) {
    for (var j = i + 1; j < sets.length; j++) {
      shared += sets[i].filter(function (x) { return sets[j].indexOf(x) >= 0; }).length;
      pairs++;
    }
  }
  var avgShared = shared / pairs;
  var counts = sets.map(function (s) { return s.length; });
  return { sets: sets, counts: counts, avgShared: avgShared, pass: avgShared < 2 && counts.every(function (c) { return c >= 1; }) };
}

function fmt(x) {
  if (typeof x !== 'number') return String(x);
  if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3);
  return x.toFixed(4);
}
function table(rows, cols) {
  console.log(cols.join('\t'));
  rows.forEach(function (r) { console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t')); });
}

function runMode(mode, seeds) {
  if (mode === 'reg') {
    var rows = seeds.map(reg); table(rows, ['seed', 'maxDiff', 'pass']);
    console.log('회귀 0: kA=0 step-0002 == step-0001 (구동 on/off, ' + TICKS + ' tick)');
    return rows.every(function (r) { return r.pass; });
  } else if (mode === 'conserve') {
    var rc = seeds.map(conserve); table(rc, ['seed', 'residual', 'sumE', 'maxE', 'minE', 'pass']);
    console.log('avg residual=' + avg(rc, 'residual').toExponential(3) + ' avg sumE=' + avg(rc, 'sumE').toFixed(2) +
      ' avg maxE=' + avg(rc, 'maxE').toFixed(2));
    return rc.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rd = seeds.map(det); table(rd, ['seed', 'hashA', 'hashB', 'pass']);
    return rd.every(function (r) { return r.pass; });
  } else if (mode === 'pool') {
    var rp = seeds.map(pool); table(rp, ['seed', 'pools', 'persist', 'minE', 'maxE', 'pass']);
    console.log('avg pools=' + avg(rp, 'pools').toFixed(1) + ' avg persist=' + avg(rp, 'persist').toFixed(2) +
      ' (source 아닌 곳의 지속 봉우리 = 자원의 원형)');
    return rp.every(function (r) { return r.pass; });
  } else if (mode === 'harvest') {
    var rh = seeds.map(harvest); table(rh, ['seed', 'e0', 'goneAfter', 'ctlCount', 'regenCount', 'sameSpot', 'resAfter', 'pass']);
    console.log('수확 직후 봉우리 0 → 3000 tick 후 개체수 회복(regenCount >= 0.5·대조군). sameSpot>0 = 같은 자리 재생.');
    return rh.every(function (r) { return r.pass; });
  } else if (mode === 'seed') {
    var sm = seedMemory();
    SEEDS.forEach(function (s, i) { console.log('seed=' + s + ' pools=' + sm.counts[i] + ' @ ' + sm.sets[i].slice(0, 8).join(' ')); });
    console.log('시드쌍 평균 공유 위치=' + sm.avgShared.toFixed(2) + ' → ' + (sm.pass ? '시드마다 다른 배치 = 세계가 시드를 기억한다' : 'FAIL'));
    return sm.pass;
  } else { console.error('unknown mode: ' + mode); process.exit(2); }
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['reg', 'conserve', 'det', 'pool', 'harvest', 'seed'].every(function (m) {
    console.log('== ' + m + ' =='); var r = runMode(m, seedArg); console.log(''); return r;
  });
} else { ok = runMode(mode, seedArg); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
