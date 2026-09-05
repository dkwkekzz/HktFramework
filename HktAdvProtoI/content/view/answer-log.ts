// Answer Log — 세계가 나에게 한 말이 **판에 남는** 자리 (C028 ADDED · spec R4).
//
// place-reading.ts · being-reading.ts 의 형제다. 세계에 아무것도 묻지 않는다 (SPEC-009 —
// 패킷도 왕복도 0): 여기 오는 것은 전부 **이미 관찰자 손에 도착해 있던** 말이다.
//   거절 사유   Request.Outcome { accepted · reason } — 요청마다 돌아온다 (봉투의 것이 아니다)
//   세계의 알림  방에 들어선 제목(C026) · 길이 바뀌었다(C008) · 이어짐이 끊겼다
//   언제인가    봉투의 세계 시각 (hud world.time — strikes.since 가 나이를 재는 그 값)
//
// 모으는 것은 **조립(app)의 일이다** (R1 · R2 · R3 — 관찰자가 쥔다). 이 파일은 모아 둔 것을
// 판의 줄로 옮기기만 한다: 무엇을 어떤 차례로 세우고, 얼마 전 일인지를 무슨 말로 적는가.
//
// 그리고 **없는 것은 자리째 없다.** 세계 시각을 모르면 때를 지어내지 않고, 모아 둔 것이
// 없으면 빈 줄이 아니라 빈 목록을 낸다 (place-reading 의 규칙 State 와 같은 규율).

import type { SceneFrameLogLine } from '../../engine/view-kernel/scene/scene-state';
import { codeText } from './code-text';

/**
 * 관찰자가 모아 둔 세계의 말 하나 — **조립(app)이 쥔다** (spec State: 세계 밖이다).
 *
 * 형식화 전의 것이 아니라 **이미 사람이 읽을 말**이다: 사유 코드를 문구로 옮기는 것은
 * 말이 도착한 그 자리(조립의 대답 처리)가 code-text 로 하고, 여기서 다시 옮기지 않는다.
 * 같은 사유가 뜨는 문구와 남는 줄에서 다른 말로 적히면 둘 중 하나를 믿을 수 없다 (SPEC-008).
 */
export interface KeptAnswer {
  /** 세계가 한 말 (형식화 완료) */
  text: string;
  /** 그 일이 있었던 세계 시각 */
  at: number;
}

/**
 * 판에 남는 줄 수의 상한 — **다섯이다** (spec UNRESOLVED "기록의 상한" · R3 · SPEC-005).
 *
 * Play 는 "방금 무슨 일이 있었나" 라고만 하므로 수는 표현이 정한다. 다섯인 근거 셋:
 *
 *  ① 판이 대상의 답이기를 그만두지 않는 선. 자리 판이 가장 많이 질 때 줄이 아홉이다
 *     (방 · 깊이 · 땅 · 통행 · 막는 것 · 구역 · 통로 · 지금 길 · 압력). 기록이 그보다 길면
 *     판은 "지금 무엇을 보고 있나" 가 아니라 기록판이 된다. 다섯은 그 절반 남짓이다.
 *  ② 판이 화면을 삼키지 않는 선. 판의 한 줄은 12.5px × 1.5 ≒ 18.8px 다 (index.html 의
 *     `.tf-panel` · `.tf-row`). 최악의 경우(아홉 줄 + 다섯 줄 + 제목 · 곁제목 · 여백)에도
 *     판의 아래끝은 화면 위 350px 남짓이고, 세로 720px 화면에서 **절반을 넘지 않는다**.
 *  ③ 되짚기에 필요한 최소. 한 번 막히는 동안 이어지는 말 묶음 — 방에 들어섬 → 못 지나감 →
 *     다시 시도 → 길이 바뀜 — 이 네댓 줄이므로, 다섯이면 그 **한 묶음이 통째로** 남는다.
 *
 * 이 값이 맞는지는 Human 의 눈이 판정한다 (TODO 의 감사 항목).
 */
export const ANSWER_LOG_LIMIT = 5;

/** 나이를 적는 말의 코드 — 기록 줄과 규칙 줄이 **같은 것 하나**를 쓴다 */
const AGO_TEXT_CODE = 'ago.seconds';

/**
 * RULE-ANSWER-READING-001 — 모아 둔 말 → 판의 기록 줄 (spec R4 · SPEC-003 · SPEC-004).
 *
 * 조립은 **오래된 것부터** 쌓아 둔 채로 넘긴다. 새 것을 위에 세우는 것은 표현의 결정이므로
 * 여기서 뒤집는다 (SPEC-004). 줄마다 얼마 전 일인지가 함께 서고, 세계 시각을 모르거나
 * 아직 오지 않은 때면 **때를 적지 않는다** (SPEC-003 경계 — 나이를 지어내지 않는다).
 *
 * 상한도 여기서 한 번 더 지킨다. 미는 것은 조립의 일이지만(R3), 판이 화면을 삼키지 않는
 * 것은 표현의 책임이므로 **같은 상수 하나**로 둘 다 막는다 — 사본이 아니라 같은 값이다.
 *
 * 비면 **빈 목록**이다. 그때 판에 기록 자리가 아예 서지 않는 것은 resolve 가 정한다
 * (SPEC-006 경계 — 빈 기록판을 세우지 않는다).
 */
export function answerLogLines(
  kept: readonly KeptAnswer[],
  worldTime: number | undefined,
): SceneFrameLogLine[] {
  const lines: SceneFrameLogLine[] = [];
  const oldest = Math.max(0, kept.length - ANSWER_LOG_LIMIT);
  for (let i = kept.length - 1; i >= oldest; i--) {
    const one = kept[i]!;
    const when = agoText(one.at, worldTime);
    lines.push({ text: one.text, ...(when === undefined ? {} : { when }) });
  }
  return lines;
}

/**
 * 얼마 전 일인가 — 세계 시각으로 잰 나이 하나의 말 (spec UNRESOLVED "나이를 적는 어법").
 *
 * 세계 시각이 초이므로 초로 적는다 (strikes.since · rearrangedAt 이 나이를 재는 그 값과
 * 같은 단위다). 내림으로 적는 이유: 흐른 것보다 더 흘렀다고 말하지 않기 위해서다.
 *
 * **이 함수 하나가 나이를 적는 유일한 자리다.** 기록 줄도, 판의 규칙 줄에 실리는 마지막
 * 재배열도 여기를 부른다 — 같은 값이 두 자리에서 다르게 적히면 둘 중 하나를 믿을 수 없다.
 *
 * 모르면 undefined 다: 잰 값이 없거나(때를 모르는 말), 세계 시각이 없거나(봉투가 아직
 * 없다), 나이가 음수면(아직 오지 않은 때) **때를 지어내지 않는다** (SPEC-003 경계).
 */
export function agoText(at: number | undefined, worldTime: number | undefined): string | undefined {
  if (at === undefined || worldTime === undefined) return undefined;
  if (!Number.isFinite(at) || !Number.isFinite(worldTime)) return undefined;
  const elapsed = worldTime - at;
  if (elapsed < 0) return undefined;
  return codeText(AGO_TEXT_CODE, String(Math.floor(elapsed)));
}
