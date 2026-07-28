// Phase 1 런타임 배선 — §26 메인 루프의 no-op 훅을 실제 시스템으로 채운다.
//
// 한 번의 루프 반복에서 일어나는 일 (§26 순서 그대로):
//   ① 예약 이벤트 처리 : interval 규칙 실행 / 행동 완료 접수
//   ② 상태 변화 규칙   : state_changed 트리거 디스패치(연쇄 포함)
//   ③ 관찰 신호       : 신호 → 인식 → 믿음
//   ④ 긴급 주체 갱신   : shouldReplan 인 주체만 재판단
//   ⑤ 완료 행동 정리   : 행동 결과(규칙·이동·신호) 반영 후 같은 tick 에 재판단 이벤트 예약
//   ⑥⑦ 사건 탐지/요약  : Phase 4
import {
  maintainAgentsDaily,
  rememberActionOutcome,
  updateUrgentAgents,
} from "../agents/AgentRuntime";
import { TICKS_PER_DAY } from "../../shared/time";
import { processObservationSignals } from "../agents/PerceptionSystem";
import {
  ACTION_COMPLETED_EVENT,
  AGENT_REPLAN_EVENT,
  completeAction,
} from "../actions/ActionSystem";
import { RULE_SCHEDULED_EVENT } from "../rules/EffectExecutor";
import type { RuleEngine } from "../rules/RuleEngine";
import type { WorldRuntime } from "../world/WorldRuntime";
import type { RuntimeHooks } from "./SimulationLoop";
import type { SimulationLoop } from "./SimulationLoop";
import type { ScheduledActionState } from "../../shared/beliefs";

export const RULE_INTERVAL_EVENT = "rule_interval";
/**
 * 하루 한 번의 주체 유지 (§8 압력 누적 · §24 기억 감쇠/요약 · §25 약속 만기 · §17 조직 붕괴).
 * 이것들은 세계 규칙(DSL)이 아니라 주체 시스템의 시간 축이므로 규칙 엔진이 아니라 여기서 돈다.
 */
export const AGENT_MAINTENANCE_EVENT = "agent_maintenance";

interface CompletedAction {
  agentId: string;
  scheduled: ScheduledActionState;
}

export interface WorldSystems {
  hooks: RuntimeHooks;
  registerHandlers(loop: SimulationLoop): void;
  scheduleInitialEvents(runtime: WorldRuntime): void;
}

export function createWorldSystems(rules: RuleEngine): WorldSystems {
  // 한 반복 안에서만 살아 있는 대기열 — advance 가 끝날 때는 항상 비어 있으므로 스냅샷 대상이 아니다
  const completed: CompletedAction[] = [];

  const hooks: RuntimeHooks = {
    processChangedStateRules: (runtime) => {
      rules.drainStateChanges(runtime);
    },
    processObservationSignals: (runtime) => {
      processObservationSignals(runtime);
    },
    updateUrgentAgents: (runtime) => {
      updateUrgentAgents(runtime);
    },
    resolveCompletedActions: (runtime) => {
      if (completed.length === 0) return;
      const batch = completed.splice(0, completed.length);
      for (const entry of batch) {
        completeAction(runtime, rules, entry.agentId, entry.scheduled);
        // 행동은 행위자와 대상 모두에게 기억으로 남는다 (§24)
        rememberActionOutcome(runtime, entry.agentId, entry.scheduled);
        // 재판단은 §26 순서를 지켜 다음 반복의 updateUrgentAgents 가 한다.
        // 같은 tick 에 반복이 한 번 더 돌도록 표식 이벤트만 남긴다.
        runtime.scheduler.schedule({
          id: `replan.${entry.agentId}.${runtime.state.simulationTime}.${entry.scheduled.eventId}`,
          executeAt: runtime.state.simulationTime,
          type: AGENT_REPLAN_EVENT,
          targetIds: [entry.agentId],
          payload: { agentId: entry.agentId },
          priority: -10,
        });
      }
    },
    // Phase 4 — 사건 탐지·요약. 입력(RawWorldChange)은 Phase 1 부터 쌓이고 있다.
    detectEmergentEvents: () => undefined,
    updateEventSummaries: () => undefined,
  };

  return {
    hooks,

    registerHandlers: (loop) => {
      loop.registerHandler(RULE_INTERVAL_EVENT, (runtime, event) => {
        const ruleId = event.payload["ruleId"];
        const interval = event.payload["interval"];
        if (typeof ruleId !== "string" || typeof interval !== "number") return;
        rules.runInterval(runtime, ruleId);
        const seq = typeof event.payload["seq"] === "number" ? event.payload["seq"] + 1 : 1;
        runtime.scheduler.schedule({
          ...event,
          id: `interval.${ruleId}.${seq}`,
          executeAt: event.executeAt + interval,
          payload: { ruleId, interval, seq },
        });
      });

      loop.registerHandler(ACTION_COMPLETED_EVENT, (runtime, event) => {
        const agentId = event.payload["agentId"];
        if (typeof agentId !== "string") return;
        const agent = runtime.state.agentRuntimes[agentId];
        // 재판단으로 취소된 행동의 뒤늦은 완료는 버린다
        if (agent?.currentAction?.eventId !== event.id) return;
        completed.push({ agentId, scheduled: agent.currentAction });
      });

      // §11.3 schedule_rule 로 예약된 규칙 실행
      loop.registerHandler(RULE_SCHEDULED_EVENT, (runtime, event) => {
        const ruleId = event.payload["ruleId"];
        if (typeof ruleId !== "string") return;
        const actorId = event.payload["actorId"];
        const targetId = event.payload["targetId"];
        rules.runScheduled(
          runtime,
          ruleId,
          typeof actorId === "string" ? actorId : undefined,
          typeof targetId === "string" ? targetId : undefined,
        );
      });

      // 재판단 표식 — 실제 판단은 §26 순서에 따라 updateUrgentAgents 가 한다
      loop.registerHandler(AGENT_REPLAN_EVENT, () => undefined);

      loop.registerHandler(AGENT_MAINTENANCE_EVENT, (runtime, event) => {
        maintainAgentsDaily(runtime);
        const seq = typeof event.payload["seq"] === "number" ? event.payload["seq"] + 1 : 1;
        runtime.scheduler.schedule({
          ...event,
          id: `maintenance.${seq}`,
          executeAt: event.executeAt + TICKS_PER_DAY,
          payload: { seq },
        });
      });
    },

    scheduleInitialEvents: (runtime) => {
      for (const { rule, interval } of rules.intervalRules) {
        runtime.scheduler.schedule({
          id: `interval.${rule.id}.0`,
          executeAt: interval,
          type: RULE_INTERVAL_EVENT,
          targetIds: [],
          payload: { ruleId: rule.id, interval, seq: 0 },
          priority: rule.priority,
        });
      }
      runtime.scheduler.schedule({
        id: "maintenance.0",
        executeAt: TICKS_PER_DAY,
        type: AGENT_MAINTENANCE_EVENT,
        targetIds: [],
        payload: { seq: 0 },
        priority: -20,
      });
      for (const agentId of runtime.agentIds()) {
        runtime.scheduler.schedule({
          id: `replan.${agentId}.init`,
          executeAt: 1,
          type: AGENT_REPLAN_EVENT,
          targetIds: [agentId],
          payload: { agentId },
          priority: -10,
        });
      }
    },
  };
}
