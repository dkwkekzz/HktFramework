// World Kernel — Authoritative World 의 껍데기 (P1 CHANGED, 구 world/index.ts 의 프레임)
//
// State 는 이 모듈 안에만 존재한다. 밖으로 나가는 것은 Tick 이 내보내는 관찰 결과뿐이고,
// 안으로 들어오는 것은 참여/이탈/표식과 Action Request 뿐이다 (World Authority).
//
// 무엇이 있는 세계인지(초기 배치·Rule·투영)는 컨텐츠 팩이 WorldContent 로 등록하고,
// 이 커널은 그 계약 위에서 인과의 순서만 돌린다.

import type { ActionRequest } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import type { InteractionHandler, WorldContent } from './content';
import type { CoreWorldState } from './state';
import {
  runWorldTick,
  type PendingObserverEvent,
  type PendingRequest,
  type WorldTickResult,
} from './tick';

// C003 CHANGED — 세계는 요청을 "받아 두고" 자기 Tick 에 판정한다.
// C004 CHANGED — 관찰자가 누구인지 세계가 알아야 하므로 참여/이탈이 경계에 생겼고,
//                요청은 어느 이어짐으로 왔는지와 함께 도착한다.
//                외부가 상태를 읽어 가는 경로(pull)는 여전히 없다.
export interface World {
  /** 관찰자가 자신을 밝히고 들어온다. 다음 Tick 이 RULE-OBSERVER-JOIN-001 로 판정한다 */
  join(observerId: string): void;
  /** 관찰자가 이어짐을 잃었다. 다음 Tick 이 RULE-OBSERVER-LEAVE-001 로 판정한다 */
  leave(observerId: string): void;
  /** 요청이 세계에 도착한다. 즉시 판정되지 않는다 (INTENT-REMOTE-REQUEST-001) */
  request(observerId: string, action: ActionRequest): void;
  /**
   * 관찰자의 표식이 세계에 도착한다 (C005). 게임을 아무것도 바꾸지 않는다 —
   * 다음 Tick 이 RULE-OBSERVER-MARK-001 로 받아들이고, 받아들인 자리가
   * 그 관찰자의 관찰 결과에 실려 돌아간다.
   */
  mark(observerId: string, mark: number): void;
  /** RULE-WORLD-TICK-001 — 세계의 시계만이 부른다 (검증 시에는 테스트가 직접 부른다) */
  tick(dt: number): WorldTickResult;
  /** 그 관찰자에게 마지막으로 나간 관찰 결과. 새로 만들지 않는다 */
  latestObservation(observerId: string): GameViewSnapshot | null;
}

export function createWorldKernel<S extends CoreWorldState>(
  state: S,
  content: WorldContent<S>,
): World {
  // 도착했지만 아직 처리되지 않은 것들 — 다음 Tick 의 처리 대상이다.
  const pendingObservers: PendingObserverEvent[] = [];
  const pending: PendingRequest[] = [];
  // 관찰자마다 마지막으로 나간 관찰 결과. 세계는 이미 내보낸 것을 되돌려줄 뿐이다.
  const latest = new Map<string, GameViewSnapshot>();
  // 등록된 interaction — 같은 id 가 두 번 등록되면 나중 것이 이긴다 (팩 안의 일이다).
  const handlers = new Map<string, InteractionHandler<S>>(
    content.interactions.map((handler) => [handler.id, handler]),
  );

  return {
    join: (observerId) => {
      pendingObservers.push({ kind: 'join', observerId });
    },
    leave: (observerId) => {
      pendingObservers.push({ kind: 'leave', observerId });
    },
    request: (observerId, action) => {
      pending.push({ observerId, action });
    },
    mark: (observerId, mark) => {
      pendingObservers.push({ kind: 'mark', observerId, mark });
    },
    tick: (dt) => {
      const result = runWorldTick(state, dt, pendingObservers, pending, content, handlers);
      for (const [observerId, snapshot] of result.observations) latest.set(observerId, snapshot);
      return result;
    },
    latestObservation: (observerId) => latest.get(observerId) ?? null,
  };
}
