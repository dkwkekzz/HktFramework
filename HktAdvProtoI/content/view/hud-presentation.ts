// HUD Presentation — HUD 항목 id 의 표시(라벨·아이콘·토스트)를 결정한다
// (결정 Layer 데이터). id 당 단일 항목 — 미등록 id 는 id 그대로 표시된다.
//
// C027 CHANGED — 여기 남은 것은 **내 몸의 상태뿐이다** (spec R5 · SPEC-006).
// 세계의 사실(깊이 · 안전한 이유 · 압력)은 판이 진다 — 같은 사실이 두 자리에 적히지 않는다.
// 그 셋의 이름표는 판의 표(target-frame-presentation 의 PLACE_ROW_LABELS)가 이미 갖고 있다.
//
// C015 ADDED — 때 두 줄(때 · 철). 판으로 가지 않는 이유는 그것이 **대상 없는 전역 사실**
// 이기 때문이다: 판은 지목한 대상이 답하는 자리이고, 때는 어느 대상의 것도 아니다 —
// 세계 시간(world.time) · 함께(observers.present) 와 같은 자리다.

import type { WorldClockView } from '../protocol/gameview';
import { BIO_ORE, GIANT_TREE_FUNGUS, ORE_EATER_MOLT } from '../regions/index';
import { codeText } from './code-text';

export interface HudPresentation {
  label: string;
  icon?: string;
  celebrateGain?: boolean;
  format?: (value: number | boolean | string) => string; // 값 표시 형식
}

const HUD: Record<string, HudPresentation> = {
  // 지닌 재료 (C011) — **가진 것에만 자리가 있다** (spec SPEC-010: 0 을 지어내지 않는다).
  // 세계가 그 줄을 싣지 않으면 여기 항목이 있어도 화면에 서지 않는다.
  //
  // 아이콘이 없다 — 재료 표식을 만들지 않는다 (Play 확정 8 · spec SPEC-008). 이름표는
  // code-text 의 재료 이름 그대로다: 같은 재료가 판과 HUD 에서 다르게 불리면 그것이
  // 두 가지로 읽힌다. 캤을 때 뜨는 것(celebrateGain)은 광맥 줄의 어법 그대로 살린다 —
  // 손에 무엇이 들어왔는지가 그 순간에 읽혀야 한다 (Observable Result ⑦).
  [`inventory.${BIO_ORE}`]: { label: codeText(BIO_ORE), celebrateGain: true },
  [`inventory.${ORE_EATER_MOLT}`]: { label: codeText(ORE_EATER_MOLT), celebrateGain: true },
  // C014 ADDED — 세 번째 재료. 앞의 둘과 한 줄도 다르지 않다: 이름은 code-text 의 것이고
  // 아이콘은 없으며, 캤을 때 그 순간에 읽힌다
  [`inventory.${GIANT_TREE_FUNGUS}`]: { label: codeText(GIANT_TREE_FUNGUS), celebrateGain: true },
  'tool.hasMiningTool': { label: '곡괭이' },
  'player.action': { label: '행동' },
  'world.time': { label: '세계 시간', format: (v) => `${Math.floor(Number(v))}s` },
  // 함께 보고 있는 사람의 수 — 나를 포함한다.
  'observers.present': { label: '함께', icon: '👥', format: (v) => `${Number(v)}명` },
  // 세계의 때 두 줄 (C015 ADDED · SPEC-007). **세계가 싣는 줄이 아니다** — 봉투의
  // clock 에서 View 가 세운다 (원칙 2). 그래도 이름표는 다른 줄들과 같은 표에 둔다:
  // HUD 한 줄의 이름을 정하는 자리가 둘이 되면 규율이 갈린다.
  //
  // 둘 다 label 위젯이므로 형식 지시가 없다 — 값은 code-text 가 옮긴 말 그대로다.
  // 아이콘도 없다: 낮과 밤은 하늘이 이미 말하고 있고, 같은 것을 그림으로 한 번 더
  // 말하면 화면이 때를 두 번 설명한다
  'world.dayPhase': { label: '때' },
  'world.season': { label: '철' },
};

export function hudPresentation(id: string): HudPresentation {
  return HUD[id] ?? { label: id };
}

/**
 * 세계의 때 → HUD 두 줄의 (id · 의미 코드) — C015 SPEC-007.
 *
 * **때를 모르는 봉투에는 두 줄이 서지 않는다** (빈 줄로 지어내지 않는다 — C001 부터의
 * 폴백 규칙). 값이 문구가 되는 것은 다른 label 줄들과 같은 자리(codeText)에서 일어난다.
 *
 * `dayIndex` · `seasonCycle` 은 봉투에 있지만 **여기서 읽지 않는다** — 며칠째인지 몇
 * 바퀴째인지는 이 Cycle 의 화면이 말하지 않는 것이다 (spec SPEC-007 경계 ① · T8).
 */
export function clockHudEntries(
  clock: WorldClockView | undefined,
): readonly { id: string; code: string }[] {
  if (!clock) return [];
  return [
    { id: 'world.dayPhase', code: DAY_PHASE_CODES[clock.dayPhase] },
    { id: 'world.season', code: SEASON_CODES[clock.season] },
  ];
}

/** 낮밤 코드 → 문구 코드. 모르는 값은 코드 그대로 흘러가 화면에 드러난다 */
const DAY_PHASE_CODES: Readonly<Record<WorldClockView['dayPhase'], string>> = {
  DAY: 'clock.day',
  NIGHT: 'clock.night',
};

/** 철 코드 → 문구 코드. 철이 늘면 여기 한 줄과 code-text 한 줄이 는다 */
const SEASON_CODES: Readonly<Record<WorldClockView['season'], string>> = {
  STILL: 'clock.season.still',
  SEEP: 'clock.season.seep',
  LONG_NIGHT: 'clock.season.long-night',
  TURN: 'clock.season.turn',
};
