// step_0068/verify.js — T2b 제너릭 표면 발현 검증. 순수·독립. (렌더 트랙: engine 불변·회귀 구조적 0.
//   새 발현 = 어떤 점 무리든 점→면 연속 표면. 순수·결정론은 tools/htj-verify-lib.js 공용 가드.)
//   merge-dna §5 T2(B) — pointCloudSurface 는 *타입 무관*(지형 특별취급 아님)이 핵심. 실행: node HTJ/steps/step_0068/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-surface.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// 시험 점 무리 — 봉우리 둔덕(겹치는 sub-구체). 0068 장면 골격과 무관·독립.
function moundCloud() {
  const c = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) c.push({ cx: i * 1.5, cy: j * 1.5, cz: 1.3 * Math.max(0, 1 - (i * i + j * j) / 6), r: 1.6 });
  return c;
}

// ① 점→면(새 발현) — 성긴 점 무리(25개)가 *연속 채움 표면*(res²)으로. 점유 셀 다수·인접 점프 작음(이어짐).
(() => {
  const cloud = moundCloud(), surf = S.pointCloudSurface(cloud, { res: 64 });
  let maxJump = 0;
  for (let J = 0; J < surf.ny; J++) for (let I = 0; I < surf.nx - 1; I++) { const k = J * surf.nx + I; if (surf.mask[k] && surf.mask[k + 1]) maxJump = Math.max(maxJump, Math.abs(surf.heights[k + 1] - surf.heights[k])); }
  ok(surf.filled > cloud.length * 10 && maxJump < 0.7, `점→면 — 점 ${cloud.length}개 → 표면 점유 ${surf.filled}셀(연속·×${(surf.filled / cloud.length) | 0}) · 인접 점프 max ${maxJump.toFixed(3)}(이어짐<0.7)`);
})();

// ② 법선 단위·기복 반영 — 모든 법선 단위(오차~0)·둔덕 옆면은 기울고(n.z<1) 평평한 데는 위(n.z≈1).
(() => {
  const surf = S.pointCloudSurface(moundCloud(), { res: 64 });
  let maxErr = 0, minNz = 1;
  for (const n of surf.normals) { maxErr = Math.max(maxErr, Math.abs(Math.hypot(n.x, n.y, n.z) - 1)); minNz = Math.min(minNz, n.z); }
  ok(maxErr < 1e-9 && minNz < 0.98, `법선 — 단위오차 ${maxErr.toExponential(1)} · 최소 n.z ${minNz.toFixed(3)}(옆면 기욺=기복 반영)`);
})();

// ③ 타입 무관(원칙의 핵심) — *지형 아닌* 임의 점 무리(흩뿌린 블롭)도 같은 함수가 유효 표면으로 발현.
(() => {
  const blob = [];
  for (let i = 0; i < 30; i++) { const a = i * 2.3998, rr = 0.4 + (i % 5); blob.push({ cx: Math.cos(a) * rr, cy: Math.sin(a) * rr, cz: (i % 3) - 1, r: 1.4 }); }
  const surf = S.pointCloudSurface(blob, { res: 48 });
  let allFinite = true; for (const h of surf.heights) if (!isFinite(h)) allFinite = false;
  let unit = true; for (const n of surf.normals) if (Math.abs(Math.hypot(n.x, n.y, n.z) - 1) > 1e-9) unit = false;
  ok(surf.filled > 0 && allFinite && unit, `타입 무관 — 지형 아닌 블롭도 유효 표면(점유 ${surf.filled}·전부 유한 ${allFinite}·법선 단위 ${unit}) = 지형 특별취급 아님`);
})();

// ④ 순수(공용 가드) — 입력 점 무리를 안 건드린다(읽기만·세계↔확인용 단방향).
(() => {
  const cloud = moundCloud(), before = JSON.stringify(cloud);
  S.pointCloudSurface(cloud, { res: 64 });
  show(L.identity('pointCloudSurface 입력 점 무리 불변', before, JSON.stringify(cloud)));
})();

// ⑤ 결정론(공용 가드) — 같은 점 무리 → 같은 표면.
show(L.deterministic('같은 점 무리 → 같은 표면', () => { const s = S.pointCloudSurface(moundCloud(), { res: 48 }); return { h: s.heights.map(v => v.toFixed(6)), f: s.filled }; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
