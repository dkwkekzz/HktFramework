// 공간 데이터 3D ↔ 렌더 2D 투영 경계 검증 (§13 개정, Phase 0 §0.6)
import { describe, expect, it } from "vitest";
import { distance3d, type EntityState } from "../shared/state";
import { ViewModelBuilder } from "./ViewModelBuilder";

function entityAt(id: string, x: number, y: number, z: number): EntityState {
  return {
    id,
    type: "agent",
    position: { regionId: "region.test", x, y, z },
    states: { health: 70 },
    tags: [],
  };
}

describe("3D 공간 데이터와 2D 투영", () => {
  it("시뮬레이션 좌표는 3D 로 저장된다", () => {
    const entity = entityAt("agent.a", 1, 2, 3);
    expect(entity.position).toEqual({ regionId: "region.test", x: 1, y: 2, z: 3 });
  });

  it("distance3d 는 z 축을 무시하지 않는다", () => {
    const flat = distance3d(entityAt("a", 0, 0, 0).position!, entityAt("b", 3, 4, 0).position!);
    const withZ = distance3d(entityAt("a", 0, 0, 0).position!, entityAt("b", 3, 4, 12).position!);
    expect(flat).toBe(5);
    expect(withZ).toBe(13);
  });

  it("빌더가 3D→2D 투영하고 z 는 elevation 표시 속성이 된다", () => {
    const builder = new ViewModelBuilder();
    builder.markInitialized();
    builder.applyPatch({
      time: 0,
      upserts: [entityAt("agent.a", 41, 18, 3)],
      removedIds: [],
    });
    const scene = builder.buildScene();
    expect(scene.entities).toHaveLength(1);
    // 렌더러가 받는 position 은 2D 투영 — z 필드가 없어야 한다
    expect(scene.entities[0]!.position).toEqual({ regionId: "region.test", x: 41, y: 18 });
    expect(scene.entities[0]!.elevation).toBe(3);
  });
});
