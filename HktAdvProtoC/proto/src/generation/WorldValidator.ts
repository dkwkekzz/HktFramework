// 생성 결과 정적 검증 (기획서 §34 / Phase-6 §6.1)
//
// 두 층으로 판정한다.
//  (a) 스키마 층 — Phase 1~5 가 확정한 계약(WorldValidation·RuleSchema)을 전체 조립본에 다시 건다.
//  (b) 의미 층 — §34 필수 규칙 10개(+ G-1 rule.chance · G-3 faction.hidden · G-4 species.structure · G-5 space.profile)를 각각 **독립 검사기**로 둔다. 코드명은 고정이다(수정 루프가 이 코드로 단계를 찾는다).
//
// 검사기는 "통과했다"가 아니라 **무엇을 몇 개 봤고 어디가 걸렸는가**를 남긴다(CLAUDE.md 검토 규칙).
import { rankGoals } from "../core/agents/GoalSystem";
import { RuleEngine } from "../core/rules/RuleEngine";
import { validateAgainstSchema } from "../core/rules/RuleSchema";
import type { RuleDefinition, RuleEffect, RuleTargetSelector } from "../core/rules/RuleTypes";
import { bootstrapWorld } from "../core/world/WorldBootstrap";
import { collectChanceSites, findChanceViolations } from "../core/rules/ChanceUse";
import { validateWorldDefinition } from "../core/world/WorldValidation";
import { WorldRuntime } from "../core/world/WorldRuntime";
import type {
  AbilityDefinition,
  BootstrapEntity,
  GoalGraph,
  StateOwnerType,
  WorldDefinition,
} from "../core/world/types";
import type { ValidationIssue } from "./CompilerPipeline";
import { abilityCostWeight } from "./derivations";
import { SymbolTable, type SymbolKind } from "./SymbolTable";

/** §34 필수 규칙 10개 + G-1·G-3·G-4·G-5 가 더한 4종의 고정 코드 — 수정 루프(§42-6)가 이 코드로 재생성 단계를 찾는다 */
export const SEMANTIC_CODES = [
  "axiom.enforced",
  "state.schema",
  "rule.target-exists",
  "rule.chance",
  "resource.source",
  "resource.overuse",
  "space.profile",
  "pressure.related",
  "species.need",
  "species.structure",
  "faction.lifecycle",
  "faction.hidden",
  "agent.goal",
  "action.cost",
  "ability.cost-scaling",
  "event.multi-agent",
  "goal.no-infinite",
] as const;

export type SemanticCode = (typeof SEMANTIC_CODES)[number];

export interface CheckReport {
  code: string;
  /** §34 의 규칙 문장 그대로 */
  rule: string;
  ok: boolean;
  /** 이 검사기가 실제로 들여다본 대상 수 — 0 이면 "검사할 것이 없었다"는 뜻이다 */
  inspected: number;
  issues: ValidationIssue[];
  evidence: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  /** (a) 스키마 층 */
  schema: CheckReport;
  /** (b) 의미 층 15종 — SEMANTIC_CODES 순서 고정 */
  checks: CheckReport[];
}

function issue(
  code: string,
  targetId: string,
  message: string,
  suggestedFix?: string,
  level: "error" | "warning" = "error",
): ValidationIssue {
  return { level, code, targetId, message, ...(suggestedFix === undefined ? {} : { suggestedFix }) };
}

function report(
  code: string,
  rule: string,
  inspected: number,
  issues: ValidationIssue[],
  evidence: string,
): CheckReport {
  return { code, rule, inspected, issues, ok: issues.every((i) => i.level !== "error"), evidence };
}

function ownerTypeOfBootstrap(entity: BootstrapEntity): StateOwnerType {
  if (entity.type === "location") return entity.tags.includes("region") ? "region" : "location";
  return entity.type as StateOwnerType;
}

// =====================================================================================
// (a) 스키마 층
// =====================================================================================

/**
 * 전체 조립본 기준 재검 (§34 "JSON 스키마 검증").
 * 규칙 하나하나는 생성 직후 이미 통과했다 — 여기서 보는 것은 **합쳐 놓았을 때도 성립하는가**다.
 */
function checkSchemaLayer(definition: WorldDefinition): CheckReport {
  const issues: ValidationIssue[] = [];
  let inspected = 0;
  for (const rule of definition.ruleDefinitions) {
    inspected += 1;
    for (const error of validateAgainstSchema(rule)) {
      issues.push(issue("schema.rule", rule.id, error, "규칙 정규형(RuleSchema)에 맞춘다"));
    }
  }
  let engine: RuleEngine | undefined;
  try {
    engine = new RuleEngine(definition.ruleDefinitions);
  } catch (error) {
    issues.push(
      issue("schema.rule-engine", definition.metadata.id, error instanceof Error ? error.message : String(error)),
    );
  }
  if (engine !== undefined) {
    for (const error of validateWorldDefinition(definition, engine)) {
      inspected += 1;
      issues.push(issue("schema.world", definition.metadata.id, error));
    }
  }
  return report(
    "schema",
    "생성 결과는 JSON 스키마와 실행 계약을 통과한다 (§34)",
    inspected,
    issues,
    `규칙 ${definition.ruleDefinitions.length}개 정규형 검증 · 조립본 계약 위반 ${issues.length}건`,
  );
}

// =====================================================================================
// (b) 의미 층 — §34 필수 규칙 10개 + G-1·G-3·G-4·G-5
// =====================================================================================

/** 검사기가 공유하는 사전 — 매 검사기가 정의를 다시 훑지 않게 한다 */
interface Index {
  definition: WorldDefinition;
  stateIds: Set<string>;
  /** `ownerType.stateKey` */
  stateKeys: Set<string>;
  /** §9 updatePolicy="derived" — 읽을 수는 있어도 쓸 수는 없는 상태 */
  derivedStates: Set<string>;
  ruleIds: Set<string>;
  actionIds: Set<string>;
  resources: Map<string, { tags: string[] }>;
  /** 이미 만들어 본 런타임 (agent.goal 검사기가 쓴다). 실패하면 undefined */
  runtime?: WorldRuntime;
  runtimeError?: string;
}

function buildIndex(definition: WorldDefinition): Index {
  const index: Index = {
    definition,
    stateIds: new Set(definition.stateSchemas.map((schema) => schema.id)),
    stateKeys: new Set(definition.stateSchemas.map((schema) => `${schema.ownerType}.${schema.id}`)),
    derivedStates: new Set(
      definition.stateSchemas.filter((schema) => schema.updatePolicy === "derived").map((schema) => schema.id),
    ),
    ruleIds: new Set(definition.ruleDefinitions.map((rule) => rule.id)),
    actionIds: new Set(definition.actionDefinitions.map((action) => action.id)),
    resources: new Map(definition.resources.map((resource) => [resource.id, { tags: resource.tags }])),
  };
  try {
    const runtime = new WorldRuntime(definition);
    bootstrapWorld(runtime);
    index.runtime = runtime;
  } catch (error) {
    index.runtimeError = error instanceof Error ? error.message : String(error);
  }
  return index;
}

