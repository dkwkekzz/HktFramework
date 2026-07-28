// WorldRuntime — 정의(불변) + 상태(가변) + 스케줄러를 묶는 실행 단위 (기획서 §26, §39)
import { createRng, type Rng } from "../../shared/random";
import {
  createEmptyWorldState,
  type EntityState,
  type WorldState,
  type WorldStatePatch,
} from "../../shared/state";
import { Scheduler, type SchedulerSnapshot } from "../simulation/Scheduler";
import type { WorldDefinition } from "./types";

export interface RuntimeSnapshot {
  state: WorldState;
  scheduler: SchedulerSnapshot;
}

// 변경분 수집 — advance 마다 flush 해서 §38 patch 로 내보낸다
class PatchCollector {
  private dirtyEntityIds = new Set<string>();
  private removedIds = new Set<string>();
  private dirtyGlobalKeys = new Set<string>();

  markEntity(id: string): void {
    this.dirtyEntityIds.add(id);
    this.removedIds.delete(id);
  }

  markRemoved(id: string): void {
    this.removedIds.add(id);
    this.dirtyEntityIds.delete(id);
  }

  markGlobal(key: string): void {
    this.dirtyGlobalKeys.add(key);
  }

  flush(state: WorldState): WorldStatePatch {
    const patch: WorldStatePatch = {
      time: state.simulationTime,
      upserts: [...this.dirtyEntityIds]
        .sort()
        .map((id) => state.entities[id])
        .filter((e): e is EntityState => e !== undefined)
        .map((e) => structuredClone(e)),
      removedIds: [...this.removedIds].sort(),
    };
    if (this.dirtyGlobalKeys.size > 0) {
      patch.globalStates = {};
      for (const key of [...this.dirtyGlobalKeys].sort()) {
        patch.globalStates[key] = structuredClone(state.globalStates[key]);
      }
    }
    this.dirtyEntityIds.clear();
    this.removedIds.clear();
    this.dirtyGlobalKeys.clear();
    return patch;
  }
}

export class WorldRuntime {
  readonly definition: WorldDefinition;
  readonly state: WorldState;
  readonly scheduler: Scheduler;
  private readonly patchCollector = new PatchCollector();

  constructor(definition: WorldDefinition, state?: WorldState, scheduler?: Scheduler) {
    this.definition = definition;
    this.state = state ?? createEmptyWorldState();
    this.scheduler = scheduler ?? new Scheduler();
  }

  /** 현재 시각 기준의 개체별 결정론 난수 스트림 (기획서 §39 RandomContext) */
  rngFor(entityId?: string): Rng {
    return createRng({
      worldSeed: this.definition.metadata.worldSeed,
      simulationStep: this.state.simulationTime,
      ...(entityId !== undefined ? { entityId } : {}),
    });
  }

  // --- 상태 변경 진입점 -----------------------------------------------------
  // Phase 1 StateStore(스키마 검증·RawWorldChange 기록)가 이 위에 얹힌다.
  // Phase 0 에서는 dirty 추적만 담당한다.

  upsertEntity(entity: EntityState): void {
    this.state.entities[entity.id] = entity;
    this.patchCollector.markEntity(entity.id);
  }

  removeEntity(entityId: string): void {
    delete this.state.entities[entityId];
    this.patchCollector.markRemoved(entityId);
  }

  setGlobal(key: string, value: unknown): void {
    this.state.globalStates[key] = value;
    this.patchCollector.markGlobal(key);
  }

  /** 초기화 직후 전체 상태를 patch 로 내보내기 위한 전량 dirty 마킹 */
  markAllDirty(): void {
    for (const id of Object.keys(this.state.entities)) this.patchCollector.markEntity(id);
    for (const key of Object.keys(this.state.globalStates)) this.patchCollector.markGlobal(key);
  }

  flushPatch(): WorldStatePatch {
    return this.patchCollector.flush(this.state);
  }

  // --- 스냅샷 (기획서 §39) ---------------------------------------------------

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
