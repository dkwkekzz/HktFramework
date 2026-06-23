// step_0057/verify.js — TW1 마찰: 접촉의 접선 저항(Coulomb 마찰 + 구름). 순수·독립·영구.
//
//   design/environment.md §3 TW1 — 0056 이 드러낸 격차("마찰 없는 법선 접촉이라 경사면서 못 서고 골로 미끄러짐")
//   를 메우는 새 엔진 법칙. applyEntityFriction: 접촉(0037)의 *법선* 반발/감쇠가 못 막는 **접선 상대 운동**에
//   저항한다. Coulomb |F_t|≤μ·F_n. 올바른 마찰은 *접촉점*에 작용해 스핀(구름)으로 각운동량을 넘긴다(중심 접선력
//   은 각운동량을 깬다) — 단일 접촉점으로 양 개체 지렛대를 맞춰 **각운동량 정확 보존**.
//   검증: ① 접선 미끄럼 소산(슬립→구름·KE→internalE) ② Coulomb 상한 ③ 경사면 그립(μ 유무 대조) ④ 보존(운동량·
//   각운동량·총E) ⑤ μ=0 항등(0037 불변=회귀0) ⑥ 결정론.
//   실행: node HTJ/steps/step_0057/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);

function ent(cx, cy, cz, mass, px, py, pz, r, opts) {
  opts = opts || {};
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  return { cx, cy, cz, mass, px, py, pz, Lx: opts.Lx || 0, Ly: opts.Ly || 0, Lz: opts.Lz || 0,
    KEcm, internalKE: 0, internalE: opts.internalE || 0, energy: KEcm + (opts.internalE || 0),
    cells: 100, radius: r, temp: 0, peak: 1, anchored: !!opts.anchored };
}
const totP = (es) => [es.reduce((s, e) => s + e.px, 0), es.reduce((s, e) => s + e.py, 0), es.reduce((s, e) => s + e.pz, 0)];
const totE = (es) => es.reduce((s, e) => s + e.energy, 0);
// 원점 기준 총 각운동량 = Σ r×p(궤도) + Σ L(스핀).
function totL(es) {
  let Lx = 0, Ly = 0, Lz = 0;
  for (const e of es) {
    Lx += e.cy * e.pz - e.cz * e.py + (e.Lx || 0);
    Ly += e.cz * e.px - e.cx * e.pz + (e.Ly || 0);
    Lz += e.cx * e.py - e.cy * e.px + (e.Lz || 0);
  }
  return [Lx, Ly, Lz];
}
const spinMag = (e) => Math.hypot(e.Lx || 0, e.Ly || 0, e.Lz || 0);

