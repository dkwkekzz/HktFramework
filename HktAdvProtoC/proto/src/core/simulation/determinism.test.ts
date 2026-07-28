// DoD: "동일 시드 재실행 시 30일 로그가 동일하다" (Phase 0 은 빈 세계, Phase 1 부터는 수동 세계)
// DoD: "동일 코어 코드가 Vitest(headless)와 Worker 양쪽에서 실행" — 이 테스트는 InlineHost 경로.
import { describe, expect, it } from "vitest";
import { hashValue } from "../../shared/hash";
import type { WorkerResponse } from "../../shared/protocol";
import { TICKS_PER_DAY } from "../../shared/time";
import { InlineHost } from "./InlineHost";
import type { WorldSnapshotDocument } from "./RuntimeServer";

async function run30Days(worldSeed: number, chunkTicks: number): Promise<string> {
  const host = new InlineHost();
  await host.request({ type: "initialize_world", worldSeed });
  const total = 30 * TICKS_PER_DAY;
  for (let advanced = 0; advanced < total; advanced += chunkTicks) {
    await host.request({ type: "advance_time", amount: Math.min(chunkTicks, total - advanced) });
  }
  const responses = await host.request({ type: "request_snapshot" });
  const snapshot = responses.find(
    (r): r is Extract<WorkerResponse, { type: "snapshot" }> => r.type === "snapshot",
  );
  expect(snapshot).toBeDefined();
  // 세계 상태(state+scheduler)만 해시 — afterLogSeq(입력 횟수)는 세계 상태가 아니다
  const doc = snapshot!.snapshot as WorldSnapshotDocument;
  return hashValue(doc.snapshot);
}

describe("결정론 (§39, §44-12)", () => {
  it("같은 시드 → 30일 실행 상태 해시 동일", async () => {
    const a = await run30Days(42, TICKS_PER_DAY);
    const b = await run30Days(42, TICKS_PER_DAY);
    expect(a).toBe(b);
  });

  it("진행 호출 단위를 바꿔도(1일씩 vs 6시간씩) 최종 상태 동일 — 이벤트 기반 진행의 근거", async () => {
    const byDay = await run30Days(42, TICKS_PER_DAY);
    const byQuarterDay = await run30Days(42, TICKS_PER_DAY / 4);
    expect(byDay).toBe(byQuarterDay);
  });

  it("다른 시드 → 다른 상태 (RNG 가 실제로 상태에 반영됨)", async () => {
    const a = await run30Days(42, TICKS_PER_DAY);
    const b = await run30Days(43, TICKS_PER_DAY);
    expect(a).not.toBe(b);
  });

  it("interval 규칙이 30일 내내 반복 실행된다 (스케줄러 반복 이벤트)", async () => {
    const host = new InlineHost();
    await host.request({ type: "initialize_world", worldSeed: 7 });
    await host.request({ type: "advance_time", amount: 30 * TICKS_PER_DAY });
    const runtime = host.server.inspectRuntime()!;
    expect(runtime.state.simulationTime).toBe(30 * TICKS_PER_DAY);
    // 하루 주기 규칙(마을 식량 소비)이 30회 돌았어야 한다 — 로그로 확인
    const consumption = runtime.state.changeLog.filter((change) =>
      change.tags.includes("rule.village_food_consumption"),
    );
    expect(consumption.length).toBe(30);
  });
});
