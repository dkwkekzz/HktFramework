// V1 Seeded Random — core 안의 유일한 난수원. Math.random() 사용 금지.
// 난수 상태는 값(state)이며, 뽑을 때마다 새 상태를 함께 돌려준다:
//   (상태) → (새 상태, 값)
// 덕분에 어느 시점의 난수 상태든 저장·복원·리플레이할 수 있다.

import { hashString } from './hash.ts';

/** 시드 — 문자열(권장, 의미가 드러남) 또는 32bit 정수. */
export type Seed = string | number;

/** 난수 상태. 4×uint32 (sfc32). 그대로 JSON 직렬화 가능. */
export interface RandomState {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

/** (새 상태, 뽑은 값) 쌍 — V1 의 모든 난수 함수가 이 형태를 지킨다. */
export type Draw<T> = readonly [RandomState, T];

function normalizeSeed(seed: Seed): number {
  if (typeof seed === 'number') {
    if (!Number.isInteger(seed)) {
      throw new RangeError(`숫자 시드는 정수여야 한다: ${String(seed)}`);
    }
    return seed >>> 0;
  }
  return hashString(seed);
}

/** 시드에서 난수 상태를 만든다. 같은 시드 → 항상 같은 상태. */
export function createRandom(seed: Seed): RandomState {
  const base = normalizeSeed(seed);
  // 시드 1개를 4개 워드로 흩뿌린다 — 상수는 서로 다른 홀수 hex 패턴이면 된다.
  const state: RandomState = {
    a: (base ^ 0x9e37_79b9) >>> 0,
    b: (base ^ 0x243f_6a88) >>> 0,
    c: (base ^ 0xb7e1_5162) >>> 0,
    d: (base ^ 0x8f1b_bcdc) >>> 0,
  };
  // 초기 편향 제거를 위해 12회 워밍업.
  let warm = state;
  for (let i = 0; i < 12; i += 1) {
    warm = nextUint32(warm)[0];
  }
  return warm;
}

/** 다음 uint32 를 뽑는다 (sfc32). */
export function nextUint32(state: RandomState): Draw<number> {
  const t = (state.a + state.b) >>> 0;
  const a = (state.b ^ (state.b >>> 9)) >>> 0;
  const b = (state.c + (state.c << 3)) >>> 0;
  const c = (((state.c << 21) | (state.c >>> 11)) + t) >>> 0;
  const d = (state.d + 1) >>> 0;
  const value = (t + d) >>> 0;
  return [{ a, b, c, d }, value];
}

/** [0, 1) 실수. */
export function nextFloat(state: RandomState): Draw<number> {
  const [next, value] = nextUint32(state);
  return [next, value / 0x1_0000_0000];
}

/** [minInclusive, maxExclusive) 정수. 범위가 비면 거부한다. */
export function nextInt(
  state: RandomState,
  minInclusive: number,
  maxExclusive: number,
): Draw<number> {
  if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
    throw new RangeError('nextInt 의 경계는 정수여야 한다');
  }
  if (maxExclusive <= minInclusive) {
    throw new RangeError(
      `빈 범위에서는 뽑을 수 없다: [${String(minInclusive)}, ${String(maxExclusive)})`,
    );
  }
  const span = maxExclusive - minInclusive;
  const [next, value] = nextUint32(state);
  return [next, minInclusive + (value % span)];
}

/** 배열에서 하나 고른다. 빈 배열은 거부한다. */
export function pick<T>(state: RandomState, items: readonly T[]): Draw<T> {
  if (items.length === 0) {
    throw new RangeError('빈 배열에서는 고를 수 없다');
  }
  const [next, index] = nextInt(state, 0, items.length);
  return [next, items[index] as T];
}

/** Fisher-Yates 셔플 — 원본을 바꾸지 않고 새 배열을 돌려준다. */
export function shuffle<T>(state: RandomState, items: readonly T[]): Draw<T[]> {
  const result = [...items];
  let current = state;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const [next, j] = nextInt(current, 0, i + 1);
    current = next;
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return [current, result];
}

/**
 * 하위 난수 스트림을 분기한다.
 * 같은 부모 상태 + 같은 라벨 → 항상 같은 하위 스트림.
 * 주체별·모듈별로 난수를 나눠 써도 서로의 소비 횟수에 영향받지 않게 한다.
 */
export function split(state: RandomState, label: string): RandomState {
  const mix = hashString(`${String(state.a)}:${String(state.b)}:${String(state.c)}:${String(state.d)}:${label}`);
  return createRandom(mix);
}
