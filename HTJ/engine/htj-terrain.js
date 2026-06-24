// htj-terrain.js — 환경/병합·형태 DNA 트랙 T1: 지형(높이장 앵커 카펫)을 *연속 표면*으로 환원한다(점→면).
//
//   design/merge-dna.md §5 T1 — 지형(TW1·0056~0059)은 높이장 봉우리 앵커 카펫이지만, viewer 는 그 앵커
//   하나하나를 *민둥 구*로 그릴 뿐이라 "공 무더기"지 "땅"이 아니다(사용자: "지형이 안 자연스럽다").
//   이 모듈은 그 카펫을 *연속 음영 표면*으로 올린다 = **점→면**:
//     ① 그리드 검출: 앵커들의 (x,y) 격자선을 찾아 성긴 높이장 H[ix][iy] 로 환원.
//     ② 조밀화(bilinear 업샘플): 성긴 격자를 up 배 조밀한 연속 격자로 보간 → 점 무리가 *이어진 면*이 된다.
//     ③ 법선: 조밀 높이장의 기울기로 정점마다 단위 법선 n=normalize(−∂z/∂x,−∂z/∂y,1) → viewer 가 음영(n·L)을 입힌다.
//
//   세계(법칙)의 *형태* 환원 계층 — detectClumps(셀→덩어리)·reconstructShape(hash→윤곽 점)와 같은 부류:
//   **읽기 전용·순수·렌더 의존 0**(어디에/무슨 표면을 그릴지만 계산·픽셀/음영색은 viewer). 입력 앵커를 변형하지 않고,
//   물리량을 전혀 바꾸지 않는다(표현일 뿐). 순수·결정론(같은 앵커 → 같은 표면). Node 에서 돈다(세계↔확인용 단방향).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJTerrain = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 정렬된 유일 좌표 추출 — 허용오차(tol) 안의 값은 같은 격자선으로 묶는다(부동소수 흔들림 흡수).
  function uniqueAxis(vals, tol) {
    const s = vals.slice().sort((a, b) => a - b);
    const out = [];
    for (const v of s) { if (!out.length || v - out[out.length - 1] > tol) out.push(v); }
    return out;
  }
  // 가장 가까운 격자선 인덱스(이분 아님·격자 작음).
  function nearestIdx(axis, v) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < axis.length; i++) { const d = Math.abs(axis[i] - v); if (d < bd) { bd = d; best = i; } }
    return best;
  }

  // 지형 표면 — 앵커 카펫(정규 (x,y) 격자·z=높이)을 조밀한 연속 높이장 + 정점 법선으로 환원한다.
  //   anchors: [{cx,cy,cz}] (바닥 구 같은 비-카펫 큰 앵커는 호출 전에 거른다 — 여긴 표면 카펫만).
  //   opts: { up(셀당 업샘플 배수·기본 4·점→면 조밀도), tol(격자선 묶음 허용오차·기본 1e-6),
  //           deposits([{cx,cy,cz,radius}]·정착 퇴적물·아래 splat 참조·없으면 T1 표면과 byte 동일) }.
  //   반환: { nx, ny, x0, y0, dx, dy, heights:[nx*ny], normals:[nx*ny·{x,y,z}], count, anchorCount, depositCount }
  //     heights[J*nx+I] = (I,J) 정점 높이 · normals 동일 인덱스 · 월드좌표 = (x0+I*dx, y0+J*dy, height).
  function terrainSurface(anchors, opts) {
    opts = opts || {};
    const up = opts.up != null ? Math.max(1, opts.up | 0) : 4;
    const tol = opts.tol != null ? opts.tol : 1e-6;
    const deposits = opts.deposits || null;
    const xs = uniqueAxis(anchors.map(a => a.cx), tol);
    const ys = uniqueAxis(anchors.map(a => a.cy), tol);
    const nx0 = xs.length, ny0 = ys.length;
    // 성긴 높이장 H0[j*nx0+i] — 같은 격자점 중복은 평균(흔들림 흡수). 빈 칸은 NaN(아래서 채움 검증).
    const H0 = new Array(nx0 * ny0).fill(NaN), cnt = new Array(nx0 * ny0).fill(0);
    for (const a of anchors) {
      const i = nearestIdx(xs, a.cx), j = nearestIdx(ys, a.cy), k = j * nx0 + i;
      H0[k] = (cnt[k] ? H0[k] * cnt[k] + a.cz : a.cz) / (cnt[k] + 1); cnt[k]++;
    }
    // 조밀 격자(연속 표면) — (nx0-1)*up+1 정점. 단일 격자선이면 그대로(업샘플 없음).
    const nx = nx0 > 1 ? (nx0 - 1) * up + 1 : nx0;
    const ny = ny0 > 1 ? (ny0 - 1) * up + 1 : ny0;
    const x0 = xs[0], y0 = ys[0];
    const dx = nx > 1 ? (xs[nx0 - 1] - xs[0]) / (nx - 1) : 1;
    const dy = ny > 1 ? (ys[ny0 - 1] - ys[0]) / (ny - 1) : 1;
    // bilinear 보간 — 조밀 정점 (I,J) → 성긴 셀 (i,j)+분수 (fx,fy).
    const heights = new Array(nx * ny);
    for (let J = 0; J < ny; J++) {
      const gy = J / up, j = ny0 > 1 ? Math.min(ny0 - 2, Math.floor(gy)) : 0, fy = ny0 > 1 ? gy - j : 0;
      for (let I = 0; I < nx; I++) {
        const gx = I / up, i = nx0 > 1 ? Math.min(nx0 - 2, Math.floor(gx)) : 0, fx = nx0 > 1 ? gx - i : 0;
        const h00 = H0[j * nx0 + i], h10 = H0[j * nx0 + (i + (nx0 > 1 ? 1 : 0))];
        const h01 = H0[(j + (ny0 > 1 ? 1 : 0)) * nx0 + i], h11 = H0[(j + (ny0 > 1 ? 1 : 0)) * nx0 + (i + (nx0 > 1 ? 1 : 0))];
        const a = h00 + (h10 - h00) * fx, b = h01 + (h11 - h01) * fx;
        heights[J * nx + I] = a + (b - a) * fy;
      }
    }
    // 퇴적 splat(자연스러운 지형·창발 거동) — 정착한 자유 구체(퇴적물)가 지형 *위에 얹혀* 표면을 들어올린다.
    //   각 퇴적 구 d 가 덮는 (x,y) 정점에서 구 표면 상단 z_top = d.cz + √(r²−d²) 와 지형 높이의 *max* = "물질이 위에 쌓임".
    //   = environment.md §2/§4 "그 위의 거동(…깎임/쌓임)은 구체 법칙의 창발" — 정착은 0059 물리, 표면은 그 결과를 *읽기만*.
    //   deposits 없으면 이 블록은 통째로 건너뛴다 → T1(0065) 표면과 byte 동일(가법·회귀0).
    let depositCount = 0, baseH = null;
    if (deposits && deposits.length) {
      depositCount = deposits.length;
      baseH = heights.slice();                                       // 퇴적 전 지형(평활 시 delta 분리용)
      for (let J = 0; J < ny; J++) for (let I = 0; I < nx; I++) {
        const wx = x0 + I * dx, wy = y0 + J * dy, k = J * nx + I;
        let h = heights[k];
        for (const d of deposits) {
          const r = d.radius || 1, ex = wx - d.cx, ey = wy - d.cy, d2 = ex * ex + ey * ey;
          if (d2 < r * r) { const top = d.cz + Math.sqrt(r * r - d2); if (top > h) h = top; }
        }
        heights[k] = h;
      }
    }
    // 매끄러운 퇴적(T1 동적 지형 확장·step_0067) — 퇴적 delta(쌓인 물질)를 확산 이완해 *개별 구 봉우리*를
    //   *매끄러운 둔덕*으로 만든다. base 지형은 불변(delta 만 평활)·확산은 쌍대칭(각 인접쌍이 ±λΔ 로 상쇄)이라
    //   Σdelta(쌓인 부피) *정확 보존*·λ≤1/4 면 convex 결합이라 음수 없음(=깎임 아님·일방 퇴적). Neumann 경계.
    //   smooth=0/무지정 → 이 블록 건너뜀 → step_0066(deposits splat) 표면과 byte 동일(가법·회귀0).
    const smooth = opts.smooth != null ? Math.max(0, opts.smooth | 0) : 0;
    if (smooth > 0 && baseH) {
      const lam = opts.smoothRate != null ? opts.smoothRate : 0.2;   // 확산 계수(0<λ≤1/4)
      let d0 = new Array(nx * ny), d1 = new Array(nx * ny);
      for (let k = 0; k < nx * ny; k++) d0[k] = heights[k] - baseH[k];
      for (let it = 0; it < smooth; it++) {
        for (let J = 0; J < ny; J++) for (let I = 0; I < nx; I++) {
          const k = J * nx + I; let s = 0;
          if (I > 0) s += d0[k - 1] - d0[k];
          if (I < nx - 1) s += d0[k + 1] - d0[k];
          if (J > 0) s += d0[k - nx] - d0[k];
          if (J < ny - 1) s += d0[k + nx] - d0[k];
          d1[k] = d0[k] + lam * s;
        }
        const t = d0; d0 = d1; d1 = t;                              // 더블버퍼 스왑
      }
      for (let k = 0; k < nx * ny; k++) heights[k] = baseH[k] + d0[k];
    }
    // 정점 법선 — 중앙차분(경계는 한쪽차분)으로 기울기 → n=normalize(−∂z/∂x,−∂z/∂y,1).
    const normals = new Array(nx * ny);
    for (let J = 0; J < ny; J++) for (let I = 0; I < nx; I++) {
      const k = J * nx + I;
      const xm = I > 0 ? heights[k - 1] : heights[k], xp = I < nx - 1 ? heights[k + 1] : heights[k];
      const wx = (I > 0 && I < nx - 1) ? 2 * dx : dx;
      const ym = J > 0 ? heights[k - nx] : heights[k], yp = J < ny - 1 ? heights[k + nx] : heights[k];
      const wy = (J > 0 && J < ny - 1) ? 2 * dy : dy;
      const gxv = (xp - xm) / wx, gyv = (yp - ym) / wy;
      const nzx = -gxv, nzy = -gyv, nzz = 1, m = Math.sqrt(nzx * nzx + nzy * nzy + nzz * nzz) || 1;
      normals[k] = { x: nzx / m, y: nzy / m, z: nzz / m };
    }
    return { nx, ny, x0, y0, dx, dy, heights, normals, count: nx * ny, anchorCount: anchors.length, depositCount };
  }

  // 표면 정점 → 월드 좌표 {cx,cy,cz} (viewer/capture 가 그릴 점·읽기 전용 유틸).
  function vertexWorld(surf, I, J) {
    const k = J * surf.nx + I;
    return { cx: surf.x0 + I * surf.dx, cy: surf.y0 + J * surf.dy, cz: surf.heights[k], n: surf.normals[k] };
  }

  return { terrainSurface, vertexWorld, VERSION: 3 };
});
