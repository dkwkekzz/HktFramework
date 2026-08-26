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
//   ③ 되는 것과 안 되는 사유를 **어느 자리에** 어떤 줄로 띄울 것인가
//   ④ 자리를 어떤 줄로 보일 것인가 (C022) — **세지는 않는다.** 세계가 보낸 두 값을 옮긴다
//
// ③ 의 자리가 C022 에서 바뀌었다. 처음에는 항목마다 곁줄을 띠에 함께 세웠는데,
// 그러면 지닌 것이 늘 때마다 **가로 띠가 항목 수의 세 배로 길어진다** — 종류 둘에
// 이미 여덟 칸이 되어 화면 밖으로 잘렸다. 사유는 문장이라 길고, 띠는 가로로만 자란다.
//
// 그래서 둘로 갈랐다. **띠에는 한눈에 읽을 것**(자리 · 무엇을 얼마나)을 두고,
// **읽어야 아는 것**(이걸로 지금 뭐가 되나, 왜 안 되나)은 세로로 자라는 self 패널로
// 내린다. 어느 것도 사라지지 않는다 — 세계가 보낸 사유는 전부 그대로 보인다
// (DC-WORLD-OWNS-THE-SURFACE-LIST). 자리만 옮겼다.
//
// **종류 이름이 이 파일의 규칙이 되지 않는다.** 아래에 `stone` 도 `pickaxe` 도 없다 —
// 종류 이름은 문구를 찾는 열쇠로만 쓰이고(code-text), 없으면 코드 그대로 보인다.
// 세계가 새 아이템을 정의해도 이 파일은 바뀌지 않는다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH).

import type { SceneHudItem, SceneState } from '../../../engine/view-kernel/scene/scene-state';
import type { GameViewSnapshot } from '../protocol/gameview';
import { keyLabel, SLOT_KEY_LABELS } from './key-registry';
// 종류 이름은 한 자리에서 온다 (V-008) — 같은 세 줄이 세 파일에 있던 자리다
import { itemName } from './inventory-view';

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
  gear: '🛡', // C024 — 표에 한 줄이 는다
};

/**
 * 소지품 칸에 붙는 손가락 자리 — 첫 아홉 칸까지 번호를 준다.
 * V-003 — 번호도 표에서 온다. 숫자 키를 옮기면 이 안내가 함께 옮겨진다.
 */
const SLOT_KEYS = SLOT_KEY_LABELS;

/**
 * 의미 역할 → 사람이 읽는 이름. **표에 없는 역할도 화면을 멈추지 않는다** —
 * 세계가 새 역할을 보내면 코드 그대로 보이고, 그때 이 표에 한 줄이 는다.
 */
const ACTION_LABEL: Record<string, string> = {
  'use-item': '쓰기',
  'discard-item': '덜어내기',
  'equip-item': '걸기', // C023 — 표에 한 줄이 늘 뿐이다
  'exchange-item': '바꿔 걸기', // C024 — 같음
};

/** 그 역할을 부르는 손가락 자리 — 칸 번호를 받아 안내 문구를 만든다 */
const ACTION_KEY_HINT: Record<string, (slot?: string) => string | undefined> = {
  'use-item': (slot) => slot,
  // V-002 — 걸음이 하나 는다. 되돌릴 수 없는 것은 숫자 키 하나로 나가지 않고
  // 작업 공간의 확인을 거친다. 안내가 그 걸음을 숨기면 사람은 이미 끝난 줄 안다
  'discard-item': (slot) => (slot ? `${keyLabel('discard')} → ${slot} → 확인` : undefined),
  // C023 — 덜어내기와 같은 두 걸음이다. 손가락 자리가 모자란 것은 조작 계층의 사정이며
  // 게임의 판정이 아니다 (view/bindings.ts).
  'equip-item': (slot) => (slot ? `${keyLabel('equip')} → ${slot}` : undefined),
  // C024 — **세 걸음이다.** 물건과 자리를 둘 다 고르기 때문이며, 자리는 걸린 자리의
  // 번호다 (걸어 둔 것 목록의 번호와 같다 — view/equipment-presentation.ts).
  'exchange-item': (slot) =>
    slot ? `${keyLabel('exchange')} → ${slot} → 걸린 번호` : undefined,
};

