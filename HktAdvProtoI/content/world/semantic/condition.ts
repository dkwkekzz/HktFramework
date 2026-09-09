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

import {
  UNREADABLE,
  evaluateCondition,
  type Condition,
  type ConditionLeaf,
  type ConditionRead,
  type ConditionValue,
  type ConditionVerdict,
  type Unreadable,
} from '../../../engine/world-authoring/condition';
import type {
  CheckConditionQueryRule,
  CheckConditionSite,
  CheckConditionVocabulary,
} from '../../../engine/world-authoring/check';
import {
  CONDITION_PATH_DAY_PHASE,
  CONDITION_PATH_SEASON,
  HISTORY_SOURCES,
  HISTORY_TAKEN_TOTAL,
  LOCKS,
  PRESENCE_ROUTES,
  REGION_GRAPH,
  REGION_SPECS,
  lockCondition,
  occurrenceCondition,
  sourceTakenTotalPath,
  type LifeRequirement,
  type SeasonId,
} from '../../regions';
import { CYCLE_SECONDS, TURN_SECONDS, dayPhaseAt, seasonAt } from './clock';
import { findPopulation, lifeSitesInRegion, populationValueOf, populationsInRegion } from './life';
import { passingRegionOf, presenceStateOf } from './presence';
import { isRainingAt } from './rain';
import type { RegionMemory } from './region-state';
import { findResourceSource, sourceStateOf, sourcesInRegion, type ResourceSource } from './resource';
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

// ── 읽는 자리의 어휘 — 형의 **속성 이름**이지 세계의 이름이 아니다 (SPEC-007) ──
//
// 시계가 내는 값 셋 · 방의 State 필드 · 원천의 State 필드 · 경로의 지금 · 기억의 경로 마디.
// 읽기(worldConditionReader)와 어휘(worldConditionVocabulary)가 **같은 글자**를 쓰도록 한 자리에
// 둔다 — 두 벌로 적으면 검사 ㊹ 이 통과시킨 잎을 읽기가 모르는 날이 온다.

/** clock · property — 지금 철 · 지금 낮밤 · 지금 비가 오는가 */
// C036 CHANGED — 철과 낮밤의 경로는 **content/regions 가 원본**이다 (opportunity.ts). 기회의
// availability 를 그 폴더가 지어야 하는데 content/regions 는 content/world 를 부를 수 없어서,
// 조건의 형을 짓는 자리가 그리로 갔다. 여기서 두 벌로 적지 않고 그 글자를 받아 쓴다.
const CLOCK_SEASON = CONDITION_PATH_SEASON;
const CLOCK_DAY_PHASE = CONDITION_PATH_DAY_PHASE;
const CLOCK_RAIN = 'rain';
/** region · state — 그 방 규칙의 지금 패턴 (RegionRuleState.pattern) */
const REGION_PATTERN = 'pattern';
/** region · count — `population.<개체군 id>` 의 머리 */
const REGION_POPULATION = 'population';
/** source · state — 원천의 지금 phase (ResourceSourceState.phase) · 결속이 묻는 값 */
const SOURCE_PHASE = 'phase';
const SOURCE_PHASE_AVAILABLE = 'available';
/** route · state — 그 경로가 지금 지나고 있는가 */
const ROUTE_PASSING = 'passing';
/** history · history — RegionMemory 의 경로 마디들 (semantic/region-state.ts 의 필드 이름 그대로) */
const HISTORY_PASSAGES = 'passages';
const HISTORY_TURNS = 'turns';
const HISTORY_AWAKENINGS = 'awakenings';
const HISTORY_TIMES = 'times';
const HISTORY_LAST_AT = 'lastAt';
// C036 CHANGED — 원천의 셈이 사는 마디 둘(sources · takenTotal)은 content/regions 가 원본이다
// (기회의 progress.ref 가 그 경로다 — 위 CLOCK_SEASON 과 같은 까닭).
const HISTORY_DEPLETED_TIMES = 'depletedTimes';
const HISTORY_LAST_DEPLETED_AT = 'lastDepletedAt';
/** 경로 마디를 잇는 글자 (기반의 ConditionQuery.path 어법 — 점으로 잇는다) */
const PATH_SEPARATOR = '.';

/**
 * RULE-CONDITION-READ-001 (spec R1) — **문의 요구를 형으로 읽는다** (Lock.requires · C029).
 *
 * C036 CHANGED — 그 형을 짓는 자리가 `content/regions/opportunity.ts` 로 **옮겨 갔다**
 * (건너기 기회의 availability 가 바로 이 조건이고, content/regions 는 content/world 를 부를 수
 * 없다). 여기 서 있는 것은 그 이름 하나이고 답은 한 값도 다르지 않다 — 두 벌로 적지 않는다.
 */
