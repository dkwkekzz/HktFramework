// base — 어느 도메인도 없이 성립하는 세계 골격의 파츠 상자.
//
// 세계에 무엇이 있든 변하지 않는 것들만 여기 있다: 몸 한 벌(State), 행동 상태 기계,
// 종류 카탈로그, 몸의 물리, 그리고 투영 조립기.
// 도메인은 이 골격 위에 자기 의미(부품)를 얹는다.
//
// 사실 1 — 여기 담긴 시스템도 자기 순서를 소유하지 않는다.
// 이름만 내놓고 순서는 world/index.ts 의 단일 배열이 정한다.

import type { WorldSystem } from '../../../../engine/world-kernel/content';
import type { WorldState } from './world-state';
import { ruleActionProgress, type ActionCompletions } from './action-progress';
import { ruleBodyMomentum } from './body-momentum';
import { ruleBodyPush } from './body-push';

/**
 * 세계 골격의 시스템 한 벌.
 * 행동 완료 효과 표를 받는 이유: 어느 행동이 끝날 때 무슨 일이 일어나는지는 **도메인의 것**이고
 * (mine → RULE-MINE-COMPLETE-001), base 는 그것을 알지 않는다. 표는 조립이 모아 넘긴다.
 */
export function createSystems(completions: ActionCompletions) {
  const systems = {
    /** RULE-ACTION-PROGRESS-001 — 행동이 시간을 먹고 끝난다 */
    actionProgress: (state: WorldState, dt: number) =>
      ruleActionProgress(state, dt, completions),
    /** RULE-BODY-PUSH-001 — 겹친 몸이 서로를 밀어낸다 */
    bodyPush: (state: WorldState, dt: number) => {
      ruleBodyPush(state, dt);
    },
    /** RULE-BODY-MOMENTUM-001 — 힘이 만든 속도가 몸을 옮기고 잦아든다 */
    bodyMomentum: (state: WorldState, dt: number) => ruleBodyMomentum(state, dt),
  };
  // 형만 확인한다 — 키 이름을 잃지 않기 위해 주석(annotation)이 아니라 satisfies 를 쓴다.
  void (systems satisfies Readonly<Record<string, WorldSystem<WorldState>>>);
  return systems;
}
