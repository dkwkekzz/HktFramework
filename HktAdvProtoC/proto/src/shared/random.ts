// 시드 RNG (Phase 0 §0.2, 기획서 §39 RandomContext)
// 전역 싱글턴 RNG 금지 — 확률이 필요한 모든 지점은 RandomContext 를 명시적으로 만들어 스트림을 얻는다.
// 같은 (worldSeed, simulationStep, entityId) 이면 호출 지점·순서와 무관하게 같은 난수열이 나온다.

export interface RandomContext {
  worldSeed: number;
  simulationStep: number;
  entityId?: string;
}

export interface Rng {
  /** [0, 1) 균등 */
  next(): number;
  /** [0, maxExclusive) 정수 */
  nextInt(maxExclusive: number): number;
  nextUint32(): number;
}

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const MASK64 = 0xffffffffffffffffn;

// splitmix64 — 시드 혼합 전용 (스트림 본체는 xoshiro128**)
function splitmix64(state: bigint): [bigint, bigint] {
  state = (state + 0x9e3779b97f4a7c15n) & MASK64;
  let z = state;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  z = z ^ (z >> 31n);
  return [state, z];
}

export function createRng(ctx: RandomContext): Rng {
  const entityHash = ctx.entityId === undefined ? 0 : fnv1a(ctx.entityId);
  let seed =
    (BigInt.asUintN(64, BigInt(Math.trunc(ctx.worldSeed))) ^
      (BigInt.asUintN(64, BigInt(Math.trunc(ctx.simulationStep))) << 20n) ^
      (BigInt(entityHash) << 44n)) &
    MASK64;

  // xoshiro128** 상태 4워드를 splitmix64 로 채운다
  let z: bigint;
  [seed, z] = splitmix64(seed);
  let s0 = Number(z & 0xffffffffn) | 0;
  let s1 = Number(z >> 32n) | 0;
  [seed, z] = splitmix64(seed);
  let s2 = Number(z & 0xffffffffn) | 0;
  let s3 = Number(z >> 32n) | 0;
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1; // 전부 0 인 상태 금지

  const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) | 0;

  const nextUint32 = (): number => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9);
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result >>> 0;
  };

  return {
    nextUint32,
    next: () => nextUint32() / 0x100000000,
    nextInt: (maxExclusive: number) => (maxExclusive <= 0 ? 0 : nextUint32() % maxExclusive),
  };
}
