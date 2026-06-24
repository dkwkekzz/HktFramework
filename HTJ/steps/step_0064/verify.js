// step_0064/verify.js — TW3 강: SPH bed friction(지형 바닥 접선 항력)으로 물이 경사를 흘러내린다. 순수·독립·영구.
//
//   design/environment.md §3 TW3 — TW2(0060 sphBoundaryForce)는 물을 지형에 *얹었지만*(법선 반발/감쇠) 경사면을
//   따라 *미끄러지는(접선)* 운동엔 저항이 0 → 기울인 바닥 위 물이 끝없이 가속(종단속도 없음·탄도 추락). 이 step 의
//   새 법칙 `sphBedFriction` 이 그 빠진 벽돌 = 접촉 입자의 *접선 슬립*을 속도비례로 소산→열. 속도비례(점성형)라
//   경사에서 g·sinθ 와 균형 → **종단속도**(유한)로 *일정 속도 흐름* = 강. 0046(입자↔입자 점성)의 바닥↔입자 판,
//   TW1 의 0057(접촉 접선 마찰)의 SPH↔앵커 판. 앵커=무한질량 외부 경계(잃은 운동량은 경계로·0056/0060 정신).
//   적정 검증(4 축): ① 새 거동 = 종단속도(drag=0 끝없이 가속 vs drag>0 유한 정상) ② 소산/보존 = 접선만 줄고
//   법선 불변·잃은 KE→internalE 정확·질량 불변 ③ 창발(조립 강) = 물이 흘러 하류에 고임·흐름 유한 ④ drag=0→
//   회귀0(=0060 단독·항등) ⑤ 결정론. 실행: node HTJ/steps/step_0064/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
function wp(cx, cy, cz, mass, px, py, pz) {
  px = px || 0; py = py || 0; pz = pz || 0; mass = mass || 1;
  const KEcm = 0.5 * (px * px + py * py + pz * pz) / mass;
  return { cx, cy, cz, mass, px, py, pz, density: 0, internalE: 0, KEcm, energy: KEcm, radius: 1 };
}
function anc(cx, cy, cz, radius) { return { cx, cy, cz, radius }; }
function rng(seed) { return function () { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;

// ── 1. 새 거동 — 종단속도: 기울인 바닥 위 물은 drag 없으면 끝없이 가속, 있으면 *유한 종단속도*로 정상 흐름 ──
{
  const A = anc(0, 0, -120, 120);                              // 바닥(표면 z≈0·국소 평탄)
  const GX = 1.1, GZ = 3.4;                                   // 기울인 중력(다운힐 −x)·slope tanθ=0.32
  function run(drag) {
    const p = wp(0, 0, 0.5, 1);
    const samples = [];
    for (let s = 0; s < 3000; s++) {
      p.px -= p.mass * GX * 0.02; p.pz -= p.mass * GZ * 0.02;  // 중력
      Sph.sphBoundaryForce([p], [A], 0.02, { stiffness: 150, damp: 30, skin: 0.6 });  // 0060 법선
      Sph.sphBedFriction([p], [A], 0.02, { drag, skin: 0.6 });                        // 이 step 접선
      En.stepEntities([p], 0.02);
      if (s % 300 === 299) samples.push(speed(p));
    }
    return samples;
  }
  const free = run(0), term = run(1.5);
  const freeFinal = free[free.length - 1];
  const termFinal = term[term.length - 1], termPrev = term[term.length - 2];
  const accelerates = freeFinal > 50 && free[free.length - 1] > free[0] * 5;   // drag=0 끝없이 가속(선형↑)
  const bounded = termFinal < 5;                                                // drag>0 유한
  const plateau = Math.abs(termFinal - termPrev) / termFinal < 0.15;            // 종단(마지막 두 표본 수렴)
  check('종단속도 — drag=0 은 끝없이 가속(탄도)·drag>0 은 유한 종단속도로 정상 흐름(강)',
    accelerates && bounded && plateau,
    `drag=0 |v| ${free[0].toFixed(1)}→${freeFinal.toFixed(1)}(가속) · drag=1.5 |v| ${term[0].toFixed(1)}→${termFinal.toFixed(2)}(종단·이전 ${termPrev.toFixed(2)})`);
}

// ── 2. 소산/보존 — 접선만 줄고 법선 불변 · 잃은 KE→internalE 정확 · 질량 불변 ──
{
  const A = anc(0, 0, -10, 10);                               // 표면 z≈0
  // 표면 안(접촉)·접선(+x) 슬립 + 법선(−z, 파고듦) 속도 동시 보유.
  const p = wp(0, 0, 0.3, 2, 8, 0, -3);                       // px=접선 슬립·pz=법선 성분(중심 −z 방향이 안쪽)
  const n = [p.cx / Math.hypot(p.cx, p.cy, p.cz + 10), p.cy, (p.cz + 10) / Math.hypot(p.cx, p.cy, p.cz + 10)];
  // 법선/접선 성분(작용 전).
  const vn0 = (p.px * 0 + p.py * 0 + p.pz * 1) / p.mass;      // 바닥 거의 +z 법선 → 법선 ≈ pz/m
  const ke0 = p.KEcm, int0 = p.internalE;
  Sph.sphBedFriction([p], [A], 0.02, { drag: 2.0, skin: 0.6 });
  const vn1 = p.pz / p.mass;
  const normalKept = Math.abs(vn1 - vn0) < 1e-9;              // 법선(z) 운동 불변(접선만 건드림)
  const tangentDown = Math.abs(p.px / p.mass) < 8;            // 접선(x) 슬립 줄어듦
  const noReverse = p.px >= 0;                                // 역전 금지(0 까지만)
  const heatExact = Math.abs((int0 + (ke0 - p.KEcm)) - p.internalE) < 1e-9 && p.internalE > int0;  // 잃은 KE = internalE 증가
  // 질량 불변(시뮬 전후).
  const A2 = anc(0, 0, -120, 120);
  const rnd = rng(99), water = [];
  for (let i = 0; i < 40; i++) water.push(wp((rnd() - 0.5) * 8, (rnd() - 0.5) * 8, 1 + rnd() * 4, 1, 4, 0, 0));
  const m0 = water.reduce((s, w) => s + w.mass, 0);
  for (let s = 0; s < 300; s++) { Sph.sphBedFriction(water, [A2], 0.02, { drag: 1.0, skin: 0.6 }); En.stepEntities(water, 0.02); }
  const massKept = Math.abs(water.reduce((s, w) => s + w.mass, 0) - m0) < 1e-9;
  check('소산/보존 — 접선만 줄고 법선 불변 · 잃은 KE→internalE 정확(비가역 열) · 질량 불변',
    normalKept && tangentDown && noReverse && heatExact && massKept,
    `법선 vn ${vn0.toFixed(3)}→${vn1.toFixed(3)}(불변) · 접선 px ${p.px.toFixed(2)}(역전없음) · KE→열 ΔKE ${(ke0 - p.KEcm).toFixed(3)}=ΔU ${(p.internalE - int0).toFixed(3)} · 질량 Δ${Math.abs(water.reduce((s, w) => s + w.mass, 0) - m0).toExponential(1)}`);
}

// ── 3. 창발(조립 강) — 기울인 램프 바닥(우측 高→좌측 低) 위로 물이 흘러내려 *하류 댐에 고임*·흐름은 유한 ──
{
  // 기울인 램프 = 큰 구를 오른쪽-위에 둬 패치가 내리막 사면. 중력은 수직(−z). 0060 류 gap-free.
  const R = 600, XC = 145.5, ZC = -567.6, HWy = 6, BRw = 200, G = 4, DRAG = 0.6;
  const floorZ = (x) => ZC + Math.sqrt(Math.max(0, R * R - (x - XC) * (x - XC)));
  const anchors = [
    anc(XC, 0, ZC, R),                                          // 램프 바닥(내리막)
    anc(-(BRw + 52), 0, floorZ(-50), BRw), anc((BRw + 52), 0, floorZ(50), BRw),   // 댐(좌) / 상류 back(우)
    anc(0, -(BRw + HWy), floorZ(0), BRw), anc(0, (BRw + HWy), floorZ(0), BRw),     // y 벽(채널)
  ];
  const popt = { stiffness: 90, h: 2.0, gamma: 2 }, vopt = { alpha: 1.5, beta: 2, h: 2.0, gamma: 2 }, bopt = { stiffness: 150, damp: 30, skin: 0.6 };
  const rnd = rng(7), water = [];
  let peakV = 0, damEarly = 0;
  for (let s = 0; s < 6000; s++) {
    if (water.length < 180 && s % 18 === 0) for (let j = 0; j < 3; j++) { const x = 46 - rnd() * 4; water.push(wp(x, (rnd() - 0.5) * 8, floorZ(x) + 3 + rnd() * 3)); }
    Sph.sphPressureForce(water, 0.02, popt); Sph.sphViscosity(water, 0.02, vopt);
    for (const w of water) w.pz -= w.mass * G * 0.02;          // 수직 중력(기울기는 램프 바닥에)
    Sph.sphBoundaryForce(water, anchors, 0.02, bopt); Sph.sphBedFriction(water, anchors, 0.02, { drag: DRAG, skin: bopt.skin });
    En.stepEntities(water, 0.02);
    for (const w of water) peakV = Math.max(peakV, speed(w));
    if (s === 1000) damEarly = water.filter(w => w.cx < -30).length;   // 초기엔 댐에 거의 없음(아직 흐르는 중)
  }
  const xs = water.map(w => w.cx);
  const damPool = xs.filter(x => x < -30).length;             // 하류(좌·댐) 고임
  const escaped = water.filter(w => w.cx < -60 || w.cx > 60 || w.cz < floorZ(w.cx) - 5).length;
  const flowedDown = damPool > 120 && damPool > damEarly + 80;  // 상류(우) source → 하류(좌) 댐으로 흘러 고임
  const boundedFlow = peakV < 30 && escaped === 0;             // bed friction 으로 흐름 유한·이탈 0(탄도 아님)
  check('창발(조립 강) — 물이 내리막 램프를 흘러내려 하류 댐에 고임 · bed friction 으로 흐름 유한(이탈 0)',
    flowedDown && boundedFlow,
    `댐 고임 ${damEarly}(s1000)→${damPool}/180 · peakV ${peakV.toFixed(1)}(<30 유한) · 이탈 ${escaped}`);
}

// ── 4. drag=0 → early-return(회귀 0·=0060 sphBoundaryForce 단독) · 표면 밖=불변(항등) ──
{
  const A = anc(0, 0, 0, 10);
  const p = wp(8, 0, 0, 1, 5, 2, -1);                         // 표면 안(접촉)·접선 슬립 보유
  const snap = JSON.stringify(p);
  Sph.sphBedFriction([p], [A], 0.02, { drag: 0, skin: 0.6 });           // drag=0 → early-return
  const dragZero = JSON.stringify(p) === snap;
  const q = wp(8, 0, 0, 1, 5, 2, -1);
  Sph.sphBedFriction([q], [], 0.02, { drag: 1.0 });                     // 앵커 없음 → early-return
  const noAnchor = JSON.stringify(q) === snap;
  const far = wp(30, 0, 0, 2, 4, 0, 0);                       // 표면 밖(pen≤0)
  const snapFar = JSON.stringify(far);
  Sph.sphBedFriction([far], [A], 0.02, { drag: 1.0, skin: 0.6 });
  const identityFar = JSON.stringify(far) === snapFar;
  check('drag=0/앵커 없음 → early-return(회귀 0·=0060 단독) · 표면 밖=불변(항등)',
    dragZero && noAnchor && identityFar,
    `drag=0 불변 ${dragZero} · 앵커 없음 불변 ${noAnchor} · 표면 밖 불변 ${identityFar}`);
}

// ── 5. 결정론 — 같은 초기 물 떼·지형 → 같은 흐름 지문 ──
{
  function fp() {
    const A = anc(0, 0, -120, 120);
    const rnd = rng(2024), water = [];
    for (let i = 0; i < 50; i++) water.push(wp((rnd() - 0.5) * 10, (rnd() - 0.5) * 10, 1 + rnd() * 5, 1, 3, 1, 0));
    for (let s = 0; s < 800; s++) {
      for (const w of water) w.px -= w.mass * 1.0 * 0.02;
      Sph.sphBoundaryForce(water, [A], 0.02, { stiffness: 150, damp: 30, skin: 0.6 });
      Sph.sphBedFriction(water, [A], 0.02, { drag: 0.8, skin: 0.6 });
      En.stepEntities(water, 0.02);
    }
    let h = water.length >>> 0;
    for (const w of water) h = (Math.imul(h, 131) + Math.round(w.cx * 1e4) + Math.round(w.cz * 1e4) + Math.round(w.internalE * 1e2)) >>> 0;
    return h >>> 0;
  }
  const a = fp(), b = fp();
  check('결정론 — 같은 초기 물 떼·지형 → 같은 흐름 지문', a === b, `0x${a.toString(16)}`);
}

console.log('\n=== step_0064 수치 검증: TW3 강 = SPH bed friction(지형 바닥 접선 항력)으로 물이 경사를 흘러내린다 ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
