// 9단계: 인간 능력 체계 생성 (§16)
//
// 능력은 고정 스킬 목록이 아니다. 한 인물의 욕망·경험·제약에서 파생된다(§44-11).
// 그래서 두 번 부른다: ① 능력 사용자의 AbilityGenerationContext(§16 입력 구조) ② 그 문맥에서 능력 하나.
// 절차 7(제약 강도 → 출력 범위)만 코드가 계산한다 — AI 가 자기 능력의 세기를 스스로 부르지 못하게 한다.
import type { AbilityDefinition, WorldAxiom } from "../core/world/types";
import { abilityCostWeight, calculateAbilityOutputRange } from "./derivations";
import type { GenerationContext } from "./GenerationTypes";
import { ABILITY_DRAFT_SCHEMA } from "./OutputSchemas";
import { generateChecked, type JsonSchema } from "./TextGenerationPort";

export const ABILITY_CONTEXT_TASK = "ability_contexts";
export const abilityTask = (ownerId: string): string => `abilities/${ownerId}`;

/** §16 AbilityGenerationContext */
export interface AbilityGenerationContext {
  ownerId: string;
  ownerName: string;
  coreDesire: string;
  traumaticExperience?: string;
  preferredMethods: string[];
  unacceptableActions: string[];
  acceptableCosts: string[];
  physicalTraits: string[];
  acquiredKnowledge: string[];
}

const CONTEXT_SCHEMA: JsonSchema = {
  type: "array",
  items: {
    type: "object",
    required: [
      "ownerId",
      "ownerName",
      "coreDesire",
      "preferredMethods",
      "unacceptableActions",
      "acceptableCosts",
      "physicalTraits",
      "acquiredKnowledge",
    ],
    additionalProperties: false,
    properties: {
      ownerId: { type: "string" },
      ownerName: { type: "string" },
      coreDesire: { type: "string" },
      traumaticExperience: { type: "string" },
      preferredMethods: { type: "array", items: { type: "string" } },
      unacceptableActions: { type: "array", items: { type: "string" } },
      acceptableCosts: { type: "array", items: { type: "string" } },
      physicalTraits: { type: "array", items: { type: "string" } },
      acquiredKnowledge: { type: "array", items: { type: "string" } },
    },
  },
};

const CONTEXT_PROMPT = [
  "너는 세계 생성 컴파일러의 9단계다. 능력을 만들기 전에 '누구의 무엇에서 나오는가'를 먼저 만든다(§16).",
  "능력 사용자마다: 핵심 욕망 / 그 욕망을 만든 사건 / 선호하는 해결 방식 / 절대 하지 않는 일 /",
  "받아들일 수 있는 대가 / 신체 특성 / 습득한 지식.",
  "욕망이 서로 다르면 능력도 서로 다른 모양이 된다. 비슷한 욕망을 두 번 만들지 않는다.",
].join("\n");

const ABILITY_PROMPT = [
  "너는 세계 생성 컴파일러의 9단계다. 한 인물의 문맥에서 능력 하나를 만든다(§16 절차 1~10).",
  "욕망이 원하는 세계 상태 → 작용 대상 → 작용 방식 → 인물이 받아들일 수 있는 제약 →",
  "실패 반동 → 관찰 가능한 현상 → 상대가 추론할 수 있는 약점 순서로 만든다.",
  "제약(restrictions)과 대가(costs)가 없는 능력은 만들지 않는다 — 대가 없는 강력한 능력은 세계를 깨뜨린다(§33.2).",
  "능력의 세기는 스스로 정하지 않는다. 제약의 강도만 정하면 출력 범위는 컴파일러가 계산한다(절차 7).",
  "관찰 신호는 상대가 능력의 조건을 추론할 단서가 되어야 한다 — 보이지 않는 능력은 추론 게임을 만들지 않는다.",
].join("\n");

