// 인식 시스템 (기획서 §23, §26, §27-1·2·11 / Phase-3 §3.2)
//
// 관찰은 사실이 되지 않는다. 신호는 다음 네 단계를 지나야 믿음이 된다.
//   신호 관찰 → 기억 대조 → 원인 후보 생성 → 성격·편견 적용 → 믿음 생성/수정
// 같은 신호를 받은 두 사람이 다른 믿음을 갖는 이유가 전부 이 파일에 있다(§10).
import type { AgentRuntimeState, BeliefRecord } from "../../shared/beliefs";
import type { ObservationSignal } from "../../shared/observation";
import { distance3d } from "../../shared/state";
import type { WorldRuntime } from "../world/WorldRuntime";
import { upsertBelief } from "./BeliefStore";
import { bestMatchingSense, sensesOf } from "./BeliefView";
import { rememberEvent } from "./MemorySystem";
import { recallByTags } from "./MemorySystem";
import { relationshipView, tellerTrustFactor } from "./RelationshipSystem";

/** 관찰 성공 판정 임계값 (§23 canObserve) */
export const OBSERVATION_THRESHOLD = 50;
/** 채널 점수 배율 — 감각 정확도 0~1 을 0~40 점으로 */
const CHANNEL_SCORE_SCALE = 40;
/** 고도차 1 당 차폐 점수 (§13 3D — 언덕 너머는 잘 보이지 않는다) */
const OBSTRUCTION_PER_ELEVATION = 0.8;
/** 주의 보정 상한 — 관심사는 감각을 이기지 못한다 */
const MAX_ATTENTION = 20;
/** 이 정도로 믿음이 흔들리면 계획을 다시 세운다 (§26 important_observation) */
const BELIEF_SHIFT_FOR_REPLAN = 20;
/** 위협으로 읽히는 신호 태그 */
const THREAT_TAGS = ["threat", "attack", "danger", "creature_trace", "important"];
/** 소문·보고 채널 — 전달자의 신뢰가 확신을 깎는 2차 신호 (§23) */
const HEARSAY_CHANNELS = ["talk", "report"];

export interface ObservationOutcome {
  observerId: string;
  signalId: string;
  score: number;
  /** 채택된 해석의 출처 — claim(신호 주장) / memory(기억 대조) / prior(기존 믿음 고수) */
  origin: "claim" | "memory" | "prior";
  subjectId?: string;
  stateKey?: string;
  believedValue?: unknown;
  confidence?: number;
  /** 소문 경로였는가 (직접 관찰과의 confidence 차이를 검증할 근거) */
  hearsay: boolean;
}

interface CauseCandidate {
  subjectId: string;
  stateKey: string;
  value: unknown;
  baseConfidence: number;
  weight: number;
  origin: "claim" | "memory" | "prior";
}

// --- ① 관찰 여부 (§23 canObserve) ----------------------------------------------

/** 주의 보정 — 관심 있는 것은 더 잘 알아챈다 (§23 getAttentionModifier) */
function attentionModifier(
  runtime: WorldRuntime,
  observerId: string,
  signal: ObservationSignal,
): number {
  const agent = runtime.agentRuntime(observerId);
  let attention = (agent.traits["curiosity"] ?? 40) / 10;
  if (signal.tags.some((tag) => THREAT_TAGS.includes(tag))) {
    // 무서워하는 대상이 낸 신호는 더 예민하게 잡힌다 (§25 fear)
    const fear =
      signal.sourceId === undefined ? 0 : relationshipView(runtime, observerId, signal.sourceId).fear;
    attention += fear / 10 + (agent.traits["uncertaintyAversion"] ?? 40) / 20;
  }
  // 지금 붙잡고 있는 목적과 관련된 신호에 주의가 쏠린다
  const activeGoals = runtime.store.findEntity(observerId)?.activeGoals ?? [];
  if (activeGoals.some((goal) => signal.tags.some((tag) => goal.goalId.includes(tag)))) attention += 6;
  return Math.min(MAX_ATTENTION, attention);
}

/** 차폐 — 고도차가 클수록 신호가 가려진다 (§13 3D 공간) */
function obstructionPenalty(runtime: WorldRuntime, observerId: string, signal: ObservationSignal): number {
  const position = runtime.store.entity(observerId).position;
  if (position === undefined) return 0;
  return Math.abs(position.z - signal.position.z) * OBSTRUCTION_PER_ELEVATION;
}

