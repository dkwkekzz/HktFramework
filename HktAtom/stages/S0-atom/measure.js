// measure.js — 측정 M. 창발은 author 하지 않고 측정한다 (KERNEL §3.2).
//
// 세부 단계 ①은 관측량이 소박하다: 온도 T·평균제곱변위 MSD·장부 통 표·
// 조성 시그니처·총 운동량. 이후 단계가 이 위에 구조·스펙트럼·엔트로피를 더한다.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  // 온도 (전역): T = ⟨p²/2m⟩ / (자유도/2). 자유도는 frozenZ 반영 (동결 시 입자당 2).
  function temperature(world) {
    const n = world.atoms.length;
    if (n === 0) return 0;
    const dofPer = world.frozenZ ? 2 : 3;
    // K_tr = (dof_total/2)·T  →  T = 2·K_tr / (N·dofPer)
    return (2 * world.ledger.K_tr) / (n * dofPer);
  }

  // 평균제곱변위 — 활성 원자의 누적 참 변위(주기 랩 무관). 자유 비행에선 탄도적(∝t²).
  function msd(world) {
    const n = world.atoms.length;
    if (n === 0) return 0;
    let s = 0;
    for (const a of world.atoms) s += E.V.lenSq(a.disp);
    return s / n;
  }

  // 총 운동량 (활성 + 탈출). 열린 경계에서도 P + P_escape 가 보존된다.
  function momentum(world) {
    const P = E.V.zero();
    for (const a of world.atoms) E.V.addInto(P, a.p);
    E.V.addInto(P, world.ledger.P_escape);
    return P;
  }

  // 조성 시그니처 — 종별 개수 (활성 + 탈출). 반응이 없으므로 시간 불변 (Σc 회계).
  function composition(world) {
    const c = {};
    const add = (a) => { c[a.sp] = (c[a.sp] || 0) + 1; };
    for (const a of world.atoms) add(a);
    for (const a of world.escaped) add(a);
    return c;
  }

  // 장부 통 표 + 총합. 총합 = Σ(전 통) 이 시간 상수여야 한다.
  function ledgerTable(world) {
    const t = {};
    for (const b of E.LEDGER_BINS) t[b] = world.ledger[b];
    t.total = E.ledgerTotal(world);
    return t;
  }

  const api = { temperature, msd, momentum, composition, ledgerTable };
  if (isNode) module.exports = api;
  else window.HktS0Measure = api;
})();
