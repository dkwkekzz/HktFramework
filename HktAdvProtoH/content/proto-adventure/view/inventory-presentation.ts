// Inventory Presentation — 소지품을 어떻게 보일지 결정한다 (C020, 결정 Layer 데이터).
//
// 세계는 목록 하나를 보낸다 (04 inventory). 항목마다 종류 · 수량 · 분류 · 유래 ·
// 지금 되는 것과 안 되는 사유가 함께 온다. **여기서 하는 판정은 하나도 없다** —
// 되는지 안 되는지도, 왜 안 되는지도 전부 계약이 실어 온 것을 옮길 뿐이다
// (DC-WORLD-OWNS-THE-SURFACE-LIST).
//
// 이 파일이 정하는 것은 넷이다.
//   ① 몇 번 칸이 무엇인가 — 순서에 번호를 붙이는 일은 화면의 결정이다
//   ② 무엇으로 보일 것인가 — 분류가 정하는 아이콘, 종류 이름의 문구
//   ③ 되는 것과 안 되는 사유를 어떤 줄로 띄울 것인가
//   ④ 자리를 어떤 줄로 보일 것인가 (C022) — **세지는 않는다.** 세계가 보낸 두 값을 옮긴다
//
// **종류 이름이 이 파일의 규칙이 되지 않는다.** 아래에 `stone` 도 `pickaxe` 도 없다 —
// 종류 이름은 문구를 찾는 열쇠로만 쓰이고(code-text), 없으면 코드 그대로 보인다.
// 세계가 새 아이템을 정의해도 이 파일은 바뀌지 않는다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH).

import type { SceneHudItem, SceneState } from '../../../engine/view-kernel/scene/scene-state';
import type { GameViewSnapshot } from '../protocol/gameview';

/** 소지품 줄의 id 앞머리 — 조립 루트가 칸 번호를 되읽을 때 쓴다 */
export const INVENTORY_HUD_PREFIX = 'inventory.';

/**
 * 자리 줄의 id (C022) — 소지품 항목이 아니라 **몸의 형편**이므로 칸 번호를 갖지 않는다.
 * `inventoryKindOf` 가 이 id 를 종류로 읽지 않도록 점을 포함시킨다.
 */
export const INVENTORY_ROOM_HUD_ID = `${INVENTORY_HUD_PREFIX}room`;

/** 분류가 정하는 아이콘. 모르는 분류는 아이콘 없이 나온다 — 화면이 멈추지 않는다 */
const CATEGORY_ICON: Record<string, string> = {
  material: '🪨',
  tool: '⛏',
  consumable: '🧪',
};

/** 소지품 칸에 붙는 손가락 자리 — 첫 아홉 칸까지 번호를 준다 */
const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * 덜어내기를 여는 키의 표시 이름 (C022 — 실제 바인딩은 `view/bindings.ts`).
 *
 * 여기 있는 것은 **문구**뿐이다. 어떤 키가 무엇을 부르는지는 bindings 가 소유하고,
 * 이 파일은 그것을 사람에게 읽어 줄 뿐이다.
 */
const DISCARD_ARM_KEY_LABEL = 'B';

/**
 * 종류의 이름 — `item.<kind>` 로 찾고, 표에 없으면 코드 그대로 보인다.
 *
 * 앞머리를 붙이는 이유는 같은 문자열이 다른 것을 뜻하는 자리가 이미 있기 때문이다
 * (`stone` 은 광맥의 종류로도 쓰인다). 표에 없어도 화면이 멈추지 않는 것이 요점이다 —
 * 세계가 새 아이템을 정의하는 것만으로 소지품에 나타나야 한다.
 */
function itemName(kind: string, text: (code: string) => string): string {
  const code = `item.${kind}`;
  const named = text(code);
  return named === code ? kind : named;
}

/** 그 칸이 무엇의 칸인가 — id 에서 종류를 되읽는다 (조립 루트가 요청을 만들 때 쓴다) */
export function inventoryKindOf(hudId: string): string | undefined {
  if (!hudId.startsWith(INVENTORY_HUD_PREFIX)) return undefined;
  const rest = hudId.slice(INVENTORY_HUD_PREFIX.length);
  // `none`(빈 소지품)과 `room`(자리)은 종류가 아니다. 점이 들어간 것은 항목의 곁줄이다
  if (rest === 'none' || rest === 'room' || rest.includes('.')) return undefined;
  return rest;
}

