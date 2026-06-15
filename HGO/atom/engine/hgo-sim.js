// hgo-sim.js — 조립 (createSim / step / run)
;(function (root, factory) {
  const L = (typeof require !== 'undefined') ? require('./hgo-laws.js') : root.HGO.laws;
  const mod = factory(L);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).sim = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L) {
  'use strict';

  // spec: { W, H, atoms:[{Z,N,e,x,rx,ry,vx,vy}], knobs:{} }
  function createSim(spec) {
    return {
      W: spec.W, H: spec.H,
      atoms: spec.atoms,
      knobs: Object.assign({}, L.DEFAULTS, spec.knobs || {}),
      tick: 0,
    };
  }

  // 한 tick: 힘(법칙) → 적분 → tick++ . 순서가 결정론을 고정한다.
  function step(sim) {
    L.applyForces(sim);
    L.integrate(sim);
    sim.tick++;
  }

  function run(sim, ticks) { for (let i = 0; i < ticks; i++) step(sim); return sim; }

  function cloneAtoms(atoms) { return atoms.map(a => Object.assign({}, a)); }

  return { createSim, step, run, cloneAtoms };
});
