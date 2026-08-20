// World Semantic — 존재 사이의 태도 (C018 ADDED)
//
// 태도는 존재에 붙는 이름표가 아니라 **둘 사이의 값**이며 방향을 가진다
// (INTENT-RELATION-STANCE-001). A 가 B 를 어떻게 대하는가와 B 가 A 를 어떻게
// 대하는가는 서로 다른 값이다.
//
// 이 파일의 성질 셋이 이 Cycle 의 핵심이다.
//   1. 태도는 **저장되지 않는다.** 지금의 사실에서 유도한다 — Downed 와 Modifiers 가
//      그러한 것과 같은 자리다 (semantic/combat.ts 의 선례). 저장하면 태도가 기록이 되고,
//      기록이 되면 "물러나면 풀린다" 를 위해 지우는 규칙이 따로 필요해지며, 그 순간
//      원한이라는 개념이 뒷문으로 들어온다.
//   2. 태도를 낳는 사정은 **목록**이다 (HOSTILITY_REASONS). 판정은 목록을 읽을 뿐이며
//      사정을 자기 안에 적지 않는다. 지금 항목은 하나이고, 그것이 유일한 사정으로
//      정해진 것이 아니다 — 이후 Cycle 이 항목을 더해도 관문도 관찰도 바뀌지 않는다.
//   3. 사정은 **주체의 종류를 묻지 않는다.** 사람의 몸인지 자율 존재의 몸인지는 어떤
//      항목의 입력도 아니다. 해를 입을 수 있는지는 그 몸이 누구의 것이냐가 아니라
//      그 자리와 세계의 규칙이 정한다 (MA-HOSTILE-COMBATANT — 몬스터 전용 규칙을
//      만들지 않는다는 것과 같은 자리다).

import type { ActorState } from './actor';
import type { SkillKind } from './combat';
import { distance, type WorldPosition } from './position';

/** 한쪽에서 본 태도 — 눈금이 아니라 갈래다 */
export type Stance = 'hostile' | 'neutral' | 'friendly';

/**
 * Actor.GuardedGround — 그 존재가 지키는 자리 (INTENT-STANCE-FROM-GUARDED-GROUND-001).
 *
 * 세계가 나눈 구역이 아니라 **그 존재가 지닌 것**이다. 세계에 지역이라는 개념을
 * 만들지 않는다 — 무대는 여전히 성질 없는 하나다.
 *
 * 중심은 고정된 자리이며 **몸을 따라다니지 않는다.** 따라다니면 "지킨다" 가
 * "쫓아다닌다" 가 되어 사냥터의 뜻이 사라진다.
 *
 * 어떤 몸이든 지닐 수 있다 — 자율 존재만의 성질이 아니다.
 */
export interface GuardedGround {
  center: WorldPosition;
  radius: number;
}

/** 그 자리 안에 있는가 — 몸의 반경을 더하지 않는다. 걸치는 것이 아니라 들어와 있는가를 묻는다 */
export function isInsideGuardedGround(ground: GuardedGround, position: WorldPosition): boolean {
  return distance(ground.center, position) <= ground.radius;
}

/**
 * 적대를 낳는 사정 하나. `holds(a, b)` 는 "a 가 b 를 사냥감으로 대하는가" 를 답한다.
 * 방향이 있다 — (a, b) 와 (b, a) 는 다른 물음이다.
 */
export interface HostilityReason {
  id: string;
  holds(a: ActorState, b: ActorState): boolean;
}

/**
 * HOSTILITY_REASONS — 적대를 낳는 사정들. **이 목록의 단일 출처는 여기다.**
 *
 * 지금 항목은 하나다. NPC · 몬스터 · 진영 · 결투 등 무엇이 적대의 이유가 되는지는
 * 이후 Cycle 이 이 배열에 항목을 더하며 정하고, 그때 RULE-HARM-GATE-001 도
 * Observer Projection 도 고치지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
export const HOSTILITY_REASONS: readonly HostilityReason[] = [
  {
    // 지키는 자리에 들었다 — MA-HOSTILE-COMBATANT · MG-HOLD-HUNTING-GROUND (BW §21 · §26).
    // 플레이어를 위해 배치된 성질이 아니라 그 존재가 살아가려는 목적의 결과다.
    id: 'guarded-ground-intruded',
    holds: (a, b) => a.guardedGround !== null && isInsideGuardedGround(a.guardedGround, b.position),
  },
];

/** 왜 닿았는데 아무 일도 일어나지 않았는가 (C018 ADDED) */
export type UnharmedReason = 'not-hostile';

/**
 * World.UnharmedContacts — 닿았으나 해가 성립하지 않은 접촉.
 *
 * World.StrikeEvents 와 나란한 자리이며 같은 수명을 가진다 (STRIKE_EVENT_TTL).
 * 타격 결과 안에 담지 않는 이유: 타격 결과는 피해 산정 경위를 **반드시** 지니는데
 * 성립하지 않은 접촉에는 산정이 없다. 담으려면 경위를 없을 수 있는 것으로 바꿔야 하고,
 * 그러면 이미 있는 모든 타격 결과의 모양이 헐거워진다.
 * 성립하지 않은 접촉은 타격이 아니다 (INTENT-HIT-REACTION-001 CHANGED).
 */
export interface UnharmedContact {
  attackerId: string;
  targetId: string;
  skill: SkillKind;
  position: WorldPosition;
  time: number;
  reason: UnharmedReason;
}
