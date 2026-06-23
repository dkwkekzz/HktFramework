// step_0044/verify.js — 강착↔파편 왕복 세계: 임계가 합침/깨짐을 가른다. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW3·§4 — "상대 속도가 임계를 넘으면 깨지고, 못 넘으면 붙는다 — author 하지
//   않고 임계가 가른다". 강착 세계(0043: 중력+소산 접촉+합치기)에 쪼개기(0038 fragmentOnImpact)를 더해
//   *한 세계*에서 왕복을 완성한다: advance 한 바퀴 = gravity → contact → step → **fragment(빠름→파편)** →
//   **merge(느림→합침)**. 빠른 충돌은 천체를 부수고, 느린 접촉은 합친다. 새 엔진 법칙 없음(0043 처럼 조립).
//   임계 분리(파편 분산 속도 > vstick)라야 *깨자마자 재합침(flicker)* 없이 왕복이 닫힌다.
//
//   검증 대상:
//     1. 임계가 가른다 — 같은 코드 경로(frag→merge), 느린 쌍은 합쳐(N↓)·빠른 쌍은 깨짐(N↑). 속도만 갈림.
//     2. 왕복 보존 — 고속 충돌→파편→정착 동안 질량·운동량 정확 보존(frag·merge·contact·gravity 쌍 보존).
//     3. 포섭(항등) — shatterKE=∞(절대 안 깸)면 0043 강착(merge-only)과 동일. 쪼개기 추가는 보수적 확장.
//     4. 재강착 왕복 — 고속 충돌체가 천체를 부숨(N 폭발↑) → 파편이 중력+소산으로 다시 합침(N↓). 비단조.
//     5. 안전·flicker 없음 — 느린 2체는 안 깸(shatter 0)·깬 파편은 분산>vstick 라 같은 루프 재합침 안 함.
//     6. 결정론.
//
//   실행: node HTJ/steps/step_0044/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);
const eqR = (n) => En.equivalentRadius(n);

function body(cx, cy, cells, vx, vy, intE) {
  const m = cells * 4;
  return { cx, cy, cz: 24, mass: m, px: m * vx, py: m * vy, pz: 0, Lx: 0, Ly: 0, Lz: 0,
    KEcm: 0.5 * m * (vx * vx + vy * vy), internalE: intE, energy: 0, cells, radius: eqR(cells), temp: 0, peak: 1 };
}
const sumP = (es) => { let x = 0, y = 0, z = 0; for (const p of es) { x += p.px; y += p.py; z += p.pz; } return [x, y, z]; };
const sumM = (es) => es.reduce((s, p) => s + p.mass, 0);

// 결정/분리된 임계(시뮬 상수): vstick=1.2 / shatterKE=80 → 깸 속도 v=√(2·80/μ). 동일 질량(μ=m/2=80) 쌍이면
//   깸 속도 1.41 > vstick 1.2 → merge(<1.2)·bounce(1.2~1.41)·shatter(>1.41) 가 겹치지 않게 분리.
const VSTICK = 1.2, SHATTERKE = 80, NFRAG = 6, DISPF = 0.85;
const FOPT = { shatterKE: SHATTERKE, n: NFRAG, dispersalFrac: DISPF, spread: 1.3, pad: 0.4 };
const MOPT = { vstick: VSTICK, pad: 0.6 };

// ── 1. 임계가 가른다 — 느린 쌍은 합침·빠른 쌍은 깨짐(frag→merge 같은 경로) ──
{
  // 닿은 동일 질량 두 천체(internalE 충분 → 깨지면 파편 분산>vstick).
  function pair(vrel) { const d = 0.9; return [body(24 - d, 24, 40, vrel / 2, 0, 600), body(24 + d, 24, 40, -vrel / 2, 0, 600)]; }
  // 느림(접근 속도 0.6 < vstick) → 안 깸·합침: N 2→1.
  let slow = pair(0.6); slow = En.fragmentOnImpact(slow, FOPT).entities; slow = En.mergeEntities(slow, MOPT).entities;
  // 빠름(접근 6 → ½μv²=½·80·36=1440 ≥ 80) → 깸: N 2→여러.
  let fast = pair(6.0); const fr = En.fragmentOnImpact(fast, FOPT); fast = fr.entities; fast = En.mergeEntities(fast, MOPT).entities;
  check('임계가 가른다 — 느린 쌍은 합쳐(N↓)·빠른 쌍은 깨짐(N↑)·속도만 갈림',
    slow.length === 1 && fast.length > 2,
    `느림 N 2→${slow.length}(합침) · 빠름 N 2→${fast.length}(파편·shatter ${fr.shatters})`);
}

// ── 4·5 공유: 고속 충돌체가 뜨거운 천체를 부수고 파편이 재강착하는 한 장면 ──
function impactScene() {
  let s = 7; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const e = [body(26, 24, 80, 0, 0, 600), body(6, 24, 10, 5.5, 0, 3)];     // 뜨거운 천체 + 고속 충돌체
  for (let i = 0; i < 8; i++) { const dx = (r() - 0.5) * 10 + 6, dy = (r() - 0.5) * 22; e.push(body(24 + dx, 24 + dy, 6, -0.04 * dy, 0.02 * dx, 3)); }
  return e;
}
const DT = 0.08, GOPT = { G: 0.3, soft: 5 }, COPT = { stiffness: 5, damping: 10, pad: 0.3 };
function runImpact(steps) {
  let e = impactScene(); let maxN = e.length, minAfterPeak = e.length, peaked = false, totShat = 0;
  for (let t = 0; t < steps; t++) {
    En.applyEntityGravity(e, DT, GOPT); En.applyEntityContact(e, DT, COPT); En.stepEntities(e, DT, { N: 48 });
    const fr = En.fragmentOnImpact(e, FOPT); e = fr.entities; totShat += fr.shatters;
    e = En.mergeEntities(e, MOPT).entities;
    if (e.length > maxN) { maxN = e.length; peaked = true; minAfterPeak = e.length; }
    if (peaked && e.length < minAfterPeak) minAfterPeak = e.length;
  }
  return { e, maxN, minAfterPeak, totShat };
}

