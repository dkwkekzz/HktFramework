// 13단계-a: 개인 캐릭터 생성 (§18)
//
// §18 의 10절차를 프롬프트 구조로 강제한다. 개인은 종족·조직의 복사본이 아니다 —
// 본능·경험·관계·가치관이 서로 충돌하도록 만든다. 성격은 단어가 아니라 판단 변수 9종의 수치다.
// 20명은 §5.2 의 분할 호출로 만든다: 명단 한 번, 인물 한 명당 한 번.
import type { AgentArchetype, BootstrapEntity } from "../core/world/types";
import type { AbilityGenerationContext } from "./AbilityGenerator";
import type { GenerationContext } from "./GenerationTypes";
import { AGENT_SCHEMA, OUTLINE_SCHEMA } from "./OutputSchemas";
import { generateChecked } from "./TextGenerationPort";

export const AGENT_OUTLINE_TASK = "agents_outline";
export const agentTask = (id: string): string => `agents/${id}`;

/** §18 판단 변수 9종 — 성격을 단어가 아니라 수치로 저장한다 */
export const TRAIT_KEYS = [
  "riskTolerance",
  "curiosity",
  "loyalty",
  "greed",
  "empathy",
  "vengefulness",
  "patience",
  "deceptionPreference",
  "uncertaintyAversion",
] as const;

export interface AgentOutline {
  id: string;
  name: string;
  summary: string;
  tags?: string[];
}

/** 인물 원형 + 배치에 필요한 것 */
export interface AgentDraft extends AgentArchetype {
  homeLocationId: string;
  tags: string[];
  states: Record<string, unknown>;
  memories?: BootstrapEntity["memories"];
  inventory?: BootstrapEntity["inventory"];
  relationships?: {
    toId: string;
    trust?: number;
    fear?: number;
    respect?: number;
    affection?: number;
    resentment?: number;
    dependency?: number;
    debt?: number;
    familiarity?: number;
  }[];
  beliefs?: {
    subjectId: string;
    stateKey: string;
    believedValue: number | boolean | string;
    confidence: number;
    sourceIds: string[];
  }[];
}

const OUTLINE_PROMPT = [
  "너는 세계 생성 컴파일러의 13단계다. 먼저 '누가 이 세계에 살고 있는가'만 명단으로 낸다(§18).",
  "같은 조직 안에서도 이해가 갈리도록 배치한다 — 전원이 조직에 충실하면 조직 내부 갈등이 생기지 않는다.",
  "능력 사용자는 이미 9단계에서 정해졌다. 그 인물들을 반드시 명단에 포함한다.",
].join("\n");

const AGENT_PROMPT = [
  "너는 세계 생성 컴파일러의 13단계다. 인물 한 명을 만든다(§18 절차 1~10).",
  "출신 → 과거 생존 사건 → 그 사건이 남긴 가치관과 두려움 → 조직에서의 역할 →",
  "조직 목적과 개인 가치관의 갈등 → 가장 중요한 관계 → 지금 해결해야 하는 문제 순서로 만든다.",
  "성격은 형용사가 아니라 판단 변수 9종의 0~100 수치로 저장한다.",
  "초기 믿음에는 틀린 믿음도 넣는다 — 모두가 사실을 아는 세계에는 사건이 없다(§10).",
  "과거 생존 사건(formativeEvent)은 memories 로도 남긴다 — type·participants·tags·강도·해석(interpretation)을 갖는",
  "기억 데이터가 초기 믿음을 지지해야 한다. 소지품은 inventory([{resourceId, quantity}])로 선언한다(§18).",
].join("\n");

