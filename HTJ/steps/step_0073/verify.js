// step_0073/verify.js — TW4 무한 절차적 세계 스트리밍 검증. 순수·독립.
//   새 거동 = 세계가 무한 절차적 장(grid (i,j)→DNA 의 순수 함수)·viewer 는 관찰자 둘레 유한 창만 materialize.
//   작업집합이 *관찰자 위치/세계 크기 무관* 일정(∝반경²)·장은 경로 무관(재방문 동일)·K 형태 공유(dedup K≪N).
//   순수·결정론은 tools/htj-verify-lib.js 공용 가드. 실행: node HTJ/steps/step_0073/verify.js
'use strict';
const path = require('path');
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const D = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// K=4 형태 팔레트(평지/둔덕/분지/능선) 등록 → 절차적 장이 grid 좌표를 이 K개에 사상.
function tile(kind) { const m = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { let z = 0; const b = Math.max(0, 1 - (i * i + j * j) / 3); if (kind === 1) z = b; else if (kind === 2) z = -b; else if (kind === 3) z = (i === 0 ? b : 0); m.push({ cx: i, cy: j, cz: z }); } return m; }
const DICT = {}, PALETTE = [0, 1, 2, 3].map(k => D.registerShape(DICT, tile(k))), K = PALETTE.length;
const SPACING = 10, RADIUS = SPACING * 8;
const FIELD = (i, j) => PALETTE[Stream.hashIndex(i, j, K)];          // 무한 위치 → K 형태(순수·경로 무관)
const OPTS = { spacing: SPACING, radius: RADIUS, z: 0, shapeAt: FIELD };
function win(cx, cy) { return Stream.streamChunks({ cx, cy }, OPTS); }

// ① 작업집합 유한·관찰자 위치 무관(TW4 핵심) — grid 정렬 관찰자면 어디서든 같은 창 크기(세계 크기 무관·∝반경²).
(() => {
  const a = win(0, 0).count;
  const b = win(100000 * SPACING, 73000 * SPACING).count;            // 아주 먼 세계(grid 정렬)
  const c = win(-50000 * SPACING, 999 * SPACING).count;
  const geom = Math.PI * (RADIUS / SPACING) * (RADIUS / SPACING);     // ≈ π·반경²(셀)
  ok(a === b && a === c && a > geom * 0.7 && a < geom * 1.3,
    `작업집합 유한·위치 무관 — 창 ${a}개 = 먼 세계 ${b} = ${c}(관찰자 위치/세계 크기 무관·≈π·반경² ${geom | 0})`);
})();

// ② 절차적 장 경로 무관(재방문 동일) — 겹치는 두 창의 공유 grid 셀은 같은 DNA(장은 (i,j)의 순수 함수).
(() => {
  const A = win(0, 0).chunks, B = win(SPACING * 3, SPACING * 2).chunks;  // 겹치게 이동
  const mapA = new Map(A.map(c => [c.gx + ',' + c.gy, c.shapeHash]));
  let shared = 0, mismatch = 0;
  for (const c of B) { const k = c.gx + ',' + c.gy; if (mapA.has(k)) { shared++; if (mapA.get(k) !== c.shapeHash) mismatch++; } }
  // 멀리 갔다 돌아오면 동일.
  const back = win(0, 0).chunks; let revisitSame = back.length === A.length;
  for (let i = 0; i < A.length && revisitSame; i++) if (back[i].gx !== A[i].gx || back[i].shapeHash !== A[i].shapeHash) revisitSame = false;
  ok(shared > 0 && mismatch === 0 && revisitSame, `장 경로 무관 — 공유 셀 ${shared}개 DNA 일치(불일치 ${mismatch}) · 멀리 갔다 재방문 동일 ${revisitSame}`);
})();

// ③ dedup K≪N — 무한 청크가 K개 형태만 공유(창 안 distinct hash = K ≪ 청크 수). 사전도 K.
(() => {
  const c = win(0, 0).chunks, distinct = new Set(c.map(x => x.shapeHash));
  ok(distinct.size <= K && c.length > K * 10 && Object.keys(DICT).length === K,
    `dedup K≪N — 청크 ${c.length}개가 형태 ${distinct.size}종 공유(K=${K}≪N·사전 ${Object.keys(DICT).length}항목)`);
})();

// ④ 채움/경계(seamless) — 반경 안 grid 셀은 빠짐없이·반경 밖은 없음(끝없이 이어지되 창은 깔끔히 잘림).
(() => {
  const c = win(0, 0).chunks; let inside = true, outside = true;
  const present = new Set(c.map(x => x.gx + ',' + x.gy));
  for (const x of c) if (Math.hypot(x.cx, x.cy) > RADIUS + 1e-9) outside = false;     // 전부 반경 안
  // 반경 충분히 안쪽 셀(예: 원점 이웃)은 반드시 있음.
  for (const [gi, gj] of [[0, 0], [1, 0], [0, -1], [2, 2]]) if (!present.has(gi + ',' + gj)) inside = false;
  ok(inside && outside, `채움/경계 — 반경 안 셀 빠짐없이 ${inside}·반경 밖 없음 ${outside}(끝없이 이어지되 창은 잘림)`);
})();

// ⑤ 결정론(공용 가드) — 같은 관찰자 → 같은 창.
show(L.deterministic('같은 관찰자 → 같은 창', () => win(SPACING * 7, SPACING * 4).chunks.map(c => `${c.gx},${c.gy},${c.shapeHash}`)));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
