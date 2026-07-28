// 이벤트 기반 스케줄러 (Phase 0 §0.3, 기획서 §26)
// 이진 min-heap. 정렬 키 (executeAt asc, priority desc, seq asc) — seq 는 삽입 순번으로 동순위 결정론을 보장한다.

export interface ScheduledSimulationEvent {
  id: string;
  executeAt: number;
  type: string;
  targetIds: string[];
  payload: Record<string, unknown>;
  priority: number;
}

interface HeapEntry {
  event: ScheduledSimulationEvent;
  seq: number;
}

export interface SchedulerSnapshot {
  pending: HeapEntry[];
  nextSeq: number;
}

function before(a: HeapEntry, b: HeapEntry): boolean {
  if (a.event.executeAt !== b.event.executeAt) return a.event.executeAt < b.event.executeAt;
  if (a.event.priority !== b.event.priority) return a.event.priority > b.event.priority;
  return a.seq < b.seq;
}

export class Scheduler {
  private heap: HeapEntry[] = [];
  private cancelled = new Set<string>();
  private nextSeq = 0;

  schedule(event: ScheduledSimulationEvent): void {
    this.heap.push({ event, seq: this.nextSeq++ });
    this.siftUp(this.heap.length - 1);
  }

  cancel(eventId: string): void {
    this.cancelled.add(eventId); // 지연 삭제 — pop 시점에 걸러낸다
  }

  /** 대기 중 가장 이른 실행 시각. 없으면 undefined */
  peekTime(): number | undefined {
    this.dropCancelledHead();
    return this.heap.length > 0 ? this.heap[0]!.event.executeAt : undefined;
  }

  /** now 이하 시각의 이벤트를 정렬 순서대로 하나 꺼낸다. 없으면 undefined */
  popDue(now: number): ScheduledSimulationEvent | undefined {
    this.dropCancelledHead();
    const head = this.heap[0];
    if (head === undefined || head.event.executeAt > now) return undefined;
    this.popHead();
    return head.event;
  }

  pendingCount(): number {
    return this.heap.filter((e) => !this.cancelled.has(e.event.id)).length;
  }

  toSnapshot(): SchedulerSnapshot {
    // 직렬화는 정렬 순서로 고정 — 힙 배열 내부 배치에 의존하지 않는다
    const pending = this.heap
      .filter((e) => !this.cancelled.has(e.event.id))
      .sort((a, b) => (before(a, b) ? -1 : 1))
      .map((e) => ({ event: structuredClone(e.event), seq: e.seq }));
    return { pending, nextSeq: this.nextSeq };
  }

  static fromSnapshot(snapshot: SchedulerSnapshot): Scheduler {
    const s = new Scheduler();
    for (const entry of snapshot.pending) {
      s.heap.push({ event: structuredClone(entry.event), seq: entry.seq });
      s.siftUp(s.heap.length - 1);
    }
    s.nextSeq = snapshot.nextSeq;
    return s;
  }

  private dropCancelledHead(): void {
    while (this.heap.length > 0 && this.cancelled.has(this.heap[0]!.event.id)) {
      this.cancelled.delete(this.heap[0]!.event.id);
      this.popHead();
    }
  }

  private popHead(): void {
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (before(this.heap[i]!, this.heap[parent]!)) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent]!, this.heap[i]!];
        i = parent;
      } else break;
    }
  }

  private siftDown(i: number): void {
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let smallest = i;
      if (l < this.heap.length && before(this.heap[l]!, this.heap[smallest]!)) smallest = l;
      if (r < this.heap.length && before(this.heap[r]!, this.heap[smallest]!)) smallest = r;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest]!, this.heap[i]!];
      i = smallest;
    }
  }
}