// --- 0. axiom.enforced (§7 — G-12) ------------------------------------------------------

/**
 * §7 "이 명제들은 이후 생성되는 모든 규칙과 콘텐츠의 상위 제약이다".
 * immutable 명제가 **어떤 규칙에도 강제되지 않으면** 선언이 공중에 떠 있는 것이다 —
 * 규칙의 derivedFromAxioms 가 그 명제를 세계의 실행에 못 박는 유일한 하드 연결이다.
 * (의미적 위반 탐지는 여전히 §33.2 AI 경고의 몫 — 여기는 "강제 수단이 존재하는가"만 본다.)
 * 수정 라운드가 불변 명제를 바꿀 수 없다는 계약은 RepairLoop.assertImmutableAxiomsPreserved 가 갖는다.
 */
function checkAxiomEnforced(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  const enforcedBy = new Map<string, number>();
  for (const rule of definition.ruleDefinitions) {
    for (const axiomId of rule.derivedFromAxioms ?? []) {
      enforcedBy.set(axiomId, (enforcedBy.get(axiomId) ?? 0) + 1);
    }
  }
  let immutableCount = 0;
  for (const axiom of definition.axioms) {
    const count = enforcedBy.get(axiom.id) ?? 0;
    if (axiom.immutable) immutableCount += 1;
    if (count > 0) continue;
    issues.push(
      issue(
        "axiom.enforced",
        axiom.id,
        axiom.immutable
          ? `불변 명제 ${axiom.id} 를 강제하는 규칙이 하나도 없다 — "상위 제약" 이 선언뿐이다 (§7)`
          : `명제 ${axiom.id} 에서 파생된 규칙이 없다 (§7)`,
        "이 명제에서 파생된 규칙에 derivedFromAxioms 로 연결하거나 명제를 거둔다",
        axiom.immutable ? "error" : "warning",
      ),
    );
  }
  const rows = definition.axioms.map((axiom) => `${axiom.id.replace("axiom.", "")}:${enforcedBy.get(axiom.id) ?? 0}`);
  return report(
    "axiom.enforced",
    "불변 명제는 최소 하나의 규칙으로 강제된다",
    definition.axioms.length,
    issues,
    `명제 ${definition.axioms.length}개(불변 ${immutableCount}) · 규칙 연결 ${rows.join(" ")} · 강제 없음 ${issues.length}`,
  );
}

// --- 0a. pressure.related (§8 — G-12) ---------------------------------------------------

/**
 * §8 relatedResources — 압력이 "무엇으로 풀리는가"의 선언.
 * 세계에 없는 자원을 가리키면 그 선언은 지식이 아니라 소음이다(error).
 * 빈 목록은 허용한다 — 안전 압력처럼 자원으로 풀리지 않는 압력도 있다.
 */
function checkPressureRelated(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  const known = new Set<string>();
  for (const resource of definition.resources) {
    known.add(resource.id);
    for (const tag of resource.tags) known.add(tag);
  }
  let inspected = 0;
  let linked = 0;
  for (const pressure of definition.survivalPressures) {
    if (pressure.relatedResources.length > 0) linked += 1;
    for (const entry of pressure.relatedResources) {
      inspected += 1;
      if (known.has(entry)) continue;
      issues.push(
        issue(
          "pressure.related",
          pressure.id,
          `압력 ${pressure.id}: 세계에 없는 자원을 가리킨다 — ${entry} (§8 relatedResources)`,
          "실재하는 자원 id·태그로 바꾸거나 목록에서 지운다",
        ),
      );
    }
  }
  return report(
    "pressure.related",
    "압력의 관련 자원은 세계에 실재한다",
    inspected,
    issues,
    `압력 ${definition.survivalPressures.length}개 중 자원 연결 ${linked} · 참조 ${inspected}건 · 허상 ${issues.length}`,
  );
}

// --- 1. state.schema ------------------------------------------------------------------

/** 효과가 건드리는 상태의 소유 타입 — 셀렉터로 좁힐 수 있는 것만 좁힌다 */
function ownerHintOf(selector: RuleTargetSelector): StateOwnerType | undefined {
  return selector.type === "world" ? "world" : undefined;
}

interface StateUsage {
  where: string;
  key: string;
  owner?: StateOwnerType;
  /** 이 자리가 상태를 **쓰는가** — 파생 상태(§9 updatePolicy=derived)는 쓸 수 없다 */
  write: boolean;
}

function collectStateUsage(definition: WorldDefinition): StateUsage[] {
  const usage: StateUsage[] = [];
  const push = (where: string, key: string, owner?: StateOwnerType, write = false): void => {
    usage.push({ where, key, write, ...(owner === undefined ? {} : { owner }) });
  };

  for (const entity of definition.bootstrap.entities) {
    const owner = ownerTypeOfBootstrap(entity);
    for (const key of Object.keys(entity.states)) push(`초기 배치 ${entity.id}`, key, owner, true);
  }
  for (const template of definition.entityTemplates ?? []) {
    const owner = template.type === "location" ? "location" : (template.type as StateOwnerType);
    for (const key of Object.keys(template.states)) push(`개체 템플릿 ${template.id}`, key, owner, true);
  }
  // 생존 압력의 targetState/failureState 는 상태 키가 아니라 "무엇이 유지되고 무엇이 무너지는가"의 서술이다(§8) —
  // 기계가 읽는 것은 relievedWhen 조건이고, 그 안의 상태 키는 조건 순회에서 잡는다.
  for (const pressure of definition.survivalPressures) {
    for (const condition of pressure.relievedWhen) {
      for (const side of [condition.left, condition.right]) {
        if (side.kind === "state" || side.kind === "belief" || side.kind === "entity_state") {
          push(`생존 압력 ${pressure.id}`, side.key);
        }
      }
    }
  }
  for (const graph of definition.goalTemplates) {
    for (const node of graph.nodes) {
      for (const desired of node.desiredChanges) push(`목적 ${graph.id}/${node.id}`, desired.stateKey);
      for (const factor of node.utilityFactors ?? []) push(`목적 ${graph.id}/${node.id}`, factor.stateKey);
      for (const emotion of node.emotionKeys ?? []) push(`목적 ${graph.id}/${node.id}`, emotion.stateKey);
    }
  }
  for (const action of definition.actionDefinitions) {
    for (const cost of action.costs) push(`행동 ${action.id}`, cost.stateKey, undefined, true);
    for (const effect of action.expectedEffects) push(`행동 ${action.id}`, effect.stateKey);
  }
  for (const ability of definition.abilitySystem?.abilities ?? []) {
    for (const cost of ability.costs) push(`능력 ${ability.id}`, cost.stateKey, undefined, true);
    for (const effect of ability.failureEffects) push(`능력 ${ability.id}`, effect.stateKey, undefined, true);
  }
  for (const rule of definition.ruleDefinitions) {
    for (const effect of rule.effects as RuleEffect[]) {
      if (effect.type === "modify_state") {
        push(`규칙 ${rule.id}`, effect.stateKey, ownerHintOf(effect.target), true);
      }
    }
  }
  return usage;
}

