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

  return { kernelW, sphDensity, VERSION: 1 };
});
