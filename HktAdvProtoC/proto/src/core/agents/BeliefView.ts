// 판단이 세계를 보는 유일한 창 (기획서 §10, §20, §23 / Phase-3 §3.1)
//
// **핵심 규약**: GoalSystem·ActionPlanner 는 WorldState 를 직접 읽지 않는다. 판단의 입력은 이 BeliefView 뿐이다.
// 여기서만 "무엇을 알 수 있는가"가 정해진다:
//   ① 자기 자신의 상태 — 직접 읽는다(자기 감각).
//   ② 남의 상태 — 믿음이 있으면 믿음값, 없으면 지금 감각 범위 안이고 §9 observable 인 것만 직접 지각, 그 외는 "모름".
//   ③ 공간·개체의 존재 — 장소·자원·조직은 지도 지식(공유), 주체는 지각·믿음·기억·소속으로만 안다.
// 잘못된 믿음이 잘못된 결정을 만드는(§44-6) 경로가 전부 이 파일을 지난다.
import type { BeliefRecord, MemoryRecord, RelationshipState } from "../../shared/beliefs";
import { distance3d, type EntityState, type Position } from "../../shared/state";
import { compare, CROSS_REGION_DISTANCE } from "../world/Conditions";
import { allEntities, findTargets, type TargetSearchOptions } from "../world/Queries";
import type { WorldRuntime } from "../world/WorldRuntime";
import type {
  ConditionDefinition,
  SenseDefinition,
  StateOwnerType,
  TargetQuery,
  ValueReference,
} from "../world/types";
import { findBelief } from "./BeliefStore";
import { recallByTags } from "./MemorySystem";
import { relationshipView } from "./RelationshipSystem";

/** 조직의 감각 — 조직은 눈이 없다. 구성원의 보고만이 조직의 지각이다 (§17, §23 "조직 보고") */
export const FACTION_SENSES: SenseDefinition[] = [{ channel: "report", range: 400, accuracy: 0.9 }];

/** 직접 지각한 값의 확신 상한 — 믿음(전달·추론)과 구분하기 위해 감각 정확도를 그대로 쓴다 */
export type PerceptionSource = "self" | "belief" | "sense" | "unknown";

export interface PerceivedValue {
  value: unknown;
  confidence: number;
  source: PerceptionSource;
}

const UNKNOWN: PerceivedValue = { value: undefined, confidence: 0, source: "unknown" };

export function sensesOf(runtime: WorldRuntime, agentId: string): SenseDefinition[] {
  const entity = runtime.store.findEntity(agentId);
  if (entity === undefined) return [];
  if (entity.type === "faction") return FACTION_SENSES;
  const speciesId = runtime.store.read(agentId, "species_id");
  if (typeof speciesId !== "string") return [];
  return runtime.index.species.get(speciesId)?.senses ?? [];
}

/** 관찰 채널이 맞는 감각 중 가장 좋은 것 (§23 getBestMatchingSense) */
export function bestMatchingSense(
  senses: SenseDefinition[],
  channels: string[],
): SenseDefinition | undefined {
  let best: SenseDefinition | undefined;
  for (const sense of senses) {
    if (!channels.includes(sense.channel)) continue;
    if (best === undefined || sense.accuracy * sense.range > best.accuracy * best.range) best = sense;
  }
  return best;
}

export class BeliefView {
  private readonly senses: SenseDefinition[];

  constructor(
    private readonly runtime: WorldRuntime,
    readonly agentId: string,
  ) {
    this.senses = sensesOf(runtime, agentId);
  }

  get now(): number {
    return this.runtime.state.simulationTime;
  }

  get traits(): Record<string, number> {
    return this.runtime.agentRuntime(this.agentId).traits;
  }

  trait(key: string, fallback = 50): number {
    return this.traits[key] ?? fallback;
  }

  /** 결정론 난수 — 스트림은 항상 주체 id 로 갈라진다 (§39 RandomContext) */
  random(stream: string): number {
    return this.runtime.rngFor(`${this.agentId}#${stream}`).next();
  }

  // --- 자기 감각 -------------------------------------------------------------

  /**
   * 자기 상태. 이 주체에게 없는 상태 키는 오류가 아니라 **모름**이다 —
   * 목적·행동 정의는 여러 종류의 주체가 함께 쓰므로(개인/생물/조직) 없는 항목이 생긴다.
   */
  selfState(stateKey: string): unknown {
    if (!this.hasSelfState(stateKey)) return undefined;
    return this.runtime.store.read(this.agentId, stateKey);
  }

