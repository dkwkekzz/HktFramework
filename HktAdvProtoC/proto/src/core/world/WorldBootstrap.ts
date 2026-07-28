// 초기 배치 → WorldState 부트스트랩 (Phase-1 구현 스텝 2)
// 여기서 만들어진 상태는 전부 §9 스키마를 통과한 값이다 — "임의의 문자열로 저장하지 않는다".
import { createAgentRuntimeState, type BeliefRecord } from "../../shared/beliefs";
import {
  applyRelationshipChange,
  ensureRelationship,
  isRelationshipKey,
} from "../agents/RelationshipSystem";
import type { EntityState } from "../../shared/state";
import type { WorldRuntime } from "./WorldRuntime";
import type { BootstrapEntity, StateOwnerType } from "./types";

function ownerTypeOf(spec: BootstrapEntity): StateOwnerType {
  if (spec.type === "location") return spec.tags.includes("region") ? "region" : "location";
  return spec.type;
}

/** 초기 배치를 개체로 실체화한다. 등록되지 않은 상태 키는 여기서 즉시 오류다. */
export function bootstrapWorld(runtime: WorldRuntime): void {
  // 전역 상태(ownerType="world")도 스키마 기본값으로 채운다 —
  // 규칙이 읽는 순간까지 비어 있으면 "등록됐는데 값이 없는 상태"가 생긴다(§9).
  for (const [key, value] of Object.entries(runtime.schemas.defaultsFor("world"))) {
    runtime.store.setGlobal(key, value);
  }

  for (const spec of runtime.definition.bootstrap.entities) {
    const ownerType = ownerTypeOf(spec);
    const states: Record<string, unknown> = runtime.schemas.defaultsFor(ownerType);

    for (const [key, value] of Object.entries(spec.states)) {
      const schema = runtime.schemas.require(ownerType, key);
      if (schema.updatePolicy === "derived") {
        throw new Error(`초기 배치가 파생 상태를 지정했다: ${spec.id}.${key}`);
      }
      states[key] = runtime.schemas.coerce(schema, value);
    }

    if (spec.type === "agent") {
      // 주체의 정체성(종족·소속·목적 그래프)도 등록된 상태로 저장한다
      const identity: Record<string, string> = {
        species_id: spec.speciesId ?? "",
        faction_id: spec.factionIds?.[0] ?? "",
        goal_graph_id: spec.goalGraphId ?? "",
      };
      for (const [key, value] of Object.entries(identity)) {
        states[key] = runtime.schemas.coerce(runtime.schemas.require("agent", key), value);
      }
    }
    // 조직도 목적 그래프를 갖는 주체다 (§17, Phase-3 §3.7)
    if (spec.type === "faction" && spec.goalGraphId !== undefined) {
      states["goal_graph_id"] = runtime.schemas.coerce(
        runtime.schemas.require("faction", "goal_graph_id"),
        spec.goalGraphId,
      );
    }

    const entity: EntityState = {
      id: spec.id,
      type: spec.type,
      states,
      tags: [...spec.tags],
      ...(spec.position !== undefined ? { position: { ...spec.position } } : {}),
    };
    runtime.store.insertEntity(entity);

    // 개인과 조직 모두 주체 런타임을 갖는다 — 같은 판단 파이프라인을 탄다(§17)
    if (spec.type === "agent" || (spec.type === "faction" && spec.goalGraphId !== undefined)) {
      const agent = createAgentRuntimeState(
        spec.id,
        { ...(spec.traits ?? {}) },
        spec.type === "faction" ? "faction" : "individual",
      );
      // §41 "초기 사건은 작성하지 않는다. 초기 상태만 배치한다" — 소문·선입견도 초기 상태다
      agent.beliefs = (spec.beliefs ?? []).map(
        (belief): BeliefRecord => ({
          subjectId: belief.subjectId,
          stateKey: belief.stateKey,
          believedValue: belief.believedValue,
          confidence: belief.confidence,
          sourceIds: [...belief.sourceIds],
          lastUpdatedAt: 0,
        }),
      );
      runtime.state.agentRuntimes[spec.id] = agent;
    }
  }

  bootstrapRelationships(runtime);
}

/**
 * 초기 관계 (§25). 두 곳에서 온다.
 *  ① 개체가 선언한 relationships — "이미 서로 아는 사이"
 *  ② FactionDefinition.relationshipDefaults — 조직이 다른 조직·종족을 보는 기본 시선(신뢰로 해석)
 */
function bootstrapRelationships(runtime: WorldRuntime): void {
  for (const spec of runtime.definition.bootstrap.entities) {
    for (const relation of spec.relationships ?? []) {
      if (runtime.store.findEntity(relation.toId) === undefined) continue;
      ensureRelationship(runtime, spec.id, relation.toId);
      for (const [key, value] of Object.entries(relation)) {
        if (key === "toId" || typeof value !== "number") continue;
        if (!isRelationshipKey(key)) throw new Error(`알 수 없는 관계 항목: ${spec.id}→${relation.toId}.${key}`);
        applyRelationshipChange(runtime, spec.id, relation.toId, key, value);
      }
    }
  }

  for (const faction of runtime.definition.factions) {
    if (runtime.store.findEntity(faction.id) === undefined) continue;
    for (const [toId, trust] of Object.entries(faction.relationshipDefaults)) {
      // 종족을 가리키는 기본값은 그 종족의 개체 전부에 적용한다
      const targets =
        runtime.store.findEntity(toId) !== undefined
          ? [toId]
          : Object.keys(runtime.state.entities)
              .sort()
              .filter(
                (id) =>
                  runtime.state.entities[id]!.type === "agent" &&
                  runtime.store.read(id, "species_id") === toId,
              );
      for (const target of targets) {
        applyRelationshipChange(runtime, faction.id, target, "trust", trust);
      }
    }
  }
}
