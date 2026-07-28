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
  if (effect.claim !== undefined) {
    const subjectId = effect.claim.subject === "actor" ? origin.actorId : origin.targetId;
    if (subjectId !== undefined) {
      signal.claim = {
        subjectId,
        stateKey: effect.claim.stateKey,
        value: effect.claim.value,
        confidence: effect.claim.confidence,
        ...(effect.claim.observerStateKey !== undefined
          ? { observerStateKey: effect.claim.observerStateKey }
          : {}),
      };
    }
  }
  runtime.emitSignal(signal);
  return signal;
}
