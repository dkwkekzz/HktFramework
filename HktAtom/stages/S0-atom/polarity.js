// polarity.js — ⑮ 극성 (부분 전하·전기음성도 균등화 QEq). self-contained: 엔진(①–⑭) diff 0.
//
// 큰 그림: 부분 전하는 author 하지 않는다. 분자(연결 성분)마다 **전기음성도 균등화**로 전하가
// 구조에 맞춰 재분배된다 (QEq). 극성은 전하×형상(⑭)에서 창발한다 — O₂ 무극성·BeH₂ 무극성 분자
// (극성 결합 상쇄)·H₂O 극성. 원소별 파라미터는 ③ 유도(author 0).
//
// QEq 에너지: E(q) = Σᵢ(χᵢqᵢ + ½ηᵢqᵢ²) + ½Σᵢⱼ Jᵢⱼqᵢqⱼ − Σᵢ E_ext·rᵢ·qᵢ,  s.t. Σq = Q_분자.
//   χ=(IE+EA)/2 (Mulliken 전기음성도)·η=하드니스 — 둘 다 ③ levels 유도.
//   Jᵢⱼ = k_c/(dᵢⱼ+s) (분자 내 실거리 — 구조 의존). J-항은 pairForces 의 분자내 쿨롱과 동일 →
//   U_elec 에 이미 있음. 새 에너지는 자기항 Σ(χq+½ηq²) 뿐 → U_pol 통에 회계.
//
// 정직(③ 한계): 교과서 η=(IE−EA)/2 는 ③의 간이 친화도(EA>IE 과대평가)로 음수가 되어 QEq 가
//   비볼록(전하 발산). 그래서 **③ 유도 양수 하드니스 프록시 η=IE** 사용(전기음성 원자가 더 단단 —
//   물리적으로 옳은 방향·손 튜닝 0). 전하 부호·앵커는 χ 서열(χ_O>χ_H·χ_H>χ_Be)이 정하며 그건 정확.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;
  const Lv = isNode ? require('./levels.js') : window.HktS0Levels;

  // ③ 유도 Mulliken 파라미터 (Z → χ, IE). author 0 — levels 의 IE·EA 에서.
  const _cache = {};
  function params(Z) {
    if (_cache[Z]) return _cache[Z];
    const occ = Lv.fillZ(Z), IE = Lv.ionizationE(Z, occ), EA = Lv.affinity(Z, occ);
    const chi = (IE + EA) / 2;                 // 전기음성도 (전하 이동 구동)
    return (_cache[Z] = { chi, IE, EA });
  }
  // 하드니스 η_i = 온사이트 쿨롱 자기에너지(k_c/s·②) + 전자 하드니스(IE·③). author 0.
  //   교과서 η=(IE−EA)/2 는 ③ 간이 EA>IE 로 음수 → 대신 온사이트 쿨롱(전하 blob 자기반발)이 지배·안정화.
  //   J_ij(오프사이트·i≠j)는 pairForces 쿨롱과 동일 → 대각 η_i 만 새 에너지(U_pol).
  function hardness(world, Z) { return world.kc / world.soft + params(Z).IE; }

  // 연결 성분 (분자) — bonds 그래프. atom.id → 성분 대표.
  function components(world) {
    const idx = new Map(); world.atoms.forEach((a, i) => idx.set(a.id, i));
    const par = world.atoms.map((_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const bd of world.bonds || []) { const ia = idx.get(bd.i), ib = idx.get(bd.j); if (ia != null && ib != null) par[find(ia)] = find(ib); }
    const comp = new Map();
    world.atoms.forEach((a, i) => { const r = find(i); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(i); });
    return [...comp.values()];
  }

  // 최소 이미지 거리
  function dist(world, a, b) {
    const L = world.box.L, per = world.box.bc === 'periodic';
    let dx = a.r.x - b.r.x, dy = a.r.y - b.r.y, dz = a.r.z - b.r.z;
    if (per) { dx = E.minImage(dx, L.x); dy = E.minImage(dy, L.y); dz = world.frozenZ ? 0 : E.minImage(dz, L.z); }
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // 가우스 소거 (부분 피벗) — (n+1)×(n+1) QEq 계 직접 해. 성분 크기 작음(≤수십).
  function gaussSolve(A, b) {
    const n = b.length;
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (piv !== c) { const t = A[piv]; A[piv] = A[c]; A[c] = t; const tb = b[piv]; b[piv] = b[c]; b[c] = tb; }
      const d = A[c][c] || 1e-12;
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / d; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / (A[r][r] || 1e-12); }
    return x;
  }

  // 전기음성도 균등화: 분자마다 QEq 선형계 풀어 a.dq·a.q 갱신. 자기 에너지 → U_pol 통.
  //   외부장 world.Efield (Vec3, undefined=0). Q_분자 = Σ 기존 정수 전하(중성이면 0).
  function equalize(world) {
    const kc = world.kc, s = world.soft, Ef = world.Efield;
    let Uself = 0;
    for (const comp of components(world)) {
      const n = comp.length;
      const at = comp.map((i) => world.atoms[i]);
      const pr = at.map((a) => params(a.Z || 0));
      const eta = at.map((a) => hardness(world, a.Z || 0));
      const Qtot = at.reduce((q, a) => q + (a.qBase != null ? a.qBase : 0), 0);   // 성분 총 전하 (중성 0)
      // (n+1)×(n+1): [η+J | −1 ; 1ᵀ | 0]
      const A = [], b = [];
      for (let i = 0; i < n; i++) {
        const row = new Array(n + 1).fill(0);
        row[i] = eta[i];
        for (let j = 0; j < n; j++) if (j !== i) row[j] = kc / (dist(world, at[i], at[j]) + s);
        row[n] = -1;
        A.push(row);
        let bi = -pr[i].chi;
        if (Ef) bi += Ef.x * at[i].r.x + Ef.y * at[i].r.y + Ef.z * at[i].r.z;   // −∂(−E·r·q)/∂q = E·r
        b.push(bi);
      }
      const crow = new Array(n + 1).fill(1); crow[n] = 0; A.push(crow); b.push(Qtot);
      const x = gaussSolve(A, b);
      for (let i = 0; i < n; i++) {
        const q = x[i]; at[i].dq = q; at[i].q = (at[i].qBase != null ? at[i].qBase : 0) + q;
        Uself += pr[i].chi * q + 0.5 * eta[i] * q * q;   // 자기 에너지 (온사이트 η 는 J-항과 분리 → 중복 0)
      }
    }
    world.ledger.U_pol = Uself;   // ⑮ 자기 에너지 (J-항은 U_elec 에 이미 있음 — 중복 회계 0)
    world._qeqDone = true;
  }

  // computeForces 합성: QEq(전하 갱신) → pairForces(쿨롱·척력, 부분 전하 반영) → 각도(⑭ 형상).
  //   전하는 준정적(매 force 최소화 → 포락선 정리로 보존). 힘은 pairForces 쿨롱이 이미 −∇(분자내외 쿨롱).
  function forcesPolar(world) {
    equalize(world);
    E.pairForces(world);
    if (world._geoAngular) world._geoAngular(world);   // ⑭ 각도 힘 (있으면)
    // 외부장 힘 F_i = q_i·E_ext (중성 분자 Σq=0 → 알짜힘 0·토크만 → μ 를 E 로 배향). 외부장이라 E 비보존(정직).
    if (world.Efield) {
      const Ef = world.Efield;
      for (const a of world.atoms) { const q = a.q || 0; a.F.x += q * Ef.x; a.F.y += q * Ef.y; if (!world.frozenZ) a.F.z += q * Ef.z; }
    }
  }

  // 측정: 분자 쌍극자 |μ_mol| = |Σ qᵢ(rᵢ−r_com)| · 최대 |전하| · 결합 쌍극자(원자쌍 전하차).
  function dipoles(world) {
    const out = [];
    for (const comp of components(world)) {
      const at = comp.map((i) => world.atoms[i]);
      let cx = 0, cy = 0, cz = 0, M = 0;
      for (const a of at) { const m = world.mass[a.sp]; cx += a.r.x * m; cy += a.r.y * m; cz += a.r.z * m; M += m; }
      cx /= M; cy /= M; cz /= M;
      let mx = 0, my = 0, mz = 0, maxAbsQ = 0;
      for (const a of at) {
        const q = a.q || 0; mx += q * (a.r.x - cx); my += q * (a.r.y - cy); mz += q * (a.r.z - cz);
        maxAbsQ = Math.max(maxAbsQ, Math.abs(q));
      }
      out.push({ n: at.length, muMol: Math.sqrt(mx * mx + my * my + mz * mz), maxAbsQ, sumQ: at.reduce((s, a) => s + (a.q || 0), 0) });
    }
    return out;
  }

  // 외부장 속 배향 질서: 분자 쌍극자와 장 방향 정렬 ⟨cosθ⟩ (유전 응답 정성 지표).
  function orientationOrder(world) {
    const Ef = world.Efield; if (!Ef) return 0;
    const en = Math.sqrt(Ef.x * Ef.x + Ef.y * Ef.y + Ef.z * Ef.z) || 1;
    let sum = 0, cnt = 0;
    for (const comp of components(world)) {
      const at = comp.map((i) => world.atoms[i]);
      let cx = 0, cy = 0, cz = 0, M = 0;
      for (const a of at) { const m = world.mass[a.sp]; cx += a.r.x * m; cy += a.r.y * m; cz += a.r.z * m; M += m; }
      cx /= M; cy /= M; cz /= M;
      let mx = 0, my = 0, mz = 0;
      for (const a of at) { const q = a.q || 0; mx += q * (a.r.x - cx); my += q * (a.r.y - cy); mz += q * (a.r.z - cz); }
      const mn = Math.sqrt(mx * mx + my * my + mz * mz); if (mn < 1e-6) continue;
      sum += (mx * Ef.x + my * Ef.y + mz * Ef.z) / (mn * en); cnt++;
    }
    return cnt ? sum / cnt : 0;
  }

  const api = { params, equalize, forcesPolar, dipoles, orientationOrder, components, gaussSolve };
  if (isNode) module.exports = api;
  else window.HktS0Polarity = api;
})();
