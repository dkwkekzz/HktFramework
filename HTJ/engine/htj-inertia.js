// htj-inertia.js — HTJ 넷째 법칙: 관성 = 질량(=에너지)이 운동량을 싣고 *탄도적으로* 움직인다 (뉴턴 1법칙).
//
//   step_0002~0005 의 유일한 동역학(확산)은 *완화형*(열방정식, 시간 1차)이다 — 운동량도, "가만 두면
//   계속 가는" 성질도 없다. 농도가 풀려서 평형으로 *기어갈* 뿐. 이건 아리스토텔레스식(속도∝힘) 세계이지
//   관성 세계(가속∝힘)가 아니다. "질량은 어디에?" 의 답: **에너지가 곧 질량이다(E=mc²).**
//   energy 장을 *질량 밀도 ρ* 로 다시 읽고, 그것이 운동량을 가질 수 있게 한다.
//
//   법칙은 **탄도 이류(advection)** 하나 — 질량이 자기 속도를 *유지하며* 흐른다(힘 없으면 직진):
//     연속(질량) :  ∂ρ/∂t = −∇·(ρv)
//     운동량     :  ∂g/∂t = −∇·(g v)        (g = ρv = 운동량 밀도, 힘 없음 → 자유 관성)
//   속도 v = g/ρ. 이 둘이 함께 "각 덩어리가 *제 속도를 지킨 채* 직진한다" = 뉴턴 1법칙을 못 박는다.
//   확산이 *대비를 지우는* 완화라면, 이류는 *덩어리를 통째로 옮기는* 탄도 운동 — 정반대 성격이다.
//
//   못 박는 것:
//     · 질량 보존(제1법칙) — flux 형식(한 셀이 잃은 flux = 이웃이 얻음). Σρ 불변.
//     · 운동량 보존 — 힘이 없으면 Σg 불변 → 질량중심이 *등속 직진*(p_total/m_total). 뉴턴 1법칙.
//     · 국소성 — flux 는 면(face)을 통해서만. 닫힌 경계(no-flux): 질량이 상자를 안 떠난다.
//   수치 스킴: donor-cell **상류차분(upwind)** — 1차·보존형·CFL(|v|dt≤dx=1) 아래 비음수.
//     차원 분리(축별 1패스). 면속도는 한 스텝 시작 상태에서 한 번 계산(이중버퍼) → 결정론.
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   dt=0(또는 운동량 0) → 항등(early return) — 가법성/회귀 0 가드. 확산·방출·복사와 직교 공존.
//   미래 step: 이 운동량을 *가속*하는 힘 −ρ∇Φ(질량이 만든 퍼텐셜)를 더하면 **중력**이 창발한다.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJInertia = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RHO = 'energy';                       // 질량 밀도 = 에너지(E=mc²)
  const MX = 'mom_x', MY = 'mom_y', MZ = 'mom_z';   // 운동량 밀도 g = ρv (셀별, Float64)
  const EPS = 1e-12;                          // ρ≈0 셀에서 v=0 (0 나눗셈 가드)
  const DEFAULT_DT = 0.5;                      // 한 스텝의 시간 간격(격자 간격 dx=1; CFL: |v|·dt ≤ 1)

  // 운동량 장이 없으면 만든다(지연 초기화 — htj-world 불변). 0 으로 초기화 = 정지.
  function ensureMomentum(world) {
    const m = {};
    for (const n of [MX, MY, MZ]) m[n] = world.fields[n] || world.addField(n, { type: Float64Array });
    return m;
  }

  // 관성 1스텝 — 질량(ρ=energy)과 운동량(g)이 면을 통해 상류차분으로 이류한다(보존·탄도).
  //   dt=0 → 항등(early return, 회귀 0). 운동량 전부 0 이면 v=0 → flux 0 → 사실상 항등.
  //   no-flux 경계: 도메인 바깥 면으로는 flux 없음 → Σρ·Σg 정확 보존(상자 안에 머문다).
  //   opts.scalars: 같은 면속도로 *함께 실어 나를* 수동 스칼라 장 이름들(예: 내부에너지 'therm').
  //     생략하면 동작은 종전과 byte-동일(회귀 0) — 밀도·운동량만 수송. 에너지 밀도 같은 양은
  //     질량처럼 흐름을 타야 하므로 이 훅으로 같은 보존형 수송에 얹는다(스킴은 한 곳에서 관리).
  function advect(world, dt, opts) {
    opts = opts || {};
    const rhoName = opts.field || RHO;
    if (dt == null) dt = DEFAULT_DT;
    if (!dt) return world;                     // 노브=0 → 세계 불변
    if (dt < 0) throw new Error('advect: dt must be >= 0');
    const N = world.N, NN = N * N;
    const rho = world.fields[rhoName];
    const m = ensureMomentum(world);
    const gx = m[MX], gy = m[MY], gz = m[MZ];

    // 한 스텝 시작 상태에서 셀별 속도 v=g/ρ 를 한 번 계산(이류 내내 고정 → 결정론·선형성).
    const L = rho.length;
    const vx = world.scratch.__vx || (world.scratch.__vx = new Float64Array(L));
    const vy = world.scratch.__vy || (world.scratch.__vy = new Float64Array(L));
    const vz = world.scratch.__vz || (world.scratch.__vz = new Float64Array(L));
    for (let i = 0; i < L; i++) {
      const r = rho[i] > EPS ? rho[i] : 0;
      const inv = r > 0 ? 1 / rho[i] : 0;
      vx[i] = gx[i] * inv; vy[i] = gy[i] * inv; vz[i] = gz[i] * inv;
    }

    // 이류할 양(질량 + 운동량 3성분 + 선택 수동 스칼라들)에 같은 면속도로 flux 를 누적(이중버퍼).
    const Q = [rho, gx, gy, gz];
    if (opts.scalars) for (const nm of opts.scalars) Q.push(world.fields[nm] || world.addField(nm, { type: Float64Array }));
    const out = Q.map(q => q.slice());          // 변화량 누적용 복사(시작값에서 +=/-=)

    // 한 축(stride) 방향 면들에 대해 donor-cell 상류차분 flux 를 누적.
    //   면속도 uf = ½(v[i]+v[i+stride]). uf>0 → 상류=i, uf<0 → 상류=i+stride.
    //   flux = dt·uf·q_up. q[i] -= flux, q[i+stride] += flux (보존).
    function sweep(stride, vAxis, isLast) {
      for (let z = 0; z < N; z++)
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++) {
            // 이 셀과 +stride 이웃 사이 면. 도메인 경계 면은 건너뛴다(no-flux).
            if (isLast.z ? z === N - 1 : isLast.y ? y === N - 1 : x === N - 1) continue;
            const i = (z * N + y) * N + x, j = i + stride;
            const uf = 0.5 * (vAxis[i] + vAxis[j]);
            if (uf === 0) continue;
            const up = uf > 0 ? i : j;
            const f = dt * uf;
            for (let k = 0; k < Q.length; k++) {
              const flux = f * Q[k][up];
              out[k][i] -= flux; out[k][j] += flux;
            }
          }
    }
    sweep(1,   vx, { x: true });
    sweep(N,   vy, { y: true });
    sweep(NN,  vz, { z: true });

    for (let k = 0; k < Q.length; k++) Q[k].set(out[k]);
    return world;
  }

  // 총 운동량 [Σgx, Σgy, Σgz] — 보존 검증용(힘 없으면 불변).
  function totalMomentum(world) {
    const m = ensureMomentum(world);
    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < m[MX].length; i++) { sx += m[MX][i]; sy += m[MY][i]; sz += m[MZ][i]; }
    return [sx, sy, sz];
  }

  // 질량중심 [cx,cy,cz] (ρ 가중) — 뉴턴 1법칙(등속 직진) 측정자.
  function centerOfMass(world, opts) {
    opts = opts || {};
    const N = world.N, rho = world.fields[opts.field || RHO];
    let sx = 0, sy = 0, sz = 0, M = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = rho[(z * N + y) * N + x];
      sx += r * x; sy += r * y; sz += r * z; M += r;
    }
    return M > 0 ? [sx / M, sy / M, sz / M] : [0, 0, 0];
  }

  // 데모 시드 — 질량 덩어리(가우시안 공) + *균일 속도* v0 를 싣는다(g=ρv0).
  //   법칙이 아니라 정물: 덩어리가 *통째로 직진*(탄도)하는 걸 눈에 보이게 하는 초기 조건.
  //   균일 v0 → 이류가 정확한 평행이동(비선형 없음) → 깨끗한 뉴턴 1법칙 시연.
  function seedMovingBlob(world, opts) {
    opts = opts || {};
    const N = world.N, rho = world.fields[opts.field || RHO];
    const m = ensureMomentum(world);
    const cx = opts.cx != null ? opts.cx : N * 0.3;     // 한쪽에 치우쳐 시작(직진 여유)
    const cy = opts.cy != null ? opts.cy : (N - 1) / 2;
    const cz = opts.cz != null ? opts.cz : (N - 1) / 2;
    const sig = opts.sigma != null ? opts.sigma : N * 0.12;
    const M0 = opts.M0 != null ? opts.M0 : 1000;        // 총 질량
    const vx = opts.vx != null ? opts.vx : 0.5;         // 균일 속도(CFL: |v|·dt ≤ 1)
    const vy = opts.vy != null ? opts.vy : 0;
    const vz = opts.vz != null ? opts.vz : 0;
    rho.fill(0); m[MX].fill(0); m[MY].fill(0); m[MZ].fill(0);
    let sum = 0;
    const s2 = 2 * sig * sig;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const w = Math.exp(-(dx * dx + dy * dy + dz * dz) / s2);
      rho[(z * N + y) * N + x] = w; sum += w;
    }
    const k = sum > 0 ? M0 / sum : 0;
    for (let i = 0; i < rho.length; i++) {
      rho[i] *= k;
      m[MX][i] = rho[i] * vx; m[MY][i] = rho[i] * vy; m[MZ][i] = rho[i] * vz;
    }
    return world;
  }

  return { advect, totalMomentum, centerOfMass, seedMovingBlob,
           ensureMomentum, RHO, MX, MY, MZ, DEFAULT_DT, VERSION: 1 };
});
