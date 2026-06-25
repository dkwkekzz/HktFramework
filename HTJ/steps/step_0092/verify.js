// step_0092/verify.js — 고도×바이옴 결합: 세 번째 독립 fBm 축(고도)이 기온 감률로 유효 온도를 낮춘다.
//   확인용 트랙(viewer/htj-stream.js·engine 변경 0·0090 biomeField 의 고도 결합 판). 새 거동 = 고지대일수록
//   effTemp=temp−lapse·elev 가 낮아져 *찬 바이옴 칸으로 이동*(적도 산봉우리 툰드라). 세 축 모두 무상관(salt 분리)·
//   각 축 공간 상관. lapse=0 → 0090 biome byte 동일(회귀 0). 결정론·순수는 공용 가드.
//   실행: node HTJ/steps/step_0092/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const M = 80, NT = 3, NH = 3, LAPSE = 0.45;
const bf = S.biomeField({ scale: 0.08, nTemp: NT, nHum: NH, lapse: LAPSE });
const cells = [];
for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) cells.push(bf(i, j));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const corr = (A, B) => { const ma = mean(A), mb = mean(B); let c = 0, va = 0, vb = 0; for (let k = 0; k < A.length; k++) { c += (A[k] - ma) * (B[k] - mb); va += (A[k] - ma) ** 2; vb += (B[k] - mb) ** 2; } return c / Math.sqrt(va * vb); };

const T = cells.map(c => c.temp), H = cells.map(c => c.humidity), E = cells.map(c => c.elev);

// ① 고도 축 독립(핵심) — elev 가 temp·humidity 와 *서로 무상관*(salt 분리). 세 축이 진짜 독립이라야 진짜 3D 결합.
ok(Math.abs(corr(E, T)) < 0.1 && Math.abs(corr(E, H)) < 0.1,
  `고도 축 독립 — corr(elev,temp)=${corr(E, T).toFixed(4)}·corr(elev,hum)=${corr(E, H).toFixed(4)} ≈ 0 (세 축 무상관·salt 분리)`);

// ② 기온 감률 결합(새 거동·산악 툰드라) — ⓐ 고도 ↑ → effTemp ↓(corr<0) ⓑ 고도 상위 4분위의 *유효온도*가 하위 4분위보다
//    뚜렷이 낮고 ⓒ 그 결과 찬 바이옴(row0) 비율도 상위에서 더 높다 = "높은 곳이 더 찬 바이옴"(적도 봉우리라도 툰드라).
(() => {
  const cEE = corr(E, cells.map(c => c.effTemp));
  const idx = cells.map((c, k) => k).sort((a, b) => E[a] - E[b]);
  const Q = (M * M) / 4;
  const lo = idx.slice(0, Q), hi = idx.slice(-Q);
  const effLo = mean(lo.map(k => cells[k].effTemp)), effHi = mean(hi.map(k => cells[k].effTemp));
  const r0 = ks => ks.filter(k => Math.floor(cells[k].biome / NH) === 0).length / ks.length;
  const fLo = r0(lo), fHi = r0(hi);
  ok(cEE < -0.2 && effLo - effHi > 0.1 && fHi > fLo + 0.1,
    `기온 감률 — corr(elev,effTemp)=${cEE.toFixed(3)}<0 · 유효온도 고도하위 ${effLo.toFixed(3)} > 상위 ${effHi.toFixed(3)}(Δ${(effLo - effHi).toFixed(3)}) · 찬바이옴(row0) 비율 상위 ${fHi.toFixed(2)}>하위 ${fLo.toFixed(2)}(산악 툰드라)`);
})();

// ③ 각 축 공간 상관(코히어런트) — 고도 축도 이웃차 ≪ 무작위쌍차(백색 잡음 아님·뭉친 산맥).
(() => {
  let nE = 0, nc = 0; for (let j = 0; j < M; j++) for (let i = 0; i < M - 1; i++) { nE += Math.abs(bf(i, j).elev - bf(i + 1, j).elev); nc++; }
  let rnd = 0, rc = 0; for (let k = 0; k < 3000; k++) { rnd += Math.abs(bf((k * 7) % M, (k * 13) % M).elev - bf((k * 17) % M, (k * 29) % M).elev); rc++; }
  const nbr = nE / nc, rp = rnd / rc;
  ok(nbr < rp * 0.5, `고도 공간 상관 — 이웃차 ${nbr.toFixed(3)} ≪ 무작위쌍차 ${rp.toFixed(3)}(코히어런트 산맥·백색 아님)`);
})();

// ④ 항등(lapse=0 → 0090 동일·회귀 0) — lapse 안 주면(또는 0) biome 이 0090 biomeField 와 byte 동일.
(() => {
  const b0 = S.biomeField({ scale: 0.08, nTemp: NT, nHum: NH });            // 0090(고도 결합 없음)
  const b1 = S.biomeField({ scale: 0.08, nTemp: NT, nHum: NH, lapse: 0 });  // 0092·lapse=0
  const a = [], b = [];
  for (let j = 0; j < 30; j++) for (let i = 0; i < 30; i++) { a.push(b0(i, j).biome); b.push(b1(i, j).biome); }
  show(L.identity('lapse=0 → 0090 biome 동일(회귀 0)', a, b));
})();

// ⑤ 결정론·순수(경로 무관) — 같은 (i,j) → 같은 (temp,hum,elev,biome).
show(L.deterministic('같은 좌표 → 같은 고도결합 바이옴(순수·경로 무관)', () => {
  const out = []; for (const [i, j] of [[3, 7], [50, 12], [9, 9], [77, 4]]) { const c = bf(i, j); out.push([c.temp.toFixed(6), c.humidity.toFixed(6), c.elev.toFixed(6), c.effTemp.toFixed(6), c.biome]); }
  return out;
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
