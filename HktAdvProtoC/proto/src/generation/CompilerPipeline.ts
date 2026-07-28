// 세계 생성 컴파일러 — §5 의 15단계를 순차 실행하는 오케스트레이터 (Phase-5 "공통 기반")
//
// 각 단계의 산출물을 ArtifactStore 에 남긴다. 그래서 두 가지가 가능하다:
//  ① 단계별 재시도·재개 — 앞 단계를 다시 부르지 않고 뒤 단계만 다시 돌린다.
//  ② 생성 구조 검토(§36.1) — 화면이 단계마다 무엇이 나왔는지 그대로 펼쳐 보인다.
//
// 마지막 두 단계는 코드 몫이다: 14 정합성 검증(참조 무결성 게이트 + 로드 가능성), 15 실행 데이터 저장.
import { RuleEngine } from "../core/rules/RuleEngine";
import type { RuleDefinition, EntityTemplate } from "../core/rules/RuleTypes";
import { bootstrapWorld } from "../core/world/WorldBootstrap";
import { validateWorldDefinition } from "../core/world/WorldValidation";
import { WorldRuntime } from "../core/world/WorldRuntime";
import type {
  AbilityDefinition,
  ActionDefinition,
  EventPattern,
  GoalGraph,
  ResourceDefinition,
  SpaceDefinition,
  StateSchema,
  SurvivalPressureDefinition,
  WorldAxiom,
  WorldBootstrap,
  WorldDefinition,
} from "../core/world/types";
import { WorldRepository } from "../persistence/WorldRepository";
import { generateAbilities, type AbilityGenerationContext } from "./AbilityGenerator";
import { generateActions } from "./ActionGenerator";
import { generateAgents, toArchetype, type AgentDraft } from "./AgentGenerator";
import { ArtifactStore } from "./ArtifactStore";
import { generateAxioms } from "./AxiomGenerator";
import { generateBootstrap, type PopulationSpec } from "./BootstrapGenerator";
import { generateEventPatterns } from "./EventPatternGenerator";
import { generateFactions, toFactionDefinition, type FactionDraft } from "./FactionGenerator";
import {
  PROTOTYPE_SCALE,
  type GenerationContext,
  type NormalizedTheme,
  type WorldScale,
  type WorldSeedInput,
} from "./GenerationTypes";
import { generateGoalGraphs } from "./GoalGraphGenerator";
import { generatePressures } from "./PressureGenerator";
import { generateResources } from "./ResourceGenerator";
import { generateRules } from "./RuleGenerator";
import { generateStateSchemas } from "./SchemaGenerator";
import { generateSpace, type RegionProfile } from "./SpaceGenerator";
import { generateSpecies, toSpeciesDefinition, type SpeciesDraft } from "./SpeciesGenerator";
import { SymbolTable } from "./SymbolTable";
import { createTelemetry, type GenerationTelemetry, type TextGenerationPort } from "./TextGenerationPort";
import { NORMALIZE_TASK, normalizeThemes } from "./WorldSeedNormalizer";

/** §34 ValidationIssue */
export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  targetId: string;
  message: string;
  suggestedFix?: string;
}

export interface StepReport {
  /** §5 의 1~15 */
  index: number;
  id: string;
  title: string;
  status: "ok" | "reused" | "failed";
  /** 이 단계가 부른 생성 호출 */
  taskIds: string[];
  summary: string;
  error?: string;
}

export interface CompileOptions {
  port: TextGenerationPort;
  seedInput: WorldSeedInput;
  worldSeed: number;
  worldId?: string;
  scale?: WorldScale;
  /** 이전 실행의 아티팩트 — 여기 있는 단계는 생성 호출 없이 재사용한다 */
  resumeFrom?: ArtifactStore;
  repository?: WorldRepository;
}

export interface CompileResult {
  definition: WorldDefinition;
  steps: StepReport[];
  issues: ValidationIssue[];
  artifacts: ArtifactStore;
  symbols: SymbolTable;
  telemetry: GenerationTelemetry;
  repository: WorldRepository;
}

