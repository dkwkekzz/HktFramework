// Carried Presentation — 지닌 것을 어떻게 보일지 결정한다 (C020, 결정 Layer 데이터).
//
// 세계는 목록을 보낸다 (04 carried · carriedRoom). 각 항목에 지금 무엇이 되고 무엇이
// 왜 안 되는지가 이미 실려 오므로, **이 파일은 판정을 하나도 하지 않는다** —
// 계약이 실어 온 available 과 reason 을 문구로 옮길 뿐이다
// (DC-WORLD-OWNS-THE-SURFACE-LIST).
//
// 이 파일이 정하는 것은 셋이다.
//   ① 자리들을 몇 줄로 어떻게 띄울 것인가
//   ② 그 줄들의 문구 형식 (수량 · 겹침 여유 · 불가 사유)
//   ③ 덜어내기 키가 **어느 자리**를 겨눌 것인가
//
// ③ 이 View 의 결정인 이유: 세계는 자리마다 되는지 안 되는지를 말해 줄 뿐, 그중
// 무엇을 고를지는 말하지 않는다. 키 하나로 조작하는 화면에서는 고르는 일이 필요하고,
// 그 고름은 표현의 결정이다 (막기 토글이 지금 상태를 보고 반대를 고르는 것과 같은 자리).

import type { SceneHudItem } from '../../../engine/view-kernel/scene/scene-state';
import type { CarriedItemView, GameViewSnapshot } from '../protocol/gameview';

/** 덜어내기 대상 자리를 나르는 HUD 항목 id 의 앞머리 — bindings 가 이 뒤를 읽는다 */
export const LET_GO_HUD_PREFIX = 'carried.letGo:';

/** 그 항목을 한 줄로 — 무엇이 얼마나 있고, 이 자리에 얼마나 더 들어가는가 */
function carriedLine(item: CarriedItemView, text: (code: string) => string): string {
  const name = text(`item.${item.kind}`);
  // 겹치지 않는 물건은 수량을 말하지 않는다 — 언제나 하나이므로 소음이다
  if (item.stackLimit <= 1) return name;
  return `${name} ×${item.quantity} (${item.quantity}/${item.stackLimit})`;
}

/** 이 자리를 덜어낼 수 있는가 · 없으면 왜인가 */
function letGoNote(item: CarriedItemView, text: (code: string) => string): string {
  const letGo = item.actions.find((a) => a.effect === 'let-go');
  if (!letGo) return '';
  if (letGo.available) return '';
  // 회색으로 막아 두고 이유를 말하지 않는 형태를 만들지 않는다 (04 unavailableReason)
  return ` — ${text(letGo.reason ?? 'action-not-available')}`;
}

/**
 * 덜어내기 키가 겨눌 자리 — 세계가 된다고 말한 것 중 **첫 자리**다.
 *
 * 없으면 null. 세계가 전부 막아 두었다는 뜻이며 키를 눌러도 아무 일도 일어나지 않는다.
 */
export function letGoTargetSlot(snapshot: GameViewSnapshot): number | null {
  for (const item of snapshot.carried) {
    const letGo = item.actions.find((a) => a.effect === 'let-go' && a.available);
    if (letGo) return letGo.slot;
  }
  return null;
}

/**
 * 소지품 자리 — 얼마나 찼는가 한 줄, 지닌 것마다 한 줄, 덜어내기 한 줄.
 *
 * 빈 자리는 오지 않으므로 그리지 않는다. 얼마나 비었는지는 첫 줄이 답한다.
 */
export function carriedHudItems(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
): SceneHudItem[] {
  const room = snapshot.carriedRoom;
  const full = room.used >= room.total;

  const items: SceneHudItem[] = [
    {
      id: 'carried.room',
      widget: 'label',
      label: '가방',
      icon: '🎒',
      // 가득 찬 것은 숫자만으로도 읽히지만, 그때가 이 Cycle 의 판단이 필요한 순간이므로
      // 눈에 걸리게 둔다
      value: full ? `${room.used}/${room.total} — 가득 찼다` : `${room.used}/${room.total}`,
    },
  ];

  for (const item of snapshot.carried) {
    items.push({
      id: `carried.${item.slot}`,
      widget: 'label',
      // 갈래는 라벨 자리에 둔다 — 도구와 재료가 섞여 보이지 않게 하는 최소한의 구분이다
      label: text(`item.category.${item.category}`),
      value: `${carriedLine(item, text)}${letGoNote(item, text)}`,
    });
  }

  const target = letGoTargetSlot(snapshot);
  const targetItem =
    target === null ? undefined : snapshot.carried.find((c) => c.slot === target);
  items.push({
    id: target === null ? `${LET_GO_HUD_PREFIX}none` : `${LET_GO_HUD_PREFIX}${target}`,
    widget: 'label',
    label: '덜어내기',
    value:
      targetItem === undefined
        ? '덜어낼 수 있는 것이 없다'
        : `[X] ${carriedLine(targetItem, text)}`,
  });

  return items;
}