function checkStateSchema(index: Index): CheckReport {
  const usage = collectStateUsage(index.definition);
  const issues: ValidationIssue[] = [];
  let derivedWrites = 0;
  for (const entry of usage) {
    // 관계 상태(`relationship:trust`)와 믿음 상태(`belief:...`)는 런타임이 만드는 파생 키다 — 스키마 대상이 아니다
    if (entry.key.includes(":")) continue;
    const known =
      entry.owner === undefined
        ? index.stateIds.has(entry.key)
        : index.stateKeys.has(`${entry.owner}.${entry.key}`);
    if (!known) {
      issues.push(
        issue(
          "state.schema",
          entry.where,
          `${entry.where}: 등록되지 않은 상태를 쓴다 — ${entry.owner === undefined ? "" : `${entry.owner}.`}${entry.key}`,
          "stateSchemas 에 이 상태를 등록하거나 참조를 지운다",
        ),
      );
      continue;
    }
    // 파생 상태는 다른 상태의 함수다 — 쓰는 순간 스키마 계약이 깨진다(§9 updatePolicy="derived").
    // 규칙이 한 번도 발동하지 않으면 실행 중에는 드러나지 않으므로 정적으로 잡는다.
    if (entry.write && index.derivedStates.has(entry.key)) {
      derivedWrites += 1;
      issues.push(
        issue(
          "state.schema",
          entry.where,
          `${entry.where}: 파생 상태에 값을 쓴다 — ${entry.key} (§9 updatePolicy=derived, 원천 상태를 바꿔야 한다)`,
          `${entry.key} 를 만드는 원천 상태(예: fear·hunger·health)를 대신 바꾼다`,
        ),
      );
    }
  }
  return report(
    "state.schema",
    "모든 상태는 정의된 스키마를 사용한다",
    usage.length,
    issues,
    `상태 참조 ${usage.length}건 대조 (스키마 ${index.stateIds.size}종·파생 ${index.derivedStates.size}종) · ` +
      `미등록 ${issues.length - derivedWrites}건 · 파생 상태 쓰기 ${derivedWrites}건`,
  );
}

// --- 2. rule.target-exists ------------------------------------------------------------

/** 정의가 스스로 선언한 id 전부를 심볼 테이블에 올린다 (Phase-5 §5.2 재사용) */
function declareAll(definition: WorldDefinition): SymbolTable {
  const symbols = new SymbolTable();
  const put = (kind: SymbolKind, ids: readonly string[]): void => symbols.declareAll(kind, ids);
  put("axiom", definition.axioms.map((axiom) => axiom.id));
  put("pressure", definition.survivalPressures.map((pressure) => pressure.id));
  put("state", definition.stateSchemas.map((schema) => schema.id));
  put("rule", definition.ruleDefinitions.map((rule) => rule.id));
  put("region", definition.spaces.regions.map((region) => region.id));
  put("location", definition.spaces.locations.map((location) => location.id));
  put("resource", definition.resources.map((resource) => resource.id));
  put("species", definition.species.map((species) => species.id));
  for (const faction of definition.factions) {
    symbols.declare("faction", faction.id);
    put("faction", (faction.internalGroups ?? []).map((group) => group.id));
  }
  put("ability", (definition.abilitySystem?.abilities ?? []).map((ability) => ability.id));
  for (const graph of definition.goalTemplates) {
    symbols.declare("goal_graph", graph.id);
    put("goal", graph.nodes.map((node) => node.id));
  }
  put("action", definition.actionDefinitions.map((action) => action.id));
  put("event_pattern", definition.eventPatterns.map((pattern) => pattern.id));
  // 템플릿 id 는 개체 접두사(creature.…)를 그대로 쓰기도 한다 — 두 종류 모두로 선언해 둔다
  put("template", (definition.entityTemplates ?? []).map((template) => template.id));
  put("entity", (definition.entityTemplates ?? []).map((template) => template.id));
  put("entity", definition.bootstrap.entities.map((entity) => entity.id));
  put("entity", definition.agentArchetypes.map((archetype) => archetype.id));
  return symbols;
}

function checkRuleTargets(index: Index): CheckReport {
  const definition = index.definition;
  const symbols = declareAll(definition);
  // 정의 전체를 훑어 id 모양의 문자열을 참조로 본다 — 규칙만이 아니라 어디서 가리켜도 실존해야 한다
  symbols.collectReferences(definition, definition.metadata.id);
  // 관계 기본값의 **키**는 값이 아니라 키라서 위 순회가 잡지 못한다 (§17 relationshipDefaults)
  for (const faction of definition.factions) {
    for (const toId of Object.keys(faction.relationshipDefaults)) {
      symbols.collectReferences(toId, `조직 ${faction.id} 관계 기본값`);
    }
  }
  const unresolved = symbols.unresolved();
  const issues = unresolved.map((reference) =>
    issue(
      "rule.target-exists",
      reference.id,
      `${reference.where} 가 존재하지 않는 ${reference.kind} 을 가리킨다 — ${reference.id}`,
      `${reference.kind} 정의를 만들거나 참조를 지운다`,
    ),
  );
  return report(
    "rule.target-exists",
    "모든 규칙의 대상이 실제로 존재한다",
    symbols.referenceCount,
    issues,
    `참조 ${symbols.referenceCount}건 / 선언 ${symbols.size}개 대조 · 미해결 ${issues.length}건` +
      (unresolved.length === 0 ? "" : ` (${unresolved.slice(0, 3).map((r) => r.id).join(", ")}…)`),
  );
}

// --- 3. rule.chance (§12 — G-1) -------------------------------------------------------

/**
 * §12 "확률은 인과관계를 대체하는 용도로 사용하지 않는다. 확률은 다음 용도로 제한한다."
 * 확률을 쓰는 효과마다 5용도 중 하나를 밝혔는지, 그 용도가 문맥에 맞는지, 원인 위에 얹혔는지 본다.
 * 판정 자체는 코어(ChanceUse.findChanceViolations)가 갖는다 — 규칙 실행기와 같은 정의를 쓰기 위해서다.
 */
function checkRuleChance(index: Index): CheckReport {
  const rules = index.definition.ruleDefinitions;
  const sites = collectChanceSites(rules);
  const violations = findChanceViolations(rules);
  const issues = violations.map((violation) =>
    issue("rule.chance", violation.ruleId, violation.message, violation.fix),
  );
  const byUse = new Map<string, number>();
  for (const site of sites) {
    const key = site.use ?? "(용도 없음)";
    byUse.set(key, (byUse.get(key) ?? 0) + 1);
  }
  return report(
    "rule.chance",
    "확률은 인과를 대체하지 않고 §12 5용도 안에서만 쓰인다",
    sites.length,
    issues,
    `확률 지점 ${sites.length}개 — ${[...byUse].map(([use, count]) => `${use} ${count}`).join(" · ") || "없음"} · 위반 ${issues.length}건`,
  );
}

