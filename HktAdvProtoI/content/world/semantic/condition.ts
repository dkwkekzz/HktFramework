// World Semantic — **조건은 하나의 형이다** (C035 ADDED · L2-World-Foundation G5 · §4.1 · 빈칸 2).
//
// 세계의 조건은 지금까지 데이터 넷에 서로 다른 모양으로 흩어져 있었다 — 문의 요구(Lock.requires 의
// time · state · C029) · 원천의 때(occurrence.seasons · dayPhases · C016) · 방의 철 위상(RegionPhases.seasons
// 의 철 열쇠 · C016) · 결속의 요구(LifeRequirement 넷 · C023). 이 파일이 그 넷을 기반의 **한 형**
// (engine/world-authoring/condition.ts 의 Condition)으로 **읽는다** — 옮기지 않는다 (Q1 제안대로 ·
// 데이터 파일 넷은 한 글자도 달라지지 않는다). 판정 결과는 지금의 판정 함수(connectorClosedReason ·
// sourceConditions · regionPhaseAt · lifeUnmetCodes)와 **한 값도 다르지 않다** (spec SPEC-002~004 ·
// 회귀는 시나리오가 잰다).
//
// 그리고 **기억이 처음으로 Target 이 된다** (G8 "기억은 Condition 의 Target 이다" · SPEC-006) —
// `{ target: history <방>, query: history passages.<routeId>, operator: EXISTS }` 가 RegionState.history
// 를 읽는다. 첫 사례는 숲 가장자리의 비늘 자리 (Q2 제안대로 · 데이터는 content/regions 의 원천 한 줄).
//
// 지키는 것.
//   ① **어댑터는 데이터를 바꾸지 않는다** — 형으로 읽을 뿐이다 (기본형 ③).
//   ② **기억 조건은 말해질 뿐 열고 닫지 않는다** (기본형 ④ · SPEC-006 경계 ①) — 원천의 phase ·
//      되돌아옴 · 채취 판정(mine · source-recovery)은 이 파일을 읽지 않는다. 읽는 곳은 관찰의 투영
//      (observer-view — 조건 코드 하나를 곁에 싣는다)과 도구(검사 ㊹ · observe 조건 표)뿐이다.
//   ③ **규칙 코드에 이름이 없다** (SPEC-007) — 방 · 원천 · 경로 · 철의 이름 글자가 이 파일에 없다.
//      어느 방의 어느 원천이 어느 경로의 기억을 읽는지는 데이터에만 있다.

import type {
  Condition,
  ConditionRead,
  ConditionVerdict,
} from '../../../engine/world-authoring/condition';
import type {
  CheckConditionSite,
  CheckConditionVocabulary,
} from '../../../engine/world-authoring/check';
import type { LifeRequirement, Lock, SeasonId } from '../../regions';
import type { ResourceSource } from './resource';
import type { WorldState } from './world-state';

/**
 * 조건 코드 — **지나간 것이 있어야 한다** (C035 ADDED · spec Observable · SPEC-006).
 *
 * 원천이 밝힌 기억 조건(`ResourceSource.condition`)이 **서지 않을 때** 그 원천의 conditions 자리에
 * 실린다 — 고래가 이 방을 한 번도 지나지 않았다는 사실을 판이 코드로 말한다. 지난 뒤에는 실리지
 * 않는다. 무엇이 지나야 하는지도 · 언제 지나는지도 말하지 않는다 (K8 · 문구는 View 의 표가 옮긴다).
 *
 * `condition-unmet`(아직 그때가 아니다 — 지금 지나고 있지 않다)과 **갈린다**: 저것은 지금의 사실이고
 * 이것은 과거의 사실이다 (한 번도 없었다). 둘이 함께 실릴 수 있다 — 갈린 것은 갈려 말한다.
 */
export const NEEDS_PASSAGE = 'needs-passage';

/** 조건이 서 있는 자리의 갈래 — CheckConditionSite.where 의 머리 (`lock:<id>` 식) */
export const CONDITION_SITE_LOCK = 'lock';
export const CONDITION_SITE_SOURCE_OCCURRENCE = 'source-occurrence';
export const CONDITION_SITE_PHASE = 'phase';
export const CONDITION_SITE_LIFE = 'life';
export const CONDITION_SITE_SOURCE_MEMORY = 'source-memory';

