// WorldSnapshot 저장소 — 특정 시점의 전체 세계 상태 (기획서 §39)
import type { WorldSnapshotDocument } from "../core/simulation/RuntimeServer";

export class SnapshotRepository {
  private snapshots: WorldSnapshotDocument[] = [];

  save(doc: WorldSnapshotDocument): void {
    this.snapshots.push(structuredClone(doc));
  }

  /** 가장 최근(마지막으로 반영한 입력 seq 가 가장 큰) 스냅샷 */
  latest(definitionId: string): WorldSnapshotDocument | undefined {
    const matches = this.snapshots.filter((s) => s.definitionId === definitionId);
    if (matches.length === 0) return undefined;
    const latest = matches.reduce((a, b) => (a.afterLogSeq >= b.afterLogSeq ? a : b));
    return structuredClone(latest);
  }

  exportJson(): string {
    return JSON.stringify(this.snapshots);
  }

  importJson(json: string): void {
    this.snapshots.push(...(JSON.parse(json) as WorldSnapshotDocument[]));
  }
}