// --- 4. resource.source ---------------------------------------------------------------

function checkResourceSource(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  // 초기 배치가 이미 갖고 있는 자원 — 생산 규칙이 없어도 "세상에 존재하는 경로"다 (§34)
  const placed = new Set<string>();
  for (const entity of definition.bootstrap.entities) {
    for (const tag of entity.tags) placed.add(tag);
    for (const [key, value] of Object.entries(entity.states)) {
      // 자원 노드는 자기가 무엇의 재고인지를 값으로 들고 있다 (resource_id) — 그것이 초기 배치의 증거다
      if (key === "resource_id" && typeof value === "string" && value !== "") placed.add(value);
      if (typeof value === "number" && value > 0) placed.add(key);
    }
  }
  let withProduction = 0;
  let onlyPlacement = 0;
  for (const resource of definition.resources) {
    const production = resource.productionRules.filter((id) => index.ruleIds.has(id));
    const hasPlacement =
      placed.has(resource.id) || resource.tags.some((tag) => placed.has(tag)) || placed.has(resource.id.split(".")[1] ?? "");
    if (production.length > 0) withProduction += 1;
    else if (hasPlacement) onlyPlacement += 1;
    if (production.length > 0 || hasPlacement) continue;
    issues.push(
      issue(
        "resource.source",
        resource.id,
        `자원 ${resource.id}: 생성 경로도 초기 배치도 없다 (§34)`,
        "productionRules 에 생산 규칙을 잇거나 bootstrap 에 초기 재고를 둔다",
      ),
    );
  }
  return report(
    "resource.source",
    "모든 자원에는 생성 경로나 초기 배치가 존재한다",
    definition.resources.length,
    issues,
    `자원 ${definition.resources.length}종 · 생산 규칙 보유 ${withProduction} · 초기 배치만 ${onlyPlacement} · 출처 없음 ${issues.length}`,
  );
}

// --- 4a. resource.overuse (§14 — G-6) ---------------------------------------------------

/**
 * §14 "자원에는 반드시 다음이 있어야 한다 — … 과도하게 사용하면 무엇이 발생하는가".
 * 답이 있으면 그 답은 실행 데이터여야 한다: 과용 규칙이 실재하고, 조건(과잉 상태)을 갖고,
 * 이 자원을 실제로 가리켜야 한다 — 조건 없는 반동은 원인 없는 주사위와 같은 병리다(§12 no-cause 와 동형).
 * 답이 없으면 **경고**로 남긴다 — 여섯 질문 중 하나가 빈칸이라는 사실은 보고서에서 사라지지 않는다.
 */
function checkResourceOveruse(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  const ruleOf = new Map(definition.ruleDefinitions.map((rule) => [rule.id, rule]));
  let answered = 0;
  let inspected = 0;
  for (const resource of definition.resources) {
    const overuse = resource.overuseRules ?? [];
    if (overuse.length === 0) {
      issues.push(
        issue(
          "resource.overuse",
          resource.id,
          `자원 ${resource.id}: §14 여섯 질문 중 "과도 사용의 결과" 가 빈칸이다 — 남용해도 아무 일도 일어나지 않는다`,
          "과잉 상태를 조건으로 갖는 반동 규칙을 만들어 overuseRules 에 잇는다",
          "warning",
        ),
      );
      continue;
    }
    answered += 1;
    // 자원을 가리키는 증거 — 규칙 JSON 어딘가에 자원 id·태그·소지 상태 키가 나타나야 한다
    const marks = [resource.id, resource.id.split(".")[1] ?? "", ...resource.tags].filter((mark) => mark !== "");
    for (const ruleId of overuse) {
      inspected += 1;
      const rule = ruleOf.get(ruleId);
      if (rule === undefined) {
        issues.push(
          issue(
            "resource.overuse",
            resource.id,
            `자원 ${resource.id}: 과용 반동이 없는 규칙을 가리킨다 — ${ruleId} (§14)`,
            "규칙을 만들거나 overuseRules 에서 지운다",
          ),
        );
        continue;
      }
      // 조건은 규칙 머리에 있어도, 효과 하나하나에 있어도 좋다 — 어디에도 없으면 원인 없는 벌이다
      const hasCondition =
        rule.conditions.length > 0 ||
        (rule.effects as RuleEffect[]).some((effect) => (effect.conditions ?? []).length > 0);
      if (!hasCondition) {
        issues.push(
          issue(
            "resource.overuse",
            resource.id,
            `자원 ${resource.id}: 과용 반동 ${ruleId} 에 조건이 없다 — 과잉을 묻지 않는 반동은 원인 없는 벌이다 (§14, §12)`,
            "과잉 상태(보유량·사용량 임계)를 조건으로 넣는다",
          ),
        );
      }
      const text = JSON.stringify(rule);
      if (!marks.some((mark) => text.includes(mark))) {
        issues.push(
          issue(
            "resource.overuse",
            resource.id,
            `자원 ${resource.id}: 과용 반동 ${ruleId} 이 이 자원을 어디서도 가리키지 않는다 (§14)`,
            "규칙의 조건·효과·태그가 이 자원(id·태그·소지 상태)을 실제로 다루게 한다",
          ),
        );
      }
    }
  }
  return report(
    "resource.overuse",
    "자원의 과도 사용에는 결과가 있다 (§14 여섯 번째 질문)",
    definition.resources.length,
    issues,
    `자원 ${definition.resources.length}종 · 과용 반동 보유 ${answered} · 반동 규칙 ${inspected}개 검사 · ` +
      `위반 ${issues.filter((i) => i.level === "error").length} · 빈칸 ${issues.filter((i) => i.level === "warning").length}`,
  );
}

// --- 4. space.profile (§13 — G-5) ------------------------------------------------------

/**
 * §13 지역 프로필은 **세계의 실제 모습과 같아야 한다**.
 * 지역이 "여기서 이 자원이 난다"고 말하면 그 자원이 실재하고 그 수만큼 놓여 있어야 하고,
 * 종 적합도가 0인 지역에는 그 종이 살고 있으면 안 된다. 선언과 배치가 갈라지면 런타임의 답이 거짓이 된다.
 * 통행 조건(requirements)은 실재하는 상태만 물어야 한다 — 없는 상태를 묻는 길은 아무도 건널 수 없다.
 */
