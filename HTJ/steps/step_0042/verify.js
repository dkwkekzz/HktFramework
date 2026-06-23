// step_0042/verify.js — SW5 셋째 벽돌: SPH 내부에너지(열) 닫힘. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — 0041 압력 힘이 한 일을 내부에너지로 되돌려 **총E 정확 보존**한다.
//   du_i/dt = ½ Σ_j m_j(P_i/ρ_i²+P_j/ρ_j²)(v_i−v_j)·∇_iW_ij — 0041 대칭 운동량식과 정확히 짝지어 닫힘.
//   0009(수동 온도)·0010(KE↔내부E 가역 닫힘)의 SPH 판. EOS 는 barotropic 그대로(궤적 불변·u 는 힘에 안 먹임).
//
//   검증 대상:
//     1. 총E 정확 보존(순간 전력 균형) — 압력이 KE 에 한 일(Σ v_i·Δp_i) + 내부E 증가(ΣΔu) = 0(기계 정밀도).
//     2. 압축 → 데움 · 팽창 → 식힘 — 접근하는 쌍은 Δu>0, 멀어지는 쌍은 Δu<0(부호).
//     3. 정지·균일 평행이동 → 가열 0 — v_ij=0 → du=0(상대 운동만이 일을 한다).
//     4. 이산 총E 2차 수렴 — dt 절반 → 총E 보존 오차 ≈ 1/4(임펄스 KE = O(dt²)).
//     5. 항등/안전 — k=0 → early-return(회귀 0)·단일/빈/지지 밖 무변화·p(운동량) 절대 불변.
//     6. 결정론.
//
//   실행: node HTJ/steps/step_0042/verify.js
'use strict';
const path = require('path');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);

function ent(cx, cy, cz, mass, px, py, pz) {
  px = px || 0; py = py || 0; pz = pz || 0;
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  return { cx, cy, cz, mass, px, py, pz, KEcm, internalE: 1, energy: KEcm + 1 };
}
const clone = (ps) => ps.map(p => ({ ...p }));
const sumU = (ps) => ps.reduce((s, p) => s + p.internalE, 0);
const sumKE = (ps) => ps.reduce((s, p) => s + (p.mass > 0 ? 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / p.mass : 0), 0);