export async function generateAgents(
  ctx: GenerationContext,
  abilityContexts: readonly AbilityGenerationContext[],
): Promise<{ agents: AgentDraft[]; outline: AgentOutline[]; taskIds: string[] }> {
  const outline = await generateChecked<AgentOutline[]>(
    ctx.port,
    {
      taskId: AGENT_OUTLINE_TASK,
      systemPrompt: OUTLINE_PROMPT,
      input: {
        factions: ctx.symbols.list("faction"),
        goalGraphs: ctx.symbols.list("goal_graph"),
        abilityOwners: abilityContexts.map((context) => ({
          id: context.ownerId,
          name: context.ownerName,
          coreDesire: context.coreDesire,
        })),
        agentCount: ctx.scale.keyAgents,
      },
      outputSchema: OUTLINE_SCHEMA,
    },
    ctx.telemetry,
  );

  if (outline.length !== ctx.scale.keyAgents) {
    throw new Error(`주요 개인 수가 §40 규모와 다르다 — ${outline.length} (목표 ${ctx.scale.keyAgents})`);
  }
  const listed = new Set(outline.map((entry) => entry.id));
  const missingOwners = abilityContexts.filter((context) => !listed.has(context.ownerId));
  if (missingOwners.length > 0) {
    throw new Error(`능력 사용자가 명단에 없다 — ${missingOwners.map((c) => c.ownerId).join(", ")}`);
  }

  const taskIds = [AGENT_OUTLINE_TASK];
  const agents: AgentDraft[] = [];
  for (const candidate of outline) {
    const taskId = agentTask(candidate.id);
    taskIds.push(taskId);
    const owner = abilityContexts.find((context) => context.ownerId === candidate.id);
    const agent = await generateChecked<AgentDraft>(
      ctx.port,
      {
        taskId,
        systemPrompt: AGENT_PROMPT,
        input: {
          candidate,
          // 능력자라면 9단계에서 만든 문맥을 그대로 준다 — 능력과 인물이 어긋나지 않게
          abilityContext: owner,
          availableFactions: ctx.symbols.list("faction"),
          availableGoalGraphs: ctx.symbols.list("goal_graph"),
          availableSpecies: ctx.symbols.list("species"),
          availableLocations: ctx.symbols.list("location"),
          traitKeys: TRAIT_KEYS,
        },
        outputSchema: AGENT_SCHEMA,
      },
      ctx.telemetry,
    );

    for (const key of TRAIT_KEYS) {
      const value = agent.traits[key];
      if (typeof value !== "number") {
        throw new Error(`판단 변수 누락 — ${agent.id}.${key} (§18)`);
      }
    }
    if (!ctx.symbols.has("goal_graph", agent.goalGraphId)) {
      throw new Error(`인물이 없는 목적 그래프를 가리킨다 — ${agent.id} → ${agent.goalGraphId} (§34)`);
    }
    if (!ctx.symbols.has("location", agent.homeLocationId)) {
      throw new Error(`인물이 없는 장소에 산다 — ${agent.id} → ${agent.homeLocationId}`);
    }
    if (agent.values.length === 0 || agent.fears.length === 0) {
      throw new Error(`가치관·두려움 없는 인물 — ${agent.id} (§18 절차 4)`);
    }
    agents.push(agent);
  }

  // §18 절차 6 — 조직에 속한 인물 중 누군가는 조직 목적과 갈등해야 한다
  const conflicted = agents.filter((agent) => agent.innerConflict.trim().length > 0);
  if (conflicted.length < agents.length / 2) {
    throw new Error(`내적 갈등을 가진 인물이 너무 적다 — ${conflicted.length}/${agents.length} (§18 절차 6)`);
  }

  ctx.symbols.declareAll("entity", agents.map((agent) => agent.id));
  return { agents, outline, taskIds };
}

export function toArchetype(draft: AgentDraft): AgentArchetype {
  return {
    id: draft.id,
    name: draft.name,
    speciesId: draft.speciesId,
    factionIds: draft.factionIds,
    role: draft.role,
    origin: draft.origin,
    formativeEvent: draft.formativeEvent,
    values: draft.values,
    fears: draft.fears,
    innerConflict: draft.innerConflict,
    currentProblem: draft.currentProblem,
    traits: draft.traits,
    goalGraphId: draft.goalGraphId,
    abilityIds: draft.abilityIds,
  };
}