export { lockCondition };

/**
 * RULE-CONDITION-READ-001 (spec R1) — **원천의 때를 형으로 읽는다** (occurrenceSeasons · occurrenceDayPhases · C016).
 *
 * C036 CHANGED — 형을 짓는 알맹이는 `content/regions/opportunity.ts` 의 `occurrenceCondition`
 * 하나다 (채집 기회의 availability 가 그것이다 · lockCondition 과 같은 까닭). 이 함수가 하는
 * 일은 세계가 아는 원천에서 그 두 값을 꺼내 건네는 것뿐이고, 답은 한 값도 다르지 않다.
 */
export function sourceOccurrenceCondition(source: ResourceSource): Condition | undefined {
  return occurrenceCondition(source.occurrenceSeasons, source.occurrenceDayPhases);
}

/**
 * RULE-CONDITION-READ-001 (spec R1) — **방의 철 위상 열쇠를 형으로 읽는다** (RegionPhases.seasons 의 열쇠 · C016).
 *
 * `{ target: clock, query: property 'season', operator: '==', value: season }` — 이 조건이 참일 때
 * regionPhaseAt(regionId, time) 이 그 철의 덧씌움을 낸다.
 */
export function phaseSeasonCondition(season: SeasonId): Condition {
  return {
    target: { kind: 'clock' },
    query: { kind: 'property', path: CLOCK_SEASON },
    operator: '==',
    value: season,
  };
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
  if (requirement.kind === 'rain') {
    return {
      target: { kind: 'clock' },
      query: { kind: 'property', path: CLOCK_RAIN },
      operator: '==',
      value: true,
    };
  }
  if (requirement.kind === 'population-at-most' || requirement.kind === 'population-at-least') {
    // 개체군의 방은 findPopulation 이 안다. 세계가 모르는 개체군은 방이 없다 — ref 를 지어내지
    // 않고 비워 둔다 (검사 ㊹ 이 그것을 유령으로 잡는다 · 읽기는 지금 함수 그대로 값 0 이다).
    const region = findPopulation(requirement.populationId)?.regionId;
    return {
      target: { kind: 'region', ...(region === undefined ? {} : { ref: region }) },
      query: { kind: 'count', path: joinPath(REGION_POPULATION, requirement.populationId) },
      operator: requirement.kind === 'population-at-most' ? '<=' : '>=',
      value: requirement.value,
    };
  }
  return {
    target: { kind: 'source', ref: requirement.sourceId },
    query: { kind: 'state', path: SOURCE_PHASE },
    operator: '==',
    value: SOURCE_PHASE_AVAILABLE,
  };
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
  return {
    now: state.time,
    value: (leaf) => readLeaf(state, leaf),
  };
}

/** 이 세계에서 조건 하나를 판정한다 — evaluateCondition(condition, worldConditionReader(state)) */
export function worldConditionVerdict(state: WorldState, condition: Condition): ConditionVerdict {
  return evaluateCondition(condition, worldConditionReader(state));
}

/**
 * RULE-CONDITION-HISTORY-001 (spec R2 · SPEC-006) — **원천이 밝힌 기억 조건이 서지 않을 때의 코드**.
 *
 * `ResourceSource.condition` 을 밝힌 원천에서 그 판정이 `unmet` 이면 [NEEDS_PASSAGE], 아니면 [] 다
 * (판정 불가도 빈 목록 — 알 수 없는 것을 "서지 않았다" 로 말하지 않는다). 밝히지 않은 원천은 언제나
 * 빈 목록이다. **관찰의 투영만 읽는다** — 원천의 phase · 되돌아옴 · 채취는 한 값도 달라지지 않는다.
 */
export function sourceMemoryConditionCodes(state: WorldState, source: ResourceSource): string[] {
  if (source.condition === undefined) return [];
  return worldConditionVerdict(state, source.condition) === 'unmet' ? [NEEDS_PASSAGE] : [];
}

