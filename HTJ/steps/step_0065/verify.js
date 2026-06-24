// step_0065/verify.js — T1 지형 표면 발현(점→면) 수치 검증. 순수·독립.
//   design/merge-dna.md §5 T1. terrainSurface 가 지형 앵커 카펫(성긴 점 격자)을 *연속 음영 표면*으로 환원함을 검증한다:
//     ① 점→면(조밀화·연속)  ② 법선(단위·기울기 따라 기움)  ③ 채움(빈 칸 없음·높이장 따라감)  ④ 순수/engine 불변  ⑤ 결정론
//   렌더 트랙 — engine 물리 불변(새 모듈만)·이 검증은 *형태 환원*(어디에/무슨 표면)만 본다. 실행: node HTJ/steps/step_0065/verify.js
'use strict';
const path = require('path');
const T = require(path.resolve(__dirname, '../../engine/htj-terrain.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const approx = (a, b, e) => Math.abs(a - b) <= e;

// 시험 지형 — 7×7 정규 격자(앵커 카펫) 위 사인 높이장(봉우리·계곡·기울기 다양).
const W = 12, SPC = 4, hf = (x, y) => 3.0 * Math.sin(0.32 * x) * Math.cos(0.28 * y) + 1.6 * Math.sin(0.2 * x + 0.15 * y);
function buildAnchors(field) {
  const a = [];
  for (let x = -W; x <= W; x += SPC) for (let y = -W; y <= W; y += SPC) a.push({ cx: x, cy: y, cz: field(x, y) });
  return a;
}
const anchors = buildAnchors(hf);
const surf = T.terrainSurface(anchors, { up: 4 });

// ① 점→면 — 표면 정점 수 ≫ 앵커 수(조밀화) + 연속(인접 정점 높이 점프가 성긴 격자보다 작아짐 = 이어진 면).
(() => {
  const denser = surf.count > anchors.length * 4;                       // 49 앵커 → 625 정점
  // 조밀 격자 인접 정점 최대 |Δh|.
  let denseMax = 0;
  for (let J = 0; J < surf.ny; J++) for (let I = 0; I < surf.nx - 1; I++)
    denseMax = Math.max(denseMax, Math.abs(surf.heights[J * surf.nx + I + 1] - surf.heights[J * surf.nx + I]));
  // 성긴 앵커 격자 인접 |Δh| 최대(같은 y 행에서 x 이웃).
  let coarseMax = 0; const nx0 = (2 * W / SPC) + 1;
  for (let j = 0; j < nx0; j++) for (let i = 0; i < nx0 - 1; i++)
    coarseMax = Math.max(coarseMax, Math.abs(hf(-W + (i + 1) * SPC, -W + j * SPC) - hf(-W + i * SPC, -W + j * SPC)));
  // 보간된 면은 인접 점프가 성긴 점 무리의 ~1/up 로 줄어 *이어진다*.
  ok(denser && denseMax < coarseMax * 0.5,
    `점→면(조밀화·연속) — 앵커 ${anchors.length} → 표면 정점 ${surf.count}(×${(surf.count / anchors.length).toFixed(1)}) · 인접 점프 성김 ${coarseMax.toFixed(2)} → 면 ${denseMax.toFixed(2)}(이어짐)`);
})();

// ② 법선 — 모두 단위 + 평지(상수 높이)면 모두 +z·기운 면이면 n.z<1 + 기움 방향이 내리막과 일치.
(() => {
  let maxUnitErr = 0, tiltedZ = 1, dirOK = false;
  for (let J = 1; J < surf.ny - 1; J++) for (let I = 1; I < surf.nx - 1; I++) {
    const n = surf.normals[J * surf.nx + I];
    maxUnitErr = Math.max(maxUnitErr, Math.abs(Math.hypot(n.x, n.y, n.z) - 1));
    tiltedZ = Math.min(tiltedZ, n.z);
    // 한 기운 정점에서: n.x 부호 = −∂z/∂x 부호(내리막으로 기움).
    const k = J * surf.nx + I, gx = (surf.heights[k + 1] - surf.heights[k - 1]);
    if (Math.abs(gx) > 0.3 && Math.sign(n.x) === -Math.sign(gx)) dirOK = true;
  }
  // 평지 입력 → 모든 법선 정확히 (0,0,1).
  const flat = T.terrainSurface(buildAnchors(() => 5.0), { up: 4 });
  let flatOK = true;
  for (const n of flat.normals) if (!(approx(n.x, 0, 1e-12) && approx(n.y, 0, 1e-12) && approx(n.z, 1, 1e-12))) flatOK = false;
  ok(maxUnitErr < 1e-12 && tiltedZ < 0.95 && dirOK && flatOK,
    `법선(단위·기울기 따라 기움) — 단위오차 ${maxUnitErr.toExponential(1)} · 최소 n.z ${tiltedZ.toFixed(3)}(<1=기운 면) · 내리막 방향 ${dirOK} · 평지→(0,0,1) ${flatOK}`);
})();

// ③ 채움 — 빈 칸(NaN) 없음(전 footprint 덮음) + 성긴 격자점에서 표면 높이=앵커 높이(높이장 따라감).
(() => {
  let filled = true; for (const h of surf.heights) if (!Number.isFinite(h)) filled = false;
  // 조밀 정점 중 성긴 격자선과 겹치는 점(I=i*up,J=j*up)은 보간이 앵커값을 정확 재현.
  let nodeErr = 0; const up = 4;
  for (let j = 0; j * up < surf.ny; j++) for (let i = 0; i * up < surf.nx; i++) {
    const h = surf.heights[(j * up) * surf.nx + (i * up)], hAnchor = hf(-W + i * SPC, -W + j * SPC);
    nodeErr = Math.max(nodeErr, Math.abs(h - hAnchor));
  }
  ok(filled && nodeErr < 1e-9,
    `채움(빈 칸 없음·높이장 따라감) — 정점 ${surf.count}개 전부 유한 ${filled} · 격자점 높이=앵커 오차 ${nodeErr.toExponential(1)}`);
})();

// ④ 순수/engine 불변 — terrainSurface 가 입력 앵커를 변형하지 않음(표현일 뿐·물리 안 건드림).
(() => {
  const a2 = buildAnchors(hf), before = JSON.stringify(a2);
  T.terrainSurface(a2, { up: 6 });
  ok(JSON.stringify(a2) === before, `순수 — 입력 앵커 불변(물리량 안 바뀜·표현 환원만)`);
})();

// ⑤ 결정론 — 같은 앵커 → 같은 표면(높이·법선 지문 동일).
(() => {
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
  const sig = (S) => fnv(S.heights.map(v => v.toFixed(6)).join(',') + '|' + S.normals.map(n => n.x.toFixed(6) + n.y.toFixed(6) + n.z.toFixed(6)).join(','));
  const s1 = sig(T.terrainSurface(anchors, { up: 4 })), s2 = sig(T.terrainSurface(buildAnchors(hf), { up: 4 }));
  ok(s1 === s2, `결정론 — 같은 앵커 → 같은 표면 지문 0x${s1}`);
})();

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
