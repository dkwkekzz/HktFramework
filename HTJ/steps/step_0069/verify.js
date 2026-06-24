// step_0069/verify.js — T3 거리 LOD 검증. 순수·독립. (렌더 트랙: engine 불변·회귀 구조적 0.
//   새 거동 = 발현 해상도가 관찰자 거리에 묶임[가까이 fine·멀면 coarse·끝엔 민둥 구]·비용∝관찰 영역.
//   순수·결정론·항등은 tools/htj-verify-lib.js 공용 가드.)
//   merge-dna §5 T3 — "멀면 hash 한 개(coarse)·가까이 fine". 실행: node HTJ/steps/step_0069/verify.js
'use strict';
const path = require('path');
const Lod = require(path.resolve(__dirname, '../../viewer/htj-lod.js'));
const D = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const S = require(path.resolve(__dirname, '../../viewer/htj-surface.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// 같은 타일(3×3 봉우리) 청크들을 x축으로 일렬 배치 — 같은 hash 공유(dedup K=1).
const S0 = 12;                                          // 청크 간격 = band → 청크 i 가 레벨 i
function tile() { const m = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) m.push({ cx: i, cy: j, cz: Math.max(0, 1 - (i * i + j * j) / 3) }); return m; }
function grid(K) {
  const dict = {}, hash = D.registerShape(dict, tile()), ents = [];
  for (let i = 0; i < K; i++) ents.push({ cx: i * S0, cy: 0, cz: 20, radius: S0 * 0.5, shapeHash: hash });
  return { dict, ents, hash };
}
const OBS = { cx: 0, cy: 0, cz: 20 };                   // 관찰자 = 청크 0 위치
const OPT = { band: S0, maxL: 4, ropt: { quantum: 0.25, spread: 2.2, subScale: 2.0 } };
const P = D.reconstructShape({ cx: 0, cy: 0, cz: 20, radius: S0 * 0.5, shapeHash: grid(1).hash }, grid(1).dict, OPT.ropt).length;  // fine 청크 점 수

// ① 거리 LOD (새 거동) — 가까운 청크는 fine(전체 점)·멀수록 점 수 단조↓·가장 먼 청크는 민둥 구 1개.
(() => {
  const g = grid(6), r = Lod.lodCloud(g.ents, g.dict, OBS, OPT);
  let mono = true; for (let i = 1; i < r.counts.length; i++) if (r.counts[i] > r.counts[i - 1]) mono = false;
  const fineFull = r.counts[0] === P, coarse1 = r.counts[5] === 1 && r.levels[5] === OPT.maxL;
  ok(mono && fineFull && coarse1, `거리 LOD — 청크별 점 수 ${r.counts.join('→')}(가까이 fine=${P}·단조↓·가장 먼=민둥 구 1) · 레벨 ${r.levels.join('')}`);
})();

// ② 비용 ∝ 관찰 영역(핵심 측정·0039/0015 계보) — 먼 세계를 키워도 fine(비싼) 예산 불변·먼 청크는 청크당 O(1).
(() => {
  const a = Lod.lodCloud(grid(6).ents, grid(6).dict, OBS, OPT);
  const b = Lod.lodCloud(grid(20).ents, grid(20).dict, OBS, OPT);
  const fineInvariant = a.finePoints === b.finePoints;                        // 먼 청크 14개 추가해도 fine 예산 그대로
  let farO1 = true; const g20 = grid(20), r20 = Lod.lodCloud(g20.ents, g20.dict, OBS, OPT);
  for (let i = 0; i < r20.levels.length; i++) if (r20.levels[i] === OPT.maxL && r20.counts[i] !== 1) farO1 = false;  // 먼 청크 = 청크당 1
  const allFine = 20 * P, saving = b.totalPoints / allFine;                   // 전부 fine 대비 절감
  ok(fineInvariant && farO1 && b.totalPoints < allFine * 0.5,
    `비용∝관찰 — fine 예산 K=6:${a.finePoints} = K=20:${b.finePoints}(먼 세계 키워도 불변) · 먼 청크 청크당 O(1) ${farO1} · 총점 ${b.totalPoints}≪전부fine ${allFine}(×${saving.toFixed(2)})`);
})();

// ③ 표면 보존 — near=fine 청크 점은 reconstructShape 와 정확 일치(가까이 충실)·LOD 점 무리→유효 연속 표면.
(() => {
  const g = grid(6), r = Lod.lodCloud(g.ents, g.dict, OBS, OPT);
  const exact = D.reconstructShape(g.ents[0], g.dict, OPT.ropt);              // 청크 0(L0)은 cloud 맨 앞 P 점
  let nearMatch = exact.length === P; for (let i = 0; i < P && nearMatch; i++) { const a = r.cloud[i], b = exact[i]; if (a.cx !== b.cx || a.cy !== b.cy || a.cz !== b.cz || a.r !== b.r) nearMatch = false; }
  const surf = S.pointCloudSurface(r.cloud, { res: 64 });
  let unit = true, finite = true; for (const n of surf.normals) if (Math.abs(Math.hypot(n.x, n.y, n.z) - 1) > 1e-9) unit = false; for (const h of surf.heights) if (!isFinite(h)) finite = false;
  ok(nearMatch && surf.filled > 0 && unit && finite, `표면 보존 — near=fine 청크 점 ${P}개 reconstructShape 정확 일치 ${nearMatch} · LOD 점 무리→연속 표면(점유 ${surf.filled}·법선 단위 ${unit}·유한 ${finite})`);
})();

// ④ 항등(노브=0→회귀 0) — band<=0 → 모든 청크 fine = reconstructShape 전부 이어붙인 0068 발현과 byte 동일.
(() => {
  const g = grid(5);
  const lod = Lod.lodCloud(g.ents, g.dict, OBS, { band: 0, ropt: OPT.ropt }).cloud;
  const base = []; for (const e of g.ents) for (const p of D.reconstructShape(e, g.dict, OPT.ropt)) base.push(p);
  show(L.identity('band≤0 → 전부 fine = reconstructShape 발현(0068)', JSON.stringify(base), JSON.stringify(lod)));
})();

// ⑤ 결정론(공용 가드) — 같은 세계·관찰자 → 같은 LOD 점 무리.
show(L.deterministic('같은 세계·관찰자 → 같은 LOD 발현', () => { const g = grid(8), r = Lod.lodCloud(g.ents, g.dict, OBS, OPT); return { c: r.counts, n: r.cloud.map(p => `${p.cx.toFixed(4)},${p.cy.toFixed(4)},${p.r.toFixed(4)}`) }; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
