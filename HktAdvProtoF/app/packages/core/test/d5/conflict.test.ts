// D5-b 단위 테스트 — 겹친다고 다툼은 아니다. 다툼이 되는 조건은 둘뿐이다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { Band } from '../../src/s0/index.ts';
import {
  edgeIdOf,
  graphIdOf,
  nodeIdOf,
  type DependencyEdge,
  type DependencyGraph,
  type DependencyNode,
  type NodeCondition,
  type NodeTarget,
} from '../../src/d1/index.ts';
import { evaluatePressure, snapshotOf, type SlotValue, type WorldSnapshot } from '../../src/d4/index.ts';
import {
  bandsCompatible,
  checkConflict,
  claimsFrom,
  conflictLine,
  contestsOf,
  demandOf,
  judge,
  judgeAll,
  severityOf,
  supplyOf,
  type ConflictViolation,
  type Contest,
  type DependencyClaim,
  type DependencyConflict,
} from '../../src/d5/index.ts';

const NOW = 400;
const beaterId = deterministicId('subject', 'person', '몰이꾼 04');
const priestId = deterministicId('subject', 'person', '사제 09');
const wormId = deterministicId('subject', 'creature', '장막벌레');
const meatId = deterministicId('entity', 'material', '말린 고기');
const canyonId = deterministicId('entity', 'place', '국경 협곡');
const hamletId = deterministicId('entity', 'place', '아랫마을');

const entity = (id: string, name: string): NodeTarget => ({
  ontology: 'Entity',
  id,
  name,
  entityKind: 'material',
  domain: null,
});

const cond = (domain: string, path: string, holderId: string, band: Band): NodeCondition => ({
  kind: 'slot',
  slot: { domain: domain as never, path },
  holderId,
  band,
});

const range = (min: number, max: number): Band => ({ kind: 'range', min, max });
const is = (value: string): Band => ({ kind: 'is', value });

function node(
  subjectId: string,
  kind: DependencyNode['kind'],
  label: string,
  target: NodeTarget | null,
  condition: NodeCondition,
): DependencyNode {
  return {
    id: nodeIdOf(subjectId, kind, label),
    subjectId,
    kind,
    label,
    target,
    condition,
    note: '겨울을 나려면 필요하다',
  };
}

function edge(from: DependencyNode, to: DependencyNode, substitutability: number): DependencyEdge {
  return {
    id: edgeIdOf(from.id, to.id, 'requires'),
    from: from.id,
    to: to.id,
    relation: 'requires',
    strength: 0.9,
    urgency: 0.6,
    substitutability,
    failureDelayTicks: 30,
    failureEffects: [],
    note: '이것이 없으면 저것이 무너진다',
  };
}

/** 사냥꾼 하나 — 몸(뿌리) · 식량(대상 겹침) · 두 곳의 자리(주체 안 겹침) · 벌레의 몸(주체 간). */
function hunterGraph(subjectId: string, name: string): DependencyGraph {
  const hunger = node(subjectId, 'body', '주린 몸', null, cond('biological', 'hunger', subjectId, range(0, 0.6)));
  const food = node(
    subjectId,
    'resource',
    '겨울 식량',
    entity(meatId, '말린 고기'),
    cond('economic', `stock.${meatId}`, subjectId, range(3, 1000000)),
  );
  const hunt = node(subjectId, 'space', '사냥터', entity(canyonId, '국경 협곡'), cond('physical', 'region', subjectId, is(canyonId)));
  const hut = node(subjectId, 'space', '겨울 움막', entity(hamletId, '아랫마을'), cond('physical', 'region', subjectId, is(hamletId)));
  // 벌레의 몸을 **깎기를** 원한다 — 사냥감이다.
  const prey = node(
    subjectId,
    'subject',
    '사냥감',
    entity(wormId, '장막벌레'),
    cond('biological', 'vitality', wormId, range(0, 0.2)),
  );
  return {
    id: graphIdOf(subjectId, name),
    subjectId,
    name,
    nodes: [hunger, food, hunt, hut, prey],
    edges: [edge(hunger, food, 0.7), edge(food, hunt, 0.2), edge(hunger, hut, 0.4), edge(food, prey, 0.5)],
    rootIds: [hunger.id],
  };
}

