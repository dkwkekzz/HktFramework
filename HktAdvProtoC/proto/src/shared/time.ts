// 시뮬레이션 시간 모델 (Phase 0 §0.1)
// 시간 단위는 정수 tick — 부동소수점 시간 금지 (결정론 보호).
export const TICKS_PER_MINUTE = 1;
export const TICKS_PER_HOUR = 60 * TICKS_PER_MINUTE;
export const TICKS_PER_DAY = 24 * TICKS_PER_HOUR; // 1440

export function tickToDay(tick: number): number {
  return Math.floor(tick / TICKS_PER_DAY);
}

export function tickToMinuteOfDay(tick: number): number {
  return tick % TICKS_PER_DAY;
}
