// E0-c 단위 테스트 — 상황장은 담고, 감사가 위반과 사실을 가른다. 그리고 주체↔주체 선이 그어진다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { assembleWorld, emptyWorld, type WorldState } from '../../src/o2/index.ts';
import {
  auditSituations,
  calm,
  clusterStakes,
  detectSituations,
  fillSituationField,
  openSituationField,
  situationFieldVerdict,
  situationGraphOf,
  situationsFor,
  type SituationPair,
  type SituationStake,
} from '../../src/e0/index.ts';

const aId = deterministicId('subject', 'person', '몰이꾼 04');
const bId = deterministicId('subject', 'person', '상단 11');
const cId = deterministicId('subject', 'person', '사제 02');
const meatId = deterministicId('entity', 'thing', '말린 고기');

const stakeOf = (overrides: Partial<SituationStake>): SituationStake => ({
  id: deterministicId('stake', String(overrides.subjectId ?? aId), String(overrides.key ?? 'k')),
  subjectId: aId,
  axis: 'target',
  key: meatId,
  label: '말린 고기',
  via: 'intent',
  sourceId: 'affordance:x',
  urgency: 0.5,
  aimed: false,
  note: '',
  ...overrides,
});

const aimStakes = (fromId: string, toId: string, urgency = 0.5): readonly SituationStake[] => [
  stakeOf({
    id: deterministicId('stake', fromId, 'subject', toId),
    subjectId: fromId,
    axis: 'subject',
    key: toId,
    aimed: true,
    urgency,
  }),
  stakeOf({
    id: deterministicId('stake', toId, 'subject', toId),
    subjectId: toId,
    axis: 'subject',
    key: toId,
    aimed: false,
    urgency: 0,
  }),
];

function worldWhere(pairs: readonly (readonly [string, string])[]): WorldState {
  if (pairs.length === 0) return emptyWorld();
  return assembleWorld(
    pairs.map(([holderId, otherId], index) => ({
      kind: 'State' as const,
      id: `state:${String(index)}`,
      domain: 'relational' as const,
      ofId: holderId,
      path: `grudge.${otherId}`,
      value: 0.4,
    })),
  ).world;
}

/** 둘이 같은 고기 앞에 서고, A 만 B 를 겨눈다. */
const scene = (world = worldWhere([[aId, bId]])): ReturnType<typeof clusterStakes> =>
  clusterStakes({
    stakes: [
      stakeOf({ subjectId: aId }),
      stakeOf({ subjectId: bId, id: 'stake:b' }),
      ...aimStakes(aId, bId, 0.7),
    ],
    world,
  });

describe('E0-c 상황장은 담는다', () => {
  test('빈 상황장은 비어 있다', () => {
    const field = openSituationField();
    assert.deepEqual(field.situations, []);
    assert.equal(field.bySubject.size, 0);
  });

  test('주체별·자리별로 찾을 수 있다', () => {
    const field = fillSituationField(scene());
    assert.ok(situationsFor(field, aId).length > 0);
    assert.ok(field.byKey.has(`target:${meatId}`));
    assert.ok(field.byKey.has(`subject:${bId}`));
  });

  test('아무 상황에도 끼지 않은 주체는 사실로 남는다', () => {
    const field = fillSituationField(scene());
    assert.deepEqual(calm(field, [aId, bId, cId]), [cId]);
  });

  test('한 바퀴로 걸림부터 상황장까지 간다', () => {
    const result = detectSituations({ conflicts: [], intents: [], goals: [] });
    assert.deepEqual(result.stakes, []);
    assert.deepEqual(result.field.situations, []);
  });
});

