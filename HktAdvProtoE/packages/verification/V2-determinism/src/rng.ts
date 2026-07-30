import { deriveChildSeed, MASK64, type SeedComponents } from './seed.js';
import { deriveSeed } from './seed.js';

/**
 * 결정적 난수 스트림 (SplitMix64).
 *
 * `Math.random` 을 쓰지 않는다(원문 「23」). 64비트 정수 연산을 BigInt 로 하므로 엔진·플랫폼이 달라도
 * 같은 시드에서 같은 열이 나온다 — 브라우저 Lab 과 서버 리플레이가 같은 수를 봐야 하기 때문이다.
 */
export class Rng {
  /** 생성 당시의 시드. 소비량과 무관하므로 fork 의 기준으로 쓴다. */
  readonly seed: bigint;
  #state: bigint;
  #drawn = 0;

  constructor(seed: bigint) {
    this.seed = seed & MASK64;
    this.#state = this.seed;
  }

  /** 원문 29장의 조합 규칙으로 스트림을 연다. */
  static fromComponents(components: SeedComponents): Rng {
    return new Rng(deriveSeed(components));
  }

  /** 지금까지 뽑은 횟수 — 증거·디버깅용. */
  get drawn(): number {
    return this.#drawn;
  }

  /** 다음 64비트 정수. 모든 다른 뽑기는 이것 위에 있다. */
  nextU64(): bigint {
    this.#state = (this.#state + 0x9e3779b97f4a7c15n) & MASK64;
    let z = this.#state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    z = z ^ (z >> 31n);
    this.#drawn += 1;
    return z & MASK64;
  }

  nextU32(): number {
    return Number(this.nextU64() >> 32n);
  }

  /** [0, 1) 실수. 상위 53비트만 써서 IEEE754 배정도에서 정확히 표현된다. */
  nextFloat(): number {
    return Number(this.nextU64() >> 11n) / 9007199254740992; // 2^53
  }

  /**
   * [min, max) 정수. 나머지 연산의 치우침을 거절 표집으로 없앤다 —
   * 치우친 난수는 시뮬레이션 결과를 조용히 왜곡한다.
   */
  nextInt(minInclusive: number, maxExclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
      throw new TypeError('nextInt 의 범위는 정수여야 한다.');
    }
    if (maxExclusive <= minInclusive) {
      throw new RangeError(`빈 범위다: [${minInclusive}, ${maxExclusive})`);
    }
    const range = BigInt(maxExclusive - minInclusive);
    const limit = (MASK64 / range) * range; // 이 값 이상은 버린다
    let candidate = this.nextU64();
    while (candidate >= limit) candidate = this.nextU64();
    return minInclusive + Number(candidate % range);
  }

  /** 목록에서 하나. 빈 목록은 오류다 — 조용히 undefined 를 돌려주지 않는다. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('빈 목록에서는 고를 수 없다.');
    return items[this.nextInt(0, items.length)] as T;
  }

  /** 새 배열을 돌려준다 — 입력을 바꾸지 않는다 (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = this.nextInt(0, i + 1);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /** 가중 선택. 가중치는 0 이상이어야 하고 합이 0 이면 오류다. */
  weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    if (entries.length === 0) throw new RangeError('빈 목록에서는 고를 수 없다.');
    let total = 0;
    for (const entry of entries) {
      if (!Number.isFinite(entry.weight) || entry.weight < 0) {
        throw new RangeError(`가중치는 0 이상의 유한한 수여야 한다: ${entry.weight}`);
      }
      total += entry.weight;
    }
    if (total <= 0) throw new RangeError('가중치 합이 0 이다.');

    let threshold = this.nextFloat() * total;
    for (const entry of entries) {
      threshold -= entry.weight;
      if (threshold < 0) return entry.value;
    }
    // 부동소수 오차로 끝까지 왔을 때의 마지막 후보
    return (entries[entries.length - 1] as { value: T }).value;
  }

  /**
   * 이름표로 하위 스트림을 연다.
   *
   * **소비량이 아니라 생성 시드에서** 파생하므로, 부모가 몇 번 뽑았든 같은 이름표는 같은 하위 스트림이다.
   * 새 소비자를 추가해도 기존 소비자의 열이 바뀌지 않는다.
   */
  fork(label: string): Rng {
    return new Rng(deriveChildSeed(this.seed, label));
  }

  /** 상태 스냅샷 — K3(event-replay)가 중간 지점부터 재생할 때 쓴다. */
  snapshot(): RngSnapshot {
    return { seed: this.seed.toString(), state: this.#state.toString(), drawn: this.#drawn };
  }

  static restore(snapshot: RngSnapshot): Rng {
    const rng = new Rng(BigInt(snapshot.seed));
    rng.#state = BigInt(snapshot.state) & MASK64;
    rng.#drawn = snapshot.drawn;
    return rng;
  }
}

export interface RngSnapshot {
  seed: string;
  state: string;
  drawn: number;
}
