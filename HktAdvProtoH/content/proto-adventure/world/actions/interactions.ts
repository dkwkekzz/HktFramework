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
import { ruleCarryLetGo } from '../rules/carry';
import { ruleGuardBegin, ruleGuardRelease } from '../rules/guard';
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
    // C020 ADDED — 덜어내기. 자리 하나가 요청의 단위다 (RULE-CARRY-LET-GO-001).
    //
    // 이것은 몸이 세계 안에서 하는 일이 아니라 지닌 것을 정리하는 일이므로
    // 행동(CurrentAction)을 차지하지 않는다 — 채굴 중에도 덜어낼 수 있다.
    // 그래야 자리가 차서 캐지 못하는 상황에서 출구가 다시 막히지 않는다 (03 주①).
    id: 'let-go',
    handle: withActor((_state, actor, action) => ruleCarryLetGo(actor, action.carriedSlot ?? -1)),
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
