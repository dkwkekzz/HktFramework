// step_0031/verify.js — S5-c(둘째 단위): 자동 강등(외란/충돌→유체 복원). 순수·독립·영구.
//
//   design §2 레버2("강한 외력/충돌/가열로 임계를 넘으면 다시 격자 유체로"). 0030 이 *승격* 트리거(동결→
//   개체)를 박았다면, 이 step 은 *강등* 역트리거 — 레버2 의 왕복(승격↔강등)을 자동으로 닫는다.
//   autoDemoteOnDisturbance: 충돌(쌍 근접) 또는 외력 임계 초과 개체를 demote(spin)로 유체 복원.
//
//   검증 대상:
//     1. 충돌 자동 강등 — 두 개체가 접촉 거리 안이면 둘 다 강등(유체로)·멀면 안 강등.
//     2. 외력 임계 강등 — forceMag>threshold 개체만 강등.
//     3. 보존 — 강등 전후 Σ(격자+개체) 질량·운동량·에너지 정확 보존(역승격 이관).
//     4. 각운동량 복원 — 회전 개체 강등 시 격자 L = entity.L(spin 기본 on·0029 합류).
//     5. 둘 자리 없으면 안 풀고 개체 유지 — 격자 꽉 차면 demote 0 → 개체로 남김(질량 손실 0).
//     6. 왕복(승격→강등) — promote→autoDemote 후 격자 활성 칸 복귀·보존(레버2 왕복 닫힘).
//     7. 회귀 0·결정론.
//
//   실행: node HTJ/steps/step_0031/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Pm = require(path.resolve(__dirname, '../../engine/htj-promote.js'));
const Hy = require(path.resolve(__dirname, '../../engine/htj-hybrid.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const N = 24;
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const relOk = (a, b) => Math.abs(a - b) <= 1e-7 + 1e-9 * Math.abs(b);
function newWorld() { const w = W.createWorld(N); w.addField('therm'); for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array }); return w; }
function gridMass(w) { return sum(w.fields.energy); }
function gridMom(w) { return [sum(w.fields.mom_x), sum(w.fields.mom_y), sum(w.fields.mom_z)]; }
function gridKE(w) { const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z; let s = 0; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) s += 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / r[i]; return s; }
function gridEnergy(w) { return gridKE(w) + sum(w.fields.therm); }
function activeCells(w) { const r = w.fields.energy; let c = 0; for (let i = 0; i < r.length; i++) if (r[i] !== 0) c++; return c; }
function ent(cx, cy, cz, mass, vx, Lz, internalE, radius) {
  internalE = internalE == null ? 50 : internalE; radius = radius == null ? 2.5 : radius;
  const px = mass * (vx || 0), KEcm = mass > 1e-12 ? 0.5 * px * px / mass : 0;
  return { cx, cy, cz, mass, px, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: Lz || 0, KEcm, internalE, energy: KEcm + internalE, radius, temp: 1, peak: 1, cells: Math.round(4 / 3 * Math.PI * radius * radius * radius) };
}

// ── 1. 충돌 자동 강등 ──
{
  const w = newWorld();
  const near = [ent(10, 12, 12, 100, 0, 0), ent(14, 12, 12, 100, 0, 0)];   // 거리 4 < r+r+pad=2.5+2.5+1
  const res = Hy.autoDemoteOnDisturbance(w, near, { contactPad: 1 });
  const far = newWorld();
  const fars = [ent(4, 4, 4, 100, 0, 0), ent(20, 20, 20, 100, 0, 0)];
  const res2 = Hy.autoDemoteOnDisturbance(far, fars, { contactPad: 1 });
  const ok = res.demoted === 2 && res.survivors.length === 0 && res.addedCells > 0 && res2.demoted === 0 && res2.survivors.length === 2;
  check('충돌 자동 강등 — 접촉 거리 안 두 개체 강등·멀면 안 강등',
    ok, `근접: 강등 ${res.demoted}·생존 ${res.survivors.length}·셀 +${res.addedCells} / 원거리: 강등 ${res2.demoted}·생존 ${res2.survivors.length}`);
}

// ── 2. 외력 임계 강등 ──
{
  const w = newWorld();
  const es = [ent(4, 4, 4, 100, 0, 0), ent(20, 20, 20, 100, 0, 0)];   // 멀리(충돌 아님)
  const res = Hy.autoDemoteOnDisturbance(w, es, { contactPad: 1, forceMag: [50, 2], forceThreshold: 10 });
  const ok = res.demoted === 1 && res.survivors.length === 1 && res.survivors[0].cx === 20;
  check('외력 임계 강등 — forceMag>threshold 개체만 강등(조석 찢김)',
    ok, `강등 ${res.demoted}(force 50>10) · 생존 ${res.survivors.length}(force 2<10)`);
}

// ── 3. 보존 — 강등 전후 Σ(격자+개체) 정확 보존 ──
{
  const w = newWorld();
  const es = [ent(8, 12, 12, 120, 0.3, 0, 60), ent(12, 12, 12, 120, -0.2, 0, 60)];   // 근접·운동량·열
  let em = 0, ep = 0, ee = 0; for (const e of es) { em += e.mass; ep += e.px; ee += e.energy; }
  const m0 = gridMass(w) + em, p0 = gridMom(w)[0] + ep, e0 = gridEnergy(w) + ee;
  const res = Hy.autoDemoteOnDisturbance(w, es, { contactPad: 1 });
  let em1 = 0, ep1 = 0, ee1 = 0; for (const e of res.survivors) { em1 += e.mass; ep1 += e.px; ee1 += e.energy; }
  const m1 = gridMass(w) + em1, p1 = gridMom(w)[0] + ep1, e1 = gridEnergy(w) + ee1;
  const ok = relOk(m1, m0) && relOk(p1, p0) && relOk(e1, e0) && res.demoted === 2;
  check('보존 — 강등 전후 Σ(격자+개체) 질량·운동량·에너지 정확 보존',
    ok, `질량 ${m0.toFixed(1)}→${m1.toFixed(1)} · 운동량x ${p0.toFixed(3)}→${p1.toFixed(3)} · 에너지 ${e0.toFixed(1)}→${e1.toFixed(1)}`);
}

