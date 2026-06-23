// step_0037/verify.js — SW2 접촉(반발 + 소산, DEM): 겹친 구체를 떠받치고(반발) 멈춘다(소산). 순수·독립·영구.
//
//   design/sphere-world.md §6 SW2 — 합치기(SW1)가 닿고 느린 구체를 *하나로* 붙였다면, 접촉은 겹친 구체를
//   *합치지 않고 떠받친다* — "쌓이고·표면이 서고·선다"("선 캐릭터 = 중력↓ + 접촉↑ 균형"의 접촉 쪽). 두 힘:
//     ① 반발(Hooke 보존 쌍힘) F=k·overlap, equal-opposite → 순 운동량 정확 보존·탄성 PE 저장(가역).
//     ② 감쇠(법선 소산) 상대 법선 운동E → 열(internalE·비가역). 반발만이면 영원히 튕기고, 감쇠가 멈춘다.
//   에너지 정합: 총E = Σenergy_i + U_contact 보존(반발=KEcm↔U 가역·감쇠=KEcm→internalE 비가역).
//
//   검증 대상:
//     1. 반발 = 운동량 보존 + 밀어냄 — 겹친 정지 두 구체가 ΣP=0 유지하며 서로 밀려 떨어진다.
//     2. 반발 에너지 보존 — 총E(Σenergy + 탄성 U_contact)가 밀어내는 내내 보존(가역).
//     3. 비가역 소산(비탄성 충돌) — 감쇠로 충돌 후 KE↓, 잃은 만큼 정확히 internalE↑(열)·ΣP=0.
//     4. 중력↓+접촉↑ 균형 — 시험 구체가 큰 구체(=지면) 위에서 정착(속도→0·접촉 유지). 0028 중력 재사용.
//     5. 항등/안전 — 노브 0·안 겹침·빈/단일 입력 무변화(가법성=회귀 0).
//     6. 과감쇠 안정 가드 — c·dt ≫ μ 에서도 임계 클램프로 에너지 주입·internalE 음수 없음(버그 수정 회귀 가드).
//     7. 결정론.
//
//   실행: node HTJ/steps/step_0037/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);

// 개체 descriptor — 반지름은 직접 지정(접촉 임계). internalE=열.
function ent(cx, cy, cz, mass, px, py, pz, opts) {
  opts = opts || {};
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  const internalE = opts.internalE != null ? opts.internalE : 0;
  return {
    cx, cy, cz, mass, px, py, pz, Lx: 0, Ly: 0, Lz: 0,
    KEcm, internalKE: 0, internalE, energy: KEcm + internalE,
    cells: opts.cells != null ? opts.cells : 100, radius: opts.radius != null ? opts.radius : 2, temp: 0, peak: 1
  };
}
const totPx = (es) => es.reduce((s, e) => s + e.px, 0);
const totE = (es) => es.reduce((s, e) => s + e.energy, 0);
const totInt = (es) => es.reduce((s, e) => s + e.internalE, 0);
const totKE = (es) => es.reduce((s, e) => s + e.KEcm, 0);
const dist = (a, b) => Math.hypot(b.cx - a.cx, b.cy - a.cy, b.cz - a.cz);
const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;

// ── 1·2. 반발 = 운동량 보존 + 밀어냄 + 에너지 보존 (중력·감쇠 없음·가역) ──
{
  // 반지름 2 두 구체를 거리 2.5 로 겹쳐 둠(overlap 1.5)·정지(P=0). 반발만(k=2)으로 밀려 떨어진다.
  const es = [ent(15, 16, 16, 100, 0, 0, 0, { internalE: 10, radius: 2 }),
              ent(17.5, 16, 16, 100, 0, 0, 0, { internalE: 10, radius: 2 })];
  const opt = { k: 2, cDamp: 0 };
  const d0 = dist(es[0], es[1]);
  const E0 = totE(es) + En.contactPotentialEnergy(es, opt);   // 총E = Σenergy + 탄성 PE
  let maxP = 0, maxEdev = 0;
  for (let s = 0; s < 600; s++) {
    En.applyEntityContact(es, 0.05, opt);
    En.stepEntities(es, 0.05);
    maxP = Math.max(maxP, Math.abs(totPx(es)));               // 순 운동량(0 이어야)
    const E = totE(es) + En.contactPotentialEnergy(es, opt);
    maxEdev = Math.max(maxEdev, Math.abs(E - E0) / Math.abs(E0));
  }
  const d1 = dist(es[0], es[1]);
  check('반발 = 운동량 보존 + 밀어냄 — 겹친 정지 두 구체가 ΣP=0 유지하며 떨어짐',
    maxP < 1e-9 && d1 > d0 + 1.0,
    `max|ΣP|=${maxP.toExponential(1)}(≈0) · 거리 ${d0.toFixed(2)}→${d1.toFixed(2)}(밀려남)`);
  check('반발 에너지 보존 — 총E(Σenergy + 탄성 U_contact) 가역 보존(감쇠 없음)',
    maxEdev < 5e-3, `max 상대편차 ${(maxEdev * 100).toFixed(3)}%(<0.5%)`);
}

