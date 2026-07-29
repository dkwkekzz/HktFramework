// WorldRuntime — 정의(불변) + 상태(가변) + 스케줄러를 묶는 실행 단위 (기획서 §26, §39)
import type { AgentRuntimeState } from "../../shared/beliefs";
import type { ObservationSignal } from "../../shared/observation";
import { createRng, type Rng } from "../../shared/random";
import { createEmptyWorldState, type WorldState, type WorldStatePatch } from "../../shared/state";
import { Scheduler, type SchedulerSnapshot } from "../simulation/Scheduler";
import { PatchCollector } from "./PatchCollector";
import { StateSchemaRegistry } from "./StateSchema";
import { StateStore } from "./StateStore";
import type {
  ActionDefinition,
  GoalGraph,
  LocationDefinition,
  RegionDefinition,
  SpaceConnection,
  SpeciesDefinition,
  WorldDefinition,
} from "./types";

export interface RuntimeSnapshot {
  state: WorldState;
  scheduler: SchedulerSnapshot;
}

/** 정의 조회 인덱스 — 매 판단마다 배열을 훑지 않도록 미리 만든다 */
class DefinitionIndex {
  readonly actions = new Map<string, ActionDefinition>();
  readonly actionsByTag = new Map<string, ActionDefinition[]>();
  readonly goalGraphs = new Map<string, GoalGraph>();
  readonly species = new Map<string, SpeciesDefinition>();
  readonly regions = new Map<string, RegionDefinition>();
  readonly locations = new Map<string, LocationDefinition>();
  readonly connections: SpaceConnection[];

  constructor(definition: WorldDefinition) {
    for (const action of definition.actionDefinitions) {
      this.actions.set(action.id, action);
      for (const tag of action.tags) {
        const list = this.actionsByTag.get(tag);
        if (list === undefined) this.actionsByTag.set(tag, [action]);
        else list.push(action);
      }
    }
    for (const graph of definition.goalTemplates) this.goalGraphs.set(graph.id, graph);
    for (const species of definition.species) this.species.set(species.id, species);
    for (const region of definition.spaces.regions) this.regions.set(region.id, region);
    for (const location of definition.spaces.locations) this.locations.set(location.id, location);
    this.connections = definition.spaces.connections;
  }

  /** 두 지역을 잇는 연결 (§13) — 방향 무관 */
  connection(from: string, to: string): SpaceConnection | undefined {
    return this.connectionsBetween(from, to)[0];
  }

  /**
   * 두 지역을 잇는 모든 연결 — 이동 비용이 싼 순서 (§13).
   * 길은 하나가 아닐 수 있다. 통행 조건이 걸린 지름길(§13 requirements)은
   * 조건을 만족하는 주체에게만 열리므로, 누가 건너느냐에 따라 실제로 쓰는 길이 달라진다(G-5).
   */
  connectionsBetween(from: string, to: string): SpaceConnection[] {
    return this.connections
      .filter((c) => (c.from === from && c.to === to) || (c.from === to && c.to === from))
      .sort((a, b) => a.travelCost - b.travelCost);
  }
}

export class WorldRuntime {
  readonly definition: WorldDefinition;
  readonly state: WorldState;
  readonly scheduler: Scheduler;
  readonly schemas: StateSchemaRegistry;
  readonly store: StateStore;
  readonly index: DefinitionIndex;
  private readonly patchCollector = new PatchCollector();

  constructor(definition: WorldDefinition, state?: WorldState, scheduler?: Scheduler) {
    this.definition = definition;
    this.state = state ?? createEmptyWorldState();
    this.scheduler = scheduler ?? new Scheduler();
    this.schemas = new StateSchemaRegistry(definition.stateSchemas);
    this.store = new StateStore(this.state, this.schemas, this.patchCollector);
    this.index = new DefinitionIndex(definition);
  }

  /** 현재 시각 기준의 개체별 결정론 난수 스트림 (기획서 §39 RandomContext) */
  rngFor(entityId?: string): Rng {
    return createRng({
      worldSeed: this.definition.metadata.worldSeed,
      simulationStep: this.state.simulationTime,
      ...(entityId !== undefined ? { entityId } : {}),
    });
  }

  // --- 주체 런타임 (§20) -----------------------------------------------------

  agentRuntime(agentId: string): AgentRuntimeState {
    const runtime = this.state.agentRuntimes[agentId];
    if (runtime === undefined) throw new Error(`주체 런타임 없음: ${agentId}`);
    return runtime;
  }

  /** 주체 id 목록 — 항상 사전순으로 순회해 처리 순서를 결정론으로 고정한다 */
  agentIds(): string[] {
    return Object.keys(this.state.agentRuntimes).sort();
  }

  // --- 관찰 신호 (§23) --------------------------------------------------------

  /** 이 실행에서 발신된 신호 종류 (관측용 — 스냅샷에 실리지 않고 결정론에 영향이 없다) */
  readonly emittedSignalKinds = new Set<string>();

  emitSignal(signal: ObservationSignal): void {
    this.emittedSignalKinds.add(signal.id.slice(0, signal.id.lastIndexOf(".")));
    this.state.pendingSignals.push(signal);
  }

  takeSignals(): ObservationSignal[] {
    const signals = this.state.pendingSignals;
    this.state.pendingSignals = [];
    return signals;
  }

  // --- 상태 변경 진입점 -------------------------------------------------------
  // 개체·전역 상태 쓰기는 store 를 통한다. 여기 남은 것은 patch 경계 조작뿐이다.

  removeEntity(entityId: string): void {
    delete this.state.entities[entityId];
    this.patchCollector.markRemoved(entityId);
  }

  /** 초기화 직후 전체 상태를 patch 로 내보내기 위한 전량 dirty 마킹 */
  markAllDirty(): void {
    for (const id of Object.keys(this.state.entities)) this.patchCollector.markEntity(id);
    for (const key of Object.keys(this.state.globalStates)) this.patchCollector.markGlobal(key);
  }

  flushPatch(): WorldStatePatch {
    return this.patchCollector.flush(this.state);
  }

  // --- 스냅샷 (기획서 §39) ----------------------------------------------------

  toSnapshot(): RuntimeSnapshot {
    return {
      state: structuredClone(this.state),
      scheduler: this.scheduler.toSnapshot(),
    };
  }

  static fromSnapshot(definition: WorldDefinition, snapshot: RuntimeSnapshot): WorldRuntime {
    return new WorldRuntime(
      definition,
      structuredClone(snapshot.state),
      Scheduler.fromSnapshot(snapshot.scheduler),
    );
  }
}
