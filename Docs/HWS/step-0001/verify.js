/* HWS step-0001 헤드리스 검증
 * 사용: node verify.js <conserve|det|neq|all> [seed]
 *  - conserve : V1 보존 — 닫힌 장부 잔차 < 1e-6 (10000 tick)
 *  - det      : V2 결정론 — 같은 시드 2회 실행 비트 단위 동일
 *  - neq      : V3 비평형 — 구동 on=기울기 유지 정상상태 / off=평형(죽음)
 *  - all      : 전 시드 전 모드 + 평균 요약
 * step-0001 은 첫 step 이므로 회귀(reg) 모드 없음 — step-0002 부터 이 코어가 기준.
 */
'use strict';
var core = require('./sim-core.js');

var SEEDS = [42, 7, 1234, 99, 2026];
var TICKS = 10000;
var STEADY_WINDOW = 1000; // 정상상태 판정: 추가 1000 tick 의 sumE 변화율

function conserve(seed) {
  var sim = core.createSim(seed);
  core.run(sim, TICKS);
  var led = core.ledger(sim);
  var m = core.measure(sim);
  return {
    seed: seed, residual: led.residual, sumE: m.sumE, varE: m.varE,
    pass: led.residual < 1e-6
  };
}

function det(seed) {
  var a = core.createSim(seed); core.run(a, TICKS);
  var b = core.createSim(seed); core.run(b, TICKS);
  var ha = core.hashState(a), hb = core.hashState(b);
  var bit = true;
  for (var i = 0; i < a.E.length; i++) {
    if (a.E[i] !== b.E[i]) { bit = false; break; }
  }
  return { seed: seed, hashA: ha, hashB: hb, pass: ha === hb && bit };
}

function neq(seed) {
  /* 구동 on: TICKS 후 → 추가 창에서 sumE 변화율(drift)로 정상상태 판정 */
  var on = core.createSim(seed);
  core.run(on, TICKS);
  var m1 = core.measure(on);
  core.run(on, STEADY_WINDOW);
  var m2 = core.measure(on);
  var drift = Math.abs(m2.sumE - m1.sumE) / m1.sumE;
  /* 구동 off: 같은 총 tick — 평형으로 식는다 */
  var off = core.createSim(seed, { drive: false });
  core.run(off, TICKS + STEADY_WINDOW);
  var mo = core.measure(off);
  return {
    seed: seed,
    varOn: m2.varE, varOff: mo.varE,
    sumOn: m2.sumE, sumOff: mo.sumE, drift: drift,
    pass: m2.varE > 1e-3 && mo.varE < 1e-12 && drift < 1e-3
  };
}

function fmt(x) {
  if (typeof x !== 'number') return String(x);
  if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(3);
  return x.toFixed(4);
}

function table(rows, cols) {
  console.log(cols.join('\t'));
  rows.forEach(function (r) {
    console.log(cols.map(function (c) { return fmt(r[c]); }).join('\t'));
  });
}

function avg(rows, key) {
  return rows.reduce(function (s, r) { return s + r[key]; }, 0) / rows.length;
}

function runMode(mode, seeds) {
  var allPass = true;
  if (mode === 'conserve') {
    var rows = seeds.map(conserve);
    table(rows, ['seed', 'residual', 'sumE', 'varE', 'pass']);
    console.log('avg residual=' + avg(rows, 'residual').toExponential(3) +
      ' avg sumE=' + avg(rows, 'sumE').toFixed(2) +
      ' avg varE=' + avg(rows, 'varE').toFixed(4));
    allPass = rows.every(function (r) { return r.pass; });
  } else if (mode === 'det') {
    var rows2 = seeds.map(det);
    table(rows2, ['seed', 'hashA', 'hashB', 'pass']);
    allPass = rows2.every(function (r) { return r.pass; });
  } else if (mode === 'neq') {
    var rows3 = seeds.map(neq);
    table(rows3, ['seed', 'varOn', 'varOff', 'sumOn', 'sumOff', 'drift', 'pass']);
    console.log('avg varOn=' + avg(rows3, 'varOn').toFixed(4) +
      ' avg varOff=' + avg(rows3, 'varOff').toExponential(3) +
      ' avg sumOn=' + avg(rows3, 'sumOn').toFixed(2) +
      ' avg sumOff=' + avg(rows3, 'sumOff').toExponential(3) +
      ' avg drift=' + avg(rows3, 'drift').toExponential(3));
    allPass = rows3.every(function (r) { return r.pass; });
  } else {
    console.error('unknown mode: ' + mode);
    process.exit(2);
  }
  return allPass;
}

var mode = process.argv[2] || 'all';
var seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
var ok;
if (mode === 'all') {
  ok = ['conserve', 'det', 'neq'].every(function (m) {
    console.log('== ' + m + ' ==');
    var r = runMode(m, seedArg);
    console.log('');
    return r;
  });
} else {
  ok = runMode(mode, seedArg);
}
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
