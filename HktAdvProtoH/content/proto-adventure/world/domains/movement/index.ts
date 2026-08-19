// movement 도메인 — 몸이 세계 안을 어떻게 나아가는가.
//
// 소유 필드 (base/actor.ts 의 [movement] 구획)
//   moveMode · moveSpeed · runSpeedMultiplier · position(이동으로 인한) · facing(이동으로 인한)
// 다른 도메인이 이 필드를 바꾸려면 여기의 함수를 부른다 (예: debug → ruleAttributeSet 은
// moveMode 를 MoveMode 타입으로 넣는다 · combat → 기력이 마르면 RULE-CP-RUN-DRAIN 이 걷기로 내린다).

import type { InteractionHandler, WorldSystem } from '../../../../../engine/world-kernel/content';
import type { HudItemView, InteractionView } from '../../../protocol/gameview';
import { withActor, DISPATCH } from '../../base/interaction';
import type { WorldState } from '../../base/world-state';
import type { ActorViewDraft, ProjectionContext, WorldDomain } from '../../domain';
import { evaluateMoveAvailability, ruleMove } from './move';
import { evaluateMoveModeRun, ruleMoveMode } from './move-mode';
import { ruleMoveProgress } from './move-progress';

const interactions: readonly InteractionHandler<WorldState>[] = [
  {
    id: 'move',
    handle: withActor((state, actor, action) => {
      if (!action.position)
        return { status: 'failure', rule: DISPATCH, reason: 'missing-position' };
      return ruleMove(state, actor, action.position);
    }),
  },
  {
    id: 'move-mode',
    handle: withActor((_state, actor, action) => {
      if (!action.mode) return { status: 'failure', rule: DISPATCH, reason: 'missing-mode' };
      return ruleMoveMode(actor, action.mode);
    }),
  },
];

const systems = {
  /** RULE-MOVE-PROGRESS-001 — 의도한 이동이 자리를 정한다 */
  progress: (state: WorldState, dt: number) => ruleMoveProgress(state, dt),
};

export const movement = {
  id: 'movement',
  interactions,
  systems,
  projection: {
    decorateActor(view: ActorViewDraft, actor): void {
      view.attributes.moveMode = actor.moveMode;
    },
    interactions(_state: WorldState, ctx: ProjectionContext): InteractionView[] {
      // 목적지는 요청 시점에만 알 수 있으므로 Availability 는 행동 대체 가능성만 판정한다.
      const moveFailure = evaluateMoveAvailability(ctx.self);
      // interactions.moveMode (C007) — 지금 달릴 수 있는가.
      // 걷기로 돌아오는 것은 언제나 된다.
      const runFailure = evaluateMoveModeRun(ctx.self);
      return [
        {
          id: 'move',
          role: 'move-to',
          available: moveFailure === null,
          ...(moveFailure ? { reason: moveFailure } : {}),
        },
        {
          id: 'move-mode',
          role: 'set-move-mode',
          available: runFailure === null,
          ...(runFailure ? { reason: runFailure } : {}),
        },
      ];
    },
    hud(_state: WorldState, ctx: ProjectionContext): HudItemView[] {
      return [{ id: 'self.moveMode', kind: 'label', value: ctx.self.moveMode }];
    },
  },
} satisfies WorldDomain;
