// step_0098/verify.js — 흐름 누적(flowField): 강수가 지형 따라 흘러 모이면 *강*이 창발한다(D8 최급강하 라우팅).
//   flowAccumulation 이 유한 창에서 각 셀의 비를 가장 가파른 내리막 이웃(8방향)으로 흘려 누적 → 큰 누적 = 강/유역.
//   강 *타입*을 박지 않는다(일반 높이장에 라우팅 돌린 측정·타입 0). 순수·독립·영구. 실행: node HTJ/steps/step_0098/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const SCALE = 0.06;
const elevFn = (i, j) => S.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
const W = 80, H = 80;
const run = () => S.flowAccumulation({ elevFn, x0: 200, y0: -150, W, H });
const F = run();

function corr(xs, ys) {
  const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < n; k++) { const dx = xs[k] - mx, dy = ys[k] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxy / (Math.sqrt(sxx * syy) || 1e-300);
}

// ① 새 법칙(핵심) — 강 창발: 흐름이 채널로 *집중*된다(최대 누적 ≫ 평균·소수 셀이 본류). 균일 분산이면 max≈mean.
const ratio = F.maxAcc / F.meanAcc;
ok(ratio > 10, `강 창발(채널화) — maxAcc ${F.maxAcc.toFixed(0)} / meanAcc ${F.meanAcc.toFixed(2)} = ${ratio.toFixed(1)}× (≫1·흐름이 본류로 집중)`);

// ② 새 법칙(위상) — 누적은 지형을 따른다: 물이 낮은 곳에 모여 corr(elev, acc) < 0(높은 곳=발원·낮은 곳=합류).
const el = Array.from(F.elev), ac = Array.from(F.acc);
const cEA = corr(el, ac);
ok(cEA < -0.1, `누적=낮은 곳에 모임 — corr(elev, acc) ${cEA.toFixed(2)} < 0(높은 곳 발원·낮은 곳 강)`);

// ③ 단조 — 모든 셀의 누적 ≥ 자기 비량(누적은 상류를 더할 뿐 잃지 않음). rain=1 균일이라 acc≥1.
ok(ac.every(a => a >= 1 - 1e-9), `단조 — min(acc) ${Math.min(...ac).toFixed(3)} ≥ 자기 비량 1(누적은 더하기만)`);

// ④ 보존(핵심) — 모든 빗방울은 sink 에 고이거나 창을 빠져나간다: sinkAccum + borderOut === Σrain.
show(L.conserved('물 라우팅(sink+창밖 = 총 강수)', F.rain, F.sinkAccum + F.borderOut));

// ⑤ 결정론 — 같은 지형·같은 라우팅 → 같은 흐름장.
show(L.deterministic('같은 법칙 → 같은 흐름장', () => Array.from(run().acc).map(a => a.toFixed(4))));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
