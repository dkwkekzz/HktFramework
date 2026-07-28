// 1단계: 주제 정규화 (§6)
import type { GenerationContext, NormalizedTheme } from "./GenerationTypes";
import { NORMALIZED_THEME_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const NORMALIZE_TASK = "normalize_themes";

const SYSTEM_PROMPT = [
  "너는 세계 생성 컴파일러의 1단계다. 자유 문장에서 최소한의 구조만 뽑는다.",
  "각 문장에서 subject / condition / behavior / desiredState / cost / threat / scope 를 추출한다.",
  "새로운 설정을 지어내지 않는다. 문장이 말하지 않은 것은 비워 둔다(§6).",
  "입력 문장 하나당 정확히 하나의 결과를 만들고, source 에 원문을 그대로 담는다.",
].join("\n");

export async function normalizeThemes(ctx: GenerationContext): Promise<NormalizedTheme[]> {
  const themes = await generateChecked<NormalizedTheme[]>(
    ctx.port,
    {
      taskId: NORMALIZE_TASK,
      systemPrompt: SYSTEM_PROMPT,
      input: {
        title: ctx.seedInput.title ?? "",
        themes: ctx.seedInput.themes,
        desiredExperiences: ctx.seedInput.desiredExperiences ?? [],
        prohibitedElements: ctx.seedInput.prohibitedElements ?? [],
      },
      outputSchema: NORMALIZED_THEME_SCHEMA,
    },
    ctx.telemetry,
  );

  // §6 "최소한의 구조만 추출" — 입력 문장 수와 결과 수가 어긋나면 설정을 더했거나 빠뜨린 것이다
  if (themes.length !== ctx.seedInput.themes.length) {
    throw new Error(
      `정규화 결과 수가 입력 문장 수와 다르다 — 입력 ${ctx.seedInput.themes.length} vs 출력 ${themes.length}`,
    );
  }
  for (const theme of themes) {
    if (!ctx.seedInput.themes.includes(theme.source)) {
      throw new Error(`정규화 결과의 source 가 입력 문장이 아니다 — "${theme.source}"`);
    }
  }
  return themes;
}