function checkSpaceProfile(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  const resourceIds = new Set(definition.resources.map((resource) => resource.id));
  const resourceTags = new Set(definition.resources.flatMap((resource) => resource.tags));
  const speciesIds = new Set(definition.species.map((species) => species.id));

  // 실제 배치 — 지역별 자원 노드 수 / 지역별 종
  const placedResources = new Map<string, Map<string, number>>();
  const placedSpecies = new Map<string, Set<string>>();
  for (const entity of definition.bootstrap.entities) {
    const regionId = entity.position?.regionId;
    if (regionId === undefined) continue;
    const resourceId = entity.states["resource_id"];
    if (typeof resourceId === "string" && resourceId !== "") {
      const byResource = placedResources.get(regionId) ?? new Map<string, number>();
      byResource.set(resourceId, (byResource.get(resourceId) ?? 0) + 1);
      placedResources.set(regionId, byResource);
    }
    if (entity.speciesId !== undefined) {
      const set = placedSpecies.get(regionId) ?? new Set<string>();
      set.add(entity.speciesId);
      placedSpecies.set(regionId, set);
    }
  }

  let inspected = 0;
  for (const region of definition.spaces.regions) {
    for (const profile of region.resourceProfiles ?? []) {
      inspected += 1;
      if (!resourceIds.has(profile.resourceTag) && !resourceTags.has(profile.resourceTag)) {
        issues.push(
          issue(
            "space.profile",
            region.id,
            `지역 ${region.id}: 없는 자원이 난다고 선언한다 — ${profile.resourceTag} (§13 resourceProfiles)`,
            "실재하는 자원 id 나 태그로 바꾸거나 프로필에서 지운다",
          ),
        );
        continue;
      }
      const placed = placedResources.get(region.id)?.get(profile.resourceTag) ?? 0;
      if (placed !== profile.nodeCount) {
        issues.push(
          issue(
            "space.profile",
            region.id,
            `지역 ${region.id}: ${profile.resourceTag} 프로필이 실제 배치와 다르다 — 선언 ${profile.nodeCount} / 실제 ${placed} (§13)`,
            "프로필의 nodeCount 를 실제 배치 수에 맞춘다 (프로필은 배치의 요약이다)",
          ),
        );
      }
    }
    for (const [speciesId, suitability] of Object.entries(region.speciesSuitability ?? {})) {
      inspected += 1;
      if (!speciesIds.has(speciesId)) {
        issues.push(
          issue(
            "space.profile",
            region.id,
            `지역 ${region.id}: 없는 종의 적합도를 선언한다 — ${speciesId} (§13 speciesSuitability)`,
            "실재하는 종 id 로 바꾸거나 적합도에서 지운다",
          ),
        );
        continue;
      }
      if (suitability <= 0 && placedSpecies.get(region.id)?.has(speciesId) === true) {
        issues.push(
          issue(
            "space.profile",
            region.id,
            `지역 ${region.id}: 적합도 ${suitability} 인 종이 여기 산다 — ${speciesId} (§13)`,
            "적합도를 올리거나 그 종을 다른 지역에 배치한다",
          ),
        );
      }
    }
  }

  const knownStates = index.stateIds;
  for (const connection of definition.spaces.connections) {
    for (const requirement of connection.requirements ?? []) {
      inspected += 1;
      for (const side of [requirement.left, requirement.right]) {
        if (side.kind !== "state" && side.kind !== "entity_state" && side.kind !== "belief") continue;
        if (knownStates.has(side.key)) continue;
        issues.push(
          issue(
            "space.profile",
            `${connection.from}→${connection.to}`,
            `통행 조건이 등록되지 않은 상태를 묻는다 — ${side.key} (§13 requirements, §9)`,
            "등록된 상태 키로 바꾼다 — 없는 상태를 묻는 길은 아무도 건널 수 없다",
          ),
        );
      }
    }
  }

  const gated = definition.spaces.connections.filter((c) => (c.requirements ?? []).length > 0).length;
  const profiled = definition.spaces.regions.filter((r) => (r.resourceProfiles ?? []).length > 0).length;
  return report(
    "space.profile",
    "지역 프로필과 통행 조건이 세계의 실제 모습과 일치한다",
    inspected,
    issues,
    `지역 ${definition.spaces.regions.length} 중 자원 프로필 보유 ${profiled} · 조건부 통행 ${gated}/${definition.spaces.connections.length} · 불일치 ${issues.length}`,
  );
}

// --- 5. species.need ------------------------------------------------------------------

function checkSpeciesNeed(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  const resourceTags = new Set<string>();
  for (const resource of definition.resources) {
    resourceTags.add(resource.id);
    for (const tag of resource.tags) resourceTags.add(tag);
  }
  for (const species of definition.species) {
    if (species.requiredResources.length === 0) {
      issues.push(
        issue(
          "species.need",
          species.id,
          `종족 ${species.id}: 생존에 필요한 자원이 하나도 없다 (§34)`,
          "requiredResources 에 최소 1개의 생존 자원을 넣는다",
        ),
      );
      continue;
    }
    for (const need of species.requiredResources) {
      if (need.amountPerDay <= 0) {
        issues.push(
          issue("species.need", species.id, `종족 ${species.id}: ${need.resourceTag} 요구량이 0 이하다`),
        );
      }
      if (!resourceTags.has(need.resourceTag)) {
        issues.push(
          issue(
            "species.need",
            species.id,
            `종족 ${species.id}: 어떤 자원도 갖지 않은 태그를 필요로 한다 — ${need.resourceTag}`,
            "그 태그를 가진 자원을 만들거나 요구 태그를 바꾼다",
          ),
        );
      }
    }
  }
  const needs = definition.species.map((s) => `${s.id.replace("species.", "")}:${s.requiredResources.length}`);
  return report(
    "species.need",
    "모든 종은 최소 하나의 생존 자원을 필요로 한다",
    definition.species.length,
    issues,
    `종족 ${definition.species.length} — ${needs.join(" ")} · 위반 ${issues.length}`,
  );
}

// --- 5a. species.structure — §15 생존 구조의 실행 연결 (G-4) -----------------------------

/**
 * §15 "종족 정의는 외형과 전투 능력보다 생존 구조를 우선한다".
 * 그 생존 구조가 **실행 데이터**인지 본다 — 본능은 그 종의 개체가 실제로 좇을 수 있는 목적이어야 하고,
 * 적응·성장·번식 규칙은 실재해야 하며, 번식을 말한 종은 그것을 실행하는 규칙을 가져야 한다.
 * 능력을 가질 수 없는 종(abilityAccess.canHold=false)의 개체가 능력을 갖고 있어도 안 된다(§16).
 */
