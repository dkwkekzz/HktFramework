// 성장 시스템 (기획서 §32 / Phase-7 §7.4)
//
// "성장은 경험치 증가가 아니라 행동 가능성의 확장이다"(§32).
// 그래서 이 파일은 세 가지 규약만 지킨다.
//   ① 발생 조건은 코드가 아니라 **DSL 규칙**이 갖는다 (record_growth 효과, §11.3 확장).
//   ② 모든 성장에는 **출처 사건**이 있다 (§32 sourceEventId 필수) — 사건이 없으면 성장도 없다.
//   ③ NPC 와 플레이어를 가르지 않는다 (§21) — 같은 규칙이 같은 원장에 기록되고,
//      선택 구조만 "사용자가 고르는가 / 점수로 고르는가"로 갈린다.
import type { GrowthChange, GrowthOffer, GrowthOption, GrowthType, PendingGrowth } from "../../shared/player";
import { isPlayerState } from "../../shared/player";
import { TICKS_PER_DAY } from "../../shared/time";
import type { WorldRuntime } from "../world/WorldRuntime";
import type { AbilityDefinition, RestrictionDefinition } from "../world/types";
import { BeliefView } from "./BeliefView";
import { riskSensitivity } from "./GoalSystem";
import { appendJournal, playerStateOf } from "./PlayerAgent";

/** 성장 원장 상한 — 스냅샷이 무한히 자라지 않게 한다 */
export const GROWTH_LOG_CAPACITY = 400;
/** 출처 사건을 기다리는 기한. 하루 안에 사건이 되지 못한 변화는 성장이 아니다 (§29 중요도 하한과 같은 취지) */
export const GROWTH_ATTRIBUTION_WINDOW = TICKS_PER_DAY;
/** 선택형 성장의 응답 기한 — 지나면 제안이 사라진다 */
export const GROWTH_OFFER_TTL = 3 * TICKS_PER_DAY;
/** 성장 수치의 상한·하한 (traits 는 §18 판단 변수와 같은 0~100 축이다) */
const TRAIT_MIN = 0;
const TRAIT_MAX = 100;

export interface GrowthRequest {
  agentId: string;
  ruleId: string;
  type: GrowthType;
  key: string;
  amount: number;
  options: GrowthOption[];
}

/**
 * §11.3 record_growth 효과의 진입점.
 * 여기서 값을 바로 바꾸지 않는다 — 사건 탐지(§28)는 같은 반복의 뒤쪽에서 돌기 때문에,
 * 지금은 출처 사건을 모른다. 성장은 대기열에 들어가 자기를 낳은 사건을 기다린다.
 */
export function requestGrowth(runtime: WorldRuntime, request: GrowthRequest): void {
  if (runtime.state.agentRuntimes[request.agentId] === undefined) return;
  const now = runtime.state.simulationTime;
  runtime.state.pendingGrowth.push({
    id: `growth.${runtime.state.growthSeq++}`,
    agentId: request.agentId,
    ruleId: request.ruleId,
    type: request.type,
    key: request.key,
    amount: request.amount,
    createdAt: now,
    expiresAt: now + GROWTH_ATTRIBUTION_WINDOW,
    options: request.options.map((option) => ({ ...option, grants: option.grants.map((g) => ({ ...g })) })),
  });
}

/**
 * 이 성장을 낳은 사건 (§32 sourceEventId).
 * 성장을 부른 행동의 변화는 같은 반복에서 사건에 흡수된다 —
 * 그 주체가 참여자로 들어 있고 대기 시작 이후에 갱신된 사건 중 가장 최근 것이 출처다.
 */
function attributeEvent(runtime: WorldRuntime, pending: PendingGrowth): string | undefined {
  let best: { id: string; at: number } | undefined;
  for (const event of runtime.state.events.events) {
    if (!event.participants.includes(pending.agentId)) continue;
    if (event.lastChangeAt < pending.createdAt) continue;
    if (best === undefined || event.lastChangeAt > best.at || (event.lastChangeAt === best.at && event.id < best.id)) {
      best = { id: event.id, at: event.lastChangeAt };
    }
  }
  return best?.id;
}

function clampTrait(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, value));
}

function record(runtime: WorldRuntime, change: GrowthChange): void {
  runtime.state.growth.push(change);
  if (runtime.state.growth.length > GROWTH_LOG_CAPACITY) {
    runtime.state.growth.splice(0, runtime.state.growth.length - GROWTH_LOG_CAPACITY);
  }
  const player = playerStateOf(runtime, change.agentId);
  if (player !== undefined) {
    appendJournal(runtime, player, {
      kind: "growth",
      key: `${change.type}:${change.key}`,
      subjectIds: [change.sourceEventId],
      detail: `${String(change.previousValue)} → ${String(change.newValue)}`,
    });
  }
}

