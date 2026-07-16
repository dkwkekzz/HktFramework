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

  // 압력 (비리얼): P·V = N·T + ⟨Σ r·F⟩/dim. dim·V 는 frozenZ 반영 (동결 시 2D 넓이).
  function pressure(world) {
    const n = world.atoms.length;
    if (n === 0) return 0;
    const dim = world.frozenZ ? 2 : 3;
    const L = world.box.L;
    const vol = world.frozenZ ? (L.x * L.y) : (L.x * L.y * L.z);
    const T = temperature(world);
    return (n * T + world.virial / dim) / vol;
  }

  // 최근접 비율 min d/σᵢⱼ (겹침 감시) — pairForces 가 world 에 남긴 값
  function minDsigma(world) { return world.minDsigma; }

  // ④ 준위 점유: n0·n1·들뜸 비율 + 현재 T 에서의 볼츠만 예측 (g1/g0)e^{−ΔE/T}
  function occupancy(world) {
    let n0 = 0, n1 = 0;
    for (const a of world.atoms) { if (a.level > 0) n1++; else n0++; }
    const T = temperature(world);
    let predRatio = null;
    if (world.specLevels && world.atoms.length) {
      const sp = world.atoms[0].sp, Lv = world.specLevels[sp];
      predRatio = (Lv.g1 / Lv.g0) * Math.exp(-Lv.dE / Math.max(1e-9, T));
    }
    return { n0, n1, frac: n1 / Math.max(1, n0 + n1), ratio: n1 / Math.max(1e-9, n0), T, predRatio, nPhotons: world.nPhotons };
  }

  // ⑤ 전하 상태: +/−/중성 개수 · 이온화 분율 · 이온 교대 질서 파라미터.
  //   질서 = −⟨qᵢqⱼ⟩ (접촉쌍) — 양수 = 이웃이 반대 전하(교대 격자·이온 응집).
  function ionState(world) {
    let plus = 0, minus = 0, neutral = 0;
    for (const a of world.atoms) { if (a.q > 0) plus++; else if (a.q < 0) minus++; else neutral++; }
    // 접촉쌍 전하 상관
    const L = world.box.L, per = world.box.bc === 'periodic', rc2 = (world.rc || 1.6) * (world.rc || 1.6);
    let sum = 0, cnt = 0, A = world.atoms;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      let dx = A[i].r.x - A[j].r.x, dy = A[i].r.y - A[j].r.y, dz = A[i].r.z - A[j].r.z;
      if (per) { dx -= L.x * Math.round(dx / L.x); dy -= L.y * Math.round(dy / L.y); if (!world.frozenZ) dz -= L.z * Math.round(dz / L.z); else dz = 0; }
      if (dx * dx + dy * dy + dz * dz <= rc2) { sum += A[i].q * A[j].q; cnt++; }
    }
    const n = world.atoms.length;
    return { plus, minus, neutral, frac: (plus + minus) / Math.max(1, n), order: cnt ? -sum / cnt : 0, nElectrons: world.electrons.length };
  }

  // ⑥ 분자: 결합 그래프의 연결 성분 → 조성 시그니처 히스토그램 · 과결합 · 결합/복합체 수.
  function molecules(world) {
    const idx = new Map(); world.atoms.forEach((a, i) => idx.set(a.id, i));
    const par = world.atoms.map((_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const bd of world.bonds || []) { const ia = idx.get(bd.i), ib = idx.get(bd.j); if (ia != null && ib != null) par[find(ia)] = find(ib); }
    const comp = new Map();
    world.atoms.forEach((a, i) => { const r = find(i); if (!comp.has(r)) comp.set(r, {}); const c = comp.get(r); c[a.sp] = (c[a.sp] || 0) + 1; });
    const hist = {};
    for (const c of comp.values()) { const sig = Object.keys(c).sort().map((k) => k + c[k]).join(''); hist[sig] = (hist[sig] || 0) + 1; }
    let maxOver = 0;
    for (const a of world.atoms) {
      let bc = 0; for (const b of world.bonds || []) if (b.i === a.id || b.j === a.id) bc += b.order;
      maxOver = Math.max(maxOver, bc - (world.budget ? (world.budget[a.sp] || 0) : 0));
    }
    return { hist, maxOver, nBonds: (world.bonds || []).length, nComplex: (world.complexes || []).length };
  }

  // 장부 통 표 + 총합. 총합 = Σ(전 통) 이 시간 상수여야 한다.
  function ledgerTable(world) {
    const t = {};
    for (const b of E.LEDGER_BINS) t[b] = world.ledger[b];
    t.total = E.ledgerTotal(world);
    return t;
  }

  const api = { temperature, msd, momentum, composition, ledgerTable, pressure, minDsigma, occupancy, ionState, molecules };
  if (isNode) module.exports = api;
  else window.HktS0Measure = api;
})();