// ── 1. 접선 미끄럼 소산 — 미끄러지는 두 구체가 마찰로 슬립을 잃고 구른다(KE→internalE)·보존 ──
{
  // 겹친 두 구체(법선=y)에 접선(x) 반대 속도 → 접촉면서 미끄러진다. ΣP=0. 마찰만(중력·반발 적분 없음).
  const a = ent(15, 16, 16, 100, 200, 0, 0, 2), b = ent(15, 18.5, 16, 100, -200, 0, 0, 2);  // overlap 1.5
  const es = [a, b];
  const opt = { k: 12, mu: 0.6 };
  const P0 = totP(es), E0 = totE(es), L0 = totL(es);
  // 접촉점 표면 슬립 속도(스핀 포함) — 초기엔 스핀 0 → |v_rel_t|=4.
  const slip = () => {
    const Ia = 0.4 * a.mass * 4, Ib = 0.4 * b.mass * 4, ov = 4 - Math.abs(b.cy - a.cy), la = 2 - ov / 2, lb = -(2 - ov / 2);
    const vax = a.px / a.mass + ((a.Ly / Ia) * 0 - (a.Lz / Ia) * la);   // ω×(la·ŷ) 의 x 성분 = -ωz·la
    const vbx = b.px / b.mass + ((b.Ly / Ib) * 0 - (b.Lz / Ib) * lb);
    return Math.abs(vbx - vax);
  };
  const slip0 = slip();
  let maxP = 0, maxL = 0;
  for (let s = 0; s < 1500; s++) {
    En.applyEntityFriction(es, 0.02, opt);
    const P = totP(es); maxP = Math.max(maxP, Math.hypot(P[0] - P0[0], P[1] - P0[1], P[2] - P0[2]));
    const L = totL(es); maxL = Math.max(maxL, Math.hypot(L[0] - L0[0], L[1] - L0[1], L[2] - L0[2]));
  }
  const slip1 = slip(), spunUp = spinMag(a) > 1 && spinMag(b) > 1;
  check('접선 미끄럼 소산 — 슬립이 마찰로 줄어 구른다(스핀↑)·KE→internalE',
    slip1 < slip0 * 0.2 && spunUp && es.reduce((s, e) => s + e.internalE, 0) > 1,
    `슬립 ${slip0.toFixed(2)}→${slip1.toFixed(3)}(→0=구름) · 스핀 |L| a=${spinMag(a).toFixed(1)} b=${spinMag(b).toFixed(1)}(0→유도) · internalE ${es.reduce((s, e) => s + e.internalE, 0).toFixed(1)}`);
  check('보존(미끄럼) — 운동량·각운동량(접촉점 단일화)·총E 정확',
    maxP < 1e-9 && maxL < 1e-7 && relOk(totE(es), E0, 1e-6 * Math.abs(E0)),
    `max|ΔΣP| ${maxP.toExponential(1)} · max|ΔΣL| ${maxL.toExponential(1)} · 총E ${E0.toFixed(1)}→${totE(es).toFixed(1)}(보존)`);
}

// ── 2. Coulomb 상한 — 접선 임펄스 ≤ μ·F_n, 슬립 크고 F_n 작으면 정확히 μ·F_n 으로 잘림 ──
{
  // 작은 overlap(작은 F_n) + 큰 슬립 → 점성·정지 임펄스보다 Coulomb 상한이 작아 J=μ·F_n·dt.
  const a = ent(15, 16, 16, 100, 1000, 0, 0, 2), b = ent(15, 19.8, 16, 100, -1000, 0, 0, 2);  // overlap 0.2(작음)
  const es = [a, b], k = 12, mu = 0.5, dt = 0.001;
  const pax0 = a.px;
  En.applyEntityFriction(es, dt, { k, mu, cTan: 1e9 });   // cTan 과대 → 점성 항 안 걸리고 Coulomb 가 상한
  const Fn = k * 0.2, Jexpect = mu * Fn * dt, Jactual = Math.abs(a.px - pax0);
  check('Coulomb 상한 — 슬립 크고 F_n 작으면 접선 임펄스 = μ·F_n·dt 로 잘림',
    relOk(Jactual, Jexpect, 1e-9), `J 실제 ${Jactual.toExponential(3)} = μ·F_n·dt ${Jexpect.toExponential(3)}`);
}

