// D5 검증 장면 — 다섯 종이 한 세계에 서면 무엇이 부딪히는가.
//
// D4 까지의 겨울에는 사냥꾼 넷이 있었지만 넷은 서로를 몰랐다. 각자의 그래프가 있고 각자의
// 압력이 있었을 뿐이다. 원문 §18 이 다툼을 다주체가 선 뒤에 두는 이유가 그것이다 —
// 혼자 있는 세계에는 다툴 것이 없다.
//
// 여기서 같은 겨울에 **나머지 넷을 마저 세운다**(장막벌레·채집 결사·협곡을 낀 나라·붉은 장막의
// 어미 — D2 가 이미 종의 그래프를 찍어 두었다). 그러면 넷이 보인다.
//
//   ① **한 몸이 두 곳에 있을 수 없다.** 사냥꾼은 사냥터(협곡)와 겨울 움막(마을)을 함께
//      요구하는데 그 둘은 같은 자리(`physical.region`)의 다른 값이다 — 넷이 각자 제 안에
//      이 다툼을 지고 있다. **D2 가 명시적으로 D5 에 넘긴 자리다.**
//   ② **창고가 비면 넷이 같은 고기를 놓고 갈린다.** 재고 10 에서는 같은 것을 원해도 다툼이
//      아니다 — 넷의 요구를 합쳐도 세계에 있는 것이 더 많기 때문이다. 바닥나면 그 순간
//      다툼이 선다. **단계 3 의 대표 장면("두 인간이 음식 하나를 원한다")이 여기서 값으로 선다.**
//   ③ **겹치는데 다투지 않는 자리가 더 많다.** 사냥꾼과 결사는 같은 협곡을 보고, 셋이 같은
//      통행법을 보고, 벌레와 신은 같은 둥지를 본다 — 그런데 셋 다 다툼이 아니다. 각각의
//      사유가 값으로 남는다(대역이 함께 설 수 있거나, 수용량을 적을 자리가 세계에 없거나).
//   ④ **누가 이기는지는 아무도 모른다.** D5 는 다툼이 났다는 것과 각자가 얼마나 급한지까지다.
//
// 세계도 그래프도 새로 짓지 않는다 — D4 장면의 세계와 D2 가 찍은 종의 그래프를 그대로 쓴다.

import type { Id } from '@hkt/core/v1';
import { specimenOf, buildSpeciesGraph } from '@hkt/core/d2';
import type { DependencyGraph } from '@hkt/core/d1';
import { evaluatePressure, type PressureReport, type WorldSnapshot } from '@hkt/core/d4';
import {
  auditConflicts,
  bipartiteOf,
  checkConflict,
  claimsFrom,
  conflictTable,
  contestsOf,
  detectConflicts,
  judge,
  openConflictField,
  type Bipartite,
  type ConflictAudit,
  type ConflictRow,
  type ConflictViolation,
  type Contest,
  type DependencyClaim,
  type DependencyConflict,
  type DetectResult,
  type JudgeOptions,
  type Peace,
} from '@hkt/core/d5';

import { VEIL_BLUEPRINTS } from './d2-veil-blueprints.ts';
import {
  HUNGER_SINCE,
  NOW,
  STOCK_TREND,
  bareGraph,
  foodNodeId,
  greedyGraph,
  priestGraph,
  trackerGraph,
  worldAt,
} from './d4-veil-world.ts';
import {
  bareInstance,
  greedyInstance,
  priestInstance,
  trackerInstance,
} from './s3-veil-instances.ts';

export { NOW, STOCK_TREND };

/** 사냥꾼 넷 — D4 가 세운 개인 그래프 그대로. */
const HUNTER_GRAPHS: readonly DependencyGraph[] = [
  trackerGraph,
  greedyGraph,
  bareGraph,
  priestGraph,
];

/** 나머지 넷 — 개체가 아직 없으므로 **종의 표본**으로 세운다 (D2 `specimenOf`). */
const OTHER_GRAPHS: readonly DependencyGraph[] = VEIL_BLUEPRINTS.filter(
  (entry) => entry.archetype.name !== '사냥꾼',
).map((entry) =>
  buildSpeciesGraph(entry.archetype, entry.blueprint, specimenOf(entry.archetype, '성체')),
);

