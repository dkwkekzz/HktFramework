// step_0119/verify.js — (RG1) 강체 분자 골격: 합쳐진 *분자 하나*가 DNA 구조를 충돌 껍질로 쓰고
//   접촉 반작용을 분자 하나로 합산(합력+토크)한다. 새 법칙 = applyShellContact + stepEntity θ 적분(B안).
//   새 거동 핵심: ① 캐릭터가 DNA 구조 껍질에 *막힌다*(바운딩 구 아님) ② *제어 없이* Σp·ΣL(원점) 정확
//   보존(고정/핀 0 = 진짜 자유 강체·편법 부재의 급소) ③ 분자는 free(무게=부동성·안 쪼갬) ④ off-center
//   타격이 강체 회전(θ) 유도. 보존·항등·결정론은 공용 가드. 순수·독립·영구. node HTJ/steps/step_0119/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const DNA = require(path.resolve(__dirname, '../../engine/htj-shapedna.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.05, COPT = { k: 60, cDamp: 8 };

// 분자(바위) 하나 + 그 DNA *구조*(shapeHash)에서 body-frame 충돌 껍질을 만든다(reconstructShape·0063).
//   분자는 *한 엔티티* — 껍질은 물리 개체가 아니라 분자 구조의 표면 오프셋(안 쪼갬). inertia=Σ m_i|r_i|².
function makeMolecule() {
  const dict = {};
  const members = [{ cx: 0, cy: 0, cz: 0, radius: 1 }, { cx: 1.4, cy: 0, cz: 0, radius: 1 }, { cx: 0.7, cy: 1.3, cz: 0, radius: 1 }, { cx: -0.6, cy: 0.9, cz: 0, radius: 1 }];
  const hash = DNA.registerShape(dict, members, { quantum: 0.25 });
  const body = { cx: 0, cy: 0, cz: 0, radius: 2.4, shapeHash: hash, mass: 2000, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, theta: 0, internalE: 0, energy: 0 };
  const pts = DNA.reconstructShape(body, dict, { quantum: 0.25, spread: 1.5, subScale: 1.5 });
  const m = body.mass / pts.length; let I = 0;
  const shell = pts.map(p => { const ox = p.cx - body.cx, oy = p.cy - body.cy; I += m * (ox * ox + oy * oy); return { ox, oy, r: p.r }; });
  body.inertia = I;
  return { body, shell };
}
function makeChar() {
  const me = 1, R = 1;
  return { cx: -8, cy: 0.5, cz: 0, radius: R, mass: me, px: me * 4, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, inertia: 0.4 * me * R * R, internalE: 0, energy: 0 };
}
// 충격: 캐릭터를 분자 껍질로 밀어넣고 *제어 없이* 자유 충돌시킨다(앵커 0·zero() 0·-mg 0).
function run(steps, opts) {
  opts = opts || COPT;
  const { body, shell } = makeMolecule();
  const ch = makeChar();
  const all = [body, ch];
  const cs0 = () => Math.cos(body.theta), sn0 = () => Math.sin(body.theta);
  let minGap = 1e9, minToCoM = 1e9;
  for (let s = 0; s < steps; s++) {
    En.applyShellContact([ch], body, shell, DT, opts);
    En.stepEntities(all, DT);
    const c = cs0(), n = sn0();
    for (const sh of shell) { const sx = body.cx + c * sh.ox - n * sh.oy, sy = body.cy + n * sh.ox + c * sh.oy; const g = Math.hypot(sx - ch.cx, sy - ch.cy) - (ch.radius + sh.r); if (g < minGap) minGap = g; }
    const dc = Math.hypot(ch.cx - body.cx, ch.cy - body.cy); if (dc < minToCoM) minToCoM = dc;
  }
  // 원점 기준 계 총 운동량/각운동량(궤도 + 스핀).
  const P = [all.reduce((a, e) => a + e.px, 0), all.reduce((a, e) => a + e.py, 0)];
  const Lo = all.reduce((a, e) => a + (e.cx * e.py - e.cy * e.px) + (e.Lz || 0), 0);
  return { body, ch, P, Lo, minGap, minToCoM };
}

// ── ① 새 법칙: 캐릭터가 DNA 구조 껍질에 *막힌다*(튕겨 되돌아옴·분자 중심 침투 0) ──
const r = run(400);
ok(r.minGap < 0.05, `새 법칙(막힘) — 캐릭터가 DNA 껍질에 닿음(min gap ${r.minGap.toFixed(3)} < 0.05) + 되튐 vx ${(r.ch.px / r.ch.mass).toFixed(3)} < 0`);
ok(r.ch.px < 0 && r.minToCoM > r.ch.radius, `새 법칙(블로커) — 분자 중심 침투 0(min |ch−CoM| ${r.minToCoM.toFixed(2)} > 캐릭터 반경 ${r.ch.radius})`);

// ── ② 편법 부재(핵심): 제어 없이 Σp·ΣL(원점) 정확 보존 = 고정/핀 0 = 진짜 자유 강체 ──
const P0 = makeChar().px;  // 시작 Σp_x = 캐릭터 초기 운동량(분자 정지)
show(L.conserved('Σp_x (제어 없이·앵커 없이)', P0, r.P[0], 1e-9));
show(L.conserved('Σp_y', 0, r.P[1], 1e-9));
const Lo0 = (-8) * 0 - 0.5 * (1 * 4);  // 시작 L_origin = cx·py − cy·px = −0.5·4 = −2
show(L.conserved('ΣL_origin (궤도+스핀·핀이면 깨짐)', Lo0, r.Lo, 1e-9));

// ── ③ 분자는 free(무게=부동성·안 쪼갬): 움직이긴 함(nonzero=고정 아님)·작음(무거움) ──
const disp = Math.hypot(r.body.cx, r.body.cy);
ok(disp > 1e-6 && disp < 0.5, `분자 free(고정 아님) — 충격에 움직임 ${disp.toExponential(2)}(>0=free, <0.5=무게로 거의 부동)`);

// ── ④ θ 반응(B안): off-center 타격 → 강체 회전(theta·Lz 생김) ──
ok(Math.abs(r.body.theta) > 1e-4 && Math.abs(r.body.Lz) > 1e-3, `θ 반응(강체 회전) — theta ${r.body.theta.toFixed(5)} · Lz ${r.body.Lz.toFixed(3)}`);

// ── ⑤ 항등(노브=0 → 회귀 0): k=0·c=0 → 껍질 접촉 no-op → 캐릭터 자유 직진·분자 불변 ──
const free = run(80, { k: 0, cDamp: 0 });
const pred = -8 + 4 * (80 * DT);  // 자유 직진 예측 cx
show(L.identity('k=0·c=0 → 캐릭터 자유 직진', Math.round(pred * 1e6), Math.round(free.ch.cx * 1e6)));
ok(free.body.cx === 0 && free.body.theta === 0, `항등 — 분자 불변(cx ${free.body.cx} · theta ${free.body.theta})`);

// ── ⑥ 결정론 ──
show(L.deterministic('같은 입력 → 같은 충돌', () => { const x = run(400); return [Math.round(x.ch.cx * 1e4), Math.round(x.body.theta * 1e6), Math.round(x.Lo * 1e6)]; }));

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
