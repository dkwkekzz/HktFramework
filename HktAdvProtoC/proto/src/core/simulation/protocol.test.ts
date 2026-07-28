// DoD: "브라우저에서 Worker 로 advance_time → state_patch 왕복" 의 코어 측 검증.
// (실 브라우저 왕복은 scripts/smoke.mjs 가 실 Chromium 으로 검증한다 — 같은 RuntimeServer 코드)
import { describe, expect, it } from "vitest";
import type { WorkerResponse } from "../../shared/protocol";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "../../shared/time";
import { ViewModelBuilder } from "../../viewmodel/ViewModelBuilder";
import { InlineHost } from "./InlineHost";

function pick<T extends WorkerResponse["type"]>(
  responses: WorkerResponse[],
  type: T,
): Extract<WorkerResponse, { type: T }> {
  const found = responses.find((r) => r.type === type);
  if (found === undefined) throw new Error(`응답 없음: ${type}`);
  return found as Extract<WorkerResponse, { type: T }>;
}

describe("§38 프로토콜", () => {
  it("initialize_world → world_initialized + 전체 state_patch", async () => {
    const host = new InlineHost();
    const responses = await host.request({ type: "initialize_world", worldSeed: 42 });
    expect(pick(responses, "world_initialized").worldSeed).toBe(42);
    expect(pick(responses, "state_patch").patch.time).toBe(0);
  });

  it("advance_time → 변경분만 담긴 state_patch", async () => {
    const host = new InlineHost();
    await host.request({ type: "initialize_world", worldSeed: 42 });
    const responses = await host.request({ type: "advance_time", amount: TICKS_PER_DAY });
    const patch = pick(responses, "state_patch").patch;
    expect(patch.time).toBe(TICKS_PER_DAY);
    // 빈 세계의 변경분은 심장박동 전역 상태뿐 — 개체 upsert 없음 (patch 는 전체 상태가 아니다)
    expect(patch.upserts).toEqual([]);
    expect(patch.globalStates).toHaveProperty("heartbeatCount");
  });

  it("변경이 없는 진행은 빈 patch", async () => {
    const host = new InlineHost();
    await host.request({ type: "initialize_world", worldSeed: 42 });
    const responses = await host.request({ type: "advance_time", amount: TICKS_PER_HOUR });
    const patch = pick(responses, "state_patch").patch;
    expect(patch.upserts).toEqual([]);
    expect(patch.globalStates).toBeUndefined();
  });

  it("initialize 전 advance_time 은 오류", () => {
    const host = new InlineHost();
    expect(() => host.server.handle({ type: "advance_time", amount: 1 })).toThrow();
  });

  it("execute_player_action 은 Phase 7 전까지 error 응답", async () => {
    const host = new InlineHost();
    await host.request({ type: "initialize_world", worldSeed: 42 });
    const responses = await host.request({
      type: "execute_player_action",
      action: { actionId: "action.move", targetIds: [] },
    });
    expect(pick(responses, "error").message).toContain("Phase 7");
  });

  it("ViewModelBuilder 가 patch 스트림에서 장면을 만든다 (§0.6 경계)", async () => {
    const host = new InlineHost();
    const builder = new ViewModelBuilder();
    const init = await host.request({ type: "initialize_world", worldSeed: 42 });
    builder.markInitialized();
    builder.applyPatch(pick(init, "state_patch").patch);
    const advanced = await host.request({ type: "advance_time", amount: 3 * TICKS_PER_DAY });
    builder.applyPatch(pick(advanced, "state_patch").patch);

    const scene = builder.buildScene();
    expect(scene.initialized).toBe(true);
    expect(scene.day).toBe(3);
    expect(scene.minuteOfDay).toBe(0);
    expect(scene.globalBadges.map((b) => b.key)).toEqual(["heartbeatCount", "lastOmen"]);
    expect(scene.globalBadges[0]!.value).toBe("3");
  });
});