// ── 1. 총E 정확 보존(순간 전력 균형) — Σ v_i·Δp_i(압력 일) + ΣΔu(내부E) = 0 기계 정밀도 ──
{
  // 같은 사전 속도로 평가하려면: 열은 p 를 안 건드리고·압력은 internalE 를 안 건드린다 →
  // 한 상태에서 둘을 각각 적용해 (압력이 준 운동량 변화)와 (열이 준 내부E 변화)를 짝지어 본다.
  const h = 2, dt = 0.15, opt = { stiffness: 1.5, gamma: 2, h };
  const base = [];
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 20; i++) base.push(ent((rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6, 0.5 + rnd(), (rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2));
  // (a) 사전 속도 v_i = p_i/m_i 저장.
  const vx = base.map(p => p.px / p.mass), vy = base.map(p => p.py / p.mass), vz = base.map(p => p.pz / p.mass);
  // (b) 열 적용(internalE 만 변함·p 불변) → ΔU.
  const th = clone(base); const U0 = sumU(th);
  SPH.sphThermalEnergy(th, dt, opt);
  const dU = sumU(th) - U0;
  // (c) 압력 적용(p 만 변함) → 압력이 KE 에 한 일 = Σ v_i·Δp_i(사전 속도로).
  const pr = clone(base);
  SPH.sphPressureForce(pr, dt, opt);
  let work = 0;
  for (let i = 0; i < base.length; i++) work += vx[i] * (pr[i].px - base[i].px) + vy[i] * (pr[i].py - base[i].py) + vz[i] * (pr[i].pz - base[i].pz);
  check('총E 정확 보존 — 압력이 KE 에 한 일 + 내부E 증가 = 0(순간 전력 균형·기계 정밀도)',
    relOk(work + dU, 0, 1e-9),
    `Σv·Δp(압력 일)=${work.toExponential(3)} · ΔU(내부E)=${dU.toExponential(3)} · 합=${(work + dU).toExponential(2)}(≈0)`);
}

// ── 2. 압축 → 데움 · 팽창 → 식힘 ──
{
  const h = 2, dt = 0.2, opt = { stiffness: 2, gamma: 2, h };
  // 접근(압축): i 는 +x 로·j 는 −x 로 움직여 서로 다가옴.
  const comp = [ent(-0.6, 0, 0, 1, +0.5, 0, 0), ent(0.6, 0, 0, 1, -0.5, 0, 0)];
  const Uc0 = sumU(comp); SPH.sphThermalEnergy(comp, dt, opt); const dUc = sumU(comp) - Uc0;
  // 멀어짐(팽창): i 는 −x 로·j 는 +x 로 움직여 서로 멀어짐.
  const exp = [ent(-0.6, 0, 0, 1, -0.5, 0, 0), ent(0.6, 0, 0, 1, +0.5, 0, 0)];
  const Ue0 = sumU(exp); SPH.sphThermalEnergy(exp, dt, opt); const dUe = sumU(exp) - Ue0;
  check('압축 → 데움 · 팽창 → 식힘 — 접근 쌍 ΔU>0 · 멀어지는 쌍 ΔU<0',
    dUc > 1e-9 && dUe < -1e-9 && relOk(dUc, -dUe, 1e-12),
    `압축 ΔU=${dUc.toExponential(3)}(>0) · 팽창 ΔU=${dUe.toExponential(3)}(<0) · 대칭 |같음|`);
}

// ── 3. 정지·균일 평행이동 → 가열 0 (v_ij=0) ──
{
  const h = 2, dt = 0.2, opt = { stiffness: 2, gamma: 2, h };
  // 정지 구름.
  const rest = []; for (let i = 0; i < 8; i++) rest.push(ent(Math.cos(i) * 1.2, Math.sin(i) * 1.2, (i % 3) - 1, 1));
  const Ur0 = sumU(rest); SPH.sphThermalEnergy(rest, dt, opt); const dUr = sumU(rest) - Ur0;
  // 모두 같은 속도(강체 평행이동) — 상대속도 0 → 일 0.
  const drift = []; for (let i = 0; i < 8; i++) drift.push(ent(Math.cos(i) * 1.2, Math.sin(i) * 1.2, (i % 3) - 1, 1, 3, -2, 1));
  const Ud0 = sumU(drift); SPH.sphThermalEnergy(drift, dt, opt); const dUd = sumU(drift) - Ud0;
  check('정지·균일 평행이동 → 가열 0 — v_ij=0 → du=0(상대 운동만 일한다)',
    relOk(dUr, 0, 1e-12) && relOk(dUd, 0, 1e-12),
    `정지 ΔU=${dUr.toExponential(2)}(≈0) · 평행이동 ΔU=${dUd.toExponential(2)}(≈0)`);
}

// ── 4. 이산 총E 2차 수렴 — dt 절반 → 보존 오차 ≈ 1/4 (임펄스 KE = O(dt²)) ──
{
  const h = 2, opt = { stiffness: 1.5, gamma: 2, h };
  function err(dt) {
    const ps = [];
    let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 16; i++) ps.push(ent((rnd() - 0.5) * 5, (rnd() - 0.5) * 5, (rnd() - 0.5) * 5, 0.6 + rnd(), (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 1.5));
    const E0 = sumKE(ps) + sumU(ps);
    SPH.sphThermalEnergy(ps, dt, opt);   // 열(internalE) — 사전 속도
    SPH.sphPressureForce(ps, dt, opt);   // 압력(p) — p 는 열이 안 건드려 같은 사전 속도
    const E1 = sumKE(ps) + sumU(ps);
    return Math.abs(E1 - E0);            // 잔차 = Σ|Δp|²/2m = O(dt²)
  }
  const e1 = err(0.2), e2 = err(0.1);    // dt 절반 → 오차 약 1/4
  const ratio = e1 / e2;
  check('이산 총E 2차 수렴 — dt 절반 → 보존 오차 ≈ 1/4(임펄스 KE=O(dt²))',
    e1 > 0 && e2 > 0 && ratio > 3.5 && ratio < 4.5,
    `오차(dt=0.2)=${e1.toExponential(3)} · 오차(dt=0.1)=${e2.toExponential(3)} · 비=${ratio.toFixed(2)}(≈4)`);
}

// ── 5. 항등/안전 — k=0 early-return·단일/빈/지지 밖·p 절대 불변 ──
{
  const h = 2;
  const base = [ent(-0.6, 0, 0, 1, 1, 0, 0), ent(0.6, 0, 0, 1, -1, 0, 0)];
  const k0 = clone(base); SPH.sphThermalEnergy(k0, 0.2, { stiffness: 0, h });   // k=0 → 무변화
  const k0same = relOk(k0[0].internalE, base[0].internalE, 1e-12) && relOk(k0[1].internalE, base[1].internalE, 1e-12);
  // 운동량 p 는 이 함수가 절대 안 건드린다(궤적 불변).
  const moved = clone(base); SPH.sphThermalEnergy(moved, 0.2, { stiffness: 2, h });
  const pkept = relOk(moved[0].px, base[0].px, 1e-15) && relOk(moved[1].px, base[1].px, 1e-15);
  const single = [ent(0, 0, 0, 1, 1, 0, 0)]; SPH.sphThermalEnergy(single, 0.2, { stiffness: 2, h });
  const empty = SPH.sphThermalEnergy([], 0.2, { stiffness: 2, h });
  const far = [ent(-50, 0, 0, 1, 1, 0, 0), ent(50, 0, 0, 1, -1, 0, 0)]; const Uf0 = sumU(far);
  SPH.sphThermalEnergy(far, 0.2, { stiffness: 2, h });
  const farSame = relOk(sumU(far) - Uf0, 0, 1e-12);
  check('항등/안전 — k=0 early-return·단일/빈/지지 밖 무변화·p 절대 불변',
    k0same && pkept && relOk(single[0].internalE, 1, 1e-12) && empty.length === 0 && farSame,
    `k=0 ΔU 0 · p 불변 · 단일 ΔU 0 · 빈 [] · 멀리(지지 밖) ΔU 0`);
}

// ── 6. 결정론 — 같은 입력 → 같은 내부E 지문 ──
{
  function fnv(parts) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of parts) { push(p.internalE); push(p.energy); push(p.density || 0); }
    return h >>> 0;
  }
  function scene() { const p = []; for (let i = 0; i < 12; i++) p.push(ent(Math.cos(i) * 1.5, Math.sin(i) * 1.5, (i % 3) - 1, 1 + 0.1 * i, Math.sin(i), Math.cos(i * 2), (i % 2) - 0.5)); return p; }
  const a = fnv(SPH.sphThermalEnergy(scene(), 0.2, { stiffness: 1.5, gamma: 2, h: 1.8 }));
  const b = fnv(SPH.sphThermalEnergy(scene(), 0.2, { stiffness: 1.5, gamma: 2, h: 1.8 }));
  check('결정론 — 같은 입력 → 같은 내부E 지문', a === b, `0x${a.toString(16)}`);
}

// ── 결과 출력 ──
let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 SPH 에너지 닫힘: 압력 일↔내부E 총E 정확 보존·압축 데움/팽창 식힘·궤적 불변' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);
