// §18 초기 기억·소지품 (G-7) — 선언이 아니라 실행 상태로 시작하는가
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import { measureInitialMemories, measureInventory } from "./initialStateChecks";

describe("§18 초기 기억·소지품 (G-7)", () => {
  it("개인 전원이 초기 기억을 갖고, 모든 초기 믿음에 지지 기억이 있고, 태그로 소환된다", () => {
    const rows = measureInitialMemories(42);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.ok, `${row.agentId}: ${row.evidence}`).toBe(true);
  });

  it("소지품 선언이 carryStateKey 상태로 변환된다 — 거래 규칙이 읽는 바로 그 키다", () => {
    const rows = measureInventory(42);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.ok, `${row.agentId} ${row.resourceId} → ${row.stateKey}: ${row.declared} vs ${row.stored}`).toBe(true);
    }
    // 수동 세계의 소지 상태는 이제 states 직접 지정이 아니라 inventory 선언에서 온다
    const definition = buildManualWorld(42);
    const carryKeys = new Set(definition.resources.map((resource) => resource.carryStateKey));
    for (const entity of definition.bootstrap.entities) {
      for (const key of Object.keys(entity.states)) {
        expect(carryKeys.has(key), `${entity.id}.${key} 는 inventory 로 선언해야 한다`).toBe(false);
      }
    }
  });

  it("없는 자원·지닐 수 없는 자원을 소지하면 부트스트랩이 즉시 오류다", () => {
    const phantom = structuredClone(buildManualWorld(42));
    phantom.bootstrap.entities.find((entity) => entity.id === "agent.kael")!.inventory = [
      { resourceId: "resource.phantom", quantity: 1 },
    ];
    expect(() => bootstrapWorld(new WorldRuntime(phantom))).toThrowError(/없는 자원/);

    const uncarriable = structuredClone(buildManualWorld(42));
    delete uncarriable.resources.find((resource) => resource.id === "resource.food")!.carryStateKey;
    expect(() => bootstrapWorld(new WorldRuntime(uncarriable))).toThrowError(/carryStateKey/);
  });
});