function checkSpeciesStructure(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  const graphOf = new Map(definition.goalTemplates.map((graph) => [graph.id, graph]));
  const goalIdsOfSpecies = new Map<string, Set<string>>();
  const entitiesOfSpecies = new Map<string, string[]>();
  for (const entity of definition.bootstrap.entities) {
    if (entity.speciesId === undefined) continue;
    entitiesOfSpecies.set(entity.speciesId, [...(entitiesOfSpecies.get(entity.speciesId) ?? []), entity.id]);
    const graph = entity.goalGraphId === undefined ? undefined : graphOf.get(entity.goalGraphId);
    const set = goalIdsOfSpecies.get(entity.speciesId) ?? new Set<string>();
    for (const node of graph?.nodes ?? []) set.add(node.id);
    goalIdsOfSpecies.set(entity.speciesId, set);
  }
  const abilitiesOf = new Map<string, string[]>();
  for (const ability of definition.abilitySystem?.abilities ?? []) {
    abilitiesOf.set(ability.ownerId, [...(abilitiesOf.get(ability.ownerId) ?? []), ability.id]);
  }

  let inspected = 0;
  for (const species of definition.species) {
    inspected += 1;
    const reachable = goalIdsOfSpecies.get(species.id) ?? new Set<string>();
    const placed = (entitiesOfSpecies.get(species.id) ?? []).length;
    // 본능은 "이 종이 타고나는 목적"이다 — 그 종의 개체가 하나도 좇을 수 없으면 선언일 뿐이다
    if (species.instincts.length === 0) {
      issues.push(
        issue("species.structure", species.id, `종족 ${species.id}: 본능 목적이 없다 (§15 instincts)`, "이 종이 타고나는 목적을 하나 이상 적는다"),
      );
    }
    if (placed > 0) {
      const followed = species.instincts.filter((goalId) => reachable.has(goalId));
      if (species.instincts.length > 0 && followed.length === 0) {
        issues.push(
          issue(
            "species.structure",
            species.id,
            `종족 ${species.id}: 본능 목적 ${species.instincts.join(",")} 을 이 종의 개체가 하나도 좇을 수 없다 (§15, §18 절차 1)`,
            "개체의 목적 그래프에 본능 목적을 넣거나, 본능을 그 종이 실제로 갖는 목적으로 바꾼다",
          ),
        );
      }
    }
    for (const [label, ruleIds] of [
      ["적응 규칙", species.adaptationRules],
      ["성장 규칙", species.growthRules],
      ["번식 규칙", species.reproductionRuleIds ?? []],
    ] as const) {
      for (const ruleId of ruleIds) {
        if (index.ruleIds.has(ruleId)) continue;
        issues.push(
          issue("species.structure", species.id, `종족 ${species.id}: 없는 ${label} 을 가리킨다 — ${ruleId} (§15)`, "규칙을 만들거나 목록에서 지운다"),
        );
      }
    }
    // 번식을 말했는데 그것을 실행하는 규칙이 없으면 **경고**로 남긴다 (G-4).
    // 오류가 아닌 이유: 인간처럼 프로토타입의 30일 안에서는 번식하지 않는 종도 있다.
    // 다만 "선언만 있고 실행이 없다"는 사실은 보고서에서 사라지지 않는다.
    if ((species.reproduction ?? "").trim() !== "" && (species.reproductionRuleIds ?? []).length === 0) {
      issues.push(
        issue(
          "species.structure",
          species.id,
          `종족 ${species.id}: 번식이 선언 문자열뿐이다 — 이 세계의 어떤 규칙도 이 종의 개체를 낳지 않는다 (§15)`,
          "번식을 실행하는 규칙을 만들거나(개체 템플릿의 species_id 로 자동 연결된다), 30일 밖의 일임을 받아들인다",
          "warning",
        ),
      );
    }
    if (species.abilityAccess?.canHold === false) {
      for (const entityId of entitiesOfSpecies.get(species.id) ?? []) {
        for (const abilityId of abilitiesOf.get(entityId) ?? []) {
          issues.push(
            issue(
              "species.structure",
              species.id,
              `종족 ${species.id}: 능력을 가질 수 없는 종의 개체가 능력을 갖는다 — ${entityId} → ${abilityId} (§15 abilityAccess, §16)`,
              "abilityAccess.canHold 를 고치거나 그 능력의 소유자를 바꾼다",
            ),
          );
        }
      }
    }
  }

  const rows = definition.species.map(
    (species) =>
      `${species.id.replace("species.", "")}(${species.survivalUnit}·본능 ${species.instincts.length}·적응 ${species.adaptationRules.length}·성장 ${species.growthRules.length})`,
  );
  return report(
    "species.structure",
    "종족의 생존 구조(본능·적응·성장·번식)가 실행 데이터에 연결된다",
    inspected,
    issues,
    `종족 ${definition.species.length} — ${rows.join(" ")} · 위반 ${issues.length}`,
  );
}

// --- 5b. faction.hidden — §17 은닉 목적의 실행 연결 (G-3) --------------------------------

/**
 * hiddenPurposes 는 선언 문자열로 끝날 수 없다 — 조직이 실제로 좇는 목적 그래프 노드
 * (hiddenGoalIds)에 연결되어야 §41 의 "숨겨진 동기"가 실행 데이터가 된다(§17, §30).
 */
function checkFactionHidden(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  let inspected = 0;
  for (const faction of definition.factions) {
    if (faction.hiddenPurposes.length === 0) continue;
    inspected += 1;
    const linked = faction.hiddenGoalIds ?? [];
    if (linked.length === 0) {
      issues.push(
        issue(
          "faction.hidden",
          faction.id,
          `조직 ${faction.id}: 은닉 목적이 선언 문자열뿐이다 — 실행 목적(hiddenGoalIds) 연결이 없다 (§17, §30)`,
          "hiddenGoalIds 에 이 조직 목적 그래프의 노드 id 를 넣는다",
        ),
      );
      continue;
    }
    const entity = definition.bootstrap.entities.find((entry) => entry.id === faction.id);
    const graph = definition.goalTemplates.find((g) => g.id === entity?.goalGraphId);
    const nodes = new Set((graph?.nodes ?? []).map((node) => node.id));
    for (const goalId of linked) {
      if (!nodes.has(goalId)) {
        issues.push(
          issue(
            "faction.hidden",
            faction.id,
            `조직 ${faction.id}: 은닉 목적 ${goalId} 이 조직 목적 그래프(${entity?.goalGraphId ?? "없음"})에 없다`,
            "hiddenGoalIds 를 그래프에 실재하는 노드로 바꾼다",
          ),
        );
      }
    }
  }
  const rows = definition.factions
    .filter((f) => f.hiddenPurposes.length > 0)
    .map((f) => `${f.id.replace("faction.", "")}(은닉 ${f.hiddenPurposes.length}→목적 ${(f.hiddenGoalIds ?? []).length})`);
  return report(
    "faction.hidden",
    "조직의 은닉 목적은 실행 목적에 연결된다",
    inspected,
    issues,
    `은닉 목적 보유 조직 ${inspected} — ${rows.join(" ")} · 위반 ${issues.length}`,
  );
}

// --- 5. faction.lifecycle -------------------------------------------------------------

