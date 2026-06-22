// step_0035/verify.js — S5 통합 시연: 복셀 별들이 구체로 승격되어 서로 상호작용(가스 사라짐). 순수·독립·영구.
//
//   사용자 요구: "복셀이 안 보이고 존재가 구체로 표현되어 상호작용." 그동안 박은 부품(검출 0014·동결 0025·
//   승격 0026·개체 동역학 0027/0028·자동 트리거 0030)을 결합해 *그 장면*을 실제로 굴린다 — 여러 조밀
//   덩어리(복셀)가 동결→자동 승격으로 *전부* 개체(구체)가 되고(격자 비움=복셀 사라짐), 구체들이 서로
//   중력으로 끌려 궤도·상호작용한다. 새 engine 없음(통합 시연·0014/0023 류) — 조립된 기계의 창발 검증.
//
//   검증 대상:
//     1. 복셀→구체 전환 — N 개 덩어리(활성 복셀>0) → 전부 승격 후 활성 복셀 0·개체 N 개.
//     2. 질량·운동량 보존 — 승격+N체 동역학 내내 Σ(격자+개체) 정확 보존(승격 보존 + 개체 중력 ΣΔp=0).
//     3. 구체 상호작용 — 개체들이 상호 중력으로 움직인다(위치 변함·서로 끌림, 정적 아님).
//     4. 역학 에너지 유계 — ΣKE_cm + 쌍 퍼텐셜이 발산 없이(symplectic).
//     5. 결정론.
//
//   실행: node HTJ/steps/step_0035/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Sp = require(path.resolve(__dirname, '../../engine/htj-sparse.js'));
const Ac = require(path.resolve(__dirname, '../../engine/htj-activity.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Hy = require(path.resolve(__dirname, '../../engine/htj-hybrid.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const N = 32, BS = 8, CEN = 15.5;
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const relOk = (a, b) => Math.abs(a - b) <= 1e-6 + 1e-9 * Math.abs(b);
const POS = [[8, 16], [24, 16], [16, 8], [16, 24], [10, 10], [22, 22]];

function buildWorld(spin) {
  const w = W.createWorld(N); w.addField('therm');
  for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array });
  for (const [cx, cy] of POS) {
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - cx, dy = y - cy, dz = z - 16;
      if (dx * dx + dy * dy + dz * dz <= 2.5 * 2.5) {
        const i = (z * N + y) * N + x; w.fields.energy[i] = 10; w.fields.therm[i] = 3;
        w.fields.mom_x[i] = 10 * (-spin * (cy - CEN) / 8); w.fields.mom_y[i] = 10 * (spin * (cx - CEN) / 8);
      }
    }
  }
  return w;
}
function activeVoxels(w) { const r = w.fields.energy; let c = 0; for (let i = 0; i < r.length; i++) if (r[i] !== 0) c++; return c; }
function totalMass(w, ents) { let m = sum(w.fields.energy); for (const e of ents) m += e.mass; return m; }
function totalMom(w, ents) { let x = sum(w.fields.mom_x), y = sum(w.fields.mom_y), z = sum(w.fields.mom_z); for (const e of ents) { x += e.px; y += e.py; z += e.pz; } return [x, y, z]; }
function mech(ents) { let ke = 0; for (const e of ents) ke += e.KEcm; return ke + En.pairPotentialEnergy(ents, { G: 0.8, soft: 3 }); }

// 통합 시뮬 한 판 — 덩어리 동결→자동 승격→개체 N체 중력.
function run(spin, frames, snap) {
  const w = buildWorld(spin);
  const H = { set: Sp.createActiveSet(N, BS), tracker: Ac.createActivityTracker(N, BS), entities: [] };
  const m0 = totalMass(w, []), p0 = totalMom(w, []);
  const trace = [];
  for (let f = 0; f < frames; f++) {
    H.set.rebuildFromField(w.fields.energy);
    const mean = w.total('energy') / w.fields.energy.length;
    H.tracker.measure(w.fields.energy, H.set.origins(), { threshold: 0 });
    const eps = Math.max(mean * 3, 1e-9);
    const res = Hy.autoPromoteStable(w, H.tracker, { hold: 2, eps });
    for (const e of res.entities) H.entities.push(e);
    if (H.entities.length >= 2) En.applyEntityGravity(H.entities, 0.2, { G: 0.8, soft: 3 });
    En.stepEntities(H.entities, 0.2, { N });
    if (snap) trace.push({ f, n: H.entities.length, voxels: activeVoxels(w), pos: H.entities.map(e => [e.cx, e.cy]) });
  }
  return { w, H, m0, p0, trace };
}

