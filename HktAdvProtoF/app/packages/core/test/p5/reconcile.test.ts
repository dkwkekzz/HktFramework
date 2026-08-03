// P5-b 단위 테스트 — 원문이 일곱 줄로 적은 사슬이 우리 사슬에서 나오는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import { atomResolutionOf } from '../../src/p0/index.ts';
import { buildContext } from '../../src/p3/index.ts';
import {
  buildPlan,
  chainSummary,
  chainVerdict,
  checkChain,
  CHAIN_RECONCILIATION,
  DEFERRED_STEPS,
  P5_CHAIN,
  reconcileChain,
  type ActionPlan,
} from '../../src/p5/index.ts';

import { berryId, keeperGrammar, plain, worldAt } from '../p3/fixture.ts';

const world = worldAt(0);
const context = buildContext({ subjectId: plain.id, tick: 100, world, grammar: keeperGrammar });

/** 원문 예시의 마지막 걸음(치료제 제작 = 생산)을 목적으로 세운 계획. */
const plan: ActionPlan = buildPlan({
  actorId: plain.id,
  goal: {
    possibilityId: 'possibility:치료 재료 확보',
    label: '치료 재료',
    direction: 'produce',
    viaAtom: 'produce',
  },
  world,
  context,
  targetId: null,
});

const rules = (report: { readonly violations: readonly { readonly rule: string }[] }): readonly string[] => [
  ...new Set(report.violations.map((violation) => violation.rule)),
];

describe('P5-b 원문 사슬 대조', () => {
  test('원문 일곱은 16원자 안에서 성립한다 — 새 행동을 만들지 않는다', () => {
    assert.equal(P5_CHAIN.length, 7);
    const report = reconcileChain();
    assert.equal(report.complete, true);
    assert.deepEqual(report.unresolved, []);
    assert.deepEqual(report.danglingTargets, []);
  });

  test('원문 일곱이 실제 계획에서 세 걸음으로 접힌다', () => {
    assert.deepEqual(plan.atoms, ['seek', 'acquire', 'produce']);
    const report = checkChain(plan);
    assert.equal(report.complete, true);
    assert.equal(report.foldedTo, 3);
    assert.deepEqual(report.unreached, []);
    assert.deepEqual(report.deferred, ['접근 권한 확보']);
    assert.equal(report.resolutions.filter((entry) => entry.reached).length, 6);
    assert.equal(chainSummary(report).length, 7);
    assert.ok(chainVerdict(report).includes('3 걸음'));
  });

  test('이동·획득·운반 셋이 획득 한 칸에 선다', () => {
    const report = checkChain(plan);
    const folded = report.resolutions.filter((entry) => entry.atoms.join(',') === 'acquire');
    assert.deepEqual(
      folded.map((entry) => entry.original),
      ['이동', '획득', '운반'],
    );
    // 그래서 일곱 줄이었는데 계획에서는 획득이 한 번만 선다.
    assert.equal(plan.atoms.filter((atom) => atom === 'acquire').length, 1);
  });

  test('P0 이 이미 환원한 이름은 여기서 다시 정하지 않는다', () => {
    // 이동은 P0 환원표에 이미 있다 — 두 곳이 같은 원자를 가리켜야 한다.
    const byP0 = atomResolutionOf('이동');
    const byP5 = CHAIN_RECONCILIATION.find((entry) => entry.original === '이동');
    assert.notEqual(byP0, null);
    assert.deepEqual(byP5?.atoms, byP0?.atoms);

    // 어긋나게 적으면 걸린다.
    const drifted = checkChain(
      plan,
      P5_CHAIN,
      CHAIN_RECONCILIATION.map((entry) =>
        entry.original === '이동' ? { ...entry, atoms: ['seize' as const] } : entry,
      ),
    );
    assert.ok(rules(drifted).includes('unresolved-step'));
  });

  test('환원되지 않는 단계는 유예로 선언해야 한다 — 선언을 지우면 걸린다', () => {
    assert.deepEqual(
      DEFERRED_STEPS.map((entry) => entry.original),
      ['접근 권한 확보'],
    );
    const bare = checkChain(plan, P5_CHAIN, CHAIN_RECONCILIATION, []);
    assert.deepEqual(rules(bare), ['unresolved-step']);
    assert.deepEqual(bare.unresolved, ['접근 권한 확보']);
  });

  test('유예로 적어 놓고 실제로는 환원되면 낡은 유예다', () => {
    const stale = checkChain(plan, P5_CHAIN, CHAIN_RECONCILIATION, [
      ...DEFERRED_STEPS,
      { original: '치료제 제작', owedTo: '아무도', reason: '' },
    ]);
    assert.ok(rules(stale).includes('stale-deferral'));
  });

  test('계획에 서지 못하는 환원은 격자가 틀렸거나 예시가 틀렸다고 지목된다', () => {
    const unreached = checkChain(
      plan,
      P5_CHAIN,
      CHAIN_RECONCILIATION.map((entry) =>
        entry.original === '치료제 제작' ? { ...entry, atoms: ['betray' as const] } : entry,
      ),
    );
    assert.deepEqual(unreached.unreached, ['치료제 제작']);
    assert.ok(rules(unreached).includes('unreached-step'));
    assert.equal(unreached.complete, false);
  });

  test('방향은 걸음이 되지 않는다 — 하나만 서면 도달이다', () => {
    const report = checkChain(plan);
    const direction = report.resolutions.find((entry) => entry.kind === 'direction');
    assert.equal(direction?.original, '치료 재료 확보');
    assert.equal(direction?.reached, true);
    // 넷 중 계획에 선 것은 둘(획득·생산)뿐인데도 도달이다 — 무엇으로 할지는 P4 가 고른다.
    assert.equal(direction?.atoms.length, 4);
  });

  test('같은 재료면 같은 대조다', () => {
    assert.equal(stateHash(checkChain(plan)), stateHash(checkChain(plan)));
    assert.ok(berryId.length > 0);
  });
});
