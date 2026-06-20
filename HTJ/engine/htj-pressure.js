// htj-pressure.js — HTJ 여섯째 법칙: 단거리 반발(압력) = 밀집을 거부하는 힘. 중력의 거울짝.
//
//   step_0007 의 중력은 *끌어모으기만* 한다 — 반발이 없어 질량 구름이 끝내 한 점으로 무한히
//   붕괴한다(무압력 dust 특이점, 수치적으로는 발산→NaN). 현실에서 붕괴를 멈추는 건 스케일만
//   다를 뿐 모두 한 종류 — **밀도가 어느 선을 넘으면 되밀어내는 압력**(열압력·축퇴압·EM/파울리·
//   강력의 반발 코어). 한 문장: "물질은 일정 밀도 이상으로 압축되기를 거부한다" = 단거리 반발.
//
//   법칙은 **바로트로픽 압력** 하나 — 밀도만의 함수로 압력을 정하고 그 기울기가 운동량을 *민다*:
//     P = K·ρ^γ                          (밀도가 높을수록 가파르게 커지는 반발 퍼텐셜)
//     운동량 :  g ← g − dt·∇P            (압력 기울기 = 밀집→희박 방향으로 미는 힘/부피)
//   중력이 g ← g + dt·ρ·(−∇Φ) 로 *대비를 키운다*면, 압력은 g ← g − dt·∇P 로 *대비를 지운다* —
//   확산과 같은 편(흩음)이지만 *탄도적*(운동량을 통해)이다. 둘(중력↓·압력↑)이 균형 잡는 밀도에서
//   붕괴가 멈춰 **유한 크기의 지속하는 덩어리**가 선다(= 입자·물체의 씨앗, author 안 함).
//
//   왜 γ 가 중요한가(못 박음): 자기중력 붕괴를 멈추려면 압력이 중력보다 *빨리* 세져야 한다 —
//     γ > 4/3 이면 압력이 이긴다(Chandrasekhar 한계). 기본 γ=2(≫4/3) → 깨끗이 붕괴를 멈춘다.
//   · 균일 무력: 균일 밀도 → ∇P=0 → 순 힘 0(끌·밀 중심 없음). 중력의 평균 차감과 같은 정신.
//   · 순 운동량 정확 보존: 주기 경계 중심차분이면 Σ_i (∇P)_i = 0(telescoping) → ΣΔg = 0
//     (내부 힘은 질량중심을 못 가속, 뉴턴 3법칙). Poisson 의 ā 차감보다도 단순한 정확 보존.
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   K=0 또는 dt=0 → 항등(early return) — 가법성/회귀 0 가드. 중력·이류와 직교 공존.
//   미래 step: 압력을 밀도만이 아니라 *내부에너지/온도*의 함수 P(ρ,T) 로 올리면 — 붕괴로 잃던
//     운동E가 *열*이 되어(step_0007 의 "사라진 에너지"를 닫음) 별이 서고, 상(고체·액체·기체·
//     플라즈마)이 같은 필드의 *영역*으로 창발한다(플라즈마 = 온도 임계 위 영역).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJPressure = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RHO = 'energy';                 // 질량 밀도 = 에너지(E=mc²)
  const MX = 'mom_x', MY = 'mom_y', MZ = 'mom_z';   // 운동량 밀도(htj-inertia·htj-gravity 와 공유)
  const DEFAULT_K = 1.0;                // 압력(반발) 결합 상수(노브)
  const DEFAULT_GAMMA = 2.0;            // 폴리트로픽 지수(γ>4/3 면 중력 붕괴를 멈춤)
  const EPS = 1e-12;

  function ensure(world, name) { return world.fields[name] || world.addField(name, { type: Float64Array }); }

  // 압력 장 P = K·ρ^γ 를 scratch 에 채워 돌려준다(반발 퍼텐셜). 측정·검증 공유.
  function pressureField(world, opts) {
    opts = opts || {};
    const K = opts.K != null ? opts.K : DEFAULT_K;
    const gamma = opts.gamma != null ? opts.gamma : DEFAULT_GAMMA;
    const rho = world.fields[opts.field || RHO], L = rho.length;
    const P = world.scratch.__press || (world.scratch.__press = new Float64Array(L));
    for (let i = 0; i < L; i++) { const r = rho[i]; P[i] = r > 0 ? K * Math.pow(r, gamma) : 0; }
    return P;
  }

  // 반발(압력) 1스텝 — P=K·ρ^γ 의 기울기로 운동량을 민다: g ← g − dt·∇P.
  //   K=0 또는 dt=0 → 항등(early return, 회귀 0). 주기 중심차분 → 순 운동량 정확 보존(Σ∇P=0).
  function applyPressure(world, dt, opts) {
    opts = opts || {};
    const K = opts.K != null ? opts.K : DEFAULT_K;
    if (dt == null) dt = 1;
    if (!K || !dt) return world;                 // 노브=0 → 세계 불변
    const N = world.N, NN = N * N;
    const gx = ensure(world, MX), gy = ensure(world, MY), gz = ensure(world, MZ);
    const P = pressureField(world, opts);        // P = K·ρ^γ
    const wrap = (a) => (a + N) % N;
    // g ← g − dt·∇P (중심차분, 주기 경계 — 중력 BC 와 일치, Σ∇P=0 → 순 운동량 보존).
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x;
      const xm = (z * N + y) * N + wrap(x - 1), xp = (z * N + y) * N + wrap(x + 1);
      const ym = (z * N + wrap(y - 1)) * N + x, yp = (z * N + wrap(y + 1)) * N + x;
      const zm = (wrap(z - 1) * N + y) * N + x, zp = (wrap(z + 1) * N + y) * N + x;
      gx[i] -= dt * (P[xp] - P[xm]) / 2;
      gy[i] -= dt * (P[yp] - P[ym]) / 2;
      gz[i] -= dt * (P[zp] - P[zm]) / 2;
    }
    return world;
  }

  // 데모 시드 — 가운데 단일 과밀 덩어리(가우시안), 정지(운동량 0). 중력↔압력 균형으로 *유한 코어*가 서는 걸 본다.
  function seedBlob(world, opts) {
    opts = opts || {};
    const N = world.N, rho = world.fields[opts.field || RHO];
    const sig = opts.sigma != null ? opts.sigma : N * 0.16, c = (N - 1) / 2;
    const M0 = opts.M0 != null ? opts.M0 : 1000;
    for (const nm of [MX, MY, MZ]) ensure(world, nm).fill(0);
    rho.fill(0);
    const s2 = 2 * sig * sig; let sum = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - c, dy = y - c, dz = z - c;
      const w = Math.exp(-(dx * dx + dy * dy + dz * dz) / s2);
      rho[(z * N + y) * N + x] = w; sum += w;
    }
    const kk = sum > 0 ? M0 / sum : 0;
    for (let i = 0; i < rho.length; i++) rho[i] *= kk;
    ensure(world, 'phi').fill(0);
    return world;
  }

  return { applyPressure, pressureField, seedBlob,
           RHO, MX, MY, MZ, DEFAULT_K, DEFAULT_GAMMA, VERSION: 1 };
});