/**
 * 이 세계의 조건 자리 전부 — 검사 ㊹ 과 observe 의 조건 표가 읽는다 (읽기 전용 · 결정론 차례).
 *
 * 차례: Lock (LOCKS 순) → 원천의 때 (방 순 · 원천 순) → 방의 철 위상 (방 순 · 철 순 — 시계의 철 차례) →
 * 결속 (방 순 · 탄생지 순 · 요구 순) → 원천의 기억 조건 (방 순 · 원천 순).
 * where 는 `<갈래>:<id>` — `lock:<lockId>` · `source-occurrence:<sourceId>` · `phase:<regionId>/<season>` ·
 * `life:<siteId>/<n>` · `source-memory:<sourceId>`.
 */
export function worldConditionSites(): CheckConditionSite[] {
  const sites: CheckConditionSite[] = [];
  // ① 문의 요구 — LOCKS 의 차례 (방 차례 · 그 방이 적은 Lock 차례)
  for (const lock of LOCKS) {
    const condition = lockCondition(lock);
    if (condition === undefined) continue;
    sites.push({ where: siteName(CONDITION_SITE_LOCK, lock.id), condition });
  }
  // ② 원천의 때 — 방 차례 · 원천 차례. 세계에 실제로 선 원천만 (sourcesInRegion 의 판정 그대로)
  for (const spec of REGION_SPECS) {
    for (const source of sourcesInRegion(spec.id)) {
      const condition = sourceOccurrenceCondition(source);
      if (condition === undefined) continue;
      sites.push({ where: siteName(CONDITION_SITE_SOURCE_OCCURRENCE, source.id), condition });
    }
  }
  // ③ 방의 철 위상 — 방 차례 · 철 차례 (철의 차례는 시계가 안다 · 이 파일은 철의 이름을 모른다)
  const seasons = seasonOrder();
  for (const spec of REGION_SPECS) {
    const listed = spec.phases?.seasons;
    if (!listed) continue;
    for (const season of seasons) {
      if (listed[season] === undefined) continue;
      sites.push({
        where: siteName(CONDITION_SITE_PHASE, `${spec.id}/${season}`),
        condition: phaseSeasonCondition(season),
      });
    }
  }
  // ④ 결속의 요구 — 방 차례 · 탄생지 차례 · 요구 차례 (요구 하나가 자리 하나다)
  for (const spec of REGION_SPECS) {
    for (const site of lifeSitesInRegion(spec.id)) {
      site.requires.forEach((requirement, index) => {
        sites.push({
          where: siteName(CONDITION_SITE_LIFE, `${site.id}/${index}`),
          condition: lifeRequirementCondition(requirement),
        });
      });
    }
  }
  // ⑤ 원천이 밝힌 기억 조건 — 방 차례 · 원천 차례. 밝힌 원천만 (데이터를 형 그대로 싣는다)
  for (const spec of REGION_SPECS) {
    for (const source of sourcesInRegion(spec.id)) {
      if (source.condition === undefined) continue;
      sites.push({ where: siteName(CONDITION_SITE_SOURCE_MEMORY, source.id), condition: source.condition });
    }
  }
  return sites;
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
  const regionIds = REGION_SPECS.map((spec) => spec.id);
  // 세계에 실제로 선 원천 — 읽기(findResourceSource)가 아는 것과 같은 목록이어야 한다
  const sourceIds = REGION_SPECS.flatMap((spec) => sourcesInRegion(spec.id).map((source) => source.id));
  const routeIds = PRESENCE_ROUTES.map((route) => route.id);
  const populationIds = REGION_SPECS.flatMap((spec) =>
    populationsInRegion(spec.id).map((population) => population.id),
  );
  const queries: CheckConditionQueryRule[] = [
    { target: 'clock', query: 'property', paths: [CLOCK_SEASON, CLOCK_DAY_PHASE, CLOCK_RAIN] },
    { target: 'region', query: 'state', paths: [REGION_PATTERN] },
    {
      target: 'region',
      query: 'count',
      paths: populationIds.map((id) => joinPath(REGION_POPULATION, id)),
    },
    { target: 'source', query: 'state', paths: [SOURCE_PHASE] },
    { target: 'source', query: 'exists' },
    { target: 'route', query: 'state', paths: [ROUTE_PASSING] },
    {
      target: 'history',
      query: 'history',
      paths: [
        ...routeIds.flatMap((id) => [
          joinPath(HISTORY_PASSAGES, id),
          joinPath(HISTORY_PASSAGES, id, HISTORY_LAST_AT),
        ]),
        HISTORY_TURNS,
        joinPath(HISTORY_AWAKENINGS, HISTORY_TIMES),
        joinPath(HISTORY_AWAKENINGS, HISTORY_LAST_AT),
        ...sourceIds.flatMap((id) => [
          // C036 CHANGED — 이 경로 하나는 기회의 progress.ref 이기도 하다. 짓는 자리를 하나로
          // 둔다 (content/regions/opportunity.ts) — 검사 ㊺ 이 그 경로를 이 어휘에서 찾는다.
          sourceTakenTotalPath(id),
          joinPath(HISTORY_SOURCES, id, HISTORY_DEPLETED_TIMES),
          joinPath(HISTORY_SOURCES, id, HISTORY_LAST_DEPLETED_AT),
        ]),
      ],
    },
    // 자리만인 것 — 갈래는 있되 판정 불가다 (2층은 판정하지 않는다 · K12)
    { target: 'actor', query: 'capability' },
    { target: 'actor', query: 'knowledge' },
  ];
  return {
    targets: {
      region: regionIds,
      connector: REGION_GRAPH.connectors.map((connector) => connector.id),
      source: sourceIds,
      route: routeIds,
      clock: [],
      history: regionIds,
      actor: [],
      player: [],
      faction: [],
    },
    queries,
  };
}

