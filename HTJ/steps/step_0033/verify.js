// step_0033/verify.js — S6(둘째 단위): 통합 중력 배선(개체↔유체 결합·트리). 순수·독립·영구.
//
//   design §3·§4 S6. 0028(개체끼리)·격자 Poisson(유체끼리)이 둘 다 놓친 *개체↔유체* 결합 중력을 0032
//   트리로 채운다 = 레버2 완전 실현(0030 dense gravity 천장 해소). applyUnifiedGravity: 개체는 트리로
//   모든 몸체(개체+유체 블록)의 중력을 받고, 유체 셀은 개체들의 중력을 직접 받아 격자 운동량 가속.
//
//   검증 대상:
//     1. 개체가 유체를 느낀다 — 무거운 유체 덩어리 옆 개체가 그쪽으로 가속(직진→끌림).
//     2. 유체가 개체를 느낀다 — 무거운 개체 옆 유체 셀이 그쪽으로 운동량을 얻는다.
//     3. 작용-반작용(개체↔유체) — 개체와 유체의 운동량 교환이 ≈ 상쇄(순 운동량 작게 변함).
//     4. 빈 입력 안전 — 개체 0개면 격자 불변·NaN 없음.
//     5. 개체 없으면 유체 가속 0 — 결합은 개체 있을 때만.
//     6. 회귀 0 — 가법(신규 함수)·기존 격자/개체 법칙 불변·결정론.
//
//   실행: node HTJ/steps/step_0033/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Hy = require(path.resolve(__dirname, '../../engine/htj-hybrid.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const N = 24;
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
function newWorld() { const w = W.createWorld(N); w.addField('therm'); for (const nm of ['mom_x', 'mom_y', 'mom_z']) w.addField(nm, { type: Float64Array }); return w; }
function gridMom(w) { return [sum(w.fields.mom_x), sum(w.fields.mom_y), sum(w.fields.mom_z)]; }
function ent(cx, cy, cz, mass) { return { cx, cy, cz, mass, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalE: 10, energy: 10, radius: 2, temp: 1, peak: 1, cells: 30 }; }
function seedBall(w, cx, cy, cz, rad, rho0) { let cells = 0; for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = x - cx, dy = y - cy, dz = z - cz; if (dx * dx + dy * dy + dz * dz <= rad * rad) { w.fields.energy[(z * N + y) * N + x] = rho0; cells++; } } return cells; }

// ── 1. 개체가 유체를 느낀다 ──
{
  const w = newWorld();
  seedBall(w, 18, 12, 12, 3, 20);                 // 무거운 유체 덩어리(오른쪽)
  const es = [ent(5, 12, 12, 50)];                // 개체(왼쪽·정지)
  Hy.applyUnifiedGravity(w, es, { G: 1, soft: 1, theta: 0.4, dt: 0.1 });
  // 개체가 +x(유체 쪽)로 운동량을 얻어야.
  const ok = es[0].px > 0 && Math.abs(es[0].py) < 1e-9 && Math.abs(es[0].pz) < 1e-9;
  check('개체가 유체를 느낀다 — 무거운 유체 덩어리 쪽으로 개체 가속', ok, `개체 px ${es[0].px.toFixed(4)} (+x=유체 쪽) · py,pz≈0`);
}

// ── 2. 유체가 개체를 느낀다 ──
{
  const w = newWorld();
  seedBall(w, 5, 12, 12, 3, 5);                   // 유체 덩어리(왼쪽)
  const es = [ent(18, 12, 12, 200)];              // 무거운 개체(오른쪽)
  const p0 = gridMom(w);
  Hy.applyUnifiedGravity(w, es, { G: 1, soft: 1, theta: 0.4, dt: 0.1 });
  const p1 = gridMom(w);
  // 유체 운동량이 +x(개체 쪽)로 증가.
  const ok = p1[0] > p0[0] + 1e-6 && Math.abs(p1[1] - p0[1]) < 1e-6;
  check('유체가 개체를 느낀다 — 무거운 개체 쪽으로 유체 운동량 증가', ok, `유체 Σmom_x ${p0[0].toFixed(3)} → ${p1[0].toFixed(3)} (+x=개체 쪽)`);
}

