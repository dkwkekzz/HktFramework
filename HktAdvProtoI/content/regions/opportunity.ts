// content/regions — **방이 내미는 것** (C036 ADDED · L2-World-Foundation §4.5 · spec SPEC-002 · SPEC-003).
//
// 이 파일이 하는 일은 하나다 — 이미 세계에 선 데이터(그 방의 원천 · 그 방에 걸린 Lock)에서
// **기회의 기본형을 유도한다**. 기회를 데이터로 새로 적는 것이 아니다: 지금 이 세계에
// `RegionSpec.opportunities` 를 밝힌 방은 하나도 없고, 그래도 방마다 기회가 선다.
//
// 지키는 것.
//   ① **기회는 판정하지 않는다** (spec 기본형 ①) — availability 는 형으로 적힐 뿐 여기서 평가되지
//      않는다. 무엇을 할 수 있는가는 여전히 규칙(evaluateMinePreconditions ·
//      evaluateTransitPreconditions)이 낸다.
//   ② **유도는 저장되지 않는다** (기본형 ②) — 방을 읽을 때마다 같은 목록이 같은 차례로 선다.
//      차례는 데이터의 차례다(REGION_SPECS → 그 방의 원천 차례 → 그 방의 Lock 차례).
//   ③ **데이터가 이긴다** — 같은 id 를 `RegionSpec.opportunities` 에 적으면 그것이 유도를 덮고,
//      새 id 는 뒤에 붙는다 (SPEC-002 경계 · deriveOpportunities 가 그 경계를 진다).
//   ④ **Lock 이 없는 문에는 기회가 서지 않는다** (기본형 ③) — 이 Cycle 은 "묻는 문" 만 이름을 준다.
//      area Lock 은 문이 아니므로 세우지 않는다.
//
// 경계 규칙 4 — content/regions 는 engine 만 import 한다. 그래서 **조건의 형을 짓는 두 함수의
// 원본이 이 파일로 왔다** (아래 lockCondition · occurrenceCondition): 기회의 availability 가 바로
// 그 두 조건이고, 이 폴더는 content/world 를 부를 수 없기 때문이다. C035 가 세운 자리
// (content/world/semantic/condition.ts)는 이제 이것을 **부른다** — 두 벌로 적지 않는다 (한 사실 한 집).

import type { Condition } from '../../engine/world-authoring/condition';
import { findPoint } from '../../engine/world-authoring/description';
import type {
  Mutation,
  Opportunity,
  OpportunityDiscovery,
} from '../../engine/world-authoring/opportunity';
import { LOCK_AT_CONNECTOR, locksOfRegion, type Lock } from './access';
import type { DayPhaseId, ResourceSourceSpec } from './resource-ecology';
import { RESOURCE_LAYER } from './resource-ecology';
import type { SeasonId } from './phases';
import { REGION_SPECS, regionSpec } from './specs';

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
/** 기억(RegionMemory)의 경로 마디 — 원천들 */
export const HISTORY_SOURCES = 'sources';
/** 기억의 경로 마디 — 그 원천에서 여태 캔 총량 */
export const HISTORY_TAKEN_TOTAL = 'takenTotal';
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

// ── 유도 ────────────────────────────────────────────────────────────

/**
 * 한 방에서 기회를 유도하는 데 드는 것 전부 — `deriveOpportunities` 의 입력.
 *
 * 데이터를 읽는 자리(어느 원천이 실제로 섰는가)와 형을 짓는 자리(유도)를 갈라 둔다 —
 * 유도가 순수 함수이므로 단위 시험이 **덮어쓰기 경계**를 그대로 잴 수 있다 (SPEC-002 경계).
 */
export interface OpportunityDerivation {
  region: string;
  /** 그 방에 **실제로 선** 원천들 — 차례 그대로 (자리가 없는 원천은 여기 오지 않는다) */
  sources: readonly ResourceSourceSpec[];
  /** 그 방에 걸린 **Connector** Lock 들 — 차례 그대로 (area Lock 은 문이 아니다) */
  connectorLocks: readonly (Lock & { connectorId: string })[];
  /** 그 방이 데이터로 적은 기회들 — 같은 id 는 덮고 새 id 는 뒤에 붙는다 */
  authored: readonly Opportunity[];
}

/**
 * RULE-OPPORTUNITY-DERIVE-001 (spec SPEC-002 · SPEC-003) — **기본형을 유도한다**.
 *
 * ① 원천마다 채집 기회 하나 · ② Lock 이 걸린 문마다 건너기 기회 하나 · ③ 데이터가 덮는다.
 * 순수 함수다 — 세계도 시각도 묻지 않고, 같은 입력에 언제나 같은 목록이 같은 차례로 나온다.
 */
