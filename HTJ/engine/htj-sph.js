// htj-sph.js — HTJ 구체 세계 SW5(구체 유체·SPH)의 *첫 벽돌*: 커널 밀도 추정.
//
//   design/sphere-world.md §6 SW5 / §3 — "가스·유체 = 작은 구체 떼(SPH 압력·확산)". 지금 유체는 격자
//   (0002~0013)에 있다. SW5 는 그 유체를 *구체(SPH 입자)*로 옮겨 격자를 은퇴시키는 최후 단계 — 큰 작업이라
//   측정된 필요가 올 때 *가법적*으로 한 벽돌씩 쌓는다(design §5 난점 3·§7 측정으로 결정). 이 첫 step 은
//   SPH 의 토대 = **밀도 추정**: 입자가 *어디에 얼마나 모였는지*를 이웃 합으로 잰다. 압력·점성·확산 등 모든
//   SPH 힘이 이 밀도 위에 선다(0009 의 온도가 수동으로 먼저 도입돼 0010 압력의 토대가 된 것과 같은 정신).
//
//   SPH 밀도(Monaghan): ρ_i = Σ_j m_j · W(|r_i − r_j|, h)   — 이웃 입자 질량을 *부드러운 커널* W 로 가중 합산.
//   커널 = 3D 3차 B-스플라인(cubic spline), 평활길이 h·지지반경 2h·정규화 ∫W dV = 1(연속 극한 밀도 정확):
//       W(r,h) = (1/π h³) · { 1 − 1.5q² + 0.75q³      (0 ≤ q < 1)
//                             0.25(2−q)³               (1 ≤ q < 2)     (q = r/h)
//                             0                         (q ≥ 2) }
//   자기 기여(j=i, r=0 → W=σ) 포함 = 표준 SPH. 균일 분포면 ρ → m·n₀(참 밀도), 모이면 ρ↑(국소 밀도).
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다). 이 단위는 *수동 측정*:
//   밀도는 입자 descriptor 에 `density` 로 쓰일 뿐 *아직 힘을 만들지 않는다*(회귀 0). 압력 힘(∇W·운동량 보존
//   쌍힘)·점성·열은 후속 SW5 step. O(N²) 직접 합산(이웃 탐색 가속은 0032 Barnes-Hut 처럼 후속 최적화).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJSPH = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 3D 3차 B-스플라인 커널 W(r,h) — 지지반경 2h·정규화 ∫W dV=1·짝함수(W(r)=W(−r)).
  function kernelW(r, h) {
    if (h <= 0) return 0;
    const q = Math.abs(r) / h, sigma = 1 / (Math.PI * h * h * h);   // 거리(짝함수) — 부호 무관
    if (q < 1) return sigma * (1 - 1.5 * q * q + 0.75 * q * q * q);
    if (q < 2) { const a = 2 - q; return sigma * 0.25 * a * a * a; }
    return 0;
  }

  // SPH 밀도 추정 — ρ_i = Σ_j m_j·W(|r_i−r_j|, h). 각 입자에 density 를 써 넣고 목록을 반환.
  //   자기 기여(j=i) 포함(표준 SPH). opts: { h(평활길이, 기본 1) }. O(N²) 직접 합산.
  //   수동 양 — 밀도는 *측정*일 뿐 이 단위에선 아무 힘도 만들지 않는다(회귀 0). 입력을 제자리 변형해 반환.
  function sphDensity(particles, opts) {
    opts = opts || {};
    const h = opts.h != null ? opts.h : 1;
    const n = particles.length;
    const grid = resolveGrid(particles, h, opts);             // null 이면 brute(기본·회귀 0)
    for (let i = 0; i < n; i++) {
      const a = particles[i];
      let rho = 0;
      const nb = grid ? sphNeighbors(grid, particles, i) : null;   // 이웃 후보(오름차순) 또는 전체
      const cnt = nb ? nb.length : n;
      for (let t = 0; t < cnt; t++) {
        const b = particles[nb ? nb[t] : t];                 // 지지 밖(먼 쌍)은 W=0 정확 → 빠뜨려도 합 동일
        const dx = a.cx - b.cx, dy = a.cy - b.cy, dz = a.cz - b.cz;
        rho += (b.mass || 0) * kernelW(Math.sqrt(dx * dx + dy * dy + dz * dz), h);
      }
      a.density = rho;
    }
    return particles;
  }

  // SPH 적응 평활길이 h_i — 입자마다 *자기 분해능*을 갖는다(밀도 높으면 좁게·낮으면 넓게).
  //   고정 h 는 붕괴 코어(밀도 자릿수 변화)를 과평활하거나 희박부를 못 분해한다. 표준 SPH 는 h_i 를 국소
  //   밀도에 묶어 *이웃 수를 일정*하게 유지한다 — 3D 에서  h_i = η·(m_i/ρ_i)^(1/3)  (η=이웃 수 노브).
  //   ρ_i 가 h_i 에 의존하므로 *자기일관*(고정점 반복)으로 푼다:
  //       ρ_i^(k) = Σ_j m_j W(r_ij, h_i^(k)),   h_i^(k+1) = η (m_i/ρ_i^(k))^(1/3)   수렴까지.
  //   이건 SW4 적응 LOD(분해능이 물질을 따라감)의 SPH·연속판 — 비용이 디테일에 묶인다. 0040 밀도처럼
  //   *수동 측정*: a.h·a.density 만 써넣고 힘은 안 만든다(신규 함수·호출처 없음→회귀 0). 적응-h 힘(대칭
  //   커널·grad-h)은 후속 벽돌. opts: { eta(기본 1.3), h0(초기·기본 1), iters(최대 반복·기본 30), tol(상대 수렴·1e-5) }.
  function sphAdaptiveH(particles, opts) {
    opts = opts || {};
    const eta = opts.eta != null ? opts.eta : 1.3;
    const h0 = opts.h0 != null ? opts.h0 : 1;
    const iters = opts.iters != null ? opts.iters : 30;
    const tol = opts.tol != null ? opts.tol : 1e-5;
    const n = particles.length;
    const densAt = (a, h) => {                                 // ρ(a; h) = Σ_j m_j W(r_aj, h)
      let rho = 0;
      for (let j = 0; j < n; j++) {
        const b = particles[j];
        const dx = a.cx - b.cx, dy = a.cy - b.cy, dz = a.cz - b.cz;
        rho += (b.mass || 0) * kernelW(Math.sqrt(dx * dx + dy * dy + dz * dz), h);
      }
      return rho;
    };
    for (let i = 0; i < n; i++) {
      const a = particles[i];
      let h = (a.h != null && a.h > 0) ? a.h : h0;             // 따뜻한 시작(이전 프레임 h 재사용 가능)
      for (let k = 0; k < iters; k++) {                        // 고정점 반복(감쇠 불필요·단조 수렴)
        const rho = densAt(a, h);
        const hNew = rho > 0 ? eta * Math.cbrt((a.mass || 0) / rho) : h;   // h_i = η(m_i/ρ_i)^⅓
        const rel = Math.abs(hNew - h) / (h || 1);
        h = hNew;
        if (rel < tol) break;
      }
      a.h = h;
      a.density = densAt(a, h);                                // 최종 h 로 ρ 재계산 → (h,ρ) 진짜 자기일관
    }
    return particles;
  }

  // 커널 기울기 ∇_i W(r_i−r_j, h) — 압력·점성 등 모든 SPH 쌍힘의 방향·크기. (dx,dy,dz)=r_i−r_j.
  //   ∇_i W = (dW/dr)·(r_i−r_j)/r,  dW/dr = (σ/h)·f'(q),  σ = 1/(π h³),  q = r/h:
  //     f'(q) = −3q + 2.25q²     (0 ≤ q < 1)
  //           = −0.75(2−q)²       (1 ≤ q < 2)
  //           = 0                  (q ≥ 2)
  //   r→0 에서 f'(0)=0 → 기울기 0(특이점 없음). 반대칭 ∇_i W = −∇_j W(쌍힘 운동량 보존의 뿌리).
  function kernelGradW(dx, dy, dz, h) {
    if (h <= 0) return [0, 0, 0];
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (r < 1e-12) return [0, 0, 0];                          // 동일 위치 → 방향 불정·f'(0)=0
    const q = r / h, sigma = 1 / (Math.PI * h * h * h);
    let fp;
    if (q < 1) fp = -3 * q + 2.25 * q * q;
    else if (q < 2) { const a = 2 - q; fp = -0.75 * a * a; }
    else return [0, 0, 0];
    const c = (sigma / h) * fp / r;                           // (dW/dr)/r
    return [c * dx, c * dy, c * dz];
  }

  // ── SPH 이웃 탐색 가속: 균일 공간 격자(셀 리스트) ─────────────────────────────────────────────
  //   SPH 합(밀도·압력·점성)은 지지반경 2h 안의 이웃만 기여한다 — 멀리 있는 입자는 커널 W=0·∇W=0(정확). 그런데
  //   sphDensity/force 의 기본 경로는 O(N²) 모든 쌍을 본다. 셀 크기를 지지반경(2h)으로 잡아 입자를 버킷에 담으면,
  //   한 입자의 이웃은 *자기 셀 + 인접 26 셀(3×3×3)* 안에만 있다(분리 ≤2h → 셀 인덱스 차 ≤1). 균일 밀도면 셀당
  //   입자 수가 일정 → 이웃 탐색이 O(N)(0032 Barnes-Hut 가 중력을 O(N log N) 으로 줄인 것의 SPH·근거리 판).
  //   **물리는 불변** — 가속은 *같은 쌍을 같은 순서로* 방문하므로(이웃 오름차순 정렬·먼 쌍은 어차피 0 기여)
  //   brute 와 비트 동일(0016/0018 "조밀과 비트 동일"의 SPH 판). opts: { h(평활길이·셀 크기=2h, 기본 1) }.
  function sphNeighborGrid(particles, opts) {
    opts = opts || {};
    const h = opts.h != null ? opts.h : 1;
    const inv = 1 / (2 * h);                                  // 셀 크기 = 지지반경 2h
    const map = new Map();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const key = Math.floor(p.cx * inv) + ':' + Math.floor(p.cy * inv) + ':' + Math.floor(p.cz * inv);
      let arr = map.get(key); if (!arr) { arr = []; map.set(key, arr); }
      arr.push(i);                                            // 버킷엔 인덱스가 오름차순으로 쌓임
    }
    return { map, inv };
  }

  // 입자 i 의 이웃 후보 인덱스(자기 셀 + 26 인접 = 27 셀)를 모아 *오름차순 정렬*해 반환(자기 자신 포함).
  //   정렬 → 합 순서가 brute(j=0..n−1)와 같아져 밀도·힘이 비트 동일. 27 셀이 지지반경 2h 를 완전히 덮는다.
  function sphNeighbors(grid, particles, i) {
    const inv = grid.inv, p = particles[i];
    const a = Math.floor(p.cx * inv), b = Math.floor(p.cy * inv), c = Math.floor(p.cz * inv);
    const out = [];
    for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (let dc = -1; dc <= 1; dc++) {
      const arr = grid.map.get((a + da) + ':' + (b + db) + ':' + (c + dc));
      if (arr) for (let t = 0; t < arr.length; t++) out.push(arr[t]);
    }
    out.sort((x, y) => x - y);
    return out;
  }

  // 무순서 쌍 (i<j) 순회 — grid 있으면 셀 리스트(27 이웃)로 지지 내 후보만, 없으면 전체 O(N²). 각 쌍에 cb(i,j).
  //   두 경로 모두 (i 오름차순, 그 안에서 j 오름차순)=사전식 순서 → brute 와 누적 순서 동일(비트 동일의 뿌리).
  function eachPair(particles, n, h, grid, cb) {
    if (grid) {
      for (let i = 0; i < n; i++) {
        const nb = sphNeighbors(grid, particles, i);
        for (let t = 0; t < nb.length; t++) { const j = nb[t]; if (j > i) cb(i, j); }
      }
    } else {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) cb(i, j);
    }
  }

  // opts 에서 격자를 얻는다 — prebuilt grid 객체(opts.grid)면 재사용, opts.accelerate 면 즉석 빌드, 아니면 null(brute).
  function resolveGrid(particles, h, opts) {
    if (opts.grid && opts.grid.map) return opts.grid;
    if (opts.accelerate) return sphNeighborGrid(particles, { h });
    return null;
  }

  // SPH 압력 힘 — 밀도(0040) 위에 상태식 P=f(ρ) 와 대칭 쌍힘으로 구체 떼를 *가스처럼 퍼지게* 한다(SW5).
  //   design/sphere-world.md §6 SW5 / §3 — 0008(격자 단거리 반발 P=Kρ^γ)·0010(열압력)의 *SPH 판*. 밀도가
  //   높은 곳일수록 큰 압력 → 입자를 밀어낸다. Monaghan 대칭 운동량식:
  //       a_i = −Σ_j m_j (P_i/ρ_i² + P_j/ρ_j²) ∇_i W_ij
  //   쌍힘 F_ij = −m_i m_j(P_i/ρ_i²+P_j/ρ_j²)∇_i W_ij, ∇_j W = −∇_i W → F_ji = −F_ij(뉴턴3) → **순 운동량
  //   기계 정밀도로 정확 보존**(쌍 루프라 구조적으로 상쇄). 상태식 P_i = k·ρ_i^γ(항상 ≥0 → 항상 반발 → 퍼짐).
  //   opts: { stiffness(k, 기본 0 → early-return·회귀 0), gamma(기본 2), h(기본 1) }. 밀도는 내부에서 sphDensity 로
  //   재계산(자기 완결). 운동량 바뀐 입자의 KEcm·energy 재계산(자기일관). 입력을 제자리 변형해 반환.
  //   정직한 한계(이 단위): 압력은 *힘*만(운동량 보존) — 압력 일↔내부에너지 닫힘(KE↔u)은 후속 SPH 열 벽돌
  //   (0008→0010 순서와 동형). 점성·적응 h 도 후속.
  function sphPressureForce(particles, dt, opts) {
    opts = opts || {};
    const k = opts.stiffness != null ? opts.stiffness : 0;
    const n = particles.length;
    if (n < 2 || k === 0) return particles;                   // 노브=0 → early-return(회귀 0)
    const h = opts.h != null ? opts.h : 1;
    const gamma = opts.gamma != null ? opts.gamma : 2;
    const EPS2 = 1e-12;
    const grid = resolveGrid(particles, h, opts);             // 이웃 격자(null=brute·회귀 0)
    sphDensity(particles, { h, grid });                       // 밀도 갱신(0040 재사용·자기일관·같은 격자)
    const P = new Array(n);
    for (let i = 0; i < n; i++) P[i] = k * Math.pow(particles[i].density || 0, gamma);   // 상태식(항상 ≥0)
    const ax = new Float64Array(n), ay = new Float64Array(n), az = new Float64Array(n);
    eachPair(particles, n, h, grid, (i, j) => {
      const a = particles[i], b = particles[j];
      const rhoi = a.density || EPS2, rhoj = b.density || EPS2;
      const term = P[i] / (rhoi * rhoi) + P[j] / (rhoj * rhoj);
      const g = kernelGradW(a.cx - b.cx, a.cy - b.cy, a.cz - b.cz, h);   // ∇_i W_ij
      ax[i] -= b.mass * term * g[0]; ay[i] -= b.mass * term * g[1]; az[i] -= b.mass * term * g[2];   // a_i += −m_j·term·∇_iW
      ax[j] += a.mass * term * g[0]; ay[j] += a.mass * term * g[1]; az[j] += a.mass * term * g[2];   // a_j += −m_i·term·∇_jW(=+∇_iW)
    });
    for (let i = 0; i < n; i++) {                             // Δp_i = m_i·a_i·dt → 쌍마다 ΣΔp=0(정확)
      const e = particles[i];
      e.px += e.mass * ax[i] * dt; e.py += e.mass * ay[i] * dt; e.pz += e.mass * az[i] * dt;
    }
    for (let i = 0; i < n; i++) {                             // KEcm·energy 재계산(internalE 불변·자기일관)
      const e = particles[i];
      if (e.internalE == null) e.internalE = (e.energy != null ? e.energy : 0) - (e.KEcm || 0);
      e.KEcm = e.mass > EPS2 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.energy = e.KEcm + e.internalE;
    }
    return particles;
  }

  // ── SW5 적응-h 압력 힘 — 0048 이 *측정*한 입자별 h_i 를 압력 힘에 *연동*한다(가변 분해능) ───────────
  //   design/sphere-world.md §6 SW5 — 0041 압력은 *고정* h 였다. 0048 은 입자별 h_i=η(m_i/ρ_i)^⅓ 를 자기일관으로
  //   *재기만* 했다(수동 측정). 이 법칙은 그 h_i 를 *힘에 쓴다* — 그런데 쌍 (i,j) 의 h_i≠h_j 면 ∇W 가 비대칭이 돼
  //   뉴턴3(운동량 보존)이 깨질 위험이 있다. **대칭 평균 커널**로 막는다: ∇W̄_ij = ½(∇W(r,h_i)+∇W(r,h_j)). W̄ 가 i↔j
  //   대칭이라 ∇_jW̄_ji = −∇_iW̄_ij → 쌍힘 +F/−F → **순 운동량 정확 보존**(가변 h 여도). (grad-h Ω 보정은 *에너지*
  //   일관용·운동량엔 대칭만으로 충분 — 0046 점성·0049 전도도 같은 패턴으로 확장 가능.) caller 가 입자별 a.h·a.density
  //   를 설정(sphAdaptiveH)해 넘긴다 — 없으면 a.h=h0 로 폴백(그때 모든 h 동일 → ∇W̄=∇W → 0041 과 비트 동일).
  //     P_i = k·ρ_i^γ,  a_i = −Σ_j m_j(P_i/ρ_i² + P_j/ρ_j²)∇_iW̄_ij,  ∇_iW̄_ij = ½(∇W(r,h_i)+∇W(r,h_j))
  //   opts: { stiffness(k·0→early-return·회귀0 의미無=신규), gamma(2), h0(a.h 없을 때 폴백·1) }. p 갱신·internalE 불변.
  function sphPressureForceVarH(particles, dt, opts) {
    opts = opts || {};
    const k = opts.stiffness != null ? opts.stiffness : 0;
    const n = particles.length;
    if (n < 2 || k === 0) return particles;                   // 노브=0 → early-return
    const gamma = opts.gamma != null ? opts.gamma : 2;
    const h0 = opts.h0 != null ? opts.h0 : 1;
    const EPS2 = 1e-12;
    const P = new Array(n);
    for (let i = 0; i < n; i++) P[i] = k * Math.pow(particles[i].density || 0, gamma);   // 상태식(입자별 ρ_i·자기 h_i 로)
    const ax = new Float64Array(n), ay = new Float64Array(n), az = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = particles[i], b = particles[j];
      const hi = (a.h > 0) ? a.h : h0, hj = (b.h > 0) ? b.h : h0;
      const dx = a.cx - b.cx, dy = a.cy - b.cy, dz = a.cz - b.cz;
      const gi = kernelGradW(dx, dy, dz, hi), gj = kernelGradW(dx, dy, dz, hj);   // 각자 h 로 ∇W
      const gx = 0.5 * (gi[0] + gj[0]), gy = 0.5 * (gi[1] + gj[1]), gz = 0.5 * (gi[2] + gj[2]);   // 대칭 평균 ∇_iW̄
      const rhoi = a.density || EPS2, rhoj = b.density || EPS2;
      const term = P[i] / (rhoi * rhoi) + P[j] / (rhoj * rhoj);
      ax[i] -= b.mass * term * gx; ay[i] -= b.mass * term * gy; az[i] -= b.mass * term * gz;   // a_i += −m_j·term·∇_iW̄
      ax[j] += a.mass * term * gx; ay[j] += a.mass * term * gy; az[j] += a.mass * term * gz;   // a_j += +m_i·term·∇_iW̄(=−∇_jW̄)
    }
    for (let i = 0; i < n; i++) {                             // Δp_i = m_i·a_i·dt → 쌍마다 ΣΔp=0(정확·가변 h 여도)
      const e = particles[i];
      e.px += e.mass * ax[i] * dt; e.py += e.mass * ay[i] * dt; e.pz += e.mass * az[i] * dt;
    }
    for (let i = 0; i < n; i++) {                             // KEcm·energy 재계산(internalE 불변)
      const e = particles[i];
      if (e.internalE == null) e.internalE = (e.energy != null ? e.energy : 0) - (e.KEcm || 0);
      e.KEcm = e.mass > EPS2 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.energy = e.KEcm + e.internalE;
    }
    return particles;
  }

  // SPH 내부에너지(열) 닫힘 — 압력(0041)이 한 일을 내부에너지로 되돌려 **총E 를 정확히 보존**한다(SW5).
  //   design/sphere-world.md §6 SW5 / §5 난점 — 0009(수동 온도 T∝ρ^(γ−1))·0010(KE↔내부E 가역 닫힘)의 *SPH 판*.
  //   0041 이 남긴 정직한 한계("압력이 implicit 열저장고에서 일을 꺼냄") 를 메운다 — 그 일은 이제 내부에너지에서
  //   나오고/로 들어간다. **0041 대칭 운동량식과 정확히 짝지어** 총E 를 닫는 *대칭* 내부에너지식:
  //       du_i/dt = ½ Σ_j m_j (P_i/ρ_i² + P_j/ρ_j²) (v_i−v_j)·∇_i W_ij
  //   ΔinternalE_i = m_i·du_i/dt·dt(internalE 는 *총* 내부에너지 = 비내부E×질량). 쌍 (i,j) 기여가 두 입자에 같다
  //   (v_ji·∇_jW = (−v_ij)·(−∇_iW) = v_ij·∇_iW). 순간 전력 균형이 기계 정밀도로 정확:
  //       Σ_i m_i v_i·a_i (압력이 KE 에 한 일률) + Σ_i m_i du_i/dt (내부E 증가율) = 0   (대칭·반대칭의 대수 항등식)
  //   → 압축(접근, v_ij·∇_iW>0)이면 데우고, 팽창(멀어짐)이면 식힌다. **궤적은 0041 과 불변** — EOS P=k·ρ^γ 는
  //   barotropic 이라 u 가 *힘에 되먹지 않는다*(이 단위는 에너지 *책*만 정직하게 닫음). 열→압력 되먹임(P=(γ−1)ρu)
  //   은 후속 SW5 벽돌 = 0009(수동)→0010(능동) 순서와 동형. opts: { stiffness(k, 기본 0 → early-return·회귀 0),
  //   gamma(기본 2), h(기본 1) }. px/py/pz 는 *안 건드림*(p 는 0041 압력 힘의 몫·이 함수는 internalE/energy 만).
  function sphThermalEnergy(particles, dt, opts) {
    opts = opts || {};
    const k = opts.stiffness != null ? opts.stiffness : 0;
    const n = particles.length;
    if (n < 2 || k === 0) return particles;                   // 노브=0 → early-return(회귀 0)
    const h = opts.h != null ? opts.h : 1;
    const gamma = opts.gamma != null ? opts.gamma : 2;
    const EPS2 = 1e-12;
    const grid = resolveGrid(particles, h, opts);             // 이웃 격자(null=brute·회귀 0)
    sphDensity(particles, { h, grid });                       // 밀도 갱신(0040 재사용·자기일관·같은 격자)
    const P = new Array(n);
    for (let i = 0; i < n; i++) P[i] = k * Math.pow(particles[i].density || 0, gamma);   // 상태식(0041 과 동일)
    const dU = new Float64Array(n);                           // ΔinternalE_i / dt 누적
    eachPair(particles, n, h, grid, (i, j) => {
      const a = particles[i], b = particles[j];
      const rhoi = a.density || EPS2, rhoj = b.density || EPS2;
      const term = P[i] / (rhoi * rhoi) + P[j] / (rhoj * rhoj);
      const g = kernelGradW(a.cx - b.cx, a.cy - b.cy, a.cz - b.cz, h);   // ∇_i W_ij
      const vix = a.px / a.mass, viy = a.py / a.mass, viz = a.pz / a.mass;   // v_i = p_i/m_i
      const vjx = b.px / b.mass, vjy = b.py / b.mass, vjz = b.pz / b.mass;
      const vdotg = (vix - vjx) * g[0] + (viy - vjy) * g[1] + (viz - vjz) * g[2];   // v_ij·∇_iW(접근→>0)
      const inc = 0.5 * a.mass * b.mass * term * vdotg;       // 쌍 기여(두 입자에 동일)
      dU[i] += inc; dU[j] += inc;                             // m_i·½ m_j term v_ij·∇W
    });
    for (let i = 0; i < n; i++) {                             // internalE += ΔU·dt → 총E=Σ(KE+u) 정확 닫힘
      const e = particles[i];
      if (e.internalE == null) e.internalE = (e.energy != null ? e.energy : 0) - (e.KEcm || 0);
      if (e.KEcm == null) e.KEcm = e.mass > EPS2 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.internalE += dU[i] * dt;                              // 압축→데움(dU>0)·팽창→식힘(dU<0)
      e.energy = e.KEcm + e.internalE;                        // p 는 불변(0041 의 몫)
    }
    return particles;
  }

  // SPH 능동 열압력(되먹임) — 압력이 *내부에너지에서 나온다*: P_i = (γ−1)·ρ_i·u_i (u_i=비내부E=internalE/질량).
  //   design/sphere-world.md §6 SW5 — 0041(barotropic P=k·ρ^γ·u 무관)·0042(에너지 닫힘·u 는 닫히되 힘에 안 먹임)
  //   의 *되먹임* 판. **0009(수동 온도)→0010(능동 열압력)의 SPH 판**: 압축이 u 를 데우고(0042) → 데운 u 가 P 를
  //   키워(이 함수) → *더 세게 떠받친다*(별 코어의 단열 지지). 0041 압력 힘(Monaghan 대칭 쌍힘)과 0042 에너지
  //   닫힘(대칭 내부E식)을 *한 함수*에서 열 EOS 로 묶는다 — 같은 사전 속도로 a_i 와 dU_i 를 함께 계산해 적용하면
  //   운동량 정확 보존 + 순간 전력 균형(−S+S=0) 기계 정밀도(0041·0042 결합). u 가 P 에 들어가므로 *되먹임*:
  //       P_i = (γ−1)ρ_i u_i,  a_i = −Σ_j m_j(P_i/ρ_i²+P_j/ρ_j²)∇_iW,  dU_i = m_i·½Σ_j m_j(…)v_ij·∇_iW·dt
  //   u≥0 → P≥0 → 항상 반발. opts: { gamma(기본 5/3·단원자), h(기본 1) }. n<2 면 무변화. 신규 함수 — 기존 호출처
  //   없으니 회귀 0(구조적). 0041/0042 와 달리 *EOS 가 u 의존* = 데운 가스가 더 센 압력(되먹임).
  function sphThermalPressureForce(particles, dt, opts) {
    opts = opts || {};
    const n = particles.length;
    if (n < 2) return particles;
    const h = opts.h != null ? opts.h : 1;
    const gamma = opts.gamma != null ? opts.gamma : 5 / 3;
    const EPS2 = 1e-12;
    const grid = resolveGrid(particles, h, opts);             // 이웃 격자(null=brute·회귀 0)
    sphDensity(particles, { h, grid });                       // 밀도 갱신(0040 재사용·자기일관·같은 격자)
    const P = new Array(n);
    for (let i = 0; i < n; i++) {                             // 열 EOS: P=(γ−1)·ρ·u (u=internalE/질량·u≥0→P≥0)
      const e = particles[i];
      if (e.internalE == null) e.internalE = (e.energy != null ? e.energy : 0) - (e.KEcm || 0);
      const u = e.mass > EPS2 ? e.internalE / e.mass : 0;
      P[i] = (gamma - 1) * (e.density || 0) * Math.max(0, u);
    }
    const ax = new Float64Array(n), ay = new Float64Array(n), az = new Float64Array(n), dU = new Float64Array(n);
    eachPair(particles, n, h, grid, (i, j) => {
      const a = particles[i], b = particles[j];
      const rhoi = a.density || EPS2, rhoj = b.density || EPS2;
      const term = P[i] / (rhoi * rhoi) + P[j] / (rhoj * rhoj);
      const g = kernelGradW(a.cx - b.cx, a.cy - b.cy, a.cz - b.cz, h);   // ∇_i W_ij
      ax[i] -= b.mass * term * g[0]; ay[i] -= b.mass * term * g[1]; az[i] -= b.mass * term * g[2];   // 운동량(0041)
      ax[j] += a.mass * term * g[0]; ay[j] += a.mass * term * g[1]; az[j] += a.mass * term * g[2];
      const vix = a.px / a.mass, viy = a.py / a.mass, viz = a.pz / a.mass;   // 사전 속도 v_i=p_i/m_i
      const vjx = b.px / b.mass, vjy = b.py / b.mass, vjz = b.pz / b.mass;
      const vdotg = (vix - vjx) * g[0] + (viy - vjy) * g[1] + (viz - vjz) * g[2];   // v_ij·∇_iW
      const inc = 0.5 * a.mass * b.mass * term * vdotg;       // 에너지 닫힘(0042·두 입자에 동일)
      dU[i] += inc; dU[j] += inc;
    });
    for (let i = 0; i < n; i++) {                             // p 와 internalE 동시 적용(같은 사전 속도 → 총E 닫힘)
      const e = particles[i];
      e.px += e.mass * ax[i] * dt; e.py += e.mass * ay[i] * dt; e.pz += e.mass * az[i] * dt;
      e.internalE += dU[i] * dt;                              // 압축 데움→P↑(되먹임)·팽창 식힘→P↓
      e.KEcm = e.mass > EPS2 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.energy = e.KEcm + e.internalE;
    }
    return particles;
  }

  // SPH 인공 점성(Monaghan-Gingold) — *접근하는* 입자 쌍의 상대운동을 깎아 그 운동E를 내부E로 **일방** 소산한다(SW5).
  //   design/sphere-world.md §6 SW5 / §5 난점 2 — 0011(비가역 점성 소산 bulk KE→열·엔트로피↑·진동 감쇠·별 정착)·
  //   0037(DEM 접촉 감쇠)의 *SPH 판*. 0041~0045 의 압력은 *가역*(압축 데움↔팽창 식힘)이라 단열 진동이 영원히 안 식는다
  //   — 점성이 그걸 식힌다(충격·진동을 열로). 표준 Monaghan 인공 점성 Π_ij(접근할 때만·짝대칭 Π_ij=Π_ji):
  //       μ_ij = h (v_ij·r_ij) / (|r_ij|² + 0.01 h²)            (접근 v_ij·r_ij<0 → μ<0, 아니면 0)
  //       Π_ij = (−α c̄_ij μ_ij + β μ_ij²) / ρ̄_ij               (μ<0 → 두 항 모두 ≥0 → Π≥0)
  //       a_i  = −Σ_j m_j Π_ij ∇_i W_ij                          (0041 과 같은 대칭 쌍힘 꼴)
  //       dU_i =  m_i·½ Σ_j m_j Π_ij v_ij·∇_i W_ij·dt            (0042 와 같은 대칭 에너지 꼴)
  //   c̄=(c_i+c_j)/2 음속·ρ̄=(ρ_i+ρ_j)/2. 음속은 0045 열 EOS 와 정합 c_i=√(γ(γ−1)u_i)(u=internalE/질량·뜨거우면 더 끈적).
  //   **두 보존·한 비가역**: ∇_jW=−∇_iW → F_ji=−F_ij(뉴턴3) → 순 운동량 정확 보존. a_i 와 dU_i 를 한 쌍 루프에서
  //   같은 사전 속도로 계산해 적용 → KE 일 + ΔU = 0(순간 전력 균형·기계 정밀도·0042/0045 와 동형). 그러나 Π≥0 이고
  //   접근 쌍의 v_ij·∇_iW>0 라 **ΔU≥0 — 오직 데움(단방향·시간의 화살)**. 0045 가역 압력과의 결정적 차이.
  //   opts: { alpha(α, 기본 0 → early-return·회귀 0), beta(β, 기본 2α), gamma(γ, 기본 5/3), h(기본 1) }. 멀어지는
  //   쌍(v·r≥0)은 건너뜀(소산은 압축에만). 신규 함수 — 기존 호출처 없으니 회귀 0(구조적).
  function sphViscosity(particles, dt, opts) {
    opts = opts || {};
    const alpha = opts.alpha != null ? opts.alpha : 0;
    const n = particles.length;
    if (n < 2 || alpha === 0) return particles;               // 노브=0 → early-return(회귀 0)
    const beta = opts.beta != null ? opts.beta : 2 * alpha;
    const h = opts.h != null ? opts.h : 1;
    const gamma = opts.gamma != null ? opts.gamma : 5 / 3;
    const EPS2 = 1e-12, epsH = 0.01 * h * h;                  // μ 분모 정칙화(특이점 방지)
    const grid = resolveGrid(particles, h, opts);             // 이웃 격자(null=brute·회귀 0)
    sphDensity(particles, { h, grid });                       // 밀도 갱신(0040 재사용·자기일관·같은 격자)
    const c = new Float64Array(n);                            // 음속 c_i=√(γ(γ−1)u)(0045 열 EOS 정합)
    for (let i = 0; i < n; i++) {
      const e = particles[i];
      if (e.internalE == null) e.internalE = (e.energy != null ? e.energy : 0) - (e.KEcm || 0);
      const u = e.mass > EPS2 ? e.internalE / e.mass : 0;
      c[i] = Math.sqrt(Math.max(0, gamma * (gamma - 1) * u));
    }
    const ax = new Float64Array(n), ay = new Float64Array(n), az = new Float64Array(n), dU = new Float64Array(n);
    eachPair(particles, n, h, grid, (i, j) => {
      const a = particles[i], b = particles[j];
      const dx = a.cx - b.cx, dy = a.cy - b.cy, dz = a.cz - b.cz;
      const vix = a.px / a.mass, viy = a.py / a.mass, viz = a.pz / a.mass;   // 사전 속도 v_i=p_i/m_i
      const vjx = b.px / b.mass, vjy = b.py / b.mass, vjz = b.pz / b.mass;
      const vrx = vix - vjx, vry = viy - vjy, vrz = viz - vjz;               // v_ij
      const vr = vrx * dx + vry * dy + vrz * dz;              // v_ij·r_ij
      if (vr >= 0) return;                                    // 멀어지면 점성 없음(소산은 압축에만·단방향)
      const r2 = dx * dx + dy * dy + dz * dz;
      const mu = h * vr / (r2 + epsH);                        // <0 (접근)
      const rhoBar = 0.5 * ((a.density || EPS2) + (b.density || EPS2));
      const cBar = 0.5 * (c[i] + c[j]);
      const Pi = (-alpha * cBar * mu + beta * mu * mu) / rhoBar;   // ≥0 (소산 압력)
      const g = kernelGradW(dx, dy, dz, h);                  // ∇_i W_ij
      ax[i] -= b.mass * Pi * g[0]; ay[i] -= b.mass * Pi * g[1]; az[i] -= b.mass * Pi * g[2];   // 운동량(뉴턴3)
      ax[j] += a.mass * Pi * g[0]; ay[j] += a.mass * Pi * g[1]; az[j] += a.mass * Pi * g[2];
      const vdotg = vrx * g[0] + vry * g[1] + vrz * g[2];     // v_ij·∇_iW (접근→>0)
      const inc = 0.5 * a.mass * b.mass * Pi * vdotg;         // ≥0 → 오직 데움(단방향·시간의 화살)
      dU[i] += inc; dU[j] += inc;
    });
    for (let i = 0; i < n; i++) {                             // p·internalE 동시 적용(같은 사전 속도 → 총E 닫힘)
      const e = particles[i];
      e.px += e.mass * ax[i] * dt; e.py += e.mass * ay[i] * dt; e.pz += e.mass * az[i] * dt;
      e.internalE += dU[i] * dt;                              // bulk KE → 열(비가역)
      e.KEcm = e.mass > EPS2 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.energy = e.KEcm + e.internalE;
    }
    return particles;
  }

  // SPH 열전도(thermal conduction) — 이웃 쌍 사이로 비열E(u=internalE/질량)를 흘려 *온도를 평형화*한다.
  //   design/sphere-world.md §6 SW5 — "구체 떼가 가스처럼 거동(압력·**확산**)". 0046 점성이 bulk *운동*을 식혔다면,
  //   이건 *온도 차*를 식힌다 = **0002 확산(열역학 제2법칙)의 SPH 판**. 라플라시안의 SPH 근사(Brookshaw/Cleary-Monaghan):
  //       du_i/dt = Σ_j m_j (κ_i+κ_j)/(ρ_i ρ_j) · (u_i − u_j) · (r_ij·∇_iW_ij)/(|r_ij|²+ε)
  //   r_ij·∇_iW < 0(커널 단조 감소) → i 가 더 뜨거우면(u_i>u_j) du_i<0(식고) du_j>0(데움) = **열 hot→cold**.
  //   쌍 계수 K_ij = m_i m_j(κ_i+κ_j)/(ρ_iρ_j)·(r·∇W)/(r²+ε) 는 i↔j *대칭* → dE_i=+K(u_i−u_j)·dt, dE_j=−(같은 값)
  //   → **총 내부E 정확 보존**(Σ dE=0). 온도 분산 단조↓ = **엔트로피↑·단방향**(섞임만·안 풀림·시간의 화살·0002·0046 정신).
  //   운동량·KE 는 *안 건드림*(U 만 재분배) → 총E=Σ(KE+u) 자동 보존. opts: { kappa(열확산계수·기본 0), h(기본 1) }.
  //   κ=0 → early-return(회귀 0). 신규 함수 — 기존 호출처 없으니 회귀 0(구조적). 0046 점성과 짝: 둘 다 소산이나
  //   점성=운동 차 소산(KE→열)·전도=온도 차 소산(열↔열 재분배·KE 불변).
  //   **안정성**: explicit 확산은 조건부 안정 — dt·(국소 확산률) 이 크면 발산한다. 0012 advect 처럼 *CFL 서브스텝*으로
  //   감싼다: 입자별 감쇠율 A_i=Σ_j a_ij 의 최댓값으로 nSub 을 잡아 dt_sub·maxA ≤ 0.4 보장 → 어떤 dt 에도 안정(보존은 불변).
  function sphThermalConduction(particles, dt, opts) {
    opts = opts || {};
    const kappa = opts.kappa != null ? opts.kappa : 0;
    const n = particles.length;
    if (kappa === 0 || n < 2) return particles;               // 노브 0 → 무변화(회귀 0)
    const h = opts.h != null ? opts.h : 1;
    const EPS2 = 1e-12, epsR = 0.01 * h * h;                  // 분모 정칙화(r→0 특이점 방지)
    const grid = resolveGrid(particles, h, opts);             // 이웃 격자(null=brute·회귀 0)
    sphDensity(particles, { h, grid });                       // 밀도 갱신(0040 재사용·같은 격자)
    const u = new Array(n);                                   // 비내부E u_i = internalE_i/m_i
    const A = new Float64Array(n);                            // 입자별 감쇠율 A_i=Σ_j a_ij (안정성 CFL 용)
    for (let i = 0; i < n; i++) {
      const e = particles[i];
      if (e.internalE == null) e.internalE = (e.energy != null ? e.energy : 0) - (e.KEcm || 0);
      if (e.KEcm == null) e.KEcm = e.mass > EPS2 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      u[i] = e.mass > EPS2 ? e.internalE / e.mass : 0;
    }
    // a_ij = −m_j(2κ)/(ρ_iρ_j)(r·∇W)/(r²+ε) > 0 (대칭 쌍 계수 K=−a_ij·m_i). du_i/dt=−Σ_j a_ij(u_i−u_j).
    const pairW = [];                                         // 쌍 가중치 [i,j,wij] 미리 계산(위치 고정 → 서브스텝 불변)
    eachPair(particles, n, h, grid, (i, j) => {
      const a = particles[i], b = particles[j];
      const dx = a.cx - b.cx, dy = a.cy - b.cy, dz = a.cz - b.cz;
      const r2 = dx * dx + dy * dy + dz * dz;
      const rhoi = a.density || EPS2, rhoj = b.density || EPS2;
      const g = kernelGradW(dx, dy, dz, h);
      const rdotg = dx * g[0] + dy * g[1] + dz * g[2];       // < 0
      const w = -(2 * kappa) / (rhoi * rhoj) * rdotg / (r2 + epsR);   // ≥0 — du_i 기여 = w·m_j(u_j−u_i)
      if (w !== 0) { pairW.push(i, j, w); A[i] += w * b.mass; A[j] += w * a.mass; }
    });
    let maxA = 0; for (let i = 0; i < n; i++) if (A[i] > maxA) maxA = A[i];
    const nSub = Math.max(1, Math.ceil(dt * maxA / 0.4));     // 확산 CFL — dt_sub·maxA ≤ 0.4
    const ds = dt / nSub;
    const dU = new Float64Array(n);
    for (let s = 0; s < nSub; s++) {                          // 안정 서브스텝(위치 고정 → 가중치 재사용·u 만 갱신)
      dU.fill(0);
      for (let t = 0; t < pairW.length; t += 3) {
        const i = pairW[t], j = pairW[t + 1], w = pairW[t + 2];
        const flow = w * (u[j] - u[i]);                       // i 차가우면(u_j>u_i) flow>0 → i 데움
        dU[i] += particles[j].mass * flow;                   // du_i += w·m_j(u_j−u_i)
        dU[j] -= particles[i].mass * flow;                   // 대칭 교환(질량가중 Σ m_i du_i = 0 → 총 내부E 보존)
      }
      for (let i = 0; i < n; i++) u[i] += dU[i] * ds;         // u 재분배(다음 서브스텝 입력)
    }
    for (let i = 0; i < n; i++) {                            // u → internalE 반영(KE·운동량 불변 → 총E 자동 보존)
      const e = particles[i];
      e.internalE = u[i] * e.mass;
      e.energy = e.KEcm + e.internalE;                       // p 는 불변(전도는 운동 안 건드림)
    }
    return particles;
  }

  // ── SW5 SPH 점화(핵융합 발열 source) — 충분히 뜨거운 입자가 연료를 태워 데운다 ───────────────────
  //   design/sphere-world.md §6 SW5 — 0052 복사는 열의 *출구*(sink). 이 법칙은 열의 *입구*(source) = **점화** =
  //   **0004(임계 방출=별)·0003(potential→energy)의 SPH 판**. 별은 코어가 *충분히 뜨거우면*(u≥uCrit) 핵융합으로
  //   불붙어 연료를 열로 바꾼다. 0052 복사와 짝지으면: 발열(이 법칙)↔복사(0052)가 균형 잡아 별이 **virial 정상상태**
  //   에서 빛난다(0013 이 0012 runaway 를 닫고 정상 별을 만든 정신·정상 u_eq = floor + rate/coolRate).
  //     u_i ≥ uCrit (그리고 ρ_i ≥ rhoCrit) 이고 fuel_i>0 → burn = min(fuel_i, rate·m_i·dt); internalE += burn; fuel −= burn
  //   **연료↔열 보존**: Σ(fuel+internalE) 정확 보존(연료가 열로 바뀔 뿐). 질량·운동량·KE 불변(0005 질량소실 닫음).
  //   연료 유한 → 다 타면 멈춤(무한 발열 없음·0004 의 "별도 언젠가 꺼진다"). rate=0 또는 dt=0 → early-return(회귀 0).
  //   opts: { rate(0·연소율), uCrit(점화 온도 임계·기본 ∞=안 붙음), rhoCrit(밀도 임계·기본 0), fuel0(초기 연료·e.fuel 없을 때) }.
  function sphIgnition(particles, dt, opts) {
    opts = opts || {};
    const rate = opts.rate != null ? opts.rate : 0;
    if (dt == null) dt = 1;
    if (!rate || !dt) return particles;                       // 노브=0 → 세계 불변(회귀 0)
    const uCrit = opts.uCrit != null ? opts.uCrit : Infinity; // 점화 온도 임계(이상이면 불붙음)
    const rhoCrit = opts.rhoCrit != null ? opts.rhoCrit : 0;  // 점화 밀도 임계(옵션·e.density 필요)
    const fuel0 = opts.fuel0 != null ? opts.fuel0 : 0;
    const EPS2 = 1e-12;
    for (let i = 0; i < particles.length; i++) {
      const e = particles[i];
      if (e.fuel == null) e.fuel = fuel0;
      if (e.internalE == null) e.internalE = (e.energy != null ? e.energy : 0) - (e.KEcm || 0);
      if (e.KEcm == null) e.KEcm = e.mass > EPS2 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      const u = e.mass > EPS2 ? e.internalE / e.mass : 0;
      if (u >= uCrit && (e.density || 0) >= rhoCrit && e.fuel > 0) {   // 뜨겁고(·조밀하고) 연료 있으면 점화
        const burn = Math.min(e.fuel, rate * e.mass * dt);    // 연소량 ∝ 질량·rate·dt
        e.internalE += burn; e.fuel -= burn;                  // 연료 → 열(Σ(fuel+u) 보존)
        e.energy = e.KEcm + e.internalE;                      // 총E↑(연료에서)·질량 불변
      }
    }
    return particles;
  }

  // ── SW5 격자 은퇴 첫 벽돌: 격자 유체 → SPH 입자 *이주* ───────────────────────────────────────
  //   design/sphere-world.md §6 SW5 — "격자 유체를 구체로 이주 → 격자 은퇴". 격자(Eulerian·칸 고정) 위의 연속
  //   유체장(ρ=energy·운동량 g=mom_*·내부E u=therm)을 *셀마다 SPH 입자 하나*로 재버킷팅한다 = 0026 promote
  //   (덩어리→개체)의 *유체 전체* 판. 셀 부피 dV=1(격자 단위)이라 셀 i 의 보존량이 그대로 입자의 양이 된다:
  //       위치 = 셀 중심(x,y,z) · 질량 m=ρ_i · 운동량 p=(g_x,g_y,g_z)_i · 내부E=u_i · 속도 v=p/m · KE=½|p|²/m
  //   **정확 보존**(단순 재버킷팅): Σ입자 질량·운동량·내부E·KE = 격자 장 총합(진공 셀 ρ≤0 은 빈 곳=입자 0,
  //   기여 0 → 합 불변). 진공을 건너뛰므로 *희소화*(빈 곳엔 구체 없음·Lagrangian)도 공짜. 이주 후 입자는 SPH
  //   힘(0041~0049)으로 자유로이 굴러간다 — 격자를 점진 은퇴시키는 토대. world: { N, fields{energy,mom_x/y/z,therm} }.
  //   opts: { field('energy'), threshold(0·이하 셀은 진공·건너뜀) }. 세계(읽기 전용) → 새 입자 배열 반환.
  function fluidToParticles(world, opts) {
    opts = opts || {};
    const thresh = opts.threshold != null ? opts.threshold : 0;
    const N = world.N;
    const rho = world.fields[opts.field || 'energy'];
    const gx = world.fields['mom_x'], gy = world.fields['mom_y'], gz = world.fields['mom_z'];
    const u = world.fields['therm'];
    const RAD1 = Math.cbrt(3 / (4 * Math.PI));               // 부피 1 셀의 등가 반지름(렌더용)
    const out = [];
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x;
      const m = rho[i];
      if (m <= thresh) continue;                             // 진공 셀 → 입자 없음(희소화)
      const px = gx ? gx[i] : 0, py = gy ? gy[i] : 0, pz = gz ? gz[i] : 0;
      const ie = u ? u[i] : 0;
      const KEcm = m > 0 ? 0.5 * (px * px + py * py + pz * pz) / m : 0;
      out.push({ cx: x, cy: y, cz: z, mass: m, px, py, pz, KEcm, internalE: ie, energy: KEcm + ie, density: 0, cells: 1, radius: RAD1 });
    }
    return out;
  }

  // ── SW5 격자 은퇴 자동 이주 트리거: 조건 충족 격자 영역 → SPH 입자 *이동*(격자에서 비움) ──────────
  //   design/sphere-world.md §6 SW5 — "격자 유체를 구체로 이주 → 격자 은퇴". 0051 fluidToParticles 는 격자장을
  //   *읽기만* 해 입자로 **복사**했다(격자·입자 중복 존재·이주 시연). 이 법칙은 그 *이동* 판 = **autoPromoteStable
  //   (htj-hybrid.js·동결 덩어리만 선택 승격)의 *유체* 판**: 조건(region)을 충족하는 셀만 SPH 입자로 옮기고 **그 셀을
  //   격자에서 비운다**(rho·운동량·내부E = 0). → 물질이 격자에서 입자로 *옮겨가* 격자가 실제로 은퇴한다(활성 셀↓).
  //   조건은 caller 가 준다(autoPromote 가 tracker 동결을 쓰듯) — region(x,y,z)=>bool 술어(기본 전체) + threshold.
  //   **보존(이동이라 전역 정확)**: Σ이주 입자 = Σ비운 셀(질량·운동량·내부E·KE) → (남은 격자 + 입자) 총량 = 원래 총량.
  //   복사(0051)는 합이 *배가*되지만 이동(이 step)은 *불변* — 이게 "은퇴"의 핵심(이중 표현·이중 계산 방지). 진공 셀
  //   (rho≤threshold)은 건너뜀(희소화). region 이 아무 셀도 안 고르면 입자 0·격자 불변(회귀 0). world 를 *제자리 변형*
  //   (격자 비움)하고 새 입자 배열을 반환한다 — 0051 과 달리 읽기 전용 아님(이동이므로). opts: { field('energy'),
  //   threshold(0), region((x,y,z)=>bool·기본 전체) }. 반환 { particles, migratedCells, removedMass }.
  function migrateRegionToSPH(world, opts) {
    opts = opts || {};
    const thresh = opts.threshold != null ? opts.threshold : 0;
    const region = opts.region || null;                      // 술어(x,y,z)=>bool · 없으면 전체
    const N = world.N;
    const rho = world.fields[opts.field || 'energy'];
    const gx = world.fields['mom_x'], gy = world.fields['mom_y'], gz = world.fields['mom_z'];
    const u = world.fields['therm'];
    const RAD1 = Math.cbrt(3 / (4 * Math.PI));               // 부피 1 셀의 등가 반지름(렌더용·0051 과 동일)
    const particles = [];
    let removedMass = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x;
      const m = rho[i];
      if (m <= thresh) continue;                             // 진공 셀 → 안 옮김(희소화)
      if (region && !region(x, y, z)) continue;              // 조건 불충족 셀 → 격자에 남김(선택적)
      const px = gx ? gx[i] : 0, py = gy ? gy[i] : 0, pz = gz ? gz[i] : 0;
      const ie = u ? u[i] : 0;
      const KEcm = m > 0 ? 0.5 * (px * px + py * py + pz * pz) / m : 0;
      particles.push({ cx: x, cy: y, cz: z, mass: m, px, py, pz, KEcm, internalE: ie, energy: KEcm + ie, density: 0, cells: 1, radius: RAD1 });
      rho[i] = 0; if (gx) gx[i] = 0; if (gy) gy[i] = 0; if (gz) gz[i] = 0; if (u) u[i] = 0;   // ← 격자에서 비움(은퇴)
      removedMass += m;
    }
    return { particles, migratedCells: particles.length, removedMass };
  }

  // ── SW5 격자 은퇴 역이주: SPH 입자 → 격자 유체 *되돌림*(0051 의 역·왕복 닫음) ──────────────────
  //   design/sphere-world.md §6 SW5 — 0051 fluidToParticles(격자→SPH 복사)·0055 migrateRegionToSPH(격자→SPH 이동)의
  //   *역* = **0026/0031 demote(개체→격자 유체)의 *SPH 전체* 판**. SPH 입자를 제가 점유한 격자 셀(반올림 좌표)에
  //   되쌓는다(질량 ρ=energy 장·운동량 mom·내부E therm 누적) → 입자가 격자로 *녹아들어* 왕복이 닫힌다(격자→SPH→격자
  //   = 항등). "은퇴"가 일방이 아니라 *가역*(SPH 가 필요 없어진 영역을 격자로 되접어 비용 절감)이라는 증거.
  //     셀 i = round(p.cx,cy,cz) (격자 밖은 경계로 클램프·질량 손실 0) · ρ[i]+=m · mom[i]+=p · therm[i]+=internalE
  //   **한 셀에 여러 입자가 모이면**(또는 기존 격자 유체와 합쳐지면) bulk 운동량은 합쳐지나 *상대 운동 KE 는
  //   사라진다* → 그 잃은 상대 KE 를 internalE(열)로 적립해 **총E 정확 보존**(0031 demote 의 충돌→열 규약·
  //   relKE = (기존 bulk KE + Σ입자 KE) − 합친 bulk KE ≥ 0). 한 셀에 입자 하나면 relKE=0(항등). **보존**: 누적이라
  //   Σ질량·운동량·총E(=KE+내부E) 정확 보존(격자→SPH→격자 왕복 = 비트 근사 항등). world 를 *제자리 변형*(격자에
  //   누적)하고 요약 반환. world: { N, fields{energy,mom_x/y/z,therm} }. opts: { field('energy') }. 입자 없음 → 격자 불변.
  function particlesToFluid(particles, world, opts) {
    opts = opts || {};
    if (!particles || particles.length === 0) return { cells: 0, mass: 0, heated: 0 };   // 입자 없음 → 격자 불변(회귀 0)
    const N = world.N;
    const rho = world.fields[opts.field || 'energy'];
    const gx = world.fields['mom_x'], gy = world.fields['mom_y'], gz = world.fields['mom_z'];
    const u = world.fields['therm'];
    const EPS = 1e-9;
    const clamp = (v) => v < 0 ? 0 : (v >= N ? N - 1 : v);
    // 1패스: 셀별 누적(질량·운동량·내부E·입자 KE 합) — 상대 KE→열은 합친 뒤 한 번에.
    const acc = new Map();                                   // i -> [dm, dpx, dpy, dpz, dIE, dKEparts]
    let totalMass = 0;
    for (let n = 0; n < particles.length; n++) {
      const p = particles[n];
      const m = p.mass || 0;
      const ix = clamp(Math.round(p.cx || 0)), iy = clamp(Math.round(p.cy || 0)), iz = clamp(Math.round(p.cz || 0));
      const i = (iz * N + iy) * N + ix;
      const px = p.px || 0, py = p.py || 0, pz = p.pz || 0;
      const ie = p.internalE != null ? p.internalE : ((p.energy != null ? p.energy : 0) - (p.KEcm || 0));
      const keP = m > EPS ? 0.5 * (px * px + py * py + pz * pz) / m : 0;
      const a = acc.get(i) || [0, 0, 0, 0, 0, 0];
      a[0] += m; a[1] += px; a[2] += py; a[3] += pz; a[4] += ie; a[5] += keP;
      acc.set(i, a); totalMass += m;
    }
    // 2패스: 셀에 적용 + 상대 KE→열(총E 보존).
    let heated = 0;
    for (const [i, a] of acc) {
      const preM = rho[i] || 0, prePx = gx ? gx[i] : 0, prePy = gy ? gy[i] : 0, prePz = gz ? gz[i] : 0;
      const preKE = preM > EPS ? 0.5 * (prePx * prePx + prePy * prePy + prePz * prePz) / preM : 0;
      const newM = preM + a[0], nPx = prePx + a[1], nPy = prePy + a[2], nPz = prePz + a[3];
      const newBulkKE = newM > EPS ? 0.5 * (nPx * nPx + nPy * nPy + nPz * nPz) / newM : 0;
      const relKE = (preKE + a[5]) - newBulkKE;             // 잃은 상대 운동 KE(≥0) → 열
      rho[i] = newM; if (gx) gx[i] = nPx; if (gy) gy[i] = nPy; if (gz) gz[i] = nPz;
      if (u) u[i] = (u[i] || 0) + a[4] + (relKE > 0 ? relKE : 0);
      if (relKE > 0) heated += relKE;
    }
    return { cells: acc.size, mass: totalMass, heated };
  }

  // ── SW5 격자 은퇴 자동 양방향 이주: 밀도 기준으로 격자↔SPH 표현을 *적응 선택*(이력으로 깜빡임 방지) ──────
  //   design/sphere-world.md §6 SW5 — 0055(격자→SPH 이동)·0076(SPH→격자 역이주)이 양방향 메커니즘을 줬다. 이 법칙은
  //   둘을 *정책*으로 묶어 **표현을 자동 선택**한다 = SW4 적응 LOD(0039·멀면 합치고 가까이 쪼갬)의 *격자↔SPH 표현* 판:
  //   밀집/붕괴 영역은 SPH(Lagrangian 이 디테일을 따라감)·확산/조용한 영역은 격자(고정 셀로 저렴) → *비용이 디테일을
  //   따라가게*. **이력(hysteresis)**: ρ_on > ρ_off 라 임계 근처에서 표현이 *깜빡이지 않는다*(0025 동결·0039 coarsen 정신).
  //   **전역 보존**: grid→SPH(0055 이동)+SPH→grid(0076 누적) 둘 다 보존이라 (남은 격자+입자) 총 질량·운동량·총E 불변.
  //   rhoOn 없음→grid→SPH 안 함·rhoOff 없음→SPH→grid 안 함·둘 다 없음→불변(회귀 0). world(제자리 변형)+particles(현 SPH
  //   입자)→ { particles(갱신), toSPH, toGrid }. opts: { field('energy'), rhoOn(셀 ρ≥이값→SPH), rhoOff(입자셀질량≤이값→격자) }.
  // ── 격자 속도 전단(shear) 장 — |∇v| 셀별 측정(적응 이주 디테일 검출자) ─────────────────────────────
  //   "비용이 디테일을 따라간다"(0039/0077)에서 *디테일*은 밀도만이 아니다 — 속도가 *공간적으로 빠르게 변하는*
  //   곳(전단·소용돌이·충돌면)은 고정 셀 격자가 수치 확산으로 뭉개고, Lagrangian(SPH·물질 따라감)이 더 잘 좇는다.
  //   이 측정자가 그 곳을 짚는다: 셀별 속도 v=mom/ρ 의 |∇v| = √(Σ_comp Σ_axis (∂v_comp/∂axis)²) (중심차분·경계 클램프).
  //   ρ≤0 셀은 속도 미정 → 전단 0. mom 장 없으면 0. 읽기 전용(world 불변). opts: { field('energy') }. → Float64Array(L).
  function gridShearField(world, opts) {
    opts = opts || {};
    const N = world.N, L = N * N * N, EPS = 1e-12;
    const rho = world.fields[opts.field || 'energy'];
    const mx = world.fields['mom_x'], my = world.fields['mom_y'], mz = world.fields['mom_z'];
    const out = new Float64Array(L);
    if (!mx || !my || !mz) return out;
    const vx = new Float64Array(L), vy = new Float64Array(L), vz = new Float64Array(L);
    for (let i = 0; i < L; i++) { const m = rho[i]; if (m > EPS) { vx[i] = mx[i] / m; vy[i] = my[i] / m; vz[i] = mz[i] / m; } }
    const cl = (a) => a < 0 ? 0 : (a >= N ? N - 1 : a);
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x; if (rho[i] <= EPS) continue;
      const ixm = (z * N + y) * N + cl(x - 1), ixp = (z * N + y) * N + cl(x + 1);
      const iym = (z * N + cl(y - 1)) * N + x, iyp = (z * N + cl(y + 1)) * N + x;
      const izm = (cl(z - 1) * N + y) * N + x, izp = (cl(z + 1) * N + y) * N + x;
      let s = 0;
      for (const V of [vx, vy, vz]) {
        const dvx = (V[ixp] - V[ixm]) / 2, dvy = (V[iyp] - V[iym]) / 2, dvz = (V[izp] - V[izm]) / 2;
        s += dvx * dvx + dvy * dvy + dvz * dvz;
      }
      out[i] = Math.sqrt(s);
    }
    return out;
  }

  // ── 격자 와도(vorticity) 장 — |∇×v| 셀별 측정(회전 디테일 검출자) ──────────────────────────────────
  //   |∇v|(0081 전단)은 *회전*(소용돌이)과 *압축/팽창*(발산)을 못 가른다. 와도 ω=∇×v 는 *회전만* 짚는다 —
  //   순수 발산(방사 팽창)은 |∇v| 크지만 |ω|=0. 회전 소용돌이(eddy)는 Lagrangian(SPH)이 특히 잘 좇으므로 별도 축이 값있다.
  //     ω_x=∂v_z/∂y−∂v_y/∂z · ω_y=∂v_x/∂z−∂v_z/∂x · ω_z=∂v_y/∂x−∂v_x/∂y · out=|ω| (중심차분·경계 클램프·ρ≤0→0).
  //   읽기 전용(world 불변). opts: { field('energy') }. → Float64Array(L).
  function gridVorticityField(world, opts) {
    opts = opts || {};
    const N = world.N, L = N * N * N, EPS = 1e-12;
    const rho = world.fields[opts.field || 'energy'];
    const mx = world.fields['mom_x'], my = world.fields['mom_y'], mz = world.fields['mom_z'];
    const out = new Float64Array(L);
    if (!mx || !my || !mz) return out;
    const vx = new Float64Array(L), vy = new Float64Array(L), vz = new Float64Array(L);
    for (let i = 0; i < L; i++) { const m = rho[i]; if (m > EPS) { vx[i] = mx[i] / m; vy[i] = my[i] / m; vz[i] = mz[i] / m; } }
    const cl = (a) => a < 0 ? 0 : (a >= N ? N - 1 : a);
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x; if (rho[i] <= EPS) continue;
      const ixm = (z * N + y) * N + cl(x - 1), ixp = (z * N + y) * N + cl(x + 1);
      const iym = (z * N + cl(y - 1)) * N + x, iyp = (z * N + cl(y + 1)) * N + x;
      const izm = (cl(z - 1) * N + y) * N + x, izp = (cl(z + 1) * N + y) * N + x;
      const dvz_dy = (vz[iyp] - vz[iym]) / 2, dvy_dz = (vy[izp] - vy[izm]) / 2;
      const dvx_dz = (vx[izp] - vx[izm]) / 2, dvz_dx = (vz[ixp] - vz[ixm]) / 2;
      const dvy_dx = (vy[ixp] - vy[ixm]) / 2, dvx_dy = (vx[iyp] - vx[iym]) / 2;
      const wx = dvz_dy - dvy_dz, wy = dvx_dz - dvz_dx, wz = dvy_dx - dvx_dy;
      out[i] = Math.sqrt(wx * wx + wy * wy + wz * wz);
    }
    return out;
  }

  // ── 격자 수렴(발산·충격면) 장 — max(0, −∇·v) 셀별 측정(압축 디테일 검출자) ─────────────────────────
  //   |∇v|(0081 전단)은 모든 변형을, |∇×v|(0082 와도)는 *회전만* 짚는다 — 둘 다 *압축/충격면*(수렴 흐름)을
  //   회전과 못 가른다. 발산 ∇·v 가 그걸 짚는다: 수렴(infall·충격 전면)은 ∇·v<0·순수 회전은 ∇·v=0·방사 팽창은
  //   ∇·v>0. 충격면(수렴)은 격자가 수치 확산으로 뭉개고 SPH 인공점성(0046)이 잘 좇으므로 별 축이 값있다.
  //     ∇·v = ∂vx/∂x+∂vy/∂y+∂vz/∂z,  out = max(0, −∇·v) (수렴·압축만·중심차분·경계 클램프·ρ≤0→0).
  //   와도(0082)의 *거울짝* — 순수 회전은 out=0, 순수 수렴은 out>0(회전≠압축 분리). 읽기 전용(world 불변).
  //   opts: { field('energy') }. → Float64Array(L).
  function gridDivergenceField(world, opts) {
    opts = opts || {};
    const N = world.N, L = N * N * N, EPS = 1e-12;
    const rho = world.fields[opts.field || 'energy'];
    const mx = world.fields['mom_x'], my = world.fields['mom_y'], mz = world.fields['mom_z'];
    const out = new Float64Array(L);
    if (!mx || !my || !mz) return out;
    const vx = new Float64Array(L), vy = new Float64Array(L), vz = new Float64Array(L);
    for (let i = 0; i < L; i++) { const m = rho[i]; if (m > EPS) { vx[i] = mx[i] / m; vy[i] = my[i] / m; vz[i] = mz[i] / m; } }
    const cl = (a) => a < 0 ? 0 : (a >= N ? N - 1 : a);
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x; if (rho[i] <= EPS) continue;
      const ixm = (z * N + y) * N + cl(x - 1), ixp = (z * N + y) * N + cl(x + 1);
      const iym = (z * N + cl(y - 1)) * N + x, iyp = (z * N + cl(y + 1)) * N + x;
      const izm = (cl(z - 1) * N + y) * N + x, izp = (cl(z + 1) * N + y) * N + x;
      const div = (vx[ixp] - vx[ixm]) / 2 + (vy[iyp] - vy[iym]) / 2 + (vz[izp] - vz[izm]) / 2;
      out[i] = div < 0 ? -div : 0;                            // 수렴(압축/충격면)만
    }
    return out;
  }

  function autoMigrate(world, particles, opts) {
    opts = opts || {};
    particles = particles || [];
    const N = world.N;
    const field = opts.field || 'energy';
    const rho = world.fields[field];
    const rhoOn = opts.rhoOn, rhoOff = opts.rhoOff, shearOn = opts.shearOn, vortOn = opts.vortOn, divOn = opts.divOn;
    // ── 이주 이력(hysteresis·깜빡임 방지) — 갓 격자→SPH 이주한 입자는 minDwell call 동안 격자로 *못 돌아간다* ──
    //   전단/와도/발산 축은 *복귀 임계가 없다*(SPH→격자는 밀도 rhoOff 만 본다). 그래서 저밀도+고전단 셀은 매 call
    //   격자→SPH(전단 큼) → 즉시 SPH→격자(밀도 작음) 를 *깜빡인다*(불필요 이주·이력). dwell 이 갓 이주한 입자를
    //   minDwell call 동안 격자 복귀에서 면제해 그 1-call 깜빡임을 끊는다(이력=상태 기억). minDwell=0 → 면제 0 → 0089 byte 동일.
    const minDwell = opts.minDwell != null ? opts.minDwell : 0;
    let toSPHn = 0, toGridn = 0;
    if (minDwell > 0) for (let k = 0; k < particles.length; k++) { const p = particles[k]; if (p.migDwell > 0) p.migDwell--; }   // 기존 입자 dwell 감쇠(이번 call 1 소진)
    // 1. 격자 → SPH: ρ≥rhoOn(밀집) *또는* |∇v|≥shearOn(전단) *또는* |∇×v|≥vortOn(회전) *또는* max(0,−∇·v)≥divOn(압축/충격면) 인 셀 → 입자(0055 이동).
    //    임계 안 준 축은 무시(다 안 주면 0077 밀도만). 디테일은 밀도·전단·회전·압축 — 비용이 디테일을 따라간다(다축 정책).
    if (rhoOn != null || shearOn != null || vortOn != null || divOn != null) {
      const shearF = shearOn != null ? gridShearField(world, { field }) : null;
      const vortF = vortOn != null ? gridVorticityField(world, { field }) : null;
      const divF = divOn != null ? gridDivergenceField(world, { field }) : null;
      const region = (x, y, z) => { const i = (z * N + y) * N + x; return (rhoOn != null && rho[i] >= rhoOn) || (shearOn != null && shearF[i] >= shearOn) || (vortOn != null && vortF[i] >= vortOn) || (divOn != null && divF[i] >= divOn); };
      const mig = migrateRegionToSPH(world, { field, threshold: 0, region });
      if (minDwell > 0) for (let k = 0; k < mig.particles.length; k++) mig.particles[k].migDwell = minDwell;   // 갓 이주 → dwell 부여(복귀 면제 시작)
      particles = particles.concat(mig.particles);
      toSPHn = mig.particles.length;
    }
    // 2. SPH → 격자: 셀 입자질량 ≤ rhoOff 인 *확산* 입자 → 격자(0076 누적). 밀집 클러스터(>rhoOff)는 SPH 유지.
    //    단, dwell 이 남은(갓 이주한) 입자는 격자 복귀에서 면제(이력) — 임계 근처 깜빡임 방지.
    if (rhoOff != null && particles.length) {
      const clamp = (v) => v < 0 ? 0 : (v >= N ? N - 1 : v);
      const key = (p) => (clamp(Math.round(p.cz || 0)) * N + clamp(Math.round(p.cy || 0))) * N + clamp(Math.round(p.cx || 0));
      const cellMass = new Map();                              // round(cell) → Σ 입자 질량(밀도 프록시)
      for (const p of particles) { const k = key(p); cellMass.set(k, (cellMass.get(k) || 0) + (p.mass || 0)); }
      const stay = [], back = [];
      for (const p of particles) { const eligible = cellMass.get(key(p)) <= rhoOff && !(minDwell > 0 && p.migDwell > 0); (eligible ? back : stay).push(p); }
      if (back.length) particlesToFluid(back, world, { field });
      particles = stay; toGridn = back.length;
    }
    return { particles, toSPH: toSPHn, toGrid: toGridn };
  }

  // ── TW2 바다 — SPH 물 입자가 *정적 지형 앵커*를 느끼는 경계 결합(안 새어 나감) ────────────────────
  //   design/environment.md §3 TW2 — sphere-world 동역학(0026~)+SPH 물리 스택(0040~)은 섰지만, 물(SPH 입자)이
  //   *지형*(정적 앵커·0056/0059)을 느끼는 결합이 없어 물이 지형을 그냥 통과한다. 이 법칙은 그 *유일하게 빠진
  //   벽돌* = **SPH↔앵커 경계**: 물 입자가 앵커 구 표면(반경 R+skin) 안으로 파고들면 바깥 법선으로 반발한다.
  //   그러면 중력(0028)+SPH 압력(0041)이 물을 *낮은 데 고여 수평 수면(등퍼텐셜)*으로 가라앉힌다 — 창발.
  //     반발(Hooke·바깥): pen = (R+skin) − |p−A| > 0 → Δp_i = +k·pen·dt·n̂   (n̂ = 앵커중심→입자, 바깥)
  //   앵커는 **무한 질량(정적 외부 경계)** — 충격을 흡수한다(점프해도 지구는 안 밀린다·environment §1·0056 정신).
  //   그래서 임펄스는 *입자에만* 준다(쌍힘 아님 — 앵커는 부분계 밖의 경계). 운동량은 그 경계로 빠져나가므로 물
  //   입자들끼리 보존 아님(0056 과 동일·앵커가 외부). 선택적 법선 감쇠(damp): 파고드는(안쪽) 법선 속도만 *0 까지*
  //   없애(역전 금지·0037 임계 클램프) 잃은 KE 를 internalE 로 적립(비가역 소산→열·낙하 KE 가 식음). 표면 밖(pen≤0)
  //   이거나 k=0/앵커 없음 → 경계력 0(회귀 0·신규 함수라 구조적 회귀 0). anchors=[{cx,cy,cz,radius}](앵커는 *읽기만*).
  //   opts: { stiffness(k·0→early-return), damp(c·0=순수 반발·보존), skin(경계층 두께·표면 앞서 미는 여유·0) }.
  function sphBoundaryForce(particles, anchors, dt, opts) {
    opts = opts || {};
    const k = opts.stiffness != null ? opts.stiffness : 0;
    if (dt == null) dt = 1;
    if (k === 0 || !anchors || anchors.length === 0 || !dt) return particles;   // 노브=0/앵커 없음 → early-return(회귀 0)
    const c = opts.damp != null ? opts.damp : 0;
    const skin = opts.skin != null ? opts.skin : 0;
    const EPS = 1e-9;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const m = p.mass > EPS ? p.mass : 1;
      if (p.internalE == null) p.internalE = (p.energy != null ? p.energy : 0) - (p.KEcm || 0);
      for (let a = 0; a < anchors.length; a++) {
        const A = anchors[a];
        const dx = p.cx - A.cx, dy = p.cy - A.cy, dz = p.cz - A.cz;     // 앵커 → 입자
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const pen = ((A.radius || 0) + skin) - d;                       // 표면 안으로 파고든 깊이
        if (pen <= 0 || d < EPS) continue;                             // 표면 밖·중심 일치(방향 불정) → 경계력 0
        const nx = dx / d, ny = dy / d, nz = dz / d;                    // 바깥 법선(앵커중심→입자)
        // ① 반발(Hooke·바깥) — 앵커=무한 질량 외부 경계가 충격 흡수 → 입자에만 임펄스(0056 정신).
        const jr = k * pen * dt;
        p.px += jr * nx; p.py += jr * ny; p.pz += jr * nz;
        // ② 법선 감쇠(파고드는 운동만 소산 → 열) — 잃은 KE 를 internalE 로(0037 임계 클램프·역전 금지).
        if (c !== 0) {
          const KE0 = 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / m;
          const vn = (p.px * nx + p.py * ny + p.pz * nz) / m;           // 법선 속도(바깥 +)
          if (vn < 0) {                                                 // 안쪽(파고드는 중)만
            let J = -c * vn * dt;                                       // 안쪽 운동 반대(바깥·소산)
            const Jzero = -m * vn;                                      // vn→0 임펄스(같은 부호)
            if (J > Jzero) J = Jzero;                                   // 임계 초과 → 0 까지만(역전 방지)
            p.px += J * nx; p.py += J * ny; p.pz += J * nz;
            const dissip = KE0 - 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / m;   // 잃은 KE(≥0) → 열
            if (dissip > 0) p.internalE += dissip;
          }
        }
      }
      p.KEcm = m > EPS ? 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / m : 0;
      p.energy = p.KEcm + p.internalE;                                  // 자기일관(energy=KEcm+internalE)
    }
    return particles;
  }

  // ── TW3 강 = SPH bed friction(지형 바닥 접선 항력) — 물이 경사를 *흘러내린다*(종단속도→정상 흐름) ──────
  //   design/environment.md §3 TW3 — TW2(0060 sphBoundaryForce)가 물을 지형에 *얹었다*(법선 반발+법선 감쇠).
  //   그러나 0060 은 *법선*(파고드는) 운동만 막는다 — 경사면을 따라 *미끄러지는(접선)* 운동엔 저항이 0 이다.
  //   그래서 기울인 바닥 위 물은 중력 접선 성분에 *끝없이 가속*한다(종단속도 없음·강이 아니라 탄도 추락).
  //   이것이 TW3 의 빠진 벽돌 = **바닥 접선 항력**: 접촉(pen>0) 입자의 *접선 슬립*을 속도에 비례해 소산→열.
  //     v = vn·n̂ + v_t,   v_t ← v_t·(1 − min(drag·dt, 1)),   잃은 KE → internalE   (법선 vn 불변)
  //   속도비례(점성형) 항력이라 경사에서 중력 접선(g·sinθ)과 균형 = **종단속도 v_term ≈ g·sinθ/drag**(유한)
  //   → 물이 *일정 속도로 흘러내려* 하류에 고인다(강). Coulomb(속도무관) 마찰과 달리 종단속도를 준다. 이것은
  //   0046(입자↔입자 점성 소산·속도비례)의 *바닥↔입자* 판이자, TW1 의 0057(접촉 접선 마찰)의 *SPH↔앵커* 판.
  //   앵커는 **무한 질량 정적 외부 경계**(0056/0060 정신) — 잃은 접선 운동량은 그 경계로 빠진다(쌍힘 아님·물
  //   입자끼리 보존 아님). 잃은 KE 는 *열*(internalE↑·비가역·시간의 화살)로 정직히 적립. 접선 운동을 *0 까지만*
  //   줄여 역전 금지(0037/0057 클램프). drag=0/앵커 없음/dt=0 → early-return(회귀 0). 신규 함수라 기존 호출처
  //   0 → 구조적 회귀 0(0060 sphBoundaryForce 는 *전혀* 안 건드림 — 법선=0060·접선=이 step 직교 분해).
  //   anchors=[{cx,cy,cz,radius}](*읽기만*). opts: { drag(0→early-return), skin(경계층·0060 과 같은 접촉 판정) }.
  function sphBedFriction(particles, anchors, dt, opts) {
    opts = opts || {};
    const drag = opts.drag != null ? opts.drag : 0;
    if (dt == null) dt = 1;
    if (drag === 0 || !anchors || anchors.length === 0 || !dt) return particles;  // 노브=0/앵커 없음 → early-return(회귀 0)
    const skin = opts.skin != null ? opts.skin : 0;
    const f = Math.min(drag * dt, 1);                              // 접선 감쇠 분율(접촉 동안·0..1·역전 금지)
    const EPS = 1e-9;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const m = p.mass > EPS ? p.mass : 1;
      if (p.internalE == null) p.internalE = (p.energy != null ? p.energy : 0) - (p.KEcm || 0);
      for (let a = 0; a < anchors.length; a++) {
        const A = anchors[a];
        const dx = p.cx - A.cx, dy = p.cy - A.cy, dz = p.cz - A.cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const pen = ((A.radius || 0) + skin) - d;                  // 접촉(표면 안) 판정 — 0060 과 동일
        if (pen <= 0 || d < EPS) continue;                        // 표면 밖·중심 일치 → 항력 0
        const nx = dx / d, ny = dy / d, nz = dz / d;               // 바깥 법선
        const vx = p.px / m, vy = p.py / m, vz = p.pz / m;
        const vn = vx * nx + vy * ny + vz * nz;                    // 법선 속도(부호)
        const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;   // 접선 속도(슬립)
        const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (vt < EPS) continue;                                    // 슬립 없음 → 항력 0
        const KE0 = 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / m;
        const Jt = f * m * vt;                                     // 접선 운동량 일부 제거(속도비례·0..vt = 역전 없음)
        p.px -= Jt * tx / vt; p.py -= Jt * ty / vt; p.pz -= Jt * tz / vt;
        const dissip = KE0 - 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / m;   // 잃은 접선 KE(≥0) → 열
        if (dissip > 0) p.internalE += dissip;
      }
      p.KEcm = m > EPS ? 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / m : 0;
      p.energy = p.KEcm + p.internalE;                             // 자기일관(energy=KEcm+internalE)
    }
    return particles;
  }

  // ── 침식 = SPH 퇴적물 운반(바닥↔흐름 용량 기반 교환) — 물이 *땅을 깎고 쌓는다*(지형 정적·일방 해소) ──────
  //   design/environment.md §2/§4 — 0060(법선 경계)·0064(접선 마찰)은 물을 지형에 *얹고 흘렀게* 했으나 지형은
  //   *정적*이었다(물→지형 일방·거의 모든 지형 step 의 공통 한계). 이 법칙은 그 일방을 *왕복*으로 닫는다:
  //   흐르는 물(SPH)이 바닥(앵커)을 *깎아 싣고*(침식) 느려지면 *내려놓는다*(퇴적) = 흐름이 땅을 빚는다.
  //     운반 용량 C = capacity·|v_t|              (stream power — 빠른 흐름일수록 더 많이 운반)
  //     load(p.sediment) < C → 침식: dm=min(erodeRate·(C−load)·dt, bed−minBed)  바닥→입자(bed↓·load↑)
  //     load > C            → 퇴적: dm=min(erodeRate·(load−C)·dt, load)          입자→바닥(bed↑·load↓)
  //   바닥 두께 = 앵커 반경(A.bed·첫 접촉 시 radius 로 초기화)·A.radius=A.bed 로 기하 반영 → 깎인 바닥을 물이
  //   *따라간다*(다음 step 의 0060 경계력이 갱신된 radius 를 읽음·창발 결합). 보존: 모든 dm 은 bed↔load *쌍 이동*
  //   → **Σ A.bed + Σ p.sediment 정확 보존**(질량은 사라지지 않고 땅↔흐름을 오갈 뿐). 퇴적물은 *수동 스칼라*
  //   (운동량·내부E 안 건드림) → 0064 동역학 불변(erodeRate=0 → 정확 회귀). 빠른 상류는 깎이고(협곡) 느린
  //   하류는 쌓여(삼각주) **graded 하천 단면이 창발**(author 없이·"법칙 author·구조 창발"). 0064(접선 마찰)·
  //   0060(법선)과 같은 SPH↔앵커 *generic* 법칙 family(타입 모름·"지형/강" 분기 없음·바닥=generic 정적 경계).
  //   erodeRate=0/앵커 없음/dt=0 → early-return(회귀 0). anchors 는 *읽고 bed/radius 만 갱신*(위치 불변).
  //   opts: { erodeRate(0→early-return), capacity(운반 용량 계수), skin(0060 과 같은 접촉층), minBed(다 깎이면 멈춤·기본 0) }.
  function sphSedimentErosion(particles, anchors, dt, opts) {
    opts = opts || {};
    const erodeRate = opts.erodeRate != null ? opts.erodeRate : 0;
    if (dt == null) dt = 1;
    if (erodeRate === 0 || !anchors || anchors.length === 0 || !dt) return particles;  // 노브=0/앵커 없음 → early-return(회귀 0)
    const capacity = opts.capacity != null ? opts.capacity : 1;
    const skin = opts.skin != null ? opts.skin : 0;
    const minBed = opts.minBed != null ? opts.minBed : 0;
    const EPS = 1e-9;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.sediment == null) p.sediment = 0;
      const m = p.mass > EPS ? p.mass : 1;
      for (let a = 0; a < anchors.length; a++) {
        const A = anchors[a];
        if (A.bed == null) A.bed = A.radius || 0;                 // 첫 접촉: 바닥 두께 = 현재 반경
        const dx = p.cx - A.cx, dy = p.cy - A.cy, dz = p.cz - A.cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const pen = ((A.radius || 0) + skin) - d;                 // 접촉(표면 안) 판정 — 0060/0064 와 동일
        if (pen <= 0 || d < EPS) continue;
        const nx = dx / d, ny = dy / d, nz = dz / d;              // 바깥 법선
        const vx = p.px / m, vy = p.py / m, vz = p.pz / m;
        const vn = vx * nx + vy * ny + vz * nz;                   // 법선 속도
        const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;   // 접선 슬립(흐름)
        const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
        const C = capacity * vt;                                  // 운반 용량 ∝ 흐름 속도(stream power)
        if (p.sediment < C) {                                     // 침식: 바닥을 깎아 싣는다
          let dm = erodeRate * (C - p.sediment) * dt;
          if (dm > A.bed - minBed) dm = A.bed - minBed;
          if (dm > 0) { A.bed -= dm; p.sediment += dm; }
        } else if (p.sediment > C) {                              // 퇴적: 바닥에 내려놓는다
          let dm = erodeRate * (p.sediment - C) * dt;
          if (dm > p.sediment) dm = p.sediment;
          if (dm > 0) { A.bed += dm; p.sediment -= dm; }
        }
        A.radius = A.bed;                                         // 기하 반영(물이 깎인 바닥을 따라간다)
      }
    }
    return particles;
  }

  // ── SW5 SPH 복사 냉각 — 입자가 제 열을 *빛으로* 내보내 식는다(계의 첫 에너지 sink) ──────────────
  //   design/sphere-world.md §6 SW5 — 압력(0041)·점성(0046)·전도(0049)는 에너지를 *재분배*만 한다(KE↔U·U↔U).
  //   계 밖으로 에너지가 *나갈 출구*가 없어 붕괴열이 갇힌다. 이 법칙은 그 출구 = **빛**: 광학적으로 얇은 회색 복사로
  //   각 입자가 제 내부E 의 일부를 빛으로 방출한다 = **0005/0013(열의 출구=빛·질량 보존)의 SPH 판**. 0013 이 0012
  //   runaway 를 닫았듯, 이 sink 가 있어야 가스가 *진짜로 식어 정착*한다(점성·전도는 열을 옮길 뿐 못 버린다).
  //     u_i ← u_floor + (u_i − u_floor)·(1 − dt·coolRate),   radiated_i += 잃은 내부E   (질량·운동량·KE 불변)
  //   u_floor(=floor·m_i) 아래론 안 식는다(바닥 복사장·CMB 류·기본 0=완전히 식음). 빛은 *열에서* 나오지 질량
  //   아님(0005 질량소실 닫음) → energy=KE+u 는 줄지만 ρ(질량)는 불변. coolRate=0 또는 dt=0 → early-return(회귀 0).
  //   opts: { coolRate(0), floor(0·바닥 비내부E) }. 빛 장부는 입자별 e.radiated 로 누적(Lagrangian·총빛=Σe.radiated).
  function sphRadiativeCooling(particles, dt, opts) {
    opts = opts || {};
    const coolRate = opts.coolRate != null ? opts.coolRate : 0;
    if (dt == null) dt = 1;
    if (!coolRate || !dt) return particles;                   // 노브=0 → 세계 불변(회귀 0)
    const floor = opts.floor != null ? opts.floor : 0;
    const EPS2 = 1e-12, f = Math.max(0, 1 - dt * coolRate);   // 감쇠 계수(비음수 가드)
    for (let i = 0; i < particles.length; i++) {
      const e = particles[i];
      if (e.internalE == null) e.internalE = (e.energy != null ? e.energy : 0) - (e.KEcm || 0);
      if (e.KEcm == null) e.KEcm = e.mass > EPS2 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      const floorE = floor * (e.mass || 0);                   // 바닥 내부E (u_floor·m)
      const above = e.internalE - floorE;                     // 바닥 위 초과분만 식는다
      if (above > 0) {
        const lost = above * (1 - f);                         // 잃는 내부E = 방출 빛
        e.internalE -= lost;
        e.radiated = (e.radiated || 0) + lost;                // 빛 장부(열에서·질량 아님)
      }
      e.energy = e.KEcm + e.internalE;                        // 총E 감소(빛이 계를 떠남)·ρ(질량) 불변
    }
    return particles;
  }

  return { kernelW, kernelGradW, sphNeighborGrid, sphNeighbors, sphDensity, sphAdaptiveH, sphPressureForce, sphPressureForceVarH, sphThermalEnergy, sphThermalPressureForce, sphViscosity, sphThermalConduction, sphRadiativeCooling, sphIgnition, fluidToParticles, migrateRegionToSPH, particlesToFluid, autoMigrate, gridShearField, gridVorticityField, gridDivergenceField, sphBoundaryForce, sphBedFriction, sphSedimentErosion, VERSION: 22 };
});
