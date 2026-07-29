// seeded RNG — 결정 경로의 유일한 난수원 (02-architecture §5-2).
// Math.random 은 결정 경로에서 금지.

import { fnv1a32 } from "./hash.js";

/** mulberry32 — 32bit seed 로부터 [0,1) 스트림. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * scope 별 파생 seed — 호출 순서가 바뀌어도 scope 별 스트림이 안정.
 * 예: deriveSeed(project.seed, "blade/scratch")
 */
export const deriveSeed = (seed, scopeName) => ((seed >>> 0) ^ fnv1a32(scopeName)) >>> 0;
