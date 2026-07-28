// RuntimeServer — §38 프로토콜 요청을 처리하는 시뮬레이션 측 단일 진입점.
// Worker(SimulationWorker)와 headless 테스트(InlineHost)가 같은 이 코드를 실행한다 (Phase 0 §0.4).
import type { WorkerRequest, WorkerResponse } from "../../shared/protocol";
import { TICKS_PER_DAY } from "../../shared/time";
import { createEmptyWorldDefinition, type WorldDefinition } from "../world/types";
import { WorldRuntime, type RuntimeSnapshot } from "../world/WorldRuntime";
import { SimulationLoop, type RuntimeHooks } from "./SimulationLoop";

export interface WorldSnapshotDocument {
  definitionId: string;
  snapshot: RuntimeSnapshot;
  /** 이 스냅샷이 반영한 마지막 입력 로그 seq — 복원 시 이후 로그만 재실행 (기획서 §39) */
  afterLogSeq: number;
}

// Phase 0 임시 심장박동: 빈 세계에서도 스케줄러·patch·RNG 결정론을 검증할 최소 이벤트.
// Phase 1 의 실제 콘텐츠(규칙 interval)가 들어오면 제거한다.
const HEARTBEAT_EVENT = "world_heartbeat";

function registerBuiltinHandlers(loop: SimulationLoop): void {
  loop.registerHandler(HEARTBEAT_EVENT, (runtime, event) => {
    const count = (runtime.state.globalStates["heartbeatCount"] as number | undefined) ?? 0;
    runtime.setGlobal("heartbeatCount", count + 1);
    runtime.setGlobal("lastOmen", runtime.rngFor("world").nextUint32());
    runtime.scheduler.schedule({
      ...event,
      id: `heartbeat.${count + 1}`,
      executeAt: event.executeAt + TICKS_PER_DAY,
    });
  });
}

export class RuntimeServer {
  private runtime: WorldRuntime | undefined;
  private loop: SimulationLoop;
  /** 상태를 변경한 입력의 누적 개수 — 스냅샷·이벤트 로그의 정합 기준점 */
  private inputSeq = 0;

  constructor(hooks?: RuntimeHooks) {
    this.loop = new SimulationLoop(hooks);
    registerBuiltinHandlers(this.loop);
  }

  get currentInputSeq(): number {
    return this.inputSeq;
  }

  handle(request: WorkerRequest): WorkerResponse[] {
    switch (request.type) {
      case "initialize_world":
        return this.initialize(request.worldSeed, request.definition);
      case "advance_time":
        return this.advanceTime(request.amount);
      case "execute_player_action":
        // 플레이어 행동은 Phase 7 — 프로토콜 타입만 선치 (Phase 0 §0.4)
        return [{ type: "error", message: "execute_player_action 은 Phase 7 에서 구현된다" }];
      case "request_snapshot":
        return this.snapshot();
    }
  }

  private initialize(worldSeed: number, definition: unknown): WorkerResponse[] {
    const def =
      definition === undefined
        ? createEmptyWorldDefinition(worldSeed)
        : (definition as WorldDefinition);
    this.runtime = new WorldRuntime(def);
    this.inputSeq += 1;

    // 첫 심장박동 예약 (Phase 0 임시)
    this.runtime.scheduler.schedule({
      id: "heartbeat.0",
      executeAt: TICKS_PER_DAY,
      type: HEARTBEAT_EVENT,
      targetIds: [],
      payload: {},
      priority: 0,
    });

    // 초기 전체 상태를 patch 로 내보낸다
    this.runtime.markAllDirty();
    return [
      { type: "world_initialized", worldSeed, time: this.runtime.state.simulationTime },
      { type: "state_patch", patch: this.runtime.flushPatch() },
    ];
  }

  private advanceTime(amount: number): WorkerResponse[] {
    const runtime = this.requireRuntime();
    this.loop.advance(runtime, amount);
    this.inputSeq += 1;
    return [
      { type: "state_patch", patch: runtime.flushPatch() },
      // 사건 스트림은 Phase 4 부터 실체 — 프로토콜 형태만 유지
      { type: "events_created", events: [] },
    ];
  }

  private snapshot(): WorkerResponse[] {
    const runtime = this.requireRuntime();
    const doc: WorldSnapshotDocument = {
      definitionId: runtime.definition.metadata.id,
      snapshot: runtime.toSnapshot(),
      afterLogSeq: this.inputSeq,
    };
    return [{ type: "snapshot", snapshot: doc }];
  }

  /** 스냅샷에서 런타임을 복원한다 (기획서 §39 복원 절차의 1단계) */
  restore(definition: WorldDefinition, doc: WorldSnapshotDocument): void {
    this.runtime = WorldRuntime.fromSnapshot(definition, doc.snapshot);
    this.inputSeq = doc.afterLogSeq;
  }

  private requireRuntime(): WorldRuntime {
    if (this.runtime === undefined) {
      throw new Error("initialize_world 전에는 요청을 처리할 수 없다");
    }
    return this.runtime;
  }

  /** 검증·테스트용 상태 접근 (프로덕션 경로는 patch/snapshot 만 사용) */
  inspectRuntime(): WorldRuntime | undefined {
    return this.runtime;
  }
}
