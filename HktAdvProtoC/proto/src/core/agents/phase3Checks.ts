// Phase 3 완료 조건의 재현 가능한 측정 (§20 충돌, §23 소문 감쇠)
//
// verify 스크립트와 테스트가 **같은 함수**를 쓴다 — 보고에 실린 수치와 테스트가 보는 수치가 갈라지지 않게.
import { buildManualWorld } from "../../content/manual-world";
import type { ObservationEffect } from "../world/types";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { emitObservationEffect } from "../world/Signals";
import { WorldRuntime } from "../world/WorldRuntime";
import { findBelief } from "./BeliefStore";
import { rankGoals } from "./GoalSystem";
import { processObservationSignals } from "./PerceptionSystem";
import { relationshipView } from "./RelationshipSystem";

const BEAST = "creature.echo_beast_mother";
const LISTENER = "agent.kael";
const TELLER = "agent.ren";

function freshRuntime(seed: number): WorldRuntime {
  const runtime = new WorldRuntime(buildManualWorld(seed));
  bootstrapWorld(runtime);
  return runtime;
}

/** 관찰자를 신호원 곁에 세운다 — 거리 감쇠를 통과시키기 위한 준비 */
function placeBeside(runtime: WorldRuntime, moverId: string, anchorId: string, offset = 2): void {
  const anchor = runtime.store.entity(anchorId).position!;
  runtime.store.moveEntity(moverId, { ...anchor, x: anchor.x + offset });
}

export interface HearsayComparison {
  /** 직접 관찰로 생긴 믿음의 확신 */
  direct: number;
  /** 소문(전달자의 믿음)으로 생긴 믿음의 확신 */
  rumor: number;
  /** 듣는 이가 전달자에게 갖는 신뢰 (§25) */
  trust: number;
}

/**
 * 같은 주장(반향수의 공격성 90)을 ① 직접 관찰 ② 소문으로 각각 전달하고 확신을 비교한다.
 * 소문은 전달자 신뢰만큼 깎인다 — 정보 비대칭의 원천(§23 소문 채널, §25 trust).
 */
export function compareHearsayConfidence(seed: number): HearsayComparison {
  // ① 직접 관찰 — 짐승이 내는 신호를 눈으로 본다
  const directRuntime = freshRuntime(seed);
  placeBeside(directRuntime, LISTENER, BEAST);
  const sighting: ObservationEffect = {
    signalId: "signal.sighting",
    channels: ["sight", "sound"],
    strength: 80,
    tags: ["threat"],
    claim: { subject: "actor", stateKey: "aggression", value: 90, confidence: 0.9 },
  };
  emitObservationEffect(directRuntime, sighting, { actorId: BEAST });
  processObservationSignals(directRuntime);
  const direct = findBelief(directRuntime.agentRuntime(LISTENER), BEAST, "aggression")?.confidence ?? 0;

  // ② 소문 — 같은 주장을 사람이 옮긴다. 옮기는 이의 믿음이 그대로 실린다.
  const rumorRuntime = freshRuntime(seed);
  placeBeside(rumorRuntime, LISTENER, TELLER);
  const teller = rumorRuntime.agentRuntime(TELLER);
  const tellerBelief = findBelief(teller, BEAST, "aggression");
  if (tellerBelief !== undefined) tellerBelief.confidence = 0.9;
  const listenerBelief = findBelief(rumorRuntime.agentRuntime(LISTENER), BEAST, "aggression");
  if (listenerBelief !== undefined) rumorRuntime.agentRuntime(LISTENER).beliefs = []; // 이미 아는 것을 지우고 새로 듣는다
  const rumorEffect: ObservationEffect = {
    signalId: "signal.rumor",
    channels: ["talk"],
    strength: 80,
    tags: ["rumor", "threat"],
    claim: { subject: "entity", entityId: BEAST, stateKey: "aggression", value: 0, confidence: 0, relayBelief: true },
  };
  emitObservationEffect(rumorRuntime, rumorEffect, { actorId: TELLER });
  processObservationSignals(rumorRuntime);
  const rumor = findBelief(rumorRuntime.agentRuntime(LISTENER), BEAST, "aggression")?.confidence ?? 0;

  return { direct, rumor, trust: relationshipView(rumorRuntime, LISTENER, TELLER).trust };
}

export interface ConflictMeasurement {
  agentId: string;
  goalId: string;
  calmFear: number;
  afraidFear: number;
  /** 겁먹은 상태에서 목적이 받은 충돌 감산 (§20 conflict) */
  subtracted: number;
  calmTop: string;
  afraidTop: string;
  /** 충돌이 1순위 목적을 바꿨는가 */
  flipped: boolean;
}

/**
 * §19 "가족 생존 ↕ 신념" 구조의 실측 —
 * 마을 지도자의 `goal.village_food_security` 와 `goal.village_safety` 는 conflicts 로 묶여 있고,
 * 겁먹은 상태에서는 회피 목적까지 더해져 서로를 깎는다. 같은 상태에서 **충돌 엣지만 없앤 세계**와
 * 비교하면 충돌 감산이 1순위 목적을 실제로 뒤집는 것이 보인다(§20 conflict).
 */
export function measureGoalConflict(seed: number): ConflictMeasurement {
  const agentId = "agent.mar";
  const goalId = "goal.village_food_security";
  const fear = 85;

  // ① 충돌이 있는 세계 (실제 콘텐츠)
  const withConflict = freshRuntime(seed);
  withConflict.store.modify(agentId, "fear", "set", fear);
  const conflicted = rankGoals(withConflict, agentId);

  // ② 같은 상태에서 conflicts 엣지만 없앤 세계 — 충돌항의 순수 효과를 본다
  const withoutConflict = new WorldRuntime({
    ...buildManualWorld(seed),
    goalTemplates: buildManualWorld(seed).goalTemplates.map((graph) => ({
      ...graph,
      edges: graph.edges.filter((edge) => edge.relation !== "conflicts"),
    })),
  });
  bootstrapWorld(withoutConflict);
  withoutConflict.store.modify(agentId, "fear", "set", fear);
  const unconflicted = rankGoals(withoutConflict, agentId);

  const conflictedTop = conflicted[0]?.goalId ?? "-";
  const unconflictedTop = unconflicted[0]?.goalId ?? "-";

  return {
    agentId,
    goalId,
    calmFear: fear,
    afraidFear: fear,
    subtracted: conflicted.find((goal) => goal.goalId === goalId)?.breakdown?.conflict ?? 0,
    calmTop: unconflictedTop,
    afraidTop: conflictedTop,
    flipped: conflictedTop !== unconflictedTop,
  };
}
