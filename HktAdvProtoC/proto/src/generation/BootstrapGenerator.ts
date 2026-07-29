// 13단계-b: 초기 세계 배치 (§41 "초기 사건은 수동으로 작성하지 않는다. 초기 상태만 배치한다")
//
// AI 는 "무엇이 어디에 얼마나 있는가"의 프로필만 만든다. 개체 좌표와 매장량은 코드가 시드로 계산한다
// (Phase-5 §5.1 각주 · §5.4 "부트스트랩의 난수는 정의에 시드로 포함").
import type { EntityTemplate } from "../core/rules/RuleTypes";
import type {
  BootstrapEntity,
  SpaceDefinition,
  WorldBootstrap,
} from "../core/world/types";
import type { AgentDraft } from "./AgentGenerator";
import { deriveNodeAmount, placeAround, placeInRegion, type RegionBounds } from "./derivations";
import type { GenerationContext } from "./GenerationTypes";
import { POPULATION_SCHEMA, TEMPLATE_SCHEMA } from "./OutputSchemas";
import type { RegionProfile } from "./SpaceGenerator";
import { generateChecked, type JsonSchema } from "./TextGenerationPort";

export const PLACEMENT_TASK = "bootstrap_placements";
export const POPULATION_TASK = "bootstrap_populations";
export const TEMPLATE_TASK = "entity_templates";

/** 조직도 개체로 놓인다 — 조직은 이름표가 아니라 상태와 목적을 가진 주체다(§17) */
export interface FactionPlacement {
  id: string;
  name: string;
  goalGraphId: string;
  homeLocationId: string;
  tags: string[];
  states: Record<string, unknown>;
  traits?: Record<string, number>;
  relationships?: BootstrapEntity["relationships"];
  beliefs?: BootstrapEntity["beliefs"];
}

/** 세계가 이름을 부르는 개체 (§41 "반향수 어미") — 무리가 아니라 하나로 놓인다 */
export interface NamedCreaturePlacement {
  id: string;
  name: string;
  speciesId: string;
  goalGraphId: string;
  homeLocationId: string;
  tags: string[];
  states: Record<string, unknown>;
  traits?: Record<string, number>;
  relationships?: BootstrapEntity["relationships"];
  beliefs?: BootstrapEntity["beliefs"];
}

export interface PlacementDraft {
  factions: FactionPlacement[];
  namedCreatures: NamedCreaturePlacement[];
}

/** 일반 개체 무리 — 개체 하나하나를 저작하지 않는다 */
export interface PopulationSpec {
  id: string;
  type: "agent" | "resource";
  namePrefix: string;
  count: number;
  regionId: string;
  aroundLocationId?: string;
  spreadRadius?: number;
  speciesId?: string;
  goalGraphId?: string;
  tags: string[];
  states: Record<string, unknown>;
}

const PLACEMENT_ITEM = {
  type: "object",
  required: ["id", "name", "goalGraphId", "homeLocationId", "tags", "states"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    speciesId: { type: "string" },
    goalGraphId: { type: "string" },
    homeLocationId: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    states: { type: "object" },
    traits: { type: "object" },
    relationships: { type: "array" },
    beliefs: { type: "array" },
  },
} as const;

const PLACEMENT_SCHEMA: JsonSchema = {
  type: "object",
  required: ["factions", "namedCreatures"],
  additionalProperties: false,
  properties: {
    factions: { type: "array", items: PLACEMENT_ITEM },
    namedCreatures: { type: "array", items: { ...PLACEMENT_ITEM, required: [...PLACEMENT_ITEM.required, "speciesId"] } },
  },
};

const PLACEMENT_PROMPT = [
  "너는 세계 생성 컴파일러의 13단계다. 조직과 이름 있는 개체를 세계 위에 놓는다(§17, §41).",
  "조직마다 본거지·초기 상태·목적 그래프를 준다. 조직도 주체이므로 판단 변수를 갖는다.",
  "조직이 다른 주체를 어떻게 보는지(관계)도 초기 상태다.",
  "세계가 이름을 부르는 개체(둥지의 어미 같은)는 무리가 아니라 하나로 놓는다.",
].join("\n");

const POPULATION_PROMPT = [
  "너는 세계 생성 컴파일러의 13단계다. 이름 없는 일반 개체들을 무리 단위로 선언한다(§40).",
  "개체 하나하나를 쓰지 않는다 — 종류·수·어느 지역·어느 장소 주변인지만 정한다.",
  "좌표와 매장량은 컴파일러가 시드로 계산한다.",
  "초기 사건을 쓰지 않는다. 사건이 생길 수 있는 '초기 상태'만 배치한다(§41).",
].join("\n");

const TEMPLATE_PROMPT = [
  "너는 세계 생성 컴파일러의 13단계다. 규칙이 새 개체를 만들 때 쓸 템플릿을 정의한다(§11.3 create_entity).",
  "번식·분화처럼 세계가 스스로 개체를 늘리는 규칙이 가리키는 틀이다.",
].join("\n");

