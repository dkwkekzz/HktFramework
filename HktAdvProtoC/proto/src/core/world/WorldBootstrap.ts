// 초기 배치 → WorldState 부트스트랩 (Phase-1 구현 스텝 2)
// 여기서 만들어진 상태는 전부 §9 스키마를 통과한 값이다 — "임의의 문자열로 저장하지 않는다".
import { createAgentRuntimeState, type BeliefRecord } from "../../shared/beliefs";
import { rememberEvent } from "../agents/MemorySystem";
import {
  applyRelationshipChange,
  ensureRelationship,
  isRelationshipKey,
  recordSecret,
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

    // §18 소지품 (G-7) — 자원 선언을 그 자원의 carryStateKey 상태로 변환한다.
    // 소지품은 별도 저장소가 아니라 거래·소비 규칙이 읽는 바로 그 상태다 — 선언이 곧 실행 재료가 된다.
    for (const item of spec.inventory ?? []) {
      const resource = runtime.definition.resources.find((entry) => entry.id === item.resourceId);
      if (resource === undefined) {
        throw new Error(`소지품이 없는 자원을 가리킨다: ${spec.id} → ${item.resourceId} (§18)`);
      }
      if (resource.carryStateKey === undefined) {
        throw new Error(`자원 ${item.resourceId} 에 carryStateKey 가 없다 — 소지품으로 지닐 수 없다 (${spec.id}, §18)`);
      }
      const schema = runtime.schemas.require(ownerType, resource.carryStateKey);
      const current = states[resource.carryStateKey];
      states[resource.carryStateKey] = runtime.schemas.coerce(
        schema,
        (typeof current === "number" ? current : 0) + item.quantity,
      );
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
  bootstrapMemories(runtime);
}

/**
 * §18 초기 기억 (G-7) — 과거 생존 사건이 기억 데이터로 시작한다.
 * 초기 믿음(§41)과 같은 자리의 초기 상태다: interpretation 이 초기 믿음과 같은 (subjectId, stateKey) 를
 * 가리키면 그 믿음은 출처 없는 선언이 아니라 기억이 지지하는 결론이 되고,
 * §23 기억 대조·§24 감쇠/요약이 첫날부터 이 기억 위에서 작동한다.
 * 관계 부트스트랩 뒤에 넣는다 — 기억 중요도의 관계 항(§24)이 초기 관계를 읽을 수 있도록.
 */
function bootstrapMemories(runtime: WorldRuntime): void {
  for (const spec of runtime.definition.bootstrap.entities) {
    if (runtime.state.agentRuntimes[spec.id] === undefined) continue;
    for (const draft of spec.memories ?? []) {
      rememberEvent(runtime, spec.id, {
        type: draft.type,
        participants: draft.participants,
        tags: draft.tags,
        emotionalIntensity: draft.emotionalIntensity,
        relevance: draft.relevance,
        confidence: draft.confidence,
        ...(draft.interpretation === undefined ? {} : { interpretation: draft.interpretation }),
      });
    }
  }
}

/**
 * §15 생존 단위 → 같은 종끼리의 출발선 (G-4).
 * "종족 정의는 외형과 전투 능력보다 생존 구조를 우선한다"(§15) — 그 생존 구조가 관계에 나타난다.
 * 혼자 사는 종은 동족이라고 더 가깝지 않고, 무리·가족·군체로 사는 종은 태어날 때부터 서로를 안다.
 * 개체가 스스로 선언한 관계(①)가 먼저 깔리고, 여기서 더해진다 — 선언이 우선이다.
 */
const KINSHIP: Record<string, { familiarity: number; trust: number }> = {
  individual: { familiarity: 0, trust: 0 },
  host: { familiarity: 0, trust: 0 },
  memory: { familiarity: 5, trust: 0 },
  family: { familiarity: 25, trust: 15 },
  lineage: { familiarity: 25, trust: 10 },
  pack: { familiarity: 30, trust: 20 },
  hive: { familiarity: 40, trust: 35 },
};

function bootstrapKinship(runtime: WorldRuntime): void {
  const bySpecies = new Map<string, string[]>();
  for (const id of Object.keys(runtime.state.entities).sort()) {
    if (runtime.state.entities[id]!.type !== "agent") continue;
    const speciesId = runtime.store.read(id, "species_id");
    if (typeof speciesId !== "string" || speciesId === "") continue;
    const list = bySpecies.get(speciesId);
    if (list === undefined) bySpecies.set(speciesId, [id]);
    else list.push(id);
  }

  for (const [speciesId, members] of bySpecies) {
    const species = runtime.index.species.get(speciesId);
    if (species === undefined) continue;
    const kinship = KINSHIP[species.survivalUnit];
    if (kinship === undefined || (kinship.familiarity === 0 && kinship.trust === 0)) continue;
    for (const from of members) {
      for (const to of members) {
        if (from === to) continue;
        applyRelationshipChange(runtime, from, to, "familiarity", kinship.familiarity);
        applyRelationshipChange(runtime, from, to, "trust", kinship.trust);
      }
    }
  }
}

/**
 * 초기 관계 (§25). 세 곳에서 온다.
 *  ① 개체가 선언한 relationships — "이미 서로 아는 사이"
 *  ② §15 survivalUnit — 같은 종의 생존 단위가 주는 출발선(G-4)
 *  ③ FactionDefinition.relationshipDefaults — 조직이 다른 조직·종족을 보는 기본 시선(신뢰로 해석)
 */
function bootstrapRelationships(runtime: WorldRuntime): void {
  for (const spec of runtime.definition.bootstrap.entities) {
    for (const relation of spec.relationships ?? []) {
      if (runtime.store.findEntity(relation.toId) === undefined) continue;
      ensureRelationship(runtime, spec.id, relation.toId);
      for (const [key, value] of Object.entries(relation)) {
        if (key === "toId" || key === "knownSecrets" || typeof value !== "number") continue;
        if (!isRelationshipKey(key)) throw new Error(`알 수 없는 관계 항목: ${spec.id}→${relation.toId}.${key}`);
        applyRelationshipChange(runtime, spec.id, relation.toId, key, value);
      }
      // §25 시작부터 쥔 비밀 (G-8) — 은닉 동기(§41)의 목격자는 선언이 아니라 관계 원장으로 시작한다
      for (const secret of relation.knownSecrets ?? []) recordSecret(runtime, spec.id, relation.toId, secret);
    }
  }

  bootstrapKinship(runtime);

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
