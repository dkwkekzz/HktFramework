// step_0058/verify.js — TW1 구름 저항: 굴러가다 멈춰 가파른 안식각(진짜 산 더미). 순수·독립·영구.
//
//   design/environment.md §3 TW1 — 0057 이 "구름 저항 없음"으로 남긴 한계를 메우는 새 엔진 법칙. 마찰(0057)이
//   *미끄럼*을 막아도 구체는 자유로이 굴러 비탈을 흘러내려 안식각이 완만했다(납작한 더미·10°). applyEntity-
//   RollingResistance 는 *구름 자체*에 저항(상대 구름 각속도 ω_rel 에 반대 토크 쌍)해 굴러가다 멈추게 한다 →
//   **가파른 안식각**(진짜 산·언덕). 토크 쌍이라 총 각운동량 정확 보존·운동량 불변·총E 보존(스핀 KE 는 internalE
//   에 lump·구름이 줄면 열로 재분류).
//   검증: ① 구름 감속(ω_rel↓) ② 보존(각운동량·운동량·총E) ③ 가파른 안식각(μ_r 유무 대조·핵심 페이오프)
//   ④ μ_r=0 항등(0057 불변=회귀0) ⑤ 결정론.
//   실행: node HTJ/steps/step_0058/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);

function ent(cx, cy, cz, mass, r, opts) {
  opts = opts || {};
  return { cx, cy, cz, mass, px: opts.px || 0, py: opts.py || 0, pz: opts.pz || 0,
    Lx: opts.Lx || 0, Ly: opts.Ly || 0, Lz: opts.Lz || 0, KEcm: 0, internalKE: 0,
    internalE: opts.internalE || 0, energy: 0, cells: 100, radius: r, temp: 0, peak: 1, anchored: !!opts.anchored };
}
const totP = (es) => [es.reduce((s, e) => s + e.px, 0), es.reduce((s, e) => s + e.py, 0), es.reduce((s, e) => s + e.pz, 0)];
function totL(es) {
  let Lx = 0, Ly = 0, Lz = 0;
  for (const e of es) { Lx += e.cy * e.pz - e.cz * e.py + (e.Lx || 0); Ly += e.cz * e.px - e.cx * e.pz + (e.Ly || 0); Lz += e.cx * e.py - e.cy * e.px + (e.Lz || 0); }
  return [Lx, Ly, Lz];
}
const totE = (es) => es.reduce((s, e) => { e.KEcm = e.mass > 1e-9 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0; return s + e.KEcm + e.internalE; }, 0);

// ── 1. 구름 감속 + 보존 — 접촉한 두 구가 반대로 돌면(상대 구름) 구름저항이 ω_rel 을 줄인다·정확 보존 ──
{
  const I = 0.4 * 10 * 4;                                  // ⅖mr², m=10 r=2
  // 겹친 두 구(법선 x)에 반대 스핀(z축) → 상대 구름. ΣL_spin = 0(반대).
  const a = ent(15, 16, 16, 10, 2, { Lz: 20 }), b = ent(18.5, 16, 16, 10, 2, { Lz: -20 });  // overlap 0.5·상대 구름
  const es = [a, b];
  const opt = { k: 20, muRoll: 1.0, cRoll: 2 };
  const wrel0 = Math.abs(a.Lz / I - b.Lz / I);
  const P0 = totP(es), L0 = totL(es), E0 = totE(es);
  let maxP = 0, maxL = 0;
  for (let s = 0; s < 2000; s++) {
    En.applyEntityRollingResistance(es, 0.02, opt);
    const P = totP(es); maxP = Math.max(maxP, Math.hypot(P[0] - P0[0], P[1] - P0[1], P[2] - P0[2]));
    const L = totL(es); maxL = Math.max(maxL, Math.hypot(L[0] - L0[0], L[1] - L0[1], L[2] - L0[2]));
  }
  const wrel1 = Math.abs(a.Lz / I - b.Lz / I);
  check('구름 감속 — 상대 구름 각속도 ω_rel 이 구름저항으로 줄어 멈춘다',
    wrel1 < wrel0 * 0.1, `ω_rel ${wrel0.toFixed(2)}→${wrel1.toFixed(3)}(→0=멈춤)`);
  check('보존 — 총 각운동량(토크 쌍)·운동량(불변)·총E 정확',
    maxP < 1e-9 && maxL < 1e-6 && relOk(totE(es), E0, 1e-9 * Math.abs(E0) + 1e-9),
    `max|ΔΣP| ${maxP.toExponential(1)} · max|ΔΣL| ${maxL.toExponential(1)} · 총E ${E0.toFixed(3)}→${totE(es).toFixed(3)}(불변)`);
}