/** 같은 겨울에 함께 선 여덟 — 사냥꾼 넷과 종 표본 넷. */
export const GRAPHS: readonly DependencyGraph[] = [...HUNTER_GRAPHS, ...OTHER_GRAPHS];

/** 사람이 읽는 이름. */
export const LABELS: ReadonlyMap<Id, string> = new Map([
  [trackerInstance.id, '몰이꾼 04'],
  [greedyInstance.id, '감춘 몫의 11'],
  [bareInstance.id, '빈손의 07'],
  [priestInstance.id, '사제 09'],
  ...OTHER_GRAPHS.map(
    (graph, index) =>
      [
        graph.subjectId,
        VEIL_BLUEPRINTS.filter((entry) => entry.archetype.name !== '사냥꾼')[index]?.archetype
          .name ?? graph.name,
      ] as const,
  ),
]);

/** 그 재고일 때가 언제인가 — D4 가 적어 둔 창고의 줄에서 읽는다. */
export function tickForStock(stock: number): number {
  return STOCK_TREND.find((entry) => entry.stock === stock)?.tick ?? NOW;
}

/** 그 걸음의 세계. */
export function worldFor(stock: number): WorldSnapshot {
  return worldAt(tickForStock(stock), stock);
}

/**
 * 그 걸음의 압력 — **D5 는 급함을 다시 재지 않고 여기서 읽어 온다.**
 * 결핍이 언제부터인지(`since`)도 D4 장면이 적어 둔 값 그대로다.
 */
export function reportsAt(stock: number): readonly PressureReport[] {
  const world = worldFor(stock);
  return GRAPHS.map((graph) => {
    const foodId = foodNodeId(graph);
    const since = foodId === '' ? undefined : new Map([[foodId, HUNGER_SINCE]]);
    return evaluatePressure(graph, world, since === undefined ? {} : { since });
  });
}

export function optionsAt(stock: number): {
  readonly reports: readonly PressureReport[];
  readonly world: WorldSnapshot;
} {
  return { reports: reportsAt(stock), world: worldFor(stock) };
}

/** 창고가 가득할 때 — 같은 것을 원해도 다툼이 아닌 자리들. */
export const FULL: DetectResult = detectConflicts(GRAPHS, optionsAt(10));
/** 창고가 바닥났을 때 — 대표 장면이 서는 자리. */
export const EMPTY: DetectResult = detectConflicts(GRAPHS, optionsAt(0));

/** 요구 전부 (D5-a). */
export const CLAIMS: readonly DependencyClaim[] = claimsFrom(GRAPHS);
/** 겹침 전부 (D5-b) — 다툼이든 아니든. */
export const CONTESTS: readonly Contest[] = contestsOf(CLAIMS);

/** 바닥난 겨울의 감사. */
export const AUDIT: ConflictAudit = auditConflicts(EMPTY.field, EMPTY, GRAPHS, optionsAt(0));
/** 가득한 겨울의 감사 — 대조군. */
export const FULL_AUDIT: ConflictAudit = auditConflicts(FULL.field, FULL, GRAPHS, optionsAt(10));

/** 주체마다 무엇에 끼어 있는가. */
export const TABLE: readonly ConflictRow[] = conflictTable(EMPTY.field, GRAPHS, LABELS);
/** 주체↔경합 대상 이분 그래프 (공용 렌더러 ②). */
export const BIPARTITE: Bipartite = bipartiteOf(EMPTY.field, LABELS);
/** 가득한 겨울의 이분 그래프 — 다툼 하나가 없다. */
export const FULL_BIPARTITE: Bipartite = bipartiteOf(FULL.field, LABELS);

/** 다툼이 되지 못한 겹침들 — **위반이 아니라 사실이다**. */
export const PEACES: readonly Peace[] = EMPTY.field.peaces;
/** 그것을 어떻게 다루는가 — 화면과 시나리오가 같은 문장을 쓴다. */
export const PEACE_NOTE =
  '아니다 — 겹친다고 다툼은 아니다. 이것을 다툼으로 세면 세계는 모든 겹침이 싸움인 곳이 되고, 다툼이 흔해지면 아무 뜻도 없어진다';