  hasSelfState(stateKey: string): boolean {
    const entity = this.runtime.store.findEntity(this.agentId);
    if (entity === undefined) return false;
    return this.runtime.schemas.find(this.runtime.store.ownerTypeOf(entity), stateKey) !== undefined;
  }

  selfNumber(stateKey: string, fallback = 0): number {
    const value = this.selfState(stateKey);
    return typeof value === "number" ? value : fallback;
  }

  selfPosition(): Position | undefined {
    return this.runtime.store.entity(this.agentId).position;
  }

  isFaction(): boolean {
    return this.runtime.agentRuntime(this.agentId).kind === "faction";
  }

  selfTags(): string[] {
    return this.runtime.store.entity(this.agentId).tags;
  }

  goalGraphId(): string {
    const graphId = this.runtime.store.read(this.agentId, "goal_graph_id");
    return typeof graphId === "string" ? graphId : "";
  }

  /**
   * §21 targetQuery 해석 — 단, **아는 주체만** 후보가 된다 (§22 findPossibleTargets).
   * 장소·자원·조직은 지도 지식이므로 그대로 통과한다.
   */
  findTargets(query: TargetQuery, options: TargetSearchOptions = {}): EntityState[] {
    return findTargets(this.runtime, this.agentId, query, options).filter(
      (entity) => entity.type !== "agent" || this.knowsAgent(entity.id),
    );
  }

  // --- 지각 -----------------------------------------------------------------

  /** 지금 감각이 닿는 거리인가 (지역이 다르면 닿지 않는다 — §13) */
  inSensoryRange(entityId: string): boolean {
    const from = this.selfPosition();
    const to = this.runtime.store.findEntity(entityId)?.position;
    if (from === undefined || to === undefined) return false;
    if (from.regionId !== to.regionId) return false;
    const distance = distance3d(from, to);
    return this.senses.some((sense) => sense.range >= distance);
  }

  belief(subjectId: string, stateKey: string): BeliefRecord | undefined {
    return findBelief(this.runtime.agentRuntime(this.agentId), subjectId, stateKey);
  }

  /** §10 의 핵심 — 판단이 읽는 "남의 상태"는 전부 여기를 지난다 */
  perceive(subjectId: string, stateKey: string): PerceivedValue {
    if (subjectId === this.agentId) {
      return { value: this.selfState(stateKey), confidence: 1, source: "self" };
    }
    const believed = this.belief(subjectId, stateKey);
    if (believed !== undefined) {
      return { value: believed.believedValue, confidence: believed.confidence, source: "belief" };
    }
    const entity = this.runtime.store.findEntity(subjectId);
    if (entity === undefined) return UNKNOWN;

    const ownerType: StateOwnerType = this.runtime.store.ownerTypeOf(entity);
    const schema = this.runtime.schemas.find(ownerType, stateKey);
    // §9 observable=false 는 어떤 감각으로도 알 수 없다 — 믿음으로만 접근한다
    if (schema === undefined || !schema.observable) return UNKNOWN;
    const sense = bestMatchingSense(this.senses, schema.observationChannels ?? []);
    if (sense === undefined) return UNKNOWN;

    const from = this.selfPosition();
    const to = entity.position;
    if (from === undefined || to === undefined) return UNKNOWN;
    if (from.regionId !== to.regionId || distance3d(from, to) > sense.range) return UNKNOWN;
    return { value: this.runtime.store.read(subjectId, stateKey), confidence: sense.accuracy, source: "sense" };
  }

  perceiveNumber(subjectId: string, stateKey: string, fallback: number): number {
    const perceived = this.perceive(subjectId, stateKey);
    return typeof perceived.value === "number" ? perceived.value : fallback;
  }

  // --- 개체 지식 --------------------------------------------------------------

  /** 이 주체를 알고 있는가 — 지각·믿음·기억·소속 중 하나라도 걸려야 한다 */
  knowsAgent(entityId: string): boolean {
    if (entityId === this.agentId) return true;
    const agent = this.runtime.agentRuntime(this.agentId);
    if (agent.beliefs.some((belief) => belief.subjectId === entityId)) return true;
    if (agent.memories.some((memory) => memory.participants.includes(entityId))) return true;
    if (this.inSensoryRange(entityId)) return true;
    const myFaction = this.runtime.store.read(this.agentId, "faction_id");
    if (typeof myFaction === "string" && myFaction !== "") {
      const other = this.runtime.store.findEntity(entityId);
      if (other?.type === "agent" && this.runtime.store.read(entityId, "faction_id") === myFaction) {
        return true;
      }
    }
    return false;
  }

