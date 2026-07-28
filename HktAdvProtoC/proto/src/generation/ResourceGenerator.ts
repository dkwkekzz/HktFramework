// 6단계-b: 자원 생성 (§14)
//
// §14 는 자원마다 "어떻게 만들어지는가 / 누가 필요로 하는가 / 왜 희소한가 / 어디에 있는가 /
// 무엇으로 변환되는가" 를 요구한다. 앞의 넷은 AI 가, '왜 희소한가'의 수치는 코드가 채운다(§13).
import type { ResourceDefinition } from "../core/world/types";
import type { GenerationContext } from "./GenerationTypes";
import { RESOURCE_SCHEMA } from "./OutputSchemas";
import type { RegionProfile } from "./SpaceGenerator";
import { generateChecked } from "./TextGenerationPort";

export const RESOURCE_TASK = "resources";

interface ResourceDraft extends ResourceDefinition {
  sourceRegions?: string[];
}

const SYSTEM_PROMPT = [
  "너는 세계 생성 컴파일러의 6단계다. 자원은 채집물이 아니라 '목적을 이루는 수단'이다(§14).",
  "자원마다 반드시: 어떻게 만들어지는가(productionRules) / 무엇에 쓰이는가(consumptionRules) /",
  "무엇으로 변하는가(transformationRules) / 누가 얼마나 원하는가(desiredBy) / 어디에서 나는가(sourceRegions).",
  "desiredBy 의 utility 는 음수도 쓴다 — 누군가에게 해로운 자원이 갈등의 씨앗이 된다.",
  "규칙 id 는 앞 단계에서 만들어진 것만 쓴다.",
].join("\n");

export async function generateResources(
  ctx: GenerationContext,
  profiles: readonly RegionProfile[],
): Promise<ResourceDefinition[]> {
  const drafts = await generateChecked<ResourceDraft[]>(
    ctx.port,
    {
      taskId: RESOURCE_TASK,
      systemPrompt: SYSTEM_PROMPT,
      input: {
        regions: profiles.map((profile) => ({
          id: profile.id,
          danger: profile.danger,
          accessibility: profile.accessibility,
          rarity: profile.rarity,
        })),
        availableRules: ctx.symbols.list("rule"),
        resourceCount: ctx.scale.resources,
      },
      outputSchema: RESOURCE_SCHEMA,
    },
    ctx.telemetry,
  );

  if (drafts.length !== ctx.scale.resources) {
    throw new Error(`자원 수가 §40 규모와 다르다 — ${drafts.length} (목표 ${ctx.scale.resources})`);
  }

  const rarityOf = new Map(profiles.map((profile) => [profile.id, profile.rarity]));
  const resources: ResourceDefinition[] = drafts.map((draft) => {
    if (draft.productionRules.length === 0) {
      throw new Error(`생성 경로 없는 자원 — ${draft.id} (§34 "모든 자원에는 생성 경로나 초기 배치가 존재한다")`);
    }
    if (draft.desiredBy.length === 0) {
      throw new Error(`아무도 원하지 않는 자원 — ${draft.id} (§33.2 "이유 없이 존재하는 자원")`);
    }
    const sources = draft.sourceRegions ?? [];
    for (const region of sources) {
      if (!rarityOf.has(region)) throw new Error(`자원이 없는 지역에서 난다 — ${draft.id} → ${region}`);
    }
    // §13 — 희귀도는 AI 가 부르는 값이 아니라 지역 조건에서 계산된 값이다
    const rarity =
      sources.length === 0
        ? 0
        : Math.round((sources.reduce((sum, id) => sum + (rarityOf.get(id) ?? 0), 0) / sources.length) * 10) / 10;
    const { sourceRegions: _dropped, ...rest } = draft;
    return {
      ...rest,
      properties: { ...draft.properties, rarity, sourceRegionCount: sources.length },
    };
  });

  ctx.symbols.declareAll("resource", resources.map((resource) => resource.id));
  ctx.symbols.collectReferences(
    resources.map((resource) => [
      ...resource.productionRules,
      ...resource.consumptionRules,
      ...resource.transformationRules,
    ]),
    "resources.rules",
  );
  return resources;
}
