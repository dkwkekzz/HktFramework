// Mark Presentation — 그 몸에 붙어 있는 표식을 어떻게 보이게 하는가
// (C-COMBAT-004, 결정 Layer 데이터).
//
// **여기서 하는 판정은 하나도 없다.** 언제까지 붙어 있는지도, 그것이 무엇을 여는지도
// 묻지 않는다 — 세계가 "지금 붙어 있는 것" 만 실어 보내므로 화면은 그것을 옮긴다
// (DC-WORLD-OWNS-THE-SURFACE-LIST · 04 entities.character.attributes.marks).
//
// 자리를 둘로 가르는 기준은 태도(C018) · 배분(C-COMBAT-001) 이 이미 세운 것과 같다.
//
//   몸 위    **붙었는가** 하나 — 교전 중에 눈으로 스치며 읽는 것
//   펼침     **누가 남겼는가** — 켜고 읽는 것 (속성 관찰)
//
// 몸 위에 남긴 자의 이름까지 붙이면 이름줄이 길어진다. C025 가 기술 띠에서 실측으로
// 배운 것과 같은 자리다 — 짧은 표기는 위로, 긴 것은 아래로.

import type { AttributesView, BorneMarkView } from '../protocol/gameview';
import { codeText } from './code-text';

/** 몸 위 표기 — 붙어 있으면 하나, 없으면 아무것도 (없다는 것이 곧 관찰이다) */
export function markMark(a: AttributesView | undefined): string {
  return a && a.marks.length > 0 ? '◈' : '';
}

/**
 * 속성 관찰의 한 줄 — **누가** 남겼는가.
 *
 * 언제까지인지는 쓰지 않는다 — 세계가 싣지 않았고, 화면이 시계를 들고 규칙을
 * 복제할 자리도 없다 (04 OBSERVABLE CLOSURE).
 * 남긴 시각(`since`)은 오지만 그것은 *일어난 일*이지 남은 시간이 아니다.
 */
export function markLine(marks: readonly BorneMarkView[]): string {
  if (marks.length === 0) return `표식 ${codeText('mark.none')}`;
  return `표식 ${marks.map((m) => m.byId).join(' · ')}`;
}
