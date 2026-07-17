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

  // ⑨ coarse-grained 위상공간 엔트로피: 공간 셀(nCell²·frozenZ) × 속도 빈(nV²) 히스토그램 →
  //   S = −Σ pᵢ ln pᵢ. 자유 팽창(구석→전체)에서 앙상블 평균이 증가 (열역학 제2법칙 창발).
  //   nCell 은 coarse-graining 노브 — 2배 스캔에도 증가 경향이 유지되어야 정직 (셀 의존성).
  function entropy(world, nCell, nV) {
    nCell = nCell || 6; nV = nV || 4;
    const L = world.box.L, three = !world.frozenZ;
    const vmax = 3 * Math.sqrt(temperature(world) + 1e-9);   // 속도 빈 범위 (±3σ_v)
    const H = new Map(); let N = 0;
    const bin = (x, lo, span, n) => Math.max(0, Math.min(n - 1, Math.floor((x - lo) / span * n)));
    for (const a of world.atoms) {
      const cx = bin(a.r.x, 0, L.x, nCell), cy = bin(a.r.y, 0, L.y, nCell);
      const cz = three ? bin(a.r.z, 0, L.z, nCell) : 0;
      const m = world.mass[a.sp], vx = a.p.x / m, vy = a.p.y / m;
      const bx = bin(vx, -vmax, 2 * vmax, nV), by = bin(vy, -vmax, 2 * vmax, nV);
      const key = cx + ',' + cy + ',' + cz + ',' + bx + ',' + by;
      H.set(key, (H.get(key) || 0) + 1); N++;
    }
    let S = 0; for (const c of H.values()) { const p = c / N; S -= p * Math.log(p); }
    return S;
  }

  // ⑨ 화학 평형 상수: 결합 그래프의 연결 성분 크기별 개수 → 단분자·이량체 → K_c.
  //   K_c = [이량체]/[단분자]² = n_di·V / n_mono²  (V=넓이/부피). 상태 수 의존(부피·온도)이
  //   비율 공식 author 0 로 미시상태 샘플링에서 창발 (커널 체크 4). dissoc = 단분자 원자 분율.
  function equilibrium(world) {
    const idx = new Map(); world.atoms.forEach((a, i) => idx.set(a.id, i));
    const par = world.atoms.map((_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const bd of world.bonds || []) { const ia = idx.get(bd.i), ib = idx.get(bd.j); if (ia != null && ib != null) par[find(ia)] = find(ib); }
    const size = new Map();
    for (let i = 0; i < world.atoms.length; i++) { const r = find(i); size.set(r, (size.get(r) || 0) + 1); }
    let nMono = 0, nDi = 0;
    for (const s of size.values()) { if (s === 1) nMono++; else if (s === 2) nDi++; }
    const L = world.box.L, V = world.frozenZ ? L.x * L.y : L.x * L.y * L.z;
    const Kc = nMono > 0 ? nDi * V / (nMono * nMono) : Infinity;
    const nAtoms = world.atoms.length;
    return { nMono, nDi, Kc, dissoc: nAtoms ? nMono / nAtoms : 0 };
  }

  // ⑨ T_국소: 각 원자의 이웃 k체 병진 KE 평균으로 국소 온도 추정 → 분포 통계.
  //   평형 장면: ⟨T_국소⟩ 가 전역 T 중심 (편차 통계). 아레니우스 hazard 의 T_국소 근사 점검.
  function localTemp(world, k) {
    k = k || 6;
    const A = world.atoms, n = A.length, L = world.box.L, per = world.box.bc === 'periodic';
    if (n === 0) return { mean: 0, std: 0, globalT: 0 };
    const dof = world.frozenZ ? 2 : 3;
    const Ts = [];
    for (let i = 0; i < n; i++) {
      const ds = [];
      for (let j = 0; j < n; j++) { if (j === i) continue;
        let dx = A[i].r.x - A[j].r.x, dy = A[i].r.y - A[j].r.y, dz = A[i].r.z - A[j].r.z;
        if (per) { dx = E.minImage(dx, L.x); dy = E.minImage(dy, L.y); dz = world.frozenZ ? 0 : E.minImage(dz, L.z); }
        ds.push({ d2: dx * dx + dy * dy + dz * dz, j });
      }
      ds.sort((a, b) => a.d2 - b.d2);
      let KE = E.V.lenSq(A[i].p) / (2 * world.mass[A[i].sp]), cnt = 1;
      for (let m = 0; m < Math.min(k, ds.length); m++) { const aj = A[ds[m].j]; KE += E.V.lenSq(aj.p) / (2 * world.mass[aj.sp]); cnt++; }
      Ts.push((2 * KE / cnt) / dof);
    }
    const mean = Ts.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(Ts.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
    return { mean, std, globalT: temperature(world) };
  }

  // ⑫ 광자장 통계 — 입자를 측정 층에서 집계(창발 author 0). 개수·총E·축 정렬 이방성.
  //   alignedFrac = |dir·axis|>0.85 분율 (씨앗 빔 형성 지표). EphotonBin 은 장부값 (Σphoton.E 정합 검증).
  function photonStats(world, refAxis) {
    const ph = world.photons || [];
    const ax = refAxis || { x: 1, y: 0, z: 0 };
    let sumE = 0, aligned = 0;
    for (const p of ph) {
      sumE += p.E;
      if (Math.abs(p.dir.x * ax.x + p.dir.y * ax.y + p.dir.z * ax.z) > 0.85) aligned++;
    }
    return { n: ph.length, sumE, aligned, alignedFrac: ph.length ? aligned / ph.length : 0, EphotonBin: world.ledger.E_photon };
  }

  // ⑫ 광자 에너지 스펙트럼 — 입자를 에너지 빈으로 집계. 2준위 종이면 단색(dE 빈에 집중) — 정직 한계.
  function photonSpectrum(world, nbins, emax) {
    nbins = nbins || 8; emax = emax || 3.0;
    const h = new Array(nbins).fill(0);
    for (const p of world.photons || []) h[Math.min(nbins - 1, Math.max(0, Math.floor(p.E / emax * nbins)))]++;
    return h;
  }

  // ⑬ 축별 운동량 분산 ⟨p_k²⟩ — 등분배(3D z 해동) 확인: x·y·z 가 같아야 z 가 완전한 자유도.
  //   frozenZ 면 z=0(동결 증거). 해동+충돌이면 셋이 수렴(등분배 창발). iso = z/평균(xy) 비율.
  function momentumVariance(world) {
    let sx = 0, sy = 0, sz = 0; const n = world.atoms.length;
    for (const a of world.atoms) { sx += a.p.x * a.p.x; sy += a.p.y * a.p.y; sz += a.p.z * a.p.z; }
    if (!n) return { x: 0, y: 0, z: 0, iso: 0 };
    const x = sx / n, y = sy / n, z = sz / n;
    return { x, y, z, iso: z / Math.max(1e-12, (x + y) / 2) };
  }

  const api = { temperature, msd, momentum, composition, ledgerTable, pressure, minDsigma, occupancy, ionState, molecules, entropy, equilibrium, localTemp, photonStats, photonSpectrum, momentumVariance };
  if (isNode) module.exports = api;
  else window.HktS0Measure = api;
})();
