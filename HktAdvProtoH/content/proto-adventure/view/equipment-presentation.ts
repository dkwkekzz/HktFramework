// Equipment Presentation — 걸어 둔 것을 어떻게 보일지 결정한다 (C023, 결정 Layer 데이터).
//
// 세계는 자리 목록 하나를 보낸다 (04 equipment). 자리마다 담긴 것 · 그것이 주는 용도 ·
// 그것이 보태는 값 · 지금 되는 것과 안 되는 사유가 함께 온다.
// **여기서 하는 판정은 하나도 없다** — 무엇이 어느 자리에 들어가는지도, 지금 풀 수
// 있는지도, 값이 얼마나 오르는지도 전부 계약이 실어 온 것을 옮길 뿐이다
// (DC-WORLD-OWNS-THE-SURFACE-LIST).
//
// 자리를 **띠와 패널로 가른다** — C022 가 소지품에서 내린 것과 같은 판단이다.
//
//     띠      한눈에 읽을 것 — **걸린 자리만** 한 줄씩. 무엇이 걸려 몸이 어떻게
//             달라졌는가. 비어 있는 자리는 띠에 오지 않는다 (여섯 줄이 늘 떠 있으면
//             가로 띠가 그것만으로 찬다)
//     패널    읽어야 아는 것 — **자리 여섯 전부**. 빈 자리도 번호와 함께 선다.
//             푸는 손가락 자리(U → 번호)가 그 번호를 쓰기 때문이며, 빈 자리를
//             감추면 "여기 걸 수 있다" 를 사람이 알 길이 없다
//
// **자리 이름도 종류 이름도 이 파일의 규칙이 되지 않는다.** 아래에 `E1` 도 `pickaxe` 도
// 없다 — 자리는 세계가 준 차례에 번호를 붙일 뿐이고, 종류 이름은 문구를 찾는 열쇠로만
// 쓰인다. 세계가 자리를 늘리거나 새 장비를 정의해도 이 파일은 바뀌지 않는다.

import type { SceneHudItem, SceneState } from '../../../engine/view-kernel/scene/scene-state';
import type { EquipmentSlotView, GameViewSnapshot } from '../protocol/gameview';
import { keyLabel, SLOT_KEY_LABELS } from './key-registry';
// 종류 이름은 한 자리에서 온다 (V-008) — 같은 세 줄이 세 파일에 있던 자리다
import { itemName } from './inventory-view';

/** 걸린 자리 줄의 id 앞머리 */
export const EQUIPMENT_HUD_PREFIX = 'equipment.';

/**
 * 손가락 자리 — **걸린 자리에만** 번호를 준다.
 *
 * 빈 자리에 번호를 주면 여섯 개의 번호가 늘 떠 있는데 그중 쓸 수 있는 것은 하나뿐이다.
 * 푸는 일은 걸린 것에만 있으므로 번호도 걸린 것에만 붙는다 — 띠에 서는 순서와 같다.
 *
 * V-003 — 번호도 여는 키들도 `view/key-registry.ts` 가 쥔다. 이 파일이 표기를
 * 따로 적어 두던 자리였고, 그래서 키를 옮기면 안내만 옛것으로 남을 수 있었다.
 * **아래줄 네 칸이 나란한 것**(B · N · M · ,)도 이제 그 표가 지닌 사실이다.
 */
const SLOT_KEYS = SLOT_KEY_LABELS;

/**
 * 의미 역할 → 사람이 읽는 이름. 표에 없는 역할도 화면을 멈추지 않는다.
 * `use-item` 은 소지품 쪽 표와 **같은 문구**여야 한다 — 겪는 일이 하나이기 때문이다.
 */
const ACTION_LABEL: Record<string, string> = {
  'use-item': '쓰기',
  'unequip-item': '풀기',
};


/** 능력 이름 — `stat.<name>` 으로 찾고, 표에 없으면 코드 그대로 보인다 */
function statName(name: string, text: (code: string) => string): string {
  const code = `stat.${name}`;
  const named = text(code);
  return named === code ? name : named;
}

/**
 * 그 자리가 지금 보태고 있는 것 — `물리 공격 +12` 처럼 읽는다.
 *
 * 작업 공간의 장비 구획도 이 함수를 부른다 (V-012) — 같은 값을 두 곳에서 짓지 않는다.
 *
 * **화면이 이 값을 어디에도 더하지 않는다.** 몸의 값(combatStats)은 이미 더해진 값으로
 * 오며, 이 줄은 "그 값이 왜 그 값인가" 의 경위일 뿐이다 (04 equipment.contributions).
 */
export function contributionText(slot: EquipmentSlotView, text: (code: string) => string): string {
  return slot.contributions
    .map((c) => `${statName(c.name, text)} ${c.value >= 0 ? '+' : ''}${c.value}`)
    .join(' · ');
}

/**
 * 자리 → **그 자리를 부르는 번호** (V-014).
 *
 * **걸린 자리에만 붙는다.** 푸는 일은 걸린 것에만 있으므로 번호도 거기까지이며,
 * 빈 자리에 번호를 주면 여섯 개가 늘 떠 있는데 그중 쓸 수 있는 것은 몇 개뿐이다.
 * 두 걸음 지름길(`M` → 번호)이 세는 것이 바로 이 차례다 (`equipmentSlotIds` 가
 * 같은 순서를 낸다 — 띠에 서는 것도 걸린 자리뿐이기 때문이다).
 *
 * 이 함수가 하나 있어야 하는 이유는 소지품 쪽과 같다 (V-013) — 번호를 두 곳에서
 * 따로 매기면 화면이 부르라고 한 번호와 실제로 부르는 번호가 갈라지고,
 * 그것을 아는 방법은 눌러 보는 것뿐이다.
 */