/**
 * 수치 성장 — 판단 변수(§18 traits)를 직접 움직인다.
 * traits 는 ActionPlanner 의 valueAlignment·riskSensitivity·softmax 온도의 입력이므로,
 * 수치가 오르면 **같은 상황에서 다른 선택이 나온다**. 그것이 §32 가 말하는 "행동 가능성의 확장"이다.
 */
export function applyNumericGrowth(
  runtime: WorldRuntime,
  agentId: string,
  spec: { type: GrowthType; key: string; amount: number; sourceEventId: string; ruleId: string; optionId?: string },
): GrowthChange | undefined {
  const agent = runtime.state.agentRuntimes[agentId];
  if (agent === undefined) return undefined;
  const previous = agent.traits[spec.key] ?? 0;
  const next = clampTrait(previous + spec.amount);
  if (next === previous) return undefined;
  agent.traits[spec.key] = next;

  const change: GrowthChange = {
    sourceEventId: spec.sourceEventId,
    type: spec.type,
    key: spec.key,
    previousValue: previous,
    newValue: next,
    agentId,
    at: runtime.state.simulationTime,
    ruleId: spec.ruleId,
  };
  if (spec.optionId !== undefined) change.optionId = spec.optionId;
  record(runtime, change);
  return change;
}

// --- 선택 구조 (§32 "사용자의 선택") ---------------------------------------------------

function postOffer(runtime: WorldRuntime, pending: PendingGrowth, sourceEventId: string): GrowthOffer {
  const now = runtime.state.simulationTime;
  const offer: GrowthOffer = {
    id: `offer.${runtime.state.growthSeq++}`,
    agentId: pending.agentId,
    ruleId: pending.ruleId,
    sourceEventId,
    type: pending.type,
    key: pending.key,
    offeredAt: now,
    expiresAt: now + GROWTH_OFFER_TTL,
    options: pending.options.map((option) => ({ ...option, grants: option.grants.map((g) => ({ ...g })) })),
  };
  runtime.state.growthOffers.push(offer);
  return offer;
}

/**
 * NPC 의 선택 (§21 비분리) — 사용자가 고르는 자리를 점수가 대신한다.
 * 제약이 무거울수록 꺼리고(위험 민감도), 열리는 것이 클수록 끌린다. 같은 시드면 같은 선택이다.
 */
export function scoreGrowthOption(view: BeliefView, option: GrowthOption): number {
  const gain = option.grants.reduce((sum, grant) => sum + grant.amount, 0);
  return gain - option.severity * 0.5 * riskSensitivity(view);
}

function autoDecide(runtime: WorldRuntime, offer: GrowthOffer): void {
  const view = new BeliefView(runtime, offer.agentId);
  let best: GrowthOption | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const option of offer.options) {
    const score = scoreGrowthOption(view, option);
    if (score > bestScore || (score === bestScore && best !== undefined && option.id < best.id)) {
      best = option;
      bestScore = score;
    }
  }
  if (best === undefined) return;
  acceptGrowthOffer(runtime, offer.id, best.id);
}

/**
 * 선택지 수락 — 새 제약을 받아들이고 그 대가로 열리는 것을 얻는다 (§32 능력 성장 예시).
 * 능력 정의(§16)는 불변이므로(§39 정의는 저장의 세 축 중 하나다) 갱신은 **성장 원장으로만** 남고,
 * 실효 능력은 effectiveAbility() 가 정의 + 원장으로 합성한다.
 */
export function acceptGrowthOffer(
  runtime: WorldRuntime,
  offerId: string,
  optionId: string,
): { ok: boolean; reason?: string; changes: GrowthChange[] } {
  const index = runtime.state.growthOffers.findIndex((entry) => entry.id === offerId);
  if (index < 0) return { ok: false, reason: `없는 성장 제안: ${offerId}`, changes: [] };
  const offer = runtime.state.growthOffers[index]!;
  const option = offer.options.find((entry) => entry.id === optionId);
  if (option === undefined) return { ok: false, reason: `없는 선택지: ${optionId}`, changes: [] };

  runtime.state.growthOffers.splice(index, 1);
  const changes: GrowthChange[] = [];
  // 제약과 출력은 **그 주체 자신의 능력**에 붙는다 — 규칙은 능력 id 를 알지 못한다(§21 비분리)
  const abilityId = ownAbilityId(runtime, offer.agentId);

  // ① 받아들인 제약 자체가 하나의 성장이다 (§32 "중요한 제약을 선택했다")
  const restrictionChange: GrowthChange = {
    sourceEventId: offer.sourceEventId,
    type: offer.type,
    key: `${abilityId ?? offer.key}.restriction`,
    previousValue: null,
    newValue: option.restriction,
    agentId: offer.agentId,
    at: runtime.state.simulationTime,
    ruleId: offer.ruleId,
    optionId: option.id,
  };
  record(runtime, restrictionChange);
  changes.push(restrictionChange);

  // ② 제약의 대가 — 수치는 판단 변수로, 능력 출력은 원장 위에서 능력 정의를 넓힌다 (§11.4 제약↑ → 출력↑)
  for (const grant of option.grants) {
    if (grant.type === "ability") {
      // 능력이 없는 주체에게 능력 출력을 열어 줄 수는 없다 — 제약만 남는다
      if (abilityId === undefined) continue;
      const previous = effectiveAbility(runtime, abilityId, offer.agentId)?.outputRange.max ?? 0;
      const change: GrowthChange = {
        sourceEventId: offer.sourceEventId,
        type: "ability",
        key: `${abilityId}.outputRange.max`,
        previousValue: previous,
        newValue: previous + grant.amount,
        agentId: offer.agentId,
        at: runtime.state.simulationTime,
        ruleId: offer.ruleId,
        optionId: option.id,
      };
      record(runtime, change);
      changes.push(change);
      continue;
    }
    const change = applyNumericGrowth(runtime, offer.agentId, {
      type: grant.type,
      key: grant.key,
      amount: grant.amount,
      sourceEventId: offer.sourceEventId,
      ruleId: offer.ruleId,
      optionId: option.id,
    });
    if (change !== undefined) changes.push(change);
  }
  return { ok: true, changes };
}