// ── 4. 각운동량 복원(spin 기본 on) ──
{
  const w = newWorld();
  const es = [ent(8, 12, 12, 150, 0, 60, 200, 3), ent(12, 12, 12, 150, 0, 0, 200, 3)];   // 첫 개체 Lz=60
  const res = Hy.autoDemoteOnDisturbance(w, es, { contactPad: 1 });
  // 격자 L 계산(질량가중 CoM 기준).
  const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y; let m = 0, cx = 0, cy = 0;
  for (let i = 0; i < r.length; i++) { const v = r[i]; if (v === 0) continue; const x = i % N, y = ((i - x) / N) % N; m += v; cx += v * x; cy += v * y; } cx /= m; cy /= m;
  let Lz = 0; for (let i = 0; i < r.length; i++) { if (r[i] === 0) continue; const x = i % N, y = ((i - x) / N) % N; Lz += (x - cx) * gy[i] - (y - cy) * gx[i]; }
  // 두 개체 합 Lz = 60 + (병진 기여) — spin 복원이면 격자 Lz 가 entity 합 L 을 반영(>0, 0 아님).
  const ok = res.demoted === 2 && Math.abs(Lz - 60) < 5;   // 두 개체 같은 CoM 가까이·둘째 L=0·첫째 L=60
  check('각운동량 복원 — 회전 개체 강등 시 격자 L 복원(spin 기본 on·0029 합류)',
    ok, `격자 Lz ${Lz.toFixed(2)} ≈ Σentity Lz 60 (spin 복원)`);
}

// ── 5. 둘 자리 없으면 안 풀고 개체 유지(질량 손실 0) ──
{
  const w = newWorld();
  for (let i = 0; i < w.fields.energy.length; i++) w.fields.energy[i] = 1;   // 격자 꽉 채움(빈 셀 0개)
  const m0grid = gridMass(w);
  const es = [ent(11, 12, 12, 100, 0, 0), ent(13, 12, 12, 100, 0, 0)];
  const res = Hy.autoDemoteOnDisturbance(w, es, { contactPad: 1 });
  // 빈 셀 없음 → demote 0 → 개체로 남김. 격자 질량 불변·개체 둘 다 생존.
  const ok = res.demoted === 0 && res.survivors.length === 2 && relOk(gridMass(w), m0grid);
  check('둘 자리 없으면 안 풀고 개체 유지 — 격자 꽉 차면 강등 보류(질량 손실 0)',
    ok, `강등 ${res.demoted} · 생존 ${res.survivors.length} · 격자 질량 ${m0grid.toFixed(0)} 불변`);
}

// ── 6. 왕복(승격→강등) — promote→autoDemote 후 활성 칸 복귀·보존 ──
{
  const w = newWorld();
  // 두 조밀 구를 격자에 — 승격 후 강등하면 격자로 돌아옴.
  function seedBall(cx, rho0) { const cells = []; for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = x - cx, dy = y - 12, dz = z - 12; if (dx * dx + dy * dy + dz * dz <= 4) { const i = (z * N + y) * N + x; w.fields.energy[i] = rho0; w.fields.therm[i] = rho0 * 0.5; cells.push(i); } } return cells; }
  const c1 = seedBall(10, 5), c2 = seedBall(14, 5);
  const m0 = gridMass(w), e0 = gridEnergy(w), active0 = activeCells(w);
  const e1 = Pm.promote(w, c1), e2 = Pm.promote(w, c2);
  const activePromoted = activeCells(w);   // 승격 후(빠짐)
  const res = Hy.autoDemoteOnDisturbance(w, [e1, e2], { contactPad: 1 });
  const m1 = gridMass(w), e1g = gridEnergy(w), active1 = activeCells(w);
  const ok = activePromoted < active0 && active1 > activePromoted && relOk(m1, m0) && relOk(e1g, e0) && res.demoted === 2;
  check('왕복(승격→강등) — promote 로 빠졌다 autoDemote 로 격자 복귀·보존(레버2 왕복 닫힘)',
    ok, `활성 칸 ${active0}→(승격)${activePromoted}→(강등)${active1} · 질량 ${m0.toFixed(0)}→${m1.toFixed(0)}`);
}

// ── 7. 결정론 ──
{
  function run() { const w = newWorld(); const es = [ent(8, 12, 12, 120, 0.3, 30, 60, 3), ent(12, 12, 12, 120, -0.2, 0, 60, 3)]; Hy.autoDemoteOnDisturbance(w, es, { contactPad: 1 }); return w.fingerprint('energy') ^ w.fingerprint('mom_x') ^ w.fingerprint('mom_y'); }
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 자동 강등 결과 지문', a === b, `0x${(a >>> 0).toString(16)}`);
}

console.log('\n=== step_0031 수치 검증: S5-c(둘째 단위) 자동 강등(외란/충돌→유체 복원) ===');
console.log('  [정보용] 레버2 왕복 트리거 완성 — 동결→자동 승격(0030)·충돌/외력→자동 강등(이 step)');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
