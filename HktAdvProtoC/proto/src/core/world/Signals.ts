// 관찰 신호 생성 (기획서 §23, §27-10)
// 행동의 visibleSignals(§21)와 규칙의 observations(§11)가 같은 이 경로로 신호를 만든다.
import type { ObservationSignal } from "../../shared/observation";
import type { Position } from "../../shared/state";
import type { WorldRuntime } from "./WorldRuntime";
import type { ObservationEffect } from "./types";

export interface SignalOrigin {
  actorId: string;
  targetId?: string;
  /** 신호 발생 지점 — 없으면 행위자 위치 */
  position?: Position;
}

/**
 * ObservationEffect 를 실제 신호로 만든다.
 * 신호의 주장(claim)은 실제 상태를 읽지 않는다 — 신호가 "무엇처럼 보이는지"를 콘텐츠가 선언한다(§10).
 */
export function emitObservationEffect(
  runtime: WorldRuntime,
  effect: ObservationEffect,
  origin: SignalOrigin,
): ObservationSignal | undefined {
  const position = origin.position ?? runtime.store.entity(origin.actorId).position;
  if (position === undefined) return undefined;

  const seq = runtime.state.signalSeq++;
  const signal: ObservationSignal = {
    id: `${effect.signalId}.${seq}`,
    sourceId: origin.actorId,
    locationId: position.regionId,
    channels: effect.channels,
    strength: effect.strength,
    tags: effect.tags,
    payload: {},
    createdAt: runtime.state.simulationTime,
    position: { ...position },
  };
  const claim = effect.claim;
  if (claim !== undefined) {
    const subjectId =
      claim.subject === "actor"
        ? origin.actorId
        : claim.subject === "entity"
          ? claim.entityId
          : origin.targetId;
    if (subjectId !== undefined) {
      const observerStateKey =
        claim.observerStateKey !== undefined ? { observerStateKey: claim.observerStateKey } : {};
      if (claim.relayBelief === true) {
        // §23 소문·보고 — 신호를 내는 주체의 **믿음**을 그대로 실어 나른다.
        // 믿는 바가 없으면 옮길 말도 없다(주장 없는 신호가 된다).
        const teller = runtime.state.agentRuntimes[origin.actorId];
        const belief = teller?.beliefs.find(
          (record) => record.subjectId === subjectId && record.stateKey === claim.stateKey,
        );
        if (belief !== undefined) {
          signal.claim = {
            subjectId,
            stateKey: claim.stateKey,
            value: belief.believedValue,
            confidence: belief.confidence,
            ...observerStateKey,
          };
          // 수신자는 전달자 신뢰(§25 trust)로 확신을 깎는다 — 정보 비대칭의 원천
          signal.payload = { ...signal.payload, tellerId: origin.actorId };
        }
      } else {
        signal.claim = {
          subjectId,
          stateKey: claim.stateKey,
          value: claim.value,
          confidence: claim.confidence,
          ...observerStateKey,
        };
      }
    }
  }
  runtime.emitSignal(signal);
  return signal;
}
