// step_0014/verify.js — 덩어리 검출·환원(안정 덩어리 → 개체/구체)의 수치 검증. 순수·독립·영구.
//
//   이건 *동역학 법칙*이 아니라 **관찰 연산자**다 — 장을 읽기만 하고 아무 것도 바꾸지 않는다.
//   step_0007~0013 이 창발시킨 *돌·별*(안정 덩어리)을 소수 파라미터 개체로 환원한다:
//     덩어리 = { 중심(CoM), 질량 Σρ, 반지름(점유 볼륨 등가 구), 평균온도 Σu/Σρ, 정점밀도, 셀수 }
//   검출 = ρ>eps 셀의 6-이웃 연결 성분. 핵심: **질량이 개체로 정확히 보존되어 위층으로 상속**된다.
//
//   검증 대상:
//     1. 연결 성분   — 떨어진 두 블롭 → 2 개체, 붙으면 → 1 개체(6-이웃 flood fill).
//     2. 질량 이관 보존 — Σ개체질량 = Σ_{ρ>eps} ρ (질량은 한 톨도 안 샌다 = 위층 상속의 토대).
//     3. 질량중심   — 대칭 블롭의 개체 중심 = 기하 중심.
//     4. 등가 구 반지름 — r = (3·셀수/4π)^(1/3), 셀 수↑ → 반지름 단조↑.
//     5. 평균온도   — 질량가중 평균 Σu/Σρ (T=u/ρ 의 질량가중).
//     6. 읽기 전용  — 검출은 energy·therm 을 *안* 건드린다(지문 불변 = 회귀 0, 동역학 아님).
//     7. 빈 검출    — eps 가 정점보다 크면 0 개체(아무 것도 안 잡힘).
//     8. minCells   — 작은 노이즈 성분은 버린다(셀수 < minCells 컷).
//     9. 결정론     — 같은 세계 → 동일 개체 목록(개수·질량·중심).
//    10. 통합(별→구체) — 0013 붕괴 별을 검출하면 *지배적 한 개체*로 환원(질량 대부분 흡수·뜨겁다·질량 보존).
//
//   실행: node HTJ/steps/step_0014/verify.js
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Cl = require(path.resolve(__dirname, '../../engine/htj-cluster.js'));
// 통합 테스트용(0013 붕괴 파이프라인 재현) — 검출 대상 세계를 만든다.
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Pr = require(path.resolve(__dirname, '../../engine/htj-pressure.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Vi = require(path.resolve(__dirname, '../../engine/htj-viscosity.js'));
const Fu = require(path.resolve(__dirname, '../../engine/htj-fusion.js'));
const Co = require(path.resolve(__dirname, '../../engine/htj-cooling.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// 빈 세계(energy=0, therm 추가)를 만든다. set(x,y,z,rho,T) 로 셀을 심는다.
function makeWorld(N) {
  const w = W.createWorld(N); w.addField('therm');
  w.put = (x, y, z, rho, T) => { const i = w.index(x, y, z); w.fields.energy[i] = rho; w.fields.therm[i] = rho * (T || 0); };
  return w;
}

// ── 1. 연결 성분 — *같은 세계*에서 떨어진 두 블롭(→2)을 다리로 이으면 한 덩어리(→1) ──
{
  const w = makeWorld(8);
  // x=1,2 블롭 A · x=5,6 블롭 B — x=3,4 가 비어 떨어져 있다.
  w.put(1, 1, 1, 5); w.put(2, 1, 1, 5); w.put(5, 1, 1, 4); w.put(6, 1, 1, 4);
  const sep = Cl.detectClumps(w, { eps: 1e-9 });
  // 같은 세계에 다리 셀(x=3,4)을 채워 둘을 잇는다 → 한 덩어리.
  w.put(3, 1, 1, 1); w.put(4, 1, 1, 1);
  const joined = Cl.detectClumps(w, { eps: 1e-9 });
  check('연결 성분 — 같은 세계: 떨어진 둘 → 2 개체, 다리로 이으면 → 1 개체', sep.length === 2 && joined.length === 1,
    `분리=${sep.length}개(질량 ${sep.map(c => c.mass).join(',')}) · 다리 추가 후=${joined.length}개`);
}

// ── 2. 질량 이관 보존 — Σ개체질량 = Σ_{ρ>eps} ρ ──
{
  const w = makeWorld(10);
  const eps = 1e-9;
  let direct = 0;
  // 결정론 시드로 흩뿌린다.
  let a = 12345; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  for (let z = 0; z < 10; z++) for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    if (rnd() < 0.25) { const r = 1 + rnd() * 9; w.put(x, y, z, r, 2); direct += r; }
  }
  const total = Cl.totalClumpMass(w, { eps });
  check('질량 이관 보존 — Σ개체질량 = Σ_{ρ>eps} ρ (질량 한 톨도 안 샌다)', Math.abs(total - direct) < 1e-9,
    `Σ개체=${total.toFixed(6)} = Σρ=${direct.toFixed(6)} (Δ=${Math.abs(total - direct).toExponential(2)})`);
}

// ── 3. 질량중심 — 대칭 블롭 중심 = 기하 중심 ──
{
  const w = makeWorld(7);
  const c = 3;                                    // 중심 셀
  // 중심 대칭 3×3×3 큐브(균일 ρ) → CoM = (3,3,3).
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
    w.put(c + dx, c + dy, c + dz, 5, 4);
  const cl = Cl.detectClumps(w, { eps: 1e-9 })[0];
  const ok = Math.abs(cl.cx - c) < 1e-9 && Math.abs(cl.cy - c) < 1e-9 && Math.abs(cl.cz - c) < 1e-9;
  check('질량중심 — 대칭 블롭 개체 중심 = 기하 중심', ok, `CoM=(${cl.cx.toFixed(3)},${cl.cy.toFixed(3)},${cl.cz.toFixed(3)}) = (3,3,3)`);
}

// ── 4. 등가 구 반지름 — r=(3·셀수/4π)^(1/3), 단조↑ ──
{
  const small = makeWorld(8), big = makeWorld(8);
  small.put(1, 1, 1, 5); small.put(2, 1, 1, 5);                 // 2 셀
  for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) big.put(1 + dx, 1 + dy, 1 + dz, 5);  // 8 셀
  const cs = Cl.detectClumps(small, { eps: 1e-9 })[0], cb = Cl.detectClumps(big, { eps: 1e-9 })[0];
  const expSmall = Cl.equivalentRadius(2), expBig = Cl.equivalentRadius(8);
  const ok = Math.abs(cs.radius - expSmall) < 1e-12 && Math.abs(cb.radius - expBig) < 1e-12 && cb.radius > cs.radius;
  check('등가 구 반지름 — r=(3·셀수/4π)^(1/3), 셀수↑→반지름↑', ok,
    `2셀 r=${cs.radius.toFixed(4)} < 8셀 r=${cb.radius.toFixed(4)} (공식=${expSmall.toFixed(4)},${expBig.toFixed(4)})`);
}

// ── 5. 평균온도 — 질량가중 Σu/Σρ ──
{
  const w = makeWorld(8);
  // 두 셀: (ρ=10,T=2) → u=20, (ρ=30,T=6) → u=180. 질량가중 평균 T = (20+180)/(10+30) = 200/40 = 5.
  w.put(1, 1, 1, 10, 2); w.put(2, 1, 1, 30, 6);
  const cl = Cl.detectClumps(w, { eps: 1e-9 })[0];
  check('평균온도 — 질량가중 Σu/Σρ', Math.abs(cl.temp - 5) < 1e-12, `T=${cl.temp.toFixed(6)} = 200/40 = 5 (질량 ${cl.mass})`);
}

// ── 6. 읽기 전용 — 검출은 energy·therm 불변(회귀 0, 동역학 아님) ──
{
  const w = makeWorld(8);
  for (let x = 1; x <= 5; x++) w.put(x, 2, 2, 1 + x, 3);
  const fpE = w.fingerprint('energy'), fpU = w.fingerprint('therm');
  Cl.detectClumps(w, { eps: 1e-9 }); Cl.detectClumps(w, { eps: 0.5 }); Cl.totalClumpMass(w);  // 여러 번 호출해도
  check('읽기 전용 — 검출은 energy·therm 을 안 건드린다(지문 불변 = 회귀 0)',
    w.fingerprint('energy') === fpE && w.fingerprint('therm') === fpU, `fp(energy)=0x${fpE.toString(16)} 불변`);
}

// ── 7. 빈 검출 — eps 가 정점보다 크면 0 개체 ──
{
  const w = makeWorld(8);
  w.put(1, 1, 1, 5); w.put(4, 4, 4, 3);
  check('빈 검출 — eps>정점이면 0 개체', Cl.detectClumps(w, { eps: 100 }).length === 0, `eps=100 > peak=5 → 0개`);
}

// ── 8. minCells — 작은 노이즈 성분은 버린다 ──
{
  const w = makeWorld(8);
  for (let x = 1; x <= 4; x++) w.put(x, 1, 1, 5);  // 4 셀 본체
  w.put(6, 6, 6, 5);                               // 1 셀 노이즈
  const all = Cl.detectClumps(w, { eps: 1e-9 });
  const cut = Cl.detectClumps(w, { eps: 1e-9, minCells: 2 });
  check('minCells — 셀수<minCells 노이즈 성분 컷', all.length === 2 && cut.length === 1,
    `minCells=1 → ${all.length}개 · minCells=2 → ${cut.length}개(본체만)`);
}

// ── 9. 결정론 — 같은 세계 → 동일 개체 목록 ──
{
  function build() {
    const w = makeWorld(8);
    w.put(1, 1, 1, 5, 2); w.put(2, 1, 1, 7, 3); w.put(5, 5, 5, 4, 1);
    return Cl.detectClumps(w, { eps: 1e-9 });
  }
  const a = build(), b = build();
  const same = a.length === b.length && a.every((c, i) => c.mass === b[i].mass && c.cx === b[i].cx && c.cells === b[i].cells);
  check('결정론 — 같은 세계 → 동일 개체 목록(개수·질량·중심)', same, `${a.length}개 동일(질량 ${a.map(c => c.mass).join(',')})`);
}

// ── 10. 통합(별→구체) — 0013 붕괴 별을 검출하면 지배적 한 개체로 환원 ──
//   넓은 따뜻한 구름을 중력+반발+열압력+점성+발열+복사+이류로 붕괴시키면(=0013) 조밀한 별 코어가 선다.
//   그 세계를 검출하면: 본체 임계(eps) 위에서 *지배적 한 덩어리*가 잡혀 — 질량 대부분을 흡수하고(구체로
//   환원해도 질량 보존), 뜨겁다(별=발열). 이것이 §0 목적 ①(수만 셀 별 → 구체 1개)의 수치 증거.
{
  const N = 20, rhoCrit = 6, tCrit = 3, STEPS = 120;
  const w = W.createWorld(N);
  Th.seedWarmBlob(w, { sigma: N * 0.16, M0: 4000, T0: 1 });
  for (let t = 0; t < STEPS; t++) {
    Gr.applyGravity(w, 0.2, { G: 0.15, iters: 40 });
    Pr.applyPressure(w, 0.2, { K: 0.12, gamma: 2 });
    Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 });
    Vi.applyViscosity(w, 0.2, { Kvisc: 0.6 });
    Fu.applyFusion(w, 0.2, { rate: 2, rhoCrit, tCrit });
    Co.applyCooling(w, 0.2, { coolRate: 0.06 });
    Ine.advect(w, 0.2, { scalars: ['therm'] });
  }
  const fpE = w.fingerprint('energy');
  const bodyEps = 2.0;                              // 본체 임계(확산 헤일로보다 위)
  const clumps = Cl.detectClumps(w, { eps: bodyEps, minCells: 2 });
  const dominant = clumps[0];                       // 질량 최대 = 별 코어
  const bodyMass = Cl.totalClumpMass(w, { eps: bodyEps });
  const totalMass = w.total('energy');
  const found = clumps.length >= 1;
  const dominantShare = dominant ? dominant.mass / bodyMass : 0;   // 본체 중 지배 개체 비중
  const hot = dominant && dominant.temp > 1.5;      // 별=발열로 초기 T0=1 보다 확실히 뜨겁다(차가운 돌과 구분)
  const readOnly = w.fingerprint('energy') === fpE; // 검출이 별을 안 건드림
  const massOk = Math.abs(totalMass - 4000) < 1e-6 && !Number.isNaN(totalMass);
  check('통합(별→구체) — 0013 붕괴 별이 지배적 한 개체로 환원(질량 흡수·T>1.5 뜨겁다·질량 보존) [헤드라인]',
    found && dominantShare > 0.8 && hot && readOnly && massOk,
    `개체 ${clumps.length}개·지배 질량 ${dominant ? dominant.mass.toFixed(0) : 0}(본체 ${bodyMass.toFixed(0)}의 ${(dominantShare * 100).toFixed(0)}%)·r=${dominant ? dominant.radius.toFixed(2) : 0}·T=${dominant ? dominant.temp.toFixed(2) : 0}(>1.5)·Σρ=${totalMass.toFixed(0)}`);
}

console.log('\n=== step_0014 수치 검증: 덩어리 검출·환원(안정 덩어리 → 개체/구체) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
