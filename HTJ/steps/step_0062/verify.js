// step_0062/verify.js — M2 형태 hash 사전(DNA): 합친 덩어리의 형태를 정규화된 hash 로 압축·세계 사전 dedup. 순수·독립·영구.
//
//   design/merge-dna.md §3·§4 M2 — M1(0061)이 *확실한 병합*을 세웠으나 합친 개체는 모양 잃은 민둥 구다. 개체마다
//   구성원 세부를 다 들면 압축 0(확장성 없음). 이 step 의 `htj-shapedna.js` 는 구성원 배치를 *정규화*(평행이동·
//   스케일 불변 양자화)해 **shapeHash(DNA)**로 압축하고, 세계 형태 사전(shapeDict)에 dedup 한다 → 개체는 hash 만·
//   사전은 K(형태종류)개로 공유(K≪N). 적정 검증(4 축): ① 정규화(평행이동·스케일·미세 흔듦→같은 hash) ② 구별(다른
//   배치→다른 hash) ③ dedup(여러 클러스터→사전 K≪N) ④ 보존/안전(hash 는 물리 안 건드림·메타데이터) ⑤ 결정론.
//   M1 과의 통합(coalesceSettled 의 tagMerge 훅)도 한 검사로 본다. 실행: node HTJ/steps/step_0062/verify.js
'use strict';
const path = require('path');
const DNA = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// 형태 = 구성원 점들(질량 동일·위치만 형태를 만듦).
function pts(arr) { return arr.map(([x, y, z]) => ({ cx: x, cy: y, cz: z, mass: 1 })); }
// 기준 형태 둘(L 자 4점 vs 일직선 4점) — 명백히 다른 모양.
const L = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0]];
const LINE = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]];
const xform = (arr, ox, oy, oz, s) => arr.map(([x, y, z]) => [x * s + ox, y * s + oy, z * s + oz]);

// ── 1. 정규화 — 평행이동·스케일·미세 흔듦이 달라도 같은 모양이면 같은 hash ──
{
  const base = DNA.shapeDNA(pts(L)).hash;
  const moved = DNA.shapeDNA(pts(xform(L, 100, -50, 30, 1))).hash;            // 평행이동
  const scaled = DNA.shapeDNA(pts(xform(L, 0, 0, 0, 7.3))).hash;             // 균일 스케일 ×7.3
  const jitter = DNA.shapeDNA(pts(L.map(([x, y, z]) => [x + 0.02, y - 0.03, z + 0.01]))).hash;  // 양자 이하 흔듦
  const same = base === moved && base === scaled && base === jitter;
  check('정규화 — 평행이동·스케일·미세 흔듦 달라도 같은 모양 → 같은 hash',
    same, `base ${base} · 이동 ${moved} · 스케일 ${scaled} · 흔듦 ${jitter}`);
}

// ── 2. 구별 — 다른 모양(L vs 직선)·다른 개수 → 다른 hash ──
{
  const hL = DNA.shapeDNA(pts(L)).hash, hLine = DNA.shapeDNA(pts(LINE)).hash;
  const h3 = DNA.shapeDNA(pts(LINE.slice(0, 3))).hash;                        // 개수도 형태의 일부
  const distinct = hL !== hLine && hL !== h3 && hLine !== h3;
  check('구별 — 다른 배치·다른 개수 → 다른 hash',
    distinct, `L ${hL} ≠ 직선 ${hLine} ≠ 3점 ${h3}`);
}

// ── 3. dedup — 여러 클러스터를 등록해도 *형태종류 수*(K)만 사전에 남는다(K ≪ N) ──
{
  const dict = {};
  let registered = 0;
  for (let i = 0; i < 8; i++) { DNA.registerShape(dict, pts(xform(L, i * 10, 0, 0, 1 + i * 0.3))); registered++; }      // L 8개(이동·스케일 다름)
  for (let i = 0; i < 5; i++) { DNA.registerShape(dict, pts(xform(LINE, 0, i * 10, 0, 1 + i * 0.5))); registered++; }   // 직선 5개
  const K = Object.keys(dict).length;
  check('dedup — N개 클러스터 등록 → 사전 K(형태종류)개만(K ≪ N)',
    K === 2 && registered === 13,
    `등록 N=${registered}개 → 사전 K=${K}개(형태종류=L·직선 2종) = K≪N`);
}

// ── 4. 보존/안전 — hash 는 물리 안 건드림(순수 메타데이터) · M1 통합(tagMerge 훅) ──
{
  // (a) 순수: shapeDNA·registerShape 는 입력 members 를 변형하지 않는다.
  const members = pts(L);
  const snap = JSON.stringify(members);
  const dict = {}; DNA.registerShape(dict, members);
  const pure = JSON.stringify(members) === snap;
  // (b) M1 통합: coalesceSettled 의 tagMerge 훅으로 합친 개체에 shapeHash 부착·물리량 정확 보존(0061 그대로).
  function ent(cx, cy, cz) { return { cx, cy, cz, mass: 100, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalKE: 0, internalE: 5, energy: 5, cells: 100, radius: 1.2, temp: 0, peak: 1 }; }
  let es = [ent(0, 0, 0), ent(2, 0, 0), ent(4, 0, 0), ent(4, 2, 0)];        // L 배치·닿음·정지
  const m0 = es.reduce((s, e) => s + e.mass, 0), e0 = es.reduce((s, e) => s + e.energy, 0);
  const wdict = {};
  const opt = { dwell: 3, vSettle: 0.1, vstick: 0.5, pad: 0.5, tagMerge: (mem) => DNA.registerShape(wdict, mem) };
  for (let s = 0; s < 5; s++) es = En.coalesceSettled(es, 1, opt).entities;
  const tagged = es.length === 1 && typeof es[0].shapeHash === 'string' && Object.keys(wdict).length === 1;
  const conserved = Math.abs(es.reduce((s, e) => s + e.mass, 0) - m0) < 1e-9 && Math.abs(es.reduce((s, e) => s + e.energy, 0) - e0) < 1e-9;
  check('보존/안전 — hash 는 물리 안 건드림(순수) · M1 통합(합친 개체 shapeHash 부착·물리량 보존)',
    pure && tagged && conserved,
    `순수(입력 불변) ${pure} · 합친 개체 shapeHash=${es[0] && es[0].shapeHash}·사전 ${Object.keys(wdict).length}개 · 질량/총E 보존 ${conserved}`);
}

// ── 5. 결정론 — 같은 배치 → 같은 hash·같은 사전 ──
{
  const a = DNA.shapeDNA(pts(L)).hash, b = DNA.shapeDNA(pts(L)).hash;
  const d1 = {}; DNA.registerShape(d1, pts(L)); DNA.registerShape(d1, pts(LINE));
  const d2 = {}; DNA.registerShape(d2, pts(L)); DNA.registerShape(d2, pts(LINE));
  const det = a === b && Object.keys(d1).sort().join() === Object.keys(d2).sort().join();
  check('결정론 — 같은 배치 → 같은 hash·같은 사전', det, `hash ${a}=${b} · 사전 키 동일 ${Object.keys(d1).sort().join() === Object.keys(d2).sort().join()}`);
}

console.log('\n=== step_0062 수치 검증: M2 형태 hash 사전(DNA) — 합친 덩어리 형태를 정규화 hash 로 압축·dedup ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