function checkFactionLifecycle(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  for (const faction of definition.factions) {
    if (faction.publicPurpose.trim() === "" && faction.hiddenPurposes.length === 0) {
      issues.push(
        issue("faction.lifecycle", faction.id, `조직 ${faction.id}: 목적이 없다 (§17 publicPurpose/hiddenPurposes)`),
      );
    }
    if (faction.requiredStates.length === 0) {
      issues.push(
        issue(
          "faction.lifecycle",
          faction.id,
          `조직 ${faction.id}: 유지 목적(requiredStates)이 없다 — 무엇이 무너지면 위기인지 알 수 없다 (§34)`,
          "조직이 지키려는 상태와 임계값을 requiredStates 에 넣는다",
        ),
      );
    }
    if (faction.collapseConditions.length === 0) {
      issues.push(
        issue(
          "faction.lifecycle",
          faction.id,
          `조직 ${faction.id}: 붕괴 조건이 없다 — 영원히 존속한다 (§34)`,
          "collapseConditions 에 조직이 해체되는 조건을 넣는다",
        ),
      );
    }
  }
  const rows = definition.factions.map(
    (f) => `${f.id.replace("faction.", "")}(유지 ${f.requiredStates.length}·붕괴 ${f.collapseConditions.length})`,
  );
  return report(
    "faction.lifecycle",
    "모든 조직에는 유지 목적과 붕괴 조건이 존재한다",
    definition.factions.length,
    issues,
    `조직 ${definition.factions.length} — ${rows.join(" ")} · 위반 ${issues.length}`,
  );
}

// --- 6. agent.goal --------------------------------------------------------------------

/**
 * "활성화 가능한 목적이 존재한다" 는 정적으로 말할 수 없다 — 활성도(§20)는 초기 상태의 함수다.
 * 그래서 실제로 세계를 부트스트랩하고 Phase 3 계산기를 돌려 **0보다 큰 활성도를 가진 목적**을 찾는다.
 */
function checkAgentGoals(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  const runtime = index.runtime;
  if (runtime === undefined) {
    return report(
      "agent.goal",
      "모든 개인에게 활성화 가능한 목적이 존재한다",
      0,
      [issue("agent.goal", definition.metadata.id, `세계를 올릴 수 없어 목적을 판정하지 못했다 — ${index.runtimeError}`)],
      "부트스트랩 실패",
    );
  }
  const agents = runtime.agentIds();
  const tops: number[] = [];
  for (const agentId of agents) {
    let ranked: ReturnType<typeof rankGoals>;
    try {
      ranked = rankGoals(runtime, agentId);
    } catch (error) {
      issues.push(
        issue("agent.goal", agentId, `${agentId}: 목적 계산 중 오류 — ${error instanceof Error ? error.message : String(error)}`),
      );
      continue;
    }
    const top = ranked[0];
    if (top === undefined || top.activation <= 0) {
      issues.push(
        issue(
          "agent.goal",
          agentId,
          `${agentId}: 초기 상태에서 활성도 > 0 인 목적이 없다 (최상위 ${top === undefined ? "없음" : `${top.goalId} ${top.activation.toFixed(1)}`})`,
          "목적 그래프에 baseImportance·urgencyPolicy 를 보강하거나 실행 가능한 행동 태그를 잇는다",
        ),
      );
      continue;
    }
    tops.push(top.activation);
  }
  const min = tops.length === 0 ? 0 : Math.min(...tops);
  const max = tops.length === 0 ? 0 : Math.max(...tops);
  return report(
    "agent.goal",
    "모든 개인에게 활성화 가능한 목적이 존재한다",
    agents.length,
    issues,
    `주체 ${agents.length}명 · 최상위 활성도 ${min.toFixed(1)}~${max.toFixed(1)} · 활성 목적 없는 주체 ${issues.length}`,
  );
}

// --- 7. action.cost -------------------------------------------------------------------

function checkActionCost(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  let withCost = 0;
  let riskOnly = 0;
  for (const action of definition.actionDefinitions) {
    const costTotal = action.costs.reduce((sum, cost) => sum + Math.abs(cost.amount), 0);
    if (costTotal > 0) withCost += 1;
    else if (action.risk > 0) riskOnly += 1;
    if (costTotal > 0 || action.risk > 0) continue;
    issues.push(
      issue(
        "action.cost",
        action.id,
        `행동 ${action.id}: 비용도 위험도 없다 — 공짜 행동은 선택을 만들지 않는다 (§34)`,
        "costs 에 자원·체력 소모를 넣거나 risk 를 0보다 크게 둔다",
      ),
    );
  }
  return report(
    "action.cost",
    "모든 행동에는 비용 또는 위험이 존재한다",
    definition.actionDefinitions.length,
    issues,
    `행동 ${definition.actionDefinitions.length}종 · 비용 보유 ${withCost} · 위험만 ${riskOnly} · 공짜 ${issues.length}`,
  );
}

// --- 8. ability.cost-scaling ----------------------------------------------------------

interface AbilityWeight {
  id: string;
  output: number;
  weight: number;
}

function abilityWeights(abilities: readonly AbilityDefinition[]): AbilityWeight[] {
  return abilities
    .map((ability) => ({
      id: ability.id,
      output: ability.outputRange.max,
      weight: abilityCostWeight(
        ability.restrictions.map((restriction) => restriction.severity),
        ability.costs.map((cost) => cost.amount),
      ),
    }))
    .sort((a, b) => (a.output === b.output ? a.id.localeCompare(b.id) : a.output - b.output));
}

function checkAbilityScaling(index: Index): CheckReport {
  const abilities = index.definition.abilitySystem?.abilities ?? [];
  const issues: ValidationIssue[] = [];
  const rows = abilityWeights(abilities);
  for (const ability of abilities) {
    if (ability.restrictions.length === 0 && ability.costs.length === 0) {
      issues.push(
        issue(
          "ability.cost-scaling",
          ability.id,
          `능력 ${ability.id}: 제약도 대가도 없다 (§16)`,
          "restrictions 또는 costs 를 넣는다",
        ),
      );
    }
  }
  // 출력 오름차순으로 늘어놓았을 때 대가가 뒤로 갈수록 작아지면 §34 위반이다
  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1]!;
    const current = rows[i]!;
    if (current.weight >= previous.weight) continue;
    issues.push(
      issue(
        "ability.cost-scaling",
        current.id,
        `능력 ${current.id}: 출력 ${current.output} 인데 대가 ${current.weight.toFixed(1)} — ` +
          `더 약한 ${previous.id}(출력 ${previous.output})의 대가 ${previous.weight.toFixed(1)} 보다 작다 (§34)`,
        "제약 severity 또는 costs 를 올려 출력에 맞춘다",
      ),
    );
  }
  return report(
    "ability.cost-scaling",
    "강한 능력일수록 제약이나 대가가 증가한다",
    abilities.length,
    issues,
    abilities.length === 0
      ? "능력 없음 — 검사 대상 0"
      : `능력 ${abilities.length}개 (출력→대가: ${rows.map((r) => `${r.output}→${r.weight.toFixed(0)}`).join(" ")}) · 역전 ${issues.length}`,
  );
}

// --- 9. event.multi-agent -------------------------------------------------------------

