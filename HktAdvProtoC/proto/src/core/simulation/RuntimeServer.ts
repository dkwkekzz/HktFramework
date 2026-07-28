// RuntimeServer — §38 프로토콜 요청을 처리하는 시뮬레이션 측 단일 진입점.
// Worker(SimulationWorker)와 headless 테스트(InlineHost)가 같은 이 코드를 실행한다 (Phase 0 §0.4).
import { buildManualWorld } from "../../content/manual-world";
import type { WorkerRequest, WorkerResponse } from "../../shared/protocol";
import { RuleEngine } from "../rules/RuleEngine";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { validateWorldDefinition } from "../world/WorldValidation";
import type { WorldDefinition } from "../world/types";
import { WorldRuntime, type RuntimeSnapshot } from "../world/WorldRuntime";
import { SimulationLoop, type RuntimeHooks } from "./SimulationLoop";
import { createWorldSystems } from "./WorldSystems";

export interface WorldSnapshotDocument {
  definitionId: string;
  snapshot: RuntimeSnapshot;
  /** 이 스냅샷이 반영한 마지막 입력 로그 seq — 복원 시 이후 로그만 재실행 (기획서 §39) */
  afterLogSeq: number;
}

export class RuntimeServer {
  private runtime: WorldRuntime | undefined;
  private loop: SimulationLoop | undefined;
  /** 규칙은 세계 정의에 실려 온다(§11) — 정의가 바뀌면 실행기도 새로 만든다 */
  private rules = new RuleEngine([]);
  /** 상태를 변경한 입력의 누적 개수 — 스냅샷·이벤트 로그의 정합 기준점 */
  private inputSeq = 0;

  /** hooksOverride 는 테스트용 — 지정하면 Phase 1 시스템 대신 그 훅으로 돈다 */
  constructor(private readonly hooksOverride?: RuntimeHooks) {}

  get currentInputSeq(): number {
    return this.inputSeq;
  }

  get ruleEngine(): RuleEngine {
    return this.rules;
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

  /** 정의 없이 초기화하면 수동 세계(Phase 1)로 시작한다. Phase 5 부터는 생성된 정의가 들어온다. */
  private initialize(worldSeed: number, definition: unknown): WorkerResponse[] {
    const def =
      definition === undefined ? buildManualWorld(worldSeed) : (definition as WorldDefinition);
    const rules = new RuleEngine(def.ruleDefinitions);
    const errors = validateWorldDefinition(def, rules);
    if (errors.length > 0) {
      return [{ type: "error", message: `세계 정의 검증 실패:\n${errors.join("\n")}` }];
    }
    this.rules = rules;

    const runtime = new WorldRuntime(def);
    const systems = createWorldSystems(this.rules);
    const loop = new SimulationLoop(this.hooksOverride ?? systems.hooks);
    systems.registerHandlers(loop);

    bootstrapWorld(runtime);
    systems.scheduleInitialEvents(runtime);
    this.runtime = runtime;
    this.loop = loop;
    this.inputSeq += 1;

    // 초기 전체 상태를 patch 로 내보낸다
    runtime.markAllDirty();
    return [
      { type: "world_initialized", worldSeed, time: runtime.state.simulationTime },
      { type: "state_patch", patch: runtime.flushPatch() },
    ];
  }

  private advanceTime(amount: number): WorkerResponse[] {
    const runtime = this.requireRuntime();
    this.requireLoop().advance(runtime, amount);
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
    this.rules = new RuleEngine(definition.ruleDefinitions);
    const systems = createWorldSystems(this.rules);
    const loop = new SimulationLoop(this.hooksOverride ?? systems.hooks);
    systems.registerHandlers(loop);
    this.runtime = WorldRuntime.fromSnapshot(definition, doc.snapshot);
    this.loop = loop;
    this.inputSeq = doc.afterLogSeq;
  }

  private requireRuntime(): WorldRuntime {
    if (this.runtime === undefined) {
      throw new Error("initialize_world 전에는 요청을 처리할 수 없다");
    }
    return this.runtime;
  }

  private requireLoop(): SimulationLoop {
    if (this.loop === undefined) {
      throw new Error("initialize_world 전에는 요청을 처리할 수 없다");
    }
    return this.loop;
  }

  /** 검증·테스트용 상태 접근 (프로덕션 경로는 patch/snapshot 만 사용) */
  inspectRuntime(): WorldRuntime | undefined {
    return this.runtime;
  }
}
