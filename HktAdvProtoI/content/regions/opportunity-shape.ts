// content/regions — **기회와 조건의 형을 짓는 자리** (C036 · C037 CHANGED).
//
// 여기 있는 것은 **형을 짓는 순수 함수와 어휘**뿐이다 — 세계에 무엇이 실제로 섰는지(REGION_SPECS ·
// LOCKS · 그 방의 원천)를 하나도 묻지 않는다. 그것을 묻는 자리는 곁의 `opportunity.ts` 다.
//
// 왜 갈렸는가 (C037) — 방 데이터(`forest-edge.ts`)가 **자기 기회를 데이터로 적기** 시작했기
// 때문이다. 그 방이 기본형을 짓는 함수를 부르려면 그 함수가 사는 파일이 REGION_SPECS 를 읽어서는
// 안 된다 (방 → 기회 → 방들의 색인 → 방 … 으로 도는 초기화가 생긴다). 그래서 **형을 짓는 쪽**과
// **세계를 훑는 쪽**을 갈라 둔다: 이 파일은 아무것도 훑지 않는다.
//
// 경계 규칙 4 — content/regions 는 engine 만 import 한다. 그래서 조건의 형을 짓는 두 함수
// (lockCondition · occurrenceCondition)의 원본이 이 폴더에 있다 (C036 에서 옮겨 왔다):
// 기회의 availability 가 바로 그 두 조건이고, 이 폴더는 content/world 를 부를 수 없기 때문이다.
// C035 가 세운 자리(content/world/semantic/condition.ts)는 이제 이것을 **부른다** — 두 벌로
// 적지 않는다 (한 사실 한 집).

import type { Condition } from '../../engine/world-authoring/condition';
import type {
  Mutation,
  Opportunity,
  OpportunityDiscovery,
} from '../../engine/world-authoring/opportunity';
import type { Lock } from './access';
import type { DayPhaseId, ResourceSourceSpec } from './resource-ecology';
import type { SeasonId } from './phases';

// ── 조건의 형을 짓는 자리 (C035 에서 **옮겨 왔다** — 값도 형도 한 글자 다르지 않다) ──
//
// 옮긴 까닭은 경계 하나다 (위 머리말) — 옮기며 바뀐 것은 자리뿐이고, 부르는 쪽
// (worldConditionSites · 검사 ㊹ · C035 시나리오)이 받는 답은 같다.

/** clock 이 내는 값의 경로 — 지금 철 (조건 어휘의 그 글자 그대로) */
export const CONDITION_PATH_SEASON = 'season';
/** clock 이 내는 값의 경로 — 지금 낮밤 */
export const CONDITION_PATH_DAY_PHASE = 'dayPhase';
/** region · state — 그 방 규칙의 지금 패턴 (RegionRuleState.pattern) */
const REGION_PATTERN = 'pattern';
/** source · state — 그 원천의 지금 phase (ResourceSourceState.phase) */
export const SOURCE_STATE_PHASE = 'phase';
/** 그 phase 의 값 하나 — 지금 그 자리에 서 있다 (캘 수 있다) */
export const SOURCE_PHASE_AVAILABLE = 'available';
/** 기억(RegionMemory)의 경로 마디 — 원천들 */
export const HISTORY_SOURCES = 'sources';
/** 기억의 경로 마디 — 그 원천에서 여태 캔 총량 */
export const HISTORY_TAKEN_TOTAL = 'takenTotal';
/** 기억의 경로 마디 — 지나간 것들 (C037 ADDED · condition.ts 의 읽기가 쓰는 그 글자) */
export const HISTORY_PASSAGES = 'passages';
/** 기억의 경로 마디 — 마지막으로 그렇게 된 세계 시각 */
export const HISTORY_LAST_AT = 'lastAt';
/** 경로 마디를 잇는 글자 (기반 ConditionQuery.path 의 어법) */
const PATH_SEPARATOR = '.';

/**
 * 그 원천의 **셈이 사는 경로** — `sources.<원천 id>.takenTotal`.
 *
 * 채집 기회의 progress.ref 가 이것이고, 조건 어휘(worldConditionVocabulary 의 history query)가
 * 짓는 경로도 이것이다 — **짓는 자리를 하나로 둔다** (검사 ㊺ 이 그 경로를 어휘에서 찾는다).
 */
