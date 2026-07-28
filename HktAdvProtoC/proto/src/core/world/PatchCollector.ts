// 변경분 수집 — advance 마다 flush 해서 §38 patch 로 내보낸다 (Phase 0 §0.4)
import type { EntityState, WorldState, WorldStatePatch } from "../../shared/state";

export class PatchCollector {
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
