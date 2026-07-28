// §31 "실행 가능한 행동만 표시한다" 의 회귀 테스트
//
// 실제 플레이 캡처에서 잡힌 결함: 개인(agent.kael)에게 **조직 전용 행동**이 후보로 올라오고,
// 그것을 고르면 완료 순간 규칙이 조직의 상태를 읽다가 §9 검증에 부딪혀 **세계 진행이 멈췄다**.
// 화면에 보이는 선택지가 세계를 멈추게 하는 일은 없어야 한다.
import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYER_AGENT_ID, buildPlayerWorld } from "../../content/player-world";
import { TICKS_PER_DAY } from "../../shared/time";
import { InlineHost } from "../simulation/InlineHost";
import { playerActionOptions } from "../agents/PlayerAgent";
import { collectActionStateNeeds } from "./actionFeasibility";
import { feasibleOwnerTypes } from "./ruleIndex";

const SEED = 42;
/** 실행 규칙이 조직의 상태를 읽는 행동 — 개인은 끝까지 수행할 수 없다 */
const FACTION_ONLY = ["action.delegate", "action.faction_trade"];

async function attachedRuntime() {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed: SEED, definition: buildPlayerWorld(SEED) });
  await host.request({ type: "attach_player", agentId: DEFAULT_PLAYER_AGENT_ID });
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");
  return { host, runtime };
}

describe("행동 실행 가능성 (§31, §21, §9)", () => {
  it("조직의 상태를 읽는 행동은 조직만 수행 가능하다고 판정된다", async () => {
    const { runtime } = await attachedRuntime();
    for (const actionId of FACTION_ONLY) {
      const action = runtime.index.actions.get(actionId);
      expect(action, actionId).toBeDefined();
      const needs = collectActionStateNeeds(runtime.definition.ruleDefinitions, action!.executionRules);
      expect(needs.actor.length, `${actionId} 요구 상태`).toBeGreaterThan(0);
      expect(feasibleOwnerTypes(runtime, action!, "actor", ["agent", "faction"])).toEqual(["faction"]);
    }
  });

  it("플레이어 후보 목록에 조직 전용 행동이 오르지 않는다", async () => {
    const { runtime } = await attachedRuntime();
    const options = playerActionOptions(runtime, DEFAULT_PLAYER_AGENT_ID);
    expect(options.length).toBeGreaterThan(0);
    expect(options.filter((option) => FACTION_ONLY.includes(option.actionId))).toEqual([]);
  });

  it("표시된 후보를 전부 실행해도 세계가 멈추지 않는다 (사람이 아무 것이나 고른다)", async () => {
    const { host, runtime } = await attachedRuntime();
    const options = playerActionOptions(runtime, DEFAULT_PLAYER_AGENT_ID);
    for (const option of options) {
      const responses = await host.request({
        type: "execute_player_action",
        action: { actionId: option.actionId, targetIds: option.targetIds },
      });
      // 요청이 거절될 수는 있다(그 사이 조건이 변했다). 오류로 세계가 멈추는 것은 안 된다.
      expect(
        responses.filter((response) => response.type === "error"),
        `${option.actionId} → ${option.targetIds.join(",")}`,
      ).toEqual([]);
      // 그 행동이 완료될 만큼 시간을 민다 — 실행 규칙은 완료 시점에 돈다
      const advanced = await host.request({ type: "advance_time", amount: TICKS_PER_DAY });
      expect(
        advanced.filter((response) => response.type === "error"),
        `${option.actionId} 완료 처리`,
      ).toEqual([]);
    }
    expect(runtime.state.simulationTime).toBeGreaterThan(0);
  }, 120_000);

  it("조직은 위임을 수행할 수 있다 (필터가 조직의 행동을 막지 않는다)", async () => {
    const { runtime } = await attachedRuntime();
    const delegate = runtime.index.actions.get("action.delegate");
    expect(feasibleOwnerTypes(runtime, delegate!, "actor", ["faction"])).toEqual(["faction"]);
  });
});