// ── 3. 비가역 소산 — 비탄성 정면 충돌: 감쇠로 KE↓·정확히 열로·ΣP=0 ──
{
  // 반지름 2 두 구체 정면 접근(±운동량, ΣP=0). 거리 6(안 겹침)서 시작 → 충돌 → 다시 분리.
  const es = [ent(13, 16, 16, 100, 30, 0, 0, { internalE: 5, radius: 2 }),
              ent(19, 16, 16, 100, -30, 0, 0, { internalE: 5, radius: 2 })];
  const opt = { k: 5, cDamp: 1.5 };
  const KE_in = totKE(es), int_in = totInt(es), E_in = totE(es);   // 시작(안 겹침·U=0)
  let maxP = 0, collided = false;
  // 충돌(겹침)했다가 다시 분리(overlap≤0)된 직후를 잡는다.
  for (let s = 0; s < 4000; s++) {
    En.applyEntityContact(es, 0.02, opt);
    En.stepEntities(es, 0.02);
    maxP = Math.max(maxP, Math.abs(totPx(es)));
    const overlap = (es[0].radius + es[1].radius) - dist(es[0], es[1]);
    if (overlap > 0) collided = true;
    if (collided && overlap <= 0) break;                          // 분리 직후(U_contact=0)
  }
  const KE_out = totKE(es), int_out = totInt(es), E_out = totE(es);
  // 분리 순간 U_contact=0 → 총E=Σenergy. 에너지 보존: E_out≈E_in. 소산: KE↓·잃은 만큼 internalE↑.
  const ok = collided && maxP < 1e-9 && KE_out < KE_in - 1e-6 &&
    relOk(E_out, E_in, 1e-3 * Math.abs(E_in)) &&
    relOk(int_out - int_in, KE_in - KE_out, 1e-3 * Math.abs(KE_in));
  check('비가역 소산(비탄성 충돌) — 감쇠로 KE↓·잃은 만큼 정확히 열(internalE)↑·ΣP=0',
    ok, `KE ${KE_in.toFixed(1)}→${KE_out.toFixed(1)}(↓${(KE_in - KE_out).toFixed(1)}) = internalE ↑${(int_out - int_in).toFixed(1)} · 총E ${E_in.toFixed(1)}→${E_out.toFixed(1)} · max|ΣP|=${maxP.toExponential(1)}`);
}

// ── 4. 중력↓ + 접촉↑ 균형 — 시험 구체가 큰 구체(지면) 위에서 정착(멈춤) ──
{
  // 큰 구체(지면): 질량 거대(질량비 1000:1 → 거의 안 움직임)·반지름 10. 시험 구체: 위에서 떨어져 떠받쳐 정착.
  //   스케일: 중력 GM=2 → 접촉 부근 F≈GM·m/d²≈1.4(부드러운 낙하), 반발 k=10 → 평형 overlap*≈F/k≈0.14.
  const ground = ent(16, 16, 16, 1e5, 0, 0, 0, { internalE: 0, radius: 10 });
  const probe = ent(16, 16, 32, 100, 0, 0, 0, { internalE: 0, radius: 2 });  // 거리 16(접촉 임계 12 밖)서 낙하
  const es = [ground, probe];
  const gopt = { G: 2e-5, soft: 1 }, copt = { k: 10, cDamp: 30 };
  let maxSpeed = 0;
  for (let s = 0; s < 4000; s++) {
    En.applyEntityGravity(es, 0.02, gopt);     // 중력↓(0028 재사용) — 지면이 시험 구체를 끈다
    En.applyEntityContact(es, 0.02, copt);     // 접촉↑ — 겹치면 떠받침 + 감쇠로 바운스 죽임
    En.stepEntities(es, 0.02);
    maxSpeed = Math.max(maxSpeed, speed(probe));
  }
  const d_final = dist(ground, probe);
  const overlap_final = (ground.radius + probe.radius) - d_final;
  const v_final = speed(probe);
  // 정착: 접촉 유지(overlap>0)·낙하 중 최대 속도 대비 잔류 속도 급감(멈춤).
  const ok = overlap_final > 0 && d_final < ground.radius + probe.radius && v_final < 0.05 && v_final < maxSpeed * 0.05;
  check('중력↓+접촉↑ 균형 — 시험 구체가 큰 구체(지면) 위에서 정착(멈춤)',
    ok, `접촉 overlap=${overlap_final.toFixed(3)}(>0) · 잔류 속도 ${v_final.toFixed(4)} (낙하 최대 ${maxSpeed.toFixed(2)}→정착)`);
}

