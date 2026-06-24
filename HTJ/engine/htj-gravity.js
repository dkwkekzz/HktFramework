// htj-gravity.js — HTJ 다섯째 법칙: 보편중력 = 질량(=에너지)이 만든 퍼텐셜이 운동량을 가속한다.
//
//   step_0006 의 관성은 질량을 *직진*시킬 뿐 — 힘이 없었다. "질량은 어떻게 서로 끌어당기나?" 의 답:
//   **질량이 시공간(여기선 퍼텐셜 장)을 휘게 하고, 그 기울기가 곧 힘이다.** 모든 질량이 *예외 없이*
//   퍼텐셜을 만들고(source) 모든 질량이 그 기울기를 느낀다(response) = 만유인력(보편중력).
//
//   법칙은 **자기중력** 하나 — 두 조각이지만 한 인과사슬이다:
//     1) Poisson :  ∇²Φ = (ρ − ρ̄)        (질량 밀도 ρ=energy 가 퍼텐셜 Φ 를 만든다)
//     2) 가속    :  g ← g + dt·G·ρ·(a − ā),  a = −∇Φ   (기울기가 운동량을 가속)
//   · **평균 차감(Jeans swindle)**: source 를 (ρ−ρ̄) 로 — 균일 밀도는 *순 힘 0*(끌 중심이 없음),
//     오직 *밀도 대비*(과밀↔공동)만 끌어당긴다. 닫힌 상자에서 Poisson 의 가해성(∫source=0)도 만족.
//     이건 확산(대비를 *지움*)의 정확한 *거울상* — 중력은 대비를 *키운다*(과밀이 더 과밀=Jeans 불안정).
//   · **질량가중 평균 가속 ā 차감**: 내부 힘은 질량중심을 가속할 수 없다(뉴턴 3법칙) →
//     Σρ(a−ā)=0 이 되어 *순 운동량이 정확히 보존*된다(Poisson 수렴도와 무관하게).
//   Φ 는 Gauss-Seidel(red-black, 주기 경계) 완화로 푼다 — *첫 장거리(비국소) 법칙*. warm-start(직전 Φ 재사용).
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   G=0 또는 dt=0 → 항등(early return) — 회귀 0. 관성(이류)와 직교: 중력은 *운동량을 가속*, 이류는 *질량을 수송*.
//   미래 step: 단거리 *반발/포화*(겹침 거부)를 더하면 무한 붕괴가 멈추고 *지속하는 입자/접촉*이 창발한다.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJGravity = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RHO = 'energy';                 // 질량 밀도 = 에너지(E=mc²)
  const PHI = 'phi';                    // 중력 퍼텐셜 장(지연 초기화)
  const PMRHO = '__pmrho';             // 입자-메시 결합 밀도(ρ_grid + scatter(parts)) — Poisson source
  const MX = 'mom_x', MY = 'mom_y', MZ = 'mom_z';   // 운동량 밀도(htj-inertia 와 공유)
  const DEFAULT_G = 1.0;                // 중력 결합 상수(노브)
  const DEFAULT_ITERS = 400;           // Poisson Gauss-Seidel 완화 횟수
  const EPS = 1e-12;

  function ensure(world, name) { return world.fields[name] || world.addField(name, { type: Float64Array }); }

  // Poisson 풀이 — ∇²Φ = (ρ − ρ̄), red-black Gauss-Seidel(주기 경계). warm-start(Φ 안 지움).
  //   opts.reset → Φ 를 0 에서 다시. opts.iters → 완화 횟수. 결정론(고정 sweep 순서).
  function solvePotential(world, opts) {
    opts = opts || {};
    const N = world.N, NN = N * N, L = N * N * N;
    const rho = world.fields[opts.field || RHO];
    const phi = ensure(world, PHI);
    if (opts.reset) phi.fill(0);
    const iters = opts.iters != null ? opts.iters : DEFAULT_ITERS;
    // source s = ρ − ρ̄ (평균 차감 → 가해성·균일 무력).
    let mean = 0; for (let i = 0; i < L; i++) mean += rho[i]; mean /= L;
    const s = world.scratch.__gsrc || (world.scratch.__gsrc = new Float64Array(L));
    for (let i = 0; i < L; i++) s[i] = rho[i] - mean;
    const wrap = (a) => (a + N) % N;
    // Φ_i = (Σ_{6 이웃} Φ_j − s_i) / 6.  red(parity 0)→black(parity 1) 순서.
    for (let it = 0; it < iters; it++) {
      for (let parity = 0; parity < 2; parity++) {
        for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          if (((x + y + z) & 1) !== parity) continue;
          const i = (z * N + y) * N + x;
          const xm = (z * N + y) * N + wrap(x - 1), xp = (z * N + y) * N + wrap(x + 1);
          const ym = (z * N + wrap(y - 1)) * N + x, yp = (z * N + wrap(y + 1)) * N + x;
          const zm = (wrap(z - 1) * N + y) * N + x, zp = (wrap(z + 1) * N + y) * N + x;
          phi[i] = (phi[xm] + phi[xp] + phi[ym] + phi[yp] + phi[zm] + phi[zp] - s[i]) / 6;
        }
      }
    }
    return phi;
  }

  // 중력 가속 1스텝 — Φ 를 풀고 a=−∇Φ 로 운동량을 가속. 순 운동량 보존(평균 가속 차감).
  //   G=0 또는 dt=0 → 항등(early return, 회귀 0).
  function applyGravity(world, dt, opts) {
    opts = opts || {};
    const G = opts.G != null ? opts.G : DEFAULT_G;
    if (dt == null) dt = 1;
    if (!G || !dt) return world;                 // 노브=0 → 세계 불변
    const N = world.N, NN = N * N, L = N * N * N;
    const rho = world.fields[opts.field || RHO];
    const gx = ensure(world, MX), gy = ensure(world, MY), gz = ensure(world, MZ);
    solvePotential(world, opts);
    const phi = world.fields[PHI];
    const wrap = (a) => (a + N) % N;

    // a = −∇Φ (중심차분, 주기). 질량가중 평균 가속 ā 계산(뉴턴 3법칙 → 순 운동량 보존).
    const ax = world.scratch.__gax || (world.scratch.__gax = new Float64Array(L));
    const ay = world.scratch.__gay || (world.scratch.__gay = new Float64Array(L));
    const az = world.scratch.__gaz || (world.scratch.__gaz = new Float64Array(L));
    let Sx = 0, Sy = 0, Sz = 0, M = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x;
      const axm = (z * N + y) * N + wrap(x - 1), axp = (z * N + y) * N + wrap(x + 1);
      const aym = (z * N + wrap(y - 1)) * N + x, ayp = (z * N + wrap(y + 1)) * N + x;
      const azm = (wrap(z - 1) * N + y) * N + x, azp = (wrap(z + 1) * N + y) * N + x;
      const fx = -(phi[axp] - phi[axm]) / 2, fy = -(phi[ayp] - phi[aym]) / 2, fz = -(phi[azp] - phi[azm]) / 2;
      ax[i] = fx; ay[i] = fy; az[i] = fz;
      Sx += rho[i] * fx; Sy += rho[i] * fy; Sz += rho[i] * fz; M += rho[i];
    }
    const abx = M > EPS ? Sx / M : 0, aby = M > EPS ? Sy / M : 0, abz = M > EPS ? Sz / M : 0;
    const k = dt * G;
    for (let i = 0; i < L; i++) {
      const r = rho[i];
      gx[i] += k * r * (ax[i] - abx);
      gy[i] += k * r * (ay[i] - aby);
      gz[i] += k * r * (az[i] - abz);
    }
    return world;
  }

  // 입자-격자 통합 중력(Particle-Mesh) — 격자 유체와 SPH/자유 구체 입자가 *하나의 중력 퍼텐셜*을 공유한다.
  //   0007 자기중력은 격자만, 0033 통합중력(htj-hybrid)은 개체(Barnes-Hut)만 다뤘다. 0055~ 이주한 SPH 입자는
  //   격자 중력과 *미결합*이었다(SW5 의 마지막 잔여). 이 법칙이 그 공백을 메운다 = **0007 중력의 입자-메시(PM) 판**:
  //     1) 입자 질량을 격자에 적치(NGP·nearest-grid-point)해 *결합 밀도* ρ⁺ = ρ_grid + scatter(parts) 를 만들고
  //     2) 그 ρ⁺ 로 단 하나의 Poisson Φ 를 푼다 — 격자와 입자가 *같은* 퍼텐셜을 본다(진짜 통합)
  //     3) a=−∇Φ 로 격자 운동량과 입자 속도를 *함께* 가속한다.
  //   · 질량가중 평균 가속 ā(격자+입자 *모두* 포함) 차감 → 순 운동량 *정확* 보존(뉴턴 3법칙·NGP 적치/수집 대칭).
  //   · 입자 없음 → 0007 applyGravity 와 byte 동일(ρ⁺=ρ_grid·회귀 0). G=0 또는 dt=0 → 항등(early return).
  //   · 입자는 generic 구체(cx,cy,cz,mass,px,py,pz)만 안다 — 타입 무지(절대 원칙: engine 에 타입 분기 없음).
  //   **적치/수집 스텐실(opts.cic)** — 기본 NGP(nearest, 셀 해상도·blocky)·`cic:true` → CIC(cloud-in-cell·trilinear·
  //     셀 사이 8 셀에 부피 가중 분배·*같은* 가중으로 힘 수집 → 부드러운 sub-cell 격자력). 둘 다 적치·수집이 *대칭*이라
  //     평균 가속 차감으로 순 운동량 정확 보존(scheme 무관). cic 안 줌 → NGP = 0078 byte 동일(회귀 0).
  //   world(격자·제자리 가속)+particles(제자리 가속)·dt·opts{ G, field, iters, reset, cic }. 반환 world.
  function applyParticleMeshGravity(world, particles, dt, opts) {
    opts = opts || {};
    particles = particles || [];
    const G = opts.G != null ? opts.G : DEFAULT_G;
    if (dt == null) dt = 1;
    if (!G || !dt) return world;                 // 노브=0 → 세계·입자 불변(회귀 0)
    const N = world.N, NN = N * N, L = N * N * N;
    const rho = world.fields[opts.field || RHO];
    const gx = ensure(world, MX), gy = ensure(world, MY), gz = ensure(world, MZ);
    const clamp = (v) => v < 0 ? 0 : (v >= N ? N - 1 : v);
    const wrap = (a) => (a + N) % N;
    // 적치/수집 스텐실 — 입자 위치 → [[cellIndex, weight], …] (Σweight=1). NGP=단일 셀·CIC=8 셀 trilinear.
    function stencil(p) {
      if (!opts.cic) return [[(clamp(Math.round(p.cz || 0)) * N + clamp(Math.round(p.cy || 0))) * N + clamp(Math.round(p.cx || 0)), 1]];
      const px = p.cx || 0, py = p.cy || 0, pz = p.cz || 0;
      const x0 = Math.floor(px), y0 = Math.floor(py), z0 = Math.floor(pz), fx = px - x0, fy = py - y0, fz = pz - z0;
      const out = [];
      for (let dz = 0; dz < 2; dz++) { const wz = dz ? fz : 1 - fz, zz = wrap(z0 + dz);
        for (let dy = 0; dy < 2; dy++) { const wy = dy ? fy : 1 - fy, yy = wrap(y0 + dy);
          for (let dx = 0; dx < 2; dx++) { const wx = dx ? fx : 1 - fx, xx = wrap(x0 + dx);
            const w = wx * wy * wz; if (w !== 0) out.push([(zz * N + yy) * N + xx, w]); } } }
      return out;
    }
    const stencils = new Array(particles.length);
    for (let n = 0; n < particles.length; n++) stencils[n] = stencil(particles[n]);
    // ① 결합 밀도 ρ⁺ = ρ_grid + scatter(parts·스텐실) → scratch 장. 입자 없으면 ρ_grid 복사(항등).
    const src = ensure(world, PMRHO);
    src.set(rho);
    for (let n = 0; n < particles.length; n++) { const m = particles[n].mass || 0, st = stencils[n]; for (let c = 0; c < st.length; c++) src[st[c][0]] += m * st[c][1]; }
    // ② 결합 밀도로 단 하나의 Poisson Φ (격자·입자가 같은 퍼텐셜).
    solvePotential(world, { field: PMRHO, iters: opts.iters, reset: opts.reset });
    const phi = world.fields[PHI];
    // ③ a=−∇Φ (중심차분·주기) + 질량가중 평균 가속 ā(격자+입자 모두 → 순 운동량 정확 보존).
    const ax = world.scratch.__pmax || (world.scratch.__pmax = new Float64Array(L));
    const ay = world.scratch.__pmay || (world.scratch.__pmay = new Float64Array(L));
    const az = world.scratch.__pmaz || (world.scratch.__pmaz = new Float64Array(L));
    let Sx = 0, Sy = 0, Sz = 0, M = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x;
      const fx = -(phi[(z * N + y) * N + wrap(x + 1)] - phi[(z * N + y) * N + wrap(x - 1)]) / 2;
      const fy = -(phi[(z * N + wrap(y + 1)) * N + x] - phi[(z * N + wrap(y - 1)) * N + x]) / 2;
      const fz = -(phi[(wrap(z + 1) * N + y) * N + x] - phi[(wrap(z - 1) * N + y) * N + x]) / 2;
      ax[i] = fx; ay[i] = fy; az[i] = fz;
      Sx += rho[i] * fx; Sy += rho[i] * fy; Sz += rho[i] * fz; M += rho[i];
    }
    // 입자별 가속 a@p = Σ w·a[cell] (스텐실 수집) — 적치와 *같은* 가중(대칭).
    const pax = new Float64Array(particles.length), pay = new Float64Array(particles.length), paz = new Float64Array(particles.length);
    for (let n = 0; n < particles.length; n++) {
      const m = particles[n].mass || 0, st = stencils[n]; let gxa = 0, gya = 0, gza = 0;
      for (let c = 0; c < st.length; c++) { const i = st[c][0], w = st[c][1]; gxa += w * ax[i]; gya += w * ay[i]; gza += w * az[i]; }
      pax[n] = gxa; pay[n] = gya; paz[n] = gza;
      Sx += m * gxa; Sy += m * gya; Sz += m * gza; M += m;
    }
    const abx = M > EPS ? Sx / M : 0, aby = M > EPS ? Sy / M : 0, abz = M > EPS ? Sz / M : 0;
    const k = dt * G;
    // ④ 격자 가속.
    for (let i = 0; i < L; i++) {
      const r = rho[i];
      gx[i] += k * r * (ax[i] - abx); gy[i] += k * r * (ay[i] - aby); gz[i] += k * r * (az[i] - abz);
    }
    // ⑤ 입자 가속(+ KEcm/energy 재계산·0033 규약).
    for (let n = 0; n < particles.length; n++) {
      const p = particles[n], m = p.mass || 0;
      if (p.px == null) p.px = 0; if (p.py == null) p.py = 0; if (p.pz == null) p.pz = 0;
      p.px += k * m * (pax[n] - abx); p.py += k * m * (pay[n] - aby); p.pz += k * m * (paz[n] - abz);
      if (p.internalE == null) p.internalE = (p.energy || 0) - (p.KEcm || 0);
      p.KEcm = m > EPS ? 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / m : 0;
      p.energy = p.KEcm + p.internalE;
    }
    return world;
  }

  // 운동 에너지 ½Σ|g|²/ρ — 붕괴 시 PE→KE(낙하로 가속) 측정자.
  function kineticEnergy(world) {
    const rho = world.fields[RHO], gx = world.fields[MX], gy = world.fields[MY], gz = world.fields[MZ];
    if (!gx) return 0;
    let E = 0;
    for (let i = 0; i < rho.length; i++) {
      if (rho[i] > EPS) E += 0.5 * (gx[i] * gx[i] + gy[i] * gy[i] + gz[i] * gz[i]) / rho[i];
    }
    return E;
  }

  // 이산 Laplacian 잔차(주기) — Poisson 정합 검증용: max|∇²Φ − (ρ−ρ̄)|.
  function poissonResidual(world) {
    const N = world.N, L = N * N * N;
    const rho = world.fields[RHO], phi = world.fields[PHI];
    let mean = 0; for (let i = 0; i < L; i++) mean += rho[i]; mean /= L;
    const wrap = (a) => (a + N) % N;
    let maxr = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (z * N + y) * N + x;
      const lap = phi[(z * N + y) * N + wrap(x - 1)] + phi[(z * N + y) * N + wrap(x + 1)]
                + phi[(z * N + wrap(y - 1)) * N + x] + phi[(z * N + wrap(y + 1)) * N + x]
                + phi[(wrap(z - 1) * N + y) * N + x] + phi[(wrap(z + 1) * N + y) * N + x] - 6 * phi[i];
      const r = Math.abs(lap - (rho[i] - mean));
      if (r > maxr) maxr = r;
    }
    return maxr;
  }

  // 데모 시드 — 두 질량 덩어리(가우시안), 정지(운동량 0). 서로 끌리는 걸 보이기 위함.
  function seedTwoMasses(world, opts) {
    opts = opts || {};
    const N = world.N, rho = world.fields[opts.field || RHO];
    const sep = opts.sep != null ? opts.sep : N * 0.25, sig = opts.sigma != null ? opts.sigma : N * 0.08;
    const M0 = opts.M0 != null ? opts.M0 : 1000, c = (N - 1) / 2;
    for (const nm of [MX, MY, MZ]) ensure(world, nm).fill(0);
    rho.fill(0);
    const s2 = 2 * sig * sig; let sum = 0;
    const cs = [[c - sep, c, c], [c + sep, c, c]];
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let w = 0; for (const [bx, by, bz] of cs) { const dx = x - bx, dy = y - by, dz = z - bz; w += Math.exp(-(dx * dx + dy * dy + dz * dz) / s2); }
      rho[(z * N + y) * N + x] = w; sum += w;
    }
    const kk = sum > 0 ? M0 / sum : 0;
    for (let i = 0; i < rho.length; i++) rho[i] *= kk;
    ensure(world, PHI).fill(0);
    return world;
  }

  // 데모 시드 — 거의 균일 + 작은 결정론적 잔물결(Jeans 불안정 씨앗). 중력이 이걸 *키운다*.
  function seedPerturbedUniform(world, opts) {
    opts = opts || {};
    const N = world.N, rho = world.fields[opts.field || RHO];
    const base = opts.base != null ? opts.base : 1.0, amp = opts.amp != null ? opts.amp : 0.05;
    const rnd = (typeof world.rng === 'function') ? world.rng : mulberry(opts.seed || 12345);
    for (const nm of [MX, MY, MZ]) ensure(world, nm).fill(0);
    for (let i = 0; i < rho.length; i++) rho[i] = base * (1 + amp * (rnd() * 2 - 1));
    ensure(world, PHI).fill(0);
    return world;
  }
  function mulberry(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  return { solvePotential, applyGravity, applyParticleMeshGravity, kineticEnergy, poissonResidual, seedTwoMasses, seedPerturbedUniform,
           RHO, PHI, MX, MY, MZ, DEFAULT_G, DEFAULT_ITERS, VERSION: 3 };
});
