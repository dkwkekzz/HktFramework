// htj-energy.js — HTJ 의 첫 *동역학*: 에너지 장의 흐름 = 열역학 제2법칙(엔트로피 증가).
//
//   step_0001 은 무대(셀 공간)만 세웠다 — 법칙 0개. 이 모듈이 세계를 처음으로 *굴린다*.
//
//   법칙은 **확산(diffusion)** 하나 — 가장 단순한 국소 보존 흐름:
//     new_i = E_i + α · Σ_{이웃 j}(E_j − E_i)
//   이 한 줄이 두 열역학 법칙을 동시에 구현한다:
//     · 제1법칙(에너지 보존) — 닫힌 경계 + 대칭 flux. 한 셀이 잃은 만큼 이웃이 정확히 얻는다.
//       각 모서리 (i,j) 의 기여 (E_j−E_i)+(E_i−E_j)=0 → 총 에너지 불변.
//     · 제2법칙(엔트로피 증가) — 갱신 행렬 M 은 *이중확률*(행합=열합=1, α≤1/6 → 비음수).
//       이중확률 사상은 분포를 *섞어*(majorization) 샤논 엔트로피를 단조 증가시킨다 → 증명 가능.
//     평형: 연결된 격자에서 분포는 균일로 수렴 → 엔트로피 → ln(N³)(최대 무질서).
//
//   이 모듈은 세계(법칙) 그 자체다 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   미래 step 은 이 흐름에 *맞서는* 비선형/경쟁 법칙을 얹어, 확산을 거스르고 스스로 유지되는
//   국소 패턴(= 원자)이 *창발*하게 한다. 원자는 author 하지 않는다 — 이 장 위에서 생겨난다.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJEnergy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // α 안정 상한: 3D 6이웃 → α ≤ 1/6 이라야 대각(1−α·deg)≥0 (비음수·이중확률 보장).
  const ALPHA_MAX = 1 / 6;
  const DEFAULT_ALPHA = 1 / 7;   // 안정 상한 아래 기본값.

  // 확산 1스텝(동시 갱신) — 더블버퍼로 결정론·순서 무관.
  //   닫힌 경계(no-flux): 경계 밖 이웃과는 교환하지 않는다 → 에너지가 상자를 안 떠난다(총량 보존).
  //   α=0 → 항등(early return) — 가법성/회귀 0 가드.
  function diffuseEnergy(world, alpha) {
    if (alpha == null) alpha = DEFAULT_ALPHA;
    if (!alpha) return world;                         // 노브=0 → 세계 불변
    if (alpha < 0 || alpha > ALPHA_MAX) throw new Error('diffuseEnergy: alpha must be in [0, 1/6]');
    const N = world.N, E = world.energy, NN = N * N;
    const out = world._escratch && world._escratch.length === E.length
      ? world._escratch : (world._escratch = new Float64Array(E.length));
    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const i = (z * N + y) * N + x, e = E[i];
          let flux = 0;                                // Σ_{이웃}(E_j − E_i), 경계 밖은 생략(no-flux)
          if (x > 0)     flux += E[i - 1]  - e;
          if (x < N - 1) flux += E[i + 1]  - e;
          if (y > 0)     flux += E[i - N]  - e;
          if (y < N - 1) flux += E[i + N]  - e;
          if (z > 0)     flux += E[i - NN] - e;
          if (z < N - 1) flux += E[i + NN] - e;
          out[i] = e + alpha * flux;
        }
    E.set(out);
    return world;
  }

  // 샤논 엔트로피 S = −Σ pᵢ ln pᵢ (pᵢ = Eᵢ/총에너지). 단위 nats.
  //   최소 0(에너지가 한 셀에 집중) ~ 최대 ln(점유 셀 수)(완전 균일). 제2법칙의 *측정자*.
  function entropy(world) {
    const E = world.energy;
    let total = 0;
    for (let i = 0; i < E.length; i++) total += E[i];
    if (total <= 0) return 0;
    let S = 0;
    for (let i = 0; i < E.length; i++) {
      const p = E[i] / total;
      if (p > 0) S -= p * Math.log(p);
    }
    return S;
  }

  // 에너지 분산(균질도 측정) — 평형(균일)에 가까울수록 0 으로 수렴.
  function energyVariance(world) {
    const E = world.energy, n = E.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += E[i];
    mean /= n;
    let v = 0;
    for (let i = 0; i < n; i++) { const d = E[i] - mean; v += d * d; }
    return v / n;
  }

  // 데모 시드 — 중앙에 에너지를 집중(최소 엔트로피 출발점). half=0 → 단일 셀.
  //   법칙이 아니라 *정물*: 흐름을 눈에 보이게 하는 초기 조건.
  function seedHotSpot(world, opts) {
    opts = opts || {};
    const N = world.N, E = world.energy;
    E.fill(0);
    const E0 = opts.E0 != null ? opts.E0 : 1000;
    const half = opts.half != null ? opts.half : 0;     // 반폭(셀): 0 → 1셀, 1 → 3³ 정육면체
    const c = (N - 1) >> 1;
    const lo = Math.max(0, c - half), hi = Math.min(N - 1, c + half);
    const span = hi - lo + 1, n = span * span * span;
    const per = E0 / n;
    for (let z = lo; z <= hi; z++)
      for (let y = lo; y <= hi; y++)
        for (let x = lo; x <= hi; x++) E[(z * N + y) * N + x] = per;
    return world;
  }

  // 현재 장의 최대 에너지(렌더 색 스케일용 — 확인용 도구가 읽는다).
  function maxEnergy(world) {
    const E = world.energy; let m = 0;
    for (let i = 0; i < E.length; i++) if (E[i] > m) m = E[i];
    return m;
  }

  return { diffuseEnergy, entropy, energyVariance, seedHotSpot, maxEnergy,
           ALPHA_MAX, DEFAULT_ALPHA, VERSION: 1 };
});