// --- 능력 합성 (§16 + §32) --------------------------------------------------------------

function baseAbility(runtime: WorldRuntime, abilityId: string): AbilityDefinition | undefined {
  return runtime.definition.abilitySystem?.abilities.find((ability) => ability.id === abilityId);
}

/** 이 주체가 가진 능력 (§16 ownerId) — 여럿이면 id 사전순 첫 번째 */
export function ownAbilityId(runtime: WorldRuntime, agentId: string): string | undefined {
  return (runtime.definition.abilitySystem?.abilities ?? [])
    .filter((ability) => ability.ownerId === agentId)
    .map((ability) => ability.id)
    .sort()[0];
}

/**
 * 정의(불변) + 성장 원장 = 지금의 능력.
 * §32 "성장 결과"는 세계 정의를 고쳐 쓰는 것이 아니라 이 합성으로 나타난다 —
 * 그래서 같은 정의·같은 시드로 다시 실행해도 같은 능력에 도달한다(§39).
 */
export function effectiveAbility(
  runtime: WorldRuntime,
  abilityId: string,
  agentId: string,
): AbilityDefinition | undefined {
  const base = baseAbility(runtime, abilityId);
  if (base === undefined) return undefined;
  const restrictions: RestrictionDefinition[] = base.restrictions.map((entry) => ({ ...entry }));
  let outputMax = base.outputRange.max;

  for (const change of runtime.state.growth) {
    if (change.agentId !== agentId) continue;
    if (change.key === `${abilityId}.restriction` && typeof change.newValue === "string") {
      restrictions.push({ description: change.newValue, severity: 0 });
      continue;
    }
    if (change.key === `${abilityId}.outputRange.max` && typeof change.newValue === "number") {
      outputMax = change.newValue;
    }
  }
  return { ...base, restrictions, outputRange: { min: base.outputRange.min, max: outputMax } };
}

// --- 사건 귀속 (§26 순서의 뒤에서 돈다) -------------------------------------------------

export interface GrowthResolution {
  applied: GrowthChange[];
  offered: GrowthOffer[];
  dropped: number;
}

/**
 * 대기 중인 성장을 사건에 붙여 확정한다.
 * 사건 탐지·요약이 끝난 뒤에 돌아야 한다 — 그래야 방금 벌어진 일이 출처 사건이 될 수 있다.
 */
export function resolvePendingGrowth(runtime: WorldRuntime): GrowthResolution {
  const resolution: GrowthResolution = { applied: [], offered: [], dropped: 0 };
  const now = runtime.state.simulationTime;
  const remaining: PendingGrowth[] = [];

  for (const pending of runtime.state.pendingGrowth) {
    const eventId = attributeEvent(runtime, pending);
    if (eventId === undefined) {
      // 기한 안에 사건이 되지 못한 변화는 성장이 아니다 (§32 sourceEventId 필수)
      if (pending.expiresAt <= now) resolution.dropped += 1;
      else remaining.push(pending);
      continue;
    }
    if (pending.options.length > 0) {
      resolution.offered.push(postOffer(runtime, pending, eventId));
      continue;
    }
    const change = applyNumericGrowth(runtime, pending.agentId, {
      type: pending.type,
      key: pending.key,
      amount: pending.amount,
      sourceEventId: eventId,
      ruleId: pending.ruleId,
    });
    if (change !== undefined) resolution.applied.push(change);
  }
  runtime.state.pendingGrowth = remaining;

  // 만료된 제안 정리 + NPC 는 그 자리에서 스스로 고른다 (§21)
  const offers = [...runtime.state.growthOffers];
  runtime.state.growthOffers = offers.filter((offer) => offer.expiresAt > now);
  for (const offer of [...runtime.state.growthOffers]) {
    const agent = runtime.state.agentRuntimes[offer.agentId];
    if (agent === undefined || isPlayerState(agent)) continue;
    autoDecide(runtime, offer);
  }
  return resolution;
}
