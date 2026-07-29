// 8단계: 조직 생성 (§17)
//
// §17 의 7절차를 프롬프트 구조로 강제한다:
//   희소 자원 선택 → 필요로 하는 집단 → 통제 제도 → 수혜 내부 집단 → 피해 내부 집단 →
//   외부 경쟁자 → 공개 목적과 실제 생존 목적의 분리
// "조직은 임의의 다양성이 아니라 하나의 자원·규칙을 서로 다르게 이용하는 생존 전략에서 파생된다."
import type { FactionDefinition, ResourceDefinition } from "../core/world/types";
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

export function toFactionDefinition(draft: FactionDraft): FactionDefinition {
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
  };
}
