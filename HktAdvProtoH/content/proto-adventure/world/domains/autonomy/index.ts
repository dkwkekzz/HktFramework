// autonomy 도메인 — 조종되지 않는 몸이 스스로 무엇을 결정하는가.
//
// 소유 필드 (base/actor.ts 의 [autonomy] 구획)
//   control · perceptionRange · wanderPath · wanderIndex
// 이 도메인은 밖에서 부를 interaction 을 내놓지 않는다 — 결정은 요청이 아니라 세계 규칙이다.
// 결정의 결과는 다른 도메인의 함수를 부르는 것으로 이뤄진다 (movement.ruleMove ·
// combat.ruleSkillBegin) — 읽기는 자유, 쓰기는 소유 도메인의 함수로.

import type { InteractionHandler, WorldSystem } from '../../../../../engine/world-kernel/content';
import type { WorldState } from '../../base/world-state';
import type { WorldDomain } from '../../domain';
import { ruleNpcDecideAll } from './npc-decide';

const interactions: readonly InteractionHandler<WorldState>[] = [];

const systems = {
  /** RULE-NPC-DECIDE-001 — 자율 존재가 이 Tick 에 무엇을 할지 정한다 */
  decide: (state: WorldState) => ruleNpcDecideAll(state),
};

export const autonomy = {
  id: 'autonomy',
  interactions,
  systems,
} satisfies WorldDomain;