export function deriveOpportunities(input: OpportunityDerivation): readonly Opportunity[] {
  const derived: Opportunity[] = [];
  // ① 채집 — 그 방의 원천 차례 그대로
  for (const source of input.sources) {
    // availability = 그 원천의 조건 둘 — 때(occurrence · dayPhases)와 원천이 밝힌 조건.
    // 둘 다 있으면 all 로 묶고, 둘 다 없으면 **자리 자체가 없다** (언제나 참을 지어내지 않는다).
    const availability = allOf(
      [occurrenceCondition(source.occurrence?.seasons, source.dayPhases), source.condition].filter(
        (condition): condition is Condition => condition !== undefined,
      ),
    );
    const world: Mutation[] = [{ group: 'entity', op: 'CHANGE_STATE', ref: source.id }];
    derived.push({
      id: gatherOpportunityId(source.id),
      region: input.region,
      ...(availability === undefined ? {} : { availability }),
      discovery: DISCOVERY_BY_ROLE[source.opportunity] ?? DISCOVERY_FALLBACK,
      target: { kind: 'source', ref: source.id },
      possibleActions: ['gather'],
      // 캘수록 오르는 셈 하나 — 값을 여기서 읽지 않는다 (이 Cycle 은 자리와 이름뿐이다)
      progress: { kind: 'counter', ref: sourceTakenTotalPath(source.id) },
      outcomes: { world, yield: ['Material'] },
    });
  }
  // ② 건너기 — 그 방이 적은 Lock 차례 그대로. **묻는 문만** 이름을 얻는다
  for (const lock of input.connectorLocks) {
    const availability = lockCondition(lock);
    derived.push({
      id: crossOpportunityId(lock.connectorId),
      region: input.region,
      ...(availability === undefined ? {} : { availability }),
      // 문은 보인다 — 어떻게 알게 되는가를 묻지 않아도 거기 서 있다 (spec SPEC-003)
      discovery: 'VISIBLE',
      target: { kind: 'connector', ref: lock.connectorId },
      possibleActions: ['cross'],
      progress: { kind: 'none' },
      outcomes: { world: [], yield: ['Access'] },
    });
  }
  // ③ 데이터가 이긴다 — 같은 id 는 덮고(자리는 그대로), 새 id 는 뒤에 붙는다
  const result = derived.map(
    (opportunity) =>
      input.authored.find((authored) => authored.id === opportunity.id) ?? opportunity,
  );
  for (const authored of input.authored) {
    if (!derived.some((opportunity) => opportunity.id === authored.id)) result.push(authored);
  }
  return result;
}

/**
 * 그 방이 내미는 것들 — 없으면 빈 목록이다 (백왕령은 원천도 Lock 도 없어 기회가 0 이다).
 *
 * **저장되지 않는다** — 부를 때마다 데이터에서 다시 선다 (sourcesInRegion · LOCKS 와 같은 갈래).
 */
export function opportunitiesOf(regionId: string): readonly Opportunity[] {
  const spec = regionSpec(regionId);
  if (spec === undefined) return [];
  // 실제로 선 원천만 — **판정도 차례도 sourcesInRegion 의 것 그대로다**
  // (content/world/semantic/resource.ts 가 그 판정의 원본이다: 그 방 Description 의 resource
  //  layer 에 자기 id 의 point 가 있어야 원천이 선다). 이 폴더는 world 를 부를 수 없으므로
  //  같은 판정을 여기서 한 줄로 되짚는다 — 값이 갈리면 검사 ㊺ 이 유령을 잡는다.
  const sources = (spec.resourceEcology?.sources ?? []).filter(
    (source) => findPoint(spec.space, RESOURCE_LAYER, source.id) !== undefined,
  );
  // 그 방이 적은 Lock 가운데 **문에 걸린 것만** — 자락(area) Lock 은 문이 아니다
  const connectorLocks = locksOfRegion(regionId)
    .filter((lock) => lock.at.kind === LOCK_AT_CONNECTOR)
    .map((lock) => ({ ...lock, connectorId: lock.at.ref }));
  return deriveOpportunities({
    region: regionId,
    sources,
    connectorLocks,
    authored: spec.opportunities ?? [],
  });
}

/**
 * 이 세계의 기회 전부 — **방 차례 그대로**, 한 방 안에서는 위 유도의 차례 그대로다.
 *
 * 사본이 아니다: 출처는 각 방의 데이터 하나이고 여기는 그것을 펴 놓은 색인이다 (LOCKS 의 어법).
 * 도구도 검사도 이 차례로 읽으므로 두 번 돌리면 글자까지 같다.
 */
export const ALL_OPPORTUNITIES: readonly Opportunity[] = REGION_SPECS.flatMap((spec) =>
  opportunitiesOf(spec.id),
);

/**
 * 그 방에서 **그 행동이 그 대상에 걸릴 때** 속하는 기회 — 없으면 없다(undefined).
 *
 * 관찰의 투영(RULE-OPPORTUNITY-NAME-001)이 쓰는 조회다. 먼저 선 것을 답으로 준다 —
 * 한 대상의 한 행동에 기회가 둘 서면 그것은 데이터의 일이고, 검사 ㊻ 의 표에 드러난다.
 */
export function opportunityForAction(
  regionId: string,
  action: string,
  targetRef: string,
): Opportunity | undefined {
  return opportunitiesOf(regionId).find(
    (opportunity) =>
      opportunity.target.ref === targetRef &&
      (opportunity.possibleActions as readonly string[]).includes(action),
  );
}

// ── 안쪽 ─────────────────────────────────────────────────────────────

/** 항 여럿을 all 로 — 하나면 그것 그대로, 없으면 undefined (묻지 않는 것과 같다) */
function allOf(items: readonly Condition[]): Condition | undefined {
  if (items.length === 0) return undefined;
  if (items.length === 1) return items[0];
  return { all: items };
}
