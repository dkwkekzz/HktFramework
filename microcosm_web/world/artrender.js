/* artrender.js — SDF/메타볼 통일 아트 렌더러 (microcosm/microcosm/artrender.py 의 JS 이식).
 *
 * 물리 디버그 뷰(점·선)가 아니라 *아트*를 그린다. 핵심 아이디어:
 * 입자 구름·뼈를 **거리장(SDF)** 으로 바꿔 매끈한 표면을 뽑고, 방향광으로 셰이딩하고
 * 외곽선을 입힌다. 이 하나의 렌더러로 캐릭터 스킨·나무 캐노피·바다·지형을 모두 그린다
 * (같은 기질, 다른 재질). "아트 리소스"를 손으로 그리지 않고 기질에서 뽑아내는 것이 목표.
 *
 *   뼈/가지/줄기 = capsule SDF (선분+반경), smooth-min 으로 관절에서 부드럽게 융합
 *   머리/캐노피  = blob (입자들의 metaball)
 *   바다         = 물 입자 metaball → 임계 표면
 *   지형         = 높이함수 아래 재질 밴드
 *
 * 코어(renderScene)는 DOM 비의존 — World 상태(px,py,alive,kind,skins,ground)만 읽어
 * Float32 RGB 버퍼를 만든다(Node 검증 가능). 캔버스 블릿은 얇은 래퍼로 분리.
 */
