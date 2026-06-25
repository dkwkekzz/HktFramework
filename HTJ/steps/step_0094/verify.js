// step_0094/verify.js — 바이옴이 지형 형태(DNA)를 고른다: biome → 지형 DNA 팔레트(streamChunks shapeAt).
//   조립 step(engine 변경 0·구조적 회귀 0). 부품: biomeField(0090~0093)·registerShape/shapeDNA(0062)·streamChunks(0073).
//   새로 생긴 창발 = 무한 세계의 *지형 형태*(어느 DNA 랜드폼)가 단일 높이 노이즈(0074)가 아니라 *바이옴*에 의해 결정 —
//   같은 바이옴 지역은 같은 랜드폼(코히어런트 지형 성격)·기후마다 다른 지형(툰드라 평탄·사막 사구·삼림 구릉…).
//   부품 자체 보존은 부품 verify 가 보증(중복 검증 금지). 결정론·순수는 공용 가드.
//   실행: node HTJ/steps/step_0094/verify.js
'use strict';
const path = require('path');
const D = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// 5 *기하적으로 구별되는* 랜드폼(평탄·사구·평원·구릉·능선) — shapeDNA 는 스케일 불변이라 *모양*이 달라야 다른 hash.
function landTile(kind) {
  const m = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const b = Math.max(0, 1 - (i * i + j * j) / 8);
    let cz = 0;
    if (kind === 1) cz = 0.4 * Math.sin(i * 1.6);                       // 사구: 평행 잔물결
    else if (kind === 2) cz = 0.25 * (((i + j) & 1) ? 1 : -1);          // 평원: 얕은 요철
    else if (kind === 3) cz = 1.3 * b;                                  // 구릉: 둥근 돔
    else if (kind === 4) cz = 2.2 * Math.max(0, 1 - Math.abs(i)) ;      // 능선: i=0 줄로 솟은 등성이
    m.push({ cx: i, cy: j, cz });
  }
  return m;
}
const dict = {};
const LAND = [0, 1, 2, 3, 4].map(k => D.registerShape(dict, landTile(k)));   // [평탄,사구,평원,구릉,능선]
// biome(0..8 = tempRow*3+humRow) → 랜드폼 인덱스. 기후가 지형 형태를 고른다(설계 표·타입 하드코딩은 *렌더 밖* 매핑일 뿐).
const BIOME2FORM = [0, 4, 4, 2, 3, 3, 1, 2, 3];   // 한대:평탄/능선/능선 · 온대:평원/구릉/구릉 · 열대:사구/평원/구릉
const bf = Stream.biomeField({ scale: 0.09, nTemp: 3, nHum: 3, latAmp: 0.45, latPeriod: 60 });
const shapeAt = (i, j) => LAND[BIOME2FORM[bf(i, j).biome]];

const spacing = 6, radius = spacing * 20;
const obs = { cx: 1500, cy: -300 };
const s = Stream.streamChunks(obs, { spacing, radius, z: 0, shapeAt });
const chunks = s.chunks;

// ① 형태=바이옴 함수(핵심 창발) — 모든 청크의 shapeHash 가 그 셀 biome 의 지정 랜드폼과 정확히 일치(형태가 바이옴의 순수 함수).
(() => {
  let match = 0;
  for (const c of chunks) { const b = bf(c.gx, c.gy).biome; if (c.shapeHash === LAND[BIOME2FORM[b]]) match++; }
  ok(chunks.length > 0 && match === chunks.length,
    `형태=바이옴 함수 — ${match}/${chunks.length} 청크의 DNA 랜드폼이 그 바이옴이 고른 형태와 일치(지형 형태가 바이옴 결정·단일 노이즈 아님)`);
})();

// ② 지형 형태 다양성 — 한 창에 여러 랜드폼이 나타난다(기후 따라 지형 성격이 달라짐·균일 아님).
(() => {
  const used = new Set(chunks.map(c => c.shapeHash));
  ok(used.size >= 3, `지형 다양성 — 한 창에 랜드폼 ${used.size}종 발현(기후마다 다른 지형·툰드라 평탄/사막 사구/삼림 구릉…)`);
})();

// ③ 코히어런트(바이옴이 뭉쳐 지형 성격도 뭉침) — 이웃 청크가 같은 랜드폼인 비율 ≫ 무작위 두 청크가 같을 비율.
(() => {
  const map = new Map(); for (const c of chunks) map.set(c.gx + ',' + c.gy, c.shapeHash);
  let same = 0, nb = 0;
  for (const c of chunks) { const r = map.get((c.gx + 1) + ',' + c.gy); if (r !== undefined) { nb++; if (r === c.shapeHash) same++; } }
  const nbrSame = same / nb;
  const counts = {}; for (const c of chunks) counts[c.shapeHash] = (counts[c.shapeHash] || 0) + 1;
  let rndSame = 0; for (const k in counts) { const p = counts[k] / chunks.length; rndSame += p * p; }  // 무작위쌍 일치 확률
  ok(nbrSame > rndSame + 0.15, `코히어런트 — 이웃 청크 같은 랜드폼 ${nbrSame.toFixed(2)} ≫ 무작위쌍 ${rndSame.toFixed(2)}(바이옴 뭉침→지형 성격 뭉침)`);
})();

// ④ DNA dedup(부품 합성 온전) — 서로 다른 형태 K개가 청크 수 N 보다 훨씬 작다(shapeDict 공유·K≪N).
(() => {
  const K = Object.keys(dict).length, N = chunks.length;
  ok(K <= 5 && K < N / 5, `DNA dedup — 형태 ${K}종 ≪ 청크 ${N}개(shapeDict 공유·세계가 K개만 보유·M2 정신)`);
})();

// ⑤ 결정론·순수(경로 무관) — 같은 관찰자 → 같은 청크 형태 배열.
show(L.deterministic('같은 관찰자 → 같은 바이옴 지형(순수·경로 무관)', () => {
  const out = Stream.streamChunks(obs, { spacing, radius, z: 0, shapeAt });
  return out.chunks.map(c => [c.gx, c.gy, c.shapeHash]);
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