export async function generateAbilities(
  ctx: GenerationContext,
  axioms: readonly WorldAxiom[],
): Promise<{ abilities: AbilityDefinition[]; contexts: AbilityGenerationContext[]; taskIds: string[] }> {
  const contexts = await generateChecked<AbilityGenerationContext[]>(
    ctx.port,
    {
      taskId: ABILITY_CONTEXT_TASK,
      systemPrompt: CONTEXT_PROMPT,
      input: {
        powerAxioms: axioms
          .filter((axiom) => axiom.category === "power" || axiom.category === "cost")
          .map((axiom) => ({ id: axiom.id, statement: axiom.statement })),
        abilityUserCount: ctx.scale.abilityUsers,
        factions: ctx.symbols.list("faction"),
      },
      outputSchema: CONTEXT_SCHEMA,
    },
    ctx.telemetry,
  );

  if (contexts.length !== ctx.scale.abilityUsers) {
    throw new Error(`능력 사용자 수가 §40 규모와 다르다 — ${contexts.length} (목표 ${ctx.scale.abilityUsers})`);
  }

  const taskIds = [ABILITY_CONTEXT_TASK];
  const abilities: AbilityDefinition[] = [];
  for (const context of contexts) {
    const taskId = abilityTask(context.ownerId);
    taskIds.push(taskId);
    const draft = await generateChecked<Omit<AbilityDefinition, "outputRange">>(
      ctx.port,
      {
        taskId,
        systemPrompt: ABILITY_PROMPT,
        input: {
          context,
          availableStates: ctx.symbols.list("state"),
          availableRules: ctx.symbols.list("rule"),
          observationChannels: ["sight", "sound", "smell", "trace", "energy_sense"],
        },
        outputSchema: ABILITY_DRAFT_SCHEMA,
      },
      ctx.telemetry,
    );

    if (draft.restrictions.length === 0 || draft.costs.length === 0) {
      throw new Error(`대가 없는 능력 — ${draft.id} (§34 "강한 능력일수록 제약이나 대가가 증가한다")`);
    }
    if (draft.failureEffects.length === 0) {
      throw new Error(`실패 반동이 없는 능력 — ${draft.id} (§16 절차 8)`);
    }
    if (draft.observableSignals.length === 0) {
      throw new Error(`관찰되지 않는 능력 — ${draft.id} (§16 절차 9)`);
    }
    if (draft.ownerId !== context.ownerId) {
      throw new Error(`능력의 주인이 문맥과 다르다 — ${draft.id}: ${draft.ownerId} ≠ ${context.ownerId}`);
    }

    // §16 절차 7 — 제약 강도와 대가에서 출력 범위를 계산한다 (코드 몫)
    const outputRange = calculateAbilityOutputRange(
      draft.restrictions.map((restriction) => restriction.severity),
      draft.costs.map((cost) => cost.amount),
      draft.mastery,
    );
    abilities.push({ ...draft, outputRange });
  }

  // §34 "강한 능력일수록 제약이나 대가가 증가한다" — 출력과 대가의 순서가 어긋나면 오류
  const ordered = [...abilities].sort((a, b) => a.outputRange.max - b.outputRange.max);
  for (let i = 1; i < ordered.length; i++) {
    const weaker = ordered[i - 1]!;
    const stronger = ordered[i]!;
    const weakerCost = abilityCostWeight(
      weaker.restrictions.map((r) => r.severity),
      weaker.costs.map((c) => c.amount),
    );
    const strongerCost = abilityCostWeight(
      stronger.restrictions.map((r) => r.severity),
      stronger.costs.map((c) => c.amount),
    );
    if (strongerCost < weakerCost) {
      throw new Error(
        `강한 능력이 더 싸다 — ${stronger.id}(출력 ${stronger.outputRange.max}, 대가 ${strongerCost}) < ` +
          `${weaker.id}(출력 ${weaker.outputRange.max}, 대가 ${weakerCost}) (§34)`,
      );
    }
  }

  ctx.symbols.declareAll("ability", abilities.map((ability) => ability.id));
  ctx.symbols.collectReferences(
    abilities.map((ability) => [...ability.actionIds, ...ability.ruleIds]),
    "abilities.execution",
  );
  return { abilities, contexts, taskIds };
}
