// 믿음 저장소 (기획서 §10)
// 주체는 세계 상태를 직접 읽지 못한다. 판단이 참조하는 값은 전부 여기를 거친다.
import type { AgentRuntimeState, BeliefRecord } from "../../shared/beliefs";

export function findBelief(
  agent: AgentRuntimeState,
  subjectId: string,
  stateKey: string,
): BeliefRecord | undefined {
  return agent.beliefs.find((b) => b.subjectId === subjectId && b.stateKey === stateKey);
}

/**
 * 믿음 갱신 — Phase 1 간이형: 관찰에 성공하면 신호의 주장으로 덮어쓰고 confidence 는 주장값 고정.
 * (기억 비교·원인 추론·성격 편향은 Phase 3 §23~§25 가 채운다.)
 * 반환값은 갱신 전 믿음 — 로그·검증용.
 */
export function upsertBelief(
  agent: AgentRuntimeState,
  record: BeliefRecord,
): BeliefRecord | undefined {
  const existing = findBelief(agent, record.subjectId, record.stateKey);
  if (existing === undefined) {
    agent.beliefs.push(record);
    // 주체 id·상태 키 순으로 정렬 유지 — 스냅샷 해시가 삽입 순서에 흔들리지 않게 한다
    agent.beliefs.sort((a, b) =>
      a.subjectId === b.subjectId
        ? a.stateKey.localeCompare(b.stateKey)
        : a.subjectId.localeCompare(b.subjectId),
    );
    return undefined;
  }
  const before: BeliefRecord = { ...existing, sourceIds: [...existing.sourceIds] };
  existing.believedValue = record.believedValue;
  existing.confidence = record.confidence;
  existing.lastUpdatedAt = record.lastUpdatedAt;
  for (const sourceId of record.sourceIds) {
    if (!existing.sourceIds.includes(sourceId)) existing.sourceIds.push(sourceId);
  }
  // 근거 목록도 무한히 자라지 않게 최근 4개만 남긴다 (§24 기억 요약의 축소판)
  if (existing.sourceIds.length > 4) {
    existing.sourceIds = existing.sourceIds.slice(existing.sourceIds.length - 4);
  }
  return before;
}
