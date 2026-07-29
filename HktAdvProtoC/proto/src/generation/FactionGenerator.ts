// 8단계: 조직 생성 (§17)
//
// §17 의 7절차를 프롬프트 구조로 강제한다:
//   희소 자원 선택 → 필요로 하는 집단 → 통제 제도 → 수혜 내부 집단 → 피해 내부 집단 →
//   외부 경쟁자 → 공개 목적과 실제 생존 목적의 분리
// "조직은 임의의 다양성이 아니라 하나의 자원·규칙을 서로 다르게 이용하는 생존 전략에서 파생된다."
import type { RuleDefinition } from "../core/rules/RuleTypes";
import type {
  FactionDefinition,
  FactionStructureDefinition,
  ResourceDefinition,
} from "../core/world/types";
import type { GenerationContext } from "./GenerationTypes";
import { FACTION_SCHEMA, OUTLINE_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const FACTION_OUTLINE_TASK = "factions_outline";
export const factionTask = (id: string): string => `factions/${id}`;

export interface FactionOutline {
  id: string;
  name: string;
  summary: string;
  tags?: string[];
}

export interface FactionDraft extends FactionDefinition {
  /** §17 절차 1 — 이 조직이 어느 자원의 이용 전략에서 나왔는가 */
  derivedFromResource: string;
  institution?: string;
  externalRivals: string[];
}

const OUTLINE_PROMPT = [
  "너는 세계 생성 컴파일러의 8단계다. 먼저 '어떤 조직이 왜 생기는가'만 목록으로 낸다(§17).",
  "조직은 이름표가 아니라 자원을 서로 다르게 이용하는 생존 전략이다 — 같은 자원을 두고 갈라지게 만든다.",
  "독점·연구·밀수·보호처럼 이해가 정면으로 충돌하는 전략을 고르되, 각각이 어떤 자원에서 왔는지 밝힌다.",
].join("\n");

const FACTION_PROMPT = [
  "너는 세계 생성 컴파일러의 8단계다. 조직 하나를 주체로 상세화한다(§17).",
  "조직 자체가 목적과 상태를 가진 주체다. 반드시 다음을 만든다:",
  "① 통제하는 자원 ② 유지에 필요한 상태(requiredStates) ③ 공개 목적 ④ 실제 생존 목적(hiddenPurposes)",
  "⑤ 제도에서 이익을 얻는 내부 집단과 손해를 보는 내부 집단 ⑥ 외부 경쟁자 ⑦ 붕괴 조건.",
  "제도(institution)는 한 문장으로 쓰고, 그 제도가 구성원에게 요구하는 것이 있으면 policies 로 적는다 —",
  "요구는 상태 조건이고, '따르지 않으면 무엇이 실행되는가'(enforcementRuleIds)가 없으면 정책은 세계에 힘이 없다(§17).",
  "공개 목적과 실제 목적은 반드시 다르다 — 그 간극이 사건의 씨앗이다.",
].join("\n");

export async function generateFactions(
  ctx: GenerationContext,
  resources: readonly ResourceDefinition[],
): Promise<{ factions: FactionDraft[]; outline: FactionOutline[]; taskIds: string[] }> {
  const scarce = [...resources]
    .sort((a, b) => Number(b.properties["rarity"] ?? 0) - Number(a.properties["rarity"] ?? 0))
    .slice(0, 8);

  const outline = await generateChecked<FactionOutline[]>(
    ctx.port,
    {
      taskId: FACTION_OUTLINE_TASK,
      systemPrompt: OUTLINE_PROMPT,
      input: {
        scarceResources: scarce.map((resource) => ({
          id: resource.id,
          name: resource.name,
          rarity: resource.properties["rarity"] ?? 0,
          desiredBy: resource.desiredBy.map((desire) => desire.agentTag),
        })),
        factionCount: ctx.scale.factions,
      },
      outputSchema: OUTLINE_SCHEMA,
    },
    ctx.telemetry,
  );

  if (outline.length !== ctx.scale.factions) {
    throw new Error(`조직 수가 §40 규모와 다르다 — ${outline.length} (목표 ${ctx.scale.factions})`);
  }

  const taskIds = [FACTION_OUTLINE_TASK];
  const factions: FactionDraft[] = [];
  for (const candidate of outline) {
    const taskId = factionTask(candidate.id);
    taskIds.push(taskId);
    const draft = await generateChecked<FactionDraft>(
      ctx.port,
      {
        taskId,
        systemPrompt: FACTION_PROMPT,
        input: {
          candidate,
          otherFactions: outline.filter((entry) => entry.id !== candidate.id).map((entry) => entry.id),
          availableResources: ctx.symbols.list("resource"),
          availableSpecies: ctx.symbols.list("species"),
          availableStates: ctx.symbols.list("state"),
        },
        outputSchema: FACTION_SCHEMA,
      },
      ctx.telemetry,
    );

    if (draft.hiddenPurposes.length === 0) {
      throw new Error(`실제 목적이 없는 조직 — ${draft.id} (§17 절차 7)`);
    }
    if (draft.collapseConditions.length === 0 || draft.requiredStates.length === 0) {
      throw new Error(`유지 목적 또는 붕괴 조건이 없는 조직 — ${draft.id} (§34)`);
    }
    if (!ctx.symbols.has("resource", draft.derivedFromResource)) {
      throw new Error(`조직이 없는 자원에서 파생됐다 — ${draft.id} → ${draft.derivedFromResource}`);
    }
    factions.push(draft);
  }

  // 하나의 자원을 두고 갈라져야 한다 — 전원이 서로 다른 자원만 본다면 갈등이 생기지 않는다(§17)
  const contested = new Set(
    factions
      .map((faction) => faction.derivedFromResource)
      .filter((resource, _i, all) => all.filter((other) => other === resource).length > 1),
  );
  if (contested.size === 0) {
    throw new Error("어떤 자원도 둘 이상의 조직이 다투지 않는다 — 조직이 이름표가 됐다 (§17)");
  }

  ctx.symbols.declareAll("faction", factions.map((faction) => faction.id));
  for (const faction of factions) {
    ctx.symbols.declareAll("faction", (faction.internalGroups ?? []).map((group) => group.id));
  }
  return { factions, outline, taskIds };
}

/**
 * §17 절차 3~5 — 제도를 **실행 데이터**로 세운다 (2차 재검증 F-6).
 *
 * 제도의 문장(institution)은 AI 가 쓰고, 연결은 코드가 만든다: 통제 자원은 절차 1 의 자원,
 * 수혜·피해 집단은 내부 집단의 stance, 실행 규칙은 **그 자원을 실제로 건드리는 규칙**이다.
 * §16 의 출력 범위(절차 7)를 코드가 계산하는 것과 같은 규약이다 — AI 가 자기 제도의 힘을 스스로 부르지 못하게 한다.
 */
export function deriveStructures(
  draft: FactionDraft,
  rules: readonly RuleDefinition[],
): FactionStructureDefinition[] {
  const resource = draft.controlledResources.includes(draft.derivedFromResource)
    ? draft.derivedFromResource
    : (draft.controlledResources[0] ?? draft.derivedFromResource);
  if (resource === undefined || resource === "") return [];
  const tag = resource.split(".").pop() ?? resource;
  const ruleIds = rules
    .filter((rule) =>
      rule.effects.some((effect) => {
        if (effect.type === "transfer_resource") return effect.resourceId === resource;
        if (effect.type === "modify_state") return effect.stateKey.includes(tag);
        return false;
      }),
    )
    .map((rule) => rule.id)
    .slice(0, 4);
  const groups = draft.internalGroups ?? [];
  return [
    {
      id: `structure.${draft.id.split(".").pop() ?? draft.id}`,
      name: draft.institution === undefined ? `${draft.name}의 통제 제도` : draft.institution.split(" — ")[0]!,
      controlledResource: resource,
      mechanism: mechanismOf(draft.institution ?? ""),
      ruleIds,
      benefitingGroupIds: groups.filter((group) => group.stance === "benefits").map((group) => group.id),
      harmedGroupIds: groups.filter((group) => group.stance === "harmed").map((group) => group.id),
      ...(draft.institution === undefined ? {} : { rationale: draft.institution }),
    },
  ];
}

/** 제도 문장 → 통제 방식. 문장에 실마리가 없으면 독점으로 본다(자원을 통제한다는 것 자체가 독점이다) */
function mechanismOf(institution: string): FactionStructureDefinition["mechanism"] {
  if (/배급|배분|분배/.test(institution)) return "ration";
  if (/허가|면허/.test(institution)) return "license";
  if (/등록|기록|신고/.test(institution)) return "registry";
  if (/통행|경로|관문/.test(institution)) return "toll";
  if (/납입|징발|세/.test(institution)) return "levy";
  return "monopoly";
}

export function toFactionDefinition(
  draft: FactionDraft,
  rules: readonly RuleDefinition[] = [],
): FactionDefinition {
  const structures = deriveStructures(draft, rules);
  return {
    id: draft.id,
    name: draft.name,
    publicPurpose: draft.publicPurpose,
    hiddenPurposes: draft.hiddenPurposes,
    ...(draft.hiddenGoalIds === undefined ? {} : { hiddenGoalIds: draft.hiddenGoalIds }),
    requiredStates: draft.requiredStates,
    controlledResources: draft.controlledResources,
    relationshipDefaults: draft.relationshipDefaults,
    collapseConditions: draft.collapseConditions,
    ...(draft.internalGroups === undefined ? {} : { internalGroups: draft.internalGroups }),
    ...(structures.length === 0 ? {} : { structures }),
    ...(draft.policies === undefined || draft.policies.length === 0 ? {} : { policies: draft.policies }),
  };
}
