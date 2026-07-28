// Worker 브리지 프로토콜 (Phase 0 §0.4, 기획서 §38)
// 메시지 본문 타입은 기획서 §38 을 그대로 따르고, 요청-응답 상관용 envelope 만 덧붙인다.
import type { WorldStatePatch } from "./state";

export interface PlayerActionRequest {
  actionId: string;
  targetIds: string[];
}

export type WorkerRequest =
  | {
      type: "initialize_world";
      worldSeed: number;
      /** 생략 시 빈 세계 — Phase 5 부터 생성된 WorldDefinition 이 들어온다 */
      definition?: unknown;
    }
  | { type: "advance_time"; amount: number }
  | { type: "execute_player_action"; action: PlayerActionRequest }
  | { type: "request_snapshot" };

export type WorkerResponse =
  | { type: "world_initialized"; worldSeed: number; time: number }
  | { type: "state_patch"; patch: WorldStatePatch }
  | { type: "events_created"; events: unknown[] } // Phase 4 부터 실체
  | { type: "snapshot"; snapshot: unknown }
  // §38 외 추가: 요청 거부·실패 보고 (예: execute_player_action 은 Phase 7 전까지 미구현)
  | { type: "error"; message: string };

export interface RequestEnvelope {
  requestId: number;
  request: WorkerRequest;
}

export interface ResponseEnvelope {
  requestId: number;
  responses: WorkerResponse[];
}

// 코어를 Worker 없이도(테스트 headless) 같은 코드로 돌리기 위한 호스트 추상화 (Phase 0 §0.4)
export interface SimulationHost {
  request(request: WorkerRequest): Promise<WorkerResponse[]>;
}
