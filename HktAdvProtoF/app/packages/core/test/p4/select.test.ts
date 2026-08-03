// P4-c 단위 테스트 — 점수는 요소에서 나오고, 선행이 선 것만 고르며, 관성은 문턱이다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import type { Possibility } from '../../src/o1/index.ts';
import type { ValueTarget } from '../../src/s0/index.ts';
import { evaluatePressure, snapshotOf, type SlotValue } from '../../src/d4/index.ts';
import { expandStrategies } from '../../src/p1/index.ts';
import { narrowTree } from '../../src/p2/index.ts';
import { buildContext, expandSubgraph } from '../../src/p3/index.ts';
import {
  checkSelection,
  INERTIA_MARGIN,
  scoreOf,
  selectGoal,
  selectionSummary,
  selectionVerdict,
  totalWeight,
  type ActiveGoal,
  type SelectSpec,
} from '../../src/p4/index.ts';

import {
  berryId,
  denId,
  keeperGrammar,
  knowingGraphOf,
  lodeClaimId,
  neighborId,
  plain,
  worldAt,
} from '../p3/fixture.ts';

const graph = knowingGraphOf(plain.id);
const slots: readonly SlotValue[] = [
  { domain: 'biological', path: 'hunger', holderId: plain.id, value: 0.3 },
  { domain: 'biological', path: 'fertility', holderId: plain.id, value: 0.5 },
  { domain: 'economic', path: `stock.${berryId}`, holderId: plain.id, value: 0 },
  { domain: 'physical', path: 'region', holderId: plain.id, value: denId },
  { domain: 'informational', path: `knows.${lodeClaimId}`, holderId: plain.id, value: 0 },
];
const tree = narrowTree(
  expandStrategies(graph, evaluatePressure(graph, snapshotOf(slots, 100).snapshot), {}),
  keeperGrammar,
);
const world = worldAt(4);

/** 지금 굴과 열매를 보는 굴짐승 — 근거가 있어야 갈래가 펴진다. */
const seeing = buildContext({
  subjectId: plain.id,
  tick: 100,
  world,
  grammar: keeperGrammar,
  percepts: [
    { holderId: berryId, domain: 'physical', path: 'integrity' },
    { holderId: denId, domain: 'physical', path: 'cover' },
  ],
});
/** 서른 틱 전에 본 것이 전부인 굴짐승 — 다시 보는 것이 먼저다. */
const remembering = buildContext({
  subjectId: plain.id,
  tick: 100,
  world,
  grammar: keeperGrammar,
  memories: [
    { holderId: berryId, domain: 'physical', path: 'integrity', value: 0.2, asOfTick: 70 },
    { holderId: denId, domain: 'physical', path: 'cover', value: 0.2, asOfTick: 70 },
  ],
});

const trustValue: ValueTarget = {
  slot: { domain: 'relational', path: `trust.${neighborId}` },
  holderId: plain.id,
  band: { kind: 'range', min: 0.5, max: 1 },
  weight: 0.5,
  note: '이웃과의 사이가 마르면 굴을 지킬 수 없다',
};

const specWith = (context: typeof seeing, tick = 100): SelectSpec => {
  const subgraph = expandSubgraph({ tree, graph, context });
  return {
    subject: { id: plain.id, values: [trustValue] },
    world,
    tree,
    context,
    subgraph,
    tick,
  };
};

const spec = specWith(seeing);
const candidates = spec.subgraph.active;

