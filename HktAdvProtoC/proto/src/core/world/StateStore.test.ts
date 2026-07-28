// DoD: "모든 상태 쓰기가 스키마 검증을 통과한다(미등록 키 쓰기 테스트는 실패해야 함)" (Phase-1 §1.1)
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { bootstrapWorld } from "./WorldBootstrap";
import { WorldRuntime } from "./WorldRuntime";

function newRuntime(): WorldRuntime {
  const runtime = new WorldRuntime(buildManualWorld(1));
  bootstrapWorld(runtime);
  return runtime;
}

describe("StateStore — 상태 쓰기의 단일 경로 (§9)", () => {
  it("등록되지 않은 stateKey 는 쓸 수 없다", () => {
    const store = newRuntime().store;
    expect(() => store.modify("agent.kael", "mana", "set", 10)).toThrow(/등록되지 않은 상태/);
  });

  it("등록되지 않은 stateKey 는 읽을 수도 없다", () => {
    const store = newRuntime().store;
    expect(() => store.read("agent.kael", "mana")).toThrow(/등록되지 않은 상태/);
  });

  it("소유자 종류가 다르면 같은 이름이어도 다른 스키마다", () => {
    const store = newRuntime().store;
    // food_reserve 는 조직의 상태다 — 주체에게는 등록되어 있지 않다
    expect(() => store.modify("agent.kael", "food_reserve", "set", 10)).toThrow();
    expect(() => store.modify("faction.silent_village", "food_reserve", "add", 5)).not.toThrow();
  });

  it("파생 상태는 쓸 수 없고, 읽기 시점에 계산된다 (§9 updatePolicy=derived)", () => {
    const store = newRuntime().store;
    expect(() => store.modify("agent.kael", "survivalPressure", "set", 50)).toThrow(/파생 상태/);

    store.modify("agent.kael", "hunger", "set", 100);
    store.modify("agent.kael", "health", "set", 0);
    expect(store.readNumber("agent.kael", "survivalPressure")).toBe(100);
    store.modify("agent.kael", "hunger", "set", 0);
    store.modify("agent.kael", "health", "set", 100);
    expect(store.readNumber("agent.kael", "survivalPressure")).toBe(0);
  });

  it("파생 상태는 다른 파생 상태를 참조할 수 있다 (stress ← survivalPressure)", () => {
    const store = newRuntime().store;
    store.modify("agent.kael", "fear", "set", 100);
    store.modify("agent.kael", "hunger", "set", 100);
    store.modify("agent.kael", "health", "set", 0);
    expect(store.readNumber("agent.kael", "stress")).toBe(100);
  });

  it("타입이 다르면 오류, 범위를 벗어나면 경계로 고정된다", () => {
    const store = newRuntime().store;
    expect(() => store.modify("agent.kael", "hunger", "set", "많이")).toThrow(/타입 불일치/);
    store.modify("agent.kael", "hunger", "set", 999);
    expect(store.readNumber("agent.kael", "hunger")).toBe(100);
    store.modify("agent.kael", "hunger", "add", -999);
    expect(store.readNumber("agent.kael", "hunger")).toBe(0);
  });

  it("변경은 §28 RawWorldChange 로 기록되고 맥락 태그를 물려받는다", () => {
    const runtime = newRuntime();
    const before = runtime.state.changeLog.length;
    runtime.store.withContext({ sourceId: "agent.kael", tags: ["action", "action.eat"] }, () => {
      runtime.store.withContext({ tags: ["rule", "rule.eat_effect"] }, () => {
        runtime.store.modify("agent.kael", "hunger", "add", -10);
      });
    });
    const record = runtime.state.changeLog[runtime.state.changeLog.length - 1]!;
    expect(runtime.state.changeLog.length).toBe(before + 1);
    expect(record.tags).toEqual(["action", "action.eat", "rule", "rule.eat_effect"]);
    expect(record.changedStates[0]).toMatchObject({ entityId: "agent.kael", stateKey: "hunger" });
  });

  it("값이 실제로 바뀌지 않으면 기록도 트리거도 남기지 않는다", () => {
    const runtime = newRuntime();
    runtime.store.takeStateChanges();
    const before = runtime.state.changeLog.length;
    const current = runtime.store.readNumber("agent.kael", "hunger");
    runtime.store.modify("agent.kael", "hunger", "set", current);
    expect(runtime.state.changeLog.length).toBe(before);
    expect(runtime.store.takeStateChanges()).toEqual([]);
  });

  it("state_changed 큐는 가져가면 비워진다 (§11.1 트리거 디스패치)", () => {
    const runtime = newRuntime();
    runtime.store.takeStateChanges();
    runtime.store.modify("agent.kael", "fear", "add", 5);
    expect(runtime.store.takeStateChanges()).toHaveLength(1);
    expect(runtime.store.takeStateChanges()).toHaveLength(0);
  });

  it("초기 배치는 등록된 상태만 채우고 나머지는 스키마 기본값이다", () => {
    const runtime = newRuntime();
    const beast = runtime.store.entity("creature.echo_beast_mother");
    expect(beast.states["aggression"]).toBe(12); // 초기 배치가 지정한 값
    expect(beast.states["wealth"]).toBe(0); // 지정하지 않은 값은 스키마 기본값
    expect(beast.states["survivalPressure"]).toBeUndefined(); // 파생 상태는 저장되지 않는다
  });
});
