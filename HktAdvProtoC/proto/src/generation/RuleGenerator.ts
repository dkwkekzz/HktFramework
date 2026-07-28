// 5단계: 세계 규칙 생성 (§11, §12 — 출력 계약은 Phase 2 의 RuleSchema 그대로)
//
// 대량 항목이므로 §5.2 의 분할 호출을 쓴다: 먼저 규칙 묶음 목록(그룹 + 한 줄 전략)을 만들고,
// 그룹마다 별도 호출로 상세화한다. 실패한 그룹만 다시 부를 수 있다.
import { loadRuleDocuments } from "../core/rules/RuleSchema";
import type { RuleDefinition } from "../core/rules/RuleTypes";
import type { StateSchema, WorldAxiom } from "../core/world/types";
import type { GenerationContext } from "./GenerationTypes";
import { OUTLINE_SCHEMA, RULE_LIST_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const RULE_OUTLINE_TASK = "rules_outline";
export const ruleGroupTask = (group: string): string => `rules/${group}`;

export interface RuleGroupOutline {
  id: string;
  name: string;
  summary: string;
  group?: string;
  tags?: string[];
}

const OUTLINE_PROMPT = [
  "너는 세계 생성 컴파일러의 5단계다. 먼저 '어떤 규칙 묶음이 필요한가'만 목록으로 낸다(§5.2 분할 호출).",
  "규칙은 세계가 스스로 굴러가게 하는 인과다 — 대사·생태·자원·관찰·조직·관계·사회를 빠짐없이 덮는다.",
  "각 묶음은 어떤 명제에서 왔는지 한 줄로 밝힌다.",
].join("\n");

const GROUP_PROMPT = [
  "너는 세계 생성 컴파일러의 5단계다. 규칙 묶음 하나를 실행 가능한 JSON 규칙으로 상세화한다(§11, §12).",
  "트리거는 state_changed / interval / action_executed / entity_entered / relationship_changed 5종만 쓴다.",
  "효과는 등록된 상태 키만 건드린다. 등록되지 않은 상태를 쓰면 세계가 로드되지 않는다(§9).",
  "모든 규칙은 derivedFromAxioms 로 자기 근거 명제를 밝힌다 — 명제를 위반하는 규칙은 만들지 않는다(§7).",
  "관찰 가능한 변화에는 observations 로 신호를 붙인다. 신호는 실제 상태와 다를 수 있다(§10).",
].join("\n");

export async function generateRules(
  ctx: GenerationContext,
  axioms: readonly WorldAxiom[],
  stateSchemas: readonly StateSchema[],
): Promise<{ rules: RuleDefinition[]; outline: RuleGroupOutline[]; taskIds: string[] }> {
  const outline = await generateChecked<RuleGroupOutline[]>(
    ctx.port,
    {
      taskId: RULE_OUTLINE_TASK,
      systemPrompt: OUTLINE_PROMPT,
      input: {
        axioms: axioms.map((axiom) => ({ id: axiom.id, statement: axiom.statement })),
        targetRuleCount: ctx.scale.rules,
      },
      outputSchema: OUTLINE_SCHEMA,
    },
    ctx.telemetry,
  );

  const taskIds = [RULE_OUTLINE_TASK];
  const documents: unknown[] = [];
  // 상태 목록은 소유자별로 접어서 넘긴다 — 스키마 전체(수십 개)를 그대로 싣지 않기 위해서다(§33)
  const statesByOwner: Record<string, string[]> = {};
  for (const schema of stateSchemas) {
    (statesByOwner[schema.ownerType] ??= []).push(schema.id);
  }

  for (const group of outline) {
    const taskId = ruleGroupTask(group.id);
    taskIds.push(taskId);
    const documentsOfGroup = await generateChecked<unknown[]>(
      ctx.port,
      {
        taskId,
        systemPrompt: GROUP_PROMPT,
        input: {
          group: { id: group.id, name: group.name, summary: group.summary },
          availableStates: statesByOwner,
          availableAxioms: ctx.symbols.list("axiom"),
        },
        outputSchema: RULE_LIST_SCHEMA,
      },
      ctx.telemetry,
    );
    documents.push(...documentsOfGroup);
  }

  const rules = loadRuleDocuments(documents);
  const { min, max } = ctx.scale.rules;
  if (rules.length < min || rules.length > max) {
    throw new Error(`규칙 개수가 §40 규모를 벗어났다 — ${rules.length} (목표 ${min}~${max})`);
  }
  const axiomIds = new Set(axioms.map((axiom) => axiom.id));
  for (const rule of rules) {
    if (rule.derivedFromAxioms.length === 0) {
      throw new Error(`근거 명제가 없는 규칙 — ${rule.id} (§7 상위 제약)`);
    }
    for (const axiom of rule.derivedFromAxioms) {
      if (!axiomIds.has(axiom)) throw new Error(`규칙이 없는 명제를 가리킨다 — ${rule.id} → ${axiom}`);
    }
  }
  ctx.symbols.declareAll(
    "rule",
    rules.map((rule) => rule.id),
  );
  return { rules, outline, taskIds };
}
