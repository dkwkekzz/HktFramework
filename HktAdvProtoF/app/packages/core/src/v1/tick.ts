// V1 Tick Clock — core 안의 유일한 시간원. Date.now() 사용 금지.
// 시간은 단조 증가하는 정수 틱이며, 되돌릴 수 없다.

/** 세계 시간의 최소 단위. 0 이상의 정수. */
export type Tick = number;

/** 결정적 시계. 불변값이며 advance 는 새 시계를 돌려준다. */
export interface TickClock {
  /** 현재 틱 */
  readonly tick: Tick;
  /** 이 시계가 시작된 틱 (elapsed 계산 기준) */
  readonly startTick: Tick;
}

function assertTick(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} 은 0 이상의 정수여야 한다: ${String(value)}`);
  }
}

/** 시계를 만든다. */
export function createClock(startTick: Tick = 0): TickClock {
  assertTick(startTick, 'startTick');
  return { tick: startTick, startTick };
}

/** 틱을 delta 만큼 전진시킨 새 시계를 돌려준다. 뒤로 가거나 0 전진은 거부한다. */
export function advance(clock: TickClock, delta = 1): TickClock {
  if (!Number.isInteger(delta) || delta < 1) {
    throw new RangeError(`delta 는 1 이상의 정수여야 한다: ${String(delta)}`);
  }
  return { tick: clock.tick + delta, startTick: clock.startTick };
}

/** 시작 이후 경과 틱. */
export function elapsed(clock: TickClock): number {
  return clock.tick - clock.startTick;
}

/** 시계를 시작 틱으로 되감은 새 시계 (리플레이 전용). */
export function rewind(clock: TickClock): TickClock {
  return createClock(clock.startTick);
}
