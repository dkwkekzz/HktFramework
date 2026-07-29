// §13 공간 — 지역 프로필과 조건부 통행 (G-5)
//
// 두 가지를 본다. ① 지역 정의가 "여기서 무엇이 나는가"를 답한다(그리고 그 답이 실제 배치와 같다)
// ② 같은 두 지역 사이에 길이 둘이면, 조건을 갖춘 주체와 갖추지 못한 주체가 서로 다른 길을 쓴다.
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { buildPlayerWorld, RESIDUE_RIDGE } from "../../content/player-world";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import { canCross, crossableConnectionBetween, travelDuration } from "./ActionSystem";

const SEED = 42;
const PLAYER = "agent.kael";
const VILLAGE = "region.village";
const FOREST = "region.silent_forest";
const BEAST = "creature.echo_beast_mother";

function playerRuntime(): WorldRuntime {
  const runtime = new WorldRuntime(buildPlayerWorld(SEED));
  bootstrapWorld(runtime);
  return runtime;
}

describe("§13 지역 프로필 (G-5)", () => {
  it("지역 정의가 자원 프로필과 종 적합도를 갖는다 — 런타임이 '여기서 무엇이 나는가'를 답한다", () => {
    const definition = buildManualWorld(SEED);
    for (const region of definition.spaces.regions) {
      expect(region.resourceProfiles ?? [], region.id).not.toHaveLength(0);
      expect(Object.keys(region.speciesSuitability ?? {}), region.id).not.toHaveLength(0);
    }
    const forest = definition.spaces.regions.find((region) => region.id === FOREST)!;
    // 침묵림은 위험한 만큼 귀한 것이 난다 (§13 "위험한 지역일수록 희귀한 자원이 많다")
    const village = definition.spaces.regions.find((region) => region.id === VILLAGE)!;
    expect(forest.resourceProfiles![0]!.rarity).toBeGreaterThan(village.resourceProfiles![0]!.rarity);
    expect(forest.speciesSuitability!["species.echo_beast"]).toBeGreaterThan(
      village.speciesSuitability!["species.echo_beast"]!,
    );
  });

  it("프로필의 nodeCount 는 실제 배치와 같다", () => {
    const definition = buildManualWorld(SEED);
    for (const region of definition.spaces.regions) {
      for (const profile of region.resourceProfiles ?? []) {
        const placed = definition.bootstrap.entities.filter(
          (entity) =>
            entity.position?.regionId === region.id && entity.states["resource_id"] === profile.resourceTag,
        ).length;
        expect(placed, `${region.id}/${profile.resourceTag}`).toBe(profile.nodeCount);
      }
    }
  });
});

describe("§13 조건부 통행 (G-5)", () => {
  it("조건을 갖춘 주체에게만 지름길이 열린다", () => {
    const runtime = playerRuntime();
    runtime.store.modify(PLAYER, "known_threat_level", "set", 0);
    expect(canCross(runtime, PLAYER, RESIDUE_RIDGE)).toBe(false);
    runtime.store.modify(PLAYER, "known_threat_level", "set", 90);
    expect(canCross(runtime, PLAYER, RESIDUE_RIDGE)).toBe(true);
  });

  it("열린 주체는 더 싼 길로, 닫힌 주체는 큰길로 간다 (§13 travelCost)", () => {
    const runtime = playerRuntime();
    runtime.store.modify(PLAYER, "known_threat_level", "set", 0);
    const closed = crossableConnectionBetween(runtime, PLAYER, VILLAGE, FOREST);
    const slow = travelDuration(runtime, PLAYER, BEAST);
    runtime.store.modify(PLAYER, "known_threat_level", "set", 90);
    const open = crossableConnectionBetween(runtime, PLAYER, VILLAGE, FOREST);
    const fast = travelDuration(runtime, PLAYER, BEAST);

    expect(closed?.travelCost).toBe(120);
    expect(open?.travelCost).toBe(RESIDUE_RIDGE.travelCost);
    expect(fast!).toBeLessThan(slow!);
  });

  it("조건을 확인할 수 없는 주체에게는 닫힌다 — 모르면 통과가 아니다", () => {
    const runtime = playerRuntime();
    // 조직에는 known_threat_level 상태가 없다(§9) — 조건을 평가할 수 없으면 길은 닫힌 것으로 본다
    expect(canCross(runtime, "faction.silent_village", RESIDUE_RIDGE)).toBe(false);
  });

  it("조건 없는 길은 누구에게나 열린다 (수동 세계는 큰길 하나뿐)", () => {
    const runtime = new WorldRuntime(buildManualWorld(SEED));
    bootstrapWorld(runtime);
    const connection = runtime.index.connection(VILLAGE, FOREST)!;
    expect(connection.requirements).toBeUndefined();
    expect(canCross(runtime, PLAYER, connection)).toBe(true);
  });
});
