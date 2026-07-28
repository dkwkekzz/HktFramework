// 2단계: 세계 핵심 명제 생성 (§7)
import type { WorldAxiom } from "../core/world/types";
import type { GenerationContext, NormalizedTheme } from "./GenerationTypes";
import { AXIOM_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const AXIOM_TASK = "axioms";

const SYSTEM_PROMPT = [
  "너는 세계 생성 컴파일러의 2단계다. 정규화된 주제에서 '변하지 않는 세계의 전제'를 만든다(§7).",
  "명제는 이후 생성되는 모든 규칙·종족·능력의 상위 제약이다. 어떤 콘텐츠도 이유 없이 이를 위반할 수 없다.",
  "각 명제는 반드시 하나 이상의 주제 id 를 derivedFrom 에 밝힌다 — 근거 없는 설정을 만들지 않는다.",
  "category 는 existence/survival/power/cost/ecology/society/information 중에서 고른다.",
].join("\n");

export async function generateAxioms(
  ctx: GenerationContext,
  themes: readonly NormalizedTheme[],
): Promise<WorldAxiom[]> {
  const axioms = await generateChecked<WorldAxiom[]>(
    ctx.port,
    {
      taskId: AXIOM_TASK,
      systemPrompt: SYSTEM_PROMPT,
      input: {
        // 월드 상태가 아니라 직전 단계 산출물만 넘긴다 (§33)
        normalizedThemes: themes.map((theme) => ({
          id: theme.id,
          subject: theme.subject,
          condition: theme.condition,
          behavior: theme.behavior,
          desiredState: theme.desiredState,
          cost: theme.cost,
          threat: theme.threat,
          scope: theme.scope,
        })),
        prohibitedElements: ctx.seedInput.prohibitedElements ?? [],
      },
      outputSchema: AXIOM_SCHEMA,
    },
    ctx.telemetry,
  );

  const themeIds = new Set(themes.map((theme) => theme.id));
  for (const axiom of axioms) {
    if (axiom.derivedFrom.length === 0) {
      throw new Error(`명제에 근거 주제가 없다 — ${axiom.id} (§7)`);
    }
    for (const source of axiom.derivedFrom) {
      if (!themeIds.has(source)) throw new Error(`명제가 없는 주제를 가리킨다 — ${axiom.id} → ${source}`);
    }
  }
  ctx.symbols.declareAll(
    "axiom",
    axioms.map((axiom) => axiom.id),
  );
  return axioms;
}
