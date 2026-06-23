// step_0043/verify.js — 강착 세계: 중력+소산 접촉+합치기를 한 세계로 조립한 창발 강착. 순수·독립·영구.
//
//   design/sphere-world.md §6 SW1·SW2 / §0 — "구체는 합쳐져 더 큰 구체가 된다". 가진 부품(중력 0028 +
//   접촉 반발·소산 0037 + 합치기 0036)을 *한 세계*에서 함께 굴리면 작은 구체 구름이 무너지며 충돌·소산으로
//   식고, 느려진 접촉이 합쳐져 *몇 개의 큰 천체로 강착*한다(미행성→행성). 새 엔진 법칙 없음 — 0035 "새 engine
//   없음" 선례와 동형(이미 가진 법칙의 *조립*이 곧 창발 무대). 그동안 "공이 겹쳐 비비기만" 한 까닭은 합치기·
//   접촉·중력이 *한 장면에 같이 돈 적이 없어서* — 이 step 이 그 공백을 메운다.
//
//   검증 대상:
//     1. 강착(N↓) — 40개 구름이 소산 접촉으로 식어 합쳐져 개체 수가 크게 준다.
//     2. 질량·운동량 정확 보존 — merge·contact·gravity 모두 쌍 보존(합산/뉴턴3) → 총 M·ΣP 기계 정밀도 불변.
//     3. 소산 = 시간의 화살 — internalE 단조↑(접촉 감쇠 dissip≥0 + 강착열 ≥0·비가역). 낙하E → 열.
//     4. 대조: 소산 없으면 현상 없음 — 중력만(접촉·merge 없음)이면 N 불변·내부E 불변(충돌 없는 진동).
//     5. 한 점 안 됨 — 각운동량 있는 강착은 한 덩어리가 아니라 *몇 천체*로 정착(N≥2·궤도).
//     6. 결정론.
//
//   실행: node HTJ/steps/step_0043/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) + 1e-9 * Math.abs(b);
const eqR = (n) => En.equivalentRadius(n);

// 결정론적 가스 구름 — 약한 접선 속도(각운동량)로 한 점 붕괴 대신 궤도 천체를 만든다.
function cloud() {
  let s = 11; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const e = [];
  for (let i = 0; i < 40; i++) {
    const cells = 6, m = cells * 4, dx = (r() - 0.5) * 18, dy = (r() - 0.5) * 18, dz = (r() - 0.5) * 18, tang = 0.04;
    e.push({ cx: 24 + dx, cy: 24 + dy, cz: 24 + dz, mass: m, px: m * -tang * dy, py: m * tang * dx, pz: 0,
      Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalE: cells * 0.5, energy: cells * 0.5, cells, radius: eqR(cells), temp: 0, peak: 1 });
  }
  return e;
}
const sumP = (es) => { let x = 0, y = 0, z = 0; for (const p of es) { x += p.px; y += p.py; z += p.pz; } return [x, y, z]; };
const sumM = (es) => es.reduce((s, p) => s + p.mass, 0);
const sumU = (es) => es.reduce((s, p) => s + p.internalE, 0);

const DT = 0.1, STEPS = 800;
const GOPT = { G: 0.5, soft: 4 }, COPT = { stiffness: 4, damping: 25, pad: 0.3 }, MOPT = { vstick: 3.0, pad: 0.6 };

// 강착 세계 한 바퀴: 중력 → 접촉(반발+소산) → 적분 → 합치기. 단조 소산 추적.
function runAccretion(steps) {
  let e = cloud();
  let Uprev = sumU(e), monoU = true;
  for (let t = 0; t < steps; t++) {
    En.applyEntityGravity(e, DT, GOPT);
    En.applyEntityContact(e, DT, COPT);
    En.stepEntities(e, DT, { N: 48 });
    e = En.mergeEntities(e, MOPT).entities;
    const u = sumU(e); if (u < Uprev - 1e-6) monoU = false; Uprev = u;
  }
  return { e, monoU };
}

// ── 1. 강착(N↓) — 40개 구름이 합쳐져 개체 수가 크게 준다 ──
let accreted;
{
  accreted = runAccretion(STEPS);
  const n = accreted.e.length;
  check('강착 — 40개 구름이 소산·합치기로 몇 천체로 줄어든다(N↓)',
    n < 12 && n >= 2, `개체 40 → ${n}(크게 줆·강착)`);
}

// ── 2. 질량·운동량 정확 보존 ──
{
  const e0 = cloud(); const M0 = sumM(e0), P0 = sumP(e0);
  const M1 = sumM(accreted.e), P1 = sumP(accreted.e);
  check('질량·운동량 정확 보존 — merge·contact·gravity 모두 쌍 보존(합산/뉴턴3)',
    relOk(M0, M1, 1e-9) && relOk(P0[0], P1[0], 1e-6) && relOk(P0[1], P1[1], 1e-6) && relOk(P0[2], P1[2], 1e-6),
    `M ${M0.toFixed(1)}→${M1.toFixed(1)} · ΣP (${P0[0].toFixed(2)},${P0[1].toFixed(2)})→(${P1[0].toFixed(2)},${P1[1].toFixed(2)})`);
}

// ── 3. 소산 = 시간의 화살 — internalE 단조↑(접촉 감쇠 + 강착열·비가역) ──
{
  const U0 = sumU(cloud()), U1 = sumU(accreted.e);
  check('소산 = 시간의 화살 — internalE 단조↑(낙하E → 접촉 감쇠+강착열·비가역)',
    accreted.monoU && U1 > U0 * 2, `내부E ${U0.toFixed(0)} → ${U1.toFixed(0)}(단조↑·소산+강착열)`);
}

// ── 4. 대조: 소산 없으면 현상 없음 — 중력만(접촉·merge 없음)이면 N·내부E 불변 ──
{
  let e = cloud(); const U0 = sumU(e), n0 = e.length;
  for (let t = 0; t < STEPS; t++) { En.applyEntityGravity(e, DT, GOPT); En.stepEntities(e, DT, { N: 48 }); }   // 중력만(충돌 없음)
  const U1 = sumU(e), n1 = e.length;
  check('대조: 소산 없으면 현상 없음 — 중력만이면 N 불변·내부E 불변(충돌 없는 진동)',
    n1 === n0 && relOk(U0, U1, 1e-9) && accreted.e.length < n1,
    `중력만 N ${n0}→${n1}·U ${U1.toFixed(0)}(불변) vs 강착 N→${accreted.e.length}·소산 발생`);
}

// ── 5. 한 점 안 됨 — 각운동량 있는 강착은 몇 천체로 정착(N≥2·궤도) ──
{
  check('한 점 안 됨 — 각운동량 있는 강착은 한 덩어리 아닌 몇 천체로 정착(N≥2)',
    accreted.e.length >= 2, `정착 천체 ${accreted.e.length}개(≥2·궤도·design §0 "더 큰 구체"들)`);
}

// ── 6. 결정론 — 같은 입력 → 같은 강착 결과 지문 ──
{
  function fnv(es) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    push(es.length); for (const p of es) { push(p.cx); push(p.cy); push(p.cz); push(p.mass); push(p.internalE); }
    return h >>> 0;
  }
  const a = fnv(runAccretion(200).e), b = fnv(runAccretion(200).e);
  check('결정론 — 같은 입력 → 같은 강착 결과 지문', a === b, `0x${a.toString(16)}`);
}

// ── 결과 출력 ──
let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — 강착 세계: 중력+소산 접촉+합치기 조립 → 40개 구름이 몇 천체로 강착(N↓·M·ΣP 보존·소산 단조↑)' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);
