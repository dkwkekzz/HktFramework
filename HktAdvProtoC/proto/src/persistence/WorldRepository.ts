// WorldDefinition 저장소 — 변하지 않는 세계 구조 (기획서 §39)
// Phase 0 구현체: in-memory + JSON 직렬화. IndexedDB 승격 시에도 이 인터페이스는 유지한다.
import type { WorldDefinition } from "../core/world/types";

export class WorldRepository {
  private definitions = new Map<string, WorldDefinition>();

  save(definition: WorldDefinition): void {
    this.definitions.set(definition.metadata.id, structuredClone(definition));
  }

  load(definitionId: string): WorldDefinition | undefined {
    const def = this.definitions.get(definitionId);
    return def === undefined ? undefined : structuredClone(def);
  }

  exportJson(): string {
    return JSON.stringify([...this.definitions.values()]);
  }

  importJson(json: string): void {
    for (const def of JSON.parse(json) as WorldDefinition[]) {
      this.definitions.set(def.metadata.id, def);
    }
  }
}
