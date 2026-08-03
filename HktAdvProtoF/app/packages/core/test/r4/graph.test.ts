// R4-c 단위 테스트 — 여럿이 같은 자국을 읽고, 빗나간 믿음은 위반이 아니다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { ActionAtom } from '../../src/p0/index.ts';
import { buildGrammar, type PossibilityGrammar } from '../../src/p2/index.ts';
import { openField, recordPhenomena, type WorldPhenomenon } from '../../src/r2/index.ts';
import { openPerceptField, recordPercepts, type Percept } from '../../src/r3/index.ts';
import {
  auditBeliefs,
  beliefGraphVerdict,
  beliefsFor,
  believersOf,
  compareToTruth,
  interpret,
  openBeliefGraph,
  readingTable,
  recordBeliefs,
  staleBeliefs,
  unbelieved,
  type Believer,
  type BeliefViolation,
} from '../../src/r4/index.ts';

const canyonId = deterministicId('entity', 'place', '협곡');
const trackerId = deterministicId('subject', 'person', '몰이꾼');
const priestId = deterministicId('subject', 'person', '사제');
const NOW = 415;

/** 사람의 손 — 유형만으로 선 문법에서 몇을 덜어 낸다(금기 자리). */
const handOf = (denied: readonly ActionAtom[] = []): PossibilityGrammar => {
  const base = buildGrammar({
    archetype: {
      id: deterministicId('species', '사람'),
      name: '사람',
      subjectKind: 'person',
    } as never,
  });
  return {
    ...base,
    allowed: base.allowed.filter((atom) => !denied.includes(atom)),
    denied: [...base.denied, ...denied],
  };
};

const phenomenonOf = (
  name: string,
  atom: ActionAtom,
  overrides: Partial<WorldPhenomenon> = {},
): WorldPhenomenon =>
  ({
    kind: 'Phenomenon',
    id: deterministicId('phenomenon', name),
    channel: 'trace',
    intensity: 0.6,
    ambiguity: 0.73,
    placeId: canyonId,
    atTick: NOW,
    decaysAtTick: null,
    atom,
    actorId: trackerId,
    domain: 'biological',
    holderId: trackerId,
    path: 'vitality',
    effectKind: 'change',
    causeEventId: deterministicId('event', name),
    ...overrides,
  }) as WorldPhenomenon;

const perceptOf = (subjectId: string, phenomenon: WorldPhenomenon, overrides: Partial<Percept> = {}): Percept => ({
  id: deterministicId('percept', subjectId, phenomenon.id),
  subjectId,
  phenomenonId: phenomenon.id,
  channel: phenomenon.channel,
  intensity: phenomenon.intensity,
  placeId: phenomenon.placeId,
  distance: 0,
  atTick: phenomenon.atTick,
  ambiguity: phenomenon.ambiguity,
  ...overrides,
});

/** 몰이꾼의 자국 하나 — 실제로는 제거(죽임)가 냈다. */
const killTrace = phenomenonOf('죽임의 자국', 'destroy');
const phenomenonField = recordPhenomena(openField(), [killTrace]);

/** 둘이 같은 자국을 읽는다 — 같은 눈, 다른 손. */
const believers: readonly Believer[] = [
  { subjectId: trackerId, label: '몰이꾼', grammar: handOf() },
  { subjectId: priestId, label: '사제 (죽이지 않는다)', grammar: handOf(['destroy']) },
];

const perceptField = recordPercepts(openPerceptField(), [
  perceptOf(trackerId, killTrace),
  perceptOf(priestId, killTrace),
]);

