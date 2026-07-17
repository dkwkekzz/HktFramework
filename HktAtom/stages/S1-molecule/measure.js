// measure.js — S1 측정 M. 창발은 author 하지 않고 측정 (KERNEL §3.2). ①은 관측량이 소박하다.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS1Engine;

  // 온도: T = ⟨p²/2m⟩ / (자유도/2). 자유도 = frozenZ 반영.
  function temperature(world) {
    const n = world.mols.length; if (!n) return 0;
    const dof = world.frozenZ ? 2 : 3;
    return 2 * world.ledger.K_tr / (n * dof);
  }
  // 총 운동량 (활성 + 탈출) — 열린 경계에서도 P + P_escape 보존.
  function momentum(world) { const P = E.V.zero(); for (const m of world.mols) E.V.addInto(P, m.p); E.V.addInto(P, world.ledger.P_escape); return P; }
  // 조성 다발 Σc: 전 분자 c 를 원자종별로 합산 (활성 + 탈출). 반응 없으므로 시간 불변.
  function composition(world) {
    const c = {};
    const add = (m) => { for (const sp in m.c) c[sp] = (c[sp] || 0) + m.c[sp]; };
    for (const m of world.mols) add(m); for (const m of world.escaped) add(m);
    return c;
  }
  // 분자종 히스토그램 (구조 카탈로그 — 반응 없으면 input 과 일치).
  function speciesHist(world) { const h = {}; for (const m of world.mols) h[m.sig] = (h[m.sig] || 0) + 1; return h; }
  // 평균제곱변위 (자유 비행이면 탄도적 ∝ t²).
  function msd(world) { const n = world.mols.length; if (!n) return 0; let s = 0; for (const m of world.mols) s += E.V.lenSq(m.disp); return s / n; }
  // 압력 (비리얼): P·V = N·T + ⟨Σr·F⟩/dim. ①은 virial 0 → 이상기체 P=N T/V.
  function pressure(world) {
    const n = world.mols.length; if (!n) return 0;
    const dim = world.frozenZ ? 2 : 3, L = world.box.L;
    const vol = world.frozenZ ? L.x * L.y : L.x * L.y * L.z;
    return (n * temperature(world) + world.virial / dim) / vol;
  }
  // 장부 통 표 + 총합.
  function ledgerTable(world) { const t = {}; for (const b of E.LEDGER_BINS) t[b] = world.ledger[b]; t.total = E.ledgerTotal(world); return t; }

  const api = { temperature, momentum, composition, speciesHist, msd, pressure, ledgerTable };
  if (isNode) module.exports = api;
  else window.HktS1Measure = api;
})();