/** 태그를 소유한 시스템 종류 — 사건 패턴이 정말 "둘 이상을 연결"하는지 보는 기준 */
function tagOwners(definition: WorldDefinition): Map<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  const add = (tag: string, system: string): void => {
    const set = owners.get(tag) ?? new Set<string>();
    set.add(system);
    owners.set(tag, set);
  };
  for (const rule of definition.ruleDefinitions as RuleDefinition[]) {
    for (const tag of rule.tags ?? []) add(tag, "rule");
    for (const observation of rule.observations) for (const tag of observation.tags) add(tag, "observation");
  }
  for (const action of definition.actionDefinitions) {
    for (const tag of action.tags) add(tag, "action");
    for (const signal of action.visibleSignals) for (const tag of signal.tags) add(tag, "observation");
  }
  for (const entity of definition.bootstrap.entities) for (const tag of entity.tags) add(tag, "entity");
  for (const template of definition.entityTemplates ?? []) for (const tag of template.tags) add(tag, "entity");
  return owners;
}

function checkEventMultiAgent(index: Index): CheckReport {
  const definition = index.definition;
  const owners = tagOwners(definition);
  const issues: ValidationIssue[] = [];
  const systemCounts: number[] = [];
  for (const pattern of definition.eventPatterns) {
    if (pattern.minimumParticipants < 2) {
      issues.push(
        issue(
          "event.multi-agent",
          pattern.id,
          `사건 패턴 ${pattern.id}: minimumParticipants ${pattern.minimumParticipants} — 혼자 벌어지는 일은 사건이 아니다 (§34)`,
          "minimumParticipants 를 2 이상으로 둔다",
        ),
      );
    }
    const systems = new Set<string>();
    for (const tag of [...pattern.requiredTags, ...pattern.optionalTags]) {
      for (const system of owners.get(tag) ?? []) systems.add(system);
    }
    systemCounts.push(systems.size);
    if (systems.size < 2) {
      issues.push(
        issue(
          "event.multi-agent",
          pattern.id,
          `사건 패턴 ${pattern.id}: 태그가 ${systems.size}개 시스템(${[...systems].join(",") || "없음"})에만 걸린다 — 둘 이상을 연결하지 못한다 (§34)`,
          "규칙·행동·관찰 중 다른 시스템의 태그를 requiredTags/optionalTags 에 더한다",
        ),
      );
    }
  }
  return report(
    "event.multi-agent",
    "사건 패턴은 둘 이상의 주체 또는 시스템을 연결한다",
    definition.eventPatterns.length,
    issues,
    `패턴 ${definition.eventPatterns.length}개 · 최소 참여자 ${definition.eventPatterns.map((p) => p.minimumParticipants).join("/")} · ` +
      `연결 시스템 수 ${systemCounts.join("/")} · 위반 ${issues.length}`,
  );
}

// --- 10. goal.no-infinite -------------------------------------------------------------

/** 목적 그래프의 방향 순환 — requires/creates/reveals/supports 만 진행 관계다(conflicts/alternative 는 아니다) */
const PROGRESS_RELATIONS = new Set(["requires", "creates", "reveals", "supports"]);

export function findGoalCycles(graph: GoalGraph): string[][] {
  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!PROGRESS_RELATIONS.has(edge.relation)) continue;
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge.to);
    outgoing.set(edge.from, list);
  }
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const visit = (nodeId: string): void => {
    if (onStack.has(nodeId)) {
      const start = stack.indexOf(nodeId);
      if (start >= 0) cycles.push(stack.slice(start));
      return;
    }
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    stack.push(nodeId);
    onStack.add(nodeId);
    for (const next of [...(outgoing.get(nodeId) ?? [])].sort()) visit(next);
    stack.pop();
    onStack.delete(nodeId);
  };

  for (const node of [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id))) visit(node.id);
  return cycles;
}

function checkGoalNoInfinite(index: Index): CheckReport {
  const definition = index.definition;
  const issues: ValidationIssue[] = [];
  let cycleCount = 0;
  for (const graph of definition.goalTemplates) {
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    for (const cycle of findGoalCycles(graph)) {
      cycleCount += 1;
      // 순환 자체는 문제가 아니다 — 빠져나갈 문이 하나도 없는 순환이 무한 행동이다
      const escapable = cycle.some((goalId) => {
        const node = nodes.get(goalId);
        if (node === undefined) return false;
        return node.targetConditions.length > 0 || node.abandonmentConditions.length > 0;
      });
      if (escapable) continue;
      issues.push(
        issue(
          "goal.no-infinite",
          graph.id,
          `목적 그래프 ${graph.id}: 순환 [${cycle.join("→")}] 안의 어떤 목적도 완료·포기 조건이 없다 — 무한 행동 (§34)`,
          "순환 위의 목적 중 하나에 targetConditions 또는 abandonmentConditions 를 넣는다",
        ),
      );
    }
  }
  const nodeCount = definition.goalTemplates.reduce((sum, graph) => sum + graph.nodes.length, 0);
  const withExit = definition.goalTemplates
    .flatMap((graph) => graph.nodes)
    .filter((node) => node.targetConditions.length > 0 || node.abandonmentConditions.length > 0).length;
  return report(
    "goal.no-infinite",
    "순환 목적 그래프가 무한 행동을 만들지 않는다",
    definition.goalTemplates.length,
    issues,
    `그래프 ${definition.goalTemplates.length}개 · 목적 ${nodeCount}개(완료·포기 조건 보유 ${withExit}) · 순환 ${cycleCount}개 · 탈출구 없는 순환 ${issues.length}`,
  );
}

// =====================================================================================
// 진입점
// =====================================================================================

type Checker = (index: Index) => CheckReport;

const CHECKERS: Record<SemanticCode, Checker> = {
  "axiom.enforced": checkAxiomEnforced,
  "state.schema": checkStateSchema,
  "rule.target-exists": checkRuleTargets,
  "rule.chance": checkRuleChance,
  "resource.source": checkResourceSource,
  "resource.overuse": checkResourceOveruse,
  "space.profile": checkSpaceProfile,
  "pressure.related": checkPressureRelated,
  "species.need": checkSpeciesNeed,
  "species.structure": checkSpeciesStructure,
  "faction.lifecycle": checkFactionLifecycle,
  "faction.hidden": checkFactionHidden,
  "agent.goal": checkAgentGoals,
  "action.cost": checkActionCost,
  "ability.cost-scaling": checkAbilityScaling,
  "event.multi-agent": checkEventMultiAgent,
  "goal.no-infinite": checkGoalNoInfinite,
};

/** §34 정적 검증 — (a) 스키마 층 + (b) 의미 층 15종 */
export function validateWorld(definition: WorldDefinition): ValidationReport {
  const index = buildIndex(definition);
  const schema = checkSchemaLayer(definition);
  const checks = SEMANTIC_CODES.map((code) => CHECKERS[code](index));
  const issues = [...schema.issues, ...checks.flatMap((check) => check.issues)];
  return {
    ok: issues.every((entry) => entry.level !== "error"),
    issues,
    errorCount: issues.filter((entry) => entry.level === "error").length,
    warningCount: issues.filter((entry) => entry.level === "warning").length,
    schema,
    checks,
  };
}