// ── 3. 안식각(딛는 표면의 진짜 효과) — 마찰 있으면 더미로 쌓이고(좁게 머묾), 없으면 액체처럼 퍼진다 ──
{
  // 강체 구는 경사에 *못 선다*(늘 구름) — 마찰의 진짜 효과는 안식각: 마찰 없으면 퍼지고, 있으면 쌓인다.
  // 큰 앵커(지면) 꼭대기에 작은 구체들을 가깝게 떨궈 더미를 만든다. μ=0 → 미끄러져 넓게 퍼짐·μ>0 → 더미로 머묾.
  const R = 50, sr = 1.0, gold = Math.PI * (3 - Math.sqrt(5));    // 큰 앵커 → 꼭대기 국소 평평(쌓일 바닥)
  function runPile(mu) {
    const ground = ent(0, 0, 0, 1e7, 0, 0, 0, R, { anchored: true });
    const es = [ground];
    for (let i = 0; i < 24; i++) {                                // 꼭대기에 좁은 기둥으로 떨궈 쌓는다
      const rr = Math.sqrt(i / 24) * 2.2, th = gold * i;          // 수평 반경 ≤2.2(좁게)
      es.push(ent(Math.cos(th) * rr, Math.sin(th) * rr, R + 3 + i * 0.9, 50, 0, 0, 0, sr));
    }
    const gopt = { G: 5e-6, soft: 2 }, copt = { k: 25, cDamp: 22 }, fopt = { k: 25, mu };
    for (let s = 0; s < 6000; s++) {
      En.applyEntityGravity(es, 0.02, gopt); En.applyEntityContact(es, 0.02, copt);
      En.applyEntityFriction(es, 0.02, fopt); En.stepEntities(es, 0.02);
      ground.cx = ground.cy = ground.cz = 0; ground.px = ground.py = ground.pz = 0; ground.Lx = ground.Ly = ground.Lz = 0;
    }
    // 퍼짐 = 최종 수평 반경 √(x²+y²) 의 RMS(작을수록 더미로 뭉침·크면 팬케이크로 퍼짐).
    const sm = es.slice(1);
    return Math.sqrt(sm.reduce((s, e) => s + e.cx * e.cx + e.cy * e.cy, 0) / sm.length);
  }
  const spreadFree = runPile(0), spreadGrip = runPile(0.9);
  check('안식각 — 마찰 있으면 더미로 쌓여 좁게 머물고·없으면 액체처럼 퍼진다',
    spreadGrip < spreadFree * 0.7,
    `퍼짐(수평 반경 RMS) 마찰X ${spreadFree.toFixed(2)}(퍼짐) · 마찰O ${spreadGrip.toFixed(2)}(더미·${(spreadGrip / spreadFree * 100).toFixed(0)}%)`);
}

// ── 4. μ=0 항등 + 안전 — 0037 거동 불변(회귀 0)·빈/단일 ──
{
  const a = ent(15, 16, 16, 100, 5, -3, 2, 2, { internalE: 7 });
  const before = JSON.stringify(a);
  En.applyEntityFriction([a, ent(15, 18.5, 16, 100, 0, 0, 0, 2)], 0.02, { k: 12, mu: 0 });  // μ=0 → early-return
  const noopOk = JSON.stringify(a) === before;
  const emptyOk = En.applyEntityFriction([], 0.02, { k: 12, mu: 0.5 }).length === 0;
  const singleOk = En.applyEntityFriction([ent(16, 16, 16, 100, 1, 0, 0, 2)], 0.02, { k: 12, mu: 0.5 }).length === 1;
  // 안 겹침(거리>r+r) → 무변화.
  const far = [ent(12, 16, 16, 100, 3, 0, 0, 2), ent(20, 16, 16, 100, -3, 0, 0, 2)];
  const farBefore = JSON.stringify(far);
  En.applyEntityFriction(far, 0.02, { k: 12, mu: 0.5 });
  const farOk = JSON.stringify(far) === farBefore;
  check('μ=0 항등 + 안전 — 0037 거동 불변(회귀0)·안 겹침·빈/단일 무변화',
    noopOk && emptyOk && singleOk && farOk,
    `μ0 ${noopOk ? '불변' : 'X'} · 안 겹침 ${farOk ? '불변' : 'X'} · 빈/단일 ${emptyOk && singleOk ? 'OK' : 'X'}`);
}

// ── 5. 결정론 ──
{
  function fp() {
    const es = [ent(15, 16, 16, 100, 150, 20, 0, 2), ent(15, 18.6, 16, 100, -120, -10, 0, 2), ent(15.5, 17.3, 17, 100, 30, -40, 10, 2)];
    for (let s = 0; s < 200; s++) { En.applyEntityFriction(es, 0.02, { k: 12, mu: 0.5 }); En.stepEntities(es, 0.02); }
    let h = es.length >>> 0;
    for (const e of es) h = (Math.imul(h, 131) + Math.round(e.cx * 1e4) + Math.round(e.px * 1e2) + Math.round((e.Lz || 0) * 1e2)) >>> 0;
    return h >>> 0;
  }
  const a = fp(), b = fp();
  check('결정론 — 같은 입력 → 같은 마찰 결과 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0057 수치 검증: TW1 마찰 — 접촉의 접선 저항(Coulomb + 구름) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
