// Interaction Registry — 이 팩의 몸이 세계 안에서 할 수 있는 일들 (P1 CHANGED, 설계 반전 ①)
//
// 예전에는 Engine 쪽 dispatch 의 switch 에 분기가 나열되었다. 이제 Cycle 이
// interaction 을 추가하면 이 배열에 항목이 하나 늘어날 뿐이다 — Engine 은 바뀌지 않는다.
//
// 요청의 주체는 그 요청이 도착한 이어짐의 관찰자의 몸이다
// (INTENT-REQUEST-ATTRIBUTION-001). 요청 자체는 주체를 지정하지 않는다 —
// 지정할 수단이 없다. 세계가 모르는 관찰자의 요청은 아무것도 바꾸지 못한다.
//
// 스킬 2종(attack · heavy-attack) · 이동 모드 · 속성 변경.
//   속성 변경만은 주체가 아니라 "지목한 존재" 를 대상으로 한다 (INTENT-ATTRIBUTE-MUTATE-001).
//   그래도 요청의 귀속은 그대로다 — 세계가 모르는 관찰자는 아무것도 바꾸지 못한다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { InteractionHandler } from '../../../engine/world-kernel/content';
import { ruleAttributeSet } from '../rules/attribute-set';
import { ruleMine } from '../rules/mine';
import { ruleMove } from '../rules/move';
import { ruleMoveMode } from '../rules/move-mode';
import { ruleSkillBegin } from '../rules/skill';
import { actorOfObserver, type WorldState } from '../semantic/world-state';
import type { ActorState } from '../semantic/actor';

const DISPATCH = 'DISPATCH';

// 주체 해석 — 몸(Actor)은 이 팩의 개념이므로 요청을 몸에 붙이는 일도 팩의 몫이다.
// Engine 은 관찰자 장부만 확인한다 (engine/world-kernel/dispatch.ts).
function withActor(
  handle: (state: WorldState, actor: ActorState, action: ActionRequest) => ActionResult,
): InteractionHandler<WorldState>['handle'] {
  return (state, observerId, action) => {
    const actor = actorOfObserver(state, observerId);
    if (!actor) return { status: 'failure', rule: DISPATCH, reason: 'unknown-observer' };
    return handle(state, actor, action);
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
    id: 'mine',
    handle: withActor((state, actor, action) => {
      if (!action.targetEntityId)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-target' };
      return ruleMine(state, actor, action.targetEntityId);
    }),
  },
  {
    id: 'attack',
    handle: withActor((_state, actor) => ruleSkillBegin(actor, 'attack')), // 기본 스킬 — 대상을 받지 않는다
  },
  {
    id: 'skill-heavy',
    handle: withActor((_state, actor) => ruleSkillBegin(actor, 'heavy-attack')), // 고급 스킬
  },
  {
    id: 'move-mode',
    handle: withActor((_state, actor, action) => {
      if (!action.mode) return { status: 'failure', rule: DISPATCH, reason: 'missing-mode' };
      return ruleMoveMode(actor, action.mode);
    }),
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
