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
  //   *고정소수점 정수* 구현 — d·θ·반환 F 는 모두 q-단위 정수(qfix). 규칙 *형태*는 불변(F=κ·sign(d)·max(0,|d|−θ)^α),
  //   연산만 정수 +,−,×,floor 로(Math.pow 제거 → 크로스플랫폼 비트 결정론, SPINE §9.3). κ·θ 는 미리 fixed 로 받음.
  function rule(d, kappaFix, thetaFix, alpha, SCALE) {
    const ad = d < 0 ? -d : d;                 // |d| (정수)
    const ex = ad - thetaFix;                  // 문턱 초과분(임계 게이트 — 정수)
    if (ex <= 0) return 0;                      // 문턱 아래 → 동결(플럭스 0)
    let pow = ex;                              // α=1 기본. α>1 은 정수 거듭제곱(매 곱마다 /SCALE 로 q-단위 유지).
    for (let k = 1; k < alpha; k++) pow = Math.floor(pow * ex / SCALE);
    const mag = Math.floor(pow * kappaFix / SCALE);   // 촉매: κ 곱(정수 floor — 결정론). 같은 F 가 ±로 가 보존 정확.
    return d < 0 ? -mag : mag;                 // 보존: d 의 부호를 따름(홀함수 → 반대칭)
  }

  // 한 tick — 모든 이웃 간선에 규칙을 한 번. 델타 누적 후 일괄 적용(간선 순서 무관 → 결정론·순서 무관 보존).
  //   delta 는 정수만 담는다(Float64 지만 값은 정수 — 2⁵³ 내 +,− 비트 정확). κ·θ 는 노브(인간 단위)에서 fixed 로 환산.
  function apply(sim) {
    const kn = sim.knobs, SCALE = K.SCALE;
    const kappaFix = Math.round(kn.kappa * SCALE);   // κ → fixed(예: 0.2 → 13107). 튜닝 노브라 미세 근사 무방.
    const thetaFix = Math.round(kn.theta * SCALE);   // θ → fixed(q-단위 정수)
    const alpha = Math.max(1, Math.round(kn.alpha)); // 비선형 차수는 정수(비정수 α 는 정수 결정론을 깸 → 보류)
    if (!kappaFix) return;                     // κ=0 → 정지(early-return)
    const a = sim.atoms, edges = sim.edges;
    const delta = sim._delta || (sim._delta = new Float64Array(a.length));
    delta.fill(0);
    let flux = 0;                              // 진단: 이번 tick 의 총 |플럭스|(사태 세기 — fixed)
    for (let e = 0; e < edges.length; e++) {
      const i = edges[e][0], j = edges[e][1];
      const F = rule(a[i].q - a[j].q, kappaFix, thetaFix, alpha, SCALE);
      if (F === 0) continue;
      delta[i] -= F; delta[j] += F;            // 반대칭 — 같은 정수 F 가 i 에서 −·j 에서 + → Σq 비트 정확 불변
      flux += F < 0 ? -F : F;
    }
    for (let k = 0; k < a.length; k++) {
      a[k].q += delta[k];                      // 정수 누적(정확 보존)
      a[k].x = a[k].q / SCALE;                 // 렌더 밝기 채널 = q 인간 단위(파생 실수 — 읽기 전용, 규칙에 환류 0)
    }
    sim.fluxLast = flux;                       // watch/측정용(hash 미참여)
  }

  return { rule, apply };
});