/**
 * RULE-CONDITION-READ-001 (spec R1) — **문의 요구를 형으로 읽는다** (Lock.requires · C029).
 *
 * time 항 → `{ target: clock, query: property 'season', operator: IN, value: seasons }`
 * state 항 → `{ target: region <ref>, query: state 'pattern', operator: IN, value: patterns }`
 * property 항 → `{ target: actor, query: capability <tag>, operator: EXISTS }` (자리만 — 판정 불가)
 * knowledge 항 → `{ target: actor, query: knowledge <name>, operator: EXISTS }` (자리만 — 판정 불가)
 * 요구 하나의 항들은 all 로, 요구 여럿도 all 로 묶는다 (K2 — 전부 참이어야 열린다).
 * 항이 하나도 없는 Lock 은 undefined 다 (묻지 않는 것과 같다).
 */
export function lockCondition(lock: Lock): Condition | undefined {
  void lock;
  throw new Error('lockCondition — Agent W 가 구현한다');
}

/**
 * RULE-CONDITION-READ-001 (spec R1) — **원천의 때를 형으로 읽는다** (occurrenceSeasons · occurrenceDayPhases · C016).
 *
 * seasons → `{ target: clock, query: property 'season', operator: IN, value: seasons }`
 * dayPhases → `{ target: clock, query: property 'dayPhase', operator: IN, value: dayPhases }`
 * 둘 다 밝혔으면 all. 둘 다 밝히지 않은 원천은 undefined 다 (어느 때에도 선다).
 */
export function sourceOccurrenceCondition(source: ResourceSource): Condition | undefined {
  void source;
  throw new Error('sourceOccurrenceCondition — Agent W 가 구현한다');
}

/**
 * RULE-CONDITION-READ-001 (spec R1) — **방의 철 위상 열쇠를 형으로 읽는다** (RegionPhases.seasons 의 열쇠 · C016).
 *
 * `{ target: clock, query: property 'season', operator: '==', value: season }` — 이 조건이 참일 때
 * regionPhaseAt(regionId, time) 이 그 철의 덧씌움을 낸다.
 */
export function phaseSeasonCondition(season: SeasonId): Condition {
  void season;
  throw new Error('phaseSeasonCondition — Agent W 가 구현한다');
}

/**
 * RULE-CONDITION-READ-001 (spec R1) — **결속의 요구를 형으로 읽는다** (LifeRequirement · C023).
 *
 * source-available → `{ target: source <sourceId>, query: state 'phase', operator: '==', value: 'available' }`
 * rain → `{ target: clock, query: property 'rain', operator: '==', value: true }`
 * population-at-most → `{ target: region <방>, query: count 'population.<populationId>', operator: '<=', value }`
 * population-at-least → 같은 잎에 operator '>='
 * (개체군의 방은 findPopulation 이 안다 — 세계가 모르는 개체군은 값 0 으로 읽힌다 · 지금 함수 그대로)
 */
export function lifeRequirementCondition(requirement: LifeRequirement): Condition {
  void requirement;
  throw new Error('lifeRequirementCondition — Agent W 가 구현한다');
}

/**
 * RULE-CONDITION-READ-001 · RULE-CONDITION-HISTORY-001 (spec R1 · R2) — **이 세계의 읽기**.
 *
 * Target 갈래마다 지금 값을 준다 (기반은 값이 어디서 오는지 모른다):
 *   clock          property season → seasonAt(time) · dayPhase → dayPhaseAt(time) · rain → isRainingAt(time)
 *   region <id>    state pattern → regionStates[id].rule?.pattern (규칙 없는 방은 undefined) ·
 *                  count population.<pid> → populationValueOf
 *   source <id>    state phase → sourceStateOf(...).phase (세계가 모르는 원천은 undefined) · exists → 원천의 유무
 *   history <방>   history passages.<routeId> → regionStates[방].history.passages[routeId] 의 times
 *                  (없으면 undefined — EXISTS 의 거짓 · RULE-CONDITION-HISTORY-001) ·
 *                  passages.<routeId>.lastAt → lastAt · turns → turns · awakenings.times / lastAt ·
 *                  sources.<sourceId>.takenTotal / depletedTimes / lastDepletedAt
 *   route <id>     state passing → 그 경로가 지금 지나고 있는가 (presences)
 *   area · connector · process   이 Cycle 에 읽는 조건이 없다 — UNREADABLE 을 준다 (판정 불가 · 거짓이 아니다)
 *   actor · player · faction     UNREADABLE (자리만)
 * `now` 는 state.time. previous · heldSince 는 주지 않는다 (이 Cycle 에 change · FOR 를 쓰는 조건이 없다).
 */