/** §23 canObserve — 채널 점수 + 신호 세기 + 주의 보정 − 거리 감쇠 − 차폐 > 50 */
export function observationScore(
  runtime: WorldRuntime,
  observerId: string,
  signal: ObservationSignal,
): number | undefined {
  const position = runtime.store.entity(observerId).position;
  if (position === undefined) return undefined;
  // 지역이 다르면 관찰하지 않는다 — 거리 계산은 같은 지역 안에서만 의미가 있다(§13)
  if (position.regionId !== signal.position.regionId) return undefined;
  const sense = bestMatchingSense(sensesOf(runtime, observerId), signal.channels);
  if (sense === undefined) return undefined;

  const channelScore = sense.accuracy * CHANNEL_SCORE_SCALE;
  const distancePenalty = (distance3d(position, signal.position) / sense.range) * 100;
  return (
    channelScore +
    signal.strength +
    attentionModifier(runtime, observerId, signal) -
    distancePenalty -
    obstructionPenalty(runtime, observerId, signal)
  );
}

// --- ②③④ 기억 대조 → 원인 후보 → 성격·편견 ------------------------------------

/** ② 기억 대조 — 같은 태그의 과거 해석을 원인 후보로 끌어온다 (§23) */
function memoryCandidates(agent: AgentRuntimeState, signal: ObservationSignal): CauseCandidate[] {
  const candidates: CauseCandidate[] = [];
  for (const memory of recallByTags(agent, signal.tags)) {
    const interpretation = memory.interpretation;
    if (interpretation === undefined) continue;
    if (signal.claim !== undefined && interpretation.subjectId !== signal.claim.subjectId) continue;
    candidates.push({
      subjectId: interpretation.subjectId,
      stateKey: interpretation.stateKey,
      value: interpretation.value,
      baseConfidence: memory.confidence,
      weight: (memory.relevance / 100) * memory.confidence,
      origin: "memory",
    });
  }
  return candidates;
}

/** ③ 원인 후보 — 신호가 주장하는 해석 + 기억 유래 해석 + 기존 믿음 고수 */
function causeCandidates(
  agent: AgentRuntimeState,
  signal: ObservationSignal,
  senseAccuracy: number,
): CauseCandidate[] {
  const candidates: CauseCandidate[] = [];
  const claim = signal.claim;
  if (claim !== undefined) {
    candidates.push({
      subjectId: claim.subjectId,
      stateKey: claim.stateKey,
      value: claim.value,
      baseConfidence: claim.confidence,
      weight: claim.confidence * senseAccuracy + 0.2,
      origin: "claim",
    });
    const prior = agent.beliefs.find(
      (belief) => belief.subjectId === claim.subjectId && belief.stateKey === claim.stateKey,
    );
    if (prior !== undefined && !Object.is(prior.believedValue, claim.value)) {
      // 기존 믿음을 고수하는 선택지 — 불확실을 싫어하는 성격일수록 강해진다 (§18 uncertaintyAversion)
      candidates.push({
        subjectId: prior.subjectId,
        stateKey: prior.stateKey,
        value: prior.believedValue,
        baseConfidence: prior.confidence,
        weight: prior.confidence * ((agent.traits["uncertaintyAversion"] ?? 40) / 100),
        origin: "prior",
      });
    }
  }
  candidates.push(...memoryCandidates(agent, signal));
  return candidates;
}

/** ④ 성격·편견 — 같은 후보라도 사람에 따라 다른 무게를 갖는다 (§18, §25) */
function applyBias(
  runtime: WorldRuntime,
  observerId: string,
  signal: ObservationSignal,
  candidate: CauseCandidate,
): number {
  const agent = runtime.agentRuntime(observerId);
  let weight = candidate.weight;
  const threatening = signal.tags.some((tag) => THREAT_TAGS.includes(tag));
  if (threatening) {
    const relation = relationshipView(runtime, observerId, candidate.subjectId);
    // 공포·원한의 대상이 낸 신호는 위협으로 해석되기 쉽다
    weight *= 1 + (relation.fear + relation.resentment) / 200;
    weight *= 1 + (agent.traits["vengefulness"] ?? 40) / 400;
  } else {
    weight *= 1 + (agent.traits["empathy"] ?? 40) / 400;
  }
  if (candidate.origin === "memory") weight *= 1 + (agent.traits["patience"] ?? 50) / 400;
  return weight;
}

function pickCandidate(
  runtime: WorldRuntime,
  observerId: string,
  signal: ObservationSignal,
  candidates: CauseCandidate[],
): CauseCandidate | undefined {
  let best: CauseCandidate | undefined;
  let bestWeight = 0;
  for (const candidate of candidates) {
    const weight = applyBias(runtime, observerId, signal, candidate);
    const key = `${candidate.subjectId}|${candidate.stateKey}|${String(candidate.value)}`;
    const bestKey =
      best === undefined ? "" : `${best.subjectId}|${best.stateKey}|${String(best.value)}`;
    if (best === undefined || weight > bestWeight || (weight === bestWeight && key < bestKey)) {
      best = candidate;
      bestWeight = weight;
    }
  }
  return best;
}

