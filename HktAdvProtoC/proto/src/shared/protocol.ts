// Worker 브리지 프로토콜 (Phase 0 §0.4, 기획서 §38)
// 메시지 본문 타입은 기획서 §38 을 그대로 따르고, 요청-응답 상관용 envelope 만 덧붙인다.
//
// Phase 8 부터 **세계 생성도 이 경계 뒤에서 돈다**(§38 "메인 스레드는 화면 렌더링").
// 그래서 화면은 CompilerPipeline·WorldDefinition·content/ 를 import 하지 않는다 —
// 경계를 넘는 것은 표시 속성(GenerationViewModel · SceneViewPayload)뿐이다(분해 원칙 5).
import type { GenerationViewModel } from "../viewmodel/GenerationViewModel";
import type { SceneViewMode, SceneViewPayload } from "../viewmodel/SceneViewModel";
import type { PlayerActionOutcome, PlayerKnowledgeView } from "./player";
import type { WorldStatePatch } from "./state";

export interface PlayerActionRequest {
  actionId: string;
  targetIds: string[];
}

/** §4 WorldSeedInput 의 화면 입력분 — 자유 문장 몇 줄이 전부다 */
export interface WorldSeedInputMessage {
  title: string;
  themes: string[];
  desiredExperiences: string[];
  prohibitedElements: string[];
}

/** 어느 세계를 올릴 것인가 — 정의 자체는 경계를 넘지 않는다 */
export type WorldKind = "manual" | "player" | "generated";

/**
 * §3 아키텍처 모듈 한 단의 처리 보고 (Phase-9 §9.1).
 * 제작 국면의 정적 파이프라인(모듈 1~6)이 **무엇을 가공해 무엇을 남겼는가**를 표시 속성으로 옮긴 것.
 * 패키지 자체는 불투명하지만, 이 보고는 화면이 ✓/✗ 와 수치로 그대로 보여 준다.
 */
export interface WorldPackageStageBadge {
  /** §3 모듈 순번·이름 (`1.seed` ~ `6.interpret`) */
  id: string;
  title: string;
  ok: boolean;
  evidence: string;
}

/**
 * 플레이 모드 주체 선택 카드의 재료 (Phase-9 §9.2).
 * 조작 가능한 주체(조직 제외 §17)의 표시 속성만 — 정의·런타임 구조는 실리지 않는다.
 */
export interface PlayableAgentCard {
  id: string;
  label: string;
  speciesLabel: string;
  regionLabel: string;
  badges: { key: string; value: string }[];
}

export type WorkerRequest =
  | {
      type: "initialize_world";
      worldSeed: number;
      /**
       * manual=Phase 1 수동 세계(기본), player=Phase 7 개입 층, generated=방금 생성한 세계.
       * Phase 8 부터 **화면은 이 이름만 보낸다** — 정의를 들고 있다가 되돌려 보내는 경로가 없다(§38).
       */
      world?: WorldKind;
      /**
       * 정의를 직접 실어 보내는 경로. headless 테스트·검증 스크립트(같은 프로세스에서 코어를 아는 호출자)만 쓴다.
       * 화면은 core/content/generation 을 import 할 수 없으므로(린트) 이 필드를 채울 방법이 없다.
       */
      definition?: unknown;
      /**
       * 세계 패키지(Phase-9 §9.1) — export_world 가 만든 **불투명 직렬화 문자열**.
       * 화면은 내용을 해석하지 않고 보관·전달만 한다(분해 원칙 5). 파싱·재검증은 서버의 몫이다.
       */
      package?: string;
    }
  | { type: "advance_time"; amount: number }
  | { type: "execute_player_action"; action: PlayerActionRequest }
  | { type: "request_snapshot" }
  // §38 예시 메시지 외 Phase 7 확장 — 사용자가 조작을 시작·중단하고 성장 선택을 답하는 통로
  | { type: "attach_player"; agentId: string }
  | { type: "detach_player" }
  | { type: "accept_growth"; offerId: string; optionId: string }
  // Phase 8 확장 — 화면 시점(§36.3 모드) · 시간 배속(§36.2) · 사건 열기(§36.4)
  | { type: "set_view"; mode?: SceneViewMode; agentId?: string | null; eventId?: string | null }
  | { type: "set_speed"; speed: number }
  // Phase 8 확장 — §36.1 세계 생성 + 승격분(항목 재생성 = Phase-6 §6.3 증분 재실행)
  | { type: "generate_world"; worldSeed: number; seedInput: WorldSeedInputMessage }
  | { type: "regenerate_step"; stepId: string }
  /** §36.1 입력 칸의 기본값 — 녹화 코퍼스를 가진 쪽이 알려준다(화면은 content/ 를 모른다) */
  | { type: "request_seed_input" }
  // Phase-9 §9.1 — 세계 패키지: 생성과 플레이를 잇는 유일한 통로 (저장은 화면 쪽 WorldLibrary 의 몫)
  | { type: "export_world"; world: WorldKind; worldSeed: number }
  // Phase-9 §9.2 — 플레이 진입 절차 ②: 조작 가능한 주체 목록
  | { type: "request_playable_agents" }
  // Phase-9 §9.3 — MMORPG 이동: 현재 지역 안 목표점으로 달린다 (서버가 clamp·검증)
  | { type: "player_move"; x: number; y: number }
  // Phase-9 §9.3 — §13 연결을 따라 지역을 건넌다 (canCross 검증)
  | { type: "player_travel"; toRegionId: string };

export type WorkerResponse =
  | { type: "world_initialized"; worldSeed: number; time: number }
  | { type: "state_patch"; patch: WorldStatePatch }
  | { type: "events_created"; events: unknown[] } // Phase 4 부터 실체
  | { type: "snapshot"; snapshot: unknown }
  // §38 외 추가: 요청 거부·실패 보고
  | { type: "error"; message: string }
  /**
   * 플레이어가 볼 수 있는 전부 (§31, Phase-7 §7.2).
   * 세계의 실제 상태가 아니라 **지식 필터를 통과한 뒤**의 데이터다 — 경계를 넘기 전에 이미 걸러진다.
   */
  | { type: "player_view"; view: PlayerKnowledgeView }
  | { type: "player_action_result"; outcome: PlayerActionOutcome }
  /** §36.2~§36.4 화면의 표시 재료 — 빌더가 이미 해석을 끝낸 속성만 실린다 (Phase-8 §8.0) */
  | { type: "scene_view"; view: SceneViewPayload }
  /** §36.1 생성 화면의 표시 재료 */
  | { type: "generation_view"; view: GenerationViewModel }
  /** §4 입력의 기본값 (§41 첫 세계의 다섯 문장) */
  | { type: "seed_input"; input: WorldSeedInputMessage }
  /**
   * Phase-9 §9.1 — 직렬화된 세계 패키지. json 은 화면에게 불투명하다.
   * stages 는 §3 모듈 1~6 의 처리 보고 — 화면은 ✓/✗ 와 수치를 그대로 보여 준다.
   */
  | { type: "world_package"; worldId: string; label: string; json: string; stages: WorldPackageStageBadge[] }
  /** Phase-9 §9.2 — 플레이 진입 절차 ②의 표시 재료 */
  | { type: "playable_agents"; agents: PlayableAgentCard[] };

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
