// Authoritative World — 논리적 Server 경계 (Rule 3·4, §21 Local Runtime).
// World State 는 이 클래스 내부에만 존재하고, 변경 경로는 applyCommand → Rule 뿐이다.
// 외부에는 deep-frozen snapshot 과 Transition log 만 노출한다.

import { validateCommand, type Command } from './commands';
import { ruleMine, ruleMove } from './rules';
import type { ActorState, DepositState, TransitionRecord, WorldState } from './types';

export interface WorldConfig {
  actors: ActorState[];
  deposits: DepositState[];
}

const TRANSITION_LOG_LIMIT = 256;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

export class AuthoritativeWorld {
  private state: WorldState;
  private transitions: TransitionRecord[] = [];

  constructor(config: WorldConfig) {
    this.state = {
      tick: 0,
      actors: Object.fromEntries(config.actors.map((a) => [a.id, structuredClone(a)])),
      deposits: Object.fromEntries(config.deposits.map((d) => [d.id, structuredClone(d)])),
    };
  }

  // Client 입력 경계 — 의도만 수용, 결과 필드는 거부 (Rule 4)
  applyCommand(cmd: Command): TransitionRecord | null {
    const rejection = validateCommand(cmd);
    if (rejection) return null; // Command 자체가 거부되면 Rule 까지 가지 않는다

    let outcome: { record: TransitionRecord };
    switch (cmd.id) {
      case 'CMD-MOVE-V1':
        outcome = ruleMove(this.state, cmd.actorId, cmd.direction);
        break;
      case 'CMD-MINE-V1':
        outcome = ruleMine(this.state, cmd.actorId, cmd.depositId);
        break;
    }
    this.transitions.push(outcome.record);
    if (this.transitions.length > TRANSITION_LOG_LIMIT) this.transitions.shift();
    return outcome.record;
  }

  // 세계 시간 전진 — 행위 지속(CurrentAction=Mine)의 만료도 세계가 결정한다
  tick(): void {
    this.state.tick += 1;
    for (const actor of Object.values(this.state.actors)) {
      if (actor.currentAction === 'Mine') {
        actor.actionTicksRemaining -= 1;
        if (actor.actionTicksRemaining <= 0) {
          actor.currentAction = 'Idle';
          actor.actionTicksRemaining = 0;
        }
      }
    }
  }

  // Observer Projection 전용 읽기 — 변경 불가능한 snapshot
  snapshot(): Readonly<WorldState> {
    return deepFreeze(structuredClone(this.state));
  }

  transitionLog(): ReadonlyArray<TransitionRecord> {
    return deepFreeze(structuredClone(this.transitions));
  }
}
