// 기억 시스템 (기획서 §24 / Phase-3 §3.3)
//
// 기억은 사건의 사본이 아니다. 중요도에 따라 남고, 희미해지고, 요약 믿음으로 접힌다.
// "모든 사건을 영구 저장하면 데이터가 무한히 증가한다"(§24 첫 문장)가 이 모듈의 존재 이유다.
import type { AgentRuntimeState, BeliefRecord, MemoryRecord } from "../../shared/beliefs";
import type { WorldRuntime } from "../world/WorldRuntime";
import { upsertBelief } from "./BeliefStore";
import { relationshipView } from "./RelationshipSystem";

/** 주체당 기억 수 상한 (§24 — 무한 증가 방지) */
export const MEMORY_CAPACITY = 64;
/** 이 중요도 아래의 기억은 요약 통합 대상이다 */
export const CONSOLIDATION_THRESHOLD = 28;
/** 요약으로 접기 위한 최소 군집 크기 (§24 "상인 A에게 세 번") */
export const CONSOLIDATION_MIN_COUNT = 3;
/** 이 아래로 떨어진 기억은 사라진다 */
export const FORGET_THRESHOLD = 6;

/** 생존과 직결된 기억 태그 — §24 survivalRelevance 의 판정 기준 */
const SURVIVAL_TAGS = ["threat", "attack", "injury", "food", "hunger", "danger", "creature"];

export interface MemoryDraft {
  type: MemoryRecord["type"];
  participants: string[];
  tags: string[];
  emotionalIntensity: number;
  relevance: number;
  confidence: number;
  decayRate?: number;
  interpretation?: MemoryRecord["interpretation"];
}

/** 기본 감쇠율 — 강렬한 기억일수록 천천히 잊힌다 */
function defaultDecayRate(draft: MemoryDraft): number {
  return Math.max(0.4, 4 - draft.emotionalIntensity / 25);
}

function summarize(draft: MemoryDraft): string {
  // 사람이 읽는 문장은 Presentation(Phase 8)의 몫 — 여기서는 태그 조합의 기계 요약이다
  return `${draft.type}:${[...draft.tags].sort().join("+")}@${[...draft.participants].sort().join(",")}`;
}

function relationshipRelevance(
  runtime: WorldRuntime,
  agent: AgentRuntimeState,
  memory: MemoryRecord | MemoryDraft,
): number {
  let strongest = 0;
  for (const participant of memory.participants) {
    if (participant === agent.agentId) continue;
    const relation = relationshipView(runtime, agent.agentId, participant);
    const magnitude = Math.max(
      Math.abs(relation.trust),
      relation.fear,
      relation.resentment,
      Math.abs(relation.affection),
      relation.dependency,
    );
    if (magnitude > strongest) strongest = magnitude;
  }
  return strongest;
}

function survivalRelevance(
  runtime: WorldRuntime,
  agent: AgentRuntimeState,
  memory: MemoryRecord | MemoryDraft,
): number {
  if (!memory.tags.some((tag) => SURVIVAL_TAGS.includes(tag))) return 0;
  if (runtime.store.findEntity(agent.agentId) === undefined) return 0;
  // 조직의 생존 지표는 survivalPressure 가 아니라 crisis 다 (§17) — agent 스키마를 조직에 읽지 않는다
  const stateKey = agent.kind === "faction" ? "crisis" : "survivalPressure";
  const schema = runtime.schemas.find(agent.kind === "faction" ? "faction" : "agent", stateKey);
  if (schema === undefined) return 0;
  const pressure = runtime.store.read(agent.agentId, stateKey);
  return typeof pressure === "number" ? pressure : 0;
}

/** §24 calculateMemoryImportance — 계수 그대로 (0.4 / 0.3 / 0.2 / 0.4) */
export function calculateMemoryImportance(
  runtime: WorldRuntime,
  agent: AgentRuntimeState,
  memory: MemoryRecord | MemoryDraft,
): number {
  return (
    memory.emotionalIntensity * 0.4 +
    memory.relevance * 0.3 +
    relationshipRelevance(runtime, agent, memory) * 0.2 +
    survivalRelevance(runtime, agent, memory) * 0.4
  );
}

/** 기억 생성 — 관찰 성공·상호작용·성공/실패·약속/배신에서 부른다 (§24 생성 시점) */
export function rememberEvent(
  runtime: WorldRuntime,
  agentId: string,
  draft: MemoryDraft,
): MemoryRecord | undefined {
  const agent = runtime.state.agentRuntimes[agentId];
  if (agent === undefined) return undefined;
  const memory: MemoryRecord = {
    id: `memory.${agentId}.${agent.memorySeq++}`,
    type: draft.type,
    participants: [...draft.participants].sort(),
    tags: [...draft.tags].sort(),
    emotionalIntensity: draft.emotionalIntensity,
    relevance: draft.relevance,
    confidence: draft.confidence,
    createdAt: runtime.state.simulationTime,
    decayRate: draft.decayRate ?? defaultDecayRate(draft),
    summary: summarize(draft),
    ...(draft.interpretation !== undefined ? { interpretation: draft.interpretation } : {}),
  };
  agent.memories.push(memory);
  enforceCapacity(runtime, agent);
  return memory;
}

