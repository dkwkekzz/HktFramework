// Phase 1 완료 조건 (DoD) — 플레이어 없이 30일이 흐른 세계를 검사한다.
// 여기서 검증하는 것은 "무엇이 일어나도록 작성했는가"가 아니라 "무엇이 일어났는가"다.
import { describe, expect, it } from "vitest";
import { findBelief } from "../agents/BeliefStore";
import { hashValue } from "../../shared/hash";
import type { RawWorldChange } from "../../shared/change";
import { TICKS_PER_DAY, tickToDay } from "../../shared/time";
import type { WorldRuntime } from "../world/WorldRuntime";
import { InlineHost } from "./InlineHost";

const BEAST = "creature.echo_beast_mother";
const VILLAGE = "faction.silent_village";
const AGENTS = ["agent.kael", "agent.mar", "agent.ren", "agent.rion", BEAST];

async function run(days: number, worldSeed = 42): Promise<WorldRuntime> {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed });
  await host.request({ type: "advance_time", amount: days * TICKS_PER_DAY });
  const runtime = host.server.inspectRuntime();
  if (runtime === undefined) throw new Error("런타임 없음");
  return runtime;
}

/** 조건을 만족하는 첫 변화의 시각. 없으면 undefined */
function firstTime(log: RawWorldChange[], match: (change: RawWorldChange) => boolean): number | undefined {
  return log.find(match)?.time;
}

function changed(change: RawWorldChange, entityId: string, stateKey: string): boolean {
  return change.changedStates.some((s) => s.entityId === entityId && s.stateKey === stateKey);
}