// --- 신호 처리 ------------------------------------------------------------------

function beliefShift(before: BeliefRecord | undefined, value: unknown): number {
  if (before === undefined) return BELIEF_SHIFT_FOR_REPLAN;
  if (typeof before.believedValue === "number" && typeof value === "number") {
    return Math.abs(before.believedValue - value);
  }
  return Object.is(before.believedValue, value) ? 0 : BELIEF_SHIFT_FOR_REPLAN;
}

function isHearsay(signal: ObservationSignal): boolean {
  return (
    typeof signal.payload["tellerId"] === "string" &&
    signal.channels.some((channel) => HEARSAY_CHANNELS.includes(channel))
  );
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

      const agent = runtime.agentRuntime(observerId);
      const sense = bestMatchingSense(sensesOf(runtime, observerId), signal.channels);
      const accuracy = sense?.accuracy ?? 0.5;
      const hearsay = isHearsay(signal);
      const outcome: ObservationOutcome = {
        observerId,
        signalId: signal.id,
        score,
        origin: "claim",
        hearsay,
      };

      runtime.store.withContext(
        {
          sourceId: observerId,
          targetIds: signal.sourceId === undefined ? [] : [signal.sourceId],
          locationId: signal.locationId,
          tags: ["observation", signal.id, ...signal.tags],
        },
        () => {
          const candidate = pickCandidate(
            runtime,
            observerId,
            signal,
            causeCandidates(agent, signal, accuracy),
          );

          if (candidate !== undefined) {
            outcome.origin = candidate.origin;
            // 확신 = 채널 정확도 × 신호 세기 + 기존 확신의 병합 (§23) — 소문이면 전달자 신뢰로 감쇠
            const strengthNorm = Math.min(1, signal.strength / 100);
            const prior = agent.beliefs.find(
              (belief) =>
                belief.subjectId === candidate.subjectId && belief.stateKey === candidate.stateKey,
            );
            let confidence = Math.min(
              1,
              accuracy * strengthNorm * candidate.baseConfidence + (prior?.confidence ?? 0) * 0.25,
            );
            if (hearsay) {
              const tellerId = signal.payload["tellerId"] as string;
              confidence *= tellerTrustFactor(runtime, observerId, tellerId);
            }
            // §23 기존 기억과 비교 — 같은 결론의 증거는 확신을 유지한다.
            // 약한 전문(hearsay)이 이미 굳은 확신을 깎아 내리지 못하게 하는 장치다 (다른 결론은 그대로 갱신 경쟁).
            if (prior !== undefined && prior.believedValue === candidate.value) {
              confidence = Math.max(prior.confidence, confidence);
            }

            const record: BeliefRecord = {
              subjectId: candidate.subjectId,
              stateKey: candidate.stateKey,
              believedValue: candidate.value,
              confidence,
              sourceIds: [signal.id],
              lastUpdatedAt: time,
            };
            const before = upsertBelief(agent, record);
            outcome.subjectId = record.subjectId;
            outcome.stateKey = record.stateKey;
            outcome.believedValue = record.believedValue;
            outcome.confidence = confidence;
            runtime.store.noteChange({
              entityId: observerId,
              stateKey: `belief:${record.subjectId}.${record.stateKey}`,
              before: before?.believedValue,
              after: record.believedValue,
            });

            // 관찰은 기억이 된다 (§24 생성 시점 — 관찰 성공)
            rememberEvent(runtime, observerId, {
              type: "observation",
              participants: [observerId, candidate.subjectId],
              tags: signal.tags,
              emotionalIntensity: signal.tags.some((tag) => THREAT_TAGS.includes(tag))
                ? Math.min(100, signal.strength)
                : Math.min(60, signal.strength / 2),
              relevance: Math.min(100, signal.strength * confidence + 20),
              confidence,
              interpretation: {
                subjectId: candidate.subjectId,
                stateKey: candidate.stateKey,
                value: candidate.value,
              },
            });

            // 관찰이 관찰자 자신의 상태로 이어지는 지점 — 여기서부터는 규칙(state_changed)이 받는다
            if (signal.claim?.observerStateKey !== undefined && candidate.origin === "claim") {
              runtime.store.modify(observerId, signal.claim.observerStateKey, "set", candidate.value);
            }

            // §26 important_observation — 믿음이 크게 흔들렸을 때만 계획을 다시 세운다
            if (
              beliefShift(before, candidate.value) >= BELIEF_SHIFT_FOR_REPLAN &&
              !agent.flags.includes("important_observation")
            ) {
              agent.flags.push("important_observation");
            }
          }
        },
      );
      outcomes.push(outcome);
    }
  }
  return outcomes;
}
