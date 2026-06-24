// step_0063/verify.js — M3 DNA 로 렌더: 합친 개체를 shapeHash 로 *원래 윤곽*(구성원 점 무리)으로 복원. 순수·독립·영구.
//
//   design/merge-dna.md §4 M3 — M2(0062)가 합친 개체에 shapeHash 를 붙이고 세계 사전(shapeDict)이 형태를 K종
//   공유한다. 이 step 은 그 사전을 읽어 개체를 *민둥 구가 아니라* 원래 구성원 배치(윤곽)로 펼친다 = "큰 원이
//   지형 모양으로 돌아온다"(사용자 "큰 원이 지형 안 됨" 문제의 답). `reconstructShape`(htj-shapedna.js·순수)는
//   *어디에 그릴지*(점 무리 위치·크기)만 계산하고, 픽셀은 viewer/capture 가 그린다(세계↔확인용 단방향).
//   engine 물리 변경 0 → 회귀 0(구조적). 적정 검증: ① 형태 복원(hash→count개 점·민둥 구 아님) ② 위치·스케일
//   따라감 ③ DNA 없음→null(단일 구 폴백) ④ 순수/불변 ⑤ 결정론. 실행: node HTJ/steps/step_0063/verify.js
'use strict';
const path = require('path');
const DNA = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// L 자 4점 클러스터 → DNA 등록 → 그 hash 를 단 합친 개체.
const L = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0]];
function members(arr, ox, oy, s) { return arr.map(([x, y, z]) => ({ cx: (x * (s || 1)) + (ox || 0), cy: (y * (s || 1)) + (oy || 0), cz: z, mass: 1 })); }
const dict = {};
const hL = DNA.registerShape(dict, members(L));
function body(cx, cy, cz, radius, hash) { return { cx, cy, cz, radius, shapeHash: hash }; }

// ── 1. 형태 복원 — 민둥 구(1점)가 아니라 구성원 수(count)만큼의 점 무리로 펼친다 ──
{
  const e = body(50, 50, 0, 4, hL);
  const shape = DNA.reconstructShape(e, dict);
  const ok = Array.isArray(shape) && shape.length === 4 && shape.every(p => Number.isFinite(p.cx) && p.r > 0);
  // 점들이 서로 다른 위치(민둥 한 점 아님) — 펼쳐진 윤곽.
  const spreadOut = ok && new Set(shape.map(p => `${p.cx.toFixed(2)},${p.cy.toFixed(2)}`)).size === 4;
  check('형태 복원 — shapeHash → 구성원 수(4)만큼 점 무리로 펼침(민둥 구 아님)',
    ok && spreadOut, `복원 점 ${shape ? shape.length : 'null'}개(=L 4점)·서로 다른 위치 ${spreadOut}·sub r ${shape ? shape[0].r.toFixed(2) : '-'}`);
}

// ── 2. 위치·스케일 따라감 — 개체가 이동하면 윤곽도 강체로 이동·반경 ×2 면 펼침/sub 도 ×2 ──
{
  const e0 = body(0, 0, 0, 4, hL), e1 = body(100, -30, 0, 4, hL);
  const s0 = DNA.reconstructShape(e0, dict), s1 = DNA.reconstructShape(e1, dict);
  // 같은 형태를 100,-30 평행이동 → 대응 점 차이가 일정(강체).
  const rigid = s0.every((p, i) => Math.abs((s1[i].cx - p.cx) - 100) < 1e-9 && Math.abs((s1[i].cy - p.cy) - (-30)) < 1e-9);
  const big = DNA.reconstructShape(body(0, 0, 0, 8, hL), dict);   // 반경 ×2
  const maxOff0 = Math.max(...s0.map(p => Math.hypot(p.cx, p.cy)));
  const maxOff2 = Math.max(...big.map(p => Math.hypot(p.cx, p.cy)));
  const scales = Math.abs(maxOff2 / (maxOff0 || 1) - 2) < 1e-9 && Math.abs(big[0].r / s0[0].r - 2) < 1e-9;
  check('위치·스케일 따라감 — 개체 이동→윤곽 강체 이동·반경 ×2→펼침/sub ×2',
    rigid && scales, `강체 이동 ${rigid} · 반경 ×2 → 펼침 ×${(maxOff2 / (maxOff0 || 1)).toFixed(2)}·sub ×${(big[0].r / s0[0].r).toFixed(2)}`);
}

// ── 3. DNA 없음 → null(단일 구 폴백) ──
{
  const noHash = DNA.reconstructShape(body(0, 0, 0, 4, undefined), dict);
  const unknownHash = DNA.reconstructShape(body(0, 0, 0, 4, 'deadbeef'), dict);   // 사전에 없는 hash
  const noDict = DNA.reconstructShape(body(0, 0, 0, 4, hL), null);
  check('DNA 없음 → null(단일 구 폴백) — hash 없음·미등록 hash·사전 없음',
    noHash === null && unknownHash === null && noDict === null,
    `hash 없음 ${noHash === null} · 미등록 ${unknownHash === null} · 사전 없음 ${noDict === null}`);
}

// ── 4. 순수/불변 — reconstructShape 는 개체·사전을 안 건드린다(읽기만) ──
{
  const e = body(7, 8, 9, 4, hL);
  const eSnap = JSON.stringify(e), dSnap = JSON.stringify(dict);
  DNA.reconstructShape(e, dict);
  check('순수/불변 — 개체·사전 안 건드림(렌더는 읽기만·세계↔확인용 단방향)',
    JSON.stringify(e) === eSnap && JSON.stringify(dict) === dSnap,
    `개체 불변 ${JSON.stringify(e) === eSnap} · 사전 불변 ${JSON.stringify(dict) === dSnap}`);
}

// ── 5. 결정론 — 같은 개체·사전 → 같은 복원 ──
{
  const e = body(3, 4, 0, 5, hL);
  const a = JSON.stringify(DNA.reconstructShape(e, dict)), b = JSON.stringify(DNA.reconstructShape(e, dict));
  check('결정론 — 같은 개체·사전 → 같은 복원 점 무리', a === b, `동일 ${a === b}`);
}

console.log('\n=== step_0063 수치 검증: M3 DNA 로 렌더 — 합친 개체를 shapeHash 로 원래 윤곽으로 복원 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