// ── 안쪽 ─────────────────────────────────────────────────────────────

// C036 — 항 여럿을 all 로 묶던 자리(allOf)는 조건의 형을 짓는 두 함수와 함께
// content/regions/opportunity.ts 로 옮겨 갔다. 이 파일은 이제 형을 짓지 않고 읽기만 한다.

/** 검사 ㊹ 이 읽는 자리 이름 — `<갈래>:<id>` */
function siteName(kind: string, id: string): string {
  return `${kind}:${id}`;
}

/** 경로 마디를 점으로 잇는다 — 어휘와 읽기가 같은 글자를 쓴다 */
function joinPath(...segments: readonly string[]): string {
  return segments.join(PATH_SEPARATOR);
}

/**
 * 철의 차례 — **시계에서 유도한다** (이 파일은 철의 이름을 한 글자도 들지 않는다 · SPEC-007).
 *
 * 한 바퀴를 가장 짧은 철(뒤척임)의 길이로 걸으며 처음 만나는 차례로 편다. 한 바퀴에 네 철이
 * 반드시 한 번씩 오므로(RULE-WORLD-CLOCK-001) 결과는 언제나 같다 (결정론).
 */
function seasonOrder(): SeasonId[] {
  const order: SeasonId[] = [];
  for (let time = 0; time < CYCLE_SECONDS; time += TURN_SECONDS) {
    const season = seasonAt(time);
    if (!order.includes(season)) order.push(season);
  }
  return order;
}

/**
 * RULE-CONDITION-READ-001 · RULE-CONDITION-HISTORY-001 (spec R1 · R2) — 잎 하나의 지금 값.
 *
 * 없는 것은 undefined(EXISTS 의 거짓 · 비교의 거짓), 모르는 것은 UNREADABLE(판정 불가) —
 * 둘을 갈라 준다 (기반이 지키는 것 ③). Target 갈래마다 값이 어디서 오는지는 위
 * worldConditionReader 의 표 그대로다.
 */
function readLeaf(state: WorldState, leaf: ConditionLeaf): ConditionValue | undefined | Unreadable {
  const { target, query } = leaf;
  const path = query.path === undefined ? [] : query.path.split(PATH_SEPARATOR);
  switch (target.kind) {
    case 'clock':
      return readClock(state.time, query.kind, path);
    case 'region':
      return readRegion(state, target.ref, query.kind, path);
    case 'source':
      return readSource(state, target.ref, query.kind, path);
    case 'history':
      return readHistory(state, target.ref, query.kind, path);
    case 'route':
      return readRoute(state, target.ref, query.kind, path);
    // area · connector · process — 이 Cycle 에 읽는 조건이 없다 (판정 불가 · 거짓이 아니다)
    // actor · player · faction — 자리만이다
    default:
      return UNREADABLE;
  }
}

/** clock — 시계와 비에서 유도된다 (저장되지 않는다) */
function readClock(
  time: number,
  kind: ConditionLeaf['query']['kind'],
  path: readonly string[],
): ConditionValue | undefined | Unreadable {
  if (kind !== 'property' || path.length !== 1) return UNREADABLE;
  switch (path[0]) {
    case CLOCK_SEASON:
      return seasonAt(time);
    case CLOCK_DAY_PHASE:
      return dayPhaseAt(time);
    case CLOCK_RAIN:
      return isRainingAt(time);
    default:
      return UNREADABLE;
  }
}