(function (global) {
  'use strict';

  const KIND_WATER = 5;  // engine.js KIND.WATER 와 동일(상수 의존 최소화)

  // 재질 팔레트 (base RGB, outline RGB) — artrender.py 와 동일
  const MAT = {
    skin:  [[0.86, 0.66, 0.52], [0.32, 0.20, 0.16]],
    cloth: [[0.27, 0.40, 0.62], [0.10, 0.15, 0.28]],
    hair:  [[0.28, 0.20, 0.16], [0.10, 0.07, 0.06]],
    bark:  [[0.47, 0.33, 0.20], [0.18, 0.12, 0.07]],
    leaf:  [[0.30, 0.55, 0.27], [0.12, 0.24, 0.11]],
    rock:  [[0.55, 0.53, 0.47], [0.22, 0.21, 0.18]],
  };
  const WATER_COL = [[0.16, 0.42, 0.72], [0.40, 0.66, 0.92]];  // deep, foam
  const SKY = [0.94, 0.95, 0.97];
  const RENDER_ORDER = ['leaf', 'bark', 'hair', 'cloth', 'rock', 'skin'];  // 뒤→앞

  // 선분 (a,b) + 반경 r 캡슐의 부호거리장. <0 이면 내부.
  function segSdf(gx, gy, ax, ay, bx, by, r) {
    const pax = gx - ax, pay = gy - ay, bax = bx - ax, bay = by - ay;
    const denom = bax * bax + bay * bay + 1e-9;
    let h = (pax * bax + pay * bay) / denom;
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = pax - bax * h, dy = pay - bay * h;
    return Math.sqrt(dx * dx + dy * dy) - r;
  }

  // polynomial smooth-min — 두 거리장을 부드럽게 합쳐 관절을 자연스럽게 잇는다.
  function smin(a, b, k) {
    let h = 0.5 + 0.5 * (b - a) / k;
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    return b * (1 - h) + a * h - k * h * (1 - h);
  }

  // 월드 좌표 → 픽셀 인덱스 bbox (clamp). margin 은 월드 단위 여유.
  function bbox(xmin, xmax, ymin, ymax, margin, W, H, RW, RH) {
    const sx = (RW - 1) / W, sy = (RH - 1) / H;
    return {
      ix0: Math.max(0, Math.floor((xmin - margin) * sx)),
      ix1: Math.min(RW - 1, Math.ceil((xmax + margin) * sx)),
      iy0: Math.max(0, Math.floor((ymin - margin) * sy)),
      iy1: Math.min(RH - 1, Math.ceil((ymax + margin) * sy)),
    };
  }

  /* World → {rgb:Float32Array(top-first RGB), pxw, pxh}. scale=픽셀/단위.
   * opts: {scale=4, sminK=1.2, outline=0.6, supersample=2, light=[-0.6,0.8],
   *        waterRad=4.2, depthR=3.0}
   */
  function renderScene(w, opts = {}) {
    const scale = opts.scale || 4.0;
    const sminK = opts.sminK || 1.2;
    const outline = opts.outline != null ? opts.outline : 0.6;
    const ss = Math.max(1, Math.floor(opts.supersample || 2));
    const light = opts.light || [-0.6, 0.8];
    const waterRad = opts.waterRad || 4.2;
    const depthR = opts.depthR || 3.0;

    const W = w.W, H = w.H;
    const bw = Math.max(1, Math.floor(W * scale)), bh = Math.max(1, Math.floor(H * scale));
    const RW = bw * ss, RH = bh * ss, N = RW * RH;

    // 픽셀 → 월드 좌표 (iy 증가 = 월드 y 증가, 즉 위쪽). 출력 시 상하 반전.
    const wxAt = (ix) => ix / (RW - 1) * W;
    const wyAt = (iy) => iy / (RH - 1) * H;
    // 광원 정규화
    let lx = light[0], ly = light[1];
    const lmag = Math.hypot(lx, ly) || 1; lx /= lmag; ly /= lmag;

    const img = new Float32Array(N * 3);
    for (let p = 0; p < N; p++) { img[p * 3] = SKY[0]; img[p * 3 + 1] = SKY[1]; img[p * 3 + 2] = SKY[2]; }
    const setPx = (p, c) => { img[p * 3] = c[0]; img[p * 3 + 1] = c[1]; img[p * 3 + 2] = c[2]; };

    // ── 지형: 높이함수 아래 재질 밴드 (흙 + 표토 풀) ──
    const SOIL = [0.42, 0.34, 0.22], GRASS = [0.34, 0.52, 0.26];
    for (let ix = 0; ix < RW; ix++) {
      const gl = w.ground(wxAt(ix));
      for (let iy = 0; iy < RH; iy++) {
        const wy = wyAt(iy);
        if (wy < gl) setPx(iy * RW + ix, wy > gl - 2.5 ? GRASS : SOIL);
      }
    }

    // ── 바다: 물 입자 metaball → 임계 표면 ──
    const n = w.n;
    const wpx = [], wpy = [];
    for (let i = 0; i < n; i++) if (w.alive[i] && w.kind[i] === KIND_WATER) { wpx.push(w.px[i]); wpy.push(w.py[i]); }
    if (wpx.length) {
      const field = new Float32Array(N);
      const rad2 = waterRad * waterRad, margin = waterRad * 3;
      for (let q = 0; q < wpx.length; q++) {
        const px = wpx[q], py = wpy[q];
        const bb = bbox(px, px, py, py, margin, W, H, RW, RH);
        for (let iy = bb.iy0; iy <= bb.iy1; iy++) {
          const dy = wyAt(iy) - py, row = iy * RW;
          for (let ix = bb.ix0; ix <= bb.ix1; ix++) {
            const dx = wxAt(ix) - px;
            field[row + ix] += Math.exp(-(dx * dx + dy * dy) / rad2);
          }
        }
      }
      for (let p = 0; p < N; p++) {
        const f = field[p];
        if (f > 0.9) setPx(p, f < 1.4 ? WATER_COL[1] : WATER_COL[0]);
      }
    }

    // ── 스킨 프리미티브(캡슐/블롭): 재질별로 거리장을 모아 셰이딩 + 외곽선 ──
    const byMat = {};
    for (const s of (w.skins || [])) (byMat[s.mat || 'skin'] || (byMat[s.mat || 'skin'] = [])).push(s);
    const order = RENDER_ORDER.concat(Object.keys(byMat).filter((m) => RENDER_ORDER.indexOf(m) < 0));

    for (const mat of order) {
      const prims = byMat[mat];
      if (!prims || !prims.length) continue;
      const sdf = new Float32Array(N).fill(1e9);
      let touched = false;

      for (const s of prims) {
        if (s.kind === 'capsule') {
          const i = s.i, j = s.j;
          if (!(w.alive[i] && w.alive[j])) continue;
          const ax = w.px[i], ay = w.py[i], bx = w.px[j], by = w.py[j], r = s.r;
          const bb = bbox(Math.min(ax, bx), Math.max(ax, bx), Math.min(ay, by), Math.max(ay, by),
            r + sminK + outline + 1, W, H, RW, RH);
          for (let iy = bb.iy0; iy <= bb.iy1; iy++) {
            const gy = wyAt(iy), row = iy * RW;
            for (let ix = bb.ix0; ix <= bb.ix1; ix++) {
              const d = segSdf(wxAt(ix), gy, ax, ay, bx, by, r);
              sdf[row + ix] = smin(sdf[row + ix], d, sminK);
            }
          }
          touched = true;
        } else {  // blob — 입자 metaball(점들의 min 거리장)
          const idx = s.idx.filter((k) => w.alive[k]);
          if (!idx.length) continue;
          const r = s.r;
          let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
          for (const k of idx) {
            xmin = Math.min(xmin, w.px[k]); xmax = Math.max(xmax, w.px[k]);
            ymin = Math.min(ymin, w.py[k]); ymax = Math.max(ymax, w.py[k]);
          }
          const bb = bbox(xmin, xmax, ymin, ymax, r + sminK + outline + 1, W, H, RW, RH);
          for (let iy = bb.iy0; iy <= bb.iy1; iy++) {
            const gy = wyAt(iy), row = iy * RW;
            for (let ix = bb.ix0; ix <= bb.ix1; ix++) {
              const gx = wxAt(ix);
              let d = 1e9;
              for (const k of idx) d = Math.min(d, Math.hypot(gx - w.px[k], gy - w.py[k]) - r);
              sdf[row + ix] = smin(sdf[row + ix], d, sminK);
            }
          }
          touched = true;
        }
      }
      if (!touched) continue;

      const [base, oc] = MAT[mat] || MAT.skin;
      // 셰이딩(내부) + 외곽선 — sdf 그리드의 유한차분으로 노멀 추정.
      for (let iy = 0; iy < RH; iy++) {
        const row = iy * RW, up = (iy < RH - 1 ? iy + 1 : iy) * RW, dn = (iy > 0 ? iy - 1 : iy) * RW;
        for (let ix = 0; ix < RW; ix++) {
          const p = row + ix, d = sdf[p];
          if (d < 0) {
            const ixr = ix < RW - 1 ? ix + 1 : ix, ixl = ix > 0 ? ix - 1 : ix;
            const gxg = (sdf[row + ixr] - sdf[row + ixl]) * 0.5;
            const gyg = (sdf[up + ix] - sdf[dn + ix]) * 0.5;
            const nl = Math.hypot(gxg, gyg) + 1e-6;
            const nx = -gxg / nl, ny = -gyg / nl;
            let lam = nx * lx + ny * ly; lam = lam < 0 ? 0 : lam > 1 ? 1 : lam;
            let sh = 0.55 + 0.45 * lam;
            let depth = -d / depthR; depth = depth < 0 ? 0 : depth > 1 ? 1 : depth;
            sh *= 0.78 + 0.22 * depth;
            img[p * 3] = base[0] * sh; img[p * 3 + 1] = base[1] * sh; img[p * 3 + 2] = base[2] * sh;
          } else if (d < outline) {
            setPx(p, oc);
          }
        }
      }
    }

    // ── 다운샘플(ss 평균) + 상하 반전(월드 위 → 이미지 위) ──
    const rgb = new Float32Array(bw * bh * 3);
    const inv = 1 / (ss * ss);
    for (let oy = 0; oy < bh; oy++) {
      const syBase = (bh - 1 - oy) * ss;  // 반전: 이미지 위쪽 = 월드 위쪽(큰 iy)
      for (let ox = 0; ox < bw; ox++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < ss; dy++) {
          const row = (syBase + dy) * RW;
          for (let dx = 0; dx < ss; dx++) {
            const p = (row + ox * ss + dx) * 3;
            r += img[p]; g += img[p + 1]; b += img[p + 2];
          }
        }
        const o = (oy * bw + ox) * 3;
        rgb[o] = r * inv; rgb[o + 1] = g * inv; rgb[o + 2] = b * inv;
      }
    }
    return { rgb, pxw: bw, pxh: bh };
  }

  // ── 캔버스 블릿(브라우저 전용 얇은 래퍼) ──
  function toImageData(rgb, pxw, pxh, ctx) {
    const im = ctx.createImageData(pxw, pxh);
    const d = im.data;
    for (let p = 0; p < pxw * pxh; p++) {
      const s = p * 3, t = p * 4;
      d[t] = Math.max(0, Math.min(255, rgb[s] * 255));
      d[t + 1] = Math.max(0, Math.min(255, rgb[s + 1] * 255));
      d[t + 2] = Math.max(0, Math.min(255, rgb[s + 2] * 255));
      d[t + 3] = 255;
    }
    return im;
  }

  function drawToCanvas(w, canvas, opts) {
    const { rgb, pxw, pxh } = renderScene(w, opts);
    canvas.width = pxw; canvas.height = pxh;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(toImageData(rgb, pxw, pxh, ctx), 0, 0);
    return { pxw, pxh };
  }

  const ArtRender = { renderScene, toImageData, drawToCanvas, segSdf, smin, MAT, WATER_COL, SKY };
  global.ArtRender = ArtRender;
  if (typeof module !== 'undefined' && module.exports) module.exports = ArtRender;
})(typeof window !== 'undefined' ? window : globalThis);
