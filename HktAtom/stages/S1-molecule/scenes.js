// scenes.js — S1 입력 로드 + 장면 빌더. 입력은 input.json(=S0 output.json) 하나 (KERNEL §1).
//
// 로더는 input 객체를 받아 분자 개체를 실체화한다. node 는 require('./input.json'),
// 브라우저는 index.html 이 같은 JSON 을 window.HktS1Input 으로 인라인(file:// fetch 불가 회피·
// input.json 이 정본·인라인은 뷰잉 스냅샷). 코드 화살표 0 — 오직 데이터로만 S0 를 잇는다.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS1Engine;

  // 입력 스키마 검증 (계약 소비 — KERNEL §7 기둥 4). S0 output-v0 만 받는다.
  function validateInput(inp) {
    const errs = [];
    const req = (c, m) => { if (!c) errs.push(m); };
    req(inp && inp.schema === 's0-output-v0', 'schema=s0-output-v0');
    req(Array.isArray(inp.species) && inp.species.length >= 1, 'species ≥ 1');
    for (const s of inp.species || []) req(s.id && s.composition && typeof s.m === 'number', 'species 필드 ' + (s && s.id));
    req(inp.macro && inp.macro.atomCount && typeof inp.macro.V === 'number', 'macro.atomCount·V');
    req(inp.pairPotential && typeof inp.pairPotential === 'object', 'pairPotential');
    return { ok: errs.length === 0, errs };
  }

  // 분자 목록 전개: species[].count 만큼 개체 명세를 만든다 (Σc 는 input.macro.atomCount 와 일치해야).
  function expand(inp) {
    const list = [];
    for (const s of inp.species) for (let k = 0; k < (s.count || 1); k++) list.push({ sig: s.id, c: s.composition, m: s.m, Ebind: s.E_bind || 0 });
    return list;
  }

  // s1-stage: ① 무대 — 입력 분자들을 상자에 배치, 힘 0 자유 비행. 입력 T 로 맥스웰 씨앗·COM 제거(P=0).
  //   상자 부피는 input.macro.V (S0 가 넘긴 거시 부피) — 밀도 정합. 3D (⑬ 이후 세계 3D).
  function stage(inp, opts) {
    const o = opts || {};
    const rng = o.rng || E.makeRng(o.seed || 1101);
    const list = expand(inp);
    const Vbox = o.V != null ? o.V : inp.macro.V;
    const L = o.L != null ? o.L : Math.cbrt(Vbox);
    const T0 = o.T0 != null ? o.T0 : (inp.macro.T != null ? inp.macro.T : 0.3);
    const w = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.01,
      box: { L: E.V.make(L, L, L), bc: o.bc || 'periodic' }, frozenZ: !!o.frozenZ, rng,
      pairV: inp.pairPotential,
    });
    for (const spec of list) {
      const r = E.V.make(rng() * L, rng() * L, w.frozenZ ? 0 : rng() * L);
      w.mols.push(E.makeMolecule({ sig: spec.sig, c: spec.c, m: spec.m, Ebind: spec.Ebind, Tint: T0, r, p: E.V.zero() }));
    }
    maxwell(w, T0, rng);
    E.recomputeLedger(w);
    w._meta = { name: 's1-stage', N: w.mols.length, fromV: Vbox };
    return w;
  }

  // 맥스웰 속도 씨앗 + COM 표류 제거 (P=0 정확). 3D/2D 분기.
  function maxwell(world, T0, rng) {
    const P = E.V.zero();
    for (const m of world.mols) {
      const s = Math.sqrt(m.m * Math.max(1e-9, T0));
      m.p.x = s * E.gaussian(rng); m.p.y = s * E.gaussian(rng); m.p.z = world.frozenZ ? 0 : s * E.gaussian(rng);
      E.V.addInto(P, m.p);
    }
    const n = world.mols.length; if (!n) return;
    for (const m of world.mols) { m.p.x -= P.x / n; m.p.y -= P.y / n; if (!world.frozenZ) m.p.z -= P.z / n; }
    // COM 제거 후 정확 T0 로 재척도 (유한 N 요동 제거 — 무대 씨앗은 결정적 T). dof = COM 3 자유도 뺀 값.
    const dof = (world.frozenZ ? 2 : 3) * n - (world.frozenZ ? 2 : 3);
    let K = 0; for (const m of world.mols) K += E.V.lenSq(m.p) / (2 * m.m);
    const Tc = 2 * K / Math.max(1, dof);
    if (Tc > 1e-12) { const s = Math.sqrt(T0 / Tc); for (const m of world.mols) { m.p.x *= s; m.p.y *= s; if (!world.frozenZ) m.p.z *= s; } }
  }

  const api = { validateInput, expand, stage, maxwell };
  if (isNode) module.exports = api;
  else window.HktS1Scenes = api;
})();