/** 이기는 자를 정하지 않는 이유. */
export const NO_WINNER_NOTE =
  'D5 는 다툼이 났다는 것과 각자가 얼마나 급한지까지다 — 상황으로 묶는 것은 E0, 결과를 확정하는 것은 E3 다. 누가 누구와 싸우는지조차 아직 아무도 모른다(서로를 봐야 알고 그것은 R3·R4 다)';

/** 창고가 비어 가는 걸음 — 어느 칸에서 다툼이 서는가. */
export interface StockStep {
  readonly stock: number;
  readonly conflicts: number;
  readonly scarcity: number;
  readonly peaces: number;
  readonly note: string;
}

export const STOCK_WALK: readonly StockStep[] = [10, 6, 4, 2, 0].map((stock) => {
  const result = detectConflicts(GRAPHS, optionsAt(stock));
  const scarcity = result.field.conflicts.filter(
    (conflict) => conflict.reason === 'scarcity',
  ).length;
  return {
    stock,
    conflicts: result.field.conflicts.length,
    scarcity,
    peaces: result.field.peaces.length,
    note: scarcity === 0 ? '같은 것을 원해도 다툼은 아니다' : '넷이 같은 고기를 놓고 갈린다',
  };
});

/** 겹침 하나가 어떻게 판정됐는가 — 화면의 대조표. */
export interface ContestRow {
  readonly axis: Contest['axis'];
  readonly label: string;
  readonly claims: number;
  readonly subjects: number;
  readonly scope: Contest['scope'];
  readonly verdict: string;
  readonly reason: string;
  readonly severity: number;
}

export const CONTEST_ROWS: readonly ContestRow[] = CONTESTS.map((contest) => {
  const judged = judge(contest, optionsAt(0));
  return {
    axis: contest.axis,
    label: contest.label,
    claims: contest.claims.length,
    subjects: contest.subjectIds.length,
    scope: contest.scope,
    verdict: judged.conflict === null ? '다툼 아님' : judged.conflict.reason,
    reason: judged.conflict?.note ?? judged.peace?.reason ?? '',
    severity: judged.conflict?.severity ?? 0,
  };
});

/** 대표 장면 — 넷이 같은 고기를 놓고. */
export const FOOD_CONFLICT: DependencyConflict | null =
  EMPTY.field.conflicts.find((conflict) => conflict.reason === 'scarcity') ?? null;
/** 한 몸이 두 곳에 — 주체 안의 다툼 하나. */
export const BODY_CONFLICT: DependencyConflict | null =
  EMPTY.field.conflicts.find((conflict) => conflict.scope === 'internal') ?? null;

/** 설 수 없는 다툼 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenConflict {
  readonly broke: string;
  readonly expected: string;
  /** 다툼을 세우는 자리에서 걸리는가(judge), 검사할 때 걸리는가(audit) */
  readonly at: 'judge' | 'audit';
  readonly rules: readonly string[];
  readonly messages: readonly string[];
}