/** 파이프라인이 단계 사이로 나르는 것 전부 */
interface PipelineState {
  themes: NormalizedTheme[];
  axioms: WorldAxiom[];
  pressures: SurvivalPressureDefinition[];
  stateSchemas: StateSchema[];
  rules: RuleDefinition[];
  space: SpaceDefinition;
  profiles: RegionProfile[];
  resources: ResourceDefinition[];
  species: SpeciesDraft[];
  factions: FactionDraft[];
  abilities: AbilityDefinition[];
  abilityContexts: AbilityGenerationContext[];
  goalGraphs: GoalGraph[];
  actions: ActionDefinition[];
  eventPatterns: EventPattern[];
  bootstrap: WorldBootstrap;
  templates: EntityTemplate[];
  populations: PopulationSpec[];
  /** 13단계에서 생기는 인물 원형 (§18) */
  archetypes: AgentDraft[];
  issues: ValidationIssue[];
}

interface Step {
  index: number;
  id: string;
  title: string;
  /** 생성 호출을 포함한 실행. 반환값이 아티팩트로 저장된다 */
  run(ctx: GenerationContext, state: PipelineState): Promise<{ data: unknown; taskIds: string[] }>;
  /** 아티팩트를 파이프라인 상태로 접는다. 재개 시에는 이것만 돈다 */
  apply(ctx: GenerationContext, state: PipelineState, data: unknown): void;
  summary(state: PipelineState): string;
}

function emptyState(): PipelineState {
  return {
    themes: [],
    axioms: [],
    pressures: [],
    stateSchemas: [],
    rules: [],
    space: { regions: [], locations: [], connections: [] },
    profiles: [],
    resources: [],
    species: [],
    factions: [],
    abilities: [],
    abilityContexts: [],
    goalGraphs: [],
    actions: [],
    eventPatterns: [],
    bootstrap: { entities: [] },
    templates: [],
    populations: [],
    archetypes: [],
    issues: [],
  };
}