describe('E0-c 감사는 위반과 사실을 가른다', () => {
  test('제대로 선 상황장에는 위반이 없다', () => {
    const clustered = scene();
    const audit = auditSituations({
      field: fillSituationField(clustered),
      stakes: [
        stakeOf({ subjectId: aId }),
        stakeOf({ subjectId: bId, id: 'stake:b' }),
        ...aimStakes(aId, bId, 0.7),
      ],
      subjectIds: [aId, bId, cId],
    });
    assert.deepEqual(audit.violations, []);
    assert.equal(audit.complete, true);
    assert.equal(audit.calm, 1);
    assert.equal(audit.solitudes, 0);
  });

  test('겨눔 셋과 매복이 세어진다', () => {
    const audit = auditSituations({ field: fillSituationField(scene()) });
    assert.equal(audit.recognized, 0);
    assert.equal(audit.oneSided, 2);
    assert.equal(audit.blind, 0);
    assert.equal(audit.ambushes, 2);
    assert.equal(audit.peak, 0.7);
  });

  test('상대도 그를 알면 매복이 사라진다 — 상황은 같은데 값이 갈린다', () => {
    const seen = auditSituations({
      field: fillSituationField(
        scene(
          worldWhere([
            [aId, bId],
            [bId, aId],
          ]),
        ),
      ),
    });
    assert.equal(seen.ambushes, 0);
    assert.equal(seen.oneSided, 2);
  });

  test('참여자가 하나뿐인 상황은 걸린다', () => {
    const clustered = scene();
    const broken = {
      ...clustered,
      situations: clustered.situations.map((situation) => ({
        ...situation,
        participants: [aId],
        pairs: [],
      })),
    };
    const audit = auditSituations({ field: fillSituationField(broken) });
    assert.ok(audit.violations.some((violation) => violation.rule === 'solitary-situation'));
  });

  test('걸림 없이 세운 상황은 걸린다', () => {
    const clustered = scene();
    const broken = {
      ...clustered,
      situations: clustered.situations.map((situation) => ({ ...situation, stakes: [] })),
    };
    const audit = auditSituations({ field: fillSituationField(broken) });
    assert.ok(audit.violations.some((violation) => violation.rule === 'groundless-situation'));
  });

  test('이기는 자를 적으면 걸린다 — 결과를 확정하는 것은 E3 다', () => {
    const clustered = scene();
    const broken = {
      ...clustered,
      situations: clustered.situations.map((situation) => ({ ...situation, winnerId: aId })),
    };
    const audit = auditSituations({ field: fillSituationField(broken) });
    assert.ok(audit.violations.some((violation) => violation.rule === 'outcome-declared'));
  });

  test('자기 자신과의 쌍은 걸린다', () => {
    const clustered = scene();
    const first = clustered.situations[0];
    assert.ok(first !== undefined);
    const broken = {
      ...clustered,
      situations: [
        {
          ...first,
          pairs: [{ ...(first.pairs[0] as SituationPair), leftId: aId, rightId: aId }],
        },
        ...clustered.situations.slice(1),
      ],
    };
    const audit = auditSituations({ field: fillSituationField(broken) });
    assert.ok(audit.violations.some((violation) => violation.rule === 'self-pair'));
  });

  test('걸린 적 없는 자가 쌍에 있으면 걸린다', () => {
    const clustered = scene();
    const first = clustered.situations[0];
    assert.ok(first !== undefined);
    const broken = {
      ...clustered,
      situations: [
        { ...first, pairs: [{ ...(first.pairs[0] as SituationPair), rightId: cId }] },
        ...clustered.situations.slice(1),
      ],
    };
    const audit = auditSituations({ field: fillSituationField(broken) });
    assert.ok(audit.violations.some((violation) => violation.rule === 'phantom-participant'));
  });

  test('서로 겨누는데 매복이라 적으면 걸린다', () => {
    const clustered = scene();
    const first = clustered.situations[0];
    assert.ok(first !== undefined);
    const broken = {
      ...clustered,
      situations: [
        { ...first, pairs: [{ ...(first.pairs[0] as SituationPair), aim: 'mutual' as const, ambush: true }] },
        ...clustered.situations.slice(1),
      ],
    };
    const audit = auditSituations({ field: fillSituationField(broken) });
    assert.ok(audit.violations.some((violation) => violation.rule === 'awareness-drift'));
  });

  test('둘이 걸린 자리를 빠뜨리면 걸린다 — 주장이 아니라 검사다', () => {
    const stakes = [stakeOf({ subjectId: aId }), stakeOf({ subjectId: bId, id: 'stake:b' })];
    const audit = auditSituations({ field: openSituationField(), stakes });
    assert.deepEqual(
      audit.violations.map((violation) => violation.rule),
      ['missing-situation'],
    );
  });

  test('혼자 걸린 자리는 빠뜨림이 아니다 — 사실이다', () => {
    const audit = auditSituations({
      field: openSituationField(),
      stakes: [stakeOf({ subjectId: aId })],
    });
    assert.deepEqual(audit.violations, []);
  });

  test('감사 한 줄이 난다', () => {
    const ok = auditSituations({ field: fillSituationField(scene()) });
    assert.match(situationFieldVerdict(ok), /매복/);
    const broken = auditSituations({
      field: openSituationField(),
      stakes: [stakeOf({ subjectId: aId }), stakeOf({ subjectId: bId, id: 'stake:b' })],
    });
    assert.match(situationFieldVerdict(broken), /missing-situation/);
  });
});

describe('E0-c 주체↔주체 그래프 — D5 가 긋지 않은 선', () => {
  test('노드는 전부 주체이고 선은 주체에서 주체로 간다', () => {
    const graph = situationGraphOf(fillSituationField(scene()));
    assert.deepEqual(graph.nodes.map((node) => node.id).sort(), [aId, bId].sort());
    assert.ok(graph.edges.length > 0);
    assert.ok(
      graph.edges.every(
        (edge) => [aId, bId].includes(edge.leftId) && [aId, bId].includes(edge.rightId),
      ),
    );
  });

  test('겨눈 수와 겨눔당한 수가 노드에 선다', () => {
    const graph = situationGraphOf(fillSituationField(scene()));
    const a = graph.nodes.find((node) => node.id === aId);
    const b = graph.nodes.find((node) => node.id === bId);
    assert.equal(a?.aiming, 2);
    assert.equal(a?.aimedAt, 0);
    assert.equal(b?.aiming, 0);
    assert.equal(b?.aimedAt, 2);
  });

  test('선의 굵기는 상황의 급함이고 순서는 결정적이다', () => {
    const field = fillSituationField(scene());
    const first = situationGraphOf(field);
    const again = situationGraphOf(field);
    assert.deepEqual(first, again);
    assert.equal(first.edges[0]?.weight, 0.7);
  });

  test('빈 상황장은 빈 그래프다', () => {
    assert.deepEqual(situationGraphOf(openSituationField()), { nodes: [], edges: [] });
  });
});
