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
    for (let i = 0; i < n; i++) {
      const a = particles[i];
      let rho = 0;
      for (let j = 0; j < n; j++) {
        const b = particles[j];
        const dx = a.cx - b.cx, dy = a.cy - b.cy, dz = a.cz - b.cz;
        rho += (b.mass || 0) * kernelW(Math.sqrt(dx * dx + dy * dy + dz * dz), h);
      }
      a.density = rho;
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
    sphDensity(particles, { h });                             // 밀도 갱신(0040 재사용·자기일관)
    const P = new Array(n);
    for (let i = 0; i < n; i++) P[i] = k * Math.pow(particles[i].density || 0, gamma);   // 상태식(항상 ≥0)
    const ax = new Float64Array(n), ay = new Float64Array(n), az = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = particles[i], b = particles[j];
      const rhoi = a.density || EPS2, rhoj = b.density || EPS2;
      const term = P[i] / (rhoi * rhoi) + P[j] / (rhoj * rhoj);
      const g = kernelGradW(a.cx - b.cx, a.cy - b.cy, a.cz - b.cz, h);   // ∇_i W_ij
      ax[i] -= b.mass * term * g[0]; ay[i] -= b.mass * term * g[1]; az[i] -= b.mass * term * g[2];   // a_i += −m_j·term·∇_iW
      ax[j] += a.mass * term * g[0]; ay[j] += a.mass * term * g[1]; az[j] += a.mass * term * g[2];   // a_j += −m_i·term·∇_jW(=+∇_iW)
    }
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
    sphDensity(particles, { h });                             // 밀도 갱신(0040 재사용·자기일관)
    const P = new Array(n);
    for (let i = 0; i < n; i++) P[i] = k * Math.pow(particles[i].density || 0, gamma);   // 상태식(0041 과 동일)
    const dU = new Float64Array(n);                           // ΔinternalE_i / dt 누적
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = particles[i], b = particles[j];
      const rhoi = a.density || EPS2, rhoj = b.density || EPS2;
      const term = P[i] / (rhoi * rhoi) + P[j] / (rhoj * rhoj);
      const g = kernelGradW(a.cx - b.cx, a.cy - b.cy, a.cz - b.cz, h);   // ∇_i W_ij
      const vix = a.px / a.mass, viy = a.py / a.mass, viz = a.pz / a.mass;   // v_i = p_i/m_i
      const vjx = b.px / b.mass, vjy = b.py / b.mass, vjz = b.pz / b.mass;
      const vdotg = (vix - vjx) * g[0] + (viy - vjy) * g[1] + (viz - vjz) * g[2];   // v_ij·∇_iW(접근→>0)
      const inc = 0.5 * a.mass * b.mass * term * vdotg;       // 쌍 기여(두 입자에 동일)
      dU[i] += inc; dU[j] += inc;                             // m_i·½ m_j term v_ij·∇W
    }
    for (let i = 0; i < n; i++) {                             // internalE += ΔU·dt → 총E=Σ(KE+u) 정확 닫힘
      const e = particles[i];
      if (e.internalE == null) e.internalE = (e.energy != null ? e.energy : 0) - (e.KEcm || 0);
      if (e.KEcm == null) e.KEcm = e.mass > EPS2 ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.internalE += dU[i] * dt;                              // 압축→데움(dU>0)·팽창→식힘(dU<0)
      e.energy = e.KEcm + e.internalE;                        // p 는 불변(0041 의 몫)
    }
    return particles;
  }

  return { kernelW, kernelGradW, sphDensity, sphPressureForce, sphThermalEnergy, VERSION: 3 };
});
