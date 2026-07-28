// Phase 7 DoD — 플레이어 개입 (§30, §31, §32, §21)
//
// 측정은 전부 phase7Checks 가 한다 — verify 스크립트의 보고와 이 테스트가 같은 수를 본다.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PLAYER_AGENT_ID, buildPlayerWorld } from "../../content/player-world";
import { isPlayerState, type PlayerRuntimeState } from "../../shared/player";
import { TICKS_PER_DAY } from "../../shared/time";
import { InlineHost } from "../simulation/InlineHost";
import { shouldReplan } from "./AgentRuntime";
import {
  PARTICIPATION_MODES,
  PLAYER_FREE_MODULES,
  findPlayerBranches,
  runPlayerScenario,
  type PlayerScenarioResult,
} from "./phase7Checks";
import { buildPlayerKnowledgeView, playerActionOptions } from "./PlayerAgent";

const SEED = 42;
const DAYS = 30;
const BEAST = "creature.echo_beast_mother";

async function attachedHost(): Promise<InlineHost> {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed: SEED, definition: buildPlayerWorld(SEED) });
  await host.request({ type: "attach_player", agentId: DEFAULT_PLAYER_AGENT_ID });
  return host;
}

describe("§31 플레이어 = 하나의 주체", () => {
  it("조작을 시작해도 새 개체가 생기지 않는다 — 살던 주체가 그대로 플레이어가 된다", async () => {
    const host = new InlineHost();
    await host.request({ type: "initialize_world", worldSeed: SEED, definition: buildPlayerWorld(SEED) });
    const runtime = host.server.inspectRuntime()!;
    const before = Object.keys(runtime.state.entities).length;
    const beliefsBefore = runtime.agentRuntime(DEFAULT_PLAYER_AGENT_ID).beliefs.length;

    await host.request({ type: "attach_player", agentId: DEFAULT_PLAYER_AGENT_ID });
    const player = runtime.agentRuntime(DEFAULT_PLAYER_AGENT_ID);
    expect(Object.keys(runtime.state.entities).length).toBe(before);
    expect(isPlayerState(player)).toBe(true);
    expect(player.beliefs.length).toBe(beliefsBefore);
    expect((player as PlayerRuntimeState).discoveredEntityIds.length).toBeGreaterThan(0);
  });

  it("조직은 조작할 수 없다 (§17 조직에는 눈이 없다)", async () => {
    const host = new InlineHost();
    await host.request({ type: "initialize_world", worldSeed: SEED, definition: buildPlayerWorld(SEED) });
    const responses = await host.request({ type: "attach_player", agentId: "faction.silent_village" });
    expect(responses.find((r) => r.type === "error")).toBeDefined();
  });

  it("판단 분기 — 시스템은 플레이어의 행동을 고르지 않는다", async () => {
    const host = await attachedHost();
    const runtime = host.server.inspectRuntime()!;
    expect(shouldReplan(runtime, DEFAULT_PLAYER_AGENT_ID)).toBe(false);
    expect(shouldReplan(runtime, "agent.rion")).toBe(true);
  });

  it("표시 목록은 '지금 실행 가능한 것'으로 잘린다 — 모든 행동 버튼이 나오지 않는다", async () => {
    const host = await attachedHost();
    const runtime = host.server.inspectRuntime()!;
    const options = playerActionOptions(runtime, DEFAULT_PLAYER_AGENT_ID);
    const offered = new Set(options.map((option) => option.actionId));
    expect(options.length).toBeGreaterThan(0);
    expect(offered.size).toBeLessThan(runtime.definition.actionDefinitions.length);
    // 아는 것이 없으면 팔 것도 없다 — actorRequirements(known_threat_level ≥ 10)가 NPC 와 같게 걸린다
    expect(runtime.store.readNumber(DEFAULT_PLAYER_AGENT_ID, "known_threat_level")).toBeLessThan(10);
    expect(offered.has("action.sell_info")).toBe(false);
    expect(offered.has("action.report")).toBe(false);
    // 점수순 정렬만 하고 자르지 않는다 (선택은 사용자 몫)
    const scores = options.map((option) => option.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("지금 할 수 없는 행동 요청은 사유와 함께 거절된다 (§7.3 요청 검증)", async () => {
    const host = await attachedHost();
    const responses = await host.request({
      type: "execute_player_action",
      // 아직 아무것도 모르는 사냥꾼은 정보를 팔 수 없다 (§31 "지식으로 실행 가능한 행동만")
      action: { actionId: "action.sell_info", targetIds: ["agent.ren"] },
    });
    const result = responses.find((r) => r.type === "player_action_result");
    expect(result?.type === "player_action_result" && result.outcome.accepted).toBe(false);
    const runtime = host.server.inspectRuntime()!;
    const player = runtime.agentRuntime(DEFAULT_PLAYER_AGENT_ID) as PlayerRuntimeState;
    expect(player.journal.some((entry) => entry.kind === "action_rejected")).toBe(true);
  });

  it("수락된 행동은 NPC 와 같은 경로로 비용을 물고 예약된다 (§27-7·8)", async () => {
    const host = await attachedHost();
    const runtime = host.server.inspectRuntime()!;
    const option = playerActionOptions(runtime, DEFAULT_PLAYER_AGENT_ID).find(
      (candidate) => candidate.actionId === "action.observe" || candidate.actionId === "action.move",
    )!;
    const energyBefore = runtime.store.readNumber(DEFAULT_PLAYER_AGENT_ID, "energy");
    const responses = await host.request({
      type: "execute_player_action",
      action: { actionId: option.actionId, targetIds: option.targetIds },
    });
    const result = responses.find((r) => r.type === "player_action_result");
    expect(result?.type === "player_action_result" && result.outcome.accepted).toBe(true);
    expect(runtime.agentRuntime(DEFAULT_PLAYER_AGENT_ID).currentAction?.actionId).toBe(option.actionId);
    const costs = runtime.index.actions.get(option.actionId)!.costs;
    const energyCost = costs.find((cost) => cost.stateKey === "energy")?.amount ?? 0;
    expect(runtime.store.readNumber(DEFAULT_PLAYER_AGENT_ID, "energy")).toBe(energyBefore - energyCost);
  });
});

describe("§30 개입 — 30일 조작 시나리오", () => {
  let active: PlayerScenarioResult;
  let passive: PlayerScenarioResult;

  beforeAll(async () => {
    active = await runPlayerScenario({ worldSeed: SEED, days: DAYS });
    passive = await runPlayerScenario({ worldSeed: SEED, days: DAYS, passive: true });
  }, 120_000);

  it("§30 참여 방식 4개 이상을 실제 조작으로 수행한다", () => {
    expect(active.performedModes.length).toBeGreaterThanOrEqual(4);
    expect(active.performedModes.every((mode) => PARTICIPATION_MODES.some((entry) => entry.mode === mode))).toBe(true);
  });

  it("'아무것도 하지 않는다'도 유효하다 — 세계는 계속 변한다 (§44-5)", () => {
    expect(passive.completedActionCount).toBe(0);
    expect(passive.changeCount).toBeGreaterThan(0);
    expect(passive.eventCount).toBeGreaterThan(0);
    // 개입은 세계를 가른다
    expect(active.logHash).not.toBe(passive.logHash);
  });

  it("같은 사건에 전투·협상·정보·거래 개입이 모두 존재한다 (§44-8)", () => {
    expect(active.intervention?.categories).toEqual(["거래", "전투", "정보", "협상"]);
  });

  it("화면 데이터가 믿음·감각을 넘지 않는다 (§36.3 플레이어 모드)", () => {
    expect(active.leaks).toEqual([]);
    expect(active.hiddenLeaks).toEqual([]);
    // 막을 것이 실제로 있었다는 증거 — 관찰 불가 상태가 세계에 여럿 있고 하나도 실리지 않았다
    expect(active.hiddenStateCount).toBeGreaterThan(0);
    expect(active.hiddenExposedCount).toBe(0);
    // 그리고 화면은 실제값이 아니라 믿음값을 보여준다 (§10)
    const beast = active.beliefProbes.find((probe) => probe.subjectId === BEAST && probe.stateKey === "aggression");
    expect(beast).toBeDefined();
    expect(beast!.real).not.toBe(beast!.shown);
  });

  it("플레이어 개입이 사건 결과·관계·후속 목적으로 남는다 (§44-9·10)", () => {
    expect(active.consequence).toBeDefined();
    expect(active.consequence!.netChangedStates).toBeGreaterThan(0);
    expect(active.consequence!.newGoals.length).toBeGreaterThan(0);
    expect(active.consequence!.relationshipShifts.length).toBeGreaterThan(0);
  });

  it("저널이 관찰·행동·사건·성장을 시간순으로 기록한다 (§31)", () => {
    expect(active.journalKinds["action"]).toBeGreaterThan(0);
    expect(active.journalKinds["observation"]).toBeGreaterThan(0);
    expect(active.journalKinds["event"]).toBeGreaterThan(0);
    const times = active.finalView.journal.map((entry) => entry.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("§32 성장 — 수치 증가와 선택 구조가 함께 있고 전부 출처 사건을 갖는다", () => {
    expect(active.growth.length).toBeGreaterThan(0);
    expect(active.growth.every((change) => change.sourceEventId.length > 0)).toBe(true);
    expect(active.growth.some((change) => typeof change.newValue === "number")).toBe(true);
    // 선택 구조 — 제약을 받아들이고 능력의 출력이 열린다 (§32 능력 성장 예시)
    expect(active.acceptedOffer).toBeDefined();
    expect(active.acceptedOffer!.abilityAfter.restrictions).toBeGreaterThan(
      active.acceptedOffer!.abilityBefore.restrictions,
    );
    expect(active.acceptedOffer!.abilityAfter.outputMax).toBeGreaterThan(
      active.acceptedOffer!.abilityBefore.outputMax,
    );
    // §21 비분리 — 같은 규칙으로 NPC 도 자란다
    expect(active.npcGrowth.length).toBeGreaterThan(0);
  });

  it("플레이어 행동이 NPC 와 같은 규칙 경로로 처리된다 (§21, 전용 효과 코드 없음)", () => {
    expect(active.executionPaths.length).toBeGreaterThan(0);
    expect(active.executionPaths.every((entry) => entry.same)).toBe(true);
    const sources = PLAYER_FREE_MODULES.map((relative) => ({
      path: relative,
      source: readFileSync(new URL(relative, import.meta.url), "utf8"),
    }));
    expect(findPlayerBranches(sources)).toEqual([]);
  });

  it("같은 시드·같은 조작 → 같은 세계 (§44-12)", async () => {
    const again = await runPlayerScenario({ worldSeed: SEED, days: DAYS });
    expect(again.logHash).toBe(active.logHash);
    const other = await runPlayerScenario({ worldSeed: SEED + 1, days: DAYS });
    expect(other.logHash).not.toBe(active.logHash);
  }, 120_000);
});

describe("§38 플레이어 프로토콜", () => {
  it("advance_time 응답에 지식 필터를 통과한 player_view 가 함께 실린다", async () => {
    const host = await attachedHost();
    const responses = await host.request({ type: "advance_time", amount: TICKS_PER_DAY });
    const view = responses.find((r) => r.type === "player_view");
    expect(view?.type === "player_view" && view.view.playerId).toBe(DEFAULT_PLAYER_AGENT_ID);
  });

  it("detach 하면 그 주체는 다시 스스로 판단한다", async () => {
    const host = await attachedHost();
    await host.request({ type: "detach_player" });
    const runtime = host.server.inspectRuntime()!;
    expect(isPlayerState(runtime.agentRuntime(DEFAULT_PLAYER_AGENT_ID))).toBe(false);
    await host.request({ type: "advance_time", amount: 3 * TICKS_PER_DAY });
    expect(runtime.agentRuntime(DEFAULT_PLAYER_AGENT_ID).completedActionCount).toBeGreaterThan(0);
  });

  it("조작 주체가 없는 세계는 player_view 를 내보내지 않는다", async () => {
    const host = new InlineHost();
    await host.request({ type: "initialize_world", worldSeed: SEED, definition: buildPlayerWorld(SEED) });
    const responses = await host.request({ type: "advance_time", amount: TICKS_PER_DAY });
    expect(responses.some((r) => r.type === "player_view")).toBe(false);
    // 조작 중이 아닌 주체로는 화면 데이터를 만들 수 없다 — 우회로가 없다는 뜻이다
    const runtime = host.server.inspectRuntime()!;
    expect(() => buildPlayerKnowledgeView(runtime, DEFAULT_PLAYER_AGENT_ID)).toThrow();
  });
});
