// 10단계: 목적 그래프 생성 (§19)
//
// 목적은 중첩 목록이 아니라 그래프다. 한 그래프 = 한 역할(사냥꾼·연구자·조직·짐승)의 판단 지도.
// 그래프마다 별도 호출로 만든다(§5.2 분할 호출) — 실패한 그래프 하나만 다시 부를 수 있다.
import type { GoalGraph, SurvivalPressureDefinition } from "../core/world/types";
import type { GenerationContext } from "./GenerationTypes";
import { GOAL_GRAPH_SCHEMA, OUTLINE_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const GOAL_OUTLINE_TASK = "goal_graphs_outline";
export const goalGraphTask = (id: string): string => `goals/${id}`;

export interface GoalGraphOutline {
  id: string;
  name: string;
  summary: string;
  tags?: string[];
}

const OUTLINE_PROMPT = [
  "너는 세계 생성 컴파일러의 10단계다. 먼저 '어떤 역할의 판단 지도가 필요한가'만 목록으로 낸다(§19).",
  "종족의 본능, 조직의 생존, 개인의 역할마다 서로 다른 목적 그래프가 필요하다.",
  "앞 단계의 생존 압력이 가리키는 목적은 반드시 어느 그래프엔가 들어가야 한다.",
].join("\n");

const GRAPH_PROMPT = [
  "너는 세계 생성 컴파일러의 10단계다. 목적 그래프 하나를 만든다(§19, §20).",
  "각 목적은: 달성 조건 / 기본 중요도 / 긴급도 정책 / 원하는 상태 변화 / 포기 조건 / 허용 행동 태그.",
  "목적 사이의 관계(requires·supports·conflicts·alternative·reveals·creates)를 반드시 엣지로 남긴다 —",
  "충돌하는 목적이 없는 주체는 갈등을 만들지 못한다.",
  "포기 조건이 없으면 주체는 이룰 수 없는 목적에 갇힌다. 무한 순환을 만들지 않는다(§34).",
].join("\n");

export async function generateGoalGraphs(
  ctx: GenerationContext,
  pressures: readonly SurvivalPressureDefinition[],
): Promise<{ graphs: GoalGraph[]; outline: GoalGraphOutline[]; taskIds: string[] }> {
  const outline = await generateChecked<GoalGraphOutline[]>(
    ctx.port,
    {
      taskId: GOAL_OUTLINE_TASK,
      systemPrompt: OUTLINE_PROMPT,
      input: {
        species: ctx.symbols.list("species"),
        factions: ctx.symbols.list("faction"),
        pressureGoals: pressures.map((pressure) => ({ pressure: pressure.id, goalId: pressure.goalId })),
      },
      outputSchema: OUTLINE_SCHEMA,
    },
    ctx.telemetry,
  );

  const taskIds = [GOAL_OUTLINE_TASK];
  const graphs: GoalGraph[] = [];
  for (const candidate of outline) {
    const taskId = goalGraphTask(candidate.id);
    taskIds.push(taskId);
    const graph = await generateChecked<GoalGraph>(
      ctx.port,
      {
        taskId,
        systemPrompt: GRAPH_PROMPT,
        input: {
          candidate,
          requiredGoalIds: pressures
            .filter((pressure) => (candidate.tags ?? []).some((tag) => pressure.applicableSpeciesTags.includes(tag)))
            .map((pressure) => pressure.goalId),
          availableStates: ctx.symbols.list("state"),
          availableActionTags: [
            "eat",
            "gather",
            "hunt",
            "forage",
            "move",
            "observe",
            "investigate",
            "track",
            "report",
            "social",
            "rumor",
            "trade",
            "faction_trade",
            "attack",
            "combat",
            "flee",
            "escape",
            "rest",
            "recover",
            "delegate",
            "ability",
            "smuggle",
            "guard",
            "heal",
            "ritual",
          ],
          focusIds: [...ctx.symbols.list("faction"), ...ctx.symbols.list("species")],
        },
        outputSchema: GOAL_GRAPH_SCHEMA,
      },
      ctx.telemetry,
    );

    if (graph.nodes.length === 0) throw new Error(`목적이 없는 그래프 — ${graph.id}`);
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        throw new Error(`엣지가 없는 목적을 가리킨다 — ${graph.id}: ${edge.from} → ${edge.to}`);
      }
    }
    for (const node of graph.nodes) {
      if (node.allowedActionTags.length === 0) {
        throw new Error(`행동할 수 없는 목적 — ${graph.id}/${node.id} (§34 "활성화 가능한 목적")`);
      }
    }
    assertNoRequirementCycle(graph);
    graphs.push(graph);
  }

  ctx.symbols.declareAll("goal_graph", graphs.map((graph) => graph.id));
  for (const graph of graphs) {
    ctx.symbols.declareAll("goal", graph.nodes.map((node) => node.id));
  }

  // 압력이 가리키는 목적이 하나라도 없으면 그 압력은 영원히 해소되지 않는다
  const missing = pressures
    .filter((pressure) => !ctx.symbols.has("goal", pressure.goalId))
    .map((pressure) => `${pressure.id}→${pressure.goalId}`);
  if (missing.length > 0) {
    throw new Error(`압력이 가리키는 목적이 없다 — ${missing.join(", ")} (§8, §20)`);
  }
  return { graphs, outline, taskIds };
}

/** §34 "순환 목적 그래프가 무한 행동을 만들지 않는다" — requires 순환을 금지한다 */
function assertNoRequirementCycle(graph: GoalGraph): void {
  const edges = graph.edges.filter((edge) => edge.relation === "requires");
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string, trail: string[]): void => {
    const current = state.get(id);
    if (current === "done") return;
    if (current === "visiting") {
      throw new Error(`목적 그래프에 requires 순환이 있다 — ${graph.id}: ${[...trail, id].join(" → ")} (§34)`);
    }
    state.set(id, "visiting");
    for (const next of outgoing.get(id) ?? []) visit(next, [...trail, id]);
    state.set(id, "done");
  };
  for (const node of graph.nodes) visit(node.id, []);
}
