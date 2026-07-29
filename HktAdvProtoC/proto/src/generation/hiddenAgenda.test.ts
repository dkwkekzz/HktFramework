// G-3 — §17 은닉 목적의 실행 연결(faction.hidden)과 관찰자 시점 금지 사실(§30, §33.3)
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../content/manual-world";
import { bootstrapWorld } from "../core/world/WorldBootstrap";
import { WorldRuntime } from "../core/world/WorldRuntime";
import { buildObservationNarration } from "../viewmodel/NarrationBuilder";
import { validateWorld } from "./WorldValidator";

function checkOf(definition: ReturnType<typeof buildManualWorld>, code: string) {
  return validateWorld(definition).checks.find((check) => check.code === code);
}

describe("faction.hidden — 은닉 목적은 실행 목적에 연결된다 (§17, G-3)", () => {
  it("수동 세계는 통과한다 — 은닉 목적 보유 조직 전부가 연결됐다", () => {
    const check = checkOf(buildManualWorld(1), "faction.hidden");
    expect(check?.ok).toBe(true);
    expect(check?.inspected).toBeGreaterThanOrEqual(2); // silent_village · research_society
  });

  it("연결 없는 은닉 목적은 error 다", () => {
    const definition = structuredClone(buildManualWorld(1));
    delete definition.factions.find((f) => f.id === "faction.silent_village")?.hiddenGoalIds;
    const check = checkOf(definition, "faction.hidden");
    expect(check?.ok).toBe(false);
    expect(check?.issues.some((entry) => entry.targetId === "faction.silent_village")).toBe(true);
  });

  it("그래프에 없는 목적을 가리키면 error 다", () => {
    const definition = structuredClone(buildManualWorld(1));
    const faction = definition.factions.find((f) => f.id === "faction.silent_village");
    if (faction !== undefined) faction.hiddenGoalIds = ["goal.no_such_goal"];
    const check = checkOf(definition, "faction.hidden");
    expect(check?.ok).toBe(false);
    expect(check?.issues[0]?.message).toContain("goal.no_such_goal");
  });
});

describe("은닉 목적은 외부 관찰자의 금지 사실이 된다 (§30, §33.3)", () => {
  function newRuntime(): WorldRuntime {
    const runtime = new WorldRuntime(structuredClone(buildManualWorld(1)));
    bootstrapWorld(runtime);
    return runtime;
  }

  it("외부 관찰자(kael)의 조직 관찰 요청에 은닉 목적이 금지 사실로 실린다", () => {
    const runtime = newRuntime();
    const request = buildObservationNarration(runtime, "agent.kael", "faction.research_society");
    const sentences = request.unknownFacts.map((fact) => fact.sentence);
    expect(sentences.some((sentence) => sentence.includes("실제 목적"))).toBe(true);
    expect(sentences.some((sentence) => sentence.includes("몰래 좇는 목적"))).toBe(true);
    // 조직의 이름 자체는 공개 정보다 — identityLabel 로 이름을 금지하지 않는다
    expect(
      request.unknownFacts
        .filter((fact) => fact.sentence.includes("실제 목적"))
        .every((fact) => fact.identityLabel === undefined),
    ).toBe(true);
  });

  it("내부자(mar — 마을 소속)는 자기 조직의 은닉 목적을 금지당하지 않는다", () => {
    const runtime = newRuntime();
    expect(runtime.store.read("agent.mar", "faction_id")).toBe("faction.silent_village");
    const request = buildObservationNarration(runtime, "agent.mar", "faction.silent_village");
    expect(request.unknownFacts.every((fact) => !fact.sentence.includes("실제 목적"))).toBe(true);
  });
});
