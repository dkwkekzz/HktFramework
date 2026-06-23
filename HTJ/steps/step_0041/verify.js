// step_0041/verify.js — SW5 둘째 벽돌: SPH 압력 힘. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — 밀도(0040) 위에 상태식 P=k·ρ^γ 와 Monaghan 대칭 쌍힘
//   a_i = −Σ_j m_j(P_i/ρ_i²+P_j/ρ_j²)∇_i W_ij 로 구체 떼를 밀어낸다(가스처럼 퍼짐). ∇_j W=−∇_i W →
//   순 운동량 정확 보존(0008 격자 반발·0010 열압력의 SPH 판). 압력 일↔내부E 닫힘은 후속 열 벽돌.
//
//   검증 대상:
//     1. 운동량 정확 보존 — 압력 힘 적용 전후 ΣP 불변(대칭 쌍힘·뉴턴3·기계 정밀도).
//     2. 압축 → 반발 — 가까운 두 입자(높은 ρ)가 서로 밀려남(상대 속도 바깥쪽·거리 벌어짐).
//     3. 균일 → 힘 ≈ 0 — 등간격 격자 내부 입자엔 순 압력 힘 거의 0(압력 기울기 0).
//     4. 커널 기울기 반대칭 — ∇_i W(r_i−r_j) = −∇_j W(r_j−r_i)·r→0 에서 0(특이점 없음).
//     5. 항등/안전 — k=0 → early-return(회귀 0)·단일/빈/멀어 안 겹침 무변화.
//     6. 결정론.
//
//   실행: node HTJ/steps/step_0041/verify.js
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
function sumP(ps) { let x = 0, y = 0, z = 0; for (const p of ps) { x += p.px; y += p.py; z += p.pz; } return [x, y, z]; }

// ── 1. 운동량 정확 보존 — 압력 힘 적용 전후 ΣP 불변 ──
{
  const h = 2, parts = [];
  // 불규칙 밀집 구름(밀도·압력 차 큼).
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 20; i++) parts.push(ent((rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6, 0.5 + rnd(), (rnd() - 0.5) * 2, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2));
  const P0 = sumP(parts);
  SPH.sphPressureForce(parts, 0.3, { stiffness: 1.5, gamma: 2, h });
  const P1 = sumP(parts);
  check('운동량 정확 보존 — 압력 힘 적용 전후 ΣP 불변(대칭 쌍힘·뉴턴3)',
    relOk(P0[0], P1[0], 1e-9) && relOk(P0[1], P1[1], 1e-9) && relOk(P0[2], P1[2], 1e-9),
    `ΣP (${P0[0].toFixed(3)},${P0[1].toFixed(3)},${P0[2].toFixed(3)}) → (${P1[0].toFixed(3)},${P1[1].toFixed(3)},${P1[2].toFixed(3)})`);
}

// ── 2. 압축 → 반발 — 가까운 두 입자가 서로 밀려남(거리 벌어짐) ──
{
  const h = 2, dt = 0.2;
  // x축으로 가까운 두 입자(정지). 압력이 밀어내면 i 는 −x·j 는 +x 로 운동량 얻음.
  const parts = [ent(-0.6, 0, 0, 1, 0, 0, 0), ent(0.6, 0, 0, 1, 0, 0, 0)];
  SPH.sphPressureForce(parts, dt, { stiffness: 2, gamma: 2, h });
  const a = parts[0], b = parts[1];
  // a(왼쪽)는 −x 운동량·b(오른쪽)는 +x 운동량 → 서로 멀어짐. ΣP_x=0 유지.
  check('압축 → 반발 — 가까운 두 입자가 서로 밀려남(바깥쪽 운동량)·ΣP 보존',
    a.px < -1e-9 && b.px > 1e-9 && relOk(a.px + b.px, 0, 1e-12),
    `왼쪽 p_x=${a.px.toFixed(4)}(<0) · 오른쪽 p_x=${b.px.toFixed(4)}(>0) · ΣP_x=${(a.px + b.px).toExponential(1)}`);
}