export function sourceTakenTotalPath(sourceId: string): string {
  return [HISTORY_SOURCES, sourceId, HISTORY_TAKEN_TOTAL].join(PATH_SEPARATOR);
}

/**
 * 그 경로가 **이 방을 마지막으로 지난 시각**이 사는 경로 — `passages.<경로 id>.lastAt` (C037 ADDED).
 *
 * Event 의 availability 가 이 경로를 시간 qualifier 로 읽는다 (아래 `timedGatherOpportunity`).
 * 조건 어휘(worldConditionVocabulary 의 history query)가 이미 이 글자를 짓고 있고, 여기는
 * 그것과 **같은 자리를 가리키는 한 함수**다 — 데이터가 손으로 이어 붙이지 않게 한다.
 */
export function passageLastAtPath(routeId: string): string {
  return [HISTORY_PASSAGES, routeId, HISTORY_LAST_AT].join(PATH_SEPARATOR);
}

/**
 * RULE-CONDITION-READ-001 (C035) — **문의 요구를 형으로 읽는다** (Lock.requires).
 *
 * time 항 → `{ target: clock, query: property 'season', operator: IN, value: seasons }`
 * state 항 → `{ target: region <ref>, query: state 'pattern', operator: IN, value: patterns }`
 * property 항 → `{ target: actor, query: capability <tag>, operator: EXISTS }` (자리만 — 판정 불가)
 * knowledge 항 → `{ target: actor, query: knowledge <name>, operator: EXISTS }` (자리만 — 판정 불가)
 * 요구 하나의 항들은 all 로, 요구 여럿도 all 로 묶는다 (K2 — 전부 참이어야 열린다).
 * 항이 하나도 없는 Lock 은 undefined 다 (묻지 않는 것과 같다).
 */
export function lockCondition(lock: Lock): Condition | undefined {
  const requirements: Condition[] = [];
  for (const requirement of lock.requires) {
    const items: Condition[] = [];
    // 항의 차례는 형(LockRequirement)이 적은 차례다 — property · time · state · knowledge
    if (requirement.property !== undefined) {
      items.push({
        target: { kind: 'actor' },
        query: { kind: 'capability', path: requirement.property },
        operator: 'EXISTS',
      });
    }
    if (requirement.time !== undefined) {
      items.push({
        target: { kind: 'clock' },
        query: { kind: 'property', path: CONDITION_PATH_SEASON },
        operator: 'IN',
        value: requirement.time.seasons,
      });
    }
    if (requirement.state !== undefined) {
      items.push({
        target: { kind: 'region', ref: requirement.state.region },
        query: { kind: 'state', path: REGION_PATTERN },
        operator: 'IN',
        value: requirement.state.patterns,
      });
    }
    if (requirement.knowledge !== undefined) {
      items.push({
        target: { kind: 'actor' },
        query: { kind: 'knowledge', path: requirement.knowledge },
        operator: 'EXISTS',
      });
    }
    const one = allOf(items);
    if (one !== undefined) requirements.push(one);
  }
  return allOf(requirements);
}

/**
 * RULE-CONDITION-READ-001 (C035) — **원천의 때를 형으로 읽는다** (occurrence · dayPhases).
 *
 * seasons → `{ target: clock, query: property 'season', operator: IN, value: seasons }`
 * dayPhases → `{ target: clock, query: property 'dayPhase', operator: IN, value: dayPhases }`
 * 둘 다 밝혔으면 all. 둘 다 밝히지 않은 원천은 undefined 다 (어느 때에도 선다).
 */
export function occurrenceCondition(
  seasons: readonly SeasonId[] | undefined,
  dayPhases: readonly DayPhaseId[] | undefined,
): Condition | undefined {
  const items: Condition[] = [];
  // 철이 먼저, 낮밤이 다음 — sourceConditions 가 묻는 차례 그대로다
  if (seasons !== undefined) {
    items.push({
      target: { kind: 'clock' },
      query: { kind: 'property', path: CONDITION_PATH_SEASON },
      operator: 'IN',
      value: seasons,
    });
  }
  if (dayPhases !== undefined) {
    items.push({
      target: { kind: 'clock' },
      query: { kind: 'property', path: CONDITION_PATH_DAY_PHASE },
      operator: 'IN',
      value: dayPhases,
    });
  }
  return allOf(items);
}

// ── 기회의 id 와 발견의 표 ──────────────────────────────────────────