/** 상한 초과분은 중요도가 낮은 것부터 버린다 */
function enforceCapacity(runtime: WorldRuntime, agent: AgentRuntimeState): void {
  if (agent.memories.length <= MEMORY_CAPACITY) return;
  const ranked = [...agent.memories].sort((a, b) => {
    const diff =
      calculateMemoryImportance(runtime, agent, b) - calculateMemoryImportance(runtime, agent, a);
    return diff === 0 ? a.id.localeCompare(b.id) : diff;
  });
  const kept = new Set(ranked.slice(0, MEMORY_CAPACITY).map((m) => m.id));
  agent.memories = agent.memories.filter((m) => kept.has(m.id));
}

/** 신호 태그와 겹치는 기억 — §23 "기억 대조" 단계의 질의 */
export function recallByTags(
  agent: AgentRuntimeState,
  tags: string[],
  subjectId?: string,
): MemoryRecord[] {
  return agent.memories
    .filter((memory) => {
      if (subjectId !== undefined && !memory.participants.includes(subjectId)) return false;
      return memory.tags.some((tag) => tags.includes(tag));
    })
    .sort((a, b) => (b.relevance === a.relevance ? a.id.localeCompare(b.id) : b.relevance - a.relevance));
}

// --- 일일 유지 (§24 감쇠 · 요약 통합) ---------------------------------------------

function consolidationGroupKey(memory: MemoryRecord): string {
  return `${memory.participants.join(",")}|${memory.tags[0] ?? "-"}`;
}

export interface MemoryMaintenanceResult {
  agentId: string;
  decayed: number;
  forgotten: number;
  consolidated: number;
  summaryBeliefs: string[];
}

/**
 * 하루 한 번의 기억 정리.
 *   ① relevance -= decayRate
 *   ② 저중요도 기억이 같은 (참여자, 태그) 로 3개 이상 모이면 → 요약 믿음 하나로 접는다(§24 상인 예시)
 *   ③ 그래도 남은 저중요도 기억은 잊는다
 *   ④ 상한(64) 유지
 */
export function maintainMemories(runtime: WorldRuntime, agentId: string): MemoryMaintenanceResult {
  const agent = runtime.state.agentRuntimes[agentId];
  const result: MemoryMaintenanceResult = {
    agentId,
    decayed: 0,
    forgotten: 0,
    consolidated: 0,
    summaryBeliefs: [],
  };
  if (agent === undefined) return result;

  for (const memory of agent.memories) {
    memory.relevance = Math.max(0, memory.relevance - memory.decayRate);
    result.decayed += 1;
  }

  // ② 요약 통합
  const groups = new Map<string, MemoryRecord[]>();
  for (const memory of agent.memories) {
    if (calculateMemoryImportance(runtime, agent, memory) >= CONSOLIDATION_THRESHOLD) continue;
    if (memory.type === "discovery") continue; // 이미 요약된 기억은 다시 접지 않는다
    const key = consolidationGroupKey(memory);
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [memory]);
    else list.push(memory);
  }

  const removed = new Set<string>();
  for (const key of [...groups.keys()].sort()) {
    const group = groups.get(key)!;
    if (group.length < CONSOLIDATION_MIN_COUNT) continue;
    const subjectId = group[0]!.participants.find((id) => id !== agentId);
    const tag = group[0]!.tags[0] ?? "event";
    const confidence =
      group.reduce((sum, memory) => sum + memory.confidence, 0) / group.length;

    if (subjectId !== undefined) {
      const record: BeliefRecord = {
        subjectId,
        stateKey: `tendency:${tag}`,
        believedValue: group.length,
        confidence: Math.min(1, confidence + 0.1),
        sourceIds: group.map((memory) => memory.id).slice(-4),
        lastUpdatedAt: runtime.state.simulationTime,
      };
      upsertBelief(agent, record);
      result.summaryBeliefs.push(`${subjectId}.tendency:${tag}=${group.length}`);
      runtime.store.noteChange({
        entityId: agentId,
        stateKey: `belief:${subjectId}.tendency:${tag}`,
        before: undefined,
        after: group.length,
      });
    }

    for (const memory of group) removed.add(memory.id);
    result.consolidated += group.length;
    // 요약 자체도 하나의 기억으로 남는다 — 원본 없이 "경향"만 기억한다
    agent.memories.push({
      id: `memory.${agentId}.${agent.memorySeq++}`,
      type: "discovery",
      participants: [...group[0]!.participants],
      tags: [...group[0]!.tags],
      emotionalIntensity: Math.max(...group.map((m) => m.emotionalIntensity)),
      relevance: Math.min(60, 20 + group.length * 5),
      confidence: Math.min(1, confidence + 0.1),
      createdAt: runtime.state.simulationTime,
      decayRate: 0.5,
      summary: `pattern:${tag}x${group.length}@${subjectId ?? "-"}`,
    });
  }

  // ③ 잊기
  agent.memories = agent.memories.filter((memory) => {
    if (removed.has(memory.id)) return false;
    if (calculateMemoryImportance(runtime, agent, memory) >= FORGET_THRESHOLD) return true;
    result.forgotten += 1;
    return false;
  });

  enforceCapacity(runtime, agent);
  return result;
}