export function equipmentSlotKeys(
  equipment: readonly EquipmentSlotView[],
): ReadonlyMap<string, string> {
  const keys = new Map<string, string>();
  let filled = 0;
  for (const slot of equipment) {
    if (!slot.item) continue;
    const key = SLOT_KEYS[filled];
    filled += 1;
    if (key) keys.set(slot.slotId, key);
  }
  return keys;
}

/** 그 줄이 어느 자리의 줄인가 — id 에서 자리를 되읽는다 */
export function equipmentSlotOf(hudId: string): string | undefined {
  if (!hudId.startsWith(EQUIPMENT_HUD_PREFIX)) return undefined;
  const rest = hudId.slice(EQUIPMENT_HUD_PREFIX.length);
  return rest === 'none' ? undefined : rest;
}

/**
 * 지금 장면에서 **걸려 있는 자리들** — 띠에 선 순서 그대로다.
 *
 * 조립 루트(bindings)는 이것으로 "1 번이 어느 자리인가" 를 안다. 화면이 순서를
 * 만들지 않는다 — 세계가 준 차례에서 걸린 것만 남기고 번호만 붙인다.
 */
export function equipmentSlotIds(scene: SceneState): string[] {
  const ids: string[] = [];
  for (const item of scene.hud) {
    const slotId = equipmentSlotOf(item.id);
    if (slotId !== undefined) ids.push(slotId);
  }
  return ids;
}

/**
 * 띠에 서는 줄 — **걸린 자리만.**
 *
 * 걸린 것이 하나도 없어도 한 줄은 남긴다. "지금 아무것도 걸지 않았다" 와 "화면이 이
 * 자리를 안 그린다" 는 다르며, 그 둘을 가르는 것이 이 세계가 지켜 온 태도다.
 * 그리고 이 Cycle 의 첫 관찰이 정확히 **아무것도 걸지 않은 몸**이다.
 */
export function equipmentHudItems(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
): SceneHudItem[] {
  const equipment = snapshot.equipment ?? [];
  if (equipment.length === 0) return [];

  const filled = equipment.filter((slot) => slot.item);
  if (filled.length === 0) {
    return [{ id: 'equipment.none', widget: 'label', label: '걸린 것', value: '없음' }];
  }

  return filled.map((slot) => {
    const name = itemName(slot.item!.kind, text);
    const gain = contributionText(slot, text);
    return {
      id: `${EQUIPMENT_HUD_PREFIX}${slot.slotId}`,
      widget: 'label' as const,
      label: '걸린 것',
      icon: '🎽',
      value: gain ? `${name} · ${gain}` : name,
    };
  });
}

/**
 * self 패널로 내려가는 줄들 — **자리 여섯 전부.**
 *
 * 빈 자리도 번호와 함께 선다. 무엇이 걸려 있고, 그것이 무엇을 주며, 지금 풀 수 있는지와
 * 왜 안 되는지가 전부 여기 있다. 안 되는 것도 띄운다 — 안 되는 이유를 읽는 것이 이
 * 자리의 값어치이고, `no-room` 을 읽는 것이 "왜 못 푸는가" 를 아는 유일한 길이다.
 *
 * 여기서도 판정은 하나도 하지 않는다. 계약이 실어 온 available 과 사유를 옮긴다.
 */
export function equipmentDetailLines(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
  /** 사유의 **짧은 표기** — 목록 안이라 길면 문단이 된다 */
  shortText: (code: string) => string,
): string[] {
  const equipment = snapshot.equipment ?? [];
  if (equipment.length === 0) return [];

  const lines = [
    `걸어 둔 것 (${keyLabel('unequip')} → 번호 · 바꿔 걸기는 ${keyLabel('exchange')} → 소지품 → 번호)`,
  ];
  // 번호는 **걸린 자리에만** 붙는다 — 띠에 선 순서와 같다 (equipmentSlotIds).
  // 번호를 매기는 자리는 하나다 (V-014) — 작업 공간의 칸도 이 표를 읽는다
  const keys = equipmentSlotKeys(equipment);
  equipment.forEach((slot) => {
    if (!slot.item) {
      // 비었다는 것도 관찰의 내용이다 — 감추면 "여기 걸 수 있다" 를 알 길이 없다.
      lines.push('·  빈 자리');
      return;
    }
    const key = keys.get(slot.slotId);
    const head = key ? `${key}.` : '·';

    const parts: string[] = [itemName(slot.item.kind, text)];

    const gain = contributionText(slot, text);
    if (gain) parts.push(gain);
    // 걸어서 몸에 생긴 용도 — "왜 캘 수 있게 되었는가" 를 읽는 자리다
    if (slot.grants.length > 0) parts.push(slot.grants.map((g) => text(`use.${g}`)).join(' · '));

    for (const action of slot.actions) {
      const role = ACTION_LABEL[action.role] ?? action.role;
      if (!action.available) {
        parts.push(`${role} ✗ ${action.unavailableReason ? shortText(action.unavailableReason) : '안 됨'}`);
        continue;
      }
      // 되는 것에는 손가락 자리를 붙인다 — 두 걸음짜리 조작은 안내가 없으면 닿지 않는다
      if (action.role === 'unequip-item' && key) parts.push(`${role} ✓ ${keyLabel('unequip')} → ${key}`);
      else parts.push(`${role} ✓`);
    }

    lines.push(`${head} ${parts.join(' · ')}`);
  });
  return lines;
}
