// Interaction Registry — 이 팩의 몸이 세계 안에서 할 수 있는 일들 (P1 CHANGED, 설계 반전 ①)
//
// 예전에는 Engine 쪽 dispatch 의 switch 에 분기가 나열되었다. 이제 Cycle 이
// interaction 을 추가하면 이 배열에 항목이 하나 늘어날 뿐이다 — Engine 은 바뀌지 않는다.
//
// C004 CHANGED — 요청의 주체는 그 요청이 도착한 이어짐의 관찰자의 몸이다
// (INTENT-REQUEST-ATTRIBUTION-001). 요청 자체는 주체를 지정하지 않는다 —
// 지정할 수단이 없다. 세계가 모르는 관찰자의 요청은 아무것도 바꾸지 못한다.
//
// C014 ADDED — 살펴봄 · 되돌림. 이 둘만은 withActor 를 쓰지 않는다:
//   앎은 몸의 것이 아니라 **관찰자의 것**이므로 Rule 이 ObserverId 를 받아야 한다
//   (INTENT-OBSERVE-KNOWLEDGE-001). 몸으로 좁히면 그 정보가 사라진다.
//
// C017 ADDED — 고르기 · 풀기. 이 둘도 withActor 를 쓰지 않는다:
//   고르는 것은 몸이 아니라 **보는 이의 의도**이므로 Rule 이 ObserverId 를 받아야 한다
//   (INTENT-TARGET-PER-OBSERVER-001). 살펴봄·되돌림과 같은 자리다.
// C017 CHANGED — 살펴봄·채집이 요청의 targetEntityId 를 읽지 않는다.
//   대상은 그 관찰자가 고른 것이며, 대상을 정하는 곳은 세계에 하나여야 한다
//   (INTENT-TARGET-DIRECTS-THE-ACT-001).
//
// C007 ADDED — 스킬 2종(attack · heavy-attack) · 이동 모드 · 속성 변경.
//   속성 변경만은 주체가 아니라 "지목한 존재" 를 대상으로 한다 (INTENT-ATTRIBUTE-MUTATE-001).
//   그래도 요청의 귀속은 그대로다 — 세계가 모르는 관찰자는 아무것도 바꾸지 못한다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { InteractionHandler } from '../../../../engine/world-kernel/content';
import { ruleAttributeSet } from '../rules/attribute-set';
import { ruleGuardBegin, ruleGuardRelease } from '../rules/guard';
import { ruleItemUse } from '../rules/item-use';
import { ruleItemDiscard } from '../rules/item-discard';
import { ruleItemEquip, ruleItemUnequip } from '../rules/item-equip';
import { ruleMine } from '../rules/mine';
import { ruleMove } from '../rules/move';
import { ruleMoveMode } from '../rules/move-mode';
import { ruleObserveBegin, ruleObserveForget } from '../rules/observe';
import { ruleSkillBegin } from '../rules/skill';
import { ruleTargetClear, ruleTargetSelect } from '../rules/target';
import { actorOfObserver, type WorldState } from '../semantic/world-state';
import type { ActorState } from '../semantic/actor';

const DISPATCH = 'DISPATCH';

// 주체 해석 — 몸(Actor)은 이 팩의 개념이므로 요청을 몸에 붙이는 일도 팩의 몫이다.
// Engine 은 관찰자 장부만 확인한다 (engine/world-kernel/dispatch.ts).
function withActor(
  handle: (
    state: WorldState,
    actor: ActorState,
    action: ActionRequest,
    observerId: string,
  ) => ActionResult,
): InteractionHandler<WorldState>['handle'] {
  return (state, observerId, action) => {
    const actor = actorOfObserver(state, observerId);
    if (!actor) return { status: 'failure', rule: DISPATCH, reason: 'unknown-observer' };
    return handle(state, actor, action, observerId);
  };
}