export interface BootstrapResult {
  bootstrap: WorldBootstrap;
  templates: EntityTemplate[];
  populations: PopulationSpec[];
  taskIds: string[];
}

export async function generateBootstrap(
  ctx: GenerationContext,
  space: SpaceDefinition,
  profiles: readonly RegionProfile[],
  agents: readonly AgentDraft[],
): Promise<BootstrapResult> {
  const placements = await generateChecked<PlacementDraft>(
    ctx.port,
    {
      taskId: PLACEMENT_TASK,
      systemPrompt: PLACEMENT_PROMPT,
      input: {
        factions: ctx.symbols.list("faction"),
        goalGraphs: ctx.symbols.list("goal_graph"),
        locations: ctx.symbols.list("location"),
        species: ctx.symbols.list("species"),
      },
      outputSchema: PLACEMENT_SCHEMA,
    },
    ctx.telemetry,
  );
  const factionPlacements = placements.factions;

  const populations = await generateChecked<PopulationSpec[]>(
    ctx.port,
    {
      taskId: POPULATION_TASK,
      systemPrompt: POPULATION_PROMPT,
      input: {
        regions: profiles.map((profile) => ({
          id: profile.id,
          danger: profile.danger,
          rarity: profile.rarity,
          speciesSuitability: profile.speciesSuitability,
        })),
        locations: space.locations.map((location) => ({ id: location.id, tags: location.tags })),
        species: ctx.symbols.list("species"),
        resources: ctx.symbols.list("resource"),
        generalEntityCount: ctx.scale.generalEntities,
      },
      outputSchema: POPULATION_SCHEMA,
    },
    ctx.telemetry,
  );

  const templates = await generateChecked<EntityTemplate[]>(
    ctx.port,
    {
      taskId: TEMPLATE_TASK,
      systemPrompt: TEMPLATE_PROMPT,
      input: {
        species: ctx.symbols.list("species"),
        goalGraphs: ctx.symbols.list("goal_graph"),
        availableStates: ctx.symbols.list("state"),
      },
      outputSchema: TEMPLATE_SCHEMA,
    },
    ctx.telemetry,
  );

  const boundsOf = new Map<string, RegionBounds>(profiles.map((profile) => [profile.id, profile.bounds]));
  const rarityOf = new Map(profiles.map((profile) => [profile.id, profile.rarity]));
  const locationById = new Map(space.locations.map((location) => [location.id, location]));
  const entities: BootstrapEntity[] = [];

  // ① 지역 — 지역 자신도 상태를 가진 개체다(§9 ownerType="region")
  for (const region of space.regions) {
    entities.push({
      id: region.id,
      type: "location",
      name: region.name,
      position: {
        regionId: region.id,
        x: Math.round(region.bounds.width / 2),
        y: Math.round(region.bounds.height / 2),
        z: 0,
      },
      tags: region.tags.includes("region") ? region.tags : ["region", ...region.tags],
      states: region.baseStates,
    });
  }

  // ② 장소
  for (const location of space.locations) {
    entities.push({
      id: location.id,
      type: "location",
      name: location.name,
      position: location.position,
      tags: location.tags,
      states: location.baseStates,
    });
  }

  // ③ 조직
  for (const placement of factionPlacements) {
    const home = locationById.get(placement.homeLocationId);
    if (home === undefined) throw new Error(`조직이 없는 장소에 자리 잡았다 — ${placement.id} → ${placement.homeLocationId}`);
    entities.push({
      id: placement.id,
      type: "faction",
      name: placement.name,
      goalGraphId: placement.goalGraphId,
      position: { ...home.position },
      tags: placement.tags,
      states: placement.states,
      ...(placement.traits === undefined ? {} : { traits: placement.traits }),
      ...(placement.relationships === undefined ? {} : { relationships: placement.relationships }),
      ...(placement.beliefs === undefined ? {} : { beliefs: placement.beliefs }),
    });
  }

  // ④ 이름 있는 개체 — 세계가 지목하는 짐승은 무리가 아니라 하나다
  for (const creature of placements.namedCreatures) {
    const home = locationById.get(creature.homeLocationId);
    if (home === undefined) throw new Error(`이름 있는 개체가 없는 장소에 산다 — ${creature.id} → ${creature.homeLocationId}`);
    const bounds = boundsOf.get(home.regionId);
    if (bounds === undefined) throw new Error(`장소의 지역을 찾을 수 없다 — ${home.id}`);
    if (!ctx.symbols.has("species", creature.speciesId)) {
      throw new Error(`없는 종의 개체 — ${creature.id} → ${creature.speciesId}`);
    }
    entities.push({
      id: creature.id,
      type: "agent",
      name: creature.name,
      speciesId: creature.speciesId,
      goalGraphId: creature.goalGraphId,
      position: placeAround(ctx.worldSeed, creature.id, home.position, 8, bounds),
      tags: creature.tags,
      states: creature.states,
      ...(creature.traits === undefined ? {} : { traits: creature.traits }),
      ...(creature.relationships === undefined ? {} : { relationships: creature.relationships }),
      ...(creature.beliefs === undefined ? {} : { beliefs: creature.beliefs }),
    });
  }

  // ⑤ 개인 — 좌표는 본거지 주변에서 시드로 뽑는다
  for (const agent of agents) {
    const home = locationById.get(agent.homeLocationId);
    if (home === undefined) throw new Error(`인물이 없는 장소에 산다 — ${agent.id} → ${agent.homeLocationId}`);
    const bounds = boundsOf.get(home.regionId);
    if (bounds === undefined) throw new Error(`장소의 지역을 찾을 수 없다 — ${home.id}`);
    entities.push({
      id: agent.id,
      type: "agent",
      name: agent.name,
      speciesId: agent.speciesId,
      factionIds: agent.factionIds,
      goalGraphId: agent.goalGraphId,
      position: placeAround(ctx.worldSeed, agent.id, home.position, 6, bounds),
      tags: agent.tags,
      states: agent.states,
      traits: agent.traits,
      ...(agent.relationships === undefined ? {} : { relationships: agent.relationships }),
      ...(agent.beliefs === undefined ? {} : { beliefs: agent.beliefs }),
      ...(agent.memories === undefined ? {} : { memories: agent.memories }),
      ...(agent.inventory === undefined ? {} : { inventory: agent.inventory }),
    });
  }

  // 선언만 되고 놓이지 않은 조직은 판단하지 못한다 — 이름표로 남은 조직을 막는다(§17)
  const placed = new Set(factionPlacements.map((placement) => placement.id));
  const unplaced = ctx.symbols.list("faction").filter((id) => !placed.has(id));
  if (unplaced.length > 0) {
    throw new Error(`정의만 있고 세계에 놓이지 않은 조직 — ${unplaced.join(", ")} (§17)`);
  }

  // ⑥ 일반 개체 — 무리 선언을 개체로 펼친다
  let generalCount = 0;
  for (const spec of populations) {
    const bounds = boundsOf.get(spec.regionId);
    if (bounds === undefined) throw new Error(`무리가 없는 지역에 있다 — ${spec.id} → ${spec.regionId}`);
    const anchor = spec.aroundLocationId === undefined ? undefined : locationById.get(spec.aroundLocationId);
    if (spec.aroundLocationId !== undefined && anchor === undefined) {
      throw new Error(`무리가 없는 장소를 기준으로 삼았다 — ${spec.id} → ${spec.aroundLocationId}`);
    }
    const rarity = rarityOf.get(spec.regionId) ?? 0;
    for (let index = 0; index < spec.count; index++) {
      const id = `${spec.id}#${index}`;
      const position =
        anchor === undefined
          ? placeInRegion(ctx.worldSeed, id, spec.regionId, bounds)
          : placeAround(ctx.worldSeed, id, anchor.position, spec.spreadRadius ?? 12, bounds);
      const states: Record<string, unknown> = { ...spec.states };
      // 매장량은 지역 희귀도에서 파생된다 (§13)
      if (typeof states["amount"] === "number") {
        states["amount"] = deriveNodeAmount(states["amount"], rarity, ctx.worldSeed, id);
      }
      entities.push({
        id,
        type: spec.type,
        name: `${spec.namePrefix} ${index + 1}`,
        ...(spec.speciesId === undefined ? {} : { speciesId: spec.speciesId }),
        ...(spec.goalGraphId === undefined ? {} : { goalGraphId: spec.goalGraphId }),
        position,
        tags: spec.tags,
        states,
      });
      generalCount++;
    }
  }

  const { min, max } = ctx.scale.generalEntities;
  if (generalCount < min || generalCount > max) {
    throw new Error(`일반 개체 수가 §40 규모를 벗어났다 — ${generalCount} (목표 ${min}~${max})`);
  }

  ctx.symbols.declareAll("template", templates.map((template) => template.id));
  ctx.symbols.declareAll("entity", entities.map((entity) => entity.id));
  // 무리 선언의 id 자체도 심볼이다 — 개체는 `<id>#n` 으로 펼쳐진다
  ctx.symbols.declareAll("entity", populations.map((spec) => spec.id));
  ctx.symbols.collectReferences(placements, "bootstrap.placements");
  ctx.symbols.collectReferences(populations, "bootstrap.populations");
  ctx.symbols.collectReferences(agents.map((agent) => agent.factionIds), "bootstrap.agentFactions");

  return {
    bootstrap: { entities },
    templates,
    populations,
    taskIds: [PLACEMENT_TASK, POPULATION_TASK, TEMPLATE_TASK],
  };
}
