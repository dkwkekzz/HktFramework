// 높이 필드 → 탄젠트 공간 Normal (원본 §20, 05-phase3 §3.5).
// 경계 샘플은 같은 아일랜드 내부로 클램프 — 아일랜드 밖 높이를 읽으면 seam 에 가짜 경사.
// 래스터 보간 축 = Atlas UV 축 = 탄젠트 축 (D-9) 이므로 화면 편미분이 곧 탄젠트 공간.

export function heightToNormal(height, size, { coverage, island }, strength) {
  const out = new Float32Array(size * size * 4);
  const sample = (x, y, fx, fy, isl) => {
    // 아일랜드 밖이면 기준 픽셀 값으로 클램프
    if (x < 0 || y < 0 || x >= size || y >= size) return height[fy * size + fx];
    const idx = y * size + x;
    if (!coverage[idx] || island[idx] !== isl) return height[fy * size + fx];
    return height[idx];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (!coverage[idx]) continue;
      const isl = island[idx];
      const left = sample(x - 1, y, x, y, isl);
      const right = sample(x + 1, y, x, y, isl);
      const down = sample(x, y - 1, x, y, isl);
      const up = sample(x, y + 1, x, y, isl);
      const dx = (right - left) * strength;
      const dy = (up - down) * strength;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      out[idx * 4] = -dx * invLen;
      out[idx * 4 + 1] = -dy * invLen;
      out[idx * 4 + 2] = invLen;
      out[idx * 4 + 3] = 1;
    }
  }
  return out;
}