/**
 * 지금 장면의 소지품 칸들 — 세계가 보낸 순서 그대로다.
 *
 * 조립 루트는 이것으로 "1 번 칸이 무엇인가" 를 안다. 화면이 순서를 만들지 않는다 —
 * 세계가 준 순서에 번호만 붙인다.
 */
export function inventorySlots(scene: SceneState): string[] {
  const kinds: string[] = [];
  for (const item of scene.hud) {
    const kind = inventoryKindOf(item.id);
    if (kind !== undefined) kinds.push(kind);
  }
  return kinds;
}

/**
 * 소지품 자리 — 무엇을 얼마나 지녔고, 그것으로 지금 무엇이 되고 무엇이 왜 안 되는가.
 *
 * 지닌 것이 없어도 **한 줄은 남긴다.** "지금 아무것도 없다" 와 "화면이 이 자리를
 * 안 그린다" 는 다르며, 그 둘을 가르는 것이 C011·C014·C017 이 세운 태도다.
 */
export function inventoryHudItems(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
): SceneHudItem[] {
  const inventory = snapshot.inventory ?? [];

  // C022 — 자리는 **언제나 먼저 온다.** 지닌 것이 없을 때야말로 자리를 보여야 하는
  // 순간이므로 항목 아래에 두지 않는다. 세계가 보낸 둘을 그대로 옮긴다 —
  // 화면이 항목에서 유도하지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
  const room = snapshot.inventoryRoom;
  const roomLine: SceneHudItem[] = room
    ? [
        {
          id: INVENTORY_ROOM_HUD_ID,
          widget: 'label',
          label: '자리',
          // 가득 찼는지는 **보이는** 것이지 화면이 그것으로 무엇을 막지 않는다.
          // 막는 것은 언제나 세계가 보낸 available 과 사유다.
          value: `${room.used} / ${room.capacity}${room.used >= room.capacity ? ' (가득)' : ''}`,
        },
      ]
    : [];

  if (inventory.length === 0) {
    return [
      ...roomLine,
      { id: 'inventory.none', widget: 'label', label: '소지품', value: '없음' },
    ];
  }

  const items: SceneHudItem[] = [...roomLine];
  inventory.forEach((entry, index) => {
    const slot = SLOT_KEYS[index];
    const icon = CATEGORY_ICON[entry.category];
    items.push({
      id: `${INVENTORY_HUD_PREFIX}${entry.kind}`,
      widget: 'counter',
      // 칸 번호는 화면의 결정이다. 아홉 칸을 넘으면 번호 없이 보인다 — 세지 못하는
      // 것이 아니라 손가락 자리가 없는 것이고, 그때 무엇을 하는지는 이후가 정한다.
      label: slot ? `${slot}. ${itemName(entry.kind, text)}` : itemName(entry.kind, text),
      ...(icon ? { icon } : {}),
      value: entry.count,
      // 캐서 늘어난 돌이 반짝이던 자리를 그대로 잇는다 (C001 의 celebrateGain)
      celebrateGain: true,
    });

    // 쓸 수 있는 물건에만 이 줄이 붙는다. 안 되는 것도 **띄운다** — 안 되는 이유를
    // 읽는 것이 이 자리의 값어치다 (대상 자리와 같은 태도).
    const use = entry.actions.find((a) => a.role === 'use-item');
    if (use) {
      items.push({
        id: `${INVENTORY_HUD_PREFIX}${entry.kind}.use`,
        widget: 'label',
        label: '쓰기',
        value: use.available
          ? '가능'
          : use.unavailableReason
            ? text(use.unavailableReason)
            : '지금은 안 된다',
      });
    }

    // C022 — 덜어내기. **지닌 모든 항목에 온다** (세계가 그렇게 보낸다).
    // 안 되는 것도 띄우는 이유는 쓰기와 같다 — `no-way-back` 을 읽는 것이
    // 이 세계에서 무엇이 되돌릴 수 없는지를 아는 유일한 길이다.
    const discard = entry.actions.find((a) => a.role === 'discard-item');
    if (discard) {
      items.push({
        id: `${INVENTORY_HUD_PREFIX}${entry.kind}.discard`,
        widget: 'label',
        label: '덜어내기',
        value: discard.available
          ? // 손가락 자리를 함께 알려 준다 — 두 걸음짜리 조작이라 안내가 없으면 닿지 않는다
            slot
            ? `가능 (${DISCARD_ARM_KEY_LABEL} → ${slot})`
            : '가능'
          : discard.unavailableReason
            ? text(discard.unavailableReason)
            : '지금은 안 된다',
      });
    }
  });

  return items;
}