/** 장막벌레 — 제 몸이 **성하기를** 원한다. ModulePlan D5 예시의 구조다. */
function wormGraph(): DependencyGraph {
  const body = node(wormId, 'body', '성한 몸', null, cond('biological', 'vitality', wormId, range(0.3, 1)));
  return {
    id: graphIdOf(wormId, '장막벌레의 겨울'),
    subjectId: wormId,
    name: '장막벌레의 겨울',
    nodes: [body],
    edges: [],
    rootIds: [body.id],
  };
}

const beaterGraph = hunterGraph(beaterId, '몰이꾼의 겨울');
const priestGraph = hunterGraph(priestId, '사제의 겨울');
const GRAPHS = [beaterGraph, priestGraph, wormGraph()];
const CLAIMS = claimsFrom(GRAPHS);

const slot = (domain: string, holderId: string, path: string, value: SlotValue['value']): SlotValue => ({
  domain: domain as never,
  holderId,
  path,
  value,
});

/** 그 틱의 세계 — 사냥꾼 둘의 창고에 각각 이만큼. */
function worldAt(stock: number): WorldSnapshot {
  return snapshotOf(
    [
      slot('biological', beaterId, 'hunger', 0.3),
      slot('biological', priestId, 'hunger', 0.3),
      slot('biological', wormId, 'vitality', 0.7),
      slot('physical', beaterId, 'region', canyonId),
      slot('physical', priestId, 'region', canyonId),
      slot('economic', beaterId, `stock.${meatId}`, stock),
      slot('economic', priestId, `stock.${meatId}`, stock),
    ],
    NOW,
  ).snapshot;
}

const REPORTS = GRAPHS.map((graph) => evaluatePressure(graph, worldAt(0)));
const rulesOf = (violations: readonly ConflictViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];
const contestFor = (key: string): Contest =>
  contestsOf(CLAIMS).find((contest) => contest.key.includes(key)) as Contest;

describe('D5-b 겹침은 두 축에서 난다', () => {
  test('자리 축 — 문자 그대로 한 값을 둘이 본다', () => {
    const slots = contestsOf(CLAIMS).filter((contest) => contest.axis === 'slot');
    const keys = slots.map((contest) => contest.key).sort();
    assert.deepEqual(keys, [
      `biological.${wormId}.vitality`, // 사냥꾼 둘과 벌레 자신 — 주체 간
      `physical.${beaterId}.region`, // 사냥터 vs 움막 — 주체 안
      `physical.${priestId}.region`,
    ].sort());
  });

  test('대상 축 — 자리는 각자의 것인데 가리키는 것이 하나다', () => {
    const targets = contestsOf(CLAIMS).filter((contest) => contest.axis === 'target');
    assert.equal(targets.some((contest) => contest.key === meatId), true, '말린 고기');
    assert.equal(targets.some((contest) => contest.key === canyonId), true, '국경 협곡');
  });

  test('같은 무리가 두 축에 걸리면 자리 축만 남는다 — 같은 다툼을 두 번 세지 않는다', () => {
    const contests = contestsOf(CLAIMS);
    const wormSlot = contests.filter((contest) => contest.key === `biological.${wormId}.vitality`);
    const wormTarget = contests.filter((contest) => contest.key === wormId);
    assert.equal(wormSlot.length, 1);
    // 벌레의 몸은 자리로도 대상으로도 겹치는데, 남는 것은 자리 축 하나다.
    assert.equal(wormTarget.length, 0);
  });

  test('겹침은 한 주체 안일 수도 여럿 사이일 수도 있다', () => {
    assert.equal(contestFor(`physical.${beaterId}.region`).scope, 'internal');
    assert.equal(contestFor(`biological.${wormId}.vitality`).scope, 'between');
  });

  test('혼자 보는 자리는 겹침이 아니다', () => {
    const alone = contestsOf(claimsFrom([wormGraph()]));
    assert.deepEqual(alone, []);
  });
});

