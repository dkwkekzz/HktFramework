// content/regions — **방이 내미는 것** (C036 ADDED · L2-World-Foundation §4.5 · spec SPEC-002 · SPEC-003).
//
// 이 파일이 하는 일은 하나다 — 이미 세계에 선 데이터(그 방의 원천 · 그 방에 걸린 Lock)에서
// **기회의 기본형을 유도한다**. 기회를 데이터로 새로 적는 것이 아니다: 방마다 기회가 먼저 서고,
// 데이터는 그 가운데 달라지는 것만 덮는다.
//
// C037 CHANGED — `RegionSpec.opportunities` 에 **처음으로 데이터가 적힌다** (숲 가장자리의 비늘 ·
// 먹이 잔해 — 이 세계의 Event 둘). 덮되 달라지는 것은 둘뿐이다: availability 에 시간 qualifier
// 한 잎이 붙고, outcomes 가 실제 op 으로 적힌다 (아래 `timedGatherOpportunity`). 그리고 무엇이
// 남는가의 **Yield 표**(열 열넷)가 이 파일에 선다.
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
// 형을 짓는 자리는 곁의 `opportunity-shape.ts` 다 (C037 CHANGED) — 방 데이터가 자기 기회를
// 적으려면 그 함수가 REGION_SPECS 를 읽어서는 안 되기 때문이다 (도는 초기화). 이 파일은
// **세계를 훑는 쪽**이고 그것을 그대로 다시 내보낸다 (부르는 쪽의 import 는 한 자리 그대로다).

import { findPoint } from '../../engine/world-authoring/description';
import {
  OPPORTUNITY_YIELD_KINDS,
  type Opportunity,
} from '../../engine/world-authoring/opportunity';
import { LOCK_AT_CONNECTOR, locksOfRegion, type Lock } from './access';
import { crossOpportunityId, gatherOpportunity, lockCondition } from './opportunity-shape';
import type { ResourceSourceSpec } from './resource-ecology';
import { RESOURCE_LAYER } from './resource-ecology';
import { REGION_SPECS, regionSpec } from './specs';

// 형을 짓는 쪽은 곁의 파일이 소유한다 — 부르는 쪽이 두 곳에서 import 하지 않도록 여기서 편다
// (한 사실 한 집: 글자의 원본은 저기 하나이고 여기는 그것을 내보낼 뿐이다).
export * from './opportunity-shape';

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
  for (const source of input.sources) derived.push(gatherOpportunity(input.region, source));
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

// ── Yield 표 (C037 ADDED · spec SPEC-006 · Foundation G11 · §9) ──────
//
// **열 열넷이 다 선다.** 2층이 실제로 내는 것은 앞 넷(Material · Access · Discovery ·
// World Influence)뿐이고 뒤 열은 값이 0 인 채로 서 있는다 — **지워지지 않는다** (㊴ 의
// Actor 열과 같은 약속: 없다는 사실이 표에 서야 그 층이 올 자리가 보인다 · 기본형 ⑥).
//
// 여기서 판정하는 것이 하나도 없다 — 이미 선 기회들을 세어 편 것이고, 두 번 읽으면 같다.

/**
 * 뒤 열 열 — 3층 이후의 것들 (§9 표의 차례에서 앞 넷을 뺀 나머지, 기획서가 적은 차례 그대로).
 *
 * 기반의 `OPPORTUNITY_YIELD_KINDS`(앞 넷)와 갈린다: 저것은 **지금 데이터가 쓸 수 있는 어휘**라
 * 기반이 재고, 이것은 **아직 아무도 쓰지 않는 열의 이름**이라 이 세계가 든다 (없는 것을 기반의
 * 어휘로 열어 두지 않는다 — 검사 ㊺ 이 그 이름을 쓰는 데이터를 걸어야 한다).
 */
export const DEFERRED_YIELD_KINDS: readonly string[] = [
  'Item',
  'Currency',
  'Knowledge',
  'Recipe',
  'Skill',
  'Capability',
  'ClassProgress',
  'Mastery',
  'Relationship',
  'Reputation',
];

/** Yield 표의 한 열 */
export interface OpportunityYieldColumn {
  /** 열의 이름 */
  kind: string;
  /** 이 층에서 값을 가지는 열인가 — 앞 넷만 참이다 */
  standing: boolean;
  /** 이 세계의 기회 가운데 그 열에 내는 것의 수 — 뒤 열은 언제나 0 이다 */
  count: number;
}

/** 이 세계의 Yield 표 — 열 열넷 · 앞 넷만 값을 가진다 (뒤 열은 0 이고 지워지지 않는다) */
export const OPPORTUNITY_YIELD_TABLE: readonly OpportunityYieldColumn[] = [
  ...OPPORTUNITY_YIELD_KINDS.map((kind) => ({ kind: kind as string, standing: true })),
  ...DEFERRED_YIELD_KINDS.map((kind) => ({ kind, standing: false })),
].map((column) => ({
  ...column,
  count: ALL_OPPORTUNITIES.filter((opportunity) =>
    (opportunity.outcomes.yield as readonly string[]).includes(column.kind),
  ).length,
}));

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
