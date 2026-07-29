// padding 확장(dilate) — mipmap seam 번짐 방지 (원본 §19, 05-phase3 §3.5).
// 커버리지 기반 1픽셀 확장 × N회. 아일랜드 간 침범 방지: 다른 아일랜드가 이미 쓴 텍셀엔
// 쓰지 않고, 확장 시 island 버퍼도 함께 기록한다.

/**
 * @param channels {{name: Float32Array}[]} — 같은 커버리지를 공유하는 채널들
 *        stride: 채널별 픽셀당 요소 수 (color/normal=4, 스칼라=1)
 */
export function dilateChannels(channels, size, coverage, island, iterations) {
  let cov = coverage.slice();
  let isl = island.slice();
  const OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

  for (let iter = 0; iter < iterations; iter++) {
    const nextCov = cov.slice();
    const nextIsl = isl.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        if (cov[idx]) continue;
        // 채워진 이웃 탐색 (결정적 순서 — OFFSETS 고정)
        let src = -1, srcIsland = -1;
        for (const [ox, oy] of OFFSETS) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const nidx = ny * size + nx;
          if (cov[nidx]) { src = nidx; srcIsland = isl[nidx]; break; }
        }
        if (src < 0) continue;
        for (const ch of channels) {
          const s = ch.stride;
          for (let k = 0; k < s; k++) ch.data[idx * s + k] = ch.data[src * s + k];
        }
        nextCov[idx] = 1;
        nextIsl[idx] = srcIsland;
      }
    }
    cov = nextCov;
    isl = nextIsl;
  }
  return { coverage: cov, island: isl };
}
