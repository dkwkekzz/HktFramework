// RuntimeServer — §38 프로토콜 요청을 처리하는 시뮬레이션 측 단일 진입점.
// Worker(SimulationWorker)와 headless 테스트(InlineHost)가 같은 이 코드를 실행한다 (Phase 0 §0.4).
import { buildManualWorld } from "../../content/manual-world";
import type { WorldEvent } from "../../shared/events";
import type { PlayerActionRequest, WorkerRequest, WorkerResponse } from "../../shared/protocol";
import { acceptGrowthOffer } from "../agents/GrowthSystem";
import {
  attachPlayer,
  buildPlayerKnowledgeView,
  detachPlayer,
  executePlayerAction,
  findPlayerId,
} from "../agents/PlayerAgent";
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
  /** 이미 클라이언트로 보낸 사건과 그때의 상태 (§28 ongoing → concluded 전이도 한 번 더 보낸다) */
  private reportedEvents = new Map<string, WorldEvent["status"]>();

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
        return this.playerAction(request.action);
      case "request_snapshot":
        return this.snapshot();
      case "attach_player":
        return this.attach(request.agentId);
      case "detach_player":
        return this.detach();
      case "accept_growth":
        return this.acceptGrowth(request.offerId, request.optionId);
    }
  }

  // --- 플레이어 (§31, Phase-7) --------------------------------------------------

  /** 조작 중인 주체가 있으면 지식 필터를 통과한 뷰를 함께 실어 보낸다 (§7.2) */
  private withPlayerView(runtime: WorldRuntime, responses: WorkerResponse[]): WorkerResponse[] {
    const playerId = findPlayerId(runtime);
    if (playerId === undefined) return responses;
    return [...responses, { type: "player_view", view: buildPlayerKnowledgeView(runtime, playerId) }];
  }

  private attach(agentId: string): WorkerResponse[] {
    const runtime = this.requireRuntime();
    try {
      attachPlayer(runtime, agentId);
    } catch (error) {
      return [{ type: "error", message: error instanceof Error ? error.message : String(error) }];
    }
    this.inputSeq += 1;
    return this.withPlayerView(runtime, [{ type: "state_patch", patch: runtime.flushPatch() }]);
  }

  private detach(): WorkerResponse[] {
    const runtime = this.requireRuntime();
    const detached = detachPlayer(runtime);
    if (detached === undefined) return [{ type: "error", message: "조작 중인 주체가 없다" }];
    this.inputSeq += 1;
    return [{ type: "state_patch", patch: runtime.flushPatch() }];
  }

  /**
   * §7.3 — 요청 검증 → 실패 시 사유 → 성공 시 비용 지불·행동 예약.
   * 성공해도 세계가 저절로 흐르지는 않는다. 시간은 advance_time 이 민다(§44-5 플레이어와 무관한 시간).
   */
  private playerAction(action: PlayerActionRequest): WorkerResponse[] {
    const runtime = this.requireRuntime();
    const outcome = executePlayerAction(runtime, action);
    this.inputSeq += 1;
    return this.withPlayerView(runtime, [
      { type: "player_action_result", outcome },
      { type: "state_patch", patch: runtime.flushPatch() },
    ]);
  }

  private acceptGrowth(offerId: string, optionId: string): WorkerResponse[] {
    const runtime = this.requireRuntime();
    const result = acceptGrowthOffer(runtime, offerId, optionId);
    if (!result.ok) return [{ type: "error", message: result.reason ?? "성장 선택 실패" }];
    this.inputSeq += 1;
    return this.withPlayerView(runtime, [{ type: "state_patch", patch: runtime.flushPatch() }]);
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
    this.reportedEvents.clear();

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
    return this.withPlayerView(runtime, [
      { type: "state_patch", patch: runtime.flushPatch() },
      // §28 사건 스트림 — 이번 진행에서 새로 생기거나 상태가 바뀐 사건만 보낸다(§38 "전량 전달하지 않는다")
      { type: "events_created", events: this.drainEventUpdates(runtime) },
    ]);
  }

  /** 마지막 보고 이후 생기거나 종결된 사건 (Phase-4) */
  private drainEventUpdates(runtime: WorldRuntime): WorldEvent[] {
    const updates: WorldEvent[] = [];
    for (const event of runtime.state.events.events) {
      if (this.reportedEvents.get(event.id) === event.status) continue;
      this.reportedEvents.set(event.id, event.status);
      updates.push(structuredClone(event));
    }
    return updates;
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
    this.reportedEvents.clear();
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