describe('P4-c 점수·선택·관성', () => {
  test('점수는 요소 아홉에서 재계산된다 — 손으로 적은 점수는 걸린다', () => {
    const selection = selectGoal(candidates, spec);
    assert.equal(selection.complete, true);
    for (const score of selection.scores) {
      assert.equal(score.score, scoreOf(score.factors));
      assert.ok(score.score >= -1 && score.score <= 1);
    }
    assert.equal(totalWeight(selection.scores[0]?.factors ?? []), 4.7);

    const forged = checkSelection({
      ...selection,
      scores: selection.scores.map((score, index) =>
        index === 0 ? { ...score, score: 0.99 } : score,
      ),
    });
    assert.ok(forged.some((violation) => violation.rule === 'score-drift'));
  });

  test('후보는 점수 내림차순으로 서고, 고른 것은 그중 지금 낼 수 있는 1위다', () => {
    const selection = selectGoal(candidates, spec);
    const ready = selection.scores.filter((score) => score.ready);
    assert.ok(ready.length > 0);
    assert.equal(selection.goal?.possibilityId, ready[0]?.possibilityId);
    assert.equal(selection.goal?.change, 'first');
    assert.equal(selection.goal?.commitmentInertia, 0);
    assert.ok(selectionVerdict(selection).length > 0);
    assert.equal(selectionSummary(selection).length, 9);

    for (let index = 1; index < selection.scores.length; index += 1) {
      const before = selection.scores[index - 1]?.score ?? 0;
      const after = selection.scores[index]?.score ?? 0;
      assert.ok(before >= after, `${String(before)} >= ${String(after)}`);
    }
  });

  test('선행이 걸린 후보는 지금 고를 수 없다 — 고르는 일이 앞칸으로 옮겨 간다', () => {
    // 기억으로만 아는 굴짐승은 다시 보는 것(찾기)이 먼저 걸린다.
    const memorySpec = specWith(remembering);
    const selection = selectGoal(memorySpec.subgraph.active, memorySpec);
    const withPre = selection.scores.filter((score) => score.blockedBy.length > 0);
    assert.ok(withPre.length > 0);
    for (const score of withPre) assert.equal(score.ready, false);

    // 고른 것은 선행이 없는 갈래다.
    assert.equal(selection.goal === null || selection.goal.possibilityId !== '', true);
    if (selection.goal !== null) {
      const standing = selection.scores.find(
        (score) => score.possibilityId === selection.goal?.possibilityId,
      );
      assert.equal(standing?.ready, true);
      assert.deepEqual(standing?.blockedBy, []);
    }
  });

  test('재료 선행이 막힌 후보도 지금 고를 수 없다 — 먼저 낼 원자가 남는다', () => {
    const selection = selectGoal(candidates, spec);
    const blocked = selection.scores.filter((score) => score.awaits.length > 0);
    for (const score of blocked) {
      assert.equal(score.ready, false);
      assert.ok(score.note.includes('먼저'));
    }
  });

  test('가장 급한 것이 항상 뽑히지는 않는다 — 압력 1위와 선택은 다를 수 있다', () => {
    const memorySpec = specWith(remembering);
    const selection = selectGoal(memorySpec.subgraph.active, memorySpec);
    assert.notEqual(selection.mostPressing, null);
    if (selection.goal !== null && selection.mostPressing !== null) {
      const pressing = selection.mostPressing;
      const chosen = selection.scores.find(
        (score) => score.possibilityId === selection.goal?.possibilityId,
      );
      // 압력 1위가 선행에 걸려 있으면 선택은 다른 곳으로 간다.
      if (!pressing.ready) assert.notEqual(chosen?.possibilityId, pressing.possibilityId);
    }
  });

  test('한 번 고른 목적은 문턱을 넘지 않으면 바뀌지 않는다', () => {
    const first = selectGoal(candidates, spec);
    const goal = first.goal as ActiveGoal;

    // 다음 틱 — 같은 세계면 같은 것을 지킨다.
    const next = selectGoal(candidates, { ...spec, tick: 105, previousGoal: goal });
    assert.equal(next.goal?.possibilityId, goal.possibilityId);
    assert.equal(next.goal?.change, 'kept');
    assert.equal(next.goal?.changed, false);
    assert.equal(next.goal?.commitmentInertia, INERTIA_MARGIN);
    // 좇기 시작한 시각은 그대로다 — 매몰비용이 여기서 자란다.
    assert.equal(next.goal?.sinceTick, goal.sinceTick);
    assert.equal(next.goal?.heldTicks, 5);
  });

  test('2위를 좇던 자는 1위가 문턱을 넘을 때만 갈아탄다', () => {
    const selection = selectGoal(candidates, spec);
    const ready = selection.scores.filter((score) => score.ready);
    const top = ready[0];
    const second = ready.find((score) => score.possibilityId !== top?.possibilityId);
    assert.ok(top !== undefined && second !== undefined);

    const stale: ActiveGoal = {
      subjectId: plain.id,
      tick: 99,
      possibilityId: second.possibilityId,
      nodeId: second.nodeId,
      label: second.label,
      direction: second.direction,
      viaAtom: second.viaAtom,
      score: second.score,
      commitmentInertia: INERTIA_MARGIN,
      sinceTick: 90,
      heldTicks: 9,
      changed: false,
      change: 'kept',
      note: '',
    };
    const kept = selectGoal(candidates, { ...spec, previousGoal: stale });
    const gap = top.score - second.score;
    assert.equal(kept.margin, gap);
    assert.equal(
      kept.goal?.possibilityId,
      gap > INERTIA_MARGIN ? top.possibilityId : second.possibilityId,
    );
    assert.equal(kept.goal?.change, gap > INERTIA_MARGIN ? 'outscored' : 'kept');
  });

  test('관성은 사라진 목적을 붙들지 못한다 — 결핍이 채워졌는가 길이 닫혔는가로 갈린다', () => {
    const selection = selectGoal(candidates, spec);
    const goal = selection.goal as ActiveGoal;

    // ① 그 결핍 자체가 갈래에 없다 → 채워졌다
    const fulfilled = selectGoal(candidates, {
      ...spec,
      previousGoal: { ...goal, possibilityId: 'possibility:없는것', nodeId: 'dep-node:없는것' },
    });
    assert.equal(fulfilled.goal?.change, 'fulfilled');
    assert.equal(fulfilled.goal?.commitmentInertia, 0);

    // ② 결핍은 남았는데 그 가능성이 서지 않는다 → 길이 닫혔다
    const gone = selectGoal(candidates, {
      ...spec,
      previousGoal: { ...goal, possibilityId: 'possibility:닫힌길' },
    });
    assert.equal(gone.goal?.change, 'gone');
  });

  test('후보가 없으면 목적도 없다 — 던지지 않는다', () => {
    const empty = selectGoal([], spec);
    assert.equal(empty.goal, null);
    assert.equal(empty.scores.length, 0);
    assert.equal(empty.complete, true);
    assert.ok(selectionVerdict(empty).includes('없다'));
    assert.deepEqual(selectionSummary(empty), ['고를 수 있는 후보가 없다']);
  });

  test('손으로 고쳐 넣은 목적은 관문에서 걸린다', () => {
    const selection = selectGoal(candidates, spec);
    const goal = selection.goal as ActiveGoal;

    // ① 후보에 없는 것을 좇는다
    assert.ok(
      checkSelection({ ...selection, goal: { ...goal, possibilityId: 'possibility:없는것' } }).some(
        (violation) => violation.rule === 'unheld-goal',
      ),
    );

    // ② 선행이 서지 않은 것을 골랐다
    const notReady = selection.scores.find((score) => !score.ready);
    if (notReady !== undefined) {
      assert.ok(
        checkSelection({
          ...selection,
          goal: { ...goal, possibilityId: notReady.possibilityId, score: notReady.score },
        }).some((violation) => violation.rule === 'premature-goal'),
      );
    }

    // ③ 밀어낼 것이 없는데 문턱이 붙었다 · 아직 오지 않은 시각부터 좇는다
    assert.ok(
      checkSelection({ ...selection, goal: { ...goal, commitmentInertia: 0.5 } }).some(
        (violation) => violation.rule === 'inertia-without-history',
      ),
    );
    assert.ok(
      checkSelection({ ...selection, goal: { ...goal, sinceTick: goal.tick + 10 } }).some(
        (violation) => violation.rule === 'inertia-without-history',
      ),
    );
  });

  test('같은 재료면 같은 선택이다', () => {
    assert.equal(stateHash(selectGoal(candidates, spec)), stateHash(selectGoal(candidates, spec)));
  });
});
