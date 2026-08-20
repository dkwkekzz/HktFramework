// Relation Presentation (C018) — 둘 사이의 태도를 어떻게 보일지 결정한다 (결정 Layer 데이터).
//
// 세계가 보내는 것은 두 값(stanceTowardObserver · stanceFromObserver)과 무산의 사유 코드뿐이다.
// 무엇을 몸 위에 붙이고 무엇을 펼쳐야 보이게 할지는 여기서 정한다.
//
// 이 파일의 결정 셋.
//   1. **몸 위에는 관계 하나만** 붙인다 — 어느 한쪽이라도 적대면 "적대" 다.
//      플레이어가 그 자리에서 고르는 것은 "다가갈까 물러날까" 이고, 그 답을 정하는 것은
//      방향이 아니라 **둘 사이가 적대인가**이기 때문이다 (RULE-HARM-GATE-001 이 읽는 값과 같다).
//   2. **두 방향은 펼쳐야 보인다** — 속성 관찰(inspect)의 한 줄로 간다.
//      늘 띄우면 몸 위가 채워지고, 방향의 차이는 판단이 아니라 이해의 문제다.
//   3. **무산은 타격과 같은 자리에 뜨되 다른 문구다** — 빗나감은 아무것도 뜨지 않고,
//      무산은 맞은 자리에 사유가 뜬다. 둘을 같게 그리면 이 Cycle 의 절반이 사라진다
//      (04 VIEW REQUIREMENT 3).
//
// 세계가 보낸 코드를 그대로 믿는다 — 종류로도 조종 주체로도 태도를 짐작하지 않는다
// (DC-WORLD-OWNS-THE-SURFACE-LIST).

import type { AttributesView, UnharmedContactView } from '../protocol/gameview';
import type { SceneStrike } from '../../../engine/view-kernel/scene/scene-state';
import { codeText } from './code-text';

const HOSTILE = 'hostile';

// 무산 문구가 뜨는 높이 — 타격 숫자와 같은 자리다 (combat-presentation 의 기준을 따른다)
const CONTACT_ANCHOR_RATIO = 0.55;
const DEFAULT_SPRITE_SIZE = 2.5;

/** 둘 사이가 적대인가 — 어느 한쪽이라도 적대이면 참이다 (세계의 관문과 같은 읽기) */
export function isHostilePair(a: AttributesView | undefined): boolean {
  if (!a) return false;
  return a.stanceTowardObserver === HOSTILE || a.stanceFromObserver === HOSTILE;
}

/**
 * 몸 위 이름에 붙는 관계 표시. 적대일 때만 붙인다 —
 * 중립은 이 세계의 바탕이므로 표시하면 화면이 온통 표시로 찬다.
 * 이름 **앞**에 둔다: 무엇인지보다 어떤 사이인지가 먼저 읽혀야 다가갈지 물러날지를 고른다.
 */
export function stanceMark(a: AttributesView | undefined): string {
  return isHostilePair(a) ? `[${codeText(HOSTILE)}] ` : '';
}

/** 속성 관찰의 한 줄 — 두 방향을 따로 보인다 (방향값임이 여기서 드러난다) */
export function stanceLine(a: AttributesView): string {
  return `관계 ${codeText(a.stanceTowardObserver)}→나 · 나→${codeText(a.stanceFromObserver)}`;
}

/**
 * 닿았으나 성립하지 않은 접촉 — 맞은 자리에 사유가 뜬다.
 * 타격 숫자와 같은 그리기 능력을 쓴다. 새 capability 를 만들 이유가 없다 —
 * 둘 다 "그 자리에서 잠시 떠오르는 한 줄" 이고, 다른 것은 문구뿐이다.
 */
export function contactMark(
  contact: UnharmedContactView,
  targetSpriteSize?: number,
): SceneStrike {
  return {
    id: `${contact.attackerId}-x->${contact.targetId}@${contact.since}`,
    position: contact.at,
    text: codeText(contact.reason),
    emphasis: false, // 크게 그리지 않는다 — 일어나지 않은 일이다
    since: contact.since,
    anchorHeight: (targetSpriteSize ?? DEFAULT_SPRITE_SIZE) * CONTACT_ANCHOR_RATIO,
  };
}
