// step_0053/verify.js — SW5 SPH 점화(핵융합 발열 source). 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — 0052 복사는 열의 *출구*(sink). 이 법칙은 열의 *입구*(source) = 점화 =
//   0004(임계 방출=별)·0003(potential→energy)의 SPH 판. u≥uCrit 이고 fuel>0 → burn=min(fuel,rate·m·dt)·
//   internalE += burn·fuel −= burn. 0052 복사와 짝지으면 발열↔복사 균형 → 별이 virial 정상상태에서 빛난다.
//   적정 검증: ① 점화 정의·임계(뜨거운 것만 발열) ② 연료↔열 보존(Σ(fuel+u)·질량/운동량/KE 불변) ③ 연료 고갈
//   (다 타면 멈춤·무한 발열 없음) ④ 점화↔복사 정상상태(발열↔복사 균형·runaway 도 cold 도 아닌 별) ⑤ 항등/안전 ⑥ 결정론.
//   실행: node HTJ/steps/step_0053/verify.js
'use strict';
const path = require('path');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) + 1e-9 * Math.abs(b);

function ent(mass, u, fuel, px) {
  px = px || 0;
  const KEcm = mass > 0 ? 0.5 * px * px / mass : 0;
  return { mass, px, py: 0, pz: 0, KEcm, internalE: u * mass, energy: KEcm + u * mass, fuel: fuel != null ? fuel : 0, density: 5 };
}
const clone = (ps) => ps.map(p => ({ ...p }));
const uOf = (p) => p.internalE / p.mass;
const sumFU = (ps) => ps.reduce((s, p) => s + p.internalE + p.fuel, 0);

// ── 1. 점화 정의·임계 — u≥uCrit & fuel>0 만 발열(internalE↑·fuel↓)·u<uCrit 무변화 ──
{
  const ps = [ent(1, 8, 50), ent(1, 2, 50), ent(1, 8, 0)];   // 뜨겁고연료·차갑고연료·뜨겁지만연료없음
  const u0 = ps.map(uOf), f0 = ps.map(p => p.fuel);
  for (let t = 0; t < 5; t++) SPH.sphIgnition(ps, 0.1, { rate: 2, uCrit: 5 });
  const hotBurned = uOf(ps[0]) > u0[0] && ps[0].fuel < f0[0];   // 뜨겁고 연료 있음 → 발열
  const coldNo = uOf(ps[1]) === u0[1] && ps[1].fuel === f0[1];  // 차가움 → 안 붙음
  const noFuelNo = uOf(ps[2]) === u0[2];                        // 연료 없음 → 안 붙음
  check('점화 정의·임계 — 뜨겁고(u≥uCrit) 연료 있는 입자만 발열', hotBurned && coldNo && noFuelNo,
    `뜨거움 u ${u0[0]}→${uOf(ps[0]).toFixed(2)}(연료↓) · 차가움 불변 ${coldNo} · 연료없음 불변 ${noFuelNo}`);
}

// ── 2. 연료↔열 보존 — Σ(fuel+internalE) 정확 보존·질량/운동량/KE 불변 ──
{
  const ps = [ent(2, 7, 30, 3), ent(1, 9, 40, -2), ent(1.5, 6, 20, 1)], before = clone(ps);
  const tot0 = sumFU(ps);
  for (let t = 0; t < 20; t++) SPH.sphIgnition(ps, 0.1, { rate: 1.5, uCrit: 5 });
  let mOk = true, pOk = true, keOk = true;
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].mass !== before[i].mass) mOk = false;
    if (ps[i].px !== before[i].px) pOk = false;
    if (ps[i].KEcm !== before[i].KEcm) keOk = false;
  }
  check('연료↔열 보존 — Σ(fuel+internalE) 정확·질량/운동량/KE 불변',
    relOk(sumFU(ps), tot0, 1e-9) && mOk && pOk && keOk,
    `Σ(fuel+u) ${tot0.toFixed(3)}→${sumFU(ps).toFixed(3)} · 질량 ${mOk}·운동량 ${pOk}·KE ${keOk}`);
}

