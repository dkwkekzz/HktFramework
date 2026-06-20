// htj-thermal.js — HTJ 일곱째 법칙: 내부에너지(온도) — 압축은 데우고 팽창은 식힌다 (열역학 제1법칙).
//
//   step_0008 의 반발(압력)은 밀도만의 함수 P=K·ρ^γ — *차가운* 축퇴압이다. 거기엔 **열/온도 자유도가
//   없다**: 붕괴로 모인 운동E가 어디로도 *데워지지* 않는다. 현실에서 별이 서는 건 차가운 축퇴압이 아니라
//   *뜨거운 열압력* 때문이고(압축→가열→팽창), 고체·액체·기체·플라즈마를 가르는 것도 온도다.
//   "물질은 온도를 가진다" — 이 자유도를 세운다.
//
//   새 장: **내부에너지 밀도 u**(`therm`). 온도 T = u/ρ(비내부에너지, c_v=1). 열압력 P_th=(γ−1)·u=(γ−1)ρT
//   (이상기체). 법칙은 **압축 가열(PdV 일)** 하나 — 열역학 제1법칙 dU=−P dV 를 부피 변화 ∇·v 로 쓴 것:
//     du/dt = −(P+u)(∇·v) = −γ·u·(∇·v)          (P=(γ−1)u 대입; ∇·v<0=압축→u↑, ∇·v>0=팽창→u↓)
//   여기서 v=g/ρ 는 step_0006 운동량이 정한 속도. 모이는(수렴) 흐름은 *데우고*, 퍼지는(발산) 흐름은
//   *식힌다*. 균일 운동(평행이동, ∇·v=0)은 무력 — 데우는 건 *압축*이지 운동 자체가 아니다.
//
//   못 박는 것(연속체에서 정확):
//     · **단열 관계 T ∝ ρ^(γ−1)**: 연속(dρ/ρ=−∇·v dt)과 짝지으면 d(ln u)/d(ln ρ)=γ → u∝ρ^γ,
//       T=u/ρ∝ρ^(γ−1). 이 step 법칙의 핵심 결과(단열 단열선/adiabat). γ=5/3=단원자 이상기체.
//     · 압축↑·팽창↓·균일 무력 — 부호가 ∇·v 가 정한다.
//   기본 γ=5/3. 이번 step 은 **수동(passive) 온도** — u 는 *측정*되지만 아직 운동량을 되밀지 않는다
//   (열압력 되먹임은 다음 step). 그래서 energy·mom 장을 건드리지 않는다 → 기존 step 회귀 0.
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   dt=0(또는 u 전부 0, 운동량 0) → 항등(early return/무변화) — 가법성/회귀 0 가드. 다른 법칙과 직교 공존.
//   미래 step: 열압력 P_th 의 기울기로 운동량을 *되밀면*(g ← g − dt·∇P_th) — 붕괴 운동E가 *열*이 되어
//     별이 *열압력으로* 서고(KE↔내부E 보존, step_0007 "사라진 에너지" 장부를 닫음), 상태방정식
//     P(ρ,T) 가 고체·액체·기체·플라즈마를 같은 필드의 *영역*으로 가른다(플라즈마=온도 임계 위).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJThermal = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RHO = 'energy';                 // 질량 밀도 = 에너지(E=mc²)
  const THERM = 'therm';                // 내부에너지 밀도 u(열) — 새 장
  const MX = 'mom_x', MY = 'mom_y', MZ = 'mom_z';   // 운동량 밀도 g=ρv(htj-inertia 와 공유)
  const DEFAULT_GAMMA = 5 / 3;          // 단열 지수(단원자 이상기체); T∝ρ^(γ−1)
  const EPS = 1e-12;

  function ensure(world, name) { return world.fields[name] || world.addField(name, { type: Float64Array }); }

  // 속도 발산 ∇·v (v=g/ρ) 를 scratch 에 채워 돌려준다. 중심차분·주기 경계(압력 stencil 과 일치).
  //   수렴(∇·v<0)=압축, 발산(∇·v>0)=팽창. 운동량 장이 없으면 0(정지=무변화). 측정·검증 공유.
  function divergence(world) {
    const N = world.N, L = N * N * N;
    const rho = world.fields[RHO];
    const gx = world.fields[MX], gy = world.fields[MY], gz = world.fields[MZ];
    const div = world.scratch.__tdiv || (world.scratch.__tdiv = new Float64Array(L));
    if (!gx) { div.fill(0); return div; }                  // 운동량 없음 → v=0 → ∇·v=0
    const vx = world.scratch.__tvx || (world.scratch.__tvx = new Float64Array(L));
    const vy = world.scratch.__tvy || (world.scratch.__tvy = new Float64Array(L));
    const vz = world.scratch.__tvz || (world.scratch.__tvz = new Float64Array(L));
    for (let i = 0; i < L; i++) {
      const r = rho[i] > EPS ? rho[i] : 0, inv = r > 0 ? 1 / rho[i] : 0;
      vx[i] = gx[i] * inv; vy[i] = gy[i] * inv; vz[i] = gz[i] * inv;
    }
    const wrap = (a) => (a + N) % N;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x;
      const xm = (z * N + y) * N + wrap(x - 1), xp = (z * N + y) * N + wrap(x + 1);
      const ym = (z * N + wrap(y - 1)) * N + x, yp = (z * N + wrap(y + 1)) * N + x;
      const zm = (wrap(z - 1) * N + y) * N + x, zp = (wrap(z + 1) * N + y) * N + x;
      div[i] = (vx[xp] - vx[xm]) / 2 + (vy[yp] - vy[ym]) / 2 + (vz[zp] - vz[zm]) / 2;
    }
    return div;
  }

  // 압축 가열 1스텝 — u ← u − dt·γ·u·(∇·v).  ∇·v<0(압축)→u↑, ∇·v>0(팽창)→u↓.
  //   dt=0 → 항등(early return, 회귀 0). u 는 음수가 되지 않게 0 에서 막는다(물리: u≥0).
  //   energy·mom 장은 건드리지 않는다(수동 온도) → 기존 step 회귀 0.
  function applyHeating(world, dt, opts) {
    opts = opts || {};
    if (dt == null) dt = 1;
    if (!dt) return world;                                 // 노브=0 → 세계 불변
    const gamma = opts.gamma != null ? opts.gamma : DEFAULT_GAMMA;
    const u = ensure(world, THERM), L = u.length;
    const div = divergence(world);
    for (let i = 0; i < L; i++) {
      const nu = u[i] * (1 - dt * gamma * div[i]);
      u[i] = nu > 0 ? nu : 0;
    }
    return world;
  }

  // 열압력 P_th = (γ−1)·u 를 scratch 에 채워 돌려준다(이상기체). 측정·검증·(미래) 되먹임 공유.
  function thermalPressure(world, opts) {
    opts = opts || {};
    const gamma = opts.gamma != null ? opts.gamma : DEFAULT_GAMMA;
    const u = ensure(world, THERM), L = u.length;
    const P = world.scratch.__tpress || (world.scratch.__tpress = new Float64Array(L));
    const c = gamma - 1;
    for (let i = 0; i < L; i++) P[i] = c * u[i];
    return P;
  }

  // 온도 T = u/ρ(비내부에너지) 를 scratch 에 채워 돌려준다. ρ≈0 → T=0. 렌더/측정용.
  function temperature(world) {
    const rho = world.fields[RHO], u = ensure(world, THERM), L = u.length;
    const T = world.scratch.__ttemp || (world.scratch.__ttemp = new Float64Array(L));
    for (let i = 0; i < L; i++) T[i] = rho[i] > EPS ? u[i] / rho[i] : 0;
    return T;
  }

  // 총 내부에너지 Σu — 측정자(수동 단계: 자체 보존이 아니라 압축/팽창으로 펌프됨).
  function totalInternal(world) { const u = ensure(world, THERM); let s = 0; for (let i = 0; i < u.length; i++) s += u[i]; return s; }

  // 데모 시드 — 가운데 과밀 구름(가우시안, 정지) + *균일 온도* T0(u=ρ·T0). 정지에서 시작.
  //   중력↔반발이 구름을 수축시키면 *코어가 압축*(∇·v<0)되어 그곳 u(=온도)가 오르는 걸 본다.
  function seedWarmBlob(world, opts) {
    opts = opts || {};
    const N = world.N, rho = world.fields[opts.field || RHO];
    const sig = opts.sigma != null ? opts.sigma : N * 0.16, c = (N - 1) / 2;
    const M0 = opts.M0 != null ? opts.M0 : 1000, T0 = opts.T0 != null ? opts.T0 : 1.0;
    for (const nm of [MX, MY, MZ]) ensure(world, nm).fill(0);
    rho.fill(0);
    const s2 = 2 * sig * sig; let sum = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - c, dy = y - c, dz = z - c;
      const w = Math.exp(-(dx * dx + dy * dy + dz * dz) / s2);
      rho[(z * N + y) * N + x] = w; sum += w;
    }
    const kk = sum > 0 ? M0 / sum : 0;
    const u = ensure(world, THERM);
    for (let i = 0; i < rho.length; i++) { rho[i] *= kk; u[i] = rho[i] * T0; }   // T=u/ρ=T0 균일
    ensure(world, 'phi').fill(0);
    return world;
  }

  return { applyHeating, divergence, thermalPressure, temperature, totalInternal, seedWarmBlob,
           RHO, THERM, MX, MY, MZ, DEFAULT_GAMMA, VERSION: 1 };
});