/** 유도된 채집 기회의 id 머리 — `gather:<원천 id>` (코드의 자리이지 사람이 읽을 이름이 아니다) */
export const OPPORTUNITY_GATHER_PREFIX = 'gather:';
/** 유도된 건너기 기회의 id 머리 — `cross:<문 id>` */
export const OPPORTUNITY_CROSS_PREFIX = 'cross:';

/** 그 원천의 채집 기회 id */
export function gatherOpportunityId(sourceId: string): string {
  return `${OPPORTUNITY_GATHER_PREFIX}${sourceId}`;
}

/** 그 문의 건너기 기회 id */
export function crossOpportunityId(connectorId: string): string {
  return `${OPPORTUNITY_CROSS_PREFIX}${connectorId}`;
}

/**
 * 원천의 **자리 역할 → 어떻게 알게 되는가** (spec SPEC-002 · 묶음 질문 Q3 의 답).
 *
 * 넷(baseline · by-product · risk · conditional)은 **흔적이 말한다**(TRACE) — 그 자리에 늘 있고
 * 둘레의 흙이 그것을 먼저 말하기 때문이다. `world-event` 하나만 **신호로 온다**(SIGNAL) —
 * 때를 맞춰야만 얻는 자리라 그 자리가 아니라 세계가 말한다.
 *
 * HIDDEN 은 이 표에 없다 (spec SPEC-001 경계 ② — 이 Cycle 의 데이터에 HIDDEN 은 없다).
 */
const DISCOVERY_BY_ROLE: Readonly<Record<string, OpportunityDiscovery>> = {
  baseline: 'TRACE',
  'by-product': 'TRACE',
  risk: 'TRACE',
  conditional: 'TRACE',
  'world-event': 'SIGNAL',
};

/** 표에 없는 역할은 흔적으로 읽는다 — 늘 그 자리에 있는 것이 이 세계의 기본이다 */
const DISCOVERY_FALLBACK: OpportunityDiscovery = 'TRACE';


/**
 * 원천 하나의 **채집 기회 기본형** — 위 유도 ① 이 세우는 그 한 자리다 (C036).
 *
 * 따로 선 이유는 하나다: Event 데이터(아래 `timedGatherOpportunity`)가 **기본형을 덮되
 * 달라지는 것은 둘(availability · outcomes)뿐**이어야 하는데, 나머지 항목을 데이터 쪽에서
 * 손으로 다시 적으면 어느 날 하나가 갈린다 (discovery 가 SIGNAL 이 아니게 되는 날). 여기서
 * 지어 그리로 건네면 그 자리가 생기지 않는다 (단위 시험이 그것을 잰다).
 */
export function gatherOpportunity(region: string, source: ResourceSourceSpec): Opportunity {
  // availability = 그 원천의 조건 둘 — 때(occurrence · dayPhases)와 원천이 밝힌 조건.
  // 둘 다 있으면 all 로 묶고, 둘 다 없으면 **자리 자체가 없다** (언제나 참을 지어내지 않는다).
  const availability = allOf(
    [occurrenceCondition(source.occurrence?.seasons, source.dayPhases), source.condition].filter(
      (condition): condition is Condition => condition !== undefined,
    ),
  );
  const world: Mutation[] = [{ group: 'entity', op: 'CHANGE_STATE', ref: source.id }];
  return {
    id: gatherOpportunityId(source.id),
    region,
    ...(availability === undefined ? {} : { availability }),
    discovery: DISCOVERY_BY_ROLE[source.opportunity] ?? DISCOVERY_FALLBACK,
    target: { kind: 'source', ref: source.id },
    possibleActions: ['gather'],
    // 캘수록 오르는 셈 하나 — 값을 여기서 읽지 않는다 (이 Cycle 은 자리와 이름뿐이다)
    progress: { kind: 'counter', ref: sourceTakenTotalPath(source.id) },
    outcomes: { world, yield: ['Material'] },
  };
}

/** 때가 있는 채집 기회를 짓는 데 드는 것 — `timedGatherOpportunity` 의 입력 (C037 ADDED) */
export interface TimedGatherInput {
  region: string;
  /** 그 방에 선 원천 — 기본형의 나머지 항목이 여기서 온다 */
  source: ResourceSourceSpec;
  /** 그것을 두고 가는 경로의 id — 방의 기억이 그 열쇠로 센다 */
  routeId: string;
  /** 그 지나감으로부터 몇 초 안인가 — **원천의 recoverySeconds 를 그대로 옮긴다** */
  withinSeconds: number;
}