  /**
   * 후보 대상 열거 (§22 findPossibleTargets).
   * 장소·자원·조직은 지도 지식으로 공유되고, 살아 있는 주체는 아는 것만 후보가 된다.
   */
  knownEntities(filter: (entity: EntityState) => boolean): EntityState[] {
    return allEntities(this.runtime).filter((entity) => {
      if (!filter(entity)) return false;
      if (entity.type !== "agent") return true;
      return this.knowsAgent(entity.id);
    });
  }

  entity(entityId: string): EntityState | undefined {
    return this.runtime.store.findEntity(entityId);
  }

  distanceTo(entityId: string): number {
    const from = this.selfPosition();
    const to = this.runtime.store.findEntity(entityId)?.position;
    if (from === undefined || to === undefined) return CROSS_REGION_DISTANCE;
    if (from.regionId !== to.regionId) return CROSS_REGION_DISTANCE;
    return distance3d(from, to);
  }

  // --- 관계·기억 --------------------------------------------------------------

  relationTo(entityId: string): RelationshipState {
    return relationshipView(this.runtime, this.agentId, entityId);
  }

  recall(tags: string[], subjectId?: string): MemoryRecord[] {
    return recallByTags(this.runtime.agentRuntime(this.agentId), tags, subjectId);
  }

  // --- 조건 평가 (믿음 기반) ---------------------------------------------------

  /**
   * 콘텐츠가 선언한 조건(§11.2 ConditionDefinition)을 **믿음으로** 평가한다.
   *
   * 모름(undefined)의 처리는 조건의 쓰임에 따라 갈린다.
   *  - `unknown: "pass"`(행동 요구 조건) — 모른다고 막지 않는다. 확신만 깎는다.
   *    그래서 잘못된 믿음을 가진 주체는 실패할 행동을 실제로 시도한다(§44-6).
   *  - `unknown: "fail"`(목적 달성·포기·압력 해소) — 모르면 이룬 것이 아니다.
   *    멀리 있어 확인할 수 없는 목적을 "달성했다"고 착각하지 않게 하는 쪽이다.
   */
  evaluateConditions(
    conditions: ConditionDefinition[],
    targetId?: string,
    options: { unknown?: "pass" | "fail" } = {},
  ): { ok: boolean; confidence: number } {
    let confidence = 1;
    for (const condition of conditions) {
      const left = this.resolve(condition.left, targetId);
      const right = this.resolve(condition.right, targetId);
      if (left.source === "unknown" || right.source === "unknown") {
        if (options.unknown === "fail") return { ok: false, confidence: 0 };
        confidence *= 0.5; // 모르는 채로 시도한다 — 확신만 낮아진다
        continue;
      }
      if (!compare(left.value, condition.operator, right.value)) return { ok: false, confidence: 0 };
      confidence *= Math.max(left.confidence, 0.2) * 0.5 + Math.max(right.confidence, 0.2) * 0.5;
    }
    return { ok: true, confidence };
  }

  private resolve(ref: ValueReference, targetId?: string): PerceivedValue {
    switch (ref.kind) {
      case "const":
        return { value: ref.value, confidence: 1, source: "self" };
      case "state": {
        if (ref.owner === "actor") {
          if (!this.hasSelfState(ref.key)) return UNKNOWN;
          return { value: this.selfState(ref.key), confidence: 1, source: "self" };
        }
        if (targetId === undefined) return UNKNOWN;
        return this.perceive(targetId, ref.key);
      }
      case "entity_state":
        return this.perceive(ref.entityId, ref.key);
      case "entity_ref": {
        const id = ref.owner === "actor" ? this.agentId : targetId;
        return id === undefined ? UNKNOWN : { value: id, confidence: 1, source: "self" };
      }
      case "belief": {
        if (targetId === undefined) return UNKNOWN;
        const belief = this.belief(targetId, ref.key);
        return belief === undefined
          ? UNKNOWN
          : { value: belief.believedValue, confidence: belief.confidence, source: "belief" };
      }
      case "distance":
        // 거리는 감각이다 — 눈앞의 거리를 모르는 주체는 없다
        return targetId === undefined
          ? UNKNOWN
          : { value: this.distanceTo(targetId), confidence: 1, source: "sense" };
    }
  }
}

export function beliefViewOf(runtime: WorldRuntime, agentId: string): BeliefView {
  return new BeliefView(runtime, agentId);
}
