// 메인 루프 (기획서 §26 simulationStep)
// Phase 0 은 processScheduledEvents 만 실체이고, 나머지 6단계는 no-op 훅이다.
// 훅 채우는 담당: changedStateRules=P2, observationSignals·urgentAgents=P3,
// completedActions=P1, emergentEvents·eventSummaries=P4.
import type { WorldRuntime } from "../world/WorldRuntime";
import type { ScheduledSimulationEvent } from "./Scheduler";

export interface RuntimeHooks {
  processChangedStateRules(runtime: WorldRuntime): void;
  processObservationSignals(runtime: WorldRuntime): void;
  updateUrgentAgents(runtime: WorldRuntime): void;
  resolveCompletedActions(runtime: WorldRuntime): void;
  detectEmergentEvents(runtime: WorldRuntime): void;
  updateEventSummaries(runtime: WorldRuntime): void;
}

export const noopHooks: RuntimeHooks = {
  processChangedStateRules: () => undefined,
  processObservationSignals: () => undefined,
  updateUrgentAgents: () => undefined,
  resolveCompletedActions: () => undefined,
  detectEmergentEvents: () => undefined,
  updateEventSummaries: () => undefined,
};

export type SimulationEventHandler = (
  runtime: WorldRuntime,
  event: ScheduledSimulationEvent,
) => void;

export class SimulationLoop {
  private readonly handlers = new Map<string, SimulationEventHandler>();

  constructor(private readonly hooks: RuntimeHooks = noopHooks) {}

  registerHandler(eventType: string, handler: SimulationEventHandler): void {
    if (this.handlers.has(eventType)) {
      throw new Error(`이벤트 핸들러 중복 등록: ${eventType}`);
    }
    this.handlers.set(eventType, handler);
  }

  /**
   * 시간을 deltaTicks 만큼 진행한다.
   * 고정 프레임 순회가 아니라 이벤트 시각으로 점프한다 (§26 이벤트 기반).
   * 같은 시각의 이벤트 묶음을 처리할 때마다 §26 순서대로 훅을 호출한다.
   */
  advance(runtime: WorldRuntime, deltaTicks: number): void {
    if (!Number.isInteger(deltaTicks) || deltaTicks < 0) {
      throw new Error(`deltaTicks 는 0 이상의 정수여야 한다: ${deltaTicks}`);
    }
    const target = runtime.state.simulationTime + deltaTicks;

    for (;;) {
      const nextTime = runtime.scheduler.peekTime();
      if (nextTime === undefined || nextTime > target) break;

      // 이벤트 시각으로 점프 — 과거 예약(현재 이하)은 현재 시각으로 처리
      runtime.state.simulationTime = Math.max(runtime.state.simulationTime, nextTime);

      // 같은 시각의 이벤트를 정렬 순서대로 소진 (처리 중 새로 예약된 동시각 이벤트 포함)
      for (;;) {
        const event = runtime.scheduler.popDue(runtime.state.simulationTime);
        if (event === undefined) break;
        const handler = this.handlers.get(event.type);
        if (handler === undefined) {
          throw new Error(`핸들러 없는 이벤트: ${event.type} (${event.id})`);
        }
        handler(runtime, event);
      }

      // §26 순서 그대로
      this.hooks.processChangedStateRules(runtime);
      this.hooks.processObservationSignals(runtime);
      this.hooks.updateUrgentAgents(runtime);
      this.hooks.resolveCompletedActions(runtime);
      this.hooks.detectEmergentEvents(runtime);
      this.hooks.updateEventSummaries(runtime);
    }

    runtime.state.simulationTime = target;
  }
}