/**
 * **때가 있는 기회 — Event** (C037 ADDED · spec SPEC-001 · SPEC-002 · SPEC-005).
 *
 * 기본형(gatherOpportunity)에서 달라지는 것은 둘뿐이다.
 *   availability  그 원천이 이미 밝힌 조건 뒤에 **시간 qualifier 한 잎**이 붙는다 —
 *                 `history <이 방> . history passages.<경로>.lastAt EXISTS WITHIN <초>`.
 *                 값은 그 원천의 `recoverySeconds` 를 **그대로 옮긴 것**이고 새 값이 아니다
 *                 (spec World Change 1 · 기본형 ①). 시간 qualifier 를 가진 잎이 있다는 것이
 *                 곧 Event 라는 뜻이다 (`isEventOpportunity` · G4).
 *   outcomes      주우면 세계에서 둘이 일어나고(원천의 phase 가 옮겨 간다 · 소지에 재료가 든다)
 *                 붙잡는 사람에게 둘이 남는다(재료 · 세계에의 영향 = 소란).
 *
 * 나머지 항목(discovery · target · possibleActions · progress · region · id)은 기본형 그대로다 —
 * 덮어쓰기가 그 값을 **한 값도 바꾸지 않는다** (SPEC-005 경계 · 단위 시험이 잰다).
 *
 * **여기서 판정하는 것이 하나도 없다** (기본형 ①) — 지금 열려 있는가는 세계가 그 형을 평가해
 * 유도한다 (RULE-OPPORTUNITY-OPEN-001 · content/world/semantic/opportunity-open.ts).
 */
export function timedGatherOpportunity(input: TimedGatherInput): Opportunity {
  const { region, source, routeId, withinSeconds } = input;
  const base = gatherOpportunity(region, source);
  const within: Condition = {
    target: { kind: 'history', ref: region },
    query: { kind: 'history', path: passageLastAtPath(routeId) },
    operator: 'EXISTS',
    qualifier: { kind: 'time', mode: 'WITHIN', seconds: withinSeconds },
  };
  // 그리고 **지금 그 자리에 서 있는가** (C037 Human 판정) — 이 잎이 없으면 판이 거짓말을 한다:
  // 지나감이 끝나기 전에는 아직 서지 않았고, 주워 간 뒤에는 없는데 때만으로는 둘 다 "열림" 이다.
  // 세계 쪽에서는 RULE-PRESENCE-LEFT-FADE-001 이 머무는 동안이 지나면 그 자리를 거두므로,
  // 이 셋(지났다 · 그 초 안이다 · 서 있다)이 함께여야 열림과 **실제로 할 수 있는 것**이 같다.
  const standing: Condition = {
    target: { kind: 'source', ref: source.id },
    query: { kind: 'state', path: SOURCE_STATE_PHASE },
    operator: '==',
    value: SOURCE_PHASE_AVAILABLE,
  };
  const availability = allOf(
    [base.availability, within, standing].filter((it): it is Condition => it !== undefined),
  );
  return {
    ...base,
    ...(availability === undefined ? {} : { availability }),
    outcomes: {
      world: [
        // 캐고 나면 그 원천의 마디가 옮겨 간다 (RULE-MINE-COMPLETE-001 — 기본형과 같은 줄)
        { group: 'entity', op: 'CHANGE_STATE', ref: source.id },
        // 세계의 것이 캔 사람의 것이 된다 (RULE-MINE-COMPLETE-001 — 소지에 재료 하나)
        { group: 'ownership', op: 'GRANT', ref: source.materialId },
      ],
      // 재료가 남고, 그 방이 술렁인다 (RULE-DISTURBANCE-001 — 캐는 일이 소란을 올린다)
      yield: ['Material', 'WorldInfluence'],
    },
  };
}

// ── 안쪽 ─────────────────────────────────────────────────────────────

/** 항 여럿을 all 로 — 하나면 그것 그대로, 없으면 undefined (묻지 않는 것과 같다) */
export function allOf(items: readonly Condition[]): Condition | undefined {
  if (items.length === 0) return undefined;
  if (items.length === 1) return items[0];
  return { all: items };
}