// ── 3. 작용-반작용 — 개체↔유체 운동량 교환 ≈ 상쇄 ──
let momInfo = '';
{
  const w = newWorld();
  seedBall(w, 6, 12, 12, 3, 8);
  const es = [ent(18, 12, 12, 120)];
  const total0 = gridMom(w)[0] + es[0].px;        // 개체 px 초기 0
  Hy.applyUnifiedGravity(w, es, { G: 1, soft: 1.5, theta: 0.3, dt: 0.1 });
  const total1 = gridMom(w)[0] + es[0].px;
  // 개체 +x·유체 -x (서로 끌림) → 합 ≈ 보존(트리/응집 근사라 작은 표류).
  const scale = Math.abs(es[0].px) + Math.abs(gridMom(w)[0]) + 1e-9;
  const drift = Math.abs(total1 - total0) / scale;
  momInfo = `개체 px ${es[0].px.toFixed(3)}(−x=유체 쪽)·유체 Σmom_x ${gridMom(w)[0].toFixed(3)}(+x=개체 쪽) → Σ ${total0.toFixed(4)}→${total1.toFixed(4)} (표류 ${(drift * 100).toFixed(2)}%)`;
  // 개체(x=18)는 유체(x=6) 쪽 −x 로, 유체는 개체 쪽 +x 로 끌림(작용-반작용) → 합 ≈ 보존.
  check('작용-반작용(개체↔유체) — 운동량 교환 ≈ 상쇄(순 운동량 작게 변함)', drift < 0.05 && es[0].px < 0 && gridMom(w)[0] > 0, momInfo);
}

// ── 4. 빈 입력 안전 — 개체 0개 ──
{
  const w = newWorld();
  seedBall(w, 12, 12, 12, 3, 5);
  const fp0 = w.fingerprint('energy') ^ w.fingerprint('mom_x');
  Hy.applyUnifiedGravity(w, [], { G: 1, soft: 1, dt: 0.1 });
  const fp1 = w.fingerprint('energy') ^ w.fingerprint('mom_x');
  check('빈 입력 안전 — 개체 0개면 격자 불변·NaN 없음', fp0 === fp1, `격자 지문 ${fp0 === fp1 ? '불변' : '변함'}`);
}

// ── 5. 개체 없으면 유체 가속 0(결합은 개체 있을 때만) ── (4 의 강화 — mom 전부 0 유지)
{
  const w = newWorld();
  seedBall(w, 12, 12, 12, 3, 5);
  Hy.applyUnifiedGravity(w, [], { G: 1, soft: 1, dt: 0.1 });
  const p = gridMom(w);
  check('개체 없으면 유체 가속 0 — 결합 중력은 개체 있을 때만', Math.abs(p[0]) < 1e-12 && Math.abs(p[1]) < 1e-12, `유체 Σmom (${p[0].toExponential(1)},${p[1].toExponential(1)})`);
}

// ── 6. 결정론 ──
{
  function run() { const w = newWorld(); seedBall(w, 6, 12, 12, 3, 8); const es = [ent(18, 12, 12, 120), ent(12, 6, 12, 80)]; Hy.applyUnifiedGravity(w, es, { G: 1, soft: 1.5, theta: 0.4, dt: 0.1 }); let h = w.fingerprint('mom_x') >>> 0; for (const e of es) h = (h * 131 + Math.round(e.px * 1e6) + Math.round(e.py * 1e6)) >>> 0; return h; }
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 통합 중력 결과 지문', a === b, `0x${(a >>> 0).toString(16)}`);
}

console.log('\n=== step_0033 수치 검증: S6(둘째 단위) 통합 중력 배선(개체↔유체 결합·트리) ===');
console.log(`  [정보용] 0028 개체끼리·격자 Poisson 유체끼리가 놓친 개체↔유체 결합을 채움 = 레버2 완전 실현 · ${momInfo}`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