export const INTERACTIONS: readonly InteractionHandler<WorldState>[] = [
  {
    id: 'move',
    handle: withActor((state, actor, action) => {
      if (!action.position)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-position' };
      return ruleMove(state, actor, action.position);
    }),
  },
  {
    // C017 — 고르기. 요청이 대상을 싣는 유일한 자리가 되었다.
    id: 'select-target',
    handle: (state, observerId, action) => {
      if (!action.targetEntityId)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-target' };
      return ruleTargetSelect(state, observerId, action.targetEntityId);
    },
  },
  {
    // C017 — 풀기. 대상을 받지 않는다 — 무엇을 푸는지는 세계가 이미 안다.
    id: 'clear-target',
    handle: (state, observerId) => ruleTargetClear(state, observerId),
  },
  {
    id: 'mine',
    // C017 CHANGED — 대상은 고른 것이다 (요청의 targetEntityId 를 읽지 않는다)
    handle: withActor((state, actor, _action, observerId) => ruleMine(state, actor, observerId)),
  },
  {
    // C020 — 물건을 쓴다. 요청이 싣는 것은 **내 소지품 중 무엇인가** 하나이며,
    // 대상은 싣지 않는다 — 그것은 그 관찰자가 고른 것이다 (C017 의 자리 그대로).
    // 무슨 일이 일어나는가는 그 물건의 정의가 정한다 — 여기에 종류별 분기가 없다.
    id: 'use-item',
    handle: withActor((state, actor, action, observerId) => {
      if (!action.itemKind) return { status: 'failure', rule: DISPATCH, reason: 'missing-item' };
      return ruleItemUse(state, actor, observerId, action.itemKind);
    }),
  },
  {
    // C022 — 지닌 것을 덜어낸다. 요청이 싣는 것은 **무엇을** 하나뿐이다 —
    // 얼마나는 싣지 않는다 (그 종류를 전부 덜어낸다). 대상도 싣지 않는다:
    // 덜어내기는 몸 밖의 무엇도 요구하지 않으며 그것이 이 행동의 이유다.
    id: 'discard-item',
    handle: withActor((state, actor, action) => {
      if (!action.itemKind) return { status: 'failure', rule: DISPATCH, reason: 'missing-item' };
      return ruleItemDiscard(state, actor, action.itemKind);
    }),
  },
  {
    // C023 — 지닌 것을 몸에 건다. 요청이 싣는 것은 **내 소지품 중 무엇인가** 하나다 —
    // 어느 자리에 걸지는 싣지 않는다: 여섯 자리가 서로 완전히 같으므로 고를 것이 없고,
    // 세계가 빈 자리를 고른다 (IE §10 · §20).
    //
    // C024 CHANGED — **자리를 실을 수 있게 된다.** 싣지 않으면 위 뜻 그대로이고,
    // 실으면 그 자리가 비었을 때 그냥 걸리고 차 있으면 교체가 된다.
    // 수용층은 요청의 종류를 가르지 않는다 — 찼는지 비었는지는 세계가 판정한다
    // (DC-WORLD-OWNS-THE-SURFACE-LIST · 03-world-semantic.md RATIONALE 2).
    id: 'equip-item',
    handle: withActor((_state, actor, action) => {
      if (!action.itemKind) return { status: 'failure', rule: DISPATCH, reason: 'missing-item' };
      return ruleItemEquip(actor, action.itemKind, action.equipSlotId);
    }),
  },
  {
    // C023 — 걸린 것을 푼다. 요청이 싣는 것은 **어느 자리인가** 하나뿐이다 —
    // 무엇을 푸는지는 자리가 이미 안다 (C017 의 clear-target 과 같은 판단).
    id: 'unequip-item',
    handle: withActor((_state, actor, action) => {
      if (!action.equipSlotId)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-slot' };
      return ruleItemUnequip(actor, action.equipSlotId);
    }),
  },
  {
    id: 'attack',
    // 기본 스킬 — 대상을 받지 않는다 (C002)
    handle: withActor((_state, actor) => ruleSkillBegin(actor, 'attack')),
  },
  {
    id: 'skill-heavy',
    // 고급 스킬 (C007)
    handle: withActor((_state, actor) => ruleSkillBegin(actor, 'heavy-attack')),
  },
  {
    // C012 — 오라 스킬. 같은 Rule 을 그대로 지난다. 다른 것은 피해의 방식뿐이다
    // (INTENT-AURA-SKILL-001).
    id: 'skill-aura',
    handle: withActor((_state, actor) => ruleSkillBegin(actor, 'aura-strike')),
  },
  {
    // C011 — 막기는 몸이 세계 안에서 하는 일이므로 interaction 이다 (command 가 아니다).
    // 시작과 해제가 따로 있다 — 토글이 아니라 명시값이어야 같은 요청이 두 번 와도 결과가 같다.
    id: 'guard-begin',
    handle: withActor((state, actor) => ruleGuardBegin(actor, state.time)),
  },
  {
    id: 'guard-release',
    handle: withActor((_state, actor) => ruleGuardRelease(actor)),
  },
  {
    id: 'move-mode',
    handle: withActor((_state, actor, action) => {
      if (!action.mode) return { status: 'failure', rule: DISPATCH, reason: 'missing-mode' };
      return ruleMoveMode(actor, action.mode);
    }),
  },
  {
    // C014 — 살펴본다. C017 CHANGED — 대상은 고른 것이다.
    // 무엇을 살펴볼지가 이 행동의 전부라는 것은 그대로이고, 그 하나를 어디서 얻는가만
    // 바뀐다: 요청이 아니라 세계가 지닌 관계다 (INTENT-TARGET-DIRECTS-THE-ACT-001).
    id: 'observe',
    handle: (state, observerId) => ruleObserveBegin(state, observerId),
  },
  {
    // C014 — 알게 된 것을 되돌린다. 지목하지 않으면 알고 있는 전부다.
    // 세계 안의 행동이 아니라 살펴보기 전과 후를 견주기 위해 밖에서 손대는 자리이며,
    // set-attribute 와 같은 관문(World.DebugAuthority)을 지난다.
    id: 'forget-acquaintance',
    handle: (state, observerId, action) =>
      ruleObserveForget(state, observerId, action.targetEntityId),
  },
  {
    id: 'set-attribute',
    handle: withActor((state, actor, action) => {
      // 대상을 밝히지 않으면 자기 몸이다 — 가장 흔한 쓰임을 짧게 둔다.
      const targetId = action.targetEntityId ?? actor.id;
      if (!action.attribute)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-attribute' };
      return ruleAttributeSet(state, targetId, action.attribute.id, action.attribute.value);
    }),
  },
];