// ── 2. 왕복 보존 — 고속 충돌 장면 동안 질량·운동량 정확 보존 ──
{
  const e0 = impactScene(); const M0 = sumM(e0), P0 = sumP(e0);
  const r = runImpact(300); const M1 = sumM(r.e), P1 = sumP(r.e);
  check('왕복 보존 — frag·merge·contact·gravity 모두 쌍 보존 → 질량·운동량 정확 불변',
    relOk(M0, M1, 1e-6) && relOk(P0[0], P1[0], 1e-5) && relOk(P0[1], P1[1], 1e-5) && relOk(P0[2], P1[2], 1e-5),
    `M ${M0.toFixed(1)}→${M1.toFixed(1)} · ΣP (${P0[0].toFixed(2)},${P0[1].toFixed(2)})→(${P1[0].toFixed(2)},${P1[1].toFixed(2)})`);
}

// ── 3. 포섭(항등) — shatterKE=∞ 면 0043 강착(merge-only)과 동일 ──
{
  function cloud() {
    let s = 11; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const e = [];
    for (let i = 0; i < 40; i++) { const cells = 6, dx = (r() - 0.5) * 18, dy = (r() - 0.5) * 18, dz = (r() - 0.5) * 18, tang = 0.04;
      e.push(body(24 + dx, 24 + dy, cells, -tang * dy, tang * dx, cells * 0.5)); for (const p of e) p.cz = 24; e[e.length - 1].cz = 24 + dz; }
    return e;
  }
  const g = { G: 0.5, soft: 4 }, c = { stiffness: 4, damping: 25, pad: 0.3 }, m = { vstick: 3.0, pad: 0.6 };
  function runMergeOnly(steps) { let e = cloud(); for (let t = 0; t < steps; t++) { En.applyEntityGravity(e, 0.1, g); En.applyEntityContact(e, 0.1, c); En.stepEntities(e, 0.1, { N: 48 }); e = En.mergeEntities(e, m).entities; } return e.length; }
  function runWithFragInf(steps) { let e = cloud(); const fInf = { shatterKE: Infinity, n: NFRAG, dispersalFrac: DISPF }; for (let t = 0; t < steps; t++) { En.applyEntityGravity(e, 0.1, g); En.applyEntityContact(e, 0.1, c); En.stepEntities(e, 0.1, { N: 48 }); e = En.fragmentOnImpact(e, fInf).entities; e = En.mergeEntities(e, m).entities; } return e.length; }
  const a = runMergeOnly(400), b = runWithFragInf(400);
  check('포섭(항등) — shatterKE=∞ 면 0043 강착(merge-only)과 동일(쪼개기 추가=보수적 확장)',
    a === b && a < 12, `merge-only N→${a} = frag(∞) N→${b}(느린 세계는 안 깸)`);
}

// ── 4. 재강착 왕복 — 부숨(N 폭발↑) → 재강착(N↓) 비단조 ──
{
  const r = runImpact(260);
  check('재강착 왕복 — 고속 충돌체가 천체 부숨(N 폭발) → 파편 중력+소산으로 다시 합침(N↓)',
    r.maxN > 12 && r.e.length < r.maxN && r.totShat > 0,
    `N 시작 10 → 폭발 ${r.maxN} → 재강착 ${r.e.length}(비단조·shatter ${r.totShat})`);
}

// ── 5. 안전·flicker 없음 — 느린 2체는 안 깸·깬 파편은 분산>vstick 라 같은 루프 재합침 안 함 ──
{
  // (a) 느린 2체: shatter 0.
  let slow = [body(23.1, 24, 40, 0.3, 0, 600), body(24.9, 24, 40, -0.3, 0, 600)];
  const fr0 = En.fragmentOnImpact(slow, FOPT);
  // (b) 고속 2체 깸 직후 같은 루프 merge → 파편이 즉시 재합쳐 1개로 안 돌아감(분산>vstick).
  let fast = [body(23.1, 24, 40, 4, 0, 600), body(24.9, 24, 40, -4, 0, 600)];
  fast = En.fragmentOnImpact(fast, FOPT).entities; const afterFrag = fast.length; fast = En.mergeEntities(fast, MOPT).entities;
  check('안전·flicker 없음 — 느린 2체 안 깸(shatter 0)·깬 파편 분산>vstick 라 즉시 재합침 안 함',
    fr0.shatters === 0 && afterFrag > 2 && fast.length > 2,
    `느림 shatter ${fr0.shatters} · 깸 후 ${afterFrag}개 → merge 후 ${fast.length}개(>2·재합침 안 함)`);
}

// ── 6. 결정론 ──
{
  function fnv(es) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    push(es.length); for (const p of es) { push(p.cx); push(p.cy); push(p.mass); }
    return h >>> 0;
  }
  const a = fnv(runImpact(150).e), b = fnv(runImpact(150).e);
  check('결정론 — 같은 입력 → 같은 왕복 결과 지문', a === b, `0x${a.toString(16)}`);
}

// ── 결과 출력 ──
let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — 강착↔파편 왕복: 임계가 합침/깨짐을 가른다(느림→합침·빠름→파편·재강착·M·ΣP 보존)' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);
