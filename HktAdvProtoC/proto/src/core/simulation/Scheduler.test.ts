import { describe, expect, it } from "vitest";
import { Scheduler, type ScheduledSimulationEvent } from "./Scheduler";

function ev(id: string, executeAt: number, priority = 0): ScheduledSimulationEvent {
  return { id, executeAt, type: "test", targetIds: [], payload: {}, priority };
}

function drain(s: Scheduler, now: number): string[] {
  const out: string[] = [];
  for (;;) {
    const e = s.popDue(now);
    if (e === undefined) break;
    out.push(e.id);
  }
  return out;
}

describe("Scheduler (§26)", () => {
  it("executeAt 오름차순으로 나온다", () => {
    const s = new Scheduler();
    s.schedule(ev("c", 30));
    s.schedule(ev("a", 10));
    s.schedule(ev("b", 20));
    expect(drain(s, 100)).toEqual(["a", "b", "c"]);
  });

  it("동시각이면 priority 내림차순", () => {
    const s = new Scheduler();
    s.schedule(ev("low", 10, 1));
    s.schedule(ev("high", 10, 9));
    expect(drain(s, 100)).toEqual(["high", "low"]);
  });

  it("동시각·동순위면 삽입 순서 — 결정론의 핵심", () => {
    const s = new Scheduler();
    for (const id of ["x", "y", "z"]) s.schedule(ev(id, 10, 5));
    expect(drain(s, 100)).toEqual(["x", "y", "z"]);
  });

  it("now 초과 이벤트는 나오지 않는다", () => {
    const s = new Scheduler();
    s.schedule(ev("early", 10));
    s.schedule(ev("late", 50));
    expect(drain(s, 20)).toEqual(["early"]);
    expect(s.peekTime()).toBe(50);
  });

  it("cancel 된 이벤트는 건너뛴다", () => {
    const s = new Scheduler();
    s.schedule(ev("keep", 10));
    s.schedule(ev("drop", 5));
    s.cancel("drop");
    expect(drain(s, 100)).toEqual(["keep"]);
  });

  it("스냅샷 왕복 후에도 순서·seq 가 보존된다", () => {
    const s = new Scheduler();
    s.schedule(ev("a", 10, 5));
    s.schedule(ev("b", 10, 5));
    s.schedule(ev("c", 5));
    const restored = Scheduler.fromSnapshot(s.toSnapshot());
    // 복원 후 새 이벤트를 추가해도 기존 seq 뒤에 붙는다
    restored.schedule(ev("d", 10, 5));
    expect(drain(restored, 100)).toEqual(["c", "a", "b", "d"]);
  });
});
