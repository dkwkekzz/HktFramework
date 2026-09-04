// Pointer Rules — 화면의 무엇인가를 클릭했을 때 그것이 **무슨 뜻인가** (C026 CHANGED).
//
// C008 까지 이 판단은 기반(engine/view-kernel/input/input.ts) 안에 박혀 있었다. 기반이
// "존재를 집었으면 그 존재를 대상으로 하는 interaction 을 보낸다" 를 스스로 알고 있었던 것인데,
// 그것은 게임의 결정이지 기구의 결정이 아니다 — 그래서 이 Cycle 이 그 판단을 여기로 옮긴다
// (spec R3 · SPEC-007 경계: 기반은 집기까지만 하고 스스로 요청을 만들지 않는다).
//
// **기존 셋의 결과는 한 자리도 바뀌지 않는다** (SPEC-007). 빈 땅으로 이동 · 광맥 채굴 ·
// 출구 건너기는 아래 requestFor 가 옛 input.ts 와 같은 차례로 같은 요청을 만든다.
// 이 Cycle 이 더한 것은 **지목** 하나뿐이다.

import type { PointerPick } from '../../engine/view-kernel/input/pointer-intent';
import type { SceneState } from '../../engine/view-kernel/scene/scene-state';
import type { ActionRequest } from '../protocol/actions';

/**
 * 지금 무엇을 지목했는가 — **세계 밖의 값이다** (spec State: 관찰자의 지목).
 * 존재이거나 자리다. 스냅샷에 실리지 않고 조립(app)이 쥔다.
 */
export type Designation = { entityId: string } | { ground: { x: number; z: number } };

/** 클릭 하나가 뜻할 수 있는 것 — 요청 · 지목 · 풀기 · 아무것도 아님 */
export type PointerOutcome =
  | { kind: 'request'; action: ActionRequest }
  | { kind: 'designate'; target: Designation }
  | { kind: 'clear' };

/**
 * 이동과 지목을 가르는 보조키 — **Alt** 다 (spec UNRESOLVED "지목의 입력").
 *
 * 클릭 하나가 이동과 지목을 함께 뜻할 수 없으므로 무엇으로 가를지를 이 Cycle 이 정한다.
 * 셋(누르는 자리 · 보조키 · 두 번 누름) 가운데 보조키를 고른 이유:
 *   ① 누르는 자리로 가르면 화면에 지목 전용 영역이 생긴다 — 그 영역만큼 세계가 가려지고,
 *      이 Cycle 이 걷어낸 "늘 떠 있는 것" 을 다시 하나 세우는 셈이다 (R4 와 어긋난다).
 *   ② 두 번 누름으로 가르면 **첫 번째 누름이 이미 이동 요청으로 나간다** — 지목하려던 사람이
 *      걸어가 버린다. "걸어가 거절당하기 전에 안다"(Playable Goal)가 그 자리에서 깨진다.
 *   ③ 보조키는 첫 누름부터 뜻이 갈리고 화면에 아무것도 세우지 않는다.
 *
 * 그 셋 중 Alt 인 이유: Shift 는 이미 이 세계의 걸음 전환 키이고(bindings.ts moveModeToggle),
 * Ctrl·Meta 는 브라우저·창 관리자가 먼저 가져가는 조합이다. 남는 하나가 Alt 다.
 *
 * TODO 감사 항목 — 이것은 표현·입력의 결정이지 세계 의미가 아니다.
 */
const DESIGNATE_MODIFIER = 'alt' as const;

/**
 * RULE-POINTER-INTENT-001 — 집은 것을 요청 또는 지목으로 옮긴다 (spec R3).
 *
 * 정책이 없으면 기반은 아무 요청도 만들지 않는다. 그래서 이 함수가 침묵하면(null) 클릭은
 * 아무 일도 하지 않는다 — 기본 동작이 기구 안에 숨어 있지 않다 (SPEC-007 경계).
 */
export function pointerRules(pick: PointerPick, scene: SceneState): PointerOutcome | null {
  // 지목 — 세계로 아무것도 보내지 않는다 (spec R1 · SPEC-006).
  if (pick.modifiers[DESIGNATE_MODIFIER]) {
    if (pick.entityId) return { kind: 'designate', target: { entityId: pick.entityId } };
    if (pick.ground) return { kind: 'designate', target: { ground: pick.ground } };
    // 보조키를 쥐고 아무것도 아닌 데를 눌렀다 — 지목할 것이 없으니 쥐고 있던 것을 놓는다
    return { kind: 'clear' };
  }
  const action = requestFor(pick, scene);
  return action ? { kind: 'request', action } : null;
}

/**
 * 기존 셋(이동 · 채굴 · 건너기) — **옛 input.ts 의 차례 그대로다** (SPEC-007).
 *
 * 존재를 집었어도 그 존재를 대상으로 하는 interaction 이 없으면 지면으로 떨어진다.
 * 옛 코드가 그랬고(entity 분기가 return 하지 않고 아래로 흘렀다), 그래야 광맥 뒤의 땅을
 * 눌러도 걸어갈 수 있다.
 */
function requestFor(pick: PointerPick, scene: SceneState): ActionRequest | null {
  if (pick.entityId) {
    const interaction = scene.interactions.find((i) => i.targetEntityId === pick.entityId);
    if (interaction) return { interactionId: interaction.id, targetEntityId: pick.entityId };
  }
  if (pick.ground) {
    const terrain = scene.interactions.find((i) => i.terrainTarget);
    if (terrain) return { interactionId: terrain.id, position: pick.ground };
  }
  return null;
}
