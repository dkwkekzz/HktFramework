// step_0027/verify.js — S5-b(첫 단위): 개체 탄도 운동(자유 강체 드리프트). 순수·독립·영구.
//
//   design §4 S5: 승격된 개체를 *개체-공간에서* 굴린다. 이 단위 = 힘 없는 자유 운동(개체판 뉴턴 1법칙):
//   v=P/질량 등속 직진, 위치만 변하고 질량·운동량·각운동량·에너지는 불변(KE_cm=½|P|²/M 도 불변 → 총E 보존).
//   step_0006 격자 advect(유체 탄도 이류)의 *개체-공간* 거울짝 — 격자는 한 칸도 안 돈다.
//
//   검증 대상:
//     1. 위치 적분 정확 — n 스텝 후 위치 = 시작 + (P/질량)·dt·n (기계 정밀도).
//     2. 자유 운동 보존 — 질량·운동량 P·각운동량 L·총E 가 드리프트 후에도 *불변*(위치만 변함).
//     3. 왕복 통합(promote→drift→demote) — 격자 질량·운동량·에너지 보존 + 강등 후 격자 CoM 이
//        드리프트한 개체 위치로 *이동*(별이 격자 위 다른 자리로 옮겨감 = 운동 실증).
//     4. 주기 경계 wrap — 경계 넘는 개체가 [0,N) 로 감김(토러스, 손실 0).
//     5. 항등(회귀) — dt=0 또는 v=0(정지 개체) → 위치 불변.
//     6. 회귀 0 — 신규 모듈(가법) · promote 개체 descriptor 불변.
//     7. 결정론.
//
//   실행: node HTJ/steps/step_0027/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const In = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const Cl = require(path.resolve(__dirname, '../../engine/htj-cluster.js'));
const Pm = require(path.resolve(__dirname, '../../engine/htj-promote.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const N = 24, DT = 0.2;
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const relOk = (a, b) => Math.abs(a - b) <= 1e-9 + 1e-12 * Math.abs(b);
function gridMass(w) { return sum(w.fields.energy); }
function gridMom(w) { return [sum(w.fields.mom_x), sum(w.fields.mom_y), sum(w.fields.mom_z)]; }
function gridKE(w) { const r = w.fields.energy, gx = w.fields.mom_x, gy = w.fields.mom_y, gz = w.fields.mom_z; let s = 0; for (let i = 0; i < r.length; i++) if (r[i] > 1e-12) s += 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / r[i]; return s; }
function gridEnergy(w) { return gridKE(w) + (w.fields.therm ? sum(w.fields.therm) : 0); }
function gridCoM(w) { const r = w.fields.energy; let m = 0, cx = 0, cy = 0, cz = 0; for (let i = 0; i < r.length; i++) { const v = r[i]; if (v === 0) continue; const x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / (N * N); m += v; cx += v * x; cy += v * y; cz += v * z; } return m > 0 ? [cx / m, cy / m, cz / m] : [0, 0, 0]; }

function newWorld() {
  const w = W.createWorld(N); w.addField('therm');
  for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
  return w;
}
// 한쪽에서 출발하는 *움직이는* 따뜻한 별 — bulk 속도 vx 를 실어 승격하면 개체가 그 속도로 드리프트한다.
function makeMovingStar(steps, vx) {
  const w = newWorld();
  In.seedMovingBlob(w, { cx: N * 0.28, cy: (N - 1) / 2, cz: (N - 1) / 2, sigma: N * 0.12, M0: 2000, vx });
  // therm 을 살짝 줘 환원이 열도 옮기게(질량만 있어도 무방하나 실제 별에 가깝게).
  for (let i = 0; i < w.fields.therm.length; i++) w.fields.therm[i] = w.fields.energy[i] * 0.5;
  for (let t = 0; t < steps; t++) {
    Pr.applyPressure(w, DT, { K: 0.12, gamma: 2 });
    Th.applyThermalPressure(w, DT, { Kth: 0.3, gamma: 5 / 3 });
    Vi.applyViscosity(w, DT, { Kvisc: 0.6 });
    In.advect(w, DT, { scalars: ['therm'] });
  }
  return w;
}
function biggestClumpCells(w) {
  const mean = gridMass(w) / w.fields.energy.length, eps = Math.max(mean * 1.5, 1e-9);
  const clumps = Cl.detectClumps(w, { eps, minCells: 2, collectCells: true });
  return clumps.length ? clumps[0].cellList : [];
}

// ── 1. 위치 적분 정확 — n 스텝 후 위치 = 시작 + v·dt·n (기계 정밀도) ──
{
  // 합성 개체(알려진 운동량) — 격자 무관·해석값 대조.
  const e = { cx: 5, cy: 6, cz: 7, mass: 4, px: 4 * 0.5, py: 4 * (-0.25), pz: 0, Lx: 0, Ly: 0, Lz: 0, energy: 100 };
  const n = 10;
  const cx0 = e.cx, cy0 = e.cy;
  for (let t = 0; t < n; t++) En.stepEntity(e, DT);          // wrap 없음(자유 공간)
  const vx = 0.5, vy = -0.25;
  const ok = Math.abs(e.cx - (cx0 + vx * DT * n)) < 1e-12 && Math.abs(e.cy - (cy0 + vy * DT * n)) < 1e-12 && e.cz === 7;
  check('위치 적분 정확 — n 스텝 후 = 시작 + (P/질량)·dt·n (기계 정밀도)',
    ok, `cx ${e.cx.toFixed(4)}=${(cx0 + vx * DT * n).toFixed(4)} · cy ${e.cy.toFixed(4)}=${(cy0 + vy * DT * n).toFixed(4)}`);
}

// ── 2. 자유 운동 보존 — 질량·운동량·각운동량·총E 불변(위치만 변함) ──
{
  const e = { cx: 8, cy: 8, cz: 8, mass: 7, px: 3, py: -2, pz: 1, Lx: 0.5, Ly: -1.5, Lz: 2.25, energy: 321.5 };
  const m0 = e.mass, P0 = [e.px, e.py, e.pz], L0 = [e.Lx, e.Ly, e.Lz], E0 = e.energy;
  for (let t = 0; t < 20; t++) En.stepEntity(e, DT, { N });
  const ok = e.mass === m0 && e.px === P0[0] && e.py === P0[1] && e.pz === P0[2] &&
    e.Lx === L0[0] && e.Ly === L0[1] && e.Lz === L0[2] && e.energy === E0;
  check('자유 운동 보존 — 질량·운동량 P·각운동량 L·총E 불변(드리프트는 위치만 바꿈)',
    ok, `질량 ${e.mass}=${m0} · P=(${e.px},${e.py},${e.pz}) · L=(${e.Lx},${e.Ly},${e.Lz}) · E ${e.energy}=${E0}`);
}

// ── 3. 왕복 통합(promote→drift→demote) — 격자 보존 + 별이 새 자리로 이동 ──
//   움직이는 덩어리를 *통째로* 승격하면 격자가 비워진다 → 드리프트한 개체를 빈 격자의 *새 위치*에 강등할 수
//   있다(별이 격자를 가로질러 옮겨감). (잔류 가스가 옛 구멍을 메우는 확산 별과 달리, 깨끗한 이동 실증.)
let driftInfo = '';
{
  // 작고 조밀한 균일 구(반지름 3) — 옅은 꼬리가 없어 승격하면 격자가 *완전히* 비고, 강등 구가 격자 안에
  //   온전히 들어가(경계 clamp 없음) 깨끗이 옮겨간다. mom_x=ρ·vx 로 +x 속도.
  const w = newWorld();
  const cx0 = 6, cy0 = (N - 1) / 2, cz0 = (N - 1) / 2, rad = 3, rho0 = 4, vx0 = 0.5;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - cx0, dy = y - cy0, dz = z - cz0;
    if (dx * dx + dy * dy + dz * dz <= rad * rad) { const i = (z * N + y) * N + x; w.fields.energy[i] = rho0; w.fields.mom_x[i] = rho0 * vx0; w.fields.therm[i] = rho0 * 0.5; }
  }
  const m0 = gridMass(w), p0 = gridMom(w), e0 = gridEnergy(w);
  const com0 = gridCoM(w);
  // 구 전체를 한 개체로 — 격자가 완전히 비워진다.
  const clumps = Cl.detectClumps(w, { eps: 1e-9, minCells: 2, collectCells: true });
  const ent = Pm.promote(w, clumps[0].cellList);             // 격자에서 빼냄(전부)
  const vx = ent.mass > 1e-12 ? ent.px / ent.mass : 0;
  const n = 12;
  for (let t = 0; t < n; t++) En.stepEntity(ent, DT, { N });  // 개체-공간 드리프트
  Pm.demote(w, ent);                                          // *새 위치*(빈 격자)에 강등
  const m1 = gridMass(w), p1 = gridMom(w), e1 = gridEnergy(w);
  const com1 = gridCoM(w);
  const expectShift = vx * DT * n;                            // 기대 이동량(x)
  const actualShift = com1[0] - com0[0];
  const consv = relOk(m1, m0) && relOk(p1[0], p0[0]) && relOk(p1[1], p0[1]) && relOk(p1[2], p0[2]) && relOk(e1, e0);
  // 강등 구 CoM 이 개체 위치 반영(이산 격자라 ~1 셀 오차) + 실제로 옮겨감(이동량>1셀, 기대치와 1셀 이내).
  const moved = Math.abs(com1[0] - ent.cx) < 1.5 && Math.abs(actualShift) > 1 && Math.abs(actualShift - expectShift) < 1.5;
  driftInfo = `CoM_x ${com0[0].toFixed(2)}→${com1[0].toFixed(2)} (이동 ${actualShift.toFixed(2)}, 기대 ${expectShift.toFixed(2)})`;
  check('왕복 통합(promote→drift→demote) — 격자 질량·운동량·에너지 보존 + 별이 새 자리로 이동',
    consv && moved, `질량 ${m0.toFixed(1)}→${m1.toFixed(1)} · 에너지 ${e0.toFixed(1)}→${e1.toFixed(1)} · ${driftInfo}`);
}

// ── 4. 주기 경계 wrap — 경계 넘는 개체가 [0,N) 로 감김(토러스, 손실 0) ──
{
  // 오른쪽 끝 근처에서 +x 로 빠르게 — 경계를 넘어 왼쪽으로 감겨야 한다.
  const e = { cx: N - 1.5, cy: 5, cz: 5, mass: 2, px: 2 * 0.8, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, energy: 10 };
  const totalAdvance = 0.8 * DT * 30;                        // 30 스텝 이동량(>N 이도록 가능)
  for (let t = 0; t < 30; t++) En.stepEntity(e, DT, { N });
  const inRange = e.cx >= 0 && e.cx < N;
  // wrap 후 위치 = (시작 + 이동) mod N 이어야(토러스).
  const expect = ((N - 1.5 + totalAdvance) % N + N) % N;
  const ok = inRange && Math.abs(e.cx - expect) < 1e-9;
  check('주기 경계 wrap — 경계 넘는 개체가 [0,N) 로 감김(토러스, 손실 0)',
    ok, `cx ${e.cx.toFixed(3)}∈[0,${N}) · 기대 ${expect.toFixed(3)} (총 이동 ${totalAdvance.toFixed(2)})`);
}

// ── 5. 항등(회귀) — dt=0 또는 v=0(정지 개체) → 위치 불변 ──
{
  const a = { cx: 3.3, cy: 4.4, cz: 5.5, mass: 5, px: 9, py: -3, pz: 2, Lx: 0, Ly: 0, Lz: 0, energy: 50 };
  En.stepEntity(a, 0, { N });                                // dt=0 → 항등
  const dt0 = a.cx === 3.3 && a.cy === 4.4 && a.cz === 5.5;
  const b = { cx: 7.1, cy: 2.2, cz: 9.9, mass: 5, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, energy: 50 };
  for (let t = 0; t < 10; t++) En.stepEntity(b, DT, { N });  // v=0 → 항등
  const v0 = b.cx === 7.1 && b.cy === 2.2 && b.cz === 9.9;
  check('항등(회귀) — dt=0 또는 정지 개체(P=0) → 위치 불변', dt0 && v0,
    `dt=0 (${a.cx},${a.cy},${a.cz}) · v=0 (${b.cx},${b.cy},${b.cz})`);
}

// ── 6. 회귀 0 — 신규 모듈(가법) · promote 개체 descriptor 불변(stepEntity 가 안 건드린 필드) ──
{
  const w = makeMovingStar(6, 0.4);
  const cells = biggestClumpCells(w);
  const ent = Pm.promote(w, cells);
  const snap = { mass: ent.mass, px: ent.px, py: ent.py, pz: ent.pz, Lx: ent.Lx, Ly: ent.Ly, Lz: ent.Lz, energy: ent.energy, radius: ent.radius, temp: ent.temp, cells: ent.cells };
  En.stepEntity(ent, DT, { N });
  const same = ent.mass === snap.mass && ent.px === snap.px && ent.py === snap.py && ent.pz === snap.pz &&
    ent.Lx === snap.Lx && ent.Ly === snap.Ly && ent.Lz === snap.Lz && ent.energy === snap.energy &&
    ent.radius === snap.radius && ent.temp === snap.temp && ent.cells === snap.cells;
  check('회귀 0 — 신규 모듈(가법)·드리프트가 보존량/형상 descriptor 안 건드림(위치만)',
    same, `질량·P·L·E·반지름·온도·셀수 전부 불변 = ${same}`);
}

// ── 7. 결정론 ──
{
  function run() {
    const w = makeMovingStar(8, 0.5);
    const cells = biggestClumpCells(w);
    const ent = Pm.promote(w, cells);
    for (let t = 0; t < 12; t++) En.stepEntity(ent, DT, { N });
    Pm.demote(w, ent);
    return w.fingerprint('energy') ^ w.fingerprint('mom_x');
  }
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 드리프트+왕복 결과 지문', a === b, `0x${(a >>> 0).toString(16)}`);
}

console.log('\n=== step_0027 수치 검증: S5-b(첫 단위) 개체 탄도 운동(자유 강체 드리프트) ===');
console.log(`  [정보용] 승격 개체가 격자 순회 없이 위치만 적분돼 격자를 가로지른다 — ${driftInfo}`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