// ── 1. 복셀→구체 전환 ──
{
  const { w, H } = run(0.5, 12, false);
  check('복셀→구체 전환 — 덩어리 전부 승격 후 활성 복셀 0·개체 N 개',
    activeVoxels(w) === 0 && H.entities.length === POS.length, `활성 복셀 ${activeVoxels(w)}(=0) · 개체 ${H.entities.length}(=${POS.length})`);
}

// ── 2. 질량·운동량 보존 ──
{
  const { w, H, m0, p0 } = run(0.5, 16, false);
  const m1 = totalMass(w, H.entities), p1 = totalMom(w, H.entities);
  const ok = relOk(m1, m0) && relOk(p1[0], p0[0]) && relOk(p1[1], p0[1]) && relOk(p1[2], p0[2]);
  check('질량·운동량 보존 — 승격+N체 동역학 내내 Σ(격자+개체) 정확',
    ok, `질량 ${m0.toFixed(1)}→${m1.toFixed(1)} · 운동량 (${p0[0].toFixed(2)},${p0[1].toFixed(2)})→(${p1[0].toFixed(2)},${p1[1].toFixed(2)})`);
}

// ── 3. 구체 상호작용 — 개체가 상호 중력으로 움직인다 ──
{
  const { H, trace } = run(0.5, 20, true);
  // 승격 직후 위치 vs 끝 위치 — 움직였나(상호작용).
  const firstFull = trace.find(t => t.n === POS.length);
  const last = trace[trace.length - 1];
  let maxMove = 0;
  if (firstFull) for (let i = 0; i < POS.length; i++) { const d = Math.hypot(last.pos[i][0] - firstFull.pos[i][0], last.pos[i][1] - firstFull.pos[i][1]); if (d > maxMove) maxMove = d; }
  check('구체 상호작용 — 개체들이 상호 중력으로 움직인다(정적 아님)', maxMove > 1, `승격 후 최대 이동 ${maxMove.toFixed(2)} 셀 (>1=상호작용)`);
}

// ── 4. 역학 에너지 유계(symplectic) ──
{
  const w = buildWorld(0.5);
  const H = { set: Sp.createActiveSet(N, BS), tracker: Ac.createActivityTracker(N, BS), entities: [] };
  for (let f = 0; f < 4; f++) { H.set.rebuildFromField(w.fields.energy); const mean = w.total('energy') / w.fields.energy.length; H.tracker.measure(w.fields.energy, H.set.origins(), { threshold: 0 }); const res = Hy.autoPromoteStable(w, H.tracker, { hold: 2, eps: Math.max(mean * 3, 1e-9) }); for (const e of res.entities) H.entities.push(e); En.stepEntities(H.entities, 0.2, { N }); }
  // 전부 승격된 뒤 N체 적분 — 역학E 유계.
  let emin = Infinity, emax = -Infinity;
  for (let f = 0; f < 100; f++) { En.applyEntityGravity(H.entities, 0.1, { G: 0.8, soft: 3 }); En.stepEntities(H.entities, 0.1, { N }); const e = mech(H.entities); if (e < emin) emin = e; if (e > emax) emax = e; }
  const drift = Math.abs(emax - emin) / Math.abs(emin || 1);
  check('역학 에너지 유계(symplectic) — ΣKE_cm + 쌍 퍼텐셜 발산 없음', isFinite(emin) && isFinite(emax) && drift < 0.5,
    `역학E [${emin.toFixed(2)},${emax.toFixed(2)}] 진폭/|E| ${(drift * 100).toFixed(1)}%`);
}

// ── 5. 결정론 ──
{
  function fp() { const { H } = run(0.5, 16, false); let h = 0; for (const e of H.entities) h = (h * 131 + Math.round(e.cx * 1e4) + Math.round(e.cy * 1e4)) >>> 0; return h; }
  check('결정론 — 같은 입력 → 같은 통합 시뮬 결과 지문', fp() === fp(), `0x${(fp() >>> 0).toString(16)}`);
}

console.log('\n=== step_0035 수치 검증: 복셀 별들이 구체로 승격되어 서로 상호작용(가스 사라짐) ===');
{
  const { trace } = run(0.5, 12, true);
  const fl = trace.filter((t, i) => i === 0 || i === 2 || t.f === 11);
  console.log('  [장면] ' + fl.map(t => `f${t.f}: 구체 ${t.n}·복셀 ${t.voxels}`).join(' → '));
}
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