describe("Phase 1 DoD — 수동 세계 30일", () => {
  it("플레이어 없이 5명 전원이 목적에 따라 1회 이상 행동한다 (§35, §44-5)", async () => {
    const runtime = await run(30);
    for (const agentId of AGENTS) {
      const agent = runtime.agentRuntime(agentId);
      expect(agent.completedActionCount, `${agentId} 가 아무것도 하지 않았다`).toBeGreaterThan(0);
    }
    // 목적이 실제로 행동을 골랐는지 — 로그에 목적 id 가 함께 남는다
    const withGoal = runtime.state.changeLog.filter((c) => c.tags.some((t) => t.startsWith("goal.")));
    expect(withGoal.length).toBeGreaterThan(0);
  });

  it("아무도 작성하지 않은 순서로 연쇄가 발생한다 (§44-13)", async () => {
    const log = (await run(30)).state.changeLog;

    // ① 마을 식량이 줄어든다 (하루 주기 규칙)
    const foodDrop = firstTime(
      log,
      (c) => c.tags.includes("rule.village_food_consumption") && changed(c, VILLAGE, "food_reserve"),
    );
    // ② 사냥꾼이 숲의 채집지까지 나간다
    const forestHunt = firstTime(
      log,
      (c) =>
        c.sourceId === "agent.kael" &&
        c.tags.includes("action.hunt") &&
        c.targetIds.includes("resource_node.grove_food"),
    );
    // ③ 숲에서 반향수와 접촉한다
    const attacked = firstTime(
      log,
      (c) => c.sourceId === BEAST && c.tags.includes("action.attack") && changed(c, "agent.kael", "health"),
    );
    // ④ 공포가 오른다 (위협 목격 → 공포 규칙)
    const fear = firstTime(
      log,
      (c) => c.tags.includes("rule.threat_sighting_fear") && changed(c, "agent.kael", "fear"),
    );
    // ⑤ 마을에 보고되어 조직의 믿음이 바뀐다
    const reported = firstTime(
      log,
      (c) => c.tags.includes("action.report") && changed(c, VILLAGE, "threat_belief"),
    );
    // ⑥ 토벌이 소집된다 (위협 믿음 + 식량 부족이 겹칠 때만)
    const subjugation = firstTime(
      log,
      (c) => c.tags.includes("rule.subjugation_call") && changed(c, VILLAGE, "subjugation_ordered"),
    );

    for (const [label, time] of Object.entries({ foodDrop, forestHunt, attacked, fear, reported, subjugation })) {
      expect(time, `${label} 이 일어나지 않았다`).toBeDefined();
    }
    // 순서는 "일" 단위로 본다. Phase 3 이후 정보는 목격 말고도 소문·조직 보고로 흐르므로(§23)
    // 공포와 보고는 직접 목격보다 앞설 수 있다 — 연쇄의 척추(식량 부족 → 사냥 → 접촉 → 소집)는 그대로다.
    const day = (tick: number): number => tickToDay(tick);
    expect(day(foodDrop!)).toBeLessThanOrEqual(day(forestHunt!));
    expect(day(forestHunt!)).toBeLessThanOrEqual(day(attacked!));
    expect(day(attacked!)).toBeLessThanOrEqual(day(subjugation!));
    expect(day(fear!)).toBeLessThanOrEqual(day(subjugation!));
    expect(day(reported!)).toBeLessThanOrEqual(day(subjugation!));
  });

  it("반향수의 실제 상태와 마을 사람의 믿음이 분리 저장된다 (§10 예시 재현)", async () => {
    const runtime = await run(30);

    // 실제: 공격적이지 않고, 새끼를 지키는 중이다
    expect(runtime.store.readNumber(BEAST, "aggression")).toBeLessThan(50);
    expect(runtime.store.readBoolean(BEAST, "protecting_offspring")).toBe(true);

    // 마을 사람의 믿음: 공격적이다
    for (const villager of ["agent.kael", "agent.mar", "agent.ren"]) {
      const belief = findBelief(runtime.agentRuntime(villager), BEAST, "aggression");
      expect(belief?.believedValue).toBe(90);
      // Phase 3 부터 확신은 소문 경로를 지나며 전달자 신뢰만큼 깎인다 (§23·§25) —
      // 값은 그대로 90 이지만 "얼마나 확신하는가"는 직접 관찰보다 낮다.
      expect(belief?.confidence).toBeGreaterThan(0.1);
    }

    // 연구자의 믿음: 새끼를 지키는 중이다 — 같은 생물, 다른 결론
    const researcherBelief = findBelief(
      runtime.agentRuntime("agent.rion"),
      BEAST,
      "protecting_offspring",
    );
    expect(researcherBelief?.believedValue).toBe(true);
    // 근거는 관찰 신호다 — 잔재 흔적이든 현장 기록이든, 소문이 아니라 자기 눈으로 본 것에서 왔다
    expect(
      researcherBelief?.sourceIds.every(
        (id) => id.startsWith("signal.residue_trace") || id.startsWith("signal.field_notes"),
      ),
    ).toBe(true);

    // 관찰 불가 상태(새끼 위협도)는 누구의 믿음에도 새지 않는다 (§9 observable=false)
    for (const agentId of AGENTS) {
      expect(findBelief(runtime.agentRuntime(agentId), BEAST, "offspring_threat")).toBeUndefined();
    }
  });

  it("동일 시드 재실행 시 30일 로그가 동일하다 (§44-12)", async () => {
    const a = await run(30);
    const b = await run(30);
    expect(hashValue(a.state.changeLog)).toBe(hashValue(b.state.changeLog));
    expect(a.state.changeLog.length).toBeGreaterThan(100);

    const other = await run(30, 43);
    expect(hashValue(other.state.changeLog)).not.toBe(hashValue(a.state.changeLog));
  });

  it("자원은 소비되고 재생한다 — 세계가 한 방향으로만 흐르지 않는다 (§14)", async () => {
    const runtime = await run(30);
    const log = runtime.state.changeLog;
    const consumed = log.some(
      (c) => c.tags.includes("rule.hunt_yield") && changed(c, "resource_node.grove_food", "amount"),
    );
    const regrown = log.some((c) => c.tags.includes("rule.forest_resource_regrowth"));
    const beastFed = log.some((c) => c.tags.includes("rule.echo_beast_feeding"));
    expect(consumed).toBe(true);
    expect(regrown).toBe(true);
    expect(beastFed).toBe(true);
    // 마을은 굶어 죽지 않았다 — 사냥·거래가 소비를 따라잡는다
    expect(runtime.store.readNumber(VILLAGE, "food_reserve")).toBeGreaterThan(0);
  });

  it("행동은 시간을 점유하고 지역 이동은 연결 비용을 따른다 (§13, §21)", async () => {
    const runtime = await run(30);
    const moves = runtime.state.changeLog.filter(
      (c) => c.tags.includes("action.move") && c.changedStates.some((s) => s.stateKey === "position"),
    );
    expect(moves.length).toBeGreaterThan(0);
    // 지역을 넘는 이동이 실제로 일어났다
    const crossed = moves.some((c) =>
      c.changedStates.some(
        (s) =>
          s.stateKey === "position" &&
          (s.before as { regionId?: string } | undefined)?.regionId !==
            (s.after as { regionId?: string }).regionId,
      ),
    );
    expect(crossed).toBe(true);
  });
});
