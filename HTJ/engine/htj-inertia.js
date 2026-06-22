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
  const CFL_SAFE = 1.0;                        // donor-cell 비음수 한계(차원분리 L1: Σ|v_축|·dt ≤ 1). 이 아래면 nsub=1.
  const VMAX = 50;                             // 속도 상한(진공 가드): near-vacuum 셀(ρ→0)은 압력 push 로 쌓인 g 가
                                              //   v=g/ρ 를 폭주시킨다. 정상 흐름 |v_축|≈4 ≪ 50 → 안 닿음(byte-동일, 회귀 0).
  const NSUB_MAX = 256;                        // CFL 서브스텝 상한(행 가드): nsub 가 무한정 커지면(폭주 시) 서브스텝
                                              //   루프가 사실상 무한 반복 = *재생이 멈춘다(freeze)*. VMAX 가 속도를 묶어
                                              //   정상 흐름 nsub 는 한 자리수 → 이 상한엔 안 닿는다(byte-동일).

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
    const L = rho.length;

    const vx = world.scratch.__vx || (world.scratch.__vx = new Float64Array(L));
    const vy = world.scratch.__vy || (world.scratch.__vy = new Float64Array(L));
    const vz = world.scratch.__vz || (world.scratch.__vz = new Float64Array(L));

    // ── 활성∪halo 순회(step_0021) — *수송하는* stencil 법칙 advect 의 활성 일반화 ──
    //   advect 는 질량을 *방향성 있게* 옮긴다 → 활성 전선이 흐름 방향으로 비대칭 자란다(확산은 대칭).
    //   donor-cell flux 는 *donor 의 ρ·g* 에 비례한다 → 활성 블록 밖 셀(ρ=0)은 donor 가 0 이라 flux 0 →
    //   active∪halo 만 돌아도 조밀과 비트 동일(0020 확산과 같은 논리, donor=0 으로 경계 flux 가 자동 0).
    //   진공 g-가드(|g|≤ρ·VMAX)로 ρ=0 ⟹ g=0 → g 의 비-영 지지 ⊆ ρ 지지 → 활성 집합을 ρ 로 추적하면
    //   운동량도 함께 따라온다. **CFL 안전(courant≤1, nsub=1)에서만 활성** — 한 호출에 1셀 이동이라
    //   1-블록 halo 에 넉넉히 든다. courant>1(nsub>1, 폭주/고속)은 *조밀로 폴백* — 한 호출에 여러 칸
    //   이동하면 1-블록 halo 를 넘어 질량이 이탈해 보존이 샐 수 있어, 보존 척추를 위해 조밀로 정확히 푼다.
    //   opts.active 생략 → 조밀 전-격자(아래) = byte 동일(회귀 0).
    if (opts.active) {
      const bs = opts.blockSize || 8;
      const cells = [];
      for (let b = 0; b < opts.active.length; b++) {
        const ox = opts.active[b][0], oy = opts.active[b][1], oz = opts.active[b][2];
        for (let lz = 0; lz < bs; lz++) { const z = oz + lz; if (z >= N) break;
          for (let ly = 0; ly < bs; ly++) { const y = oy + ly; if (y >= N) break;
            for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break; cells.push((z * N + y) * N + x); }
          }
        }
      }
      // courant 읽기 추정(상태 불변) — cells 밖은 ρ=g=0 → v=0 → max over cells = 진짜 max(폴백 판정용).
      let cest = 0;
      for (let c = 0; c < cells.length; c++) {
        const i = cells[c]; const r = rho[i] > EPS ? rho[i] : 0; const inv = r > 0 ? 1 / rho[i] : 0;
        let ux = gx[i] * inv, uy = gy[i] * inv, uz = gz[i] * inv;
        if (ux > VMAX) ux = VMAX; else if (ux < -VMAX) ux = -VMAX;
        if (uy > VMAX) uy = VMAX; else if (uy < -VMAX) uy = -VMAX;
        if (uz > VMAX) uz = VMAX; else if (uz < -VMAX) uz = -VMAX;
        const cc = Math.abs(ux) + Math.abs(uy) + Math.abs(uz); if (cc > cest) cest = cc;
      }
      if (cest * dt <= CFL_SAFE) {
        // ── 활성 nsub=1 경로 (상태 변경은 여기서부터 — 폴백 시엔 아직 불변) ──
        const Qa = [rho, gx, gy, gz];
        if (opts.scalars) for (const nm of opts.scalars) Qa.push(world.fields[nm] || world.addField(nm, { type: Float64Array }));
        for (let c = 0; c < cells.length; c++) {                  // 진공 g-가드(iter)
          const i = cells[c], cap = rho[i] * VMAX;
          if (gx[i] > cap) gx[i] = cap; else if (gx[i] < -cap) gx[i] = -cap;
          if (gy[i] > cap) gy[i] = cap; else if (gy[i] < -cap) gy[i] = -cap;
          if (gz[i] > cap) gz[i] = cap; else if (gz[i] < -cap) gz[i] = -cap;
        }
        for (let c = 0; c < cells.length; c++) {                  // 속도 재계산(iter·post-guard)
          const i = cells[c]; const r = rho[i] > EPS ? rho[i] : 0; const inv = r > 0 ? 1 / rho[i] : 0;
          let ux = gx[i] * inv, uy = gy[i] * inv, uz = gz[i] * inv;
          if (ux > VMAX) ux = VMAX; else if (ux < -VMAX) ux = -VMAX;
          if (uy > VMAX) uy = VMAX; else if (uy < -VMAX) uy = -VMAX;
          if (uz > VMAX) uz = VMAX; else if (uz < -VMAX) uz = -VMAX;
          vx[i] = ux; vy[i] = uy; vz[i] = uz;
        }
        let outA = world.scratch.__advOut;                        // out 스크래치(지속, Qa.length×L) — iter 만 리셋
        if (!outA || outA.length !== Qa.length) { outA = world.scratch.__advOut = []; for (let k = 0; k < Qa.length; k++) outA.push(new Float64Array(L)); }
        for (let c = 0; c < cells.length; c++) { const i = cells[c]; for (let k = 0; k < Qa.length; k++) outA[k][i] = Qa[k][i]; }
        const h = dt;                                             // nsub=1
        function sweepA(stride, vAxis, edge) {                    // donor-cell 상류차분(조밀 sweep 과 동일 식, iter 한정)
          for (let c = 0; c < cells.length; c++) {
            const i = cells[c], x = i % N, y = (i / N | 0) % N, z = (i / NN | 0);
            if (edge === 0 ? x === N - 1 : edge === 1 ? y === N - 1 : z === N - 1) continue;   // no-flux 경계
            const j = i + stride, uf = 0.5 * (vAxis[i] + vAxis[j]); if (uf === 0) continue;
            const up = uf > 0 ? i : j, f = h * uf;                 // donor=up. up 이 빈 셀이면 Qa[up]=0 → flux 0(경계 자동)
            for (let k = 0; k < Qa.length; k++) { const flux = f * Qa[k][up]; outA[k][i] -= flux; outA[k][j] += flux; }
          }
        }
        sweepA(1, vx, 0); sweepA(N, vy, 1); sweepA(NN, vz, 2);
        for (let c = 0; c < cells.length; c++) { const i = cells[c]; for (let k = 0; k < Qa.length; k++) Qa[k][i] = outA[k][i]; }
        if (opts.stats) opts.stats.cellsVisited = cells.length;
        return world;
      }
      // courant>CFL_SAFE → 조밀 폴백(아래로 진행, 상태 아직 불변 = 순수 조밀 결과).
    }

    // 진공 KE 가드 — 저장된 운동량을 |g_축| ≤ ρ·VMAX 로 묶는다 → KE=½g²/ρ ≤ ½ρ·VMAX²(진공 ρ→0 이면 KE→0).
    //   near-vacuum 셀(ρ→0)은 압력 push 로 g 가 쌓여 KE 가 폭주(측정: 1e17)한다 — 파생 속도만 클램프하면
    //   *저장 g 는 계속 큰다*. 상태(g) 자체를 묶어 *비물리 진공 운동량*을 제거(생성 0인 소산형 — 에너지는
    //   줄지언정 절대 안 생긴다). 정상 흐름은 |g|=ρ·v, v<VMAX → cap>|g| → 안 닿음(byte-동일, 회귀 0).
    for (let i = 0; i < L; i++) {
      const cap = rho[i] * VMAX;
      if (gx[i] > cap) gx[i] = cap; else if (gx[i] < -cap) gx[i] = -cap;
      if (gy[i] > cap) gy[i] = cap; else if (gy[i] < -cap) gy[i] = -cap;
      if (gz[i] > cap) gz[i] = cap; else if (gz[i] < -cap) gz[i] = -cap;
    }

    // 이류할 양(질량 + 운동량 3성분 + 선택 수동 스칼라들)에 같은 면속도로 flux 를 누적(이중버퍼).
    const Q = [rho, gx, gy, gz];
    if (opts.scalars) for (const nm of opts.scalars) Q.push(world.fields[nm] || world.addField(nm, { type: Float64Array }));

    // 셀별 속도 v=g/ρ 계산 + 최대 Courant 수(차원분리 안정 한계 = L1: Σ|v_축|·dt). 한 서브스텝 내내 고정.
    function recomputeVelocity() {
      let cmax = 0;
      for (let i = 0; i < L; i++) {
        const r = rho[i] > EPS ? rho[i] : 0;
        const inv = r > 0 ? 1 / rho[i] : 0;
        // 진공 가드: ρ→0 셀의 v=g/ρ 폭주를 ±VMAX 로 묶는다(정상 |v|≤VMAX → 분기 거짓, byte-동일).
        let ux = gx[i] * inv, uy = gy[i] * inv, uz = gz[i] * inv;
        if (ux > VMAX) ux = VMAX; else if (ux < -VMAX) ux = -VMAX;
        if (uy > VMAX) uy = VMAX; else if (uy < -VMAX) uy = -VMAX;
        if (uz > VMAX) uz = VMAX; else if (uz < -VMAX) uz = -VMAX;
        vx[i] = ux; vy[i] = uy; vz[i] = uz;
        const c = Math.abs(ux) + Math.abs(uy) + Math.abs(uz);
        if (c > cmax) cmax = c;
      }
      return cmax;
    }

    // CFL 안전 서브스텝: donor-cell 상류차분은 |v|·dt ≤ 1 아래에서만 *비음수*다(주석 위 참조).
    //   점화(0012)처럼 매 스텝 열이 *주입*되면 열압력이 속도를 키워 CFL 을 넘기는데, 그러면 음수 밀도가
    //   생겨 폭주(→NaN→화면이 빔)한다. dt 를 안전 한계 아래로 쪼개(서브스텝) 한 advect 호출이 스스로
    //   비음수·보존을 지키게 한다 — 점성(0011)이 막지 못하는 *구동* 발산을 정수적으로 닫는다.
    //   CFL 이 이미 안전하면 nsub=1 → 종전과 byte-동일(회귀 0). 서브스텝마다 ρ,g 로 속도를 재계산(보존).
    const cmax = recomputeVelocity();
    const courant = cmax * dt;
    // NSUB_MAX 로 상한 — VMAX 가 cmax 를 묶어 정상 흐름은 작은 nsub(상한 무관, byte-동일). 폭주 시 무한
    //   루프(freeze)를 유한 작업으로 닫는 최후 가드.
    const nsub = courant > CFL_SAFE ? Math.min(NSUB_MAX, Math.ceil(courant / CFL_SAFE)) : 1;
    const h = dt / nsub;

    let out = Q.map(q => q.slice());            // 변화량 누적용 복사(시작값에서 +=/-=)

    // 한 축(stride) 방향 면들에 대해 donor-cell 상류차분 flux 를 누적.
    //   면속도 uf = ½(v[i]+v[i+stride]). uf>0 → 상류=i, uf<0 → 상류=i+stride.
    //   flux = h·uf·q_up. q[i] -= flux, q[i+stride] += flux (보존).
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
            const f = h * uf;
            for (let k = 0; k < Q.length; k++) {
              const flux = f * Q[k][up];
              out[k][i] -= flux; out[k][j] += flux;
            }
          }
    }

    for (let s = 0; s < nsub; s++) {
      if (s > 0) { recomputeVelocity(); out = Q.map(q => q.slice()); }  // 갱신된 ρ,g 로 다음 서브스텝
      sweep(1,   vx, { x: true });
      sweep(N,   vy, { y: true });
      sweep(NN,  vz, { z: true });
      for (let k = 0; k < Q.length; k++) Q[k].set(out[k]);
    }
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
           ensureMomentum, RHO, MX, MY, MZ, DEFAULT_DT, VERSION: 2 };
});
