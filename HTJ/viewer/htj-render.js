// htj-render.js — HTJ 기반 무대의 *3D voxel 렌더러* (의존성 0, 2D canvas).
//
//   Docs/CellularAutomata3D 의 외형(음영 큐브 밭·와이어 경계 박스·다크 배경·오빗)을
//   Three.js 없이 재현한다 — 오프라인·결정론·헤드리스 캡처에 견고.
//
//   직교 투영 + 화가 알고리즘(뒤→앞). 표면 셀만 그린다(내부는 어차피 안 보임).
//   각 셀 = 카메라를 향한 3개 면을 채운 큐브. 면 음영은 *고정 광원*(시점 독립)이라
//   회전해도 같은 면은 같은 밝기 → 입체감이 안정적.
//
//   UMD: 브라우저(viewer.html)·Node 양쪽 로드 가능(그리기는 캔버스 컨텍스트 필요).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJRender = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 큐브 6면: 외향 법선 n + 4 모서리 오프셋(중심 기준, 반변 0.5).
  const FACES = [
    { n: [1, 0, 0], c: [[.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5], [.5, -.5, .5]] },
    { n: [-1, 0, 0], c: [[-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5], [-.5, -.5, -.5]] },
    { n: [0, 1, 0], c: [[-.5, .5, -.5], [.5, .5, -.5], [.5, .5, .5], [-.5, .5, .5]] },
    { n: [0, -1, 0], c: [[-.5, -.5, .5], [.5, -.5, .5], [.5, -.5, -.5], [-.5, -.5, -.5]] },
    { n: [0, 0, 1], c: [[.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5], [-.5, -.5, .5]] },
    { n: [0, 0, -1], c: [[-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5], [.5, -.5, -.5]] },
  ];

  // 고정 광원(월드 좌표) — 정규화. 면 밝기 = 0.4 + 0.6·max(0, n·L).
  const L = (function () { const v = [0.45, 1.0, 0.6]; const m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; })();
  const FACE_SHADE = FACES.map(f => 0.40 + 0.60 * Math.max(0, f.n[0] * L[0] + f.n[1] * L[1] + f.n[2] * L[2]));

  // 값(1/2/3) → 기본 색(표면=청록·중간=파랑·중심=보라). 값 0 은 그리지 않는다.
  const PALETTE = { 1: [52, 168, 190], 2: [64, 116, 230], 3: [142, 92, 220] };

  // 에너지 히트 램프: 차가움(짙은 청) → 청록 → 노랑 → 적백(뜨거움). t∈[0,1].
  const HEAT = [[24, 34, 78], [40, 120, 200], [60, 200, 175], [235, 220, 90], [250, 95, 60]];
  function heatColor(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const f = t * (HEAT.length - 1), i = Math.min(HEAT.length - 2, f | 0), u = f - i;
    const a = HEAT[i], b = HEAT[i + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  }

  // 기본 카메라 상태. yaw/pitch=회전, zoom=확대, panX/panY=픽셀 이동.
  function defaultCamera() { return { yaw: 0.7, pitch: 0.55, zoom: 1.0, panX: 0, panY: 0 }; }

  // 세계(격자 위 장)를 캔버스 컨텍스트에 그린다. cam 은 defaultCamera() 형태.
  //   opts.field   : 그릴 장 이름(기본 'energy').
  //   opts.colormap: 'heat'(기본, 값/max 를 청→적 히트 램프) | 'palette'(값 1/2/3 → 고정 3색).
  //   opts.eps     : 점유 임계(기본 1e-9). 값>eps 인 셀만 그린다.
  function draw(ctx, world, cam, opts) {
    opts = opts || {};
    const name = opts.field || 'energy';
    const src = world.fields[name];
    const colormap = opts.colormap || 'heat';
    const eps = opts.eps != null ? opts.eps : 1e-9;
    // 히트 스케일: 최대값으로 정규화(흐를수록 max 가 줄어 대비 유지). opts.max 로 고정 가능.
    let emax = opts.max || 1;
    if (colormap === 'heat' && !opts.max) { for (let i = 0; i < src.length; i++) if (src[i] > emax) emax = src[i]; }
    const filled = (i) => src[i] > eps;                          // 점유 판정
    const N = world.N;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const half = (N - 1) / 2;

    // 배경(다크) + 지수 페이드 느낌의 단색.
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, W, H);

    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const scale = (Math.min(W, H) * 0.80 / N) * cam.zoom;
    const ox = W / 2 + cam.panX, oy = H / 2 + cam.panY;

    // 월드점 → 화면[sx,sy] + 카메라깊이 z2(클수록 가까움).
    function project(wx, wy, wz) {
      const x1 = wx * cy + wz * sy;
      const z1 = -wx * sy + wz * cy;
      const y2 = wy * cp - z1 * sp;
      const z2 = wy * sp + z1 * cp;
      return [ox + x1 * scale, oy - y2 * scale, z2];
    }
    // 면 법선의 카메라깊이 z 성분 — > 0 이면 카메라를 향함(가시).
    function normalZ(n) {
      const z1 = -n[0] * sy + n[2] * cy;
      return n[1] * sp + z1 * cp;
    }
    const faceVisible = FACES.map(f => normalZ(f.n) > 0);

    // ── 경계 박스(와이어) — 큐브보다 먼저(뒤에) 그린다 ──
    const e = N / 2 + 0.5;
    const corners = [[-e, -e, -e], [e, -e, -e], [e, e, -e], [-e, e, -e], [-e, -e, e], [e, -e, e], [e, e, e], [-e, e, e]].map(p => project(p[0], p[1], p[2]));
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    ctx.strokeStyle = '#2a3242'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [a, b] of edges) { ctx.moveTo(corners[a][0], corners[a][1]); ctx.lineTo(corners[b][0], corners[b][1]); }
    ctx.stroke();

    // ── 표면 셀 수집(내부 셀은 6이웃이 모두 채워짐 → 안 보임 → 건너뜀) ──
    const NN = N * N;
    const list = [];
    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const idx = (z * N + y) * N + x;
          if (!filled(idx)) continue;
          // 표면 판정: 6이웃 중 하나라도 빈(또는 경계 밖)이면 표면.
          const surf =
            x === 0 || x === N - 1 || y === 0 || y === N - 1 || z === 0 || z === N - 1 ||
            !filled(idx - 1) || !filled(idx + 1) ||
            !filled(idx - N) || !filled(idx + N) ||
            !filled(idx - NN) || !filled(idx + NN);
          if (!surf) continue;
          const wx = x - half, wy = y - half, wz = z - half;
          const depth = wy * sp + (-wx * sy + wz * cy) * cp;   // project 의 z2 와 동일식(중심)
          list.push([wx, wy, wz, src[idx], depth]);            // 셀의 장 값(색 결정용)
        }
    // 화가 알고리즘: 깊이 오름차순(먼 것 먼저) → 가까운 것이 위에 덮인다.
    list.sort((a, b) => a[4] - b[4]);

    // ── 큐브 그리기 ──
    for (let i = 0; i < list.length; i++) {
      const wx = list[i][0], wy = list[i][1], wz = list[i][2], v = list[i][3];
      // 색: palette → 값 1/2/3 의 고정색 / heat → 값/max 를 청(차가움)→적(뜨거움) 램프로.
      const base = colormap === 'palette' ? (PALETTE[v] || PALETTE[1]) : heatColor(v / emax);
      for (let f = 0; f < FACES.length; f++) {
        if (!faceVisible[f]) continue;
        const face = FACES[f], sh = FACE_SHADE[f];
        const p0 = project(wx + face.c[0][0], wy + face.c[0][1], wz + face.c[0][2]);
        const p1 = project(wx + face.c[1][0], wy + face.c[1][1], wz + face.c[1][2]);
        const p2 = project(wx + face.c[2][0], wy + face.c[2][1], wz + face.c[2][2]);
        const p3 = project(wx + face.c[3][0], wy + face.c[3][1], wz + face.c[3][2]);
        ctx.fillStyle = 'rgb(' + ((base[0] * sh) | 0) + ',' + ((base[1] * sh) | 0) + ',' + ((base[2] * sh) | 0) + ')';
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
        ctx.closePath();
        ctx.fill();
      }
    }
    return list.length;   // 그린 표면 셀 수(디버그/검증용)
  }

  // 화면 좌표(sx,sy) → 격자 셀 [x,y,z] 픽킹. draw 와 *동일한* 직교 투영을 재사용한다.
  //   모든 셀 중심을 화면에 투영해, 클릭 근처(반경 R 픽셀)에서 가장 앞쪽(카메라 쪽) 셀을 고른다.
  //   근처에 없으면 전역 최근접 셀로 폴백 → 빈(에너지 0) 공간에서도 항상 하나를 반환한다.
  function pick(ctx, world, cam, sx, sy) {
    const N = world.N, W = ctx.canvas.width, H = ctx.canvas.height, half = (N - 1) / 2;
    const cy = Math.cos(cam.yaw), say = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const scale = (Math.min(W, H) * 0.80 / N) * cam.zoom;
    const ox = W / 2 + cam.panX, oy = H / 2 + cam.panY;
    const R = scale * 0.7;                          // 픽 반경 ≈ 셀 반폭
    let best = -1, bestDepth = -Infinity, fbI = -1, fbDist = Infinity;
    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const wx = x - half, wy = y - half, wz = z - half;
          const x1 = wx * cy + wz * say;
          const z1 = -wx * say + wz * cy;
          const y2 = wy * cp - z1 * sp;
          const z2 = wy * sp + z1 * cp;             // 깊이(클수록 카메라에 가까움)
          const px = ox + x1 * scale, py = oy - y2 * scale;
          const dx = px - sx, dy = py - sy, dist = Math.hypot(dx, dy);
          if (dist <= R && z2 > bestDepth) { bestDepth = z2; best = (z * N + y) * N + x; }
          if (dist < fbDist) { fbDist = dist; fbI = (z * N + y) * N + x; }
        }
    const i = best >= 0 ? best : fbI;
    return i < 0 ? null : world.coords(i);
  }

  return { draw, pick, defaultCamera, FACES, VERSION: 2 };
});
