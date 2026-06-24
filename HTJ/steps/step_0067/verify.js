// step_0067/verify.js — T2(A) 지형 DNA 배선 검증. 순수·독립. (조립 step: engine 변경 0 → 회귀 구조적 0.
//   새 발현 = 지형이 제너릭 DNA 경로를 타고 K≪N dedup. 보존·결정론은 tools/htj-verify-lib.js 공용 가드.)
//   merge-dna §5 T2 — 지형을 engine 지형 전용 함수가 아니라 제너릭 registerShape/reconstructShape 로.
//   실행: node HTJ/steps/step_0067/verify.js
'use strict';
const path = require('path');
const D = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// 시험 지형 — 4×4 청크, K=3 타일 종류(평지/봉우리/계곡)를 16 청크가 공유(scene 과 같은 골격·독립 재현).
function tile(kind) {
  const m = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    let z = 0;
    if (kind === 'peak' && i === 0 && j === 0) z = 1.2;
    else if (kind === 'valley' && i === 0 && j === 0) z = -1.2;
    m.push({ cx: i, cy: j, cz: z });
  }
  return m;
}
const KINDS = ['flat', 'peak', 'peak', 'flat', 'valley', 'peak', 'peak', 'valley', 'valley', 'peak', 'peak', 'valley', 'flat', 'valley', 'valley', 'flat'];
function build() {
  const dict = {}, chunks = [];
  for (let n = 0; n < KINDS.length; n++) {
    const hash = D.registerShape(dict, tile(KINDS[n]));
    chunks.push({ cx: (n % 4) * 10, cy: ((n / 4) | 0) * 10, cz: 20, radius: 4, mass: 1e9, anchored: true, shapeHash: hash, kind: KINDS[n] });
  }
  return { dict, chunks };
}

// ① DNA 배선·dedup K≪N (새 발현) — N 청크가 K 타일 종류를 공유. K = 서로 다른 kind 수(3) ≪ N(16).
(() => {
  const { dict, chunks } = build();
  const K = Object.keys(dict).length, N = chunks.length, kinds = new Set(KINDS).size;
  ok(K === kinds && K < N, `DNA 배선·dedup — 청크 N=${N} → 사전 K=${K}(타일 종류 ${kinds}) ≪ N (확장성)`);
})();

// ② 같은 타일→같은 hash·다른 타일→다른 hash (정규화) — 위치 달라도 같은 패턴은 한 코드.
(() => {
  const peakA = D.registerShape({}, tile('peak')), peakB = D.registerShape({}, tile('peak'));
  const valley = D.registerShape({}, tile('valley')), flat = D.registerShape({}, tile('flat'));
  ok(peakA === peakB && peakA !== valley && peakA !== flat && valley !== flat, `정규화 — 같은 타일=같은 hash(peak ${peakA.slice(0, 6)}=${peakB.slice(0, 6)}) · 다른 타일=다른 hash(peak≠valley≠flat)`);
})();

// ③ shapeHash 순수 메타(공용 가드) — registerShape 는 입력 배치를 *읽기만* 한다(변형 0). hash 는 물리 안 건드림.
(() => {
  const before = tile('peak'), members = tile('peak');
  D.registerShape({}, members);                                       // 등록(부수효과 없어야)
  show(L.identity('shapeHash=순수 메타(registerShape 입력 불변)', before, members));
})();

// ④ 형태 복원(민둥 구 아님) — reconstructShape 로 청크가 9점 타일 패턴으로 펼쳐진다(점 무리). hash 없으면 null 폴백.
(() => {
  const { dict, chunks } = build();
  const shape = D.reconstructShape(chunks[1], dict, { quantum: 0.25, spread: 1.4, subScale: 0.7 });
  const blobFallback = D.reconstructShape({ cx: 0, cy: 0, cz: 0, radius: 4 }, dict);  // shapeHash 없음
  ok(shape && shape.length === 9 && blobFallback === null, `형태 복원 — 청크→${shape ? shape.length : 0}점 타일(민둥 구 아님) · DNA 없음→null 폴백 ${blobFallback === null}`);
})();

// ⑤ 결정론(공용 가드) — 같은 지형 → 같은 hash 들·같은 사전.
show(L.deterministic('같은 지형 → 같은 hash·사전', () => { const { dict, chunks } = build(); return { d: Object.keys(dict).sort(), h: chunks.map(c => c.shapeHash) }; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
