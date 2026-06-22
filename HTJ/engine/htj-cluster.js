// htj-cluster.js — HTJ 관찰 연산자: *안정 덩어리*를 검출해 **개체(구체)로 환원**한다.
//
//   이건 **동역학 법칙이 아니다** — 장(field)을 *읽기만* 하고 *아무 것도 바꾸지 않는다*(field 불변=회귀 0).
//   step_0007~0013 이 *돌·별*을 창발시켰다(중력으로 뭉치고·반발/열압력으로 떠받치고·점성으로 식어
//   정착하고·발열↔복사로 빛난다). 그렇게 안정된 *덩어리*는 매 스텝 수만 셀을 유체로 풀 필요가 없다 —
//   형태가 거의 안 변하기 때문. 이 연산자는 그 덩어리를 **소수 파라미터의 개체**로 환원한다:
//
//     덩어리 = { 중심(CoM), 질량 Σρ, 반지름(점유 볼륨의 등가 구), 평균온도(질량가중 Σu/Σρ), 정점밀도, 셀수 }
//
//   검출은 **연결 성분**(6-이웃 flood fill, ρ>eps 인 셀) — 떨어진 두 별은 두 개체, 붙으면 한 개체.
//   결과는 결정론적(고정 인덱스 순서로 훑어 질량 내림차순 정렬). energy(=질량)는 개체 질량으로 *정확히
//   보존되어 위층으로 상속*된다(Σ개체질량 = Σ_{ρ>eps} ρ).
//
//   왜 이게 중요한가(design/scalability.md §0 목적):
//     ① 렌더 — 수만 voxel 대신 *구체 1개*로 그린다(보여지는 단위 = 덩어리).
//     ② 시뮬 — (다음 step) 같은 환원 산출물을 *승격*해 덩어리를 개체 단위로 굴린다(비용=흐르는 물질만).
//   이 step 은 ①(+검출 기계)까지 — 환원은 읽기 전용이라 안전하고, ②(승격)의 토대가 된다.
//
//   세계(법칙) 그 자체와 직교 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   순수 관찰: world 를 변형하지 않으므로 어떤 동역학과도 회귀 0 으로 공존한다.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJCluster = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RHO = 'energy';                 // 질량 밀도 = 에너지(E=mc²) — 개체 질량의 원천
  const THERM = 'therm';                // 내부에너지 u(열) — 평균온도(질량가중 Σu/Σρ) 산출용
  const DEFAULT_EPS = 1e-9;             // 점유 임계(노브) — ρ>eps 셀만 덩어리에 든다
  const EPS = 1e-12;
  const FOURPI_3 = 4 * Math.PI / 3;     // 등가 구 부피 상수

  // 점유 볼륨(셀 수) → 등가 구 반지름: V = (4/3)πr³ → r = (3V/4π)^(1/3). "질량·평균밀도"의 기하 표현.
  function equivalentRadius(cellCount) { return Math.cbrt(cellCount / FOURPI_3); }

  // 덩어리 검출 — ρ>eps 셀의 6-이웃 연결 성분을 찾아 각각을 개체(구체)로 환원한다.
  //   순수: world 의 어떤 장도 바꾸지 않는다(scratch 의 방문 버퍼만 쓴다). 결과는 질량 내림차순(결정론).
  //   opts.eps : 점유 임계(기본 1e-9). opts.minCells: 이 셀 수 미만 성분은 버린다(노이즈 컷, 기본 1).
  function detectClumps(world, opts) {
    opts = opts || {};
    const eps = opts.eps != null ? opts.eps : DEFAULT_EPS;
    const minCells = opts.minCells != null ? opts.minCells : 1;
    const collectCells = !!opts.collectCells;          // true → 각 덩어리에 cells(셀 인덱스 목록) 첨부(승격용)
    const N = world.N, NN = N * N;
    const rho = world.fields[RHO];
    const u = world.fields[THERM] || null;             // 온도 장이 없으면 평균온도=0
    const L = rho.length;

    // 방문 표식(scratch 재사용 — world 장 아님). 0=미방문, 1=방문.
    const seen = world.scratch.__cseen && world.scratch.__cseen.length === L
      ? world.scratch.__cseen : (world.scratch.__cseen = new Uint8Array(L));
    seen.fill(0);
    const stack = [];                                  // flood fill 스택(셀 인덱스)
    const clumps = [];

    for (let s = 0; s < L; s++) {
      if (seen[s] || rho[s] <= eps) continue;          // 이미 봤거나 빈 셀은 건너뜀
      // 새 연결 성분 — flood fill 로 전부 모으며 환원량 누적.
      seen[s] = 1; stack.length = 0; stack.push(s);
      let mass = 0, mx = 0, my = 0, mz = 0, uSum = 0, peak = 0, cells = 0;
      const cellList = collectCells ? [] : null;
      while (stack.length) {
        const i = stack.pop();
        const r = rho[i];
        // 좌표 복원(htj-world 인덱싱과 동일): i = (z*N + y)*N + x.
        const x = i % N, y = ((i - x) / N) % N, z = (i - x - y * N) / NN;
        mass += r; mx += r * x; my += r * y; mz += r * z;
        if (u) uSum += u[i];                            // Σu (질량가중 평균온도 = Σu/Σρ)
        if (r > peak) peak = r;
        cells++;
        if (cellList) cellList.push(i);
        // 6-이웃(격자 경계 안에서만 — no-flux, 주기 아님).
        if (x > 0     && !seen[i - 1]  && rho[i - 1]  > eps) { seen[i - 1]  = 1; stack.push(i - 1); }
        if (x < N - 1 && !seen[i + 1]  && rho[i + 1]  > eps) { seen[i + 1]  = 1; stack.push(i + 1); }
        if (y > 0     && !seen[i - N]  && rho[i - N]  > eps) { seen[i - N]  = 1; stack.push(i - N); }
        if (y < N - 1 && !seen[i + N]  && rho[i + N]  > eps) { seen[i + N]  = 1; stack.push(i + N); }
        if (z > 0     && !seen[i - NN] && rho[i - NN] > eps) { seen[i - NN] = 1; stack.push(i - NN); }
        if (z < N - 1 && !seen[i + NN] && rho[i + NN] > eps) { seen[i + NN] = 1; stack.push(i + NN); }
      }
      if (cells < minCells) continue;
      const clump = {
        cx: mass > EPS ? mx / mass : 0,                // 질량중심
        cy: mass > EPS ? my / mass : 0,
        cz: mass > EPS ? mz / mass : 0,
        mass,                                          // Σρ — 위층으로 상속되는 질량
        cells,                                         // 점유 셀 수(볼륨)
        radius: equivalentRadius(cells),               // 등가 구 반지름
        temp: mass > EPS ? uSum / mass : 0,            // 질량가중 평균온도 = Σu/Σρ
        peak                                           // 정점 밀도
      };
      if (cellList) clump.cellList = cellList;         // 승격용 셀 인덱스 목록(opts.collectCells)
      clumps.push(clump);
    }
    // 질량 내림차순(같으면 셀 수) — 결정론적 안정 순서.
    clumps.sort((a, b) => (b.mass - a.mass) || (b.cells - a.cells));
    return clumps;
  }

  // 측정자 — 검출 덩어리 수 / 환원된 총 질량(이관 보존 검증용 = Σ_{ρ>eps} ρ).
  function clumpCount(world, opts) { return detectClumps(world, opts).length; }
  function totalClumpMass(world, opts) { const c = detectClumps(world, opts); let s = 0; for (let k = 0; k < c.length; k++) s += c[k].mass; return s; }

  return { detectClumps, clumpCount, totalClumpMass, equivalentRadius,
           RHO, THERM, DEFAULT_EPS, VERSION: 1 };
});
