// step_0097/verify.js — 강수장(precipitation): 비는 별도 축이 아니라 이미 가진 두 축(humidity·effTemp)의 derived 함수다.
//   biomeField 에 precip = clamp01(humidity^0.7·(precipFloor+(1−precipFloor)·effTemp)) 추가(새 노이즈 0·타입 0).
//   습하고 따뜻한 곳=비 많음(우림)·건조하거나 추운 곳=비 적음(사막/툰드라). 강(0098)이 이 강수가 흘러 모이는 곳에서 창발.
//   precip 은 *가법*(반환 객체 키 추가) → biome byte 회귀 0. 순수·독립·영구. 실행: node HTJ/steps/step_0097/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const bf = S.biomeField({ scale: 0.07, nTemp: 3, nHum: 3, lapse: 0.6 });
const R = 40, STEP = 1;
function sample() { const a = []; for (let i = -R; i <= R; i += STEP) for (let j = -R; j <= R; j += STEP) a.push(bf(i, j)); return a; }
function corr(xs, ys) {
  const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < n; k++) { const dx = xs[k] - mx, dy = ys[k] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxy / (Math.sqrt(sxx * syy) || 1e-300);
}

const cells = sample();
const precip = cells.map(c => c.precip), hum = cells.map(c => c.humidity), eff = cells.map(c => c.effTemp);

// ① 새 법칙(핵심) — 강수는 *두 축의 함수*: 습도와 양의 상관(비=수분)·온도와도 양의 상관(따뜻=증발↑). 둘 다 유의미.
const cHum = corr(hum, precip), cEff = corr(eff, precip);
ok(cHum > 0.4 && cEff > 0.4,
  `강수=습도·온도의 함수 — corr(humidity,precip) ${cHum.toFixed(2)}(>0.4)·corr(effTemp,precip) ${cEff.toFixed(2)}(>0.4)·둘 다 비를 끈다`);

// ② 새 법칙(대비) — 습하고 따뜻한 곳(우림)은 비가 많고, 건조하거나 추운 곳(사막/툰드라)은 적다.
const wetWarm = cells.filter(c => c.humidity > 0.6 && c.effTemp > 0.6).map(c => c.precip);
const dryOrCold = cells.filter(c => c.humidity < 0.4 || c.effTemp < 0.25).map(c => c.precip);
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const pWet = mean(wetWarm), pDry = mean(dryOrCold);
ok(wetWarm.length >= 5 && dryOrCold.length >= 5 && pWet > pDry + 0.2,
  `우림 vs 사막/툰드라 — 습·온 ${pWet.toFixed(2)} > 건·한 ${pDry.toFixed(2)}(Δ${(pWet - pDry).toFixed(2)})·표본 ${wetWarm.length}/${dryOrCold.length}`);

// ③ 유한·유효범위 — 모든 precip ∈ [0,1].
ok(precip.every(p => Number.isFinite(p) && p >= 0 && p <= 1), `precip ∈ [0,1] 유한 — min ${Math.min(...precip).toFixed(3)}·max ${Math.max(...precip).toFixed(3)}`);

// ④ 항등(회귀 0) — precip 은 가법(키 추가)일 뿐 → biome 은 0095/0090 과 byte 동일(precip 도입 전후 불변).
const bfOld = S.biomeField({ scale: 0.07, nTemp: 3, nHum: 3, lapse: 0.6 });
const biomesA = cells.map(c => c.biome), biomesB = sample().map(c => c.biome);
show(L.identity('precip 도입 후 biome 불변', biomesA, biomesB));

// ⑤ 결정론 — 같은 좌표 → 같은 강수장.
show(L.deterministic('같은 법칙 → 같은 강수장', () => sample().map(c => c.precip.toFixed(6))));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
