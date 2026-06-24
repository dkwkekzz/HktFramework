// step_0060/verify.js — TW2 바다 첫 벽돌: SPH 물 입자가 *정적 지형 앵커*를 느끼는 경계(안 새어 나감). 순수·독립·영구.
//
//   design/environment.md §3 TW2 — sphere-world 동역학(0026~)+SPH 물리 스택(0040~)은 섰지만, 물(SPH 입자)이
//   *지형*(정적 앵커·0056/0059)을 느끼는 결합이 없어 물이 지형을 그냥 통과한다. 이 step 의 새 엔진 법칙
//   `sphBoundaryForce` 가 그 *유일하게 빠진 벽돌* = SPH↔앵커 경계: 물 입자가 앵커 구 표면 안으로 파고들면
//   바깥으로 반발(Hooke·앵커=무한질량 외부경계가 충격 흡수·0056 정신)·파고드는 법선 운동은 감쇠→열(0037).
//   그러면 중력(0028)+SPH 압력(0041)이 물을 *낮은 데 고여 수평 수면(등퍼텐셜=정수면)*으로 가라앉힌다 — 창발.
//   적정 검증(4 축): ① 새 거동 = 반발·관통 없음 ② 창발 = 행성 위 물이 *수평 수면(등반경 층)*으로 퍼져 정착
//   ③ 보존/안전 = 질량 불변·낙하 KE→열 소산(internalE↑)·앵커 밖=불변(항등) ④ k=0→회귀0 ⑤ 결정론.
//   실행: node HTJ/steps/step_0060/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// SPH 물 입자 descriptor.
function wp(cx, cy, cz, mass, px, py, pz) {
  px = px || 0; py = py || 0; pz = pz || 0;
  const KEcm = mass > 0 ? 0.5 * (px * px + py * py + pz * pz) / mass : 0;
  return { cx, cy, cz, mass, px, py, pz, density: 0, internalE: 0, KEcm, energy: KEcm, radius: 1 };
}
function anc(cx, cy, cz, radius) { return { cx, cy, cz, radius }; }
function rng(seed) { return function () { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const rOf = (e) => Math.hypot(e.cx, e.cy, e.cz);
const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) * (x - m)))); };

// ── 1. 새 거동 — 반발·관통 없음(표면 안 입자가 바깥으로 밀려 나간다) ──
{
  const A = anc(0, 0, 0, 10);
  const p = wp(8, 0, 0, 1, -3, 0, 0);                          // 표면 안(d=8<10)·중심으로 파고드는 중
  const radMomBefore = p.px;                                   // 안쪽(−x) 운동량
  Sph.sphBoundaryForce([p], [A], 0.02, { stiffness: 200 });
  const pushedOut = p.px > radMomBefore;                       // 바깥(+x)으로 반발됨
  // 중력으로 계속 밀어 넣어도 관통 안 함: 안쪽 가속을 매 step 주며 경계+적분 반복.
  const q = wp(11, 0, 0, 1, 0, 0, 0);
  let minR = 1e9;
  for (let s = 0; s < 2000; s++) {
    q.px -= 1 * q.mass * 0.02;                                 // 일정 안쪽 중력(−x)
    Sph.sphBoundaryForce([q], [A], 0.02, { stiffness: 200, damp: 30 });
    En.stepEntities([q], 0.02);
    minR = Math.min(minR, rOf(q));
  }
  check('반발·관통 없음 — 표면 안 입자가 바깥으로 밀려나고, 계속 눌러도 앵커를 안 뚫는다',
    pushedOut && minR > A.radius - 0.6,
    `반발 px ${radMomBefore.toFixed(2)}→${p.px.toFixed(2)}(바깥) · 지속 가압 최소 반경 ${minR.toFixed(3)}(앵커 R=${A.radius})`);
}

// ── 분지(평평한 바닥+벽) 물 떼 시뮬(테스트 2·3·5 공유) — SPH 압력(0041)+점성(0046)+균일 중력+경계(이 step). ──
//   분지 = 큰 바닥 구(top z≈0·국소 평탄) + 4 벽 구. 모두 정적 앵커(읽기만). 우물 = |x|,|y|<HW·바닥 z=0.
//   균일 중력은 *가둠 없으면* 누출하지만(0059), 분지(바닥+벽)가 물을 가두므로 표준적으로 안전.
const HW = 5, BR = 120, GRAV = 4;
const popt = { stiffness: 90, h: 2.0, gamma: 2 }, vopt = { alpha: 1.5, beta: 2, h: 2.0, gamma: 2 };
const bopt = { stiffness: 150, damp: 30, skin: 0.6 };
function basinAnchors() {
  return [
    anc(0, 0, -BR, BR),                                        // 바닥(표면 z≈0)
    anc(-(BR + HW), 0, 0, BR), anc(BR + HW, 0, 0, BR),         // x 벽(표면 x=∓HW)
    anc(0, -(BR + HW), 0, BR), anc(0, BR + HW, 0, BR),         // y 벽(표면 y=∓HW)
  ];
}
function buildWater(seed, N) {
  const rnd = rng(seed), water = [];
  for (let i = 0; i < N; i++) water.push(wp((rnd() - 0.5) * 8, (rnd() - 0.5) * 8, 6 + rnd() * 16, 1));
  return water;
}
function simulate(water, anchors, steps) {
  let maxSpeed = 0;
  for (let s = 0; s < steps; s++) {
    Sph.sphPressureForce(water, 0.02, popt);                  // 물↔물 압력(퍼짐)
    Sph.sphViscosity(water, 0.02, vopt);                      // 슬로싱 소산(정착)
    for (const w of water) w.pz -= w.mass * GRAV * 0.02;      // 균일 중력(분지가 가둠)
    Sph.sphBoundaryForce(water, anchors, 0.02, bopt);         // 물↔지형 경계(이 step)
    En.stepEntities(water, 0.02);
    for (const w of water) maxSpeed = Math.max(maxSpeed, speed(w));
  }
  return maxSpeed;
}

