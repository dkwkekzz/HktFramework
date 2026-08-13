// Cycle 합성 — Scope 안의 모듈을 순서대로 합쳐 하나의 Authoritative World 를 만든다.
//
// 커널에는 게임 규칙이 없다. 규칙이 없으면 아무 일도 일어나지 않는다 —
// "C001 까지 실행" 은 기능을 끄는 것이 아니라 C001 모듈까지만 합성하는 것이다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import type { CycleActionRule, CycleModule, CycleSimulationLaw, GameViewDraft } from './module';
import { resolveCycleScope, type CycleScope } from './scope';
import type { WorldSetup, WorldState } from './state';

export interface World {
  dispatch(action: ActionRequest): ActionResult;
  tick(dt: number): void;
  projectPlayerView(): GameViewSnapshot;
  /** 이 World 가 합성한 Cycle 범위 — 실행 정보이지 View 계약이 아니다 */
  readonly scope: CycleScope;
}

/** 어떤 Cycle 도 처리하지 않는 Action — 그 가능성은 아직 세계에 없다 */
export const NO_RULE = 'no-rule-in-cycle-scope';

export function composeWorld(registry: readonly CycleModule[], setup: WorldSetup): World {
  const scope = resolveCycleScope(setup.upToCycle, registry);

  // 뒤 Cycle 의 등록이 앞 Cycle 을 덮는다 (CHANGED) — Map 의 재대입이 그 의미다
  const rules = new Map<ActionRequest['type'], CycleActionRule>();
  const laws = new Map<string, CycleSimulationLaw>();
  const projectors: NonNullable<CycleModule['project']>[] = [];

  const state = {} as WorldState;
  for (const module of scope.modules) {
    module.seed?.(state, setup);
    for (const rule of module.rules ?? []) rules.set(rule.actionType, rule);
    for (const law of module.laws ?? []) laws.set(law.lawId, law);
    if (module.project) projectors.push(module.project);
  }

  return {
    scope,
    dispatch(action) {
      const rule = rules.get(action.type);
      if (!rule) return { status: 'failure', rule: NO_RULE, reason: `no-rule:${action.type}` };
      // actionType 으로 골라낸 Rule 이므로 이 Action 과 짝이 맞는다 (등록 시점에 타입 검사됨)
      return (rule.run as (s: WorldState, a: ActionRequest) => ActionResult)(state, action);
    },
    tick(dt) {
      for (const law of laws.values()) law.run(state, dt);
    },
    projectPlayerView() {
      const draft: GameViewDraft = {};
      for (const project of projectors) project(state, draft);
      return draft as GameViewSnapshot;
    },
  };
}