export function worldConditionReader(state: WorldState): ConditionRead {
  void state;
  throw new Error('worldConditionReader — Agent W 가 구현한다');
}

/** 이 세계에서 조건 하나를 판정한다 — evaluateCondition(condition, worldConditionReader(state)) */
export function worldConditionVerdict(state: WorldState, condition: Condition): ConditionVerdict {
  void state;
  void condition;
  throw new Error('worldConditionVerdict — Agent W 가 구현한다');
}

/**
 * RULE-CONDITION-HISTORY-001 (spec R2 · SPEC-006) — **원천이 밝힌 기억 조건이 서지 않을 때의 코드**.
 *
 * `ResourceSource.condition` 을 밝힌 원천에서 그 판정이 `unmet` 이면 [NEEDS_PASSAGE], 아니면 [] 다
 * (판정 불가도 빈 목록 — 알 수 없는 것을 "서지 않았다" 로 말하지 않는다). 밝히지 않은 원천은 언제나
 * 빈 목록이다. **관찰의 투영만 읽는다** — 원천의 phase · 되돌아옴 · 채취는 한 값도 달라지지 않는다.
 */
export function sourceMemoryConditionCodes(state: WorldState, source: ResourceSource): string[] {
  void state;
  void source;
  throw new Error('sourceMemoryConditionCodes — Agent W 가 구현한다');
}

/**
 * 이 세계의 조건 자리 전부 — 검사 ㊹ 과 observe 의 조건 표가 읽는다 (읽기 전용 · 결정론 차례).
 *
 * 차례: Lock (LOCKS 순) → 원천의 때 (방 순 · 원천 순) → 방의 철 위상 (방 순 · 철 순 STILL·SEEP·LONG_NIGHT·TURN) →
 * 결속 (방 순 · 탄생지 순 · 요구 순) → 원천의 기억 조건 (방 순 · 원천 순).
 * where 는 `<갈래>:<id>` — `lock:<lockId>` · `source-occurrence:<sourceId>` · `phase:<regionId>/<season>` ·
 * `life:<siteId>/<n>` · `source-memory:<sourceId>`.
 */
export function worldConditionSites(): CheckConditionSite[] {
  throw new Error('worldConditionSites — Agent W 가 구현한다');
}

/**
 * 이 세계의 조건 어휘 — 검사 ㊹ 이 잎을 견줄 실제 id 와 허용 query.
 *
 * targets: region → 방 id 전부 · source → 원천 id 전부 · route → 경로 id 전부 · connector → 문 id 전부 ·
 *          history → 방 id 전부 · clock → [] (갈래만) · area · process 는 이 Cycle 에 조건이 없어 비운다(넣지 않는다) ·
 *          actor · player · faction → [] (자리만 — 갈래는 있다)
 * queries: clock/property paths [season, dayPhase, rain] · region/state [pattern] · region/count [population.<pid>…] ·
 *          source/state [phase] · source/exists · route/state [passing] · history/history [passages.<routeId>, passages.<routeId>.lastAt,
 *          turns, awakenings.times, awakenings.lastAt, sources.<sourceId>.takenTotal, …depletedTimes, …lastDepletedAt] ·
 *          actor/capability (paths 없음) · actor/knowledge (paths 없음)
 */
export function worldConditionVocabulary(): CheckConditionVocabulary {
  throw new Error('worldConditionVocabulary — Agent W 가 구현한다');
}
