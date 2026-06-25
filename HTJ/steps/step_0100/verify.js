// step_0100/verify.js — 호수 채움(lakeFill): 흐름이 빠져나가지 못하는 분지(pit)는 물이 유출구 높이까지 차올라 *호수*가 된다.
//   lakeFill 이 priority-flood 로 각 셀의 수면 높이(filled)를 구한다 → depth=filled−지형>0 = 호수(평평 수면)·경사=0.
//   호수 *타입*을 박지 않는다(일반 높이장에 채움 알고리즘 돌린 측정·타입 0). 순수·독립·영구. 실행: node HTJ/steps/step_0100/verify.js
'use strict';
const path = require('path');
const S = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const SCALE = 0.06, X0 = 200, Y0 = -150, W = 80, H = 80;
const elevFn = (i, j) => S.fbm(i * SCALE, j * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
const run = () => S.lakeFill({ elevFn, x0: X0, y0: Y0, W, H });
const F = run();

// ① 새 법칙(핵심) — 분지가 호수로 찬다: 호수 셀이 존재하고(>0) 최대 수심이 유의미(pit 가 채워짐).
ok(F.lakeCells > 5 && F.maxDepth > 0.05,
  `분지→호수 — 호수 셀 ${F.lakeCells}개·최대 수심 ${F.maxDepth.toFixed(3)}·총 수량(Σdepth) ${F.volume.toFixed(2)}`);

// ② 새 법칙(평평한 수면) — 한 호수(연결된 호수 셀)의 수면(filled)은 평평(유출구 높이로 일정). 연결성분별 filled 분산≈0.
(() => {
  const isLake = (k) => F.depth[k] > 1e-9;
  const seen = new Uint8Array(W * H); let worst = 0, lakes = 0;
  for (let s = 0; s < W * H; s++) {
    if (!isLake(s) || seen[s]) continue;
    lakes++; const stack = [s]; seen[s] = 1; const levels = [];
    while (stack.length) {
      const k = stack.pop(), c = k % W, r = (k - c) / W; levels.push(F.filled[k]);
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nc = c + dc, nr = r + dr; if (nc < 0 || nc >= W || nr < 0 || nr >= H) continue;
        const nk = nr * W + nc; if (isLake(nk) && !seen[nk]) { seen[nk] = 1; stack.push(nk); }
      }
    }
    const mn = Math.min(...levels), mx = Math.max(...levels); if (mx - mn > worst) worst = mx - mn;
  }
  ok(lakes >= 1 && worst < 1e-6, `평평한 수면 — 호수 ${lakes}개·한 호수 내 수면 최대 편차 ${worst.toExponential(2)} < 1e-6(유출구 높이로 평평)`);
})();

// ③ 단조 — 물은 더하기만: filled ≥ terrain 어디서나(수심 음수 없음).
let minDepth = Infinity; for (let k = 0; k < W * H; k++) minDepth = Math.min(minDepth, F.depth[k]);
ok(minDepth >= -1e-12, `단조 — min(수심) ${minDepth.toExponential(2)} ≥ 0(물은 채우기만·지형 아래로 안 팜)`);

// ④ 순수 경사 = 호수 0(거짓 호수 없음) — 단조 램프 지형엔 분지가 없어 채울 게 없다.
(() => {
  const ramp = (i, j) => i * 0.01;                     // x 따라 단조 증가(분지 없음)
  const G = S.lakeFill({ elevFn: ramp, x0: 0, y0: 0, W: 40, H: 40 });
  show(L.identity('순수 경사 → 호수 수량 0', 0, Math.round(G.volume * 1e6) / 1e6));
})();

// ⑤ 결정론 — 같은 지형 → 같은 채움.
show(L.deterministic('같은 법칙 → 같은 호수장', () => Array.from(run().depth).map(d => d.toFixed(5))));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
