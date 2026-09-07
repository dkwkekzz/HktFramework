// World Semantic — Clock (C015 ADDED)
//
// 세계에 **때**가 선다. 낮밤 · 철 · 며칠째 · 몇 바퀴째 넷은 전부 이미 흐르고 있는 세계 시각
// (RULE-WORLD-TICK-001 이 dt 를 쌓는 `state.time`)에서 **유도된다.**
//
// **세계 State 가 아니다.** 저장되지 않고 스냅샷에도 실리지 않는다 — 같은 시각은 언제나 같은
// 때이므로 되살린 세계도 같은 답을 낸다 (C014 의 물길 주기 `isFlowActive` 와 같은 갈래의
// 유도된 사실 · semantic/resource.ts). 그래서 STATE_VERSION 도 오르지 않는다.
//
// **관찰자와 무관하다** (spec R1 경계 ①) — 몸이 하나도 없어도, 아무도 보고 있지 않아도
// t 는 흐르고 때는 그것에서 나온다. 시계는 Region 이 아니라 **세계에 하나**다 (Time 원칙 T1).
//
// 길이 값들을 여기 헤더 상수로 두는 이유 — 회복의 길이(D3)가 원천마다 다른 **세계 데이터**
// (content/regions)였던 것과 달리, 하루와 철의 길이는 세계에 하나뿐인 시뮬레이션 상수이고
// 결정론에 직접 영향을 준다 (원칙 6). 이 파일이 그 값들의 유일한 출처다.

import type { WorldClockView } from '../../protocol/gameview';

// 하루 — 낮으로 시작해 밤으로 끝난다 (Play 확정 3)
export const DAY_SECONDS = 240; // 낮의 길이
export const NIGHT_SECONDS = 120; // 밤의 길이
export const DAY_TOTAL_SECONDS = DAY_SECONDS + NIGHT_SECONDS; // 하루 360

// 철 넷의 길이 — 순서대로 돈다 (Play 확정 1 · 3)
export const STILL_DAYS = 3; // 고요   1080 초
export const SEEP_DAYS = 2; // 스밈    720 초
export const LONG_NIGHT_DAYS = 1; // 긴 밤  360 초 — 그 하루가 전부 밤이다
export const TURN_SECONDS = 60; // 뒤척임  60 초 — 낮(새벽)이고, 하루로 세지 않는다

export const STILL_SECONDS = STILL_DAYS * DAY_TOTAL_SECONDS; // 1080
export const SEEP_SECONDS = SEEP_DAYS * DAY_TOTAL_SECONDS; // 720
export const LONG_NIGHT_SECONDS = LONG_NIGHT_DAYS * DAY_TOTAL_SECONDS; // 360

// 한 바퀴 2220 초 · 그 안에서 시작되는 하루 6 개 (고요 3 + 스밈 2 + 긴 밤 1)
export const CYCLE_SECONDS = STILL_SECONDS + SEEP_SECONDS + LONG_NIGHT_SECONDS + TURN_SECONDS;
export const CYCLE_DAYS = STILL_DAYS + SEEP_DAYS + LONG_NIGHT_DAYS;

// 한 바퀴 안에서 각 철이 시작하는 자리 (초)
const STILL_AT = 0;
const SEEP_AT = STILL_SECONDS; // 1080
const LONG_NIGHT_AT = SEEP_AT + SEEP_SECONDS; // 1800
const TURN_AT = LONG_NIGHT_AT + LONG_NIGHT_SECONDS; // 2160

type Season = WorldClockView['season'];
type DayPhase = WorldClockView['dayPhase'];

/**
 * RULE-WORLD-CLOCK-001 (C015 ADDED · spec R1) — 한 바퀴 안의 자리.
 *
 * 세계 시각을 한 바퀴(2220)로 나눈 나머지다. 세계 시각은 0 에서 시작해 오르기만 하지만,
 * 음수가 들어와도 한 바퀴 안으로 접어 답한다 (isFlowActive 가 하는 그대로).
 */
