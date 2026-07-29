// 관계 시스템 (기획서 §25 / Phase-3 §3.4)
//
// 관계 "변화"는 여기서 하드코딩하지 않는다 — 변화 규칙은 전부 DSL 규칙(content/manual-world/rules/relationships.json)이다.
// 이 모듈이 갖는 것은 ① 저장 구조 ② 판단이 읽는 질의 ③ 약속(PromiseState)의 만기 검사뿐이다.
import {
  createRelationshipState,
  relationshipKey,
  type PromiseState,
  type RelationshipState,
} from "../../shared/beliefs";
import type { WorldRuntime } from "../world/WorldRuntime";

/** 관계 수치의 상·하한 — 신뢰가 무한히 자라지 않게 한다 */
export const RELATION_MIN = -100;
export const RELATION_MAX = 100;

const NUMERIC_KEYS = [
  "trust",
  "fear",
  "respect",
  "affection",
  "resentment",
  "dependency",
  "debt",
  "familiarity",
] as const;

export type RelationshipNumericKey = (typeof NUMERIC_KEYS)[number];

export function isRelationshipKey(key: string): key is RelationshipNumericKey {
  return (NUMERIC_KEYS as readonly string[]).includes(key);
}

export function findRelationship(
  runtime: WorldRuntime,
  fromId: string,
  toId: string,
): RelationshipState | undefined {
  return runtime.state.relationships[relationshipKey(fromId, toId)];
}

/** 없으면 만들어 돌려준다 — "아직 아무 사이도 아닌" 관계도 0 으로 존재한다 */
export function ensureRelationship(
  runtime: WorldRuntime,
  fromId: string,
  toId: string,
): RelationshipState {
  const key = relationshipKey(fromId, toId);
  const existing = runtime.state.relationships[key];
  if (existing !== undefined) return existing;
  const created = createRelationshipState(fromId, toId);
  runtime.state.relationships[key] = created;
  return created;
}

/** 판단이 읽는 관계 — 없으면 중립(전부 0) */
export function relationshipView(
  runtime: WorldRuntime,
  fromId: string,
  toId: string,
): RelationshipState {
  return findRelationship(runtime, fromId, toId) ?? createRelationshipState(fromId, toId);
}

/**
 * §25 비밀 기록 (G-8) — from 이 to 에 대한 비밀 문구를 관계 원장에 남긴다.
 * 같은 문구는 한 번만 남는다. 아는 쪽의 판단 재계기(flags)를 세운다 —
 * 새 정보 자산은 행동 후보(협박의 지렛대 등)를 바꿀 수 있다.
 */
export function recordSecret(
  runtime: WorldRuntime,
  fromId: string,
  toId: string,
  secret: string,
): boolean {
  const relation = ensureRelationship(runtime, fromId, toId);
  if (relation.knownSecrets.includes(secret)) return false;
  relation.knownSecrets.push(secret);
  const agent = runtime.state.agentRuntimes[fromId];
  if (agent !== undefined && !agent.flags.includes("relationship_shift")) {
    agent.flags.push("relationship_shift");
  }
  return true;
}

/** §25 — from 이 to 에 대해 쥔 비밀들 (없으면 빈 배열) */
export function secretsAbout(runtime: WorldRuntime, fromId: string, toId: string): readonly string[] {
  return findRelationship(runtime, fromId, toId)?.knownSecrets ?? [];
}

export function clampRelation(value: number): number {
  return value < RELATION_MIN ? RELATION_MIN : value > RELATION_MAX ? RELATION_MAX : value;
}

/**
 * 관계 수치 변경 — 규칙 효과(modify_relationship)와 시스템(약속 위반 등)이 공유하는 단일 경로.
 * 변화량은 change 로그에 남는다(§28 사건 탐지의 재료).
 */
export function applyRelationshipChange(
  runtime: WorldRuntime,
  fromId: string,
  toId: string,
  key: string,
  next: number,
): { before: number; after: number } | undefined {
  if (!isRelationshipKey(key)) return undefined;
  const relation = ensureRelationship(runtime, fromId, toId);
  const before = relation[key];
  const after = clampRelation(next);
  if (Object.is(before, after)) return undefined;
  relation[key] = after;
  runtime.store.noteChange({
    entityId: relationshipKey(fromId, toId),
    stateKey: `relationship:${key}`,
    before,
    after,
  });
  return { before, after };
}

