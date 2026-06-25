// step_0110/verify.js — (조립) 선 캐릭터: 큰 구체 위에 *중력↓+접촉↑ 균형*으로 선다.
//   새 물리 0(applyEntityGravity 0028 + applyEntityContact 0037 은 부품 verify 가 보증). 여기선 *새 결합*만:
//   방사 중력 + 접촉 반발이 큰 구체 표면에 캐릭터를 정착시키는 균형(CLAUDE §4 게임 최소 단위). 순수·독립·영구.
//   실행: node HTJ/steps/step_0110/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const CX = 24, CY = 24, R = 12, DT = 0.05, M = 4000;
const GOPT = { G: 0.04, soft: 1 }, COPT = { k: 20, cDamp: 6 };

// 캐릭터를 행성 둘레 각도 ang·거리 R+6 에 놓고 정착시킨다. 반환: 최종 상태 + 평형 측정.
function settle(ang, steps) {
  const p = { cx: CX, cy: CY, cz: 0, mass: M, px: 0, py: 0, pz: 0, internalE: 0, KEcm: 0, energy: 0, radius: R };
  const c = { cx: CX + Math.cos(ang) * (R + 6), cy: CY + Math.sin(ang) * (R + 6), cz: 0, mass: 1, px: 0, py: 0, pz: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 };
  const es = [p, c];
  for (let s = 0; s < (steps || 400); s++) {
    En.applyEntityGravity(es, DT, GOPT);
    En.applyEntityContact(es, DT, COPT);
    En.stepEntities(es, DT);
  }
  const dx = c.cx - p.cx, dy = c.cy - p.cy, d = Math.hypot(dx, dy);
  const v = Math.hypot(c.px, c.py) / c.mass;
  const Fg = GOPT.G * M * c.mass / Math.pow(d * d + GOPT.soft * GOPT.soft, 1.5) * d;   // 방사 중력 크기
  const overlap = (R + c.radius) - d, Fc = COPT.k * Math.max(0, overlap);             // 접촉 반발 크기
  const Ptot = Math.hypot(p.px + c.px, p.py + c.py);                                  // 계 총 운동량
  return { d, v, overlap, Fg, Fc, Ptot, p, c };
}

const top = settle(Math.PI / 2);

// ① 정착 — 감쇠가 진동을 죽여 캐릭터가 *멈춘다*(최종 속도 ≈ 0).
ok(top.v < 1e-6, `정착 — 캐릭터 최종 속도 ${top.v.toExponential(2)} ≈ 0(감쇠로 멈춤·튕김 없이 선다)`);

// ② 균형(떠받침=무게) — 접촉 반발력 F_c = k·overlap 이 방사 중력 F_g 와 정확히 맞선다(선 캐릭터의 핵심).
ok(Math.abs(top.Fc / top.Fg - 1) < 1e-6 && top.Fg > 0,
  `균형 — 접촉력 F_c ${top.Fc.toFixed(4)} = 중력 F_g ${top.Fg.toFixed(4)}(ratio ${(top.Fc / top.Fg).toFixed(6)}·떠받침=무게)`);

// ③ 안 가라앉음 — overlap 유계(작은 양수)·분리거리 d > R(표면 위·터널링 0).
ok(top.overlap > 0 && top.overlap < 0.5 && top.d > R && top.d < R + 1.0,
  `안 가라앉음 — overlap ${top.overlap.toFixed(4)}∈(0,0.5)·d ${top.d.toFixed(3)}>R ${R}(표면 위·터널링 0)`);

// ④ 어디든 선다(아래=방사) — 꼭대기·옆구리·대각 어디에 놓아도 *같은 분리거리*에 정착(중력 방향=중심).
(() => {
  const ds = [Math.PI / 2, 0, Math.PI / 4, Math.PI].map(a => settle(a).d);
  const spread = Math.max(...ds) - Math.min(...ds);
  ok(spread < 1e-6, `어디든 선다 — 꼭대기/옆/대각/아래 정착 분리거리 ${ds.map(d => d.toFixed(3)).join('=')}·산포 ${spread.toExponential(2)}<1e-6(아래=방사)`);
})();

// ⑤ 운동량 보존 — 중력·접촉 둘 다 쌍힘 → 계 총 운동량 불변(시작 0 → 유지). 큰 구체는 외력 author 아님.
show(L.conserved('계 총 운동량(planet+char)', 0, top.Ptot, 1e-9));

// ⑥ 결정론.
show(L.deterministic('같은 낙하 → 같은 정착', () => { const r = settle(Math.PI / 2, 200); return [Math.round(r.c.cx * 1e6), Math.round(r.c.cy * 1e6), Math.round(r.d * 1e6)]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
