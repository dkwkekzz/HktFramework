// 결정적 노이즈 — 원본 §18.2 의 JS 이식 + 주기/방향성 확장 (05-phase3 §3.1, D-10).
// Math.sin 기반 해시 금지(엔진 편차) — fract/dot 방식은 곱셈·덧셈만이라 안전.

const fract = (x) => x - Math.floor(x);

/** 원본 §18.2 hash21 + seed 혼합. @returns [0,1) */
export function hash21(x, y, seed = 0) {
  let px = fract(x * 123.34 + seed * 0.6180339887);
  let py = fract(y * 345.45 + seed * 0.7548776662);
  const d = px * (px + 34.345) + py * (py + 34.345);
  px = fract(px + d);
  py = fract(py + d);
  return fract(px * py * 95.4307);
}

const smooth = (t) => t * t * (3 - 2 * t);

/** value noise — 원본 §18.2 (smoothstep 보간). */
export function valueNoise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash21(ix, iy, seed);
  const b = hash21(ix + 1, iy, seed);
  const c = hash21(ix, iy + 1, seed);
  const d = hash21(ix + 1, iy + 1, seed);
  const ux = smooth(fx), uy = smooth(fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/**
 * 둘레(y) 방향 주기 value noise — seam 불연속 제거 (D-10).
 * 격자 y 좌표를 mod(periodY) 로 감는다. 길이(x) 방향은 비주기.
 */
export function periodicValueNoise2(x, y, periodY, seed = 0) {
  const wrap = (iy) => ((iy % periodY) + periodY) % periodY;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash21(ix, wrap(iy), seed);
  const b = hash21(ix + 1, wrap(iy), seed);
  const c = hash21(ix, wrap(iy + 1), seed);
  const d = hash21(ix + 1, wrap(iy + 1), seed);
  const ux = smooth(fx), uy = smooth(fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** fbm — octave 합성. periodY 를 주면 둘레 주기 버전 (octave 마다 주기도 2배). */
export function fbm(x, y, { octaves = 4, lacunarity = 2, gain = 0.5, seed = 0, periodY = 0 } = {}) {
  let amp = 0.5, fx = x, fy = y, sum = 0, norm = 0, period = periodY;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (period > 0
      ? periodicValueNoise2(fx, fy, Math.max(1, Math.round(period)), seed + o * 101)
      : valueNoise2(fx, fy, seed + o * 101));
    norm += amp;
    amp *= gain;
    fx *= lacunarity; fy *= lacunarity;
    period *= lacunarity;
  }
  return sum / norm;
}

/**
 * 방향성 노이즈 — 연마 흔적용 (탄소강 microNormal 의 "directional_noise").
 * 좌표를 회전 후 비등방 스케일(stretch 배 길게) → 가늘고 긴 줄무늬.
 */
export function directionalNoise(x, y, { angle = 0, stretch = 8, seed = 0, periodY = 0 } = {}) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const rx = (c * x + s * y) / stretch;
  const ry = -s * x + c * y;
  return periodY > 0
    ? periodicValueNoise2(rx, ry, Math.max(1, Math.round(periodY)), seed)
    : valueNoise2(rx, ry, seed);
}
