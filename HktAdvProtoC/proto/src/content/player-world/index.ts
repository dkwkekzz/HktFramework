// Phase 7 세계 — 수동 세계 + 플레이어 층 (§30 개입 방식 · §32 성장)
//
// **수동 세계를 고치지 않고 덧댄다.** 이유는 하나다:
// Phase 6 이 고정한 §35 합격선(다양성·깊이)은 "플레이어가 없는 30일"의 측정치이고(§35 무개입 판정),
// Phase 4 가 고정한 실행 기준선도 그 세계의 것이다. 여기서 규칙·행동을 더하면 그 기준선이 움직인다.
// 그래서 개입이 필요한 실행만 이 층을 얹어 돌린다 — buildManualWorld(seed) 는 한 글자도 바뀌지 않았다.
//
// 이 층이 더하는 것:
//  · 행동 2 : assist(연구자를 돕는다) / sell_info(상인에게 정보를 판다) — §30 참여 방식 목록의 빈칸
//  · 규칙 8 : 위 두 행동의 실행 규칙 2 + §32 성장 발생 조건 6 (수치 5 + 선택 구조 1)
//  · 능력 2 : §16 형태의 능력 — §32 "새 제약을 받아들이고 출력을 연다"가 붙을 자리
//  · 연결 1 : §13 requirements 를 쓰는 조건부 지름길 — "아는 자에게만 열리는 길"(G-5)
import type { RuleDefinition } from "../../core/rules/RuleTypes";
import { loadRuleDocuments } from "../../core/rules/RuleSchema";
import type {
  AbilityDefinition,
  ActionDefinition,
  SpaceConnection,
  WorldDefinition,
} from "../../core/world/types";
import { buildManualWorld } from "../manual-world";
import abilities from "./abilities.json";
import actions from "./actions.json";
import rules from "./rules.json";

export const PLAYER_WORLD_ID = "world.silent_forest_edge.player";

/**
 * §13 requirements 를 쓰는 길 — "잔재 능선" (G-5).
 * 안개 낀 능선은 숲이 무엇을 하는지 아는 사람만 넘는다. 위험을 아직 모르는 주체(known_threat_level < 85)
 * 에게는 이 길이 보이지 않으므로 큰길로 돌아야 한다 — 정보가 지형이 되는 지점이다(§10 믿음/앎).
 */
export const RESIDUE_RIDGE: SpaceConnection = {
  from: "region.village",
  to: "region.silent_forest",
  travelCost: 110,
  danger: 70,
  capacity: 4,
  requirements: [
    {
      left: { kind: "state", owner: "actor", key: "known_threat_level" },
      operator: ">=",
      right: { kind: "const", value: 85 },
    },
  ],
};
/** 사용자가 조작하는 주체 — §41 세계의 사냥꾼. 새 개체를 만들지 않는다(§31) */
export const DEFAULT_PLAYER_AGENT_ID = "agent.kael";

export function buildPlayerWorldRules(): RuleDefinition[] {
  return loadRuleDocuments([...(rules as unknown[])]);
}

export function buildPlayerWorld(worldSeed: number): WorldDefinition {
  const base = buildManualWorld(worldSeed);
  const added = buildPlayerWorldRules();

  // 성장 규칙은 기존 행동에 붙는다 — executionRules ↔ action_executed 트리거 1:1 규약(§34 정적 검증)을
  // 지키려면 그 행동의 실행 규칙 목록도 함께 늘어나야 한다. 손으로 적지 않고 규칙에서 역산한다.
  const attached = new Map<string, string[]>();
  for (const rule of added) {
    for (const trigger of rule.triggers) {
      if (trigger.type !== "action_executed") continue;
      const list = attached.get(trigger.actionId);
      if (list === undefined) attached.set(trigger.actionId, [rule.id]);
      else list.push(rule.id);
    }
  }
  const extend = (action: ActionDefinition): ActionDefinition => {
    const extra = (attached.get(action.id) ?? []).filter((id) => !action.executionRules.includes(id));
    return extra.length === 0
      ? action
      : { ...action, executionRules: [...action.executionRules, ...extra] };
  };

  return {
    ...base,
    metadata: { ...base.metadata, id: PLAYER_WORLD_ID, title: "침묵림 변두리 — 개입" },
    // §13 조건부 통행 — 아는 자에게만 열리는 지름길 (G-5).
    // 수동 세계의 큰길(travelCost 120)은 그대로 두고 옆에 놓는다. 조건을 갖추지 못한 주체에게
    // 이 길은 없는 것과 같고, 갖춘 주체는 절반 시간에 숲에 닿는다.
    spaces: { ...base.spaces, connections: [...base.spaces.connections, RESIDUE_RIDGE] },
    ruleDefinitions: [...base.ruleDefinitions, ...added],
    actionDefinitions: [
      ...base.actionDefinitions.map(extend),
      ...(actions as unknown as ActionDefinition[]).map(extend),
    ],
    abilitySystem: { abilities: abilities as unknown as AbilityDefinition[] },
  };
}
