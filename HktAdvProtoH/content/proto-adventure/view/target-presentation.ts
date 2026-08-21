// Target Presentation — 고른 대상을 어떻게 보일지 결정한다 (C017, 결정 Layer 데이터).
//
// 세계는 Id 하나만 보낸다 (04 currentTarget). 이름도 생명도 사유도 이미 계약의 다른
// 자리에 와 있으므로, **한자리로 모으는 일은 여기서 한다** — 그것이 View 의 몫이고
// 세계가 보장한 것은 짐작 없이 모을 수 있다는 것뿐이다 (04 VIEW ASSEMBLY NOTE).
//
// 이 파일이 정하는 것은 셋이다.
//   ① 고른 존재를 어떻게 강조할 것인가 (색)
//   ② 대상 자리에 무엇을 **어느 자리에** 몇 줄로 띄울 것인가
//   ③ 그 줄들의 문구 형식
//
// ② 의 자리가 C022 에서 갈렸다. 소지품과 **같은 이유, 같은 기준**이다:
// 가로 띠에는 한눈에 읽는 것(무엇을 상대하는가 · 그 상태 · 생명)을 두고,
// 읽어야 아는 것(이 상대에게 지금 뭐가 되고 왜 안 되나)은 세로로 자라는 self 패널로
// 내린다. 사유가 문장이라 띠에서 자리를 가장 많이 먹던 것이 이 둘이었다.
//
// **사유는 사라지지 않는다** — MC-WATCH-TARGET 이 요구하는 것은 "행동만 회색으로 남고
// 사유가 사라지지 않는 것" 이며, 그 요구는 자리를 옮겨도 그대로 지켜진다.
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
] as const;

/** 대상 절의 머리글 — self 패널에서 소지품 절과 나란히 선다 */
const TARGET_SECTION = '고른 대상';

/** 이 존재를 무엇이라 부를 것인가 — 이름이 없는 것(광맥)은 종류로 부른다 */
function targetName(entity: EntityView, text: (code: string) => string): string {
  if (entity.name) return entity.name;
  if (entity.kind) return text(entity.kind);
  return entity.id;
}

/**
 * 이 상대에게 그 행동이 지금 되는가 — 목록 한 줄로.
 *
 * 소지품 줄과 **글자 그대로 같은 모양**이다 (`이름 ✓/✗ 짧은 표기`). 두 목록이 다르게
 * 생기면 읽는 사람이 둘을 다른 것으로 여긴다 — 실제로는 똑같이 "지금 이게 되나" 다.
 */
function actionLine(
  snapshot: GameViewSnapshot,
  interactionId: string,
  label: string,
  shortText: (code: string) => string,
): string | undefined {
  const interaction = snapshot.interactions.find((i) => i.id === interactionId);
  if (!interaction) return undefined; // 이 세계에 없는 행동은 줄을 만들지 않는다
  if (interaction.available) return `${label} ✓`;
  return `${label} ✗ ${interaction.reason ? shortText(interaction.reason) : '안 됨'}`;
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

  // 이 상대에게 지금 무엇이 되는가는 **self 패널로 내려간다** (targetDetailLines).
  // 띠에는 한눈에 읽는 것만 남는다 — 무엇을 상대하는가 · 그 상태 · 생명.
  return items;
}

/**
 * 이 상대에게 지금 무엇이 되고 무엇이 왜 안 되는가 — **self 패널로 내려가는 줄들.**
 *
 * 둘 다 늘 띄운다. 안 되는 이유를 읽는 것이 이 자리의 값어치이며
 * (MC-WATCH-TARGET: 사유가 사라지고 행동만 회색으로 남으면 아니다), 자리를 옮긴 것이
 * 그 요구를 깨지 않는다 — 오히려 잘려 나가지 않게 되어 더 확실히 지켜진다.
 *
 * 고른 것이 없으면 줄이 없다. 상대가 없는데 "상대에게 무엇이 되는가" 는 물음이 아니다.
 */
export function targetDetailLines(
  snapshot: GameViewSnapshot,
  shortText: (code: string) => string,
): string[] {
  if (snapshot.currentTarget?.entityId === undefined) return [];

  const parts = [
    actionLine(snapshot, 'observe', '살펴보기', shortText),
    actionLine(snapshot, 'mine', '채집', shortText),
  ].filter((line): line is string => line !== undefined);

  return parts.length ? [TARGET_SECTION, ...parts] : [];
}