/** 전달자 신뢰 → 소문 감쇠 계수 (§23 소문 채널, §25 trust) */
export function tellerTrustFactor(runtime: WorldRuntime, listenerId: string, tellerId: string): number {
  const relation = relationshipView(runtime, listenerId, tellerId);
  // 신뢰 -100~100 → 0.15~1.0. 모르는 사이(0)는 0.5 — "처음 듣는 사람 말은 절반만 믿는다"
  const normalized = (relation.trust + 100) / 200;
  return 0.15 + normalized * 0.85;
}

// --- 약속 (§25 promises) ---------------------------------------------------------

export function addPromise(
  runtime: WorldRuntime,
  fromId: string,
  toId: string,
  promise: PromiseState,
): void {
  const relation = ensureRelationship(runtime, fromId, toId);
  if (relation.promises.some((p) => p.id === promise.id)) return;
  relation.promises.push(promise);
  runtime.store.noteChange({
    entityId: relationshipKey(fromId, toId),
    stateKey: "relationship:promise",
    before: undefined,
    after: promise.id,
  });
}

function promiseSatisfied(runtime: WorldRuntime, entityId: string, promise: PromiseState): boolean {
  const entity = runtime.store.findEntity(entityId);
  if (entity === undefined) return false;
  const value = runtime.store.read(entityId, promise.stateKey);
  if (typeof value !== "number") return value === true;
  return promise.comparison === ">" ? value > promise.threshold : value < promise.threshold;
}

export interface PromiseOutcome {
  fromId: string;
  toId: string;
  promiseId: string;
  status: "kept" | "broken";
}

/**
 * 만기가 지난 약속을 판정한다 (§25 "약속 위반 → 신뢰 급감 → 소문 확산").
 * 신뢰 급감·소문은 여기서 하지 않는다 — 판정 결과를 상태(promise_broken)로 남기고
 * 그 다음은 DSL 규칙이 받는다. 관계 변화 규칙을 콘텐츠로 두기 위한 경계다.
 */
export function resolveDuePromises(runtime: WorldRuntime): PromiseOutcome[] {
  const now = runtime.state.simulationTime;
  const outcomes: PromiseOutcome[] = [];
  for (const key of Object.keys(runtime.state.relationships).sort()) {
    const relation = runtime.state.relationships[key]!;
    for (const promise of relation.promises) {
      if (promise.status !== "open" || promise.dueAt > now) continue;
      const kept = promiseSatisfied(runtime, relation.fromId, promise);
      promise.status = kept ? "kept" : "broken";
      outcomes.push({
        fromId: relation.fromId,
        toId: relation.toId,
        promiseId: promise.id,
        status: promise.status,
      });
      runtime.store.withContext(
        {
          sourceId: relation.fromId,
          targetIds: [relation.toId],
          tags: ["promise", promise.status, ...promise.tags],
        },
        () => {
          runtime.store.noteChange({
            entityId: key,
            stateKey: "relationship:promise_resolved",
            before: "open",
            after: promise.status,
          });
          // 상태로 남겨야 규칙이 이어받는다 — 약속을 어긴 쪽에 표식을 세운다
          if (!kept && runtime.store.findEntity(relation.fromId) !== undefined) {
            runtime.store.modify(relation.fromId, "promise_broken", "set", true);
          }
        },
      );
    }
  }
  return outcomes;
}

/** 지금 이 주체가 지고 있는 미이행 약속 (판단의 입력) */
export function openPromises(runtime: WorldRuntime, fromId: string): PromiseState[] {
  const result: PromiseState[] = [];
  for (const key of Object.keys(runtime.state.relationships).sort()) {
    const relation = runtime.state.relationships[key]!;
    if (relation.fromId !== fromId) continue;
    result.push(...relation.promises.filter((p) => p.status === "open"));
  }
  return result;
}
