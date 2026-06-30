/* plantrender.js — 성장한 나무(grow.js)를 에셋급으로 그리는 SDF 렌더러.
 *
 * artrender.js 의 capsule-SDF + smooth-min + lambert/AO 를 토대로, "토이 → 에셋" 격차를
 * 메우는 네 가지를 더한다:
 *   P1 포일리지 볼륨 — 평면 blob 대신 작은 잎 메타볼 다수 + 수직 광 그라디언트 + 명도/색상 지터
 *   P2 접지 그림자  — 지면에 발자국 타원 어둠 → 떠보임 제거
 *   P3 외곽선 제거  — 하드 잉크라인은 토이 신호 1순위 → 포일리지 0, 바크 최소
 *   P4 바크 노이즈  — 시드 밸류노이즈로 껍질 질감 + 상후방 림라이트
 *   + 하늘 수직 그라디언트
 *
 * 가지 테이퍼: 한 캡슐의 양끝 반경이 다르므로(Murray), 클램프된 투영 h 로 반경을 보간한다.
 * 읽기 전용·DOM 비의존(렌더 코어). 시드 RNG 로 렌더 지터까지 재현.
 */
(function (global) {
  'use strict';

  // ── 시드 밸류노이즈(무의존) ──
  function hash2(ix, iy, seed) {
    let h = (ix | 0) * 374761393 + (iy | 0) * 668265263 + (seed | 0) * 0x9E3779B1 | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const smin = (a, b, k) => { let h = 0.5 + 0.5 * (b - a) / k; h = h < 0 ? 0 : h > 1 ? 1 : h; return b * (1 - h) + a * h - k * h * (1 - h); };

  // 테이퍼 캡슐 SDF: 양끝 반경 ra,rb 를 클램프 투영 h 로 보간.
  function taperSeg(gx, gy, axx, ayy, bxx, byy, ra, rb) {
    const pax = gx - axx, pay = gy - ayy, bax = bxx - axx, bay = byy - ayy;
    const denom = bax * bax + bay * bay + 1e-9;
    let h = (pax * bax + pay * bay) / denom; h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = pax - bax * h, dy = pay - bay * h;
    return Math.sqrt(dx * dx + dy * dy) - (ra + (rb - ra) * h);
  }

  const DEFAULTS = {
    worldW: 70, worldH: 104, groundY: 7, scale: 5, supersample: 2,
    sminK: 0.9, barkK: 1.9, leafK: 1.35, light: [-0.5, 0.85], rim: [0.55, 0.62],
    leavesPerTip: 16, leafR: [2.0, 3.3], leafSigma: 3.4,
    seed: 1,
  };

  // grow.js tree → {rgb, pxw, pxh}. tree 의 월드 좌표를 그대로 사용(baseX 중앙 권장).
  function renderScene(tree, opts = {}) {
    const o = Object.assign({}, DEFAULTS, opts);
    const rng = typeof o.rng === 'function' ? o.rng : mulberry32(o.seed);
    const W = o.worldW, H = o.worldH, groundY = o.groundY;
    const ss = Math.max(1, Math.floor(o.supersample));
    const bw = Math.max(1, Math.floor(W * o.scale)), bh = Math.max(1, Math.floor(H * o.scale));
    const RW = bw * ss, RH = bh * ss, N = RW * RH;
    const wx = (ix) => ix / (RW - 1) * W, wy = (iy) => iy / (RH - 1) * H;

    let lx = o.light[0], ly = o.light[1]; const lm = Math.hypot(lx, ly) || 1; lx /= lm; ly /= lm;
    let rx = o.rim[0], ry = o.rim[1]; const rm = Math.hypot(rx, ry) || 1; rx /= rm; ry /= rm;

    const img = new Float32Array(N * 3);
    const set = (p, r, g, b) => { img[p * 3] = r; img[p * 3 + 1] = g; img[p * 3 + 2] = b; };

    // ── 하늘: 수직 그라디언트 (top → horizon) ──
    const SKY_TOP = [0.62, 0.74, 0.88], SKY_HOR = [0.90, 0.93, 0.97];
    for (let iy = 0; iy < RH; iy++) {
      const t = wy(iy) / H;                 // 0 바닥 ~ 1 꼭대기
      const r = SKY_HOR[0] + (SKY_TOP[0] - SKY_HOR[0]) * t;
      const g = SKY_HOR[1] + (SKY_TOP[1] - SKY_HOR[1]) * t;
      const b = SKY_HOR[2] + (SKY_TOP[2] - SKY_HOR[2]) * t;
      for (let ix = 0; ix < RW; ix++) set(iy * RW + ix, r, g, b);
    }

    // ── 지면 밴드 + P2 접지 그림자 ──
    const crown = tree.crown || { cx: W / 2, rx: 24 };
    const baseX = tree.nx[0];
    const SOIL = [0.40, 0.32, 0.21], GRASS = [0.33, 0.50, 0.25];
    for (let ix = 0; ix < RW; ix++) {
      const X = wx(ix);
      // 접지 그림자: 트렁크 발자국 타원
      const sw = Math.max(crown.rx * 0.9, 10);
      const shadow = 1 - 0.34 * Math.exp(-Math.pow((X - baseX) / sw, 2));
      for (let iy = 0; iy < RH; iy++) {
        const Y = wy(iy);
        if (Y < groundY) {
          const top = Y > groundY - 1.6;
          const c = top ? GRASS : SOIL;
          set(iy * RW + ix, c[0] * shadow, c[1] * shadow, c[2] * shadow);
        }
      }
    }

    // ── 바크 SDF (가지 = 테이퍼 캡슐, smin 융합) ──
    const nx = tree.nx, ny = tree.ny, parent = tree.parent, radius = tree.radius;
    const barkSdf = new Float32Array(N).fill(1e9);
    for (let i = 1; i < nx.length; i++) {
      const p = parent[i]; if (p < 0) continue;
      const axx = nx[p], ayy = ny[p], bxx = nx[i], byy = ny[i];
      const ra = radius[p], rb = radius[i], rmax = Math.max(ra, rb);
      const xmin = Math.min(axx, bxx) - rmax - o.barkK - 1, xmax = Math.max(axx, bxx) + rmax + o.barkK + 1;
      const ymin = Math.min(ayy, byy) - rmax - o.barkK - 1, ymax = Math.max(ayy, byy) + rmax + o.barkK + 1;
      const ix0 = Math.max(0, Math.floor(xmin / W * (RW - 1))), ix1 = Math.min(RW - 1, Math.ceil(xmax / W * (RW - 1)));
      const iy0 = Math.max(0, Math.floor(ymin / H * (RH - 1))), iy1 = Math.min(RH - 1, Math.ceil(ymax / H * (RH - 1)));
      for (let iy = iy0; iy <= iy1; iy++) {
        const Y = wy(iy), row = iy * RW;
        for (let ix = ix0; ix <= ix1; ix++) {
          const d = taperSeg(wx(ix), Y, axx, ayy, bxx, byy, ra, rb);
          barkSdf[row + ix] = smin(barkSdf[row + ix], d, o.barkK);
        }
      }
    }
    shadeLayer(img, barkSdf, RW, RH, {
      kind: 'bark', wx, wy, lx, ly, rx, ry, seed: o.seed,
      base: [0.31, 0.21, 0.13], outline: 0.18, outlineCol: [0.16, 0.10, 0.06],
    });

    // ── P1 포일리지: 팁마다 작은 잎 메타볼 클러스터(가우시안 산포) ──
    const leafBlobs = [];           // {x,y,r}
    const [lr0, lr1] = o.leafR;
    for (const seed of tree.leaves) {
      for (let k = 0; k < o.leavesPerTip; k++) {
        // box-muller 근사: 두 균등합으로 가우시안 흉내
        const gx = (rng() + rng() + rng() - 1.5) * o.leafSigma;
        const gy = (rng() + rng() + rng() - 1.5) * o.leafSigma;
        leafBlobs.push({ x: seed.x + gx, y: seed.y + gy * 0.9, r: lr0 + rng() * (lr1 - lr0) });
      }
    }
    const foliageSdf = new Float32Array(N).fill(1e9);
    for (const b of leafBlobs) {
      const m = b.r + o.leafK + 1;
      const ix0 = Math.max(0, Math.floor((b.x - m) / W * (RW - 1))), ix1 = Math.min(RW - 1, Math.ceil((b.x + m) / W * (RW - 1)));
      const iy0 = Math.max(0, Math.floor((b.y - m) / H * (RH - 1))), iy1 = Math.min(RH - 1, Math.ceil((b.y + m) / H * (RH - 1)));
      for (let iy = iy0; iy <= iy1; iy++) {
        const Y = wy(iy), row = iy * RW;
        for (let ix = ix0; ix <= ix1; ix++) {
          const d = Math.hypot(wx(ix) - b.x, Y - b.y) - b.r;
          foliageSdf[row + ix] = smin(foliageSdf[row + ix], d, o.leafK);
        }
      }
    }
    // 캐노피 수직 범위(볼륨 그라디언트용)
    let cyMin = 1e9, cyMax = -1e9;
    for (const s of tree.leaves) { if (s.y < cyMin) cyMin = s.y; if (s.y > cyMax) cyMax = s.y; }
    if (cyMax <= cyMin) cyMax = cyMin + 1;
    shadeLayer(img, foliageSdf, RW, RH, {
      kind: 'leaf', wx, wy, lx, ly, rx, ry, seed: o.seed + 7,
      lit: [0.55, 0.72, 0.32], shadow: [0.12, 0.28, 0.13], cyMin, cyMax, outline: 0,
    });

    // ── 다운샘플 + 상하 반전 ──
    const rgb = new Float32Array(bw * bh * 3), inv = 1 / (ss * ss);
    for (let oy = 0; oy < bh; oy++) {
      const sy = (bh - 1 - oy) * ss;
      for (let ox = 0; ox < bw; ox++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < ss; dy++) { const row = (sy + dy) * RW; for (let dx = 0; dx < ss; dx++) { const p = (row + ox * ss + dx) * 3; r += img[p]; g += img[p + 1]; b += img[p + 2]; } }
        const oo = (oy * bw + ox) * 3; rgb[oo] = r * inv; rgb[oo + 1] = g * inv; rgb[oo + 2] = b * inv;
      }
    }
    return { rgb, pxw: bw, pxh: bh, nLeafBlobs: leafBlobs.length };
  }

  // 한 레이어(바크/포일리지)를 sdf 로부터 셰이딩해 img 에 합성.
  function shadeLayer(img, sdf, RW, RH, P) {
    const { wx, wy, lx, ly, rx, ry } = P;
    for (let iy = 0; iy < RH; iy++) {
      const row = iy * RW, up = (iy < RH - 1 ? iy + 1 : iy) * RW, dn = (iy > 0 ? iy - 1 : iy) * RW;
      for (let ix = 0; ix < RW; ix++) {
        const p = row + ix, d = sdf[p];
        if (d < 0) {
          const ixr = ix < RW - 1 ? ix + 1 : ix, ixl = ix > 0 ? ix - 1 : ix;
          const gxg = (sdf[row + ixr] - sdf[row + ixl]) * 0.5, gyg = (sdf[up + ix] - sdf[dn + ix]) * 0.5;
          const nl = Math.hypot(gxg, gyg) + 1e-6, nxn = -gxg / nl, nyn = -gyg / nl;
          let lam = nxn * lx + nyn * ly; lam = lam < 0 ? 0 : lam > 1 ? 1 : lam;
          let depth = -d / 3.0; depth = depth < 0 ? 0 : depth > 1 ? 1 : depth;   // 가장자리 그늘(AO)
          let rimv = nxn * rx + nyn * ry; rimv = rimv < 0 ? 0 : rimv;             // 림라이트
          let r, g, b;
          if (P.kind === 'leaf') {
            // 볼륨: 위/노멀↑ → 햇빛, 아래/안쪽 → 그늘 + 명도/색상 지터
            const hT = (wy(iy) - P.cyMin) / (P.cyMax - P.cyMin);                  // 캐노피 내 높이 0~1
            let t = 0.30 * Math.max(0, nyn) + 0.45 * Math.min(1, Math.max(0, hT)) + 0.25 * lam;
            const n = vnoise(wx(ix) * 0.55, wy(iy) * 0.55, P.seed);               // 잎 모틀
            t = Math.min(1, Math.max(0, t + (n - 0.5) * 0.35));
            r = P.shadow[0] + (P.lit[0] - P.shadow[0]) * t;
            g = P.shadow[1] + (P.lit[1] - P.shadow[1]) * t;
            b = P.shadow[2] + (P.lit[2] - P.shadow[2]) * t;
            const sh = 0.82 + 0.18 * depth; r *= sh; g *= sh; b *= sh;            // 안쪽 살짝 어둡게
            r += 0.08 * rimv; g += 0.10 * rimv; b += 0.05 * rimv;                 // 림
          } else {
            // 바크: 밸류노이즈 모틀 + lambert + AO + 림
            const n = vnoise(wx(ix) * 0.7, wy(iy) * 1.3, P.seed);
            const mot = 0.82 + 0.18 * n;
            let sh = (0.5 + 0.5 * lam) * (0.74 + 0.26 * depth) * mot;
            r = P.base[0] * sh; g = P.base[1] * sh; b = P.base[2] * sh;
            r += 0.14 * rimv; g += 0.16 * rimv; b += 0.10 * rimv;
          }
          img[p * 3] = r; img[p * 3 + 1] = g; img[p * 3 + 2] = b;
        } else if (P.outline > 0 && d < P.outline) {
          const oc = P.outlineCol;
          img[p * 3] = oc[0]; img[p * 3 + 1] = oc[1]; img[p * 3 + 2] = oc[2];
        }
      }
    }
  }

  function toImageData(rgb, pxw, pxh, ctx) {
    const im = ctx.createImageData(pxw, pxh), d = im.data;
    for (let p = 0; p < pxw * pxh; p++) {
      const s = p * 3, t = p * 4;
      d[t] = Math.max(0, Math.min(255, rgb[s] * 255));
      d[t + 1] = Math.max(0, Math.min(255, rgb[s + 1] * 255));
      d[t + 2] = Math.max(0, Math.min(255, rgb[s + 2] * 255));
      d[t + 3] = 255;
    }
    return im;
  }
  function drawToCanvas(tree, canvas, opts) {
    const { rgb, pxw, pxh } = renderScene(tree, opts);
    canvas.width = pxw; canvas.height = pxh;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(toImageData(rgb, pxw, pxh, ctx), 0, 0);
    return { pxw, pxh };
  }

  const PlantRender = { renderScene, toImageData, drawToCanvas, vnoise, mulberry32, DEFAULTS };
  global.PlantRender = PlantRender;
  if (typeof module !== 'undefined' && module.exports) module.exports = PlantRender;
})(typeof window !== 'undefined' ? window : globalThis);