describe('D5-b 다툼이 되는 조건은 둘뿐이다', () => {
  test('한 몸이 두 곳에 있을 수 없다 — 주체 안의 opposed (D2 가 D5 에 넘긴 자리)', () => {
    const { conflict } = judge(contestFor(`physical.${beaterId}.region`), { reports: REPORTS });
    assert.notEqual(conflict, null);
    assert.equal(conflict?.reason, 'opposed');
    assert.equal(conflict?.scope, 'internal');
    assert.match(conflict?.note ?? '', /한 값이 두 곳에 동시에 있을 수는 없다/);
  });

  test('사냥꾼은 벌레의 몸이 깎이기를, 벌레는 성하기를 원한다 — 주체 간의 opposed', () => {
    const { conflict } = judge(contestFor(`biological.${wormId}.vitality`), { reports: REPORTS });
    assert.equal(conflict?.reason, 'opposed');
    assert.equal(conflict?.scope, 'between');
    assert.equal(conflict?.sides.length, 3, '사냥꾼 둘과 그 몸의 주인이 함께 선다');
  });

  test('창고가 넉넉하면 같은 고기를 가리켜도 다툼이 아니다', () => {
    const { conflict, peace } = judge(contestFor(meatId), {
      reports: REPORTS,
      world: worldAt(10),
    });
    assert.equal(conflict, null);
    assert.match(peace?.reason ?? '', /모자라지 않으면 다툼이 아니다/);
  });

  test('창고가 비면 같은 고기가 다툼이 된다 — scarcity', () => {
    const { conflict } = judge(contestFor(meatId), { reports: REPORTS, world: worldAt(1) });
    assert.equal(conflict?.reason, 'scarcity');
    assert.equal(conflict?.axis, 'target');
    assert.match(conflict?.note ?? '', /모자라는 만큼이 다툼이다/);
  });

  test('모자람만이 세계를 묻는다 — 세계를 주지 않으면 다툼이 서지 않는다', () => {
    const { conflict, peace } = judge(contestFor(meatId), { reports: REPORTS });
    assert.equal(conflict, null);
    assert.match(peace?.reason ?? '', /세계를 보지 않고는/);
  });

  test('배타적 점유는 유예다 — 수치로 재지 않는 대역은 모자람을 잴 수 없다', () => {
    const { conflict, peace } = judge(contestFor(canyonId), { reports: REPORTS, world: worldAt(10) });
    assert.equal(conflict, null);
    assert.match(peace?.reason ?? '', /W 계층으로 유예/);
  });

  test('같은 자리를 봐도 대역이 함께 서면 다툼이 아니다', () => {
    const together: Contest = {
      ...contestFor(`physical.${beaterId}.region`),
      claims: contestFor(`physical.${beaterId}.region`).claims.map((claim) => ({
        ...claim,
        band: is(canyonId),
      })),
    };
    const { conflict, peace } = judge(together, { reports: REPORTS });
    assert.equal(conflict, null);
    assert.match(peace?.reason ?? '', /겹친다고 다툼은 아니다/);
  });

  test('대역이 함께 설 수 있는가는 값으로 답한다', () => {
    assert.equal(bandsCompatible(is(canyonId), is(hamletId)), false);
    assert.equal(bandsCompatible(is(canyonId), is(canyonId)), true);
    assert.equal(bandsCompatible(range(0, 0.2), range(0.3, 1)), false);
    assert.equal(bandsCompatible(range(0, 0.4), range(0.3, 1)), true);
    assert.equal(bandsCompatible(is('x'), range(0, 1)), false, '수가 아닌 값은 범위에 들지 않는다');
  });
});

describe('D5-b 급함은 D4 에서 읽어 온다', () => {
  test('다툼의 급함은 양쪽 압력의 최대값이다', () => {
    const { conflict } = judge(contestFor(meatId), { reports: REPORTS, world: worldAt(0) });
    assert.notEqual(conflict, null);
    assert.equal(conflict?.severity, severityOf(conflict?.sides ?? []));
    assert.ok((conflict?.severity ?? 0) > 0, '창고가 바닥났으면 압력이 0 일 수 없다');
  });

  test('보고를 주지 않으면 급함은 0 이다 — D5 는 재지 않는다', () => {
    const { conflict } = judge(contestFor(meatId), { world: worldAt(0) });
    assert.equal(conflict?.severity, 0);
  });

  test('최소 필요량과 세계의 총량은 값에서 나온다', () => {
    const contest = contestFor(meatId);
    assert.deepEqual(
      contest.claims.map((claim) => demandOf(claim)),
      [3, 3],
    );
    assert.equal(supplyOf(contest, worldAt(4)), 8, '지닌 자마다 한 번씩만 센다');
  });
});

