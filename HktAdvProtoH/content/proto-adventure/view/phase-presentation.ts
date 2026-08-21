// Phase Presentation (C019) — 기술의 구간과 끊김을 어떻게 보일지 결정한다 (결정 Layer 데이터).
//
// 세계가 보내는 것은 구간 값 하나(actionPhase)와 캔슬 사건 목록뿐이다. 그것을 화면에서
// 무엇으로 갈라 보일지는 여기서 정한다.
//
// 이 파일의 결정 셋.
//   1. **선딜은 몸 위에 붙는다** — 이름 앞의 한 표시다 (C018 의 관계 표시와 같은 자리).
//      플레이어가 그 순간 고르는 것은 "지금 넣을까 말까" 이고, 그 답을 정하는 것은
//      상대의 몸에서 읽히는 사실이다. HUD 로 올리면 눈이 몸에서 떠나고, 그러면
//      "보고 반응한다" 가 아니라 "숫자를 읽는다" 가 된다 (04 hud: NONE).
//   2. **판정·후딜에는 아무것도 붙이지 않는다** — 표시가 없다는 것이 곧 "이미 나갔다,
//      지금 넣어도 늦었다" 는 뜻이다. 세 구간을 다 표시하면 무엇이 기회인지가 흐려진다.
//   3. **캔슬은 끊긴 자리에 뜬다** — 타격 숫자·무산 사유와 같은 그리기 능력을 쓴다.
//      셋 다 "그 자리에서 잠시 떠오르는 한 줄" 이고 다른 것은 문구뿐이다.
//      이것이 없으면 화면에서 캔슬은 "그냥 맞았다" 와 구분되지 않는다.
//
// 세계가 보낸 값을 그대로 믿는다 — 진행도와 경계로 구간을 다시 계산하지 않는다.
// 경계는 기술마다 다르고 세계 안에만 있으므로, 복제하면 두 개의 진실이 생긴다
// (DC-WORLD-OWNS-THE-SURFACE-LIST).

import type { CancelEventView, EntityView } from '../protocol/gameview';
import type { SceneStrike } from '../../../engine/view-kernel/scene/scene-state';
import { codeText } from './code-text';

/** 세계가 보내는 구간 값 중 지금 끊을 수 있는 하나 */
const STARTUP = 'startup';

// 캔슬 문구가 뜨는 높이 — 타격 숫자·무산 사유와 같은 자리다
const CANCEL_ANCHOR_RATIO = 0.55;
const DEFAULT_SPRITE_SIZE = 2.5;

/** 지금 이 존재가 선딜 중인가 — 즉, 지금 넣은 개입이 그 기술을 없앨 수 있는가 */
export function isInStartup(entity: EntityView): boolean {
  return entity.actionPhase === STARTUP;
}

/**
 * 몸 위 이름에 붙는 선딜 표시. 선딜일 때만 붙인다 —
 * 판정·후딜에 붙이면 "지금이 기회다" 가 아니라 "무언가 하는 중이다" 가 되어,
 * 이 Cycle 이 만든 시점의 차이가 화면에서 사라진다.
 * 관계 표시(C018) 뒤, 이름 앞에 둔다: 어떤 사이인지가 먼저이고 그다음이 지금의 틈이다.
 */
export function startupMark(entity: EntityView): string {
  return isInStartup(entity) ? `${codeText(STARTUP)} ` : '';
}

/**
 * 선딜 중에 끊겨 사라진 기술 — 끊긴 몸의 자리에 뜬다.
 * 무엇이 끊겼는지를 함께 싣는다: 큰 기술이 끊긴 것과 기본 기술이 끊긴 것은 다른 사건이고,
 * 플레이어가 배워야 하는 것은 "큰 것을 끊었다" 는 사실이기 때문이다.
 */
export function cancelMark(cancel: CancelEventView, targetSpriteSize?: number): SceneStrike {
  return {
    id: `${cancel.attackerId}-cut->${cancel.targetId}@${cancel.since}`,
    position: cancel.at,
    text: `${codeText(cancel.skill)} ${codeText('cancelled')}`,
    emphasis: true, // 크게 그린다 — 일어나지 않게 만든 일이고, 그것이 플레이어가 한 일이다
    since: cancel.since,
    anchorHeight: (targetSpriteSize ?? DEFAULT_SPRITE_SIZE) * CANCEL_ANCHOR_RATIO,
  };
}