// ── 3. 균일 → 힘 ≈ 0 — 등간격 격자 내부 입자엔 순 압력 힘 거의 0 ──
{
  const h = 2, d = 1, m = 1;
  const parts = [];
  for (let z = -3; z <= 3; z++) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) parts.push(ent(x * d, y * d, z * d, m, 0, 0, 0));
  SPH.sphPressureForce(parts, 0.1, { stiffness: 1, gamma: 2, h });
  // 중심 입자(0,0,0) 운동량 변화 ≈ 0(대칭 이웃 → 압력 기울기 상쇄).
  const c = parts.find(p => Math.abs(p.cx) < 1e-9 && Math.abs(p.cy) < 1e-9 && Math.abs(p.cz) < 1e-9);
  const pmag = Math.sqrt(c.px * c.px + c.py * c.py + c.pz * c.pz);
  // 가장자리 입자(압력 기울기 큼)와 비교 — 중심이 훨씬 작아야.
  const edge = parts.find(p => Math.abs(p.cx - 3) < 1e-9 && Math.abs(p.cy) < 1e-9 && Math.abs(p.cz) < 1e-9);
  const emag = Math.sqrt(edge.px * edge.px + edge.py * edge.py + edge.pz * edge.pz);
  check('균일 → 힘 ≈ 0 — 등간격 격자 내부 입자 순 압력 힘 ≈ 0(가장자리보다 훨씬 작음)',
    pmag < 1e-9 && emag > 1e-3 && emag > 1e6 * pmag,   // 중심=기계영·가장자리=실제 힘(절대 하한)·자릿수 차이
    `중심 |Δp|=${pmag.toExponential(2)}(≈0) · 가장자리 |Δp|=${emag.toFixed(3)}(>중심·압력 기울기)`);
}

// ── 4. 커널 기울기 반대칭 — ∇_i W(r_i−r_j) = −∇_j W(r_j−r_i)·r→0 에서 0 ──
{
  const h = 1.7;
  const g1 = SPH.kernelGradW(0.8, -0.5, 0.3, h);
  const g2 = SPH.kernelGradW(-0.8, 0.5, -0.3, h);   // (r_j−r_i) = −(r_i−r_j)
  const anti = relOk(g1[0], -g2[0], 1e-12) && relOk(g1[1], -g2[1], 1e-12) && relOk(g1[2], -g2[2], 1e-12);
  const zero = SPH.kernelGradW(0, 0, 0, h);
  const outside = SPH.kernelGradW(2 * h + 1, 0, 0, h);
  check('커널 기울기 반대칭 — ∇_iW = −∇_jW·r=0 에서 0·지지 밖 0',
    anti && zero[0] === 0 && zero[1] === 0 && zero[2] === 0 && outside[0] === 0,
    `∇_iW=(${g1[0].toFixed(4)},${g1[1].toFixed(4)},${g1[2].toFixed(4)}) = −∇_jW · ∇W(0)=[0,0,0] · ∇W(2h+)=[0,..]`);
}

// ── 5. 항등/안전 — k=0 → early-return·단일/빈/안 겹침 무변화 ──
{
  const h = 2;
  const base = [ent(-0.6, 0, 0, 1), ent(0.6, 0, 0, 1)];
  const k0 = base.map(p => ({ ...p }));
  SPH.sphPressureForce(k0, 0.2, { stiffness: 0, h });           // k=0 → 변화 없음
  const k0same = relOk(k0[0].px, 0, 1e-12) && relOk(k0[1].px, 0, 1e-12);
  const single = [ent(0, 0, 0, 1)]; SPH.sphPressureForce(single, 0.2, { stiffness: 2, h });
  const empty = SPH.sphPressureForce([], 0.2, { stiffness: 2, h });
  const far = [ent(-50, 0, 0, 1), ent(50, 0, 0, 1)]; SPH.sphPressureForce(far, 0.2, { stiffness: 2, h });  // 지지 밖 → 힘 0
  const farSame = relOk(far[0].px, 0, 1e-12) && relOk(far[1].px, 0, 1e-12);
  check('항등/안전 — k=0 early-return·단일/빈/지지 밖 무변화',
    k0same && relOk(single[0].px, 0, 1e-12) && empty.length === 0 && farSame,
    `k=0 Δp 0 · 단일 Δp 0 · 빈 [] · 멀리(지지 밖) Δp 0`);
}

// ── 6. 결정론 — 같은 입력 → 같은 압력 힘 지문 ──
{
  function fnv(parts) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of parts) { push(p.px); push(p.py); push(p.pz); push(p.density || 0); }
    return h >>> 0;
  }
  function scene() { const p = []; for (let i = 0; i < 12; i++) p.push(ent(Math.cos(i) * 1.5, Math.sin(i) * 1.5, (i % 3) - 1, 1 + 0.1 * i)); return p; }
  const a = fnv(SPH.sphPressureForce(scene(), 0.2, { stiffness: 1.5, gamma: 2, h: 1.8 }));
  const b = fnv(SPH.sphPressureForce(scene(), 0.2, { stiffness: 1.5, gamma: 2, h: 1.8 }));
  check('결정론 — 같은 입력 → 같은 압력 힘 지문', a === b, `0x${a.toString(16)}`);
}

// ── 결과 출력 ──
let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 SPH 압력 힘: 대칭 쌍힘으로 가스처럼 퍼짐·운동량 정확 보존·균일→힘0' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);