/** §5 의 15단계. 순서를 바꾸지 않는다 — 뒤 단계는 앞 단계의 산출물 위에서만 성립한다 */
function buildSteps(options: CompileOptions): Step[] {
  const worldId = options.worldId ?? "world.generated_first";
  return [
    {
      index: 1,
      id: "normalize_themes",
      title: "주제 정규화",
      async run(ctx) {
        return { data: await normalizeThemes(ctx), taskIds: [NORMALIZE_TASK] };
      },
      apply(_ctx, state, data) {
        state.themes = data as NormalizedTheme[];
      },
      summary: (state) => `주제 ${state.themes.length}개 정규화`,
    },
    {
      index: 2,
      id: "axioms",
      title: "핵심 명제",
      async run(ctx, state) {
        return { data: await generateAxioms(ctx, state.themes), taskIds: ["axioms"] };
      },
      apply(ctx, state, data) {
        state.axioms = data as WorldAxiom[];
        ctx.symbols.declareAll("axiom", state.axioms.map((axiom) => axiom.id));
      },
      summary: (state) => `명제 ${state.axioms.length}개`,
    },
    {
      index: 3,
      id: "pressures",
      title: "생존 압력",
      async run(ctx, state) {
        return { data: await generatePressures(ctx, state.axioms), taskIds: ["pressures"] };
      },
      apply(ctx, state, data) {
        state.pressures = data as SurvivalPressureDefinition[];
        ctx.symbols.declareAll("pressure", state.pressures.map((pressure) => pressure.id));
      },
      summary: (state) => `압력 ${state.pressures.length}종`,
    },
    {
      index: 4,
      id: "state_schemas",
      title: "상태 스키마",
      async run(ctx, state) {
        return {
          data: await generateStateSchemas(ctx, state.axioms, state.pressures),
          taskIds: ["state_schemas"],
        };
      },
      apply(ctx, state, data) {
        state.stateSchemas = data as StateSchema[];
        ctx.symbols.declareAll("state", state.stateSchemas.map((schema) => schema.id));
      },
      summary: (state) => `상태 ${state.stateSchemas.length}종`,
    },
    {
      index: 5,
      id: "rules",
      title: "세계 규칙",
      async run(ctx, state) {
        const result = await generateRules(ctx, state.axioms, state.stateSchemas);
        return { data: { rules: result.rules, outline: result.outline }, taskIds: result.taskIds };
      },
      apply(ctx, state, data) {
        state.rules = (data as { rules: RuleDefinition[] }).rules;
        ctx.symbols.declareAll("rule", state.rules.map((rule) => rule.id));
      },
      summary: (state) => `규칙 ${state.rules.length}개`,
    },
    {
      index: 6,
      id: "space_and_resources",
      title: "자원·공간",
      async run(ctx, state) {
        const space = await generateSpace(ctx, state.axioms);
        const resources = await generateResources(ctx, space.profiles);
        return {
          data: { space: space.space, profiles: space.profiles, resources },
          taskIds: ["space", "resources"],
        };
      },
      apply(ctx, state, data) {
        const typed = data as { space: SpaceDefinition; profiles: RegionProfile[]; resources: ResourceDefinition[] };
        state.space = typed.space;
        state.profiles = typed.profiles;
        state.resources = typed.resources;
        ctx.symbols.declareAll("region", state.space.regions.map((region) => region.id));
        ctx.symbols.declareAll("location", state.space.locations.map((location) => location.id));
        ctx.symbols.declareAll("resource", state.resources.map((resource) => resource.id));
      },
      summary: (state) =>
        `지역 ${state.space.regions.length} · 장소 ${state.space.locations.length} · 자원 ${state.resources.length}`,
    },
    {
      index: 7,
      id: "species",
      title: "종족",
      async run(ctx, state) {
        const result = await generateSpecies(ctx, state.pressures);
        return { data: { species: result.species, outline: result.outline }, taskIds: result.taskIds };
      },
      apply(ctx, state, data) {
        state.species = (data as { species: SpeciesDraft[] }).species;
        ctx.symbols.declareAll("species", state.species.map((species) => species.id));
      },
      summary: (state) => `종족 ${state.species.length} (${state.species.map((s) => s.strategy).join(" / ")})`,
    },
    {
      index: 8,
      id: "factions",
      title: "조직",
      async run(ctx, state) {
        const result = await generateFactions(ctx, state.resources);
        return { data: { factions: result.factions, outline: result.outline }, taskIds: result.taskIds };
      },
      apply(ctx, state, data) {
        state.factions = (data as { factions: FactionDraft[] }).factions;
        for (const faction of state.factions) {
          ctx.symbols.declare("faction", faction.id);
          ctx.symbols.declareAll("faction", (faction.internalGroups ?? []).map((group) => group.id));
        }
      },
      summary: (state) =>
        `조직 ${state.factions.length} · 내부 집단 ${state.factions.reduce((n, f) => n + (f.internalGroups?.length ?? 0), 0)}`,
    },
    {
      index: 9,
      id: "abilities",
      title: "능력 체계",
      async run(ctx, state) {
        const result = await generateAbilities(ctx, state.axioms);
        return { data: { abilities: result.abilities, contexts: result.contexts }, taskIds: result.taskIds };
      },
      apply(ctx, state, data) {
        const typed = data as { abilities: AbilityDefinition[]; contexts: AbilityGenerationContext[] };
        state.abilities = typed.abilities;
        state.abilityContexts = typed.contexts;
        ctx.symbols.declareAll("ability", state.abilities.map((ability) => ability.id));
      },
      summary: (state) =>
        `능력 ${state.abilities.length}개 (출력 ${state.abilities.map((a) => a.outputRange.max).join("/")})`,
    },
    {
      index: 10,
      id: "goal_graphs",
      title: "목적 그래프",
      async run(ctx, state) {
        const result = await generateGoalGraphs(ctx, state.pressures);
        return { data: { graphs: result.graphs, outline: result.outline }, taskIds: result.taskIds };
      },
      apply(ctx, state, data) {
        state.goalGraphs = (data as { graphs: GoalGraph[] }).graphs;
        for (const graph of state.goalGraphs) {
          ctx.symbols.declare("goal_graph", graph.id);
          ctx.symbols.declareAll("goal", graph.nodes.map((node) => node.id));
        }
      },
      summary: (state) =>
        `그래프 ${state.goalGraphs.length} · 목적 ${new Set(state.goalGraphs.flatMap((g) => g.nodes.map((n) => n.id))).size}`,
    },
    {
      index: 11,
      id: "actions",
      title: "행동 정의",
      async run(ctx, state) {
        return { data: await generateActions(ctx, state.goalGraphs), taskIds: ["actions"] };
      },
      apply(ctx, state, data) {
        state.actions = data as ActionDefinition[];
        ctx.symbols.declareAll("action", state.actions.map((action) => action.id));
      },
      summary: (state) => `행동 ${state.actions.length}종`,
    },
    {
      index: 12,
      id: "event_patterns",
      title: "사건 패턴",
      async run(ctx, state) {
        return {
          data: await generateEventPatterns(ctx, state.rules, state.actions),
          taskIds: ["event_patterns"],
        };
      },
      apply(ctx, state, data) {
        state.eventPatterns = data as EventPattern[];
        ctx.symbols.declareAll("event_pattern", state.eventPatterns.map((pattern) => pattern.id));
      },
      summary: (state) => `사건 패턴 ${state.eventPatterns.length}개`,
    },
    {
      index: 13,
      id: "bootstrap",
      title: "초기 배치",
      async run(ctx, state) {
        const agents = await generateAgents(ctx, state.abilityContexts);
        const placement = await generateBootstrap(ctx, state.space, state.profiles, agents.agents);
        return {
          data: {
            agents: agents.agents,
            bootstrap: placement.bootstrap,
            templates: placement.templates,
            populations: placement.populations,
          },
          taskIds: [...agents.taskIds, ...placement.taskIds],
        };
      },
      apply(ctx, state, data) {
        const typed = data as {
          agents: AgentDraft[];
          bootstrap: WorldBootstrap;
          templates: EntityTemplate[];
          populations: PopulationSpec[];
        };
        state.bootstrap = typed.bootstrap;
        state.templates = typed.templates;
        state.populations = typed.populations;
        // 인물 원형은 WorldDefinition.agentArchetypes 로 간다
        state.archetypes = typed.agents;
        ctx.symbols.declareAll("template", state.templates.map((template) => template.id));
        ctx.symbols.declareAll("entity", state.bootstrap.entities.map((entity) => entity.id));
      },
      summary: (state) =>
        `개체 ${state.bootstrap.entities.length} (인물 ${state.archetypes.length} · 일반 ${state.populations.reduce((n, p) => n + p.count, 0)})`,
    },
    {
      index: 14,
      id: "validation",
      title: "정합성 검증",
      async run(ctx, state) {
        return { data: validateGenerated(ctx, buildDefinition(state, worldId, ctx.worldSeed)), taskIds: [] };
      },
      apply(_ctx, state, data) {
        state.issues = data as ValidationIssue[];
      },
      summary: (state) =>
        state.issues.length === 0
          ? "오류 0"
          : `오류 ${state.issues.filter((i) => i.level === "error").length} · 경고 ${state.issues.filter((i) => i.level === "warning").length}`,
    },
    {
      index: 15,
      id: "persist",
      title: "실행 데이터 저장",
      async run(ctx, state) {
        const definition = buildDefinition(state, worldId, ctx.worldSeed);
        return { data: { worldId: definition.metadata.id, entities: definition.bootstrap.entities.length }, taskIds: [] };
      },
      apply() {
        // 저장은 compileWorld 가 마지막에 한 번 한다
      },
      summary: () => `${worldId} 저장`,
    },
  ];
}

