// Action Request 수용 경로 — interactionId 를 World Rule 로 위임한다.
// Cycle 이 interaction 을 추가하면 여기에 분기가 늘어난다 (World 측 확장).
//
// C004 CHANGED — 요청의 주체는 그 요청이 도착한 이어짐의 관찰자의 몸이다
// (INTENT-REQUEST-ATTRIBUTION-001). 요청 자체는 주체를 지정하지 않는다 —
// 지정할 수단이 없다. 세계가 모르는 관찰자의 요청은 아무것도 바꾸지 못한다.
//
// C007 ADDED — 스킬 2종(attack · heavy-attack) · 이동 모드 · 속성 변경.
//   속성 변경만은 주체가 아니라 "지목한 존재" 를 대상으로 한다 (INTENT-ATTRIBUTE-MUTATE-001).
//   그래도 요청의 귀속은 그대로다 — 세계가 모르는 관찰자는 아무것도 바꾸지 못한다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import { ruleAttributeSet } from '../rules/attribute-set';
import { ruleGuardBegin, ruleGuardRelease } from '../rules/guard';
import { ruleMine } from '../rules/mine';
import { ruleMove } from '../rules/move';
import { ruleMoveMode } from '../rules/move-mode';
import { ruleSkillBegin } from '../rules/skill';
import { actorOfObserver, type WorldState } from '../semantic/world-state';

const DISPATCH = 'DISPATCH';

export function dispatchAction(
  state: WorldState,
  observerId: string,
  action: ActionRequest,
): ActionResult {
  const actor = actorOfObserver(state, observerId);
  if (!actor) return { status: 'failure', rule: DISPATCH, reason: 'unknown-observer' };

  switch (action.interactionId) {
    case 'move':
      if (!action.position) return { status: 'failure', rule: DISPATCH, reason: 'missing-position' };
      return ruleMove(state, actor, action.position);
    case 'mine':
      if (!action.targetEntityId)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-target' };
      return ruleMine(state, actor, action.targetEntityId);
    case 'attack':
      return ruleSkillBegin(actor, 'attack'); // 기본 스킬 — 대상을 받지 않는다 (C002)
    case 'skill-heavy':
      return ruleSkillBegin(actor, 'heavy-attack'); // 고급 스킬 (C007)
    // C012 — 오라 스킬. 같은 Rule 을 그대로 지난다. 다른 것은 피해의 방식뿐이다
    // (INTENT-AURA-SKILL-001).
    case 'skill-aura':
      return ruleSkillBegin(actor, 'aura-strike');
    // C011 — 막기는 몸이 세계 안에서 하는 일이므로 interaction 이다 (command 가 아니다).
    // 시작과 해제가 따로 있다 — 토글이 아니라 명시값이어야 같은 요청이 두 번 와도 결과가 같다.
    case 'guard-begin':
      return ruleGuardBegin(actor, state.time);
    case 'guard-release':
      return ruleGuardRelease(actor);
    case 'move-mode':
      if (!action.mode) return { status: 'failure', rule: DISPATCH, reason: 'missing-mode' };
      return ruleMoveMode(actor, action.mode);
    case 'set-attribute': {
      // 대상을 밝히지 않으면 자기 몸이다 — 가장 흔한 쓰임을 짧게 둔다.
      const targetId = action.targetEntityId ?? actor.id;
      if (!action.attribute)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-attribute' };
      return ruleAttributeSet(state, targetId, action.attribute.id, action.attribute.value);
    }
    default:
      return { status: 'failure', rule: DISPATCH, reason: 'unknown-interaction' };
  }
}