// ── 2. 가파른 안식각(핵심 페이오프) — 구름저항 있으면 더미가 가팔라진다(진짜 산) ──
{
  // 큰 평평 바닥(앵커)에 구체를 쏟아 더미를 쌓는다. 구름저항 없으면 굴러 퍼져 완만, 있으면 가파른 산.
  const R = 200, sr = 1.0, gold = Math.PI * (3 - Math.sqrt(5));
  function pileAngle(muRoll) {
    const es = [ent(0, 0, 0, 1e9, R, { anchored: true })];
    for (let i = 0; i < 160; i++) { const rr = Math.sqrt(i / 160) * 5, th = gold * i; es.push(ent(Math.cos(th) * rr, Math.sin(th) * rr, R + 4 + i * 0.4, 1, sr)); }
    const g = es[0], gopt = { G: 0.3 * R * R / 1e9, soft: 3 }, copt = { k: 20, cDamp: 18 }, fopt = { k: 20, mu: 0.9 }, ropt = { k: 20, muRoll };
    for (let s = 0; s < 6000; s++) {
      En.applyEntityGravity(es, 0.02, gopt); En.applyEntityContact(es, 0.02, copt);
      En.applyEntityFriction(es, 0.02, fopt); En.applyEntityRollingResistance(es, 0.02, ropt);
      En.stepEntities(es, 0.02);
      g.cx = g.cy = g.cz = 0; g.px = g.py = g.pz = 0; g.Lx = g.Ly = g.Lz = 0;
    }
    const sm = es.slice(1);
    const h = Math.max(...sm.map(e => Math.hypot(e.cx, e.cy, e.cz) - R));
    const rms = Math.sqrt(sm.reduce((s, e) => s + e.cx * e.cx + e.cy * e.cy, 0) / sm.length);
    return Math.atan2(h, rms) * 180 / Math.PI;
  }
  const angFree = pileAngle(0), angRoll = pileAngle(1.0);
  check('가파른 안식각 — 구름저항으로 더미가 가팔라진다(굴러 안 퍼짐·진짜 산)',
    angRoll > angFree * 1.8 && angRoll > 18,
    `안식각 구름저항X ${angFree.toFixed(1)}°(완만·퍼짐) → 구름저항O ${angRoll.toFixed(1)}°(가파름·산)`);
}

// ── 3. μ_r=0 항등 + 안전 — 0057 거동 불변(회귀0)·안 겹침·빈/단일 ──
{
  const a = ent(15, 16, 16, 100, 2, { Lz: 5000, px: 3 });
  const before = JSON.stringify(a);
  En.applyEntityRollingResistance([a, ent(18.5, 16, 16, 100, 2, { Lz: -5000 })], 0.02, { k: 20, muRoll: 0 });
  const noopOk = JSON.stringify(a) === before;
  const emptyOk = En.applyEntityRollingResistance([], 0.02, { k: 20, muRoll: 1 }).length === 0;
  const singleOk = En.applyEntityRollingResistance([ent(16, 16, 16, 100, 2, { Lz: 9 })], 0.02, { k: 20, muRoll: 1 }).length === 1;
  const far = [ent(12, 16, 16, 100, 2, { Lz: 5000 }), ent(20, 16, 16, 100, 2, { Lz: -5000 })];
  const farBefore = JSON.stringify(far);
  En.applyEntityRollingResistance(far, 0.02, { k: 20, muRoll: 1 });
  const farOk = JSON.stringify(far) === farBefore;
  check('μ_r=0 항등 + 안전 — 0057 거동 불변(회귀0)·안 겹침·빈/단일 무변화',
    noopOk && emptyOk && singleOk && farOk,
    `μ_r0 ${noopOk ? '불변' : 'X'} · 안 겹침 ${farOk ? '불변' : 'X'} · 빈/단일 ${emptyOk && singleOk ? 'OK' : 'X'}`);
}

// ── 4. 결정론 ──
{
  function fp() {
    const es = [ent(15, 16, 16, 100, 2, { Lz: 3000, Lx: 500 }), ent(18.4, 16, 16, 100, 2, { Lz: -2000, Ly: 800 }), ent(16.7, 18.5, 16, 100, 2, { Lz: 1000 })];
    for (let s = 0; s < 300; s++) En.applyEntityRollingResistance(es, 0.02, { k: 20, muRoll: 1 });
    let h = es.length >>> 0;
    for (const e of es) h = (Math.imul(h, 131) + Math.round((e.Lz || 0) * 1e2) + Math.round((e.Lx || 0) * 1e2)) >>> 0;
    return h >>> 0;
  }
  const a = fp(), b = fp();
  check('결정론 — 같은 입력 → 같은 구름저항 결과 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0058 수치 검증: TW1 구름 저항 — 굴러가다 멈춰 가파른 안식각(진짜 산 더미) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
