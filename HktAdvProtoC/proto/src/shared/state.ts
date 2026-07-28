// 세계 상태의 순수 데이터 형태 (기획서 §9.1)
// shared 에 두는 이유: patch 로 경계(Worker↔메인, core↔viewmodel)를 넘는 직렬화 데이터이기 때문.
// 행동(메서드)을 가진 런타임 구조는 core/world 에 있다.
import type { ActiveGoalState, AgentRuntimeState, RelationshipState } from "./beliefs";
import type { RawWorldChange } from "./change";
import { createEmptyEventsState, type EventsState } from "./events";
import type { ObservationSignal } from "./observation";

// 공간 데이터는 3D 다 (기획서 §13 개정) — x·y 수평, z 고도.
// 거리·반경·관찰 계산은 전부 3D 유클리드 거리를 사용한다. 렌더링의 2D 투영은 ViewModel 빌더의 몫.
export interface Position {
  regionId: string;
  x: number;
  y: number;
  z: number;
}

/** 3D 유클리드 거리 — 같은 지역 내에서만 의미가 있다 (지역 간은 연결 그래프 §13) */
export function distance3d(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export type EntityType = "agent" | "resource" | "location" | "faction";

export interface EntityState {
  id: string;
  type: EntityType;
  position?: Position;
  states: Record<string, unknown>;
  tags: string[];
  /** 현재 활성 목적 목록 (§19) — Phase 1 은 baseImportance+urgency 로만 계산한다 */
  activeGoals?: ActiveGoalState[];
}

export interface WorldState {
  simulationTime: number;
  entities: Record<string, EntityState>;
  /** 관계 저장소 (§25) — 키는 `from|to`, 값은 RelationshipState 전 필드 */
  relationships: Record<string, RelationshipState>;
  globalStates: Record<string, unknown>;
  /** 주체 런타임 상태 (§20) — 믿음·현재 행동·재판단 플래그 */
  agentRuntimes: Record<string, AgentRuntimeState>;
  /** 아직 인식되지 않은 관찰 신호 대기열 (§23) — 매 처리 단계에서 비워진다 */
  pendingSignals: ObservationSignal[];
  /** 상태 변화 원시 로그 (§28) — Phase 4 사건 탐지의 입력 */
  changeLog: RawWorldChange[];
  /** change id 발급 카운터 — 로그가 잘려도 id 는 재사용되지 않는다 */
  changeSeq: number;
  /** 탐지된 사건 (§28~§30) — change 로그의 해석이지 세계 상태의 원인이 아니다 */
  events: EventsState;
  /** 신호 id 발급 카운터 — 시드 무관하게 순번으로만 증가한다(결정론) */
  signalSeq: number;
  /** create_entity(§11.3) 가 발급하는 개체 id 순번 */
  entitySeq: number;
  /** schedule_rule(§11.3) 이 발급하는 예약 이벤트 순번 */
  ruleEventSeq: number;
  /** 규칙 쿨다운(§11 cooldown) 마지막 발동 시각 — 스냅샷에 실려야 복원 후에도 같은 흐름이 된다 */
  ruleCooldowns: Record<string, number>;
}

// 변경분만 전달하는 patch (기획서 §38 — "전체 월드 상태를 매 프레임 전달하지 않는다")
export interface WorldStatePatch {
  time: number;
  upserts: EntityState[];
  removedIds: string[];
  globalStates?: Record<string, unknown>;
}

export function createEmptyWorldState(): WorldState {
  return {
    simulationTime: 0,
    entities: {},
    relationships: {},
    globalStates: {},
    agentRuntimes: {},
    pendingSignals: [],
    changeLog: [],
    changeSeq: 0,
    events: createEmptyEventsState(),
    signalSeq: 0,
    entitySeq: 0,
    ruleEventSeq: 0,
    ruleCooldowns: {},
  };
}
