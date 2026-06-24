// step_0066/verify.js — 지형이 자란다(퇴적 발현) 수치 검증. 순수·독립.
//   design/environment.md §2/§4 "그 위의 거동(…쌓임/깎임)은 구체 법칙의 창발" + merge-dna §5 T1(표면 발현) 확장.
//   정착한 자유 구체(퇴적물)가 지형 표면 *위에 얹혀* 표면을 들어올림을 검증한다(정착=0059 물리·표면은 읽기만):
//     ① 퇴적 융기(계곡이 차오름)  ② 항등(퇴적 없음→T1 0065 표면 byte 동일)  ③ 채움/연속(빈 칸 없음·표면 이어짐)
//     ④ 순수(앵커·퇴적 입력 불변)  ⑤ 결정론
//   렌더 트랙 — engine 물리 불변(terrainSurface 가법 확장만). 실행: node HTJ/steps/step_0066/verify.js
'use strict';
const path = require('path');
const T = require(path.resolve(__dirname, '../../engine/htj-terrain.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };

// 시험 지형 — 7×7 앵커 카펫(가운데가 낮은 계곡·사발). 계곡에 퇴적물(정착 구체)이 쌓인다.
const W = 12, SPC = 4, bowl = (x, y) => 0.04 * (x * x + y * y) - 5;   // 가운데(원점) 낮은 사발
const anchors = [];
for (let x = -W; x <= W; x += SPC) for (let y = -W; y <= W; y += SPC) anchors.push({ cx: x, cy: y, cz: bowl(x, y) });
// 계곡(원점 근처)에 정착한 퇴적 구체 무리(0059 처럼 낮은 데로 모인 결과를 모사).
const deposits = [];
for (let i = 0; i < 12; i++) { const a = i * 2.39996, rr = Math.sqrt(i / 12) * 4; deposits.push({ cx: Math.cos(a) * rr, cy: Math.sin(a) * rr, cz: bowl(Math.cos(a) * rr, Math.sin(a) * rr) + 1.2, radius: 1.6 }); }

const s0 = T.terrainSurface(anchors, { up: 4 });                     // 맨 지형(퇴적 전)
const s1 = T.terrainSurface(anchors, { up: 4, deposits });          // 퇴적 후

// 격자 인덱스(월드 → 가장 가까운 정점).
const vidx = (wx, wy) => { const I = Math.round((wx - s0.x0) / s0.dx), J = Math.round((wy - s0.y0) / s0.dy); return J * s0.nx + I; };

// ① 퇴적 융기 — 계곡(원점)에서 퇴적 후 표면이 *올라간다*(지형이 자란다). 퇴적 발자국 밖은 불변.
(() => {
  const kCen = vidx(0, 0);
  const grew = s1.heights[kCen] - s0.heights[kCen];
  // 발자국 밖(구석)은 변화 0(국소성).
  const kFar = vidx(W, W), farDelta = Math.abs(s1.heights[kFar] - s0.heights[kFar]);
  // 융기 봉우리 ≈ 퇴적 구 상단(cz+r) 근처 — max splat 이라 안 꺼지고 위로만.
  let neverLower = true; for (let k = 0; k < s0.heights.length; k++) if (s1.heights[k] < s0.heights[k] - 1e-12) neverLower = false;
  ok(grew > 1.5 && farDelta < 1e-9 && neverLower,
    `퇴적 융기(계곡이 차오름) — 계곡 표면 +${grew.toFixed(2)}(자란다) · 발자국 밖 Δ${farDelta.toExponential(1)}(국소) · 어디서도 안 꺼짐 ${neverLower}`);
})();

// ② 항등 — 퇴적 없으면 T1(0065) 표면과 byte 동일(가법·회귀0). depositCount 표기.
(() => {
  const sig = (S) => S.heights.map(v => v.toFixed(9)).join(',') + '|' + S.normals.map(n => n.x.toFixed(9) + n.y.toFixed(9) + n.z.toFixed(9)).join(',');
  const sA = T.terrainSurface(anchors, { up: 4 }), sB = T.terrainSurface(anchors, { up: 4, deposits: [] });
  ok(sig(sA) === sig(s0) && sig(sB) === sig(s0) && s0.depositCount === 0 && s1.depositCount === 12,
    `항등(퇴적 없음→T1 표면 byte 동일) — 빈 deposits=무지정=동일 · depositCount 0/${s1.depositCount}`);
})();

// ③ 채움/연속 — 퇴적 후도 빈 칸 없음 + 인접 정점 점프 유한(이어진 면·퇴적 봉우리가 매끄럽게 섞임).
(() => {
  let filled = true; for (const h of s1.heights) if (!Number.isFinite(h)) filled = false;
  let maxJump = 0;
  for (let J = 0; J < s1.ny; J++) for (let I = 0; I < s1.nx - 1; I++) maxJump = Math.max(maxJump, Math.abs(s1.heights[J * s1.nx + I + 1] - s1.heights[J * s1.nx + I]));
  // 법선 단위(퇴적 봉우리도 정상 법선).
  let unitErr = 0; for (const n of s1.normals) unitErr = Math.max(unitErr, Math.abs(Math.hypot(n.x, n.y, n.z) - 1));
  ok(filled && maxJump < 3 && unitErr < 1e-12,
    `채움/연속 — 정점 ${s1.count} 전부 유한 ${filled} · 인접 점프 max ${maxJump.toFixed(2)}(이어짐) · 법선 단위오차 ${unitErr.toExponential(1)}`);
})();

// ④ 순수 — 앵커·퇴적 입력 불변(표면은 읽기만·물리 안 건드림).
(() => {
  const a2 = anchors.map(a => ({ ...a })), d2 = deposits.map(d => ({ ...d })), ba = JSON.stringify(a2), bd = JSON.stringify(d2);
  T.terrainSurface(a2, { up: 5, deposits: d2 });
  ok(JSON.stringify(a2) === ba && JSON.stringify(d2) === bd, `순수 — 앵커·퇴적 입력 불변(읽기만·물리량 안 바뀜)`);
})();

// ⑤ 결정론 — 같은 앵커·퇴적 → 같은 표면 지문.
(() => {
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
  const sig = (S) => fnv(S.heights.map(v => v.toFixed(6)).join(',') + '|' + S.normals.map(n => n.x.toFixed(6) + n.y.toFixed(6) + n.z.toFixed(6)).join(','));
  const g1 = sig(T.terrainSurface(anchors, { up: 4, deposits })), g2 = sig(T.terrainSurface(anchors, { up: 4, deposits }));
  ok(g1 === g2, `결정론 — 같은 앵커·퇴적 → 같은 표면 지문 0x${g1}`);
})();

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
