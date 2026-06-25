// step_0116/verify.js — (조립) 근거리 진짜 물리/원거리 필드: LOD 가 관찰자(캐릭터)를 따라간다.
//   새 물리 0(adaptLOD 0039 는 부품 verify 가 보증). 여기선 *새 결합*만: 관찰자=캐릭터로 near=fine/far=coarse,
//   먼 디테일 늘려도 effective 유계, 관찰자 따라감. 순수·독립·영구. node HTJ/steps/step_0116/verify.js
'use strict';
const path = require('path');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const NEARR = 10, BS = 6, obsX = 40, obsY = 4;
const mk = (x, y) => ({ cx: x, cy: y, cz: 0, mass: 1, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, internalE: 0, KEcm: 0, energy: 0, cells: 1, lodMembers: 1, radius: 0.62 });

// 고정 near 내용(15) + 가변 far 밀도. 순수(시드 고정).
function world(farDensity) {
  const es = []; let seed = 7; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 15; i++) es.push(mk(obsX - 8 + rnd() * 16, rnd() * 8));
  const nFar = Math.floor(120 * farDensity);
  for (let i = 0; i < nFar; i++) { const x = rnd() * 120, y = rnd() * 8; if (Math.hypot(x - obsX, y - obsY) > NEARR) es.push(mk(x, y)); }
  return es;
}
const lod = (es, ox) => En.adaptLOD(es, { observer: [ox, obsY, 0], nearRadius: NEARR, blockSize: BS, spread: 1 });
const fineCount = (r) => r.entities.filter(e => (e.lodMembers || 1) === 1).length;

const R1 = lod(world(1), obsX), R8 = lod(world(8), obsX);

// ① 근거리 fine / 원거리 coarse — near 안은 개별·밖은 블록 합쳐짐(far 블록 ≪ far 개체).
(() => {
  const es = world(4), r = lod(es, obsX);
  const farEntities = es.filter(e => Math.hypot(e.cx - obsX, e.cy - obsY) > NEARR).length;
  ok(r.coarsened > 0 && r.coarsened < farEntities / 3 && fineCount(r) > 5,
    `근거리 fine/원거리 coarse — fine ${fineCount(r)}개(개별)·far ${farEntities}개→블록 ${r.coarsened}개(≪far·합쳐짐)`);
})();

// ② 비용 유계 — far 밀도 ×8 키워도 effective 평탄(블록으로 흡수·비용≠세계 디테일).
ok(R8.entities.length < R1.entities.length * 1.3,
  `비용 유계 — far 밀도 ×8(개체 ${world(1).length}→${world(8).length}) → effective ${R1.entities.length}→${R8.entities.length}(평탄·블록 흡수)`);

// ③ 보존 — coarsen 합산이라 총 질량 정확 보존(LOD bulk exact).
(() => {
  const es = world(8); const m0 = es.reduce((s, e) => s + e.mass, 0), m1 = lod(es, obsX).entities.reduce((s, e) => s + e.mass, 0);
  show(L.conserved('LOD 총 질량(coarsen 합산)', m0, m1, 1e-12));
})();

// ④ 관찰자 따라감 — 관찰자 옮기면 fine 집합이 따라온다(새 위치 근처 개체가 fine).
(() => {
  const es = world(4);
  const rA = lod(es, 20), rB = lod(es, 90);
  const fineNearA = rA.entities.filter(e => (e.lodMembers || 1) === 1 && Math.hypot(e.cx - 20, e.cy - obsY) <= NEARR).length;
  const fineNearB = rB.entities.filter(e => (e.lodMembers || 1) === 1 && Math.hypot(e.cx - 90, e.cy - obsY) <= NEARR).length;
  // obs=20 의 fine 은 x≈20 둘레·obs=90 의 fine 은 x≈90 둘레(서로 다른 집합).
  ok(fineNearA > 3 && fineNearB > 3,
    `관찰자 따라감 — obs20 fine ${fineNearA}개(x≈20 둘레)·obs90 fine ${fineNearB}개(x≈90 둘레)·fine 영역이 관찰자 좇음`);
})();

// ⑤ 결정론.
show(L.deterministic('같은 관찰자 → 같은 LOD', () => lod(world(4), obsX).entities.map(e => [Math.round(e.cx * 1e3), Math.round(e.mass)])));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
