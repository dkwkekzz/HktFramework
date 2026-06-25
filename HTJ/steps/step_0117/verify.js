// step_0117/verify.js — (조립) 건널 수 있는 물: SPH 물이 상호작용하는 물체다(부력+저항).
//   새 물리 0(sphPressureForce 0041·sphViscosity 0046·sphBoundaryForce 는 부품 verify 가 보증). 여기선
//   *새 결합*만: 캐릭터를 SPH 물에 넣으면 부력(압력)·저항(점성)이 창발. 순수·독립·영구. node HTJ/steps/step_0117/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const DT = 0.02, G = 4;
const popt = { stiffness: 80, h: 2.0, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.0, gamma: 2 }, bopt = { stiffness: 200, damp: 30, skin: 0.6 };
const mkw = (x, z) => ({ cx: x, cy: 0, cz: z, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });

function pool() {
  const an = [];
  for (let x = 0; x <= 24; x++) an.push({ cx: x, cy: 0, cz: -3, radius: 3 });
  for (let z = 0; z <= 18; z += 2) { an.push({ cx: -1, cy: 0, cz: z, radius: 2 }); an.push({ cx: 25, cy: 0, cz: z, radius: 2 }); }
  const water = [];
  for (let x = 3; x <= 21; x += 1.3) for (let z = 1; z <= 10; z += 1.3) water.push(mkw(x, z));
  for (let s = 0; s < 400; s++) { Sph.sphPressureForce(water, DT, popt); Sph.sphViscosity(water, DT, vopt); for (const p of water) p.pz -= p.mass * G * DT; Sph.sphBoundaryForce(water, an, DT, bopt); En.stepEntities(water, DT); }
  return { an, water, surf: Math.max(...water.map(p => p.cz)) };
}
// 캐릭터 한 개를 못에 떨어뜨려 정착 z 측정(부력).
function settleChar(mass) {
  const { an, water, surf } = pool();
  const ch = { cx: 12, cy: 0, cz: surf + 4, mass, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1.4 };
  for (let s = 0; s < 600; s++) { const all = [...water, ch]; Sph.sphPressureForce(all, DT, popt); Sph.sphViscosity(all, DT, vopt); for (const p of all) p.pz -= p.mass * G * DT; Sph.sphBoundaryForce(water, an, DT, bopt); Sph.sphBoundaryForce([ch], an, DT, bopt); En.stepEntities(all, DT); }
  return { z: ch.cz, surf, waterCount: water.length, waterMass: water.reduce((s, p) => s + p.mass, 0) };
}

const light = settleChar(0.4), heavy = settleChar(3.0);

// ① 부력 — 가벼운 캐릭터는 수면 근처에 뜨고·무거운 건 더 깊이 잠긴다(깊이 ∝ 밀도·아르키메데스).
ok(light.z > heavy.z + 1.5 && light.z > light.surf - 2.0,
  `부력 — 가벼움 z ${light.z.toFixed(2)}(수면 ${light.surf.toFixed(1)} 근처·뜸) > 무거움 z ${heavy.z.toFixed(2)}(더 깊이·깊이∝밀도)`);

// ② 안 빠짐 — 캐릭터가 바닥(z=0)을 통과 안 함(물+경계가 떠받침·담음).
ok(light.z > 0 && heavy.z > 0, `안 빠짐 — 가벼움 z ${light.z.toFixed(2)}>0·무거움 z ${heavy.z.toFixed(2)}>0(바닥 통과 0·물+경계 떠받침)`);

// ③ 저항(drag) — 수평으로 민 캐릭터가 물 속에선 느려지고(점성)·진공에선 그대로(뉴턴1).
(() => {
  const { water, surf } = pool();
  function push(inWater) {
    const ch = { cx: 8, cy: 0, cz: surf - 2, mass: 1, px: 5, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1.2 };
    const w2 = water.map(p => ({ ...p }));
    for (let s = 0; s < 120; s++) { const all = inWater ? [...w2, ch] : [ch]; if (inWater) { Sph.sphPressureForce(all, DT, popt); Sph.sphViscosity(all, DT, vopt); } En.stepEntity(ch, DT); }
    return ch.px / ch.mass;
  }
  const vac = push(false), wat = push(true);
  ok(Math.abs(vac - 5) < 1e-9 && wat < vac * 0.7,
    `저항 — 민 캐릭터 vx 진공 ${vac.toFixed(2)}(그대로·뉴턴1) → 물 속 ${wat.toFixed(2)}(<0.7×·점성 저항·건너기 힘듦)`);
})();

// ④ 물 보존 — 캐릭터가 들어가도 물 입자 수·질량 보존.
show(L.conserved('물 질량(캐릭터 진입 후)', 98, heavy.waterMass, 1e-12));

// ⑤ 결정론.
show(L.deterministic('같은 낙하 → 같은 부력', () => { const r = settleChar(0.4); return [Math.round(r.z * 1e4)]; }));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
