import { sha256Hex } from '@hkt/v0-module-contract';
import { MASK64 } from './seed.js';

/**
 * 결정적 ID 발급기.
 *
 * UUID v4 처럼 난수 기반이면 재생할 때마다 id 가 달라져 사건 로그를 대조할 수 없다.
 * 여기서는 `시드 + 종류 + 종류별 순번` 을 해시해 만든다 — 같은 시드로 다시 돌리면 같은 id 가 나온다.
 *
 * 순번을 **종류별로** 세는 이유는 fork 와 같다. 새 종류의 id 를 발급하기 시작해도
 * 기존 종류의 id 열이 밀리지 않는다.
 */
export class IdFactory {
  readonly seed: bigint;
  readonly hexLength: number;
  #counters = new Map<string, number>();

  constructor(seed: bigint, options: { hexLength?: number } = {}) {
    const hexLength = options.hexLength ?? 12;
    if (!Number.isInteger(hexLength) || hexLength < 8 || hexLength > 64) {
      throw new RangeError(`hexLength 는 8~64 사이의 정수여야 한다: ${hexLength}`);
    }
    this.seed = seed & MASK64;
    this.hexLength = hexLength;
  }

  /** `<종류>_<해시>` 형태의 id. 종류는 소문자·숫자·밑줄만 쓴다. */
  next(kind: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(kind)) {
      throw new TypeError(`id 종류는 소문자로 시작하는 snake_case 여야 한다: ${JSON.stringify(kind)}`);
    }
    const ordinal = this.#counters.get(kind) ?? 0;
    this.#counters.set(kind, ordinal + 1);
    return `${kind}_${this.digest(kind, ordinal)}`;
  }

  /** 순번을 소비하지 않고 특정 순번의 id 를 계산한다 — 검증·대조용. */
  digest(kind: string, ordinal: number): string {
    return sha256Hex(`${this.seed.toString(16)}/${kind}/${ordinal}`).slice(0, this.hexLength);
  }

  /** 종류별 발급 횟수 (종류 오름차순). */
  issued(): { kind: string; count: number }[] {
    return [...this.#counters.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([kind, count]) => ({ kind, count }));
  }

  snapshot(): IdSnapshot {
    return { seed: this.seed.toString(), hexLength: this.hexLength, counters: this.issued() };
  }

  static restore(snapshot: IdSnapshot): IdFactory {
    const factory = new IdFactory(BigInt(snapshot.seed), { hexLength: snapshot.hexLength });
    for (const { kind, count } of snapshot.counters) factory.#counters.set(kind, count);
    return factory;
  }
}

export interface IdSnapshot {
  seed: string;
  hexLength: number;
  counters: { kind: string; count: number }[];
}
