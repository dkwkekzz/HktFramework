// 11단계: 행동 정의 생성 (§21, §22)
import type { ActionDefinition, GoalGraph } from "../core/world/types";
import type { GenerationContext } from "./GenerationTypes";
import { ACTION_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const ACTION_TASK = "actions";

const SYSTEM_PROMPT = [
  "너는 세계 생성 컴파일러의 11단계다. 주체가 실제로 할 수 있는 일을 정의한다(§21).",
  "행동마다: 행위자 조건 / 대상 검색 / 세계 조건 / 비용 / 소요 시간 / 기대 효과 / 실행 규칙 / 관찰 신호 / 위험.",
  "비용도 위험도 없는 행동은 만들지 않는다 — 공짜 행동은 주체의 선택을 무의미하게 만든다(§34).",
  "목적의 allowedActionTags 가 가리키는 태그는 하나도 빠짐없이 어떤 행동엔가 붙어 있어야 한다.",
  "행동은 흔적을 남긴다. 남길 것이 있으면 visibleSignals 로 밝힌다(§23).",
].join("\n");

export async function generateActions(
  ctx: GenerationContext,
  graphs: readonly GoalGraph[],
): Promise<ActionDefinition[]> {
  const requiredTags = [
    ...new Set(graphs.flatMap((graph) => graph.nodes.flatMap((node) => node.allowedActionTags))),
  ].sort();

  const actions = await generateChecked<ActionDefinition[]>(
    ctx.port,
    {
      taskId: ACTION_TASK,
      systemPrompt: SYSTEM_PROMPT,
      input: {
        requiredActionTags: requiredTags,
        availableStates: ctx.symbols.list("state"),
        availableRules: ctx.symbols.list("rule"),
        actionCount: ctx.scale.actions,
      },
      outputSchema: ACTION_SCHEMA,
    },
    ctx.telemetry,
  );

  if (actions.length !== ctx.scale.actions) {
    throw new Error(`행동 수가 §40 규모와 다르다 — ${actions.length} (목표 ${ctx.scale.actions})`);
  }
  for (const action of actions) {
    if (action.costs.length === 0 && action.risk <= 0) {
      throw new Error(`비용도 위험도 없는 행동 — ${action.id} (§34)`);
    }
  }
  const providedTags = new Set(actions.flatMap((action) => action.tags));
  const missing = requiredTags.filter((tag) => !providedTags.has(tag));
  if (missing.length > 0) {
    throw new Error(`목적이 요구하는 행동 태그가 없다 — ${missing.join(", ")} (§22 행동 후보 생성)`);
  }

  ctx.symbols.declareAll("action", actions.map((action) => action.id));
  ctx.symbols.collectReferences(
    actions.map((action) => action.executionRules),
    "actions.executionRules",
  );
  return actions;
}
