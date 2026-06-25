// step_0095/verify.js — 실제 지형 고도×바이옴 결합: 고도축을 *별도 노이즈*(0092)가 아니라 *실제 지형 높이장*으로.
//   확인용 트랙(viewer/htj-stream.js·engine 변경 0·0092 의 한계 해소판). 0092 고도는 분리된 노이즈였다 — 여기선
//   elevFn(i,j)=지형 높이장(랜드폼을 고른 바로 그 장)을 고도축으로 써, *높은 땅이 곧 찬 바이옴*이 되어 산이 차고
//   험준(능선)해진다(자기일관). elevFn 없음 → 0092 내부 노이즈 동일·lapse=0 → 0090 동일(회귀 0). 결정론은 공용 가드.
//   실행: node HTJ/steps/step_0095/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const M = 80, NT = 3, NH = 3, LAPSE = 0.6;
// 실제 지형 높이장 — 랜드폼을 고르는 바로 그 fBm(salt 'TERR'·[0,1)). 이걸 고도축으로 먹인다.
const terr = (i, j) => S.fbm(i * 0.07, j * 0.07, { salt: 'TERR', octaves: 4, gain: 0.55 });
const bf = S.biomeField({ scale: 0.07, nTemp: NT, nHum: NH, lapse: LAPSE, elevFn: terr });
const cells = [], TER = [];
for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) { cells.push(bf(i, j)); TER.push(terr(i, j)); }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const corr = (A, B) => { const ma = mean(A), mb = mean(B); let c = 0, va = 0, vb = 0; for (let k = 0; k < A.length; k++) { c += (A[k] - ma) * (B[k] - mb); va += (A[k] - ma) ** 2; vb += (B[k] - mb) ** 2; } return c / Math.sqrt(va * vb); };

// ① 실제 지형이 고도축(핵심) — biome 이 쓴 elev 가 제공한 지형 높이장과 *정확히 일치*(별도 노이즈 아님).
(() => {
  let maxd = 0; for (let k = 0; k < cells.length; k++) maxd = Math.max(maxd, Math.abs(cells[k].elev - Math.min(0.999999, TER[k])));
  ok(maxd < 1e-9, `실제 지형=고도축 — biome.elev 가 제공 지형 높이장과 일치(최대차 ${maxd.toExponential(2)} < 1e-9·별도 노이즈 아님)`);
})();

// ② 산이 차다(자기일관) — 지형 높을수록 effTemp 낮다(corr<0)·지형 상위 4분위가 찬 바이옴(row0)에 더 많이(높은 땅=찬 바이옴).
(() => {
  const cTE = corr(TER, cells.map(c => c.effTemp));
  const idx = cells.map((c, k) => k).sort((a, b) => TER[a] - TER[b]);
  const Q = (M * M) / 4, lo = idx.slice(0, Q), hi = idx.slice(-Q);
  const r0 = ks => ks.filter(k => Math.floor(cells[k].biome / NH) === 0).length / ks.length;
  const fLo = r0(lo), fHi = r0(hi);
  ok(cTE < -0.3 && fHi > fLo + 0.2,
    `산이 차다 — corr(지형,effTemp)=${cTE.toFixed(3)}<0 · 찬 바이옴(row0) 비율 지형상위 ${fHi.toFixed(2)} ≫ 하위 ${fLo.toFixed(2)}(높은 땅=찬 바이옴·자기일관 산)`);
})();

// ③ 새 거동 engage — elevFn 줄 때와 안 줄 때(0092 내부 노이즈) biome 이 *달라진다*(실제 지형 결합이 실제로 작동).
(() => {
  const bfNoise = S.biomeField({ scale: 0.07, nTemp: NT, nHum: NH, lapse: LAPSE });   // 0092(내부 노이즈)
  let diff = 0, tot = 0; for (let j = 0; j < 30; j++) for (let i = 0; i < 30; i++) { tot++; if (bf(i, j).biome !== bfNoise(i, j).biome) diff++; }
  ok(diff > tot * 0.1, `새 거동 engage — elevFn(지형) vs 내부 노이즈 biome 불일치 ${diff}/${tot}(>10%·실제 지형 결합 작동)`);
})();

// ④ 항등(lapse=0 → 0090 동일·회귀 0) — elevFn 줘도 lapse=0 이면 고도축 미사용 → 0090 biome byte 동일.
(() => {
  const b0 = S.biomeField({ scale: 0.07, nTemp: NT, nHum: NH });                       // 0090
  const b1 = S.biomeField({ scale: 0.07, nTemp: NT, nHum: NH, lapse: 0, elevFn: terr });// elevFn 있지만 lapse=0
  const a = [], b = [];
  for (let j = 0; j < 30; j++) for (let i = 0; i < 30; i++) { a.push(b0(i, j).biome); b.push(b1(i, j).biome); }
  show(L.identity('lapse=0 → 0090 동일(elevFn 무시·회귀 0)', a, b));
})();

// ⑤ 결정론·순수(경로 무관) — 같은 (i,j) → 같은 (elev,effTemp,biome).
show(L.deterministic('같은 좌표 → 같은 지형결합 바이옴(순수·경로 무관)', () => {
  const out = []; for (const [i, j] of [[3, 7], [50, 12], [9, 9], [77, 4]]) { const c = bf(i, j); out.push([c.elev.toFixed(6), c.effTemp.toFixed(6), c.biome]); }
  return out;
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
