/**
 * 결정적 시계.
 *
 * 시간은 틱으로만 흐른다. `Date.now()` · `new Date()` · `performance.now()` 를 읽지 않으므로
 * 같은 입력을 언제 재생하든 같은 시각이 나온다 (GI-12).
 * 실시간 주기(원문 30장의 60Hz/20Hz/10Hz…)는 이 틱을 소비하는 쪽이 정한다.
 */
export class TickClock {
  readonly startTick: number;
  readonly msPerTick: number;
  #tick: number;

  constructor(options: { startTick?: number; msPerTick?: number } = {}) {
    const startTick = options.startTick ?? 0;
    const msPerTick = options.msPerTick ?? 100; // 10Hz — 원문 30장의 "전투·능력 규칙" 주기
    if (!Number.isInteger(startTick) || startTick < 0) {
      throw new RangeError(`startTick 은 0 이상의 정수여야 한다: ${startTick}`);
    }
    if (!Number.isFinite(msPerTick) || msPerTick <= 0) {
      throw new RangeError(`msPerTick 은 0 보다 큰 수여야 한다: ${msPerTick}`);
    }
    this.startTick = startTick;
    this.msPerTick = msPerTick;
    this.#tick = startTick;
  }

  get tick(): number {
    return this.#tick;
  }

  /** 시뮬레이션 시각(ms). 벽시계가 아니라 틱에서 계산한다. */
  get timeMs(): number {
    return this.timeAt(this.#tick);
  }

  timeAt(tick: number): number {
    return tick * this.msPerTick;
  }

  /** 틱을 진행하고 새 틱을 돌려준다. 뒤로 가거나 건너뛰지 않는다. */
  advance(ticks = 1): number {
    if (!Number.isInteger(ticks) || ticks < 1) {
      throw new RangeError(`advance 는 1 이상의 정수여야 한다: ${ticks}`);
    }
    this.#tick += ticks;
    return this.#tick;
  }

  /** 진행 이력 — Lab 에서 시간이 어떻게 흘렀는지 보여 줄 때 쓴다. */
  timeline(ticks: number): { tick: number; timeMs: number }[] {
    if (!Number.isInteger(ticks) || ticks < 0) {
      throw new RangeError(`timeline 의 길이는 0 이상의 정수여야 한다: ${ticks}`);
    }
    return Array.from({ length: ticks }, (_unused, index) => {
      const tick = this.#tick + index;
      return { tick, timeMs: this.timeAt(tick) };
    });
  }

  snapshot(): ClockSnapshot {
    return { tick: this.#tick, startTick: this.startTick, msPerTick: this.msPerTick };
  }

  static restore(snapshot: ClockSnapshot): TickClock {
    const clock = new TickClock({ startTick: snapshot.startTick, msPerTick: snapshot.msPerTick });
    clock.#tick = snapshot.tick;
    return clock;
  }
}

export interface ClockSnapshot {
  tick: number;
  startTick: number;
  msPerTick: number;
}
