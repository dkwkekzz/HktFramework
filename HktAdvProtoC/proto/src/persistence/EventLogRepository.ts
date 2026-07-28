// EventLog 저장소 — 스냅샷 이후의 상태 변경을 재현하기 위한 입력 로그 (기획서 §39)
// "결과 상태"가 아니라 "입력"(시간 진행·플레이어 행동)을 기록한다 — 재실행이 곧 복원이다 (Phase 0 §0.5).
import type { WorkerRequest } from "../shared/protocol";

export interface InputLogEntry {
  /** 이 입력이 처리된 뒤의 RuntimeServer.inputSeq 값 */
  seq: number;
  input: WorkerRequest;
}

export class EventLogRepository {
  private entries: InputLogEntry[] = [];

  append(entry: InputLogEntry): void {
    const last = this.entries[this.entries.length - 1];
    if (last !== undefined && entry.seq <= last.seq) {
      throw new Error(`이벤트 로그 seq 역행: ${entry.seq} <= ${last.seq}`);
    }
    this.entries.push(structuredClone(entry));
  }

  /** seq 이후(초과)의 입력들 — 스냅샷 복원 뒤 순서대로 재실행한다 */
  listAfter(seq: number): InputLogEntry[] {
    return this.entries.filter((e) => e.seq > seq).map((e) => structuredClone(e));
  }

  clear(): void {
    this.entries = [];
  }

  exportJson(): string {
    return JSON.stringify(this.entries);
  }

  importJson(json: string): void {
    for (const entry of JSON.parse(json) as InputLogEntry[]) {
      this.append(entry);
    }
  }
}
