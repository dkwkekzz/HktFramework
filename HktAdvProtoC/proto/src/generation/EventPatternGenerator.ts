// 12단계: 사건 패턴 생성 (§28)
//
// 개별 사건을 저작하지 않는다. "이런 모양의 변화 묶음을 사건으로 본다"는 선언만 만든다.
import type { ActionDefinition, EventPattern } from "../core/world/types";
import type { RuleDefinition } from "../core/rules/RuleTypes";
import type { GenerationContext } from "./GenerationTypes";
import { EVENT_PATTERN_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const EVENT_PATTERN_TASK = "event_patterns";

const SYSTEM_PROMPT = [
  "너는 세계 생성 컴파일러의 12단계다. 사건 패턴을 만든다(§28).",
  "개별 사건을 쓰지 않는다 — 어떤 태그의 변화가 몇 명 이상, 얼마의 시간·거리 안에서 겹칠 때",
  "그것을 하나의 사건으로 볼 것인지만 선언한다.",
  "requiredTags 는 앞 단계에서 규칙과 행동이 실제로 붙인 태그 중에서만 고른다 — 없는 태그를 기다리는 패턴은 영원히 발동하지 않는다.",
  "모든 패턴은 둘 이상의 주체 또는 체계를 연결해야 한다(§34).",
].join("\n");

export async function generateEventPatterns(
  ctx: GenerationContext,
  rules: readonly RuleDefinition[],
  actions: readonly ActionDefinition[],
): Promise<EventPattern[]> {
  const availableTags = [
    ...new Set([...rules.flatMap((rule) => rule.tags ?? []), ...actions.flatMap((action) => action.tags)]),
  ].sort();

  const patterns = await generateChecked<EventPattern[]>(
    ctx.port,
    {
      taskId: EVENT_PATTERN_TASK,
      systemPrompt: SYSTEM_PROMPT,
      input: {
        availableChangeTags: availableTags,
        patternCount: ctx.scale.eventPatterns,
        significanceFormulas: ["standard"],
      },
      outputSchema: EVENT_PATTERN_SCHEMA,
    },
    ctx.telemetry,
  );

  if (patterns.length !== ctx.scale.eventPatterns) {
    throw new Error(`사건 패턴 수가 §40 규모와 다르다 — ${patterns.length} (목표 ${ctx.scale.eventPatterns})`);
  }
  const known = new Set(availableTags);
  for (const pattern of patterns) {
    if (pattern.requiredTags.length === 0) {
      throw new Error(`아무 조건 없는 사건 패턴 — ${pattern.id} (모든 변화가 사건이 된다)`);
    }
    const unknown = pattern.requiredTags.filter((tag) => !known.has(tag));
    if (unknown.length > 0) {
      throw new Error(`규칙·행동이 만들지 않는 태그를 기다린다 — ${pattern.id}: ${unknown.join(", ")}`);
    }
    if (pattern.minimumParticipants < 2) {
      throw new Error(`한 주체만으로 성립하는 사건 패턴 — ${pattern.id} (§34)`);
    }
  }

  ctx.symbols.declareAll("event_pattern", patterns.map((pattern) => pattern.id));
  return patterns;
}
