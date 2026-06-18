// flux-laws.js — 이 트랙의 *전부*. 단일 국소 규칙 함수 하나(SPINE §3). 이후 어떤 step 도 법칙을 더하지 않는다.
//   규칙: 이웃과 · 보존되는 양 q 를 · 기울기 d=qᵢ−qⱼ 에 비례해 · 문턱 θ 를 넘을 때 비선형(α)으로 · 주고받는다.
//     F(i→j) = κ · sign(d) · max(0, |d| − θ)^α            (d = qᵢ − qⱼ)
//   세 성질이 한 줄에서 동시에:
//     · 보존  — F(i→j) = −F(j→i) (Φ 가 d 의 홀함수). 간선마다 −F/+F 한 쌍 → Σq 불변(반올림 한도).
//     · 촉매  — 플럭스 ∝ 기울기 d (α=1 선형 확산, α>1 큰 차일수록 가속).
//     · 임계  — max(0,|d|−θ): |d|<θ 면 0(동결), 넘으면 비선형(α) 급증(사태).
// atom 트랙과 동일하게 HGO.laws 전역(브라우저) / module.exports(Node)에 등록.
;(function (root, factory) {
  const K = (typeof require !== 'undefined') ? require('./flux-kernel.js') : root.HGO.kernel;
  const mod = factory(K);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).laws = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K) {
  'use strict';

  // ── 단일 규칙(순수 함수) ── 기울기 d 와 노브(κ,θ,α)만으로 플럭스를 반환. 세계의 유일한 법칙.
  function rule(d, kappa, theta, alpha) {
    const ex = Math.abs(d) - theta;           // 문턱 초과분(임계 게이트)
    if (ex <= 0) return 0;                     // 문턱 아래 → 동결(플럭스 0)
    const mag = kappa * Math.pow(ex, alpha);   // 촉매: 초과분에 비례(α 비선형)
    return d < 0 ? -mag : mag;                 // 보존: d 의 부호를 따름(홀함수 → 반대칭)
  }

  // 한 tick — 모든 이웃 간선에 규칙을 한 번. 델타 누적 후 일괄 적용(간선 순서 무관 → 결정론·순서 무관 보존).
  function apply(sim) {
    const kn = sim.knobs, kappa = kn.kappa, theta = kn.theta, alpha = kn.alpha;
    if (!kappa) return;                        // κ=0 → 정지(early-return)
    const a = sim.atoms, edges = sim.edges;
    const delta = sim._delta || (sim._delta = new Float64Array(a.length));
    delta.fill(0);
    let flux = 0;                              // 진단: 이번 tick 의 총 |플럭스|(사태 세기)
    for (let e = 0; e < edges.length; e++) {
      const i = edges[e][0], j = edges[e][1];
      const F = rule(a[i].q - a[j].q, kappa, theta, alpha);
      if (F === 0) continue;
      delta[i] -= F; delta[j] += F;            // 반대칭 — i 가 잃는 만큼 j 가 얻음(닫힌 장부)
      flux += F < 0 ? -F : F;
    }
    for (let k = 0; k < a.length; k++) {
      a[k].q += delta[k];
      a[k].x = a[k].q;                         // 렌더 채널 동기(밝기=q, RENDER.md §2 — author 아님, 읽기 사상)
    }
    sim.fluxLast = flux;                       // watch/측정용(hash 미참여)
  }

  return { rule, apply };
});
