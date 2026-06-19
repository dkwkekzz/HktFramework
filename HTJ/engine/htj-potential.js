// htj-potential.js — HTJ 둘째 법칙: 에너지의 *탄생* = 잠재력(potential) → 에너지(energy) 방출.
//
//   step_0002 의 확산은 에너지를 *퍼뜨릴* 뿐 — 에너지는 author 가 손으로 주입했다(seedHotSpot/클릭).
//   "에너지는 어떻게 만들어지는가?" 의 답: **무에서 만들어지지 않는다(제1법칙).**
//   "탄생"의 정체는 *다른 형태에서 풀려나는 것* — 저장된 잠재력이 열로 *변환*된다.
//
//   그래서 세계에 둘째 장 'potential'(잠재 에너지 저장고)을 더하고, 변환 법칙 하나를 굴린다:
//     dEᵢ = rate · Pᵢ      (셀마다 남은 저장량에 비례해 방출 — 방사성 붕괴와 같은 지수 붕괴)
//     Pᵢ ← Pᵢ − dEᵢ ,  Eᵢ ← Eᵢ + dEᵢ
//   이 법칙은 두 가지를 못 박는다:
//     · 보존(제1법칙) — 셀마다 잃은 잠재력 = 얻은 에너지. 총합 Σ(P+E) 가 *정확히* 불변.
//       즉 에너지의 "생성"은 회계상 *형태 변환*일 뿐, 우주의 총량은 변하지 않는다.
//     · 국소성 — 방출은 *그 자리에서* 일어난다(이동 없음). 흐름은 확산이 따로 맡는다.
//   잠재력은 단조 감소(P(t)=P₀·(1−rate)ᵗ → 0)하므로, 방출은 *확산을 먹여주는 지속 source* 가 되어
//   세계가 곧장 균일 죽음으로 끝나지 않게 한다. 잠재력이 다 풀리면(P→0) 총에너지는 P₀ 로 수렴.
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   미래 step 은 *무엇이* 방출을 촉발하는지(임계·반응)를 얹어, 잠재력의 풀림에서 구조가 *창발*하게 한다.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJPotential = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SRC = 'potential';        // 잠재 에너지 저장고(연속 밀도, Float64)
  const DST = 'energy';           // 풀려난 에너지가 쌓이는 장(step_0002 의 확산 대상)
  const DEFAULT_RATE = 0.02;      // 한 스텝에 풀리는 비율(지수 붕괴 상수). 작을수록 천천히 탄생.

  // 방출 1스텝 — 잠재력의 일부가 같은 셀의 에너지로 변환된다(국소·보존).
  //   rate=0 → 항등(early return) — 가법성/회귀 0 가드.
  //   rate∈(0,1] 이라야 잠재력 비음수 유지(Pᵢ ← Pᵢ(1−rate) ≥ 0).
  //   opts.crit(점화 임계, 기본 0): P ≥ crit 인 셀만 방출한다 = **별**(밀집한 연료).
  //     crit 미만(옅은 배경=어두운 성간 가스)은 방출하지 않는다 → 별은 author 하지 않는다:
  //     "별의 형태" = 임계를 넘긴 영역의 모양. crit=0 → 무조건 방출(step_0003 와 동일, 회귀 0).
  //     별은 타며 P↓ → P<crit 이 되면 점화가 꺼진다(수명). 임계 아래 잔여 연료는 잠긴다.
  function releaseEnergy(world, rate, opts) {
    opts = opts || {};
    const src = opts.from || SRC, dst = opts.to || DST;
    const crit = opts.crit || 0;                       // 점화 임계(밀도 게이트)
    if (rate == null) rate = DEFAULT_RATE;
    if (!rate) return world;                           // 노브=0 → 세계 불변
    if (rate < 0 || rate > 1) throw new Error('releaseEnergy: rate must be in [0, 1]');
    const P = world.fields[src], E = world.fields[dst];
    if (!P) throw new Error(`releaseEnergy: field '${src}' 없음 — seedPotential 먼저 호출`);
    for (let i = 0; i < P.length; i++) {
      if (crit > 0 && P[i] < crit) continue;           // 임계 미만 = 어두운 가스(방출 없음)
      const dE = rate * P[i];                          // 방출량 ∝ 남은 저장량
      P[i] -= dE;                                      // 잠재력 감소
      E[i] += dE;                                      // 에너지 탄생(같은 셀, 더하기)
    }
    return world;
  }

  // 데모 시드 — 중앙의 *잠재력 저장고*(공)를 깔고, 에너지는 0(아직 안 태어남)으로 둔다.
  //   법칙이 아니라 *정물*: 방출이 무엇에서 풀려나는지 눈에 보이게 하는 초기 조건.
  //   uniform=true 면 상자 전체를 균일 저장고로(평형 잠재력) 채운다.
  function seedPotential(world, opts) {
    opts = opts || {};
    const P = world.fields[SRC] || world.addField(SRC, { type: Float64Array });
    const P0 = opts.P0 != null ? opts.P0 : 1000;      // 저장고 총량(또는 셀당 — uniform 일 때)
    P.fill(0);
    if (world.fields[DST]) world.fields[DST].fill(0);  // 에너지는 아직 0(저장고에 잠겨 있음)
    if (opts.uniform) { P.fill(P0); return world; }    // 균일 저장고
    // 중앙 공 형태 저장고 — 한 군데에서 에너지가 태어나 퍼지는 모습을 보이기 위함.
    const N = world.N, c = (N - 1) / 2;
    const r = opts.r != null ? opts.r : N * 0.18;
    let cells = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - c, dy = y - c, dz = z - c;
      if (dx * dx + dy * dy + dz * dz <= r * r) cells++;
    }
    const per = cells > 0 ? P0 / cells : 0;            // 총량 P0 을 공 셀에 고르게
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - c, dy = y - c, dz = z - c;
      if (dx * dx + dy * dy + dz * dz <= r * r) P[(z * N + y) * N + x] = per;
    }
    return world;
  }

  // 데모 시드 — *별밭* 정물: 옅은 균일 배경(어두운 가스) 위에 밀집한 중심 코어(별의 연료).
  //   코어는 중심에서 가장자리로 매끈히 감소(2차 봉우리)하므로, 점화 임계가 *코어보다 작은 구*를
  //   잘라낸다 → "별"의 형태가 임계로 정해진다(반지름 r 의 봉우리, 정점 core, 바깥은 background).
  //   법칙이 아니라 *초기 조건*: 별이 무엇에서 점화하는지 눈에 보이게 한다.
  function seedStarField(world, opts) {
    opts = opts || {};
    const P = world.fields[SRC] || world.addField(SRC, { type: Float64Array });
    const core = opts.core != null ? opts.core : 1000;        // 코어 정점 잠재력(밀집한 연료)
    const bg = opts.background != null ? opts.background : 50; // 배경 잠재력(어두운 가스, 보통 < crit)
    const N = world.N, c = (N - 1) / 2;
    const r = opts.r != null ? opts.r : N * 0.25;
    if (world.fields[DST]) world.fields[DST].fill(0);          // 에너지는 0(아직 점화 전)
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - c, dy = y - c, dz = z - c, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const t = d / r;                                         // 0(중심)~1(코어 가장자리)
      const bump = t < 1 ? (core - bg) * (1 - t * t) : 0;      // 2차 봉우리(정점 core→가장자리 0)
      P[(z * N + y) * N + x] = bg + bump;                      // 배경 + 봉우리
    }
    return world;
  }

  return { releaseEnergy, seedPotential, seedStarField, SRC, DST, DEFAULT_RATE, VERSION: 2 };
});
