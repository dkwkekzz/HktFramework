// mining 도메인 — 세계에서 무엇을 캐어 지니는가.
//
// 소유 필드 (base/actor.ts 의 [mining] 구획)
//   inventory
// 소유 State  WorldState.deposits (이 도메인의 비-Actor 존재)

import type { InteractionHandler, WorldSystem } from '../../../../../engine/world-kernel/content';
import type { EntityView, HudItemView, InteractionView } from '../../../protocol/gameview';
import { withActor, DISPATCH } from '../../base/interaction';
import type { ActorState } from '../../base/actor';
import type { WorldState } from '../../base/world-state';
import type { ProjectionContext, WorldDomain } from '../../domain';
import { hasMiningTool, itemCount } from './inventory';
import { evaluateMinePreconditions, ruleMine, ruleMineComplete } from './mine';

const interactions: readonly InteractionHandler<WorldState>[] = [
  {
    id: 'mine',
    handle: withActor((state, actor, action) => {
      if (!action.targetEntityId)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-target' };
      return ruleMine(state, actor, action.targetEntityId);
    }),
  },
];

// 이 도메인은 Tick 시스템을 내놓지 않는다 — 채굴의 진행은 base 의 행동 진행이 맡는다.
// 대신 완료 효과를 표 항목으로 내놓는다: 채굴 행동이 끝나면 무슨 일이 일어나는지는
// 이 도메인의 의미이고, base 는 그것을 알지 않는다.
const systems = {};

const actionCompletions = {
  /** RULE-MINE-COMPLETE-001 — 채굴 행동이 Duration 을 채운 순간의 획득 */
  mine: (state: WorldState, actor: ActorState) => {
    ruleMineComplete(state, actor);
  },
};

export const mining = {
  id: 'mining',
  interactions,
  systems,
  actionCompletions,
  projection: {
    entities(state: WorldState): EntityView[] {
      return state.deposits.map((deposit) => ({
        id: deposit.id,
        role: 'resource-deposit',
        state: deposit.resourceAmount > 0 ? 'available' : 'depleted',
        kind: deposit.resourceKind,
        position: { x: deposit.position.x, z: deposit.position.z },
        labelValue: deposit.resourceAmount,
      }));
    },
    interactions(state: WorldState, ctx: ProjectionContext): InteractionView[] {
      return state.deposits.map((deposit) => {
        const failure = evaluateMinePreconditions(ctx.self, deposit);
        return {
          id: 'mine',
          role: 'mine-deposit',
          targetEntityId: deposit.id,
          available: failure === null,
          ...(failure ? { reason: failure } : {}),
        };
      });
    },
    hud(_state: WorldState, ctx: ProjectionContext): HudItemView[] {
      return [
        { id: 'inventory.stone', kind: 'counter', value: itemCount(ctx.self.inventory, 'stone') },
        { id: 'tool.hasMiningTool', kind: 'flag', value: hasMiningTool(ctx.self.inventory) },
      ];
    },
  },
} satisfies WorldDomain;