describe('D5-b 설 수 없는 다툼은 사유와 함께 물린다', () => {
  const sound = judge(contestFor(meatId), { reports: REPORTS, world: worldAt(0) })
    .conflict as DependencyConflict;
  const options = { reports: REPORTS, world: worldAt(0) };

  test('온전한 다툼에는 아무 말도 남지 않는다', () => {
    assert.deepEqual(checkConflict(sound, CLAIMS, options), []);
  });

  test('한쪽뿐인 다툼이 걸린다', () => {
    const lonely = { ...sound, sides: sound.sides.slice(0, 1) };
    assert.deepEqual(rulesOf(checkConflict(lonely, CLAIMS, options)), ['lonely-conflict']);
  });

  test('겹치지도 않은 요구 둘을 다툼이라 적으면 걸린다', () => {
    const stranger = CLAIMS.find((claim) => claim.label === '주린 몸') as DependencyClaim;
    const mixed = {
      ...sound,
      sides: [sound.sides[0]!, { ...sound.sides[1]!, claimId: stranger.id }],
    };
    assert.equal(
      rulesOf(checkConflict(mixed, CLAIMS, options)).includes('unrelated-conflict'),
      true,
    );
  });

  test('양립 불가라고 적었으나 대역이 함께 서면 걸린다', () => {
    const opposed = judge(contestFor(`physical.${beaterId}.region`), options)
      .conflict as DependencyConflict;
    const faked = {
      ...opposed,
      sides: opposed.sides.map((side) => ({ ...side, band: is(canyonId) })),
      key: opposed.key,
    };
    // 요구 자체는 그대로이므로 대역은 요구에서 다시 읽는다 — 꾸며도 판정은 요구를 본다.
    assert.deepEqual(checkConflict(faked, CLAIMS, options), []);

    const claimsWithSameBand = CLAIMS.map((claim) =>
      claim.slot.path === 'region' && claim.holderId === beaterId
        ? { ...claim, band: is(canyonId) }
        : claim,
    );
    assert.deepEqual(rulesOf(checkConflict(opposed, claimsWithSameBand, options)), [
      'reasonless-conflict',
    ]);
  });

  test('모자람을 주장하면서 세계를 보지 않으면 걸린다', () => {
    assert.deepEqual(rulesOf(checkConflict(sound, CLAIMS, { reports: REPORTS })), [
      'scarcity-without-world',
    ]);
  });

  test('급함을 손으로 고쳐 넣으면 D4 와 어긋난다', () => {
    assert.deepEqual(rulesOf(checkConflict({ ...sound, severity: 0.99 }, CLAIMS, options)), [
      'severity-drift',
    ]);
  });

  test('이기는 자를 적으면 걸린다 — 그것은 E0·E3 의 몫이다', () => {
    const decided = { ...sound, winnerId: beaterId } as unknown as DependencyConflict;
    assert.equal(rulesOf(checkConflict(decided, CLAIMS, options)).includes('winner-declared'), true);
  });

  test('다툼 하나는 사람이 읽는 한 줄로 선다', () => {
    assert.match(conflictLine(sound), /\[scarcity\]/);
    assert.match(conflictLine(sound), /급함 \d\.\d\d/);
  });
});

describe('D5-b 겹침 전부를 한꺼번에 판정한다', () => {
  test('다툼과 다툼 아닌 것이 함께 남는다 — 사유와 함께', () => {
    const { conflicts, peaces } = judgeAll(contestsOf(CLAIMS), {
      reports: REPORTS,
      world: worldAt(0),
    });
    assert.equal(conflicts.length + peaces.length, contestsOf(CLAIMS).length);
    assert.deepEqual(
      conflicts.map((conflict) => conflict.reason).sort(),
      ['opposed', 'opposed', 'opposed', 'scarcity'].sort(),
    );
    assert.ok(peaces.length > 0, '다툼이 아닌 겹침도 값으로 남아야 한다');
  });

  test('창고를 채우면 다툼 하나가 사라진다 — 같은 그래프인데', () => {
    const poor = judgeAll(contestsOf(CLAIMS), { reports: REPORTS, world: worldAt(0) });
    const rich = judgeAll(contestsOf(CLAIMS), { reports: REPORTS, world: worldAt(10) });
    assert.equal(poor.conflicts.length - rich.conflicts.length, 1);
    assert.equal(rich.conflicts.some((conflict) => conflict.reason === 'scarcity'), false);
  });
});
