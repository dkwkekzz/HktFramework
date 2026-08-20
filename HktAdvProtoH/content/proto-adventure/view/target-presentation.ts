// Target Presentation — 고른 대상을 어떻게 보일지 결정한다 (C017, 결정 Layer 데이터).
//
// 세계는 Id 하나만 보낸다 (04 currentTarget). 이름도 생명도 사유도 이미 계약의 다른
// 자리에 와 있으므로, **한자리로 모으는 일은 여기서 한다** — 그것이 View 의 몫이고
// 세계가 보장한 것은 짐작 없이 모을 수 있다는 것뿐이다 (04 VIEW ASSEMBLY NOTE).
//
// 이 파일이 정하는 것은 셋이다.
//   ① 고른 존재를 어떻게 강조할 것인가 (색)
//   ② 대상 자리에 무엇을 몇 줄로 띄울 것인가
//   ③ 그 줄들의 문구 형식
// 무엇이 되고 무엇이 왜 안 되는지의 **판정**은 하나도 여기서 하지 않는다 —
// 전부 계약이 실어 온 available 과 reason 을 옮길 뿐이다
// (DC-WORLD-OWNS-THE-SURFACE-LIST).

import type { SceneHudItem } from '../../../engine/view-kernel/scene/scene-state';
import type { EntityView, GameViewSnapshot } from '../protocol/gameview';

/**
 * 고른 존재에 곱할 색. 역할이 정한 색(다른 관찰자 · NPC)을 이 색이 대신한다 —
 * "지금 고른 하나" 는 역할보다 앞서는 구분이기 때문이다.
 * 자리 비움의 탈색만은 이기지 않는다 (그것은 존재의 상태이지 내 선택이 아니다).
 */
export const TARGET_TINT = 0xffe066;

/** 고른 대상 자리에 실리는 HUD 항목의 id 들 — hud-presentation 이 라벨을 소유한다 */
export const TARGET_HUD_IDS = [
  'target.none',
  'target.name',
  'target.state',
  'target.health',
  'target.observe',
  'target.mine',
] as const;

/** 이 존재를 무엇이라 부를 것인가 — 이름이 없는 것(광맥)은 종류로 부른다 */
function targetName(entity: EntityView, text: (code: string) => string): string {
  if (entity.name) return entity.name;
  if (entity.kind) return text(entity.kind);
  return entity.id;
}

/** 그 행동이 지금 되는가를 한 줄로 — 되면 그대로, 안 되면 세계가 준 사유로 */
function actionLine(
  snapshot: GameViewSnapshot,
  interactionId: string,
  okText: string,
  text: (code: string) => string,
): string {
  const interaction = snapshot.interactions.find((i) => i.id === interactionId);
  if (!interaction) return '—';
  if (interaction.available) return okText;
  return interaction.reason ? text(interaction.reason) : '지금은 안 된다';
}

/**
 * 대상 자리 — 고른 것이 무엇이고, 그 상대에게 지금 무엇이 되고 무엇이 왜 안 되는가.
 *
 * 고른 것이 없어도 **한 줄은 남긴다.** "지금은 아무것도 안 골랐다" 와
 * "화면이 이 자리를 안 그린다" 는 다르며, 그 둘을 가르는 것이 C011·C014 가 세운 태도다.
 *
 * 값은 여기서 만들지 않는다 — 전부 계약이 실어 온 지금의 값이다. 그래서 대상의 생명이
 * 줄면 다음 프레임에 이 자리의 숫자도 줄어든다 (사본이 아니다).
 */
export function targetHudItems(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
): SceneHudItem[] {
  const targetId = snapshot.currentTarget?.entityId;
  if (targetId === undefined) {
    return [{ id: 'target.none', widget: 'label', label: '고른 대상', value: '없음' }];
  }

  const entity = snapshot.entities.find((e) => e.id === targetId);
  if (!entity) {
    // 계약상 오지 않는 조합이다 (세계가 매 Tick 성립하지 않는 지목을 비운다).
    // 그래도 그리는 쪽이 멈추지 않게 둔다 — 표현 누락이 게임을 멈추지 않는다.
    return [{ id: 'target.none', widget: 'label', label: '고른 대상', value: targetId }];
  }

  const items: SceneHudItem[] = [
    { id: 'target.name', widget: 'label', label: '고른 대상', value: targetName(entity, text) },
    { id: 'target.state', widget: 'label', label: '지금', value: text(entity.state) },
  ];

  // 생명은 있는 존재에만 있다 (광맥에는 없다) — 없으면 그 줄을 만들지 않는다.
  if (entity.vitality) {
    items.push({
      id: 'target.health',
      widget: 'counter',
      label: '생명',
      value: entity.vitality.health,
      progress:
        entity.vitality.healthMaximum > 0
          ? entity.vitality.health / entity.vitality.healthMaximum
          : 0,
    });
  }

  // 이 상대에게 지금 무엇이 되는가. 둘 다 늘 띄운다 — 안 되는 이유를 읽는 것이
  // 이 자리의 값어치다 (MC-WATCH-TARGET: 사유가 사라지고 행동만 회색으로 남으면 아니다).
  items.push({
    id: 'target.observe',
    widget: 'label',
    label: '살펴보기',
    value: actionLine(snapshot, 'observe', '가능', text),
  });
  items.push({
    id: 'target.mine',
    widget: 'label',
    label: '채집',
    value: actionLine(snapshot, 'mine', '가능', text),
  });

  return items;
}
