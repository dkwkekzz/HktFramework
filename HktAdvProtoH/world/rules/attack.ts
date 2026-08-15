// RULE-HIT-001 — Implements INTENT-HIT-REACTION-001
// Input          타격받은 Actor
// Preconditions  없음 — 피격은 상대의 사정을 묻지 않는다
// Transition     CurrentAction = hit (하던 행동을 중단시킨다)
// Result         Struck
//
// C002 의 RULE-ATTACK-001 은 C007 에서 RULE-SKILL-BEGIN-001 (rules/skill.ts) 로
// 일반화됐다 — 휘두름은 종류를 가진 스킬이며, 각 스킬은 자기 기력 수지와 고정 피해량과
// 행동 길이를 가진다. 기본 스킬(attack)의 행동 종류 이름은 그대로다.
//
// C006 CHANGED — RULE-ATTACK-COMPLETE-001(완료 순간 일괄 판정)은 폐지됐다.
// 판정은 RULE-SWING-STRIKE-001 (simulation/swing-strike.ts) 이 휘두름 구간의
// 접촉 시점마다 한다. 무엇이 맞는지는 완료 순간이 아니라 접촉이 정한다.
//
// C007 — 피격은 그 직후 잠시 기력 충전을 억누르는 배율 원천이기도 하다
// (semantic/combat.ts 의 HIT_CHARGE_FACTOR). "직후 잠시" 는 이 hit 행동이 이어지는 동안이다.

import type { ActorState } from '../semantic/actor';
import { beginAction } from './action-begin';

// RULE-HIT-001 — RULE-ACTION-BEGIN-001 을 거치지 않는 유일한 행동 진입이다.
// 피격은 그 캐릭터가 요청한 행동이 아니라 밖에서 일어난 일이기 때문이다.
// 이 예외는 여기 한 곳에만 있다.
//
// C010 — 쓰러진 몸은 피격 상태로 가지 않는다. downed 는 대체 불가능한 행동이며
// (INTENT-DOWNED-001), 관문을 건너뛰는 이 자리가 그 불가능을 깨서는 안 된다.
// C007 까지는 호출 순서(HIT 먼저 → STRIKE-DAMAGE 나중)가 이것을 보장했으나,
// C010 이 "막았는지를 알아야 부를지가 정해진다" 는 이유로 순서를 뒤집었으므로
// 순서에 기대던 보장을 여기 조건으로 명시한다. 새 게임 의미가 아니라 기존 의미의 유지다.
export function ruleHit(target: ActorState): void {
  if (target.currentAction.kind === 'downed') return;
  beginAction(target, 'hit');
}
