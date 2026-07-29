// §25 knownSecrets (G-8) — 기록·중복 제거·지렛대 소비
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../../content/manual-world";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import { recordSecret, secretsAbout } from "./RelationshipSystem";
import { measureSecrets } from "./secretChecks";

function fresh(): WorldRuntime {
  const runtime = new WorldRuntime(buildManualWorld(42));
  bootstrapWorld(runtime);
  return runtime;
}

describe("§25 knownSecrets (G-8)", () => {
  it("기록은 관계 원장에 남고 같은 문구는 한 번만 남는다", () => {
    const runtime = fresh();
    expect(recordSecret(runtime, "agent.kael", "agent.mar", "비밀")).toBe(true);
    expect(recordSecret(runtime, "agent.kael", "agent.mar", "비밀")).toBe(false);
    expect(secretsAbout(runtime, "agent.kael", "agent.mar")).toEqual(["비밀"]);
    // 비대칭 — 아는 쪽만 안다
    expect(secretsAbout(runtime, "agent.mar", "agent.kael")).toEqual([]);
  });

  it("초기 비밀·발각의 기록·협박의 지렛대가 전부 실측된다", () => {
    const measures = measureSecrets(42);
    expect(measures.initialSecrets.length, "초기 관계 선언의 비밀").toBeGreaterThan(0);
    expect(measures.secretsFromLies, "발각이 남긴 비밀").toBeGreaterThan(0);
    expect(measures.fearWithSecret, "비밀을 쥔 협박이 더 깊다").toBeGreaterThan(measures.fearWithoutSecret);
  });
});