function cyclePhase(time: number): number {
  return ((time % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
}

/**
 * RULE-WORLD-CLOCK-001 (C015 ADDED · spec R1) — 지금은 어느 철인가.
 *
 * 한 바퀴 안의 자리가 어느 구간에 드는가로 정해진다 —
 * [0, 1080) 고요 · [1080, 1800) 스밈 · [1800, 2160) 긴 밤 · [2160, 2220) 뒤척임.
 * 철은 건너뛰지 않고 한 바퀴에 네 철이 모두 한 번씩 온다 (SPEC-002 경계 ②).
 */
export function seasonAt(time: number): Season {
  const p = cyclePhase(time);
  if (p < SEEP_AT) return 'STILL';
  if (p < LONG_NIGHT_AT) return 'SEEP';
  if (p < TURN_AT) return 'LONG_NIGHT';
  return 'TURN';
}

/**
 * RULE-WORLD-CLOCK-001 (C015 ADDED · spec R1) — 지금은 낮인가 밤인가.
 *
 * 그 철 안에서 하루(360) 안의 자리가 240 보다 작으면 낮, 아니면 밤이다.
 * 단 **긴 밤은 언제나 밤**이고(그 하루 360 초가 전부 밤이다 · SPEC-003),
 * **뒤척임은 언제나 낮**이다(그 60 초는 다음 하루의 새벽이다 · SPEC-003 경계 ②).
 */
export function dayPhaseAt(time: number): DayPhase {
  const season = seasonAt(time);
  if (season === 'LONG_NIGHT') return 'NIGHT';
  if (season === 'TURN') return 'DAY';
  const p = cyclePhase(time);
  const start = season === 'STILL' ? STILL_AT : SEEP_AT;
  const withinDay = (p - start) % DAY_TOTAL_SECONDS;
  return withinDay < DAY_SECONDS ? 'DAY' : 'NIGHT';
}

/**
 * RULE-WORLD-CLOCK-001 (C015 ADDED · spec R1) — 세계의 때 넷을 한 번에 낸다.
 *
 * seasonCycle 은 몇 바퀴째인가(floor(t / 2220))이고, dayIndex 는 **세계가 선 뒤 시작된
 * 하루의 수**다 — 그 바퀴에서 시작된 하루의 수(고요 3 · 스밈 2 · 긴 밤 1)를 바퀴 수에 얹는다.
 * 뒤척임 동안의 dayIndex 는 6, 곧 **다음 바퀴 첫 하루의 값과 같다** — 뒤척임이 그 하루의
 * 새벽이기 때문이다 (spec R1 경계 ③).
 *
 * 싣는 것은 이 넷뿐이다 — 철이 언제 시작했고 언제 끝나는지 · 남은 시간 · 다음 철은 어디에도
 * 없다. "언제" 는 관찰자가 하늘과 흙과 이 값의 변화를 보고 배우는 것이다 (spec Observable · T8).
 */
export function worldClockAt(time: number): WorldClockView {
  const p = cyclePhase(time);
  const season = seasonAt(time);
  const seasonCycle = Math.floor(time / CYCLE_SECONDS);

  // 그 바퀴에서 지금까지 시작된 하루의 수
  const daysStarted =
    season === 'STILL'
      ? Math.floor((p - STILL_AT) / DAY_TOTAL_SECONDS)
      : season === 'SEEP'
        ? STILL_DAYS + Math.floor((p - SEEP_AT) / DAY_TOTAL_SECONDS)
        : season === 'LONG_NIGHT'
          ? STILL_DAYS + SEEP_DAYS
          : CYCLE_DAYS; // 뒤척임 — 다음 바퀴 첫 하루의 값

  return {
    dayPhase: dayPhaseAt(time),
    season,
    dayIndex: seasonCycle * CYCLE_DAYS + daysStarted,
    seasonCycle,
  };
}

/**
 * 검증용 손잡이 — 그 철(·낮밤)이 **시작하는** 세계 시각 (C015 ADDED).
 *
 * WorldSetup.clock 이 받는 `"LONG_NIGHT"` · `"SEEP:NIGHT"` 같은 값을 시각으로 옮긴다.
 * 세운 시각은 세계가 스스로 흘러 닿는 값이고 **세계의 규칙을 하나도 바꾸지 않는다**
 * (regionPatterns · sourcePhases 와 같은 갈래 · index.ts 의 손잡이 규율).
 *
 * 모르는 철 이름 · 모르는 낮밤 이름 · **그 철에 오지 않는 낮밤**(긴 밤의 낮 · 뒤척임의 밤)은
 * 조용히 무시한다(null) — 손잡이가 세계에 없는 때를 지어내지 않는다.
 */
export function clockSetupTime(spec: string | undefined): number | null {
  if (!spec) return null;
  const [seasonName, phaseName] = spec.trim().split(':');
  const start =
    seasonName === 'STILL'
      ? STILL_AT
      : seasonName === 'SEEP'
        ? SEEP_AT
        : seasonName === 'LONG_NIGHT'
          ? LONG_NIGHT_AT
          : seasonName === 'TURN'
            ? TURN_AT
            : null;
  if (start === null) return null;
  if (phaseName === undefined) return start;
  if (phaseName !== 'DAY' && phaseName !== 'NIGHT') return null;
  // 그 철의 첫 하루가 그 낮밤으로 들어서는 자리. 긴 밤에 낮은, 뒤척임에 밤은 오지 않는다.
  if (seasonName === 'LONG_NIGHT') return phaseName === 'NIGHT' ? start : null;
  if (seasonName === 'TURN') return phaseName === 'DAY' ? start : null;
  return phaseName === 'DAY' ? start : start + DAY_SECONDS;
}
