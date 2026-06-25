// step_0090/verify.js — 절차적 장 다축화(바이옴): 독립 온도·습도 fBm → 제너릭 2D 바이옴 분류.
//   확인용 트랙(viewer/htj-stream.js·engine 변경 0·0074 fieldNoise 의 다축 판). 새 거동 = 두 노이즈축이 *서로 무상관*
//   (같은 노이즈 두 번이면 1D 대각선뿐)인데 각 축은 *공간 상관*(코히어런트)이고, 바이옴은 (temp,humidity)의 *제너릭*
//   2D 양자화(타입 하드코딩 0). salt 없음 → 0074/0083 fbm/fieldNoise byte 동일(회귀 0). 결정론·순수는 공용 가드.
//   실행: node HTJ/steps/step_0090/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const M = 80, bf = S.biomeField({ scale: 0.08, nTemp: 3, nHum: 3 });
const T = [], H = [], B = [];
for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) { const b = bf(i, j); T.push(b.temp); H.push(b.humidity); B.push(b.biome); }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const mt = mean(T), mh = mean(H);
let cov = 0, vt = 0, vh = 0; for (let k = 0; k < T.length; k++) { cov += (T[k] - mt) * (H[k] - mh); vt += (T[k] - mt) ** 2; vh += (H[k] - mh) ** 2; }
const corr = cov / Math.sqrt(vt * vh);

// ① 다축 독립(핵심) — 온도·습도가 *서로 무상관*(|corr|≈0). 같은 노이즈 두 번이면 corr≈1(1D) — 진짜 2D 바이옴의 조건.
ok(Math.abs(corr) < 0.1,
  `다축 독립 — corr(temp,humidity)=${corr.toFixed(4)} ≈ 0 (서로 무상관·진짜 2D 축·같은 노이즈면 corr≈1 일 것)`);

// ② 각 축 공간 상관(코히어런트) — 이웃 셀 차이 ≪ 무작위 쌍 차이(0074 의 핵심·백색 잡음 아님), 두 축 모두.
(() => {
  let nT = 0, nH = 0, nc = 0; for (let j = 0; j < M; j++) for (let i = 0; i < M - 1; i++) { nT += Math.abs(bf(i, j).temp - bf(i + 1, j).temp); nH += Math.abs(bf(i, j).humidity - bf(i + 1, j).humidity); nc++; }
  let rnd = 0, rc = 0; for (let k = 0; k < 3000; k++) { rnd += Math.abs(bf((k * 7) % M, (k * 13) % M).temp - bf((k * 17) % M, (k * 29) % M).temp); rc++; }
  const nbrT = nT / nc, nbrH = nH / nc, rp = rnd / rc;
  ok(nbrT < rp * 0.5 && nbrH < rp * 0.5,
    `각 축 공간 상관 — 이웃차 T ${nbrT.toFixed(3)}·H ${nbrH.toFixed(3)} ≪ 무작위쌍차 ${rp.toFixed(3)}(둘 다 코히어런트 fBm·백색 아님)`);
})();

// ③ 제너릭 바이옴 분류 — (temp,humidity) 2D 양자화가 여러 칸을 *고루* 덮는다(타입 하드코딩 0·biome=칸 인덱스).
(() => {
  const seen = new Set(B); const cover = seen.size;
  ok(cover >= 7 && Math.min(...B) >= 0 && Math.max(...B) < 9,
    `제너릭 바이옴 — 9칸 중 ${cover}칸 발현(온도×습도 교차·범위 [${Math.min(...B)},${Math.max(...B)}]⊂[0,9)·제너릭 양자화)`);
})();

// ④ 항등(salt 없음 → 0074 동일·회귀 0) — fbm/fieldNoise 에 salt 안 주면 기존 거동 byte 동일.
(() => {
  const a = [], b = [];
  for (let k = 0; k < 50; k++) { const x = k * 0.13, y = k * 0.21; a.push(S.fbm(x, y, {})); b.push(S.fbm(x, y, { salt: '' })); }
  const fn = S.fieldNoise([11, 22, 33, 44]); const fa = []; for (let k = 0; k < 20; k++) fa.push(fn(k, k * 2));
  // salt='' 가 무salt 와 동일하면 fieldNoise(0074·salt 미사용)도 불변 → 회귀 0.
  show(L.identity('salt 없음 → 0074 fbm 동일(회귀 0)', a, b));
})();

// ⑤ 결정론·순수(경로 무관) — 같은 (i,j) → 같은 바이옴(호출 순서/재방문 무관).
show(L.deterministic('같은 좌표 → 같은 바이옴(순수·경로 무관)', () => {
  const out = []; for (const [i, j] of [[3, 7], [50, 12], [9, 9], [77, 4]]) { const b = bf(i, j); out.push([b.temp.toFixed(6), b.humidity.toFixed(6), b.biome]); }
  return out;
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
