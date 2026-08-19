// debug 도메인 — 세계의 규칙 **밖에서** 세계에 손을 대는 자리.
//
// 소유 State  WorldState.debugAuthority
// 세계 안의 행동(다른 도메인의 interaction)과 다른 것이다 —
// Interaction 은 몸이 세계 안에서 하는 일이고, 여기 있는 것은 세계 밖에서 손을 대는 일이다.
// 값이 바뀐 뒤의 세계는 여전히 자기 규칙대로 굴러간다.

import type { InteractionHandler, WorldSystem } from '../../../../../engine/world-kernel/content';
import type { InteractionView } from '../../../protocol/gameview';
import { withActor, DISPATCH } from '../../base/interaction';
import type { WorldState } from '../../base/world-state';
import type { SnapshotFields, WorldDomain } from '../../domain';
import { evaluateAttributeSetAvailability, ruleAttributeSet } from './attribute-set';
import { projectCommandCatalog } from './command-catalog';

const interactions: readonly InteractionHandler<WorldState>[] = [
  {
    // C007 ADDED — 속성 변경만은 주체가 아니라 "지목한 존재" 를 대상으로 한다
    // (INTENT-ATTRIBUTE-MUTATE-001). 그래도 요청의 귀속은 그대로다 —
    // 세계가 모르는 관찰자는 아무것도 바꾸지 못한다.
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

const systems = {};

export const debug = {
  id: 'debug',
  interactions,
  systems,
  projection: {
    interactions(state: WorldState): InteractionView[] {
      // interactions.setAttribute (C007 R2) — 세계가 권한을 닫아 두면 가용하지 않다.
      const failure = evaluateAttributeSetAvailability(state);
      return [
        {
          id: 'set-attribute',
          role: 'debug-set-attribute',
          available: failure === null,
          ...(failure ? { reason: failure } : {}),
        },
      ];
    },
    snapshotFields(state: WorldState): SnapshotFields {
      return {
        // World.DebugAuthority (C007 R2) — 이 세계가 조작을 허용하는가.
        debug: { open: state.debugAuthority.open },
        // World.CommandCatalog (C009 ADDED) — 세계 밖에서 무엇을 걸 수 있는지 세계가 밝힌다.
        // 늘 실린다: 걸 수 있는 것은 언제나 먼저 밝혀져 있어야 하고
        // (INTENT-COMMAND-CATALOG-001), available 이 거짓이어도 무엇을 할 수 있는
        // 세계인지는 알 수 있어야 한다.
        commands: projectCommandCatalog((commandId) =>
          commandId === 'set-attribute' ? evaluateAttributeSetAvailability(state) : null,
        ),
      };
    },
  },
} satisfies WorldDomain;
