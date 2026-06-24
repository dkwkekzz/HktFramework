// step_0074/verify.js — 절차적 장 고도화(노이즈) 검증. 순수·독립.
//   새 거동 = 무한 절차적 장의 형태 선택을 *백색 잡음*(hashIndex)에서 *공간 상관 노이즈*(fBm·fieldNoise)로.
//   인접 셀이 닮아(코히어런스) 봉우리·계곡이 뭉치고, 저주파 옥타브가 바이옴(큰 동질 지역)을 만든다. 장은 여전히
//   순수·경로 무관(0073 스트리밍 위에 얹힘). 결정론은 tools/htj-verify-lib.js 공용 가드. 실행: node HTJ/steps/step_0074/verify.js
'use strict';
const path = require('path');
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const D = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

// 높이 오름차순 K=4 팔레트(분지<평지<능선<봉우리) — 노이즈 높이가 이 K개에 사상되면 낮은 노이즈=분지·높은=봉우리.
function tile(kind) { const m = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const b = Math.max(0, 1 - (i * i + j * j) / 3); let z = 0; if (kind === 1) z = -b; else if (kind === 2) z = (i === 0 ? b : 0); else if (kind === 3) z = b; m.push({ cx: i, cy: j, cz: z }); } return m; }
const DICT = {}, PALETTE = [0, 1, 2, 3].map(k => D.registerShape(DICT, tile(k))), K = PALETTE.length;
const SCALE = 0.08;
const FIELD = Stream.fieldNoise(PALETTE, { scale: SCALE, octaves: 4 });   // 코히어런트 노이즈 장
const WHITE = (i, j) => PALETTE[Stream.hashIndex(i, j, K)];               // 백색 잡음(0073 기준선)

// ① 공간 상관(코히어런스) 창발 — fBm 의 인접 셀 차 ≪ 먼 셀 차(상관), 그리고 ≪ 백색 잡음 인접 차.
//   백색 잡음은 인접≈먼(무상관)이지만 노이즈는 인접이 훨씬 닮는다 = "봉우리·계곡이 뭉친다".
(() => {
  let adj = 0, far = 0, whiteAdj = 0, n = 0;
  for (let i = 0; i < 120; i++) for (let j = 0; j < 120; j++) {
    const h = Stream.fbm(i * SCALE, j * SCALE, { octaves: 4 });
    adj += Math.abs(h - Stream.fbm((i + 1) * SCALE, j * SCALE, { octaves: 4 }));
    far += Math.abs(h - Stream.fbm((i + 53) * SCALE, (j + 41) * SCALE, { octaves: 4 }));
    const wv = (a, b) => Stream.fnv1a(a + ',' + b) / 4294967296;       // 백색 잡음 격자값 [0,1)
    whiteAdj += Math.abs(wv(i, j) - wv(i + 1, j));
    n++;
  }
  adj /= n; far /= n; whiteAdj /= n;
  ok(adj < far * 0.4 && adj < whiteAdj * 0.3,
    `공간 상관 창발 — 인접 차 ${adj.toFixed(4)} ≪ 먼 차 ${far.toFixed(4)}(상관) · ≪ 백색 잡음 인접 차 ${whiteAdj.toFixed(4)}(매끄러움)`);
})();

// ② 바이옴(큰 동질 지역) — 노이즈 장은 같은 형태가 *연속*으로 이어지는 런이 길다(저주파 옥타브). 백색 잡음 런≈1.3.
(() => {
  function meanRun(field) {
    let runs = 0, total = 0, prev = null, len = 0;
    for (let i = 0; i < 4000; i++) { const h = field(i, 7); if (h === prev) len++; else { if (prev !== null) { runs++; total += len; } prev = h; len = 1; } }
    runs++; total += len; return total / runs;
  }
  const noiseRun = meanRun(FIELD), whiteRun = meanRun(WHITE);
  ok(noiseRun > whiteRun * 2.5 && noiseRun > 3,
    `바이옴 런길이 — 노이즈 평균 런 ${noiseRun.toFixed(2)}셀 ≫ 백색 잡음 ${whiteRun.toFixed(2)}셀(같은 형태가 연속=큰 동질 지역)`);
})();

// ③ 범위 유한 — fBm ∈ [0,1)·사상 idx ∈ [0,K)(어떤 huge 좌표여도 팔레트 밖 안 나감).
(() => {
  let lo = 1, hi = 0, idxBad = 0;
  const spots = [[0, 0], [99999, -88888], [-1234567, 7654321], [3, 3], [-7, 50000]];
  for (const [bi, bj] of spots) for (let di = 0; di < 30; di++) for (let dj = 0; dj < 30; dj++) {
    const h = Stream.fbm((bi + di) * SCALE, (bj + dj) * SCALE, { octaves: 4 });
    if (h < lo) lo = h; if (h > hi) hi = h; if (h < 0 || h >= 1) idxBad++;
    const hash = FIELD(bi + di, bj + dj); if (PALETTE.indexOf(hash) < 0) idxBad++;
  }
  ok(lo >= 0 && hi < 1 && idxBad === 0,
    `범위 유한 — fBm ∈ [${lo.toFixed(3)}, ${hi.toFixed(3)}] ⊂ [0,1) · idx 전부 [0,K) (팔레트 밖 ${idxBad})`);
})();

// ④ 순수·경로 무관 — 같은 (i,j)→같은 값(호출 순서·재방문 무관). 0073 스트리밍의 "장은 (i,j)의 순수 함수" 보존.
(() => {
  const probe = [[0, 0], [12, -340], [99999, 7], [-5, -5]];
  const first = probe.map(([i, j]) => Stream.fbm(i * SCALE, j * SCALE, { octaves: 4 }));
  // 다른 좌표를 잔뜩 건드린 뒤(내부 상태가 있으면 깨짐) 같은 점 재방문.
  for (let i = -200; i < 200; i++) Stream.fbm(i * SCALE, (i * 3) * SCALE, { octaves: 4 });
  let same = true;
  probe.forEach(([i, j], k) => { if (Stream.fbm(i * SCALE, j * SCALE, { octaves: 4 }) !== first[k]) same = false; });
  // fieldNoise 도 호출 순서 무관.
  const a = [[3, 4], [3, 4], [9, 9]].map(([i, j]) => FIELD(i, j));
  ok(same && a[0] === a[1], `순수·경로 무관 — 재방문 동일 ${same} · 호출 순서 무관 ${a[0] === a[1]}(장은 (i,j) 순수 함수)`);
})();

// ⑤ 결정론(공용 가드) — 같은 장 샘플 → 같은 지문.
show(L.deterministic('같은 장 → 같은 샘플', () => {
  const out = []; for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) out.push(FIELD(i * 17, j * 23));
  return out;
}));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
