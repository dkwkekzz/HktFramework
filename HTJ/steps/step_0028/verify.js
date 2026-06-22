// step_0028/verify.js — S5-b(둘째 단위): 개체간 중력(직접 합산 N-body). 순수·독립·영구.
//
//   design §4 S5("상위 층 강체 동역학")·§3(전역 중력)·§2 레버2. 0027 의 자유 직진(stepEntity)을 *서로
//   끌어 휘는 궤적*으로 — step_0007 격자 자기중력의 *개체-공간* 거울짝. 쌍(i,j)마다
//   F=G·m_i·m_j·(r_j−r_i)/(|r|²+soft²)^{3/2} 를 i 에 +F·j 에 −F(뉴턴 3법칙) → 순 운동량 정확 보존.
//
//   검증 대상:
//     1. 인력 방향 — 두 개체 → 각자 상대 쪽으로 운동량을 얻는다(+F 가 r_j−r_i 방향).
//     2. 순 운동량 정확 보존(관문) — 쌍힘 equal-opposite → ΣP 불변(기계 정밀도).
//     3. 접근 — 정지서 놓은 두 개체가 서로 향해 떨어진다(거리 단조 감소).
//     4. 대칭 2체 — 같은 질량 → CoM 정지(P=0 유지)·CoM 대칭 접근.
//     5. 역학 에너지 유계 — ΣKE_cm + U(쌍 퍼텐셜) 가 발산 없이 보존(symplectic, 작은 상대 표류).
//     6. softening 비발산 — 두 개체가 겹쳐도(r→0) 힘 유한·NaN 없음.
//     7. 항등(회귀) — G=0 또는 dt=0 → 0027 자유 운동만(운동량 불변).
//     8. 회귀 0 — 가법(신규 함수)·결정론.
//
//   실행: node HTJ/steps/step_0028/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const DT = 0.05;

// 개체 생성기 — promote descriptor 형태({cx,cy,cz,mass,px,py,pz,Lx,Ly,Lz,KEcm,internalE,energy,radius,temp,peak}).
function ent(cx, cy, cz, mass, vx, vy, vz, internalE) {
  internalE = internalE == null ? 10 : internalE;
  const px = mass * (vx || 0), py = mass * (vy || 0), pz = mass * (vz || 0);
  const KEcm = mass > 1e-12 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  return { cx, cy, cz, mass, px, py, pz, Lx: 0, Ly: 0, Lz: 0, KEcm, internalE, energy: KEcm + internalE, radius: 2, temp: 1, peak: 1 };
}
const sumP = (es) => { let x = 0, y = 0, z = 0; for (const e of es) { x += e.px; y += e.py; z += e.pz; } return [x, y, z]; };
const dist = (a, b) => Math.hypot(b.cx - a.cx, b.cy - a.cy, b.cz - a.cz);

// ── 1. 인력 방향 ──
{
  const a = ent(0, 0, 0, 5, 0, 0, 0), b = ent(10, 0, 0, 5, 0, 0, 0);
  En.applyEntityGravity([a, b], DT, { G: 1, soft: 1 });
  // a 는 +x(b 쪽), b 는 −x(a 쪽) 운동량을 얻어야.
  const ok = a.px > 0 && b.px < 0 && Math.abs(a.px + b.px) < 1e-15;
  check('인력 방향 — 두 개체가 서로 상대 쪽으로 가속(a +x·b −x)', ok, `a.px ${a.px.toExponential(2)} · b.px ${b.px.toExponential(2)}`);
}

// ── 2. 순 운동량 정확 보존(관문) — 임의 배치 여러 개체 ──
{
  const es = [ent(0, 0, 0, 3, 0.2, 0, 0), ent(8, 3, 0, 7, 0, -0.1, 0), ent(4, 9, 2, 5, 0, 0, 0.3), ent(-5, 2, 6, 2, 0, 0, 0)];
  const P0 = sumP(es);
  for (let t = 0; t < 50; t++) { En.applyEntityGravity(es, DT, { G: 0.8, soft: 1.5 }); En.stepEntities(es, DT); }
  const P1 = sumP(es);
  const ok = Math.abs(P1[0] - P0[0]) < 1e-12 && Math.abs(P1[1] - P0[1]) < 1e-12 && Math.abs(P1[2] - P0[2]) < 1e-12;
  check('순 운동량 정확 보존(관문) — 쌍힘 equal-opposite → ΣP 불변(기계 정밀도)',
    ok, `ΣP (${P0[0].toFixed(3)},${P0[1].toFixed(3)},${P0[2].toFixed(3)})→(${P1[0].toFixed(3)},${P1[1].toFixed(3)},${P1[2].toFixed(3)})`);
}

// ── 3. 접근 — 정지서 놓은 두 개체가 떨어진다 ──
{
  const a = ent(0, 0, 0, 10, 0, 0, 0), b = ent(12, 0, 0, 10, 0, 0, 0);
  const d0 = dist(a, b);
  for (let t = 0; t < 60; t++) { En.applyEntityGravity([a, b], DT, { G: 1, soft: 1 }); En.stepEntities([a, b], DT); }
  const d1 = dist(a, b);
  check('접근 — 정지서 놓은 두 개체가 서로 향해 떨어진다(거리 ↓)', d1 < d0 - 0.5, `거리 ${d0.toFixed(2)} → ${d1.toFixed(2)}`);
}

