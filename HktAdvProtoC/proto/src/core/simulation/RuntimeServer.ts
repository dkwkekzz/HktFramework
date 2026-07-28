// RuntimeServer — §38 프로토콜 요청을 처리하는 시뮬레이션 측 단일 진입점.
// Worker(SimulationWorker)와 headless 테스트(InlineHost)가 같은 이 코드를 실행한다 (Phase 0 §0.4).
import { buildManualWorld } from "../../content/manual-world";
import { buildPlayerWorld } from "../../content/player-world";
import { FIRST_WORLD_CORPUS, FIRST_WORLD_ID, FIRST_WORLD_SEED_INPUT } from "../../content/first-world";
import { ArtifactStore } from "../../generation/ArtifactStore";
import { compileWorld, type CompileResult } from "../../generation/CompilerPipeline";
import { PROTOTYPE_SCALE } from "../../generation/GenerationTypes";
import { RecordedTextGenerationPort } from "../../generation/RecordedTextGenerationPort";
import { buildGenerationView } from "../../viewmodel/GenerationViewModel";
import { buildScenePayload, type SceneFocus } from "../../viewmodel/ScenePayloadBuilder";
import { EventInterpreter } from "../../presentation/EventInterpreter";
import type { WorldEvent } from "../../shared/events";
import type {
  PlayerActionRequest,
  WorkerRequest,
  WorkerResponse,
  WorldSeedInputMessage,
} from "../../shared/protocol";
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
  /** 화면이 지금 보고 있는 시점 (§36.2 배속 · §36.3 모드 · §36.4 열어 본 사건) */
  private focus: SceneFocus = { mode: "developer", speed: 1 };
  /** 표시 문장 캐시는 서버가 들고 있는다 — 같은 (사건, 시점, 관찰자) 를 매번 다시 만들지 않는다(§8.2) */
  private interpreter = new EventInterpreter();
  /** 마지막 생성 결과 — 정의는 경계를 넘지 않고 여기 머문다 (§38) */
  private generated: CompileResult | undefined;
  private generationSeed = 0;
  private generationInput: WorldSeedInputMessage | undefined;

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
        return this.initialize(request.worldSeed, request.world ?? "manual", request.definition);
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
      case "request_seed_input":
        // §41 첫 세계의 다섯 문장 — 녹화 코퍼스가 이 입력에 맞춰져 있으므로 기본값도 여기서 나온다
        return [
          {
            type: "seed_input",
            input: {
              title: FIRST_WORLD_SEED_INPUT.title ?? "생성된 세계",
              themes: [...FIRST_WORLD_SEED_INPUT.themes],
              desiredExperiences: [...(FIRST_WORLD_SEED_INPUT.desiredExperiences ?? [])],
              prohibitedElements: [...(FIRST_WORLD_SEED_INPUT.prohibitedElements ?? [])],
            },
          },
        ];
      case "set_view":
        return this.setView(request);
      case "set_speed":
        return this.setSpeed(request.speed);
      case "generate_world":
      case "regenerate_step":
        // 생성은 비동기다 — handleAsync 로 와야 한다 (§38 UI 스레드를 막지 않는다)
        return [{ type: "error", message: "세계 생성 요청은 비동기 경로(handleAsync)로 처리한다" }];
    }
  }

  /**
   * 비동기 요청까지 받는 진입점 — Worker 와 InlineHost 가 모두 이 경로를 쓴다.
   * 생성(§5 15단계)은 await 가 필요하고 시뮬레이션 요청은 그렇지 않으므로, 앞에서 갈라 두 성질을 섞지 않는다.
   */
  async handleAsync(request: WorkerRequest): Promise<WorkerResponse[]> {
    if (request.type === "generate_world") {
      return this.generateWorld(request.worldSeed, request.seedInput);
    }
    if (request.type === "regenerate_step") {
      return this.regenerateStep(request.stepId);
    }
    return this.handle(request);
  }

  // --- 화면 시점 (§36.2·§36.3·§36.4 / Phase-8) ------------------------------------

  /**
   * 화면이 보는 시점을 바꾼다.
   * **모드는 렌더러의 분기가 아니라 빌더의 입력이다**(§8.0) — 그래서 여기서 바뀌고, 화면은 결과만 받는다.
   */
  private setView(request: {
    mode?: SceneFocus["mode"];
    agentId?: string | null;
    eventId?: string | null;
  }): WorkerResponse[] {
    if (request.mode !== undefined) this.focus.mode = request.mode;
    if (request.agentId !== undefined) {
      if (request.agentId === null) delete this.focus.agentId;
      else this.focus.agentId = request.agentId;
    }
    if (request.eventId !== undefined) {
      if (request.eventId === null) delete this.focus.eventId;
      else this.focus.eventId = request.eventId;
    }
    const runtime = this.runtime;
    if (runtime === undefined) return [];
    return this.withSceneView(runtime, []);
  }

  private setSpeed(speed: number): WorkerResponse[] {
    this.focus.speed = speed;
    const runtime = this.runtime;
    return runtime === undefined ? [] : this.withSceneView(runtime, []);
  }

  get currentSpeed(): number {
    return this.focus.speed ?? 1;
  }

  get currentFocus(): SceneFocus {
    return this.focus;
  }

  /** 플레이어 뷰 + 화면 재료를 한 번에 (§7.2 지식 필터 → §8.0 표시 속성) */
  private withViews(runtime: WorldRuntime, responses: WorkerResponse[]): WorkerResponse[] {
    return this.withSceneView(runtime, this.withPlayerView(runtime, responses));
  }

  /** 표시 재료를 실어 보낸다 — 이 응답 뒤에는 해석이 남아 있지 않다 */
  private withSceneView(runtime: WorldRuntime, responses: WorkerResponse[]): WorkerResponse[] {
    return [
      ...responses,
      { type: "scene_view", view: buildScenePayload(runtime, this.focus, this.interpreter) },
    ];
  }

  // --- 세계 생성 (§36.1 / §5) ------------------------------------------------------

  private async compile(resumeFrom?: ArtifactStore): Promise<WorkerResponse[]> {
    const seedInput = this.generationInput;
    if (seedInput === undefined) {
      return [{ type: "error", message: "생성 입력이 없다 — generate_world 가 먼저다" }];
    }
    // 오프라인 목 포트 — 실제 LLM 어댑터도 같은 TextGenerationPort 뒤에 들어온다 (§2.1)
    const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS);
    try {
      const result = await compileWorld({
        port,
        seedInput: {
          title: seedInput.title,
          themes: seedInput.themes,
          desiredExperiences: seedInput.desiredExperiences,
          prohibitedElements: seedInput.prohibitedElements,
        },
        worldSeed: this.generationSeed,
        worldId: FIRST_WORLD_ID,
        ...(resumeFrom === undefined ? {} : { resumeFrom }),
      });
      this.generated = result;
      return [
        {
          type: "generation_view",
          view: buildGenerationView(result, PROTOTYPE_SCALE, {
            callCount: port.calls.length,
            maxInputBytes: port.maxInputBytes,
          }),
        },
      ];
    } catch (error) {
      return [
        {
          type: "error",
          message: `세계 생성 중단 — ${error instanceof Error ? error.message : String(error)}`,
        },
      ];
    }
  }

  private generateWorld(worldSeed: number, seedInput: WorldSeedInputMessage): Promise<WorkerResponse[]> {
    this.generationSeed = worldSeed;
    this.generationInput = seedInput;
    return this.compile();
  }

  /**
   * §36.1 승격분 — 한 항목만 다시 생성한다.
   * 그 단계 앞의 아티팩트는 재사용하고 그 단계부터 다시 돈다(Phase-6 §6.3 증분 재실행).
   */
  private async regenerateStep(stepId: string): Promise<WorkerResponse[]> {
    const previous = this.generated;
    if (previous === undefined) {
      return [{ type: "error", message: "생성된 세계가 없다 — generate_world 가 먼저다" }];
    }
    const target = previous.artifacts.list().find((artifact) => artifact.stepId === stepId);
    if (target === undefined) {
      return [{ type: "error", message: `그런 생성 단계가 없다: ${stepId}` }];
    }
    return this.compile(previous.artifacts.before(target.stepIndex));
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
    return this.withViews(runtime, [{ type: "state_patch", patch: runtime.flushPatch() }]);
  }

  private detach(): WorkerResponse[] {
    const runtime = this.requireRuntime();
    const detached = detachPlayer(runtime);
    if (detached === undefined) return [{ type: "error", message: "조작 중인 주체가 없다" }];
    this.inputSeq += 1;
    return this.withSceneView(runtime, [{ type: "state_patch", patch: runtime.flushPatch() }]);
  }

  /**
   * §7.3 — 요청 검증 → 실패 시 사유 → 성공 시 비용 지불·행동 예약.
   * 성공해도 세계가 저절로 흐르지는 않는다. 시간은 advance_time 이 민다(§44-5 플레이어와 무관한 시간).
   */
  private playerAction(action: PlayerActionRequest): WorkerResponse[] {
    const runtime = this.requireRuntime();
    const outcome = executePlayerAction(runtime, action);
    this.inputSeq += 1;
    return this.withViews(runtime, [
      { type: "player_action_result", outcome },
      { type: "state_patch", patch: runtime.flushPatch() },
    ]);
  }

  private acceptGrowth(offerId: string, optionId: string): WorkerResponse[] {
    const runtime = this.requireRuntime();
    const result = acceptGrowthOffer(runtime, offerId, optionId);
    if (!result.ok) return [{ type: "error", message: result.reason ?? "성장 선택 실패" }];
    this.inputSeq += 1;
    return this.withViews(runtime, [{ type: "state_patch", patch: runtime.flushPatch() }]);
  }

  /**
   * 어느 세계를 올릴지는 **종류 이름**으로 정한다 (Phase 8) —
   * 정의를 화면이 들고 있다가 되돌려 보내는 경로가 사라졌다(§38: UI 는 표시 속성만 안다).
   */
  private resolveDefinition(
    worldSeed: number,
    kind: "manual" | "player" | "generated",
    definition?: unknown,
  ): WorldDefinition {
    if (definition !== undefined) return definition as WorldDefinition;
    if (kind === "player") return buildPlayerWorld(worldSeed);
    if (kind === "generated") {
      const generated = this.generated;
      if (generated === undefined) throw new Error("생성된 세계가 없다 — generate_world 가 먼저다");
      return generated.definition;
    }
    return buildManualWorld(worldSeed);
  }

  private initialize(
    worldSeed: number,
    kind: "manual" | "player" | "generated",
    definition?: unknown,
  ): WorkerResponse[] {
    let def: WorldDefinition;
    try {
      def = this.resolveDefinition(worldSeed, kind, definition);
    } catch (error) {
      return [{ type: "error", message: error instanceof Error ? error.message : String(error) }];
    }
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

    // 새 세계에는 새 시점이다 — 관찰 대상·열어 본 사건은 지난 세계의 것이므로 놓는다
    delete this.focus.agentId;
    delete this.focus.eventId;
    this.interpreter.clear();

    // 초기 전체 상태를 patch 로 내보낸다
    runtime.markAllDirty();
    return this.withSceneView(runtime, [
      { type: "world_initialized", worldSeed, time: runtime.state.simulationTime },
      { type: "state_patch", patch: runtime.flushPatch() },
    ]);
  }

  private advanceTime(amount: number): WorkerResponse[] {
    const runtime = this.requireRuntime();
    this.requireLoop().advance(runtime, amount);
    this.inputSeq += 1;
    return this.withViews(runtime, [
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
