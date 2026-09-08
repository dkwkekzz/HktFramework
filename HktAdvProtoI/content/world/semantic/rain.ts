// World Semantic — Rain (C022 ADDED)
//
// 세계에 **비**가 선다. 날씨 체계가 아니다 (L2-World-Time §5 · Play 확정 4) — 구름도 바람도
// 지역마다 다른 비도 없다. 있는 것은 물음 하나뿐이다: **지금 비가 오는가.**
//
// **세계 State 가 아니다.** 저장되지 않고 스냅샷에도 실리지 않는다 — 시계(C015)가 낮밤과
// 철을 세계 시각에서 유도하는 그 자리와 같은 갈래의 유도된 사실이고, 그래서 되살린 세계도
// 같은 시각에서 같은 답을 낸다. STATE_VERSION 도 이 파일 때문에 오르지 않는다.
//
// **관찰자와 무관하다** (spec R1 경계 ①) — 몸이 하나도 없어도 비는 오고 그친다.
// **온 세계에 같이 온다** (SPEC-006 경계 ②) — 방을 묻지 않는다. 시계가 세계에 하나인 것과
// 같은 이유다 (Time 원칙 T1).
//
// **땅 · 표면 · 통행 · 관찰 범위를 한 값도 바꾸지 않는다** (R1 경계 ②) — 이 파일이 하는 일은
// 답 하나를 내는 것까지이고, 그것을 읽는 자리는 지금 결속의 요구 하나뿐이다 (semantic/life.ts).
//
// **규칙은 철의 이름을 알지 못한다** (Time T4 · C016 R1 이 세운 규율) — 아래 표는 **데이터**이고,
// 여기가 하는 일은 시계가 낸 지금 철을 그 표의 열쇠로 맞춰 보는 것뿐이다
// (source-recovery.ts 의 배속 표 · region-phase.ts 의 isSeasonListed 가 하는 그대로).

import {
  CYCLE_SECONDS,
  DAY_TOTAL_SECONDS,
  seasonAt,
} from './clock';
import type { WorldClockView } from '../../protocol/gameview';

type Season = WorldClockView['season'];

/** 하루 안의 구간 하나 — [시작, 끝) 세계 초 */
type RainWindow = readonly [number, number];

/**
 * 철마다의 **하루 안의 비 구간** (Play 확정 4 · spec 기본형 ②) — 데이터다.
 *
 * 하루를 넷으로 나눈 90 초 구간을 쓴다. 스밈에 잦고(둘) 고요에 하루 한 번, 긴 밤과 뒤척임에는
 * 없다 — 고요에도 한 번 두는 것은 "잦다" 가 견줄 것을 필요로 하기 때문이다.
 * 구간 하나(90)가 결속의 길이(60)보다 길다: 비 한 번 안에 결속이 다 찰 수 있는 값이다.
 *
 * 목록이 빈 철에는 비가 오지 않는다 — 없는 것을 지어내지 않는다.
 */
const RAIN_WINDOWS: Readonly<Record<Season, readonly RainWindow[]>> = {
  STILL: [[0, 90]],
  SEEP: [
    [0, 90],
    [180, 270],
  ],
  LONG_NIGHT: [],
  TURN: [],
};

/**
 * 하루(360 세계 초) 안의 지금 자리 — 낮밤을 가르는 그 계산과 **같은 것**이다.
 *
 * `dayPhaseAt` 은 그 철이 시작한 자리를 빼고 하루로 나눈 나머지를 쓴다. 네 철이 시작하는
 * 자리는 전부 하루의 배수이므로(고요 0 · 스밈 1080 · 긴 밤 1800 · 뒤척임 2160 = 3 · 5 · 6 일)
 * 빼고 나누는 것과 그냥 나누는 것이 한 값도 다르지 않다 — 그래서 여기는 철을 묻지 않는다.
 *
 * 세계 시각은 0 에서 시작해 오르기만 하지만, 음수가 들어와도 한 바퀴 안으로 접어 답한다
 * (clock.ts 의 cyclePhase · isFlowActive 가 하는 그대로).
 */
function withinDayAt(time: number): number {
  const phase = ((time % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  return phase % DAY_TOTAL_SECONDS;
}

/**
 * RULE-RAIN-001 (C022 ADDED · spec R1) — **지금 비가 오는가.**
 *
 * IF   지금 철이 밝힌 비 구간이 있고, 하루 안의 지금 자리가 그 구간 안이다 → 온다
 * ELSE 오지 않는다.
 *
 * 시각 하나에서 답이 나온다 — 저장할 것이 없고 관찰자를 묻지 않는다.
 */
export function isRainingAt(time: number): boolean {
  const windows = RAIN_WINDOWS[seasonAt(time)];
  if (windows.length === 0) return false;
  const within = withinDayAt(time);
  return windows.some(([from, to]) => within >= from && within < to);
}