// ── 4. 대칭 2체 — 같은 질량 → CoM 정지·대칭 접근 ──
{
  const c = 12;                                      // 대칭축
  const a = ent(c - 6, c, c, 8, 0, 0, 0), b = ent(c + 6, c, c, 8, 0, 0, 0);
  let maxComDrift = 0;
  for (let t = 0; t < 80; t++) {
    En.applyEntityGravity([a, b], DT, { G: 1, soft: 1 }); En.stepEntities([a, b], DT);
    const comx = (a.mass * a.cx + b.mass * b.cx) / (a.mass + b.mass);
    maxComDrift = Math.max(maxComDrift, Math.abs(comx - c));
  }
  // CoM 정지(P=0 유지·대칭) + 둘이 축 기준 대칭(a.cx+b.cx ≈ 2c).
  const P = sumP([a, b]);
  const symmetric = Math.abs(a.cx + b.cx - 2 * c) < 1e-9 && maxComDrift < 1e-9 && Math.abs(P[0]) < 1e-12;
  check('대칭 2체 — 같은 질량 → CoM 정지(P=0 유지)·축 대칭 접근',
    symmetric, `CoM 표류 max ${maxComDrift.toExponential(1)} · a.cx+b.cx ${(a.cx + b.cx).toFixed(4)}=${2 * c} · ΣP_x ${P[0].toExponential(1)}`);
}

// ── 5. 역학 에너지 유계 — ΣKE_cm + U 가 발산 없이 보존 ──
let energyInfo = '';
{
  const a = ent(6, 12, 12, 6, 0, 0.5, 0), b = ent(18, 12, 12, 6, 0, -0.5, 0);  // 약한 궤도(접선 속도)
  const G = 1, soft = 1.5, opt = { G, soft };
  const mech = (es) => { let ke = 0; for (const e of es) ke += e.KEcm; return ke + En.pairPotentialEnergy(es, opt); };
  // KEcm 초기화(ent 가 이미 계산) — 첫 측정.
  const E0 = mech([a, b]);
  let emin = E0, emax = E0;
  for (let t = 0; t < 200; t++) {
    En.applyEntityGravity([a, b], DT, opt); En.stepEntities([a, b], DT);
    const E = mech([a, b]); if (E < emin) emin = E; if (E > emax) emax = E;
  }
  const drift = Math.abs(emax - emin) / Math.abs(E0);
  energyInfo = `E0 ${E0.toFixed(3)} · 진폭/|E0| ${(drift * 100).toFixed(2)}%`;
  // symplectic Euler → 유계 진동(발산 아님). 작은 dt 에서 표류 작아야(<5%) + NaN 없음.
  const ok = isFinite(emin) && isFinite(emax) && drift < 0.05;
  check('역학 에너지 유계 — ΣKE_cm + U 발산 없이 보존(symplectic 작은 표류)', ok, energyInfo);
}

// ── 6. softening 비발산 — 겹쳐도 힘 유한·NaN 없음 ──
{
  const a = ent(5, 5, 5, 4, 0, 0, 0), b = ent(5, 5, 5, 4, 0, 0, 0);  // 정확히 같은 위치(r=0)
  En.applyEntityGravity([a, b], DT, { G: 1, soft: 1 });
  // r=0 → 힘 0(방향 없음)·NaN 없음. 약간 떨어뜨리면 유한 인력.
  const c = ent(5, 5, 5, 4, 0, 0, 0), d = ent(5.001, 5, 5, 4, 0, 0, 0);
  En.applyEntityGravity([c, d], DT, { G: 1, soft: 1 });
  const ok = isFinite(a.px) && isFinite(b.px) && !isNaN(a.px) && isFinite(c.px) && isFinite(d.px) && Math.abs(c.px) < 1e3;
  check('softening 비발산 — 두 개체 겹쳐도(r→0) 힘 유한·NaN 없음',
    ok, `r=0 a.px ${a.px} (NaN 없음) · r=ε c.px ${c.px.toExponential(2)} (유한)`);
}

// ── 7. 항등(회귀) — G=0 또는 dt=0 → 운동량 불변(0027 자유 운동만) ──
{
  const a = ent(0, 0, 0, 5, 0.3, 0, 0), b = ent(6, 0, 0, 5, 0, 0, 0);
  const pa0 = a.px, pb0 = b.px;
  En.applyEntityGravity([a, b], DT, { G: 0, soft: 1 });   // G=0
  En.applyEntityGravity([a, b], 0, { G: 1, soft: 1 });    // dt=0
  const ok = a.px === pa0 && b.px === pb0;
  check('항등(회귀) — G=0 또는 dt=0 → 운동량 불변(0027 자유 운동만)', ok, `a.px ${a.px}=${pa0} · b.px ${b.px}=${pb0}`);
}

// ── 8. 결정론 ──
{
  function run() {
    const es = [ent(0, 0, 0, 3, 0.2, 0, 0), ent(8, 3, 0, 7, 0, -0.1, 0), ent(4, 9, 2, 5, 0, 0, 0.3)];
    for (let t = 0; t < 40; t++) { En.applyEntityGravity(es, DT, { G: 0.8, soft: 1.5 }); En.stepEntities(es, DT); }
    let h = 0; for (const e of es) h = (h * 131 + Math.round(e.cx * 1e6) + Math.round(e.px * 1e6)) >>> 0;
    return h;
  }
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 N-body 결과 지문', a === b, `0x${(a >>> 0).toString(16)}`);
}

console.log('\n=== step_0028 수치 검증: S5-b(둘째 단위) 개체간 중력(직접 합산 N-body) ===');
console.log(`  [정보용] 자유 직진(0027)이 서로 끌어 휘는 궤적이 된다(개체-공간 자기중력) — ${energyInfo}`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
