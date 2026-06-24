// viewer/htj-surface.js — 제너릭 "점 무리 → 연속 음영 표면" 발현 유틸 (T2b·확인용 렌더 도메인).
//
//   merge-dna.md §5 T2(B)표현 — reconstructShape(DNA)가 돌려준 *점 무리(sub-구체)*를 *어떤 것이든* 연속
//   높이장 + 정점 법선으로 환원한다(점→면). 0065 의 terrainSurface 가 "지형 앵커 카펫"을 *특별취급*해
//   표면을 만든 것과 달리, 이건 **타입을 모른다** — 입력은 그냥 점 무리({cx,cy,cz,r})다. 지형이든 합친
//   덩어리든 같은 함수가 표면으로 발현. 자연스러움(매끄러움)은 손수 필터가 아니라 *겹치는 구체 splat*에서
//   창발한다(sphere-world §3 "모양은 구체 배열에 담긴다" — 겹치면 면).
//
//   순수·결정론·렌더 의존 0(어디에/무슨 표면을 그릴지만·픽셀·음영색은 호출자). engine 을 *읽지도* 않는다.
//   반환 구조는 terrainSurface 와 호환({nx,ny,x0,y0,dx,dy,heights,normals,count,…}) → 기존 제너릭 drawSurface
//   가 그대로 그린다(viewer 변경 0). UMD(브라우저·Node 양립).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJSurface = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 점 무리 → top-down(u=cx, v=cy, 높이=cz) 연속 높이장 + 법선.
  //   points: [{cx,cy,cz,r}] (r=구 반지름·없으면 1). 각 점을 구면 상단 cap 으로 splat → 겹치면 연속 면(max="위가 표면").
  //   opts: { res(래스터 한 변·기본 64), pad(여백 비율·기본 0.04) }.
  //   반환: { nx,ny,x0,y0,dx,dy, heights:[nx*ny], normals:[{x,y,z}], mask:[0/1], count, filled, hMin, hMax }
  function pointCloudSurface(points, opts) {
    opts = opts || {};
    const res = Math.max(8, opts.res != null ? opts.res | 0 : 64);
    const pad = opts.pad != null ? opts.pad : 0.04;
    const n = points.length;
    if (!n) return { nx: res, ny: res, x0: 0, y0: 0, dx: 1, dy: 1, heights: new Array(res * res).fill(0), normals: new Array(res * res).fill({ x: 0, y: 0, z: 1 }), mask: new Array(res * res).fill(0), count: res * res, filled: 0, hMin: 0, hMax: 0 };
    // 점 무리 경계(반지름 포함) — top-down 평면.
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of points) { const r = p.r || 1; if (p.cx - r < minU) minU = p.cx - r; if (p.cx + r > maxU) maxU = p.cx + r; if (p.cy - r < minV) minV = p.cy - r; if (p.cy + r > maxV) maxV = p.cy + r; }
    const spanU = (maxU - minU) || 1, spanV = (maxV - minV) || 1;
    const x0 = minU - spanU * pad, y0 = minV - spanV * pad;
    const dx = (spanU * (1 + 2 * pad)) / (res - 1), dy = (spanV * (1 + 2 * pad)) / (res - 1);
    const heights = new Array(res * res).fill(-Infinity), mask = new Array(res * res).fill(0);
    // 구면 cap splat — 각 점이 덮는 셀에서 z_top = cz + √(r²−d²) 와 높이의 max(겹치면 연속 면).
    for (const p of points) {
      const r = p.r || 1, r2 = r * r;
      const i0 = Math.max(0, Math.floor((p.cx - r - x0) / dx)), i1 = Math.min(res - 1, Math.ceil((p.cx + r - x0) / dx));
      const j0 = Math.max(0, Math.floor((p.cy - r - y0) / dy)), j1 = Math.min(res - 1, Math.ceil((p.cy + r - y0) / dy));
      for (let J = j0; J <= j1; J++) for (let I = i0; I <= i1; I++) {
        const wu = x0 + I * dx, wv = y0 + J * dy, d2 = (wu - p.cx) * (wu - p.cx) + (wv - p.cy) * (wv - p.cy);
        if (d2 < r2) { const top = p.cz + Math.sqrt(r2 - d2), k = J * res + I; if (top > heights[k]) { heights[k] = top; mask[k] = 1; } }
      }
    }
    // 빈 셀(점이 안 덮은 곳)은 최소 높이로 채움(연속·법선 안정) — filled 로 표면 점유 측정.
    let hMin = Infinity, hMax = -Infinity, filled = 0;
    for (let k = 0; k < res * res; k++) if (mask[k]) { filled++; if (heights[k] < hMin) hMin = heights[k]; if (heights[k] > hMax) hMax = heights[k]; }
    if (hMin === Infinity) { hMin = 0; hMax = 0; }
    for (let k = 0; k < res * res; k++) if (!mask[k]) heights[k] = hMin;
    // 정점 법선 — 중앙차분(경계는 한쪽차분) → n=normalize(−∂z/∂x,−∂z/∂y,1).
    const normals = new Array(res * res);
    for (let J = 0; J < res; J++) for (let I = 0; I < res; I++) {
      const k = J * res + I;
      const xm = I > 0 ? heights[k - 1] : heights[k], xp = I < res - 1 ? heights[k + 1] : heights[k], wx = (I > 0 && I < res - 1) ? 2 * dx : dx;
      const ym = J > 0 ? heights[k - res] : heights[k], yp = J < res - 1 ? heights[k + res] : heights[k], wy = (J > 0 && J < res - 1) ? 2 * dy : dy;
      const gx = (xp - xm) / wx, gy = (yp - ym) / wy, m = Math.sqrt(gx * gx + gy * gy + 1) || 1;
      normals[k] = { x: -gx / m, y: -gy / m, z: 1 / m };
    }
    return { nx: res, ny: res, x0, y0, dx, dy, heights, normals, mask, count: res * res, anchorCount: n, filled, hMin, hMax };
  }

  return { pointCloudSurface, VERSION: 1 };
});