const rulesOf = (violations: readonly BeliefViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('R4-c 여럿이 같은 자국을 읽는다', () => {
  test('둘이 각자의 믿음을 갖는다', () => {
    const { graph, readings } = interpret(believers, perceptField);
    assert.equal(graph.beliefs.length, 2);
    assert.deepEqual(
      readings.map((reading) => [reading.believer.label, reading.formed, reading.reinforced]),
      [
        ['몰이꾼', 1, 0],
        ['사제 (죽이지 않는다)', 1, 0],
      ],
    );
    assert.deepEqual([...believersOf(graph, killTrace.id)].sort(), [priestId, trackerId].sort());
  });

  test('같은 자국인데 짚는 것이 갈린다 — 사제의 짐작에는 죽임이 없다', () => {
    const { graph } = interpret(believers, perceptField);
    const tracker = beliefsFor(graph, trackerId)[0];
    const priest = beliefsFor(graph, priestId)[0];

    assert.equal(tracker?.suspected.includes('destroy'), true);
    assert.equal(priest?.suspected.includes('destroy'), false);
    assert.equal(priest?.suspected.length, (tracker?.suspected.length ?? 0) - 1);
  });

  test('그래서 사제는 틀리는데, 그 틀림은 감사에서 위반이 아니다', () => {
    const { graph } = interpret(believers, perceptField);
    const checks = compareToTruth(
      graph,
      phenomenonField.phenomena,
      new Map(believers.map((believer) => [believer.subjectId, believer.label])),
    );
    assert.deepEqual(
      checks.map((check) => [check.label, check.verdict]),
      [
        ['몰이꾼', 'narrowed'],
        ['사제 (죽이지 않는다)', 'wrong'],
      ],
    );

    const audit = auditBeliefs(graph, perceptField, phenomenonField, believers, NOW);
    assert.equal(audit.wrong, 1);
    assert.equal(audit.narrowed, 1);
    assert.equal(audit.complete, true, beliefGraphVerdict(audit));
    assert.match(beliefGraphVerdict(audit), /빗나감 1/);
  });

  test('통로가 원자 하나를 가리키면 둘 다 정확히 짚는다', () => {
    const broken = phenomenonOf('부서짐', 'destroy', {
      channel: 'sound',
      ambiguity: 0,
      decaysAtTick: NOW + 5,
    });
    const field = recordPhenomena(openField(), [broken]);
    const heard = recordPercepts(openPerceptField(), [
      perceptOf(trackerId, broken),
      perceptOf(priestId, broken),
    ]);
    const { graph } = interpret(believers, heard);
    const audit = auditBeliefs(graph, heard, field, believers, NOW);
    assert.equal(audit.exact, 2);
    assert.equal(audit.wrong, 0, '소리 앞에서는 사제도 틀리지 않는다');
  });
});

describe('R4-c 같은 것을 두 번 읽으면 굳는다', () => {
  test('두 번째 읽기는 믿음을 늘리지 않고 굳힌다', () => {
    const first = interpret(believers, perceptField);
    const later = recordPercepts(openPerceptField(), [
      perceptOf(trackerId, killTrace, {
        id: deterministicId('percept', trackerId, '다시'),
        atTick: NOW + 10,
      }),
    ]);
    const second = interpret([believers[0] as Believer], later, first.graph);

    assert.equal(second.graph.beliefs.length, first.graph.beliefs.length);
    assert.equal(second.readings[0]?.reinforced, 1);
    assert.equal(second.readings[0]?.formed, 0);

    const before = beliefsFor(first.graph, trackerId)[0];
    const after = beliefsFor(second.graph, trackerId)[0];
    assert.equal(after?.observations, 2);
    assert.equal(after?.lastTick, NOW + 10);
    assert.ok((after?.confidence ?? 0) >= (before?.confidence ?? 1));
    assert.deepEqual(after?.suspected, before?.suspected, '다시 봐도 후보는 통로가 정한다');
  });

  test('같은 믿음을 두 번 담아도 그래프는 그대로다', () => {
    const { graph } = interpret(believers, perceptField);
    assert.equal(recordBeliefs(graph, graph.beliefs), graph);
    assert.equal(recordBeliefs(graph, []), graph);
  });
});

describe('R4-c 감사가 위반과 사실을 가른다', () => {
  test('빈 그래프는 아무 어긋남도 내지 않는다', () => {
    const audit = auditBeliefs(
      openBeliefGraph(),
      perceptField,
      phenomenonField,
      believers,
      NOW,
    );
    assert.equal(audit.recorded, 0);
    assert.equal(audit.believing, 0);
    assert.equal(audit.complete, true);
    assert.equal(audit.unbelieved, 1, '아무도 믿지 않는 흔적은 사실이다');
  });

  test('세계에 서 있지 않은 자의 믿음은 걸린다', () => {
    const { graph } = interpret(believers, perceptField);
    const audit = auditBeliefs(graph, perceptField, phenomenonField, [believers[0] as Believer], NOW);
    assert.equal(rulesOf(audit.violations).includes('unheld-belief'), true);
    assert.equal(audit.complete, false);
  });

  test('삭은 자국 위에 남는 믿음은 사실이다 — 사라진 것도 기억에 남는다', () => {
    const fading = phenomenonOf('사라지는 자국', 'seize', { decaysAtTick: NOW + 2 });
    const field = recordPhenomena(openField(), [fading]);
    const read = recordPercepts(openPerceptField(), [perceptOf(trackerId, fading)]);
    const { graph } = interpret([believers[0] as Believer], read);

    assert.equal(staleBeliefs(graph, field, NOW).length, 0);
    assert.equal(staleBeliefs(graph, field, NOW + 50).length, 1);

    const audit = auditBeliefs(graph, read, field, [believers[0] as Believer], NOW + 50);
    assert.equal(audit.stale, 1);
    assert.equal(audit.complete, true, '삭은 자국의 믿음은 위반이 아니다');
  });

  test('아무도 아무것도 믿지 않는 흔적이 값으로 남는다', () => {
    const unseen = phenomenonOf('아무도 못 본 것', 'acquire');
    const field = recordPhenomena(phenomenonField, [unseen]);
    const { graph } = interpret(believers, perceptField);
    assert.deepEqual(
      unbelieved(graph, field.phenomena).map((phenomenon) => phenomenon.id),
      [unseen.id],
    );
  });
});

describe('R4-c 대조표', () => {
  test('흔적마다 한 줄이고 주체마다 한 칸이며 실제가 옆에 선다', () => {
    const { graph } = interpret(believers, perceptField);
    const rows = readingTable(graph, phenomenonField.phenomena, believers);
    assert.equal(rows.length, 1);
    assert.equal(Object.keys(rows[0]?.byBeliever ?? {}).length, 2);
    assert.equal(rows[0]?.believedBy, 2);
    assert.match(rows[0]?.actual ?? '', /제거|없앤다|부순다/);
    // 빗나간 칸에는 표시가 선다 — 화면에서 붉게 설 자리다.
    assert.match(rows[0]?.byBeliever['사제 (죽이지 않는다)'] ?? '', /✘/);
    assert.doesNotMatch(rows[0]?.byBeliever['몰이꾼'] ?? '', /✘/);
  });

  test('읽지 못한 자의 칸도 비지 않는다', () => {
    const { graph } = interpret([believers[0] as Believer], perceptField);
    const rows = readingTable(graph, phenomenonField.phenomena, believers);
    assert.equal(rows[0]?.byBeliever['사제 (죽이지 않는다)'], '(읽지 못했다)');
    assert.equal(rows[0]?.believedBy, 1);
  });
});
