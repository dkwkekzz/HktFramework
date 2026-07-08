// ============================================================================
// 결정론 PRNG (mulberry32) — 서버·클라가 같은 시드에서 같은 월드를 유도한다.
// 저장 최소화 트릭의 근거: 월드 배치는 동기화하지 않고 시드만 공유.
// ============================================================================

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