const rulesOf = (violations: readonly { readonly rule: string }[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];
const messagesOf = (violations: readonly { readonly message: string }[]): readonly string[] =>
  violations.map((violation) => violation.message);

const sound = FOOD_CONFLICT as DependencyConflict;
const checkOne = (
  conflict: DependencyConflict,
  claims: readonly DependencyClaim[] = CLAIMS,
  options: JudgeOptions = optionsAt(0),
): readonly ConflictViolation[] =>
  checkConflict(conflict, claims, { graphs: GRAPHS, ...options }, []);

/** ① 한쪽뿐인 다툼. */
const lonely = checkOne({ ...sound, sides: sound.sides.slice(0, 1) });

/** ② 겹치지도 않은 요구를 한쪽으로 세운다. */
const stranger = CLAIMS.find((claim) => claim.label === '주린 몸') as DependencyClaim;
const unrelated = checkOne({
  ...sound,
  sides: [sound.sides[0] as (typeof sound.sides)[number], { ...(sound.sides[1] as (typeof sound.sides)[number]), claimId: stranger.id }],
});

/** ③ 요구 목록에 없는 요구가 한쪽으로 선다. */
const phantom = checkOne(sound, []);

/** ④ 모자람을 주장하면서 세계를 보지 않는다. */
const worldless = checkOne(sound, CLAIMS, { reports: reportsAt(0), world: null });

/** ⑤ 급함을 손으로 고쳐 넣는다. */
const drifted = checkOne({ ...sound, severity: 0.99 });

/** ⑥ 이기는 자를 적는다. */
const decided = checkOne({ ...sound, winnerId: trackerInstance.id } as unknown as DependencyConflict);

/** ⑦ 양립 불가라고 적었으나 대역이 함께 선다. */
const bodyConflict = BODY_CONFLICT as DependencyConflict;
const softened = checkOne(
  bodyConflict,
  CLAIMS.map((claim) =>
    claim.slot.path === 'region' ? { ...claim, band: { kind: 'is', value: 'entity:같은 곳' } as const } : claim,
  ),
);

/** ⑧ 다툼을 충돌장에서 빠뜨린다 (감사에서만 걸린다). */
const shortField = {
  ...EMPTY.field,
  conflicts: EMPTY.field.conflicts.filter((conflict) => conflict.reason !== 'scarcity'),
  byKey: new Map(
    EMPTY.field.conflicts
      .filter((conflict) => conflict.reason !== 'scarcity')
      .map((conflict) => [conflict.key, conflict]),
  ),
};
const missing = auditConflicts(shortField, EMPTY, GRAPHS, optionsAt(0)).violations;

/** ⑨ 시간을 요구로 세운다 (D5-a). */
const clockNode = GRAPHS.flatMap((graph) => graph.nodes).find(
  (node) => node.condition.kind === 'clock',
);
const clockClaim = auditConflicts(
  EMPTY.field,
  {
    ...EMPTY,
    claims: [
      ...CLAIMS,
      { ...(CLAIMS[0] as DependencyClaim), nodeId: clockNode?.id ?? '', label: clockNode?.label ?? '' },
    ],
  },
  GRAPHS,
  optionsAt(0),
).violations;

export const BROKEN_CONFLICTS: readonly BrokenConflict[] = [
  {
    broke: '한쪽뿐인 다툼을 적는다',
    expected: 'lonely-conflict',
    at: 'audit',
    rules: rulesOf(lonely),
    messages: messagesOf(lonely),
  },
  {
    broke: '겹치지도 않은 요구를 한쪽으로 세운다',
    expected: 'unrelated-conflict',
    at: 'audit',
    rules: rulesOf(unrelated),
    messages: messagesOf(unrelated),
  },
  {
    broke: '요구 목록에 없는 요구가 다툼의 한쪽으로 선다',
    expected: 'phantom-claim',
    at: 'audit',
    rules: rulesOf(phantom),
    messages: messagesOf(phantom),
  },
  {
    broke: '모자람을 주장하면서 세계를 보지 않는다',
    expected: 'scarcity-without-world',
    at: 'audit',
    rules: rulesOf(worldless),
    messages: messagesOf(worldless),
  },
  {
    broke: '급함을 손으로 고쳐 넣는다',
    expected: 'severity-drift',
    at: 'audit',
    rules: rulesOf(drifted),
    messages: messagesOf(drifted),
  },
  {
    broke: '이기는 자를 적는다',
    expected: 'winner-declared',
    at: 'audit',
    rules: rulesOf(decided),
    messages: messagesOf(decided),
  },
  {
    broke: '양립 불가라고 적었으나 대역이 함께 선다',
    expected: 'reasonless-conflict',
    at: 'audit',
    rules: rulesOf(softened),
    messages: messagesOf(softened),
  },
  {
    broke: '조건을 갖춘 다툼을 충돌장에서 빠뜨린다',
    expected: 'missing-contest',
    at: 'audit',
    rules: rulesOf(missing),
    messages: messagesOf(missing),
  },
  {
    broke: '주기 조건을 요구로 세운다 (시간은 자리를 잡지 않는다)',
    expected: 'clock-claim',
    at: 'judge',
    rules: rulesOf(clockClaim),
    messages: messagesOf(clockClaim),
  },
];

/** 빈 충돌장은 아무 어긋남도 내지 않는다 (경계). */
export const EMPTY_AUDIT: ConflictAudit = auditConflicts(
  openConflictField(),
  { claims: [], contests: [], field: openConflictField() },
  [],
  optionsAt(0),
);

/** 혼자 선 세계에는 다툴 것이 없다 (경계). */
export const ALONE: DetectResult = detectConflicts([trackerGraph], optionsAt(0));
