// step_0052/verify.js — SW5 SPH 복사 냉각(열의 출구=빛). 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 — 압력(0041)·점성(0046)·전도(0049)는 에너지를 *재분배*만 한다(KE↔U·U↔U).
//   계 밖으로 나갈 출구가 없어 붕괴열이 갇힌다. 이 법칙은 그 출구 = 빛: 각 입자가 제 내부E 일부를 회색 복사로
//   방출 = **0005/0013(열의 출구=빛·질량 보존)의 SPH 판**. u_i ← u_floor+(u_i−u_floor)(1−dt·coolRate),
//   radiated_i += 잃은 내부E. 계의 *첫 에너지 sink* — 점성·전도는 열을 옮길 뿐 못 버린다.
//   적정 검증: ① 냉각 정의(기하 감쇠·질량 불변) ② 질량·운동량·KE 불변 ③ 열→빛 회계(ΣU 감소=Σradiated)
//   ④ 바닥 온도(floor 아래론 안 식음) ⑤ 항등/안전(coolRate=0→회귀0·빈) ⑥ 결정론.
//   실행: node HTJ/steps/step_0052/verify.js
'use strict';
const path = require('path');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const relOk = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) + 1e-9 * Math.abs(b);

function ent(mass, u, px, py, pz) {
  px = px || 0; py = py || 0; pz = pz || 0;
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  return { mass, px, py, pz, KEcm, internalE: u * mass, energy: KEcm + u * mass };
}
const clone = (ps) => ps.map(p => ({ ...p }));
const sumU = (ps) => ps.reduce((s, p) => s + p.internalE, 0);
const sumR = (ps) => ps.reduce((s, p) => s + (p.radiated || 0), 0);
const uOf = (p) => p.internalE / p.mass;

// ── 1. 냉각 정의 — u_i 가 factor=(1−dt·coolRate) 로 기하 감쇠·질량 불변 ──
{
  const ps = [ent(2, 10, 4), ent(1, 5)], dt = 0.2, coolRate = 0.5, f = 1 - dt * coolRate;
  const u0 = ps.map(uOf), m0 = ps.map(p => p.mass);
  SPH.sphRadiativeCooling(ps, dt, { coolRate });
  const ok = relOk(uOf(ps[0]), u0[0] * f) && relOk(uOf(ps[1]), u0[1] * f) && ps[0].mass === m0[0] && ps[1].mass === m0[1];
  check('냉각 정의 — u ← u·(1−dt·coolRate) 기하 감쇠·질량 불변', ok,
    `factor=${f} → u ${u0[0]}→${uOf(ps[0]).toFixed(3)}, ${u0[1]}→${uOf(ps[1]).toFixed(3)} · 질량 불변`);
}

// ── 2. 질량·운동량·KE 불변 — 빛은 *열에서* 나오지 운동/질량 아님 ──
{
  const ps = [ent(2, 8, 3, -1, 2), ent(1.5, 4, 0, 2, 0), ent(1, 6, -2, 0, 1)], before = clone(ps);
  for (let t = 0; t < 15; t++) SPH.sphRadiativeCooling(ps, 0.15, { coolRate: 0.4 });
  let mOk = true, pOk = true, keOk = true;
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].mass !== before[i].mass) mOk = false;
    if (ps[i].px !== before[i].px || ps[i].py !== before[i].py || ps[i].pz !== before[i].pz) pOk = false;
    if (ps[i].KEcm !== before[i].KEcm) keOk = false;
  }
  check('질량·운동량·KE 불변 — 빛은 열에서(운동/질량 아님)', mOk && pOk && keOk,
    `질량 ${mOk} · 운동량 ${pOk} · KE ${keOk}`);
}

// ── 3. 열→빛 회계 — ΣU 감소분 = Σradiated 증가분 (합 일정·0005/0013 정신) ──
{
  const ps = [ent(2, 10, 1), ent(1, 7), ent(3, 3, -2), ent(1.5, 5)];
  const total0 = sumU(ps) + sumR(ps);
  for (let t = 0; t < 25; t++) SPH.sphRadiativeCooling(ps, 0.1, { coolRate: 0.6 });
  const U1 = sumU(ps), R1 = sumR(ps);
  check('열→빛 회계 — ΣU 감소 = Σradiated (열+빛 일정)', relOk(U1 + R1, total0, 1e-9) && R1 > 0,
    `ΣU ${sumU([ent(2,10,1),ent(1,7),ent(3,3,-2),ent(1.5,5)]).toFixed(2)}→${U1.toFixed(2)} · Σ빛 0→${R1.toFixed(2)} · 합 ${(U1 + R1).toFixed(4)}=${total0.toFixed(4)}`);
}

// ── 4. 바닥 온도 — floor 위 초과분만 식고 floor 아래론 안 식는다(바닥 복사장) ──
{
  const hot = [ent(1, 10)], cold = [ent(1, 1)];               // floor=2: 뜨거운 건 식어 2 로·찬 건(2 미만) 무변화
  for (let t = 0; t < 200; t++) { SPH.sphRadiativeCooling(hot, 0.1, { coolRate: 0.5, floor: 2 }); SPH.sphRadiativeCooling(cold, 0.1, { coolRate: 0.5, floor: 2 }); }
  check('바닥 온도 — floor 위만 식고 아래론 안 식음', relOk(uOf(hot[0]), 2, 1e-3) && uOf(cold[0]) === 1,
    `뜨거운 u 10→${uOf(hot[0]).toFixed(3)}(→floor 2) · 찬 u 1 불변(floor 아래)`);
}

// ── 5. 항등/안전 — coolRate=0 → 회귀0 · dt=0 무변화 · 빈 무탈 ──
{
  const ps = [ent(1, 5, 2), ent(2, 3)], b = ps.map(p => p.internalE);
  SPH.sphRadiativeCooling(ps, 0.1, { coolRate: 0 });           // coolRate=0
  const off1 = ps.every((p, i) => p.internalE === b[i] && (p.radiated || 0) === 0);
  SPH.sphRadiativeCooling(ps, 0, { coolRate: 0.5 });           // dt=0
  const off2 = ps.every((p, i) => p.internalE === b[i]);
  const empty = SPH.sphRadiativeCooling([], 0.1, { coolRate: 0.5 });
  check('항등/안전 — coolRate=0·dt=0 무변화 · 빈 무탈', off1 && off2 && empty.length === 0,
    `coolRate=0 회귀 ${off1} · dt=0 회귀 ${off2} · 빈 []`);
}

// ── 6. 결정론 — 같은 입력 → 같은 지문 ──
{
  function fnv(ps) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of ps) { push(p.internalE); push(p.radiated || 0); }
    return h >>> 0;
  }
  const run = () => { const ps = [ent(2, 9, 1), ent(1, 4), ent(3, 6, -1)]; for (let t = 0; t < 12; t++) SPH.sphRadiativeCooling(ps, 0.13, { coolRate: 0.45, floor: 0.5 }); return fnv(ps); };
  const a = run(), b = run();
  check('결정론 — 같은 입력 → 같은 지문', a === b, `0x${a.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 SPH 복사 냉각: 입자가 열을 빛으로 방출(계의 첫 sink)·질량 보존·열+빛 일정(0005/0013 의 SPH 판)' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);
