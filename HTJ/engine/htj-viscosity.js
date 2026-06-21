// htj-viscosity.js — HTJ 아홉째 법칙: 비가역 소산(인공 점성/충격 가열) = bulk 운동E를 *열로 일방* 전환.
//
//   step_0010 의 열압력은 KE↔내부E 를 *가역*(단열)으로 교환한다 — 빌려준 운동E를 그대로 돌려받는다.
//   그래서 진동을 **감쇠하지 못한다**(무감쇠). 직접 측정한 결과 step_0008 흐름은 탄성 bounce 에
//   소산이 0 이라 진동이 누적되다 CFL 위반으로 *수치 발산(NaN)* 했다. 별이 *정착해서 서려면*
//   운동E가 열로 *영영* 빠져 다시 안 돌아와야 한다 = **비가역 소산**(엔트로피 증가).
//
//   법칙은 **인공 bulk 점성(von Neumann–Richtmyer)** 하나 — 압축에서만 켜지는 한 방향 밸브:
//     q = Kvisc·ρ·(∇·v)²   단 ∇·v<0(압축)에서만, 아니면 0      (q≥0; 점성 압력)
//     운동량 :  g ← g − dt·∇q          (압축 흐름을 *감속* = bulk KE 제거)
//     내부E  :  u ← u − dt·q·(∇·v)      (PdV 일; ∇·v<0 → u↑ = 가열, 항상 ≥0)
//   step_0010 의 열압력과 *구조는 같다*(둘이 짝지어 KE+u 보존·운동량 보존) — 차이는 **q 가 압축에서만
//   켜진다**는 것. 팽창(∇·v>0)에서는 q=0 → *식히는 법이 없다*. 그래서 한 진동 사이클에서 압축은 KE 를
//   열로 떼어가고 팽창은 돌려주지 않아 → **KE 가 열로 *일방* 빠진다**(엔트로피 단조↑ = 비가역).
//   이것이 step_0010 가역 교환과의 결정적 대비이자, 진동을 *감쇠*시켜 별을 *정착*시키는 부품이다.
//
//   못 박는 것:
//     · 압축 전용(일방 밸브): ∇·v<0 만 q>0 → u 는 이 법칙으로 *절대 줄지 않는다*(가열 소스).
//     · 총E=KE+u 보존: 두 조각의 1차 합 = −dt·∇·(q v) → 주기 경계서 Σ=0 (telescoping). KE 가 준 만큼
//       u 가 는다(연속체 정확, 명시적 이산 1차·dt 수렴). "소산"=형태 변환이지 에너지 손실이 아니다.
//     · 순 운동량 정확 보존: 주기 중심차분 → Σ∇q=0 → ΣΔg=0(내부 힘, 뉴턴 3법칙).
//     · 균일 무력: 균일 ρ·균일 v → ∇·v=0 → q=0 → 운동량·u 불변.
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   Kvisc=0 또는 dt=0 → 항등(early return) — 가법성/회귀 0 가드. 중력·반발·이류·열압력과 직교 공존.
//   ∇·v 는 *밀기 전* 속도로 계산 → push 와 가열이 같은 시점 v 를 공유(짝 일관, 열압력 stencil 과 동일).
//   미래 step: 복사 냉각(열을 세계 밖으로)을 더하면 압축↔복사 균형으로 영구 그래디언트(step_0005 별 트랙
//     합류), 상태방정식 P(ρ,T) 가 상(고체·액체·기체·플라즈마)을 같은 필드의 *영역*으로 가른다.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJViscosity = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RHO = 'energy';                 // 질량 밀도 = 에너지(E=mc²)
  const THERM = 'therm';                // 내부에너지 밀도 u(열) — 소산이 들어가는 곳
  const MX = 'mom_x', MY = 'mom_y', MZ = 'mom_z';   // 운동량 밀도 g=ρv(공유)
  const DEFAULT_KVISC = 1.0;            // 점성 결합 노브
  const EPS = 1e-12;
  const VMAX = 50;                      // 속도 상한(진공 가드, htj-inertia/thermal 과 동일): near-vacuum 셀의
                                       //   v=g/ρ 폭주가 ∇·v 를 오염시키는 걸 막는다. 정상 |v_축|≈4 ≪ 50 → 회귀 0.
  const CFL_VISC = 1.0;                // 점성 CFL 한계 — 인공 bulk 점성은 확산형이라 Kvisc·|∇·v|·dt ≤ 1 에서만
                                       //   안정. 강한 압축(붕괴)에서 |∇·v| 가 커지면 발산 → 서브스텝으로 쪼갠다. 이 아래면 nsub=1.
  const NSUB_MAX = 256;                // 점성 서브스텝 상한(폭주 가드). 정상 흐름은 nsub=1 → byte-동일.

  function ensure(world, name) { return world.fields[name] || world.addField(name, { type: Float64Array }); }

  // 속도 발산 ∇·v (v=g/ρ) 를 scratch 에 채워 돌려준다. 중심차분·주기 경계(열압력 stencil 과 일치).
  //   수렴(∇·v<0)=압축, 발산(∇·v>0)=팽창. 운동량 장이 없으면 0(정지=무변화). 자체 helper(모듈 자립).
  function divergence(world) {
    const N = world.N, L = N * N * N;
    const rho = world.fields[RHO];
    const gx = world.fields[MX], gy = world.fields[MY], gz = world.fields[MZ];
    const div = world.scratch.__vdiv || (world.scratch.__vdiv = new Float64Array(L));
    if (!gx) { div.fill(0); return div; }                  // 운동량 없음 → v=0 → ∇·v=0
    const vx = world.scratch.__vvx || (world.scratch.__vvx = new Float64Array(L));
    const vy = world.scratch.__vvy || (world.scratch.__vvy = new Float64Array(L));
    const vz = world.scratch.__vvz || (world.scratch.__vvz = new Float64Array(L));
    for (let i = 0; i < L; i++) {
      const inv = rho[i] > EPS ? 1 / rho[i] : 0;
      // 진공 가드: ρ→0 셀의 v=g/ρ 폭주를 ±VMAX 로 묶는다(∇·v 오염 차단). 정상 |v|≤VMAX → 불변.
      let ux = gx[i] * inv, uy = gy[i] * inv, uz = gz[i] * inv;
      if (ux > VMAX) ux = VMAX; else if (ux < -VMAX) ux = -VMAX;
      if (uy > VMAX) uy = VMAX; else if (uy < -VMAX) uy = -VMAX;
      if (uz > VMAX) uz = VMAX; else if (uz < -VMAX) uz = -VMAX;
      vx[i] = ux; vy[i] = uy; vz[i] = uz;
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

  // 인공 점성 압력 q = Kvisc·ρ·(∇·v)²  (압축 ∇·v<0 에서만; 아니면 0) 를 scratch 에 채워 돌려준다.
  //   q≥0(점성 압력은 항상 밀어냄), 일방 밸브. 측정·검증 공유.
  function viscousPressure(world, opts) {
    opts = opts || {};
    const Kvisc = opts.Kvisc != null ? opts.Kvisc : DEFAULT_KVISC;
    const rho = world.fields[RHO], L = rho.length;
    const div = divergence(world);
    const q = world.scratch.__vq || (world.scratch.__vq = new Float64Array(L));
    for (let i = 0; i < L; i++) { const d = div[i]; q[i] = d < 0 ? Kvisc * rho[i] * d * d : 0; }
    return q;
  }

  // 비가역 소산 1스텝 — 인공 점성이 bulk KE 를 *열로 일방* 전환:
  //     운동량 :  g ← g − dt·∇q          (압축 흐름 감속 → KE↓)
  //     내부E  :  u ← u − dt·q·(∇·v)      (PdV; div<0 → u↑, 항상 가열)
  //   둘이 짝지어 총E=KE+u 보존(1차), 운동량 보존(주기 중심차분 Σ∇q=0). q 가 압축에서만 켜져
  //   **식히는 법이 없다** → KE 가 열로 일방 빠진다(엔트로피↑=비가역) → 진동 감쇠 → 정착.
  //   Kvisc=0 또는 dt=0 → 항등(early return, 회귀 0). energy(ρ)는 안 건드린다(질량은 이류 담당).
  //   ∇·v 는 *밀기 전* 속도로 계산(q·push 가 같은 시점 v 공유 → 짝 일관).
  //
  //   **점성 CFL 서브스텝**(advect/열압력 CFL 서브스텝과 같은 패턴): 인공 bulk 점성은 확산형이라
  //   Kvisc·|∇·v|·dt ≤ 1 에서만 안정하다. 붕괴로 강한 압축(|∇·v|↑)이 생기면 명시적 점성이 발산하므로
  //   dt 를 nsub 로 쪼개(서브스텝마다 ∇·v·q 재계산) 정확·보존 적분을 지킨다. **Kvisc·|∇·v|·dt ≤ CFL_VISC
  //   이면 nsub=1 → 종전과 byte-동일(회귀 0)**.
  function applyViscosity(world, dt, opts) {
    opts = opts || {};
    const Kvisc = opts.Kvisc != null ? opts.Kvisc : DEFAULT_KVISC;
    if (dt == null) dt = 1;
    if (!Kvisc || !dt) return world;                     // 노브=0 → 세계 불변
    const N = world.N, L = N * N * N;
    const u = ensure(world, THERM);
    const gx = ensure(world, MX), gy = ensure(world, MY), gz = ensure(world, MZ);
    const rho = world.fields[RHO];
    const q = world.scratch.__vqf || (world.scratch.__vqf = new Float64Array(L));
    const wrap = (a) => (a + N) % N;

    // 점성 CFL: 최대 Kvisc·|∇·v|. >CFL_VISC 이면 dt 를 nsub 로 쪼갠다(nsub=1 이면 byte-동일). div0 은 s=0 재사용.
    const div0 = divergence(world);
    let md = 0; for (let i = 0; i < L; i++) { const a = Kvisc * Math.abs(div0[i]); if (a > md) md = a; }
    const courant = md * dt;
    const nsub = courant > CFL_VISC ? Math.min(NSUB_MAX, Math.ceil(courant / CFL_VISC)) : 1;
    const h = dt / nsub;

    for (let s = 0; s < nsub; s++) {
      const div = s === 0 ? div0 : divergence(world);     // ∇·v (밀기 전 속도; s=0 은 사이징 값 재사용)
      // q = Kvisc·ρ·(∇·v)² (압축에서만). div 와 같은 시점.
      for (let i = 0; i < L; i++) { const d = div[i]; q[i] = d < 0 ? Kvisc * rho[i] * d * d : 0; }
      // 운동량 푸시 g ← g − h·∇q (중심차분·주기 — Σ∇q=0 → 순 운동량 보존).
      for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (z * N + y) * N + x;
        const xm = (z * N + y) * N + wrap(x - 1), xp = (z * N + y) * N + wrap(x + 1);
        const ym = (z * N + wrap(y - 1)) * N + x, yp = (z * N + wrap(y + 1)) * N + x;
        const zm = (wrap(z - 1) * N + y) * N + x, zp = (wrap(z + 1) * N + y) * N + x;
        gx[i] -= h * (q[xp] - q[xm]) / 2;
        gy[i] -= h * (q[yp] - q[ym]) / 2;
        gz[i] -= h * (q[zp] - q[zm]) / 2;
      }
      // PdV 가열 u ← u − h·q·(∇·v). q≥0·압축 div<0 → +(항상 가열, 일방). u≥0 가드.
      for (let i = 0; i < L; i++) { const nu = u[i] - h * q[i] * div[i]; u[i] = nu > 0 ? nu : 0; }
    }
    return world;
  }

  // 총 내부에너지 Σu — 소산이 적재되는 곳(비가역 가열 = 단조↑ 측정자).
  function totalInternal(world) { const u = ensure(world, THERM); let s = 0; for (let i = 0; i < u.length; i++) s += u[i]; return s; }

  // 운동에너지 ½Σ|g|²/ρ — KE↔내부E 보존·감쇠 측정자(모듈 자립용 재공).
  function kineticEnergy(world) {
    const rho = world.fields[RHO], gx = world.fields[MX], gy = world.fields[MY], gz = world.fields[MZ];
    if (!gx) return 0;
    let E = 0;
    for (let i = 0; i < rho.length; i++) if (rho[i] > EPS) E += 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / rho[i];
    return E;
  }

  return { applyViscosity, viscousPressure, divergence, totalInternal, kineticEnergy,
           RHO, THERM, MX, MY, MZ, DEFAULT_KVISC, VERSION: 1 };
});
