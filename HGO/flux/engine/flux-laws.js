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
  //   둘째 보존 채널 p 가 opt-in(knobs.gamma) 이면 결합 경로로 — gamma 없으면 아래 원래 경로 *그대로*(회귀 0, SKILL §3).
  function apply(sim) {
    if (sim.knobs.valence) return applyValence(sim); // arc J(다발): 둘째 보존 채널 b=원자가. valence 미설정 장면은 비트 불변(회귀 0).
    if (sim.knobs.inertial) return applyInertial(sim); // arc F: 관성 적분(파동). inertial 미설정 장면은 비트 불변(회귀 0).
    if (sim.knobs.gamma) return applyCoupled(sim);   // arc E: p 채널·κ 변조(촉매). gamma 미설정 장면은 비트 불변.
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

  // arc E — 둘째 보존 채널 p + 진짜 촉매(opt-in, knobs.gamma 일 때만). 새 *법칙* 아님(같은 규칙 rule() 을
  //   q·p 두 채널에 각각 한 번, SPINE §1·§3). 촉매 = p 가 q 의 교환률 κ 를 *국소 변조*: κ_eff = κ·(1 + γ·p̄),
  //   p̄ = (pᵢ+pⱼ)/2(간선 대칭 → κ_eff 가 i,j 대칭 → rule 의 반대칭 유지 → Σq 비트 보존). p 는 자기 규칙으로 확산
  //   (kappaP·thetaP, 미지정 시 q 노브 따름). 정수 전용(floor) — 결정론. ⚠ κ_eff·Z<1 안정 조건은 장면 책임(γ·p̄ 가 넘으면 발산).
  function applyCoupled(sim) {
    const kn = sim.knobs, SCALE = K.SCALE;
    const kqFix = Math.round(kn.kappa * SCALE);
    const kpFix = Math.round((kn.kappaP != null ? kn.kappaP : kn.kappa) * SCALE);
    const thetaFix = Math.round((kn.theta || 0) * SCALE);
    const thetaPFix = Math.round((kn.thetaP || 0) * SCALE);
    const alpha = Math.max(1, Math.round(kn.alpha || 1));
    const gammaFix = Math.round(kn.gamma * SCALE);            // 결합 세기(인간 단위 → fixed)
    const a = sim.atoms, edges = sim.edges;
    const dq = sim._delta || (sim._delta = new Float64Array(a.length));
    const dp = sim._deltaP || (sim._deltaP = new Float64Array(a.length));
    dq.fill(0); dp.fill(0);
    let flux = 0;
    for (let e = 0; e < edges.length; e++) {
      const i = edges[e][0], j = edges[e][1];
      const pbar = (a[i].p + a[j].p) >> 1;                    // 정수 평균(floor·대칭)
      const kqEff = kqFix + Math.floor(kqFix * Math.floor(gammaFix * pbar / SCALE) / SCALE);  // κ·(1+γ·p̄) 정수
      const Fq = rule(a[i].q - a[j].q, kqEff, thetaFix, alpha, SCALE);
      if (Fq !== 0) { dq[i] -= Fq; dq[j] += Fq; flux += Fq < 0 ? -Fq : Fq; }
      const Fp = rule(a[i].p - a[j].p, kpFix, thetaPFix, alpha, SCALE);   // p 자기 확산(같은 규칙)
      if (Fp !== 0) { dp[i] -= Fp; dp[j] += Fp; }
    }
    for (let k = 0; k < a.length; k++) { a[k].q += dq[k]; a[k].p += dp[k]; a[k].x = a[k].q / SCALE; }
    sim.fluxLast = flux;
  }

  // arc F — 관성 적분(opt-in, knobs.inertial 일 때만). 새 *법칙* 아님: 같은 힘 Gᵢ=−Σⱼ F(i→j) 를
  //   과감쇠(q←q+G) 대신 **관성**으로 적분한다 — 심플렉틱 오일러(leapfrog): vᵢ ← vᵢ + Gᵢ ; qᵢ ← qᵢ + vᵢ.
  //   바뀐 건 *역학*(힘을 운동으로 바꾸는 법)뿐, 힘의 법칙 rule() 은 step-0001 고정(SPINE §3·§4). inertial 미설정
  //   장면은 위 과감쇠 경로 그대로 → 과거 10 장면 비트 불변(회귀 0). v 도 *고정소수점 정수*(vfix, q-단위/tick) —
  //   정수 +,−,× 만 → 크로스플랫폼 비트 결정론(net lockstep). 보존: 반대칭(−F/+F)이 ΣG=0 → ΣΔv=0,
  //   Σv₀=0(초기 정지) → ΣP 비트 불변. 같은 −F/+F 가 ΣΔq 도 정확 0(ΣΔq=Σv 증분, Σv≡0). ⚠ 안정역 CFL:
  //   ω(k)=2√κ·|sin(k/2)|, 3D 6-이웃 ω_max=2√(κ·3) → κ·Z<4 (Z=6 → κ<2/3) 안에서 유계 진동(장면 책임).
  function applyInertial(sim) {
    const kn = sim.knobs, SCALE = K.SCALE;
    const kappaFix = Math.round(kn.kappa * SCALE);
    const thetaFix = Math.round((kn.theta || 0) * SCALE);
    const alpha = Math.max(1, Math.round(kn.alpha || 1));
    if (!kappaFix) return;
    const a = sim.atoms, edges = sim.edges;
    const G = sim._delta || (sim._delta = new Float64Array(a.length));
    G.fill(0);
    let flux = 0;
    for (let e = 0; e < edges.length; e++) {                 // 알짜 힘 Gᵢ = −Σⱼ F(i→j) (반대칭 → ΣG=0)
      const i = edges[e][0], j = edges[e][1];
      const F = rule(a[i].q - a[j].q, kappaFix, thetaFix, alpha, SCALE);
      if (F === 0) continue;
      G[i] -= F; G[j] += F;                                  // i 가 j 에게 F → i 는 −F, j 는 +F (복원력)
      flux += F < 0 ? -F : F;
    }
    for (let k = 0; k < a.length; k++) {                     // 심플렉틱 오일러(정수): v 먼저, 그 v 로 q
      let v = (a[k].v || 0) + G[k];                          // vᵢ ← vᵢ + Gᵢ (정수 누적·ΣΔv=ΣG=0)
      a[k].v = v;
      a[k].q += v;                                           // qᵢ ← qᵢ + vᵢ (ΣΔq=Σv, Σv≡0 → Σq 비트 불변)
      a[k].x = a[k].q / SCALE;                               // 렌더 밝기(파생·읽기 전용)
    }
    sim.fluxLast = flux;
  }

  // arc J(다발) — 둘째 보존 채널 b = *원자가*(opt-in, knobs.valence 일 때만). 단일 q 천장(0019·0020: 등방·비포화
  //   →덩어리)을 SPINE §5 처방대로 *측정이 명령한* 다성분 보존 다발로 돌파한다. 새 *법칙* 아님 — 같은 rule() 을
  //   q·b 두 채널에 각각 적용 + 둘 사이 **교차-인력**(cross-attraction): q 는 높은 b 로, b 는 높은 q 로 흐른다
  //   (서로 끌어당겨 *겹치는 곳*에 갇힘). 두 q-브리더가 각자 b-구름을 파고, 그 구름이 겹쳐 둘을 *고정 간격*으로
  //   묶는다(인력 우물). b 총량이 유한 → 결합에 소진되어 *포화*(정해진 개수만 결합) = 원자가. 두 교차 플럭스 모두
  //   간선 반대칭(−Fc/+Fc) → ΣQ·ΣB 비트 보존. q 는 관성(브리더 유지)·b 는 과감쇠(정적 결합 풀 = 안정).
  //   정수 전용(floor) — 결정론. ⚠ kc 가 크면 발산 — 안정역은 장면 책임(작은 kc·κb).
  function applyValence(sim) {
    const kn = sim.knobs, SCALE = K.SCALE;
    const kappaFix = Math.round(kn.kappa * SCALE);
    const thetaFix = Math.round((kn.theta || 0) * SCALE);
    const alpha = Math.max(1, Math.round(kn.alpha || 1));
    const kbFix = Math.round((kn.kappaB != null ? kn.kappaB : kn.kappa) * SCALE); // b 자기 확산률
    const kcFix = Math.round(kn.kc * SCALE);                                       // 교차-인력(결합) 세기
    if (!kappaFix) return;
    const a = sim.atoms, edges = sim.edges;
    const G = sim._delta || (sim._delta = new Float64Array(a.length));    // q 알짜 힘(관성)
    const dB = sim._deltaB || (sim._deltaB = new Float64Array(a.length));  // b 델타(과감쇠)
    G.fill(0); dB.fill(0);
    let flux = 0;
    for (let e = 0; e < edges.length; e++) {
      const i = edges[e][0], j = edges[e][1];
      const dq = a[i].q - a[j].q, dbq = (a[i].b || 0) - (a[j].b || 0);
      // q: 자기 상호작용(브리더, rule) + 교차-인력(q 를 높은 b 쪽으로 — b_j−b_i = −dbq)
      let Fq = rule(dq, kappaFix, thetaFix, alpha, SCALE) + Math.floor(kcFix * (-dbq) / SCALE);
      if (Fq !== 0) { G[i] -= Fq; G[j] += Fq; flux += Fq < 0 ? -Fq : Fq; }
      // b: 자기 확산(rule, θ=0·α=1) + 교차-인력(b 를 높은 q 쪽으로 — q_j−q_i = −dq)
      const Fb = rule(dbq, kbFix, 0, 1, SCALE) + Math.floor(kcFix * (-dq) / SCALE);
      if (Fb !== 0) { dB[i] -= Fb; dB[j] += Fb; }
    }
    for (let k = 0; k < a.length; k++) {
      let v = (a[k].v || 0) + G[k]; a[k].v = v; a[k].q += v;   // q 관성 적분(파동·브리더)
      a[k].b = (a[k].b || 0) + dB[k];                          // b 과감쇠 적분(정적 결합 풀)
      a[k].x = a[k].q / SCALE;
    }
    sim.fluxLast = flux;
  }

  return { rule, apply, applyValence };
});