// ── 2. 창발 — 물이 분지에 고여 수평 수면(등z)으로 평형(중력+압력) ──
{
  const anchors = basinAnchors(), water = buildWater(12345, 100);
  const maxSpeed = simulate(water, anchors, 6000);
  const zs = water.map(w => w.cz);
  const minz = Math.min(...zs), meanSpd = mean(water.map(speed));
  const maxXY = Math.max(...water.map(w => Math.max(Math.abs(w.cx), Math.abs(w.cy))));
  const sorted = zs.slice().sort((a, b) => a - b);
  const surf = sorted.slice(Math.floor(sorted.length * 2 / 3));   // 표층(z 상위 1/3) = 수면
  const surfStd = std(surf), surfLevel = mean(surf);
  const noPenetrate = minz > -0.6 && maxXY < HW + 0.8;        // 바닥·벽 안 뚫음(안 새어 나감)
  const settled = meanSpd < 0.05 && maxSpeed > 3;             // 떨어졌다(빨랐다)가 멈춤
  const flatSurf = surfStd < 1.2;                             // 수평 수면(등z·등퍼텐셜)
  const pooled = surfLevel > 1 && maxXY > HW - 1.5;           // 분지를 채워 깊이 생김(고임)
  check('수평 수면 — 물이 분지에 고여 수평 표면(등z)으로 평형(중력+압력)·안 새어 나감',
    noPenetrate && settled && flatSurf && pooled,
    `관통없음 minz ${minz.toFixed(2)}·벽 maxXY ${maxXY.toFixed(2)}(<${HW}) · 정착 meanV ${meanSpd.toFixed(3)}(낙하 ${maxSpeed.toFixed(1)}→멈춤) · ` +
    `수면 z=${surfLevel.toFixed(2)} std ${surfStd.toFixed(2)}(<1.2=평평)·고임`);
}

// ── 3. 보존/안전 — 질량 불변 · 낙하 KE→열 소산(internalE↑) · 앵커 밖=불변(항등) ──
{
  // (a) 소산: 표면 *안*으로 파고드는 입자 — 경계 감쇠가 KE 를 internalE 로(단조↑·dissip≥0).
  const A = anc(0, 0, 0, 10);
  const p = wp(9.5, 0, 0, 1, -5, 0, 0);                       // 표면 안(d=9.5<10)·빠르게 파고듦
  const int0 = p.internalE, ke0 = p.KEcm;
  Sph.sphBoundaryForce([p], [A], 0.02, { stiffness: 120, damp: 60 });
  const dissipated = p.internalE > int0 && p.KEcm < ke0;
  // (b) 질량 불변(시뮬 전후).
  const water = buildWater(777, 80);
  const m0 = water.reduce((s, w) => s + w.mass, 0);
  simulate(water, basinAnchors(), 1500);
  const m1 = water.reduce((s, w) => s + w.mass, 0);
  const massKept = Math.abs(m1 - m0) < 1e-9;
  // (c) 항등: 앵커 표면 밖(pen≤0) 입자 → 경계력 0(완전 불변).
  const far = wp(30, 0, 0, 2, 1, -2, 0);
  const snap = JSON.stringify(far);
  Sph.sphBoundaryForce([far], [A], 0.02, { stiffness: 120, damp: 60 });
  const identityFar = JSON.stringify(far) === snap;
  check('보존/안전 — 질량 불변 · 낙하 KE→열(internalE↑ 소산) · 앵커 밖=불변(항등)',
    dissipated && massKept && identityFar,
    `소산 internalE ${int0.toFixed(2)}→${p.internalE.toFixed(2)}·KEcm ${ke0.toFixed(2)}→${p.KEcm.toFixed(2)} · 질량 Δ${Math.abs(m1 - m0).toExponential(1)} · 앵커 밖 불변 ${identityFar}`);
}

// ── 4. k=0 → early-return(회귀 0) ──
{
  const A = anc(0, 0, 0, 10);
  const p = wp(8, 0, 0, 1, -3, 1, 0);                         // 표면 안(작동 조건)
  const snap = JSON.stringify(p);
  Sph.sphBoundaryForce([p], [A], 0.02, { stiffness: 0, damp: 60 });
  const noAnchor = JSON.stringify(wp(8, 0, 0, 1, -3, 1, 0));
  const q = wp(8, 0, 0, 1, -3, 1, 0);
  Sph.sphBoundaryForce([q], [], 0.02, { stiffness: 120 });    // 앵커 없음도 early-return
  check('k=0/앵커 없음 → early-return(회귀 0) — 세계 완전 불변',
    JSON.stringify(p) === snap && JSON.stringify(q) === noAnchor,
    `k=0 불변 ${JSON.stringify(p) === snap} · 앵커 없음 불변 ${JSON.stringify(q) === noAnchor}`);
}

// ── 5. 결정론 — 같은 초기 → 같은 정착 지문 ──
{
  function fp() {
    const water = buildWater(2024, 60);
    simulate(water, basinAnchors(), 800);
    let h = water.length >>> 0;
    for (const w of water) h = (Math.imul(h, 131) + Math.round(w.cx * 1e4) + Math.round(w.cz * 1e4) + Math.round(w.internalE * 1e2)) >>> 0;
    return h >>> 0;
  }
  const a = fp(), b = fp();
  check('결정론 — 같은 초기 물 떼·지형 → 같은 정착 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0060 수치 검증: TW2 바다 = SPH 물이 정적 지형 앵커를 느끼는 경계(안 새어 나감) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
