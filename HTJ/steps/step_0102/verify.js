// step_0102/verify.js — (조립) 강수 구동 비: 기후 precip 장(0097)이 SPH 빗방울을 낳는다(기후→물).
//   조립 step — 부품(SPH 압력/점성/경계·biomeField precip)은 부품 verify 가 보증. 여기선 *새로 생긴 결합*만:
//   비가 precip∝확률로 와서 정착하면 *습한 기후에 물이 더 많다*(소스 결합). 지형(salt TERR)·강수(salt H) 무상관.
//   순수·독립·영구. 실행: node HTJ/steps/step_0102/verify.js
'use strict';
const path = require('path');
const Sph = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Stream = require(path.resolve(__dirname, '../../viewer/htj-stream.js'));
const L = require(path.resolve(__dirname, '../../tools/htj-verify-lib.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
const show = (r) => ok(r.pass, `${r.name} = ${r.value}`);

const R = 14, SCALE = 0.10, AMP = 6, G = 4, DT = 0.02;
const terr = (x, y) => AMP * Stream.fbm((x + 100) * SCALE, (y + 100) * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
const bf = Stream.biomeField({ scale: SCALE, nTemp: 3, nHum: 3, octaves: 4, gain: 0.55, latAmp: 0.7, latPeriod: 64 });   // 남북 기후 띠(0093)
const precipAt = (x, y) => bf(x + 100, y + 100).precip;
const popt = { stiffness: 80, h: 2.2, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.2, gamma: 2 }, bopt = { stiffness: 200, damp: 40, skin: 0.6 };

function anchors() {
  const an = [], AR = 4, DXY = 2.0;
  for (let x = -R; x <= R + 1e-9; x += DXY) for (let y = -R; y <= R + 1e-9; y += DXY) an.push({ cx: x, cy: y, cz: terr(x, y) - AR, radius: AR });
  for (let t = -R; t <= R + 1e-9; t += 2.4) for (let z = 0; z <= AMP + 12; z += 3) {
    an.push({ cx: t, cy: -R - 2, cz: z, radius: 5 }); an.push({ cx: t, cy: R + 2, cz: z, radius: 5 });
    an.push({ cx: -R - 2, cy: t, cz: z, radius: 5 }); an.push({ cx: R + 2, cy: t, cz: z, radius: 5 });
  }
  return an;
}
function buildCDF() {
  const cells = [], DXY = 1.4; let tot = 0; const all = [];
  for (let x = -R + 2; x <= R - 2 + 1e-9; x += DXY) for (let y = -R + 2; y <= R - 2 + 1e-9; y += DXY) {
    const p = precipAt(x, y); tot += p; cells.push({ x, y, cum: tot }); all.push(p);
  }
  const s = all.slice().sort((a, b) => a - b);
  return { cells, tot, p33: s[Math.floor(all.length / 3)], p66: s[Math.floor(2 * all.length / 3)] };
}

function run() {
  const an = anchors(), cdf = buildCDF(), water = [];
  let seed = 7; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let spawned = 0;
  for (let step = 0; step < 24; step++) {
    if (step < 18) for (let i = 0; i < 12; i++) {       // 비 — precip∝확률로 셀 골라 떨굼
      const u = rnd() * cdf.tot; let lo = 0, hi = cdf.cells.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf.cells[mid].cum < u) lo = mid + 1; else hi = mid; }
      const c = cdf.cells[lo];
      water.push({ cx: c.x + (rnd() - .5) * 1.2, cy: c.y + (rnd() - .5) * 1.2, cz: AMP + 10, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1, spawnP: precipAt(c.x, c.y) });
      spawned++;
    }
    for (let s = 0; s < 32; s++) {
      Sph.sphPressureForce(water, DT, popt); Sph.sphViscosity(water, DT, vopt);
      for (const p of water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(water, an, DT, bopt);
      En.stepEntities(water, DT);
    }
  }
  return { water, spawned, p33: cdf.p33, p66: cdf.p66 };
}

const Wd = run();

// ① 기후 소스 결합(법칙) — 비가 precip∝확률로 온다: 습한 ⅓ 셀이 받은 비 / 건조한 ⅓ 셀이 받은 비.
(() => {
  let wet = 0, dry = 0;
  for (const p of Wd.water) { if (p.spawnP >= Wd.p66) wet++; else if (p.spawnP < Wd.p33) dry++; }
  const ratio = wet / Math.max(dry, 1);
  ok(ratio > 1.5, `기후 소스 결합 — 습한 ⅓ 가 받은 비 ${wet} / 건조한 ⅓ ${dry} = ${ratio.toFixed(2)}× (비가 precip 따라 온다·>1.5)`);
})();

// ② 동적 정착 — 떨군 비가 *실제 물처럼 쉰다*(동적 SPH): 정착 후 잔류 속도 ≪ 낙하 속도(v_drop≈√(2gh)≈9).
//   소스가 정적 장 표시가 아니라 *동적 입자*라는 증거 — 떨어져 지형에 받쳐 멈춘 물의 층(탄도 추락 아님).
(() => {
  const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const sp = mean(Wd.water.map(p => Math.hypot(p.px, p.py, p.pz) / (p.mass || 1)));
  ok(sp < 3, `동적 정착 — 정착 후 잔류 평균속도 ${sp.toFixed(2)} ≪ 낙하속도 ≈9 (비가 실제 물로 쉰다·<3)`);
})();

// ③ 생성 장부 보존 — 떨군 비 수 = 입자 수(빗방울은 사라지지 않는다).
ok(Wd.spawned === Wd.water.length, `생성 장부 보존 — Σ떨군 비 ${Wd.spawned} = Σ입자 ${Wd.water.length}(빗방울은 사라지지 않음)`);

// ④ 결정론 — 같은 비 → 같은 물 분포(위치 지문).
show(L.deterministic('같은 강수 구동 → 같은 물', () => run().water.map(p => [Math.round(p.cx * 1e3), Math.round(p.cy * 1e3)])));

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAIL'}  (${pass}/${pass + fail})`);
process.exit(fail === 0 ? 0 : 1);