// ── 3. 연료 고갈 — 유한 연료 다 타면 발열 멈춤(무한 발열 없음·0004 "별도 꺼진다") ──
{
  const ps = [ent(1, 8, 3)];                                   // 연료 3 만
  for (let t = 0; t < 100; t++) SPH.sphIgnition(ps, 0.1, { rate: 2, uCrit: 3 });
  const uAtBurnout = uOf(ps[0]);
  SPH.sphIgnition(ps, 0.1, { rate: 2, uCrit: 3 });             // 한 번 더 — 더는 안 늘어야
  check('연료 고갈 — 다 타면 멈춤(무한 발열 없음)', ps[0].fuel === 0 && uOf(ps[0]) === uAtBurnout,
    `연료 3→${ps[0].fuel.toFixed(4)} · 고갈 후 u ${uAtBurnout.toFixed(2)} 더 안 늘어남`);
}

// ── 4. 점화↔복사 정상상태 — 발열(이 법칙)↔복사(0052) 균형 → 별이 finite·stable·점화 유지(virial) ──
{
  const star = [ent(1, 8, 1e9)];                               // 충분한 연료
  const rate = 2, uCrit = 3, coolRate = 0.5, dt = 0.1;
  for (let t = 0; t < 400; t++) { SPH.sphIgnition(star, dt, { rate, uCrit }); SPH.sphRadiativeCooling(star, dt, { coolRate }); }
  const uA = uOf(star[0]);
  SPH.sphIgnition(star, dt, { rate, uCrit }); SPH.sphRadiativeCooling(star, dt, { coolRate });
  const uB = uOf(star[0]);
  const stable = Math.abs(uA - uB) < 1e-6;                     // 정착(두 스텝 거의 동일)
  const lit = uA > uCrit;                                      // 점화 유지(안 꺼짐)
  const finite = isFinite(uA) && uA < 100;                     // runaway 아님(0012 와 대조)
  const expected = rate * (1 - dt * coolRate) / coolRate;      // 이산 고정점 u* = rate(1−dt·c)/c
  check('점화↔복사 정상상태 — 발열↔복사 균형으로 별이 finite·stable·점화 유지',
    stable && lit && finite && relOk(uA, expected, 1e-3),
    `u_eq ${uA.toFixed(3)}(예측 ${expected.toFixed(3)}) · 안정 ${stable}·점화유지 ${lit}·runaway아님 ${finite}`);
}

// ── 5. 항등/안전 — rate=0→회귀0 · 차가우면 무변화 · 연료 없으면 무변화 · 빈 무탈 ──
{
  const ps = [ent(1, 8, 50), ent(2, 4, 30)], b = ps.map(p => p.internalE), bf = ps.map(p => p.fuel);
  SPH.sphIgnition(ps, 0.1, { rate: 0, uCrit: 5 });             // rate=0
  const off = ps.every((p, i) => p.internalE === b[i] && p.fuel === bf[i]);
  const cold = [ent(1, 2, 50)]; SPH.sphIgnition(cold, 0.1, { rate: 2, uCrit: 5 });   // uCrit 미달
  const coldOk = cold[0].internalE === 2 && cold[0].fuel === 50;
  const empty = SPH.sphIgnition([], 0.1, { rate: 2, uCrit: 5 });
  check('항등/안전 — rate=0·차가움·연료없음 무변화 · 빈 무탈', off && coldOk && empty.length === 0,
    `rate=0 회귀 ${off} · 차가움 불변 ${coldOk} · 빈 []`);
}

// ── 6. 결정론 — 같은 입력 → 같은 지문 ──
{
  function fnv(ps) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of ps) { push(p.internalE); push(p.fuel); }
    return h >>> 0;
  }
  const run = () => { const ps = [ent(1, 8, 20), ent(2, 6, 30), ent(1, 9, 15)]; for (let t = 0; t < 15; t++) SPH.sphIgnition(ps, 0.12, { rate: 1.7, uCrit: 4 }); return fnv(ps); };
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 지문', a === b, `0x${a.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 SPH 점화: 뜨거운 입자가 연료를 열로(연료↔열 보존)·복사와 균형 잡아 별이 정상상태에서 빛난다(0004/0013 의 SPH 판)' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);
