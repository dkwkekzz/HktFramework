// step_0067/verify.js — 매끄러운 퇴적 수치 검증. 순수·독립. (장면 통일 U2: 새 법칙만 직접 쓰고
//   보존·항등·결정론은 tools/htj-verify-lib.js 공용 가드 한 줄 호출.)
//   design/environment.md §2/§4(쌓임=구체 법칙의 창발)·merge-dna §5 T1 확장 — 0066 의 울퉁한 퇴적을 이완.
//   렌더 트랙 — engine 물리 불변(terrainSurface 가법 확장 smooth 만). 실행: node HTJ/steps/step_0067/verify.js
'use strict';
const path = require('path');
const T = require(path.resolve(__dirname, '../../engine/htj-terrain.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// 시험 지형 — 0066 verify 와 같은 사발 카펫 + 정착 퇴적 구 무리(매끄러움 효과가 또렷하도록 촘촘).
const W = 12, SPC = 4, bowl = (x, y) => 0.04 * (x * x + y * y) - 5;
const anchors = [];
for (let x = -W; x <= W; x += SPC) for (let y = -W; y <= W; y += SPC) anchors.push({ cx: x, cy: y, cz: bowl(x, y) });
const deposits = [];
for (let i = 0; i < 16; i++) { const a = i * 2.39996, rr = Math.sqrt(i / 16) * 4.5; deposits.push({ cx: Math.cos(a) * rr, cy: Math.sin(a) * rr, cz: bowl(Math.cos(a) * rr, Math.sin(a) * rr) + 1.3, radius: 1.8 }); }

const SMOOTH = 24;
const sBase = T.terrainSurface(anchors, { up: 4 });                              // 퇴적 전 지형
const s066 = T.terrainSurface(anchors, { up: 4, deposits });                     // 울퉁(0066·smooth 없음)
const s067 = T.terrainSurface(anchors, { up: 4, deposits, smooth: SMOOTH });     // 매끄러움(0067)

// 인접 정점 높이차 제곱합 = 거칠기(roughness). 작을수록 매끄럽다.
const roughness = (S) => { let r = 0; for (let J = 0; J < S.ny; J++) for (let I = 0; I < S.nx - 1; I++) { const d = S.heights[J * S.nx + I + 1] - S.heights[J * S.nx + I]; r += d * d; } return r; };
// 쌓인 부피 Σdelta = Σ(heights − base) (퇴적 발자국 안에서만 >0).
const volume = (S) => { let v = 0; for (let k = 0; k < S.heights.length; k++) v += S.heights[k] - sBase.heights[k]; return v; };
const vidx = (wx, wy) => { const I = Math.round((wx - sBase.x0) / sBase.dx), J = Math.round((wy - sBase.y0) / sBase.dy); return J * sBase.nx + I; };

// ① 매끄러움(새 법칙) — 평활 후 거칠기가 *크게* 준다(울퉁한 봉우리 → 매끄러운 둔덕). 최대 인접 점프도 줄어든다.
(() => {
  const r0 = roughness(s066), r1 = roughness(s067);
  let j0 = 0, j1 = 0;
  for (let J = 0; J < s066.ny; J++) for (let I = 0; I < s066.nx - 1; I++) { j0 = Math.max(j0, Math.abs(s066.heights[J * s066.nx + I + 1] - s066.heights[J * s066.nx + I])); j1 = Math.max(j1, Math.abs(s067.heights[J * s067.nx + I + 1] - s067.heights[J * s067.nx + I])); }
  ok(r1 < r0 * 0.7 && j1 < j0, `매끄러움(새 법칙) — 거칠기 ${r0.toFixed(2)} → ${r1.toFixed(2)} (×${(r1 / r0).toFixed(2)}<0.7) · 최대 인접점프 ${j0.toFixed(2)} → ${j1.toFixed(2)}(준다)`);
})();

// ② 융기 유지 + 일방 퇴적 — 평활해도 계곡은 여전히 차오르고(>base), 어디서도 base 아래로 안 꺼진다(깎임 아님).
(() => {
  const kCen = vidx(0, 0), grew = s067.heights[kCen] - sBase.heights[kCen];
  let neverBelow = true; for (let k = 0; k < s067.heights.length; k++) if (s067.heights[k] < sBase.heights[k] - 1e-9) neverBelow = false;
  ok(grew > 0.5 && neverBelow, `융기 유지·일방 퇴적 — 계곡 +${grew.toFixed(2)}(여전히 자람) · base 아래로 안 꺼짐 ${neverBelow}(깎임 아님)`);
})();

// ③ 부피 보존(공용 가드) — 평활은 쌓인 물질을 *옮길* 뿐 더하거나 빼지 않는다(확산 쌍대칭 → Σdelta 보존).
show(L.conserved('퇴적 부피 Σdelta(평활=재분배)', volume(s066), volume(s067), 1e-9));

// ④ 항등(공용 가드) — smooth=0 → 0066(deposits splat) 표면과 byte 동일(가법·회귀0).
(() => {
  const sig = (S) => S.heights.map(v => v.toFixed(9)).join(',') + '|' + S.normals.map(n => n.x.toFixed(9) + n.y.toFixed(9) + n.z.toFixed(9)).join(',');
  const s0 = T.terrainSurface(anchors, { up: 4, deposits, smooth: 0 });
  show(L.identity('smooth=0 → 0066 표면', sig(s066), sig(s0)));
})();

// ⑤ 결정론(공용 가드) — 같은 입력 → 같은 매끄러운 표면.
show(L.deterministic('같은 앵커·퇴적·smooth → 같은 표면', () => { const S = T.terrainSurface(anchors, { up: 4, deposits, smooth: SMOOTH }); return { h: S.heights.map(v => v.toFixed(6)) }; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
