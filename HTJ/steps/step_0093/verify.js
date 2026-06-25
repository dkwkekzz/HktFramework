// step_0093/verify.js — 위도 온도대: 결정론적 위도 인자 warm(j)=½(1+cos(2πj/P))를 온도 잡음에 blend → 기후대 띠.
//   확인용 트랙(viewer/htj-stream.js·engine 변경 0·0092 biomeField 의 위도 결합 판). 새 거동 = 온도가 *순수 잡음*이
//   아니라 *위도*에 강하게 묶여(적도 덥고 극지 춥다) 같은 경도줄에 열대→온대→한대 *띠*가 창발. 잡음(국소)+위도(대역).
//   latAmp=0 → 0092/0090 biome byte 동일(회귀 0). 위도는 *온도만* 건드림(습도 무관). 결정론·순수는 공용 가드.
//   실행: node HTJ/steps/step_0093/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const M = 80, NT = 3, NH = 3, AMP = 0.7, P = 80;
const bf = S.biomeField({ scale: 0.08, nTemp: NT, nHum: NH, latAmp: AMP, latPeriod: P });
const cells = [];
for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) cells.push(bf(i, j));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const corr = (A, B) => { const ma = mean(A), mb = mean(B); let c = 0, va = 0, vb = 0; for (let k = 0; k < A.length; k++) { c += (A[k] - ma) * (B[k] - mb); va += (A[k] - ma) ** 2; vb += (B[k] - mb) ** 2; } return c / Math.sqrt(va * vb); };

const W = cells.map(c => c.warm), EFF = cells.map(c => c.effTemp), H = cells.map(c => c.humidity);

// ① 위도 결합(핵심) — 유효 온도가 위도 인자 warm(j) 와 *강하게 양의 상관*(잡음만이면 corr≈0). 적도 덥고 극지 춥다.
ok(corr(W, EFF) > 0.6,
  `위도 결합 — corr(warm,effTemp)=${corr(W, EFF).toFixed(3)} > 0.6 (온도가 위도에 묶임·순수 잡음이면 ≈0)`);

// ② 기후대 띠(새 거동) — 적도행(warm>0.8)의 평균 온도가 극행(warm<0.2)보다 뚜렷이 높다 = 열대↔한대 띠.
(() => {
  const eq = cells.filter(c => c.warm > 0.8).map(c => c.effTemp);
  const pole = cells.filter(c => c.warm < 0.2).map(c => c.effTemp);
  const mEq = mean(eq), mPole = mean(pole);
  ok(eq.length > 0 && pole.length > 0 && mEq - mPole > 0.3,
    `기후대 띠 — 적도행 effTemp ${mEq.toFixed(3)} ≫ 극행 ${mPole.toFixed(3)}(Δ${(mEq - mPole).toFixed(3)})·${eq.length}/${pole.length}셀(열대↔한대 띠)`);
})();

// ③ 위도는 온도만 — 습도는 위도와 무상관(결합이 *온도축에만* 들어감·습도 잡음 불변).
ok(Math.abs(corr(W, H)) < 0.1,
  `위도=온도만 — corr(warm,humidity)=${corr(W, H).toFixed(4)} ≈ 0 (위도는 습도 안 건드림·결합 표적화)`);

// ④ 항등(latAmp=0 → 0092 동일·회귀 0) — latAmp 안 주면(또는 0) biome 이 0092(고도만)·0090(둘다 없음)과 byte 동일.
(() => {
  const b92 = S.biomeField({ scale: 0.08, nTemp: NT, nHum: NH, lapse: 0.45 });             // 0092(위도 없음)
  const b93 = S.biomeField({ scale: 0.08, nTemp: NT, nHum: NH, lapse: 0.45, latAmp: 0 });  // 0093·latAmp=0
  const a = [], b = [];
  for (let j = 0; j < 30; j++) for (let i = 0; i < 30; i++) { a.push(b92(i, j).biome); b.push(b93(i, j).biome); }
  show(L.identity('latAmp=0 → 0092 biome 동일(회귀 0)', a, b));
})();

// ⑤ 결정론·순수(경로 무관) — 같은 (i,j) → 같은 (warm,effTemp,biome).
show(L.deterministic('같은 좌표 → 같은 위도대 바이옴(순수·경로 무관)', () => {
  const out = []; for (const [i, j] of [[3, 7], [50, 12], [9, 40], [77, 79]]) { const c = bf(i, j); out.push([c.warm.toFixed(6), c.effTemp.toFixed(6), c.biome]); }
  return out;
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