// ── 5. 항등/안전 — 노브 0·안 겹침·빈/단일 ──
{
  // 노브 0 → early-return(거동 불변).
  const a = ent(15, 16, 16, 100, 3, -2, 1, { internalE: 7, radius: 2 });
  const before = JSON.stringify(a);
  En.applyEntityContact([a, ent(40, 16, 16, 100, 0, 0, 0, { radius: 2 })], 0.05, { k: 0, cDamp: 0 });
  const noopOk = JSON.stringify(a) === before;
  // 안 겹침(거리 8 > r+r=4)·k>0 → 무변화.
  const far = [ent(12, 16, 16, 100, 0, 0, 0, { internalE: 3, radius: 2 }),
               ent(20, 16, 16, 100, 0, 0, 0, { internalE: 3, radius: 2 })];
  const farP0 = totPx(far), farE0 = totE(far);
  En.applyEntityContact(far, 0.05, { k: 10, cDamp: 5 });
  const farOk = relOk(totPx(far), farP0) && relOk(totE(far), farE0);
  // 빈·단일 안전.
  const emptyOk = En.applyEntityContact([], 0.05, { k: 1, cDamp: 1 }).length === 0;
  const singleOk = En.applyEntityContact([ent(16, 16, 16, 100, 1, 0, 0, { radius: 2 })], 0.05, { k: 1, cDamp: 1 }).length === 1;
  check('항등/안전 — 노브0·안 겹침·빈/단일 무변화(회귀 0)',
    noopOk && farOk && emptyOk && singleOk,
    `노브0 ${noopOk ? '불변' : 'X'} · 안 겹침 ${farOk ? '불변' : 'X'} · 빈/단일 ${emptyOk && singleOk ? 'OK' : 'X'}`);
}

// ── 6. 과감쇠 안정 가드 — c·dt ≫ μ 에서도 에너지 주입·internalE 음수 없음(임계 클램프) ──
{
  // 정면 접근하며 겹친 둘에 *과한* 감쇠(c·dt 가 환산질량 μ=50 을 크게 초과). 클램프 없으면 상대 운동이
  // 역전·증폭 → KE↑·dissip<0·internalE 음수(에너지 주입). 클램프로: dissip≥0·internalE 단조↑·총E 보존.
  const es = [ent(15, 16, 16, 100, 40, 0, 0, { internalE: 10, radius: 2 }),
              ent(18, 16, 16, 100, -40, 0, 0, { internalE: 10, radius: 2 })];   // 겹침(거리 3<4)·정면 접근
  const opt = { k: 0, cDamp: 1e4 };                 // 감쇠만·극단(c·dt=500 ≫ μ=50)
  const KE0 = totKE(es), int0 = totInt(es), E0 = totE(es);
  En.applyEntityContact(es, 0.05, opt);
  const KE1 = totKE(es), int1 = totInt(es), E1 = totE(es);
  // 보장: KE 안 늘어남(소산)·internalE 안 줄어듦(열 적립)·둘 다 ≥0·총E 보존·ΣP 정확.
  const ok = KE1 <= KE0 + 1e-9 && int1 >= int0 - 1e-9 && es.every(e => e.internalE >= -1e-9) &&
    relOk(E1, E0, 1e-6 * Math.abs(E0)) && Math.abs(totPx(es)) < 1e-9;
  check('과감쇠 안정 가드 — c·dt≫μ 에서도 에너지 주입·internalE 음수 없음(임계 클램프)',
    ok, `KE ${KE0.toFixed(1)}→${KE1.toFixed(1)}(↓·역전 없음) · internalE ${int0.toFixed(1)}→${int1.toFixed(1)}(↑≥0) · 총E ${E0.toFixed(1)}→${E1.toFixed(1)} · ΣP≈0`);
}

// ── 7. 결정론 ──
{
  function fp() {
    const es = [];
    for (let i = 0; i < 5; i++) es.push(ent(14 + i * 1.5, 16, 16, 100, (i % 2 ? -1 : 1) * 8, 0, 0, { internalE: 4, radius: 2 }));
    for (let s = 0; s < 50; s++) { En.applyEntityContact(es, 0.03, { k: 6, cDamp: 2 }); En.stepEntities(es, 0.03); }
    let h = es.length;
    for (const e of es) h = (h * 131 + Math.round(e.cx * 1e4) + Math.round(e.px * 1e2) + Math.round(e.energy * 1e2)) >>> 0;
    return h >>> 0;
  }
  check('결정론 — 같은 입력 → 같은 접촉 결과 지문', fp() === fp(), `0x${fp().toString(16)}`);
}

console.log('\n=== step_0037 수치 검증: SW2 접촉(반발 + 소산) — 겹친 구체를 떠받치고 멈춘다 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
