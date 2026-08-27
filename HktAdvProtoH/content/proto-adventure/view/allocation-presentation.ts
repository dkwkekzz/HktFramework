// Allocation Presentation (C-COMBAT-001) — 힘의 배분을 어떻게 보일지 정한다 (결정 Layer).
//
// 세계는 넷을 보낸다: 지금의 배분 · 그 세 몫 · 고를 수 있는 목록 · 각 항목의 가능 여부와
// 사유. 이 파일은 그것을 **어떤 문구로 어디에** 두는지만 정한다.
//
// **배분 이름으로 분기하지 않는다.** 이 파일 어디에도 `balanced` · `hunter` 같은 이름이
// 조건으로 서지 않는다 — 이름은 문구 표(code-text)를 찾는 열쇠일 뿐이고, 표에 없으면
// 코드 그대로 보인다. 그래서 세계가 배분을 하나 더 지어도 이 코드는 열리지 않는다
// (DC-WORLD-OWNS-THE-SURFACE-LIST · 04 allocations.fields.id.meaning).
//
// **몫도 계산하지 않는다.** 세계가 세 몫을 실어 보내므로 화면은 옮겨 적을 뿐이며,
// "지금이 고른 배분인가" 도 세계가 보낸 `current` 를 읽는다.

import type { AllocationChoiceView, AllocationView, GameViewSnapshot } from '../protocol/gameview';
import type { SceneHudItem, SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { codeText } from './code-text';
import { keyLabel, SLOT_KEY_IDS } from './key-registry';

/**
 * 배분 칸의 id 앞머리.
 *
 * 소지품(`inventory.<kind>`)과 걸어 둔 자리(`equipment.<slotId>`)가 쓰는 그 방식이다 —
 * 결정 Layer 가 hud 줄에 배분을 실어 두고, 조작 규칙(bindings)이 그 줄에서 순서를
 * 되읽는다. **화면이 순서를 만들지 않는다**: 세계가 준 차례에 손가락 자리만 붙인다.
 */
const ALLOCATION_HUD_PREFIX = 'allocation.';

/** 배분 이름의 문구 — 표에 없으면 코드 그대로다 */
export function allocationLabel(id: string): string {
  return codeText(`allocation.${id}`);
}

/** 세 몫을 한 줄로 — 합이 언제나 같다는 것이 이 줄에서 읽힌다 */
export function sharesText(shares: AllocationView['shares']): string {
  return `몸 ${shares.body} · 능력 ${shares.ability} · 인지 ${shares.awareness}`;
}

/**
 * 남의 몸 위에 붙는 표시 — 이름 앞에 온다.
 *
 * **고른 배분에서는 붙지 않는다.** 아무 데도 몰지 않은 몸은 표시할 것이 없고,
 * 표시가 없다는 것이 곧 "이 몸은 지금 어디에도 몰지 않았다" 는 뜻이다
 * (C018 의 관계 표시 · C019 의 선딜 표시가 세운 태도 그대로 — 붙지 않음도 관찰이다).
 *
 * 무엇을 기준으로 "몰았다" 고 볼지는 화면이 정하지 않는다 — 세계가 보낸 세 몫 중
 * 가장 큰 것이 나머지보다 크면 그쪽으로 몬 것이다. 임계값도 이름 목록도 두지 않는다.
 */
export function allocationMark(allocation: AllocationView | undefined): string {
  if (!allocation) return '';
  const { body, ability, awareness } = allocation.shares;
  const top = Math.max(body, ability, awareness);
  const leaning = [body, ability, awareness].filter((s) => s === top).length === 1;
  if (!leaning) return '';
  const mark = top === body ? '몸' : top === ability ? '능' : '인';
  return `[${mark}]`;
}

/** 속성 관찰(inspect)과 self 패널이 함께 쓰는 한 줄 */
export function allocationLine(allocation: AllocationView | undefined): string {
  if (!allocation) return '배분 —';
  return `배분 ${allocationLabel(allocation.id)} (${sharesText(allocation.shares)})`;
}

/**
 * 고를 수 있는 배분들 — hud 줄로 낸다.
 *
 * **넷이 언제나 전부 실린다.** 지금 못 가는 것도 사유와 함께 실린다 — 못 간다는 것과
 * 없다는 것은 다르며, 그 구분이 없으면 "기력을 모으면 저것으로 갈 수 있다" 를 사람이
 * 알 수 없다 (04 allocations.meaning · C023 이 빈 자리를 그린 판단 그대로).
 *
 * 되는지 안 되는지도 왜 안 되는지도 **세계가 보낸 것을 옮긴다** — 화면이 기력과
 * 비용을 견주지 않는다 (DC-COMBAT-UNAVAILABLE-HAS-A-REASON).
 */
export function allocationHudItems(snapshot: GameViewSnapshot): SceneHudItem[] {
  const choices = snapshot.allocations ?? [];
  if (choices.length === 0) return [];
  return choices.map((choice, index) => ({
    id: `${ALLOCATION_HUD_PREFIX}${choice.id}`,
    widget: 'label' as const,
    label: allocationLabel(choice.id),
    value: choiceText(choice, index),
  }));
}

function choiceText(choice: AllocationChoiceView, index: number): string {
  const shares = sharesText(choice.shares);
  // 지금 있는 자리는 거절이 아니다 — 사유를 붙이지 않고 여기라고만 적는다
  // (04 allocations.fields.current.meaning).
  if (choice.current) return `${shares} · 지금 여기`;

  const slot = SLOT_KEY_IDS[index];
  const hint = slot ? `${keyLabel('allocation')} → ${keyLabel(slot)}` : undefined;
  if (!choice.available) {
    // 사유 코드는 세계의 것이다. 표에 없으면 코드 그대로 보인다.
    return `${shares} · ${codeText(choice.unavailableReason ?? 'unavailable')}`;
  }
  return `${shares} · 기력 ${choice.cpCost}${hint ? ` · ${hint}` : ''}`;
}

/** 그 줄이 어느 배분의 줄인가 — id 에서 되읽는다 (조작 규칙이 요청을 만들 때 쓴다) */
export function allocationIdOf(hudId: string): string | undefined {
  if (!hudId.startsWith(ALLOCATION_HUD_PREFIX)) return undefined;
  const rest = hudId.slice(ALLOCATION_HUD_PREFIX.length);
  // `share` 로 시작하는 것은 지금 배분의 몫이지 고를 수 있는 항목이 아니다
  if (rest.includes('.')) return undefined;
  return rest;
}

/**
 * 지금 장면의 배분 칸들 — 세계가 보낸 순서 그대로다.
 *
 * 조작 규칙은 이것으로 "1 번이 무엇인가" 를 안다. 이름을 적어 두지 않으므로
 * 세계가 배분을 하나 더 지어도 조작 코드가 열리지 않는다.
 */
export function allocationSlots(scene: SceneState): string[] {
  const ids: string[] = [];
  for (const item of scene.hud) {
    const id = allocationIdOf(item.id);
    if (id !== undefined) ids.push(id);
  }
  return ids;
}
