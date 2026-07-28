// 조직 주체화 (기획서 §17, §21 위임, §35 factionCollapse / Phase-3 §3.7)
//
// 별도의 "조직 AI" 는 없다. 조직은 EntityState.type="faction" 인 주체이고,
// 개인과 **같은** 판단 파이프라인(BeliefView → GoalSystem → ActionPlanner)을 탄다.
// 이 파일이 갖는 것은 개인과 다른 두 가지뿐이다: 위임의 수용, 그리고 붕괴 판정.
import type { DelegatedGoal, PromiseState } from "../../shared/beliefs";
import { TICKS_PER_DAY } from "../../shared/time";
import { evaluateAll, type EvalScope } from "../world/Conditions";
import { agentEntities } from "../world/Queries";
import type { WorldRuntime } from "../world/WorldRuntime";
import { DELEGATION_TTL } from "./GoalSystem";
import { rememberEvent } from "./MemorySystem";
import { addPromise } from "./RelationshipSystem";

/** 위임의 기본 중요도 — 조직이 "이건 꼭 해라"라고 말하는 세기 */
export const DELEGATION_IMPORTANCE = 35;
/** 위임에 딸려 오는 약속의 기한 */
export const DELEGATION_PROMISE_DUE = 2 * TICKS_PER_DAY;

/**
 * 위임 상태를 목적 주입으로 바꾼다 (§17 "구성원 위임", §21).
 * 조직의 행동(action.delegate)이 개인의 상태(delegated_goal)를 세우면,
 * 여기서 그 상태가 개인의 목적 그래프에 들어가고 약속(§25)이 하나 생긴다.
 * 받아들이는 정도는 개인의 충성도·관계가 정한다 — 그 계산은 GoalSystem 이 한다(§18-6 충돌).
 */
export function syncDelegations(runtime: WorldRuntime): void {
  // 위임 상태를 쓰지 않는 세계(픽스처 등)에서는 할 일이 없다
  if (runtime.schemas.find("agent", "delegated_goal") === undefined) return;
  for (const agentId of runtime.agentIds()) {
    const agent = runtime.agentRuntime(agentId);
    if (agent.kind === "faction") continue;
    if (runtime.store.findEntity(agentId) === undefined) continue;
    const goalId = runtime.store.read(agentId, "delegated_goal");
    const fromId = runtime.store.read(agentId, "delegated_by");
    if (typeof goalId !== "string" || goalId === "") continue;
    if (typeof fromId !== "string" || fromId === "") continue;

    const now = runtime.state.simulationTime;
    // 같은 일을 하루에 두 번 시키지 않는다 — 조직의 재촉이 개인의 계획을 갈아엎지 않게 한다
    const recent = agent.delegations.find(
      (existing) =>
        existing.goalId === goalId && existing.fromId === fromId && now - existing.issuedAt < TICKS_PER_DAY,
    );
    if (recent !== undefined) {
      runtime.store.withContext({ sourceId: fromId, targetIds: [agentId], tags: ["delegation", goalId] }, () => {
        runtime.store.modify(agentId, "delegated_goal", "set", "");
        runtime.store.modify(agentId, "delegated_by", "set", "");
      });
      continue;
    }

    const delegation: DelegatedGoal = {
      goalId,
      fromId,
      importance: DELEGATION_IMPORTANCE,
      issuedAt: now,
      expiresAt: now + DELEGATION_TTL,
    };
    agent.delegations = agent.delegations.filter(
      (existing) => !(existing.goalId === goalId && existing.fromId === fromId),
    );
    agent.delegations.push(delegation);

    // 위임은 약속이다 — 기한 안에 하지 않으면 신뢰가 무너진다 (§25)
    const promise: PromiseState = {
      id: `promise.${agentId}.${fromId}.${now}`,
      stateKey: "delegation_completed",
      comparison: ">",
      threshold: 0,
      createdAt: now,
      dueAt: now + DELEGATION_PROMISE_DUE,
      status: "open",
      tags: ["delegation", goalId],
    };
    runtime.store.withContext(
      { sourceId: fromId, targetIds: [agentId], tags: ["delegation", goalId] },
      () => {
        addPromise(runtime, agentId, fromId, promise);
        rememberEvent(runtime, agentId, {
          type: "promise",
          participants: [agentId, fromId],
          tags: ["delegation", goalId],
          emotionalIntensity: 40,
          relevance: 60,
          confidence: 1,
        });
        // 주입이 끝났으므로 표식을 내린다 — 다음 소집이 다시 세울 수 있게
        runtime.store.modify(agentId, "delegated_goal", "set", "");
        runtime.store.modify(agentId, "delegated_by", "set", "");
        // 새 위임은 새로 해내야 한다 — 지난번 실적으로 이번 약속을 지킬 수 없다
        runtime.store.modify(agentId, "delegation_completed", "set", 0);
        // 새 목적이 들어왔으니 계획을 다시 세운다 (§26 "새로운 정보가 들어왔다")
        if (!agent.flags.includes("goal_invalidated")) agent.flags.push("goal_invalidated");
      },
    );
  }
}

/**
 * §17 collapseConditions 상시 검사 → §35 factionCollapse 판정의 근거 데이터.
 * 붕괴한 조직은 구성원의 소속을 풀고 통제 자원을 놓는다.
 */
export function checkFactionCollapse(runtime: WorldRuntime): string[] {
  const collapsed: string[] = [];
  for (const faction of runtime.definition.factions) {
    const entity = runtime.store.findEntity(faction.id);
    if (entity === undefined) continue;
    if (runtime.store.readBoolean(faction.id, "collapsed")) continue;
    if (faction.collapseConditions.length === 0) continue;
    const scope: EvalScope = { runtime, actorId: faction.id };
    if (!evaluateAll(faction.collapseConditions, scope)) continue;

    collapsed.push(faction.id);
    runtime.store.withContext(
      { sourceId: faction.id, targetIds: [], tags: ["faction_collapse", faction.id] },
      () => {
        runtime.store.modify(faction.id, "collapsed", "set", true);
        for (const member of agentEntities(runtime)) {
          if (runtime.store.read(member.id, "faction_id") !== faction.id) continue;
          runtime.store.modify(member.id, "faction_id", "set", "");
          const memberRuntime = runtime.state.agentRuntimes[member.id];
          if (memberRuntime !== undefined && !memberRuntime.flags.includes("goal_invalidated")) {
            memberRuntime.flags.push("goal_invalidated");
          }
        }
        // 통제 자원을 놓는다 — 조직이 쥐고 있던 식량이 세계로 풀린다
        runtime.store.modify(faction.id, "food_reserve", "set", 0);
      },
    );
  }
  return collapsed;
}