function buildDefinition(state: PipelineState, worldId: string, worldSeed: number): WorldDefinition {
  return {
    metadata: { id: worldId, title: "제약의 대륙", worldSeed },
    axioms: state.axioms,
    stateSchemas: state.stateSchemas,
    ruleDefinitions: state.rules,
    entityTemplates: state.templates,
    spaces: state.space,
    resources: state.resources,
    species: state.species.map(toSpeciesDefinition),
    survivalPressures: state.pressures,
    factions: state.factions.map(toFactionDefinition),
    agentArchetypes: state.archetypes.map(toArchetype),
    abilitySystem: { abilities: state.abilities },
    goalTemplates: state.goalGraphs,
    actionDefinitions: state.actions,
    eventPatterns: state.eventPatterns,
    bootstrap: state.bootstrap,
  };
}

/**
 * 14단계: 정합성 검증.
 * §34 의 의미 검증 10종 전체는 Phase 6 의 WorldValidator 몫이다. 여기서 막는 것은
 * "이 정의가 실행될 수 있는가" 에 직결된 두 가지다 — 미해결 참조와 로드 가능성.
 */
function validateGenerated(ctx: GenerationContext, definition: WorldDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const reference of ctx.symbols.unresolved()) {
    issues.push({
      level: "error",
      code: "unknown_reference",
      targetId: reference.id,
      message: `${reference.where} 가 존재하지 않는 ${reference.kind} 을 가리킨다`,
      suggestedFix: `${reference.kind} 정의를 만들거나 참조를 지운다`,
    });
  }

  try {
    const engine = new RuleEngine(definition.ruleDefinitions);
    const errors = validateWorldDefinition(definition, engine);
    for (const error of errors) {
      issues.push({
        level: "error",
        code: "world_validation",
        targetId: definition.metadata.id,
        message: error,
      });
    }
    // 정적 검사만으로는 "로드된다"를 말할 수 없다 — 실제로 개체를 만들어 본다(버리는 런타임).
    if (errors.length === 0) {
      bootstrapWorld(new WorldRuntime(definition));
    }
  } catch (error) {
    issues.push({
      level: "error",
      code: "definition_not_loadable",
      targetId: definition.metadata.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return issues;
}

export async function compileWorld(options: CompileOptions): Promise<CompileResult> {
  const artifacts = new ArtifactStore();
  const symbols = new SymbolTable();
  const telemetry = createTelemetry();
  const ctx: GenerationContext = {
    port: options.port,
    symbols,
    artifacts,
    telemetry,
    seedInput: options.seedInput,
    worldSeed: options.worldSeed,
    scale: options.scale ?? PROTOTYPE_SCALE,
  };

  const state = emptyState();
  const reports: StepReport[] = [];
  const steps = buildSteps(options);

  for (const step of steps) {
    const reused = options.resumeFrom?.has(step.id) === true;
    try {
      if (reused) {
        const data = options.resumeFrom!.get(step.id);
        step.apply(ctx, state, data);
        artifacts.save({ stepId: step.id, stepIndex: step.index, title: step.title, data, taskIds: [] });
        reports.push({
          index: step.index,
          id: step.id,
          title: step.title,
          status: "reused",
          taskIds: [],
          summary: step.summary(state),
        });
        continue;
      }
      const { data, taskIds } = await step.run(ctx, state);
      step.apply(ctx, state, data);
      artifacts.save({ stepId: step.id, stepIndex: step.index, title: step.title, data, taskIds });
      reports.push({
        index: step.index,
        id: step.id,
        title: step.title,
        status: "ok",
        taskIds,
        summary: step.summary(state),
      });
    } catch (error) {
      reports.push({
        index: step.index,
        id: step.id,
        title: step.title,
        status: "failed",
        taskIds: [],
        summary: "중단",
        error: error instanceof Error ? error.message : String(error),
      });
      throw Object.assign(
        new Error(`세계 생성 ${step.index}단계 실패 — ${step.title}\n${error instanceof Error ? error.message : String(error)}`),
        { steps: reports },
      );
    }
  }

  const definition = buildDefinition(state, options.worldId ?? "world.generated_first", options.worldSeed);
  const repository = options.repository ?? new WorldRepository();
  repository.save(definition);

  return { definition, steps: reports, issues: state.issues, artifacts, symbols, telemetry, repository };
}
