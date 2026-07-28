// 인식 시스템 (기획서 §23, §27-1·11)
// Phase 1 간이형: 채널 일치 + 3D 거리 감쇠만으로 관찰 여부를 정한다.
// 기억 비교·원인 후보 생성·성격 편향(§23 후반)은 Phase 3 이 이 함수를 교체하며 채운다.
import type { BeliefRecord } from "../../shared/beliefs";
import type { ObservationSignal } from "../../shared/observation";
import { distance3d } from "../../shared/state";
import type { SenseDefinition } from "../world/types";
import type { WorldRuntime } from "../world/WorldRuntime";
import { upsertBelief } from "./BeliefStore";

/** 관찰 성공 판정 임계값 (§23 canObserve) */
const OBSERVATION_THRESHOLD = 50;
/** 중요한 관찰로 보고 재판단을 유발할 신호 세기 (§26 important_observation) */
const IMPORTANT_SIGNAL_STRENGTH = 70;

function sensesOf(runtime: WorldRuntime, agentId: string): SenseDefinition[] {
  const speciesId = runtime.store.read(agentId, "species_id");
  if (typeof speciesId !== "string") return [];
  return runtime.index.species.get(speciesId)?.senses ?? [];
}

/** 신호 채널과 맞는 감각 중 가장 좋은 것 (§23 getBestMatchingSense) */
function bestMatchingSense(
  senses: SenseDefinition[],
  signal: ObservationSignal,
): SenseDefinition | undefined {
  let best: SenseDefinition | undefined;
  for (const sense of senses) {
    if (!signal.channels.includes(sense.channel)) continue;
    if (best === undefined || sense.accuracy * sense.range > best.accuracy * best.range) {
      best = sense;
    }
  }
  return best;
}

export interface ObservationOutcome {
  observerId: string;
  signalId: string;
  score: number;
}

/**
 * §23 canObserve 의 Phase 1 구현.
 * 채널 점수 + 신호 세기 - 거리 감쇠 > 50. 장애물·주의력은 Phase 3.
 */
function observationScore(
  runtime: WorldRuntime,
  agentId: string,
  signal: ObservationSignal,
): number | undefined {
  const position = runtime.store.entity(agentId).position;
  if (position === undefined) return undefined;
  // 지역이 다르면 관찰하지 않는다 — 거리 계산은 같은 지역 안에서만 의미가 있다(§13)
  if (position.regionId !== signal.position.regionId) return undefined;
  const sense = bestMatchingSense(sensesOf(runtime, agentId), signal);
  if (sense === undefined) return undefined;

  const channelScore = sense.accuracy * 40;
  const distancePenalty = (distance3d(position, signal.position) / sense.range) * 100;
  return channelScore + signal.strength - distancePenalty;
}

/**
 * 대기 중인 신호를 주체들에게 전달한다 (§26 processObservationSignals).
 * 순회 순서는 신호 발생 순 → 주체 id 사전순으로 고정 — 결정론 보장.
 */
export function processObservationSignals(runtime: WorldRuntime): ObservationOutcome[] {
  const signals = runtime.takeSignals();
  const outcomes: ObservationOutcome[] = [];
  const time = runtime.state.simulationTime;

  for (const signal of signals) {
    for (const observerId of runtime.agentIds()) {
      if (observerId === signal.sourceId) continue; // 자기가 낸 신호는 관찰 대상이 아니다
      const score = observationScore(runtime, observerId, signal);
      if (score === undefined || score <= OBSERVATION_THRESHOLD) continue;

      outcomes.push({ observerId, signalId: signal.id, score });
      const agent = runtime.agentRuntime(observerId);

      runtime.store.withContext(
        {
          sourceId: observerId,
          targetIds: signal.sourceId === undefined ? [] : [signal.sourceId],
          locationId: signal.locationId,
          tags: ["observation", signal.id, ...signal.tags],
        },
        () => {
          if (signal.claim !== undefined) {
            const record: BeliefRecord = {
              subjectId: signal.claim.subjectId,
              stateKey: signal.claim.stateKey,
              believedValue: signal.claim.value,
              confidence: signal.claim.confidence,
              sourceIds: [signal.id],
              lastUpdatedAt: time,
            };
            const before = upsertBelief(agent, record);
            runtime.store.noteChange({
              entityId: observerId,
              stateKey: `belief:${record.subjectId}.${record.stateKey}`,
              before: before?.believedValue,
              after: record.believedValue,
            });
            // 관찰이 관찰자 자신의 상태로 이어지는 지점 — 여기서부터는 규칙(state_changed)이 받는다
            if (signal.claim.observerStateKey !== undefined) {
              runtime.store.modify(
                observerId,
                signal.claim.observerStateKey,
                "set",
                signal.claim.value,
              );
            }
          }
          if (signal.strength >= IMPORTANT_SIGNAL_STRENGTH && !agent.flags.includes("important_observation")) {
            agent.flags.push("important_observation");
          }
        },
      );
    }
  }
  return outcomes;
}