/**
 * 종류의 이름 — `item.<kind>` 로 찾고, 표에 없으면 코드 그대로 보인다.
 *
 * 앞머리를 붙이는 이유는 같은 문자열이 다른 것을 뜻하는 자리가 이미 있기 때문이다
 * (`stone` 은 광맥의 종류로도 쓰인다). 표에 없어도 화면이 멈추지 않는 것이 요점이다 —
 * 세계가 새 아이템을 정의하는 것만으로 소지품에 나타나야 한다.
 */

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

  // 항목마다 **한 칸**이다. 수량은 한눈에 읽히고 자주 바뀌므로 띠에 남는다 —
  // 캐서 늘어난 것이 반짝이는 자리도 여기다 (celebrateText 는 counter 에만 붙는다).
  // 그것으로 무엇이 되는가는 읽어야 아는 것이라 self 패널로 내려간다.
  return [
    ...roomLine,
    ...inventory.map((entry, index) => {
      const slot = SLOT_KEYS[index];
      const icon = CATEGORY_ICON[entry.category];
      return {
        id: `${INVENTORY_HUD_PREFIX}${entry.kind}`,
        widget: 'counter' as const,
        // 칸 번호는 화면의 결정이다. 아홉 칸을 넘으면 번호 없이 보인다 — 세지 못하는
        // 것이 아니라 손가락 자리가 없는 것이고, 그때 무엇을 하는지는 이후가 정한다.
        label: slot ? `${slot}. ${itemName(entry.kind, text)}` : itemName(entry.kind, text),
        ...(icon ? { icon } : {}),
        value: entry.count,
        // 캐서 늘어난 돌이 반짝이던 자리를 그대로 잇는다 (C001 의 축하 토스트).
        // **문장을 여기서 짓는다** (문구 반전 ⑤) — 기반은 `{}` 에 늘어난 만큼만 끼운다.
        // 칸 번호가 붙은 label 이 아니라 **물건의 이름**으로 부른다 — 토스트는 띠의
        // 몇 번째 칸인지를 축하하는 것이 아니라 무엇을 얻었는지를 축하하는 자리다
        celebrateText: `+{} ${itemName(entry.kind, text)} 획득!`,
      };
    }),
  ];
}

/**
 * 소지품으로 지금 무엇이 되고 무엇이 왜 안 되는가 — **self 패널로 내려가는 줄들.**
 *
 * 안 되는 것도 띄운다. 안 되는 이유를 읽는 것이 이 자리의 값어치이며(C020),
 * `no-way-back` 을 읽는 것이 이 세계에서 무엇이 되돌릴 수 없는지를 아는 유일한 길이다.
 * 달라진 것은 그 줄이 **가로 띠가 아니라 세로 목록에 선다**는 것뿐이다 — 지닌 것이
 * 늘어도 화면 밖으로 밀려나지 않는다.
 *
 * 여기서도 판정은 하나도 하지 않는다. 계약이 실어 온 available 과 사유를 옮긴다.
 */
export function inventoryDetailLines(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
  /** 사유의 **짧은 표기** — 목록 안이라 길면 문단이 된다 (code-text.ts 의 이유 참조) */
  shortText: (code: string) => string,
): string[] {
  const inventory = snapshot.inventory ?? [];
  if (inventory.length === 0) return [];

  const lines = ['소지품'];
  inventory.forEach((entry, index) => {
    const slot = SLOT_KEYS[index];
    const name = slot ? `${slot}. ${itemName(entry.kind, text)}` : itemName(entry.kind, text);

    const parts = entry.actions.map((a) => {
      const role = ACTION_LABEL[a.role] ?? a.role;
      if (!a.available) {
        return `${role} ✗ ${a.unavailableReason ? shortText(a.unavailableReason) : '안 됨'}`;
      }
      // 되는 것에는 손가락 자리를 붙인다 — 두 걸음짜리 조작은 안내가 없으면 닿지 않는다
      const key = ACTION_KEY_HINT[a.role]?.(slot);
      return key ? `${role} ✓ ${key}` : `${role} ✓`;
    });

    lines.push(parts.length ? `${name} ×${entry.count} · ${parts.join(' · ')}` : `${name} ×${entry.count}`);
  });
  return lines;
}