/** region — 규칙의 지금 패턴(규칙 없는 방은 없음) · 개체군의 값(모르는 개체군은 0 · 지금 함수 그대로) */
function readRegion(
  state: WorldState,
  ref: string | undefined,
  kind: ConditionLeaf['query']['kind'],
  path: readonly string[],
): ConditionValue | undefined | Unreadable {
  if (kind === 'state' && path.length === 1 && path[0] === REGION_PATTERN) {
    if (ref === undefined) return UNREADABLE;
    return state.regionStates[ref]?.rule?.pattern;
  }
  if (kind === 'count' && path.length === 2 && path[0] === REGION_POPULATION) {
    return populationValueOf(state.regionStates, path[1]!);
  }
  return UNREADABLE;
}

/** source — 세계가 모르는 원천은 없음(undefined)이다 (결속의 요구가 그렇게 읽는 그대로) */
function readSource(
  state: WorldState,
  ref: string | undefined,
  kind: ConditionLeaf['query']['kind'],
  path: readonly string[],
): ConditionValue | undefined | Unreadable {
  if (ref === undefined) return UNREADABLE;
  const source = findResourceSource(ref);
  if (kind === 'exists' && path.length === 0) return source === undefined ? undefined : true;
  if (kind === 'state' && path.length === 1 && path[0] === SOURCE_PHASE) {
    if (source === undefined) return undefined;
    return sourceStateOf(state.regionStates, source.regionId, source.id).phase;
  }
  return UNREADABLE;
}

/**
 * RULE-CONDITION-HISTORY-001 (spec R2 · SPEC-006) — **기억의 그 경로를 준다.**
 *
 * IF target 이 history THEN RegionState.history 의 그 경로의 값 — 없으면 없음(undefined · EXISTS 의
 * 거짓). 한 번도 지난 적 없는 경로 · 캔 적 없는 원천에는 자리가 없고(SPEC-001 ③), 그것이 곧 답이다.
 * 되살린 세계도 같은 답이다 — history 가 PERSISTENT 이므로 (SPEC-006 경계 ②).
 * 경로의 모양이 어휘 밖이면 UNREADABLE 이다 (없는 것과 모르는 것은 다르다).
 */
function readHistory(
  state: WorldState,
  ref: string | undefined,
  kind: ConditionLeaf['query']['kind'],
  path: readonly string[],
): ConditionValue | undefined | Unreadable {
  if (kind !== 'history' || ref === undefined) return UNREADABLE;
  const history: RegionMemory | undefined = state.regionStates[ref]?.history;
  switch (path[0]) {
    case HISTORY_PASSAGES: {
      if (path.length < 2 || path.length > 3) return UNREADABLE;
      if (path.length === 3 && path[2] !== HISTORY_LAST_AT) return UNREADABLE;
      const passage = history?.passages[path[1]!];
      if (passage === undefined) return undefined;
      return path.length === 2 ? passage.times : passage.lastAt;
    }
    case HISTORY_TURNS:
      if (path.length !== 1) return UNREADABLE;
      return history?.turns;
    case HISTORY_AWAKENINGS:
      if (path.length !== 2) return UNREADABLE;
      if (path[1] === HISTORY_TIMES) return history?.awakenings.times;
      if (path[1] === HISTORY_LAST_AT) return history?.awakenings.lastAt;
      return UNREADABLE;
    case HISTORY_SOURCES: {
      if (path.length !== 3) return UNREADABLE;
      const memory = history?.sources[path[1]!];
      if (path[2] === HISTORY_TAKEN_TOTAL) return memory?.takenTotal;
      if (path[2] === HISTORY_DEPLETED_TIMES) return memory?.depletedTimes;
      if (path[2] === HISTORY_LAST_DEPLETED_AT) return memory?.lastDepletedAt;
      return UNREADABLE;
    }
    default:
      return UNREADABLE;
  }
}

/** route — 그 경로가 지금 어느 방이든 지나고 있는가. 세계가 모르는 경로는 없음이다 */
function readRoute(
  state: WorldState,
  ref: string | undefined,
  kind: ConditionLeaf['query']['kind'],
  path: readonly string[],
): ConditionValue | undefined | Unreadable {
  if (ref === undefined || kind !== 'state' || path.length !== 1 || path[0] !== ROUTE_PASSING) {
    return UNREADABLE;
  }
  if (!PRESENCE_ROUTES.some((route) => route.id === ref)) return undefined;
  return passingRegionOf(presenceStateOf(state.presences, ref), state.time) !== undefined;
}
