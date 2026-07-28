// DoD: "스냅샷 저장 → 이벤트 로그 재실행 복원 상태 == 연속 실행 상태" (기획서 §39 복원 절차)
import { describe, expect, it } from "vitest";
import { InlineHost } from "../core/simulation/InlineHost";
import type { WorldSnapshotDocument } from "../core/simulation/RuntimeServer";
import { createEmptyWorldDefinition } from "../core/world/types";
import { hashValue } from "../shared/hash";
import type { WorkerRequest, WorkerResponse } from "../shared/protocol";
import { TICKS_PER_DAY } from "../shared/time";
import { EventLogRepository } from "./EventLogRepository";
import { SnapshotRepository } from "./SnapshotRepository";
import { WorldRepository } from "./WorldRepository";

function snapshotOf(responses: WorkerResponse[]): WorldSnapshotDocument {
  const found = responses.find(
    (r): r is Extract<WorkerResponse, { type: "snapshot" }> => r.type === "snapshot",
  );
  if (found === undefined) throw new Error("snapshot 응답 없음");
  return found.snapshot as WorldSnapshotDocument;
}

describe("스냅샷 + 이벤트 로그 복원 (§39)", () => {
  it("5일차 스냅샷 → 이후 입력 재실행 == 10일 연속 실행", async () => {
    const worldRepo = new WorldRepository();
    const snapshotRepo = new SnapshotRepository();
    const logRepo = new EventLogRepository();

    // --- 원본 실행: 입력을 로그에 기록하면서 10일 진행, 5일차에 스냅샷 저장
    const host = new InlineHost();
    const send = async (input: WorkerRequest): Promise<WorkerResponse[]> => {
      const responses = await host.request(input);
      logRepo.append({ seq: host.server.currentInputSeq, input });
      return responses;
    };

    await send({ type: "initialize_world", worldSeed: 42 });
    worldRepo.save(createEmptyWorldDefinition(42)); // 정의 저장 (§39 WorldDefinition 분리)

    for (let day = 0; day < 5; day++) await send({ type: "advance_time", amount: TICKS_PER_DAY });
    snapshotRepo.save(snapshotOf(await host.request({ type: "request_snapshot" })));
    for (let day = 5; day < 10; day++) await send({ type: "advance_time", amount: TICKS_PER_DAY });

    const continuousHash = hashValue(snapshotOf(await host.request({ type: "request_snapshot" })).snapshot);

    // --- 복원: 최신 스냅샷 로드 → 이후 로그 순차 재실행 (§39 복원 절차 그대로)
    const definition = worldRepo.load("world.42")!;
    const latest = snapshotRepo.latest("world.42")!;
    const restoredHost = new InlineHost();
    restoredHost.server.restore(definition, latest);
    for (const entry of logRepo.listAfter(latest.afterLogSeq)) {
      await restoredHost.request(entry.input);
    }

    const restoredHash = hashValue(
      snapshotOf(await restoredHost.request({ type: "request_snapshot" })).snapshot,
    );
    expect(restoredHash).toBe(continuousHash);
  });

  it("저장소 JSON 왕복 후에도 복원이 성립한다", async () => {
    const logRepo = new EventLogRepository();
    logRepo.append({ seq: 1, input: { type: "initialize_world", worldSeed: 1 } });
    logRepo.append({ seq: 2, input: { type: "advance_time", amount: 10 } });

    const imported = new EventLogRepository();
    imported.importJson(logRepo.exportJson());
    expect(imported.listAfter(1)).toEqual(logRepo.listAfter(1));
  });

  it("이벤트 로그 seq 역행은 거부된다", () => {
    const logRepo = new EventLogRepository();
    logRepo.append({ seq: 2, input: { type: "advance_time", amount: 1 } });
    expect(() => logRepo.append({ seq: 2, input: { type: "advance_time", amount: 1 } })).toThrow();
  });
});
