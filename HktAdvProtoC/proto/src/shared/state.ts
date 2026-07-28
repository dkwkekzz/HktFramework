// 세계 상태의 순수 데이터 형태 (기획서 §9.1)
// shared 에 두는 이유: patch 로 경계(Worker↔메인, core↔viewmodel)를 넘는 직렬화 데이터이기 때문.
// 행동(메서드)을 가진 런타임 구조는 core/world 에 있다.

export interface Position {
  regionId: string;
  x: number;
  y: number;
}

export type EntityType = "agent" | "resource" | "location" | "faction";

export interface EntityState {
  id: string;
  type: EntityType;
  position?: Position;
  states: Record<string, unknown>;
  tags: string[];
  /** Phase 3 에서 ActiveGoalState[] 로 실체화 */
  activeGoals?: unknown[];
}

export interface WorldState {
  simulationTime: number;
  entities: Record<string, EntityState>;
  /** Phase 3 에서 RelationshipState 로 실체화 (기획서 §25) */
  relationships: Record<string, unknown>;
  globalStates: Record<string, unknown>;
}

// 변경분만 전달하는 patch (기획서 §38 — "전체 월드 상태를 매 프레임 전달하지 않는다")
export interface WorldStatePatch {
  time: number;
  upserts: EntityState[];
  removedIds: string[];
  globalStates?: Record<string, unknown>;
}

export function createEmptyWorldState(): WorldState {
  return { simulationTime: 0, entities: {}, relationships: {}, globalStates: {} };
}
