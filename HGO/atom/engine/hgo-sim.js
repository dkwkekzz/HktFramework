// hgo-sim.js — 조립 (createSim / step / run)
;(function (root, factory) {
  const L = (typeof require !== 'undefined') ? require('./hgo-laws.js') : root.HGO.laws;
  const mod = factory(L);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).sim = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L) {
  'use strict';

  // spec: { W, H, D?, atoms:[{Z,N,e,x,rx,ry,vx,vy, rz?,vz?}], knobs:{}, rng? }
  // photons: 방출 법칙이 쌓는 복사장(step-0002~). 빈 배열 → 과거 장부·해시 불변(가법).
  // rng: 런타임 시드 의사난수(자발 방출 등 확률 법칙용). 장면 init 이 결정론적으로 만든다.
  // D: z축 토러스 깊이(step-0106, 미설정 → W·2D 무대 무영향) · rz·vz: z 좌표·속도(미설정 → 2D·회귀 0).
  function createSim(spec) {
    return {
      W: spec.W, H: spec.H, D: spec.D || spec.W,
      atoms: spec.atoms,
      photons: [],
      rng: spec.rng || null,
      knobs: Object.assign({}, L.DEFAULTS, spec.knobs || {}),
      tick: 0,
    };
  }

  // 한 tick: 힘(법칙) → 적분 → tick++ . 순서가 결정론을 고정한다.
  //   symplectic 게이트(step-0069, 기본 0 → 옛 경로·회귀 0): 1 이면 velocity-Verlet(leapfrog·2차)로 보존 연속력 적분(깊은 붕괴 E 누적 해소).
  function step(sim) {
    if (sim.knobs.symplectic) L.leapfrog(sim);   // velocity-Verlet(반-kick→drift→반-kick→이벤트 1회)
    else { L.applyForces(sim); L.integrate(sim); }  // symplectic Euler(전 kick→drift·과거 비트 동일)
    sim.tick++;
  }

  function run(sim, ticks) { for (let i = 0; i < ticks; i++) step(sim); return sim; }

  function cloneAtoms(atoms) { return atoms.map(a => Object.assign({}, a)); }

  return { createSim, step, run, cloneAtoms };
});
