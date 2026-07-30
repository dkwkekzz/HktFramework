// 7단계: 종족 생성 (§15)
//
// §15 의 흐름을 그대로 프롬프트 구조로 강제한다:
//   생존 압력 → 전략 후보 → 종족화 → 장단점 → 감각·신체 → 번식·사회 구조
// 전략 후보(1차 호출)와 종족 상세(항목별 호출)를 나눈다 — 실패한 종 하나만 다시 부를 수 있다(§5.2).
import { OBSERVATION_CHANNELS } from "../shared/observation";
import type { SpeciesDefinition, SurvivalPressureDefinition } from "../core/world/types";
import type { GenerationContext } from "./GenerationTypes";
import { OUTLINE_SCHEMA, SPECIES_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const SPECIES_OUTLINE_TASK = "species_outline";
export const speciesTask = (id: string): string => `species/${id}`;

/** §15 이 열거한 7개 생존 전략 */
export const SURVIVAL_STRATEGIES = [
  "위협보다 강해진다",
  "위협을 감지해 피한다",
  "무리를 만들어 방어한다",
  "위협과 비슷한 모습을 모방한다",
  "강한 생명체에 기생한다",
  "환경과 동화된다",
  "빠르게 번식해 손실을 상쇄한다",
] as const;

export interface SpeciesOutline {
  id: string;
  name: string;
  summary: string;
  tags?: string[];
}

/** §15 의 절차 산출 — 실행 포맷(SpeciesDefinition)에 생성 근거를 덧붙인 형태 */
export interface SpeciesDraft extends SpeciesDefinition {
  strategy: string;
  derivedFromPressures?: string[];
  strengths: string[];
  weaknesses: string[];
  socialStructure: string;
  reproduction?: string;
}

const OUTLINE_PROMPT = [
  "너는 세계 생성 컴파일러의 7단계다. 먼저 '어떤 생존 전략의 종이 필요한가'만 목록으로 낸다(§15).",
  "같은 압력을 서로 다른 전략으로 견디는 종들을 고른다 — 전략이 겹치면 종이 겹친다.",
  "각 종은 아래 전략 목록 중 하나에서 파생되어야 한다.",
].join("\n");

const SPECIES_PROMPT = [
  "너는 세계 생성 컴파일러의 7단계다. 종족 하나를 생존 구조 중심으로 상세화한다(§15).",
  "외형과 전투력보다 먼저: 생존 단위(개체·가족·무리·군체·혈통·숙주·기억) / 매일 필요한 자원 /",
  "감각(채널·사거리·정확도) / 본능 목적 / 적응·성장 규칙 / 전략의 장점과 약점 / 사회 구조.",
  "전략의 장점에는 반드시 대응하는 약점을 만든다 — 약점 없는 종은 세계를 무너뜨린다.",
  "감각은 이 종이 무엇을 알 수 있고 무엇을 끝내 모르는지를 정한다(§23).",
  "번식을 말했으면 그것을 실행하는 규칙을 reproductionRuleIds 로 함께 밝힌다 — 선언만 남은 번식은 이야기일 뿐이다(§15).",
  "능력을 가질 수 있는 종인지 abilityAccess 로 밝힌다(§16 능력 체계는 사람만의 것이 아닐 수 있다).",
].join("\n");

export async function generateSpecies(
  ctx: GenerationContext,
  pressures: readonly SurvivalPressureDefinition[],
): Promise<{ species: SpeciesDraft[]; outline: SpeciesOutline[]; taskIds: string[] }> {
  const outline = await generateChecked<SpeciesOutline[]>(
    ctx.port,
    {
      taskId: SPECIES_OUTLINE_TASK,
      systemPrompt: OUTLINE_PROMPT,
      input: {
        pressures: pressures.map((pressure) => ({
          id: pressure.id,
          targetState: pressure.targetState,
          failureState: pressure.failureState,
        })),
        strategies: SURVIVAL_STRATEGIES,
        speciesCount: ctx.scale.species,
        // 공간 태그 요약만 — 지역 정의 전체를 넘기지 않는다(§33)
        spaceTags: ctx.symbols.list("region"),
      },
      outputSchema: OUTLINE_SCHEMA,
    },
    ctx.telemetry,
  );

  if (outline.length !== ctx.scale.species) {
    throw new Error(`종족 수가 §40 규모와 다르다 — ${outline.length} (목표 ${ctx.scale.species})`);
  }

  const taskIds = [SPECIES_OUTLINE_TASK];
  const species: SpeciesDraft[] = [];
  for (const candidate of outline) {
    const taskId = speciesTask(candidate.id);
    taskIds.push(taskId);
    const draft = await generateChecked<SpeciesDraft>(
      ctx.port,
      {
        taskId,
        systemPrompt: SPECIES_PROMPT,
        input: {
          candidate,
          pressures: pressures
            .filter((pressure) =>
              pressure.applicableSpeciesTags.some((tag) => (candidate.tags ?? []).includes(tag)),
            )
            .map((pressure) => ({ id: pressure.id, targetState: pressure.targetState })),
          availableResourceTags: [...new Set(ctx.symbols.list("resource").map((id) => id.split(".")[1] ?? id))],
          observationChannels: OBSERVATION_CHANNELS,
        },
        outputSchema: SPECIES_SCHEMA,
      },
      ctx.telemetry,
    );

    if (draft.requiredResources.length === 0) {
      throw new Error(`생존 자원이 없는 종 — ${draft.id} (§34 "모든 종은 최소 하나의 생존 자원을 필요로 한다")`);
    }
    if (draft.weaknesses.length === 0) {
      throw new Error(`약점 없는 종 — ${draft.id} (§15 장점에는 대응하는 약점이 있다)`);
    }
    if (!SURVIVAL_STRATEGIES.includes(draft.strategy as (typeof SURVIVAL_STRATEGIES)[number])) {
      throw new Error(`§15 전략 목록 밖의 전략 — ${draft.id}: ${draft.strategy}`);
    }
    species.push(draft);
  }

  ctx.symbols.declareAll("species", species.map((entry) => entry.id));
  ctx.symbols.collectReferences(
    species.map((entry) => [...entry.instincts, ...entry.adaptationRules, ...entry.growthRules]),
    "species.references",
  );
  return { species, outline, taskIds };
}

/**
 * 실행 포맷 — 생성 근거(전략·장단점)는 아티팩트에 남고 WorldDefinition 에는 들어가지 않는다.
 * 단 번식·사회 구조는 **버리지 않는다**(G-4): 번식은 그것을 실행하는 규칙(§15 growthRules 중)에 연결되고,
 * 사회 구조는 survivalUnit 이 만든 관계 출발선의 근거로 남는다.
 */
export function toSpeciesDefinition(draft: SpeciesDraft): SpeciesDefinition {
  const reproductionRuleIds = (draft.reproductionRuleIds ?? []).filter((id) => id.length > 0);
  const fallback =
    reproductionRuleIds.length > 0
      ? reproductionRuleIds
      : [...draft.growthRules, ...draft.adaptationRules].filter((id) => /reproduc|breed|offspring|번식/i.test(id));
  return {
    id: draft.id,
    name: draft.name,
    survivalUnit: draft.survivalUnit,
    requiredResources: draft.requiredResources,
    senses: draft.senses,
    instincts: draft.instincts,
    adaptationRules: draft.adaptationRules,
    growthRules: draft.growthRules,
    ...(draft.reproduction === undefined ? {} : { reproduction: draft.reproduction }),
    ...(fallback.length === 0 ? {} : { reproductionRuleIds: fallback }),
    ...(draft.socialStructure === undefined ? {} : { socialStructure: draft.socialStructure }),
    ...(draft.abilityAccess === undefined ? {} : { abilityAccess: draft.abilityAccess }),
  };
}
