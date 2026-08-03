// P5-a 단위 테스트 — 한 걸음이 몇 걸음으로 펴지는가, 그리고 그 순서는 누가 정했는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import { assembleWorld, type WorldState } from '../../src/o2/index.ts';
import { ACTION_ATOMS, atomGrounding } from '../../src/p0/index.ts';
import { buildContext, prerequisitesOf } from '../../src/p3/index.ts';
import { payabilityOf } from '../../src/p4/index.ts';
import {
  buildPlan,
  checkPlan,
  MAX_PLAN_DEPTH,
  planSummary,
  planVerdict,
  STEP_REASONS,
  type ActionPlan,
  type PlanSpec,
  type PlanTarget,
} from '../../src/p5/index.ts';

import { berryId, denId, keeperGrammar, neighborId, plain, worldAt } from '../p3/fixture.ts';

/** 창고에 열매 넷 · 몸은 성하고 · 이웃과 사이가 적힌 세계 */
const stocked = worldAt(4);
/** 같은 세계에서 창고만 빈 것 */
const empty = worldAt(0);
/** 창고도 사이도 빈 것 — 쌓아 둔 것이 하나도 없는 자리 */
const bare: WorldState = {
  ...empty,
  relational: { ...empty.relational, [plain.id]: {} },
} as WorldState;

const contextFor = (world: WorldState, seen: boolean): ReturnType<typeof buildContext> =>
  buildContext({
    subjectId: plain.id,
    tick: 100,
    world,
    grammar: keeperGrammar,
    percepts: seen ? [{ holderId: berryId, domain: 'physical', path: 'integrity' }] : [],
  });

const goalOf = (atom: string): PlanTarget => ({
  possibilityId: `possibility:${atom}`,
  label: '겨울 열매',
  direction: 'fulfill',
  viaAtom: atom as 'seek',
});

const planFor = (
  atom: string,
  world: WorldState,
  seen: boolean,
  extra: Partial<PlanSpec> = {},
): ActionPlan =>
  buildPlan({
    actorId: plain.id,
    goal: goalOf(atom),
    world,
    context: contextFor(world, seen),
    targetId: berryId,
    ...extra,
  });

describe('P5-a 계획 사슬 조립', () => {
  test('지금 바로 낼 수 있으면 사슬은 한 칸이다', () => {
    const plan = planFor('acquire', stocked, true);
    assert.deepEqual(plan.atoms, ['acquire']);
    assert.equal(plan.depth, 0);
    assert.equal(plan.complete, true);
    assert.equal(plan.steps[0]?.reason, 'goal');
    assert.equal(planSummary(plan).length, 1);
    assert.ok(planVerdict(plan).includes('1 걸음'));
  });

  test('치를 것이 비면 사슬이 늘어난다 — 재료 선행이 앞칸이 된다', () => {
    // 생산은 재고를 치르는데 창고가 비었다 → 그 자리를 세우는 획득이 먼저다 (P4-a blockedBy).
    const plan = planFor('produce', empty, true);
    assert.deepEqual(plan.atoms, ['acquire', 'produce']);
    assert.equal(plan.steps[0]?.reason, 'cost');
    assert.equal(plan.steps[0]?.forAtom, 'produce');
    assert.equal(plan.complete, true);

    // 손에 쥔 것이 있으면 같은 목적이 한 칸으로 접힌다.
    assert.deepEqual(planFor('produce', stocked, true).atoms, ['produce']);
  });

  test('대상을 못 보면 찾다가 앞에 붙는다 — 관측 선행', () => {
    const plan = planFor('acquire', stocked, false);
    assert.deepEqual(plan.atoms, ['seek', 'acquire']);
    assert.equal(plan.steps[0]?.reason, 'observation');
    assert.equal(plan.steps[0]?.forSlot, 'informational.knows.{claim}');

    // 셋이 겹치면 셋 다 선다 — 찾다 → 획득 → 생산.
    assert.deepEqual(planFor('produce', empty, false).atoms, ['seek', 'acquire', 'produce']);
  });

  test('먼저 쌓아야 등질 수 있다 — 사슬이 P3-a 의 마지막 물결을 그대로 편다', () => {
    // 빼앗기는 신뢰를 치르고(그 자리를 세우는 것은 주고받기 하나),
    // 주고받기는 재고를 치른다(그 자리를 세우는 것은 획득·생산·빼앗기).
    // 그래서 사이도 손도 빈 자에게는 등지는 일조차 세 걸음이다.
    const plan = planFor('seize', bare, true);
    assert.deepEqual(plan.atoms, ['acquire', 'exchange', 'seize']);
    assert.equal(plan.depth, 2);
    assert.equal(plan.complete, true);
  });

  test('순서는 P5 가 정하지 않는다 — 걸음마다 앞 계층의 값을 그대로 인용한다', () => {
    const plan = planFor('produce', empty, false);
    for (const step of plan.steps) {
      if (step.reason === 'goal') continue;
      const parent = step.forAtom as 'seek';
      if (step.reason === 'observation') {
        // P3-a 관측 선행이 그 자리를 말했다
        const requirement = prerequisitesOf(parent).find((entry) => entry.route === 'observation');
        assert.equal(step.forSlot, 'informational.knows.{claim}');
        assert.ok(requirement?.satisfiedBy.includes(step.atom), step.atom);
      } else {
        // P4-a 가 세계와 맞대어 낸 "먼저 낼 원자" 다
        const payment = payabilityOf(parent, { actorId: plain.id, world: empty });
        assert.ok(payment.blockedBy.includes(step.atom), `${step.atom} ∈ ${payment.blockedBy.join(',')}`);
      }
    }
  });

  test('한 원자는 사슬에 한 번만 선다 — 앎은 한 번 세우면 남는다', () => {
    const plan = planFor('produce', empty, false);
    assert.equal(new Set(plan.atoms).size, plan.atoms.length);
    // 획득도 생산도 관측을 요구하지만 찾다는 한 번만 선다.
    assert.equal(plan.atoms.filter((atom) => atom === 'seek').length, 1);
  });

  test('브레이크 없는 자리는 사슬을 늘리지 않고 위험으로 남는다', () => {
    const plan = planFor('acquire', stocked, true);
    // 획득은 몸을 치르지만 몸을 세우는 원자가 없다(P3-a 선언) — 걸음이 늘지 않는다.
    assert.deepEqual(plan.atoms, ['acquire']);
    assert.deepEqual(plan.steps[0]?.unbrakedSlots, ['biological.vitality']);
    assert.equal(plan.steps[0]?.verdict, 'unbraked');
  });

  test('열여섯이 전부 닿는다 — 뿌리가 하나뿐이라 사슬은 언제나 끝난다', () => {
    // P3-a 가 "뿌리는 찾다 하나뿐이며 열여섯이 전부 거기서 닿는다" 고 했다.
    // 아무것도 쥐지 않은 세계에서도 계획이 닿지 못하는 원자는 없어야 한다.
    const bare = assembleWorld([]).world;
    const stuck: string[] = [];
    for (const atom of ACTION_ATOMS) {
      const plan = buildPlan({
        actorId: plain.id,
        goal: goalOf(atom),
        world: bare,
        context: contextFor(bare, false),
        targetId: null,
      });
      if (!plan.complete || plan.deadEnds.length > 0) stuck.push(atom);
      assert.ok(plan.depth <= MAX_PLAN_DEPTH, `${atom} depth ${String(plan.depth)}`);
    }
    assert.deepEqual(stuck, []);
  });

  test('낼 원자가 없으면 계획도 없다', () => {
    const plan = buildPlan({
      actorId: plain.id,
      goal: { ...goalOf('acquire'), viaAtom: null },
      world: stocked,
      context: contextFor(stocked, true),
    });
    assert.deepEqual(
      plan.violations.map((violation) => violation.rule),
      ['goalless-plan'],
    );
    assert.deepEqual(plan.steps, []);
    assert.equal(plan.complete, false);
    assert.ok(planVerdict(plan).includes('goalless-plan'));
  });

  test('손으로 고쳐 넣은 계획은 관문에서 걸린다', () => {
    const sound = planFor('produce', empty, false);
    const rules = (plan: ActionPlan): readonly string[] => [
      ...new Set(checkPlan(plan).map((violation) => violation.rule)),
    ];

    // ① 자기 자신을 위해 선다
    assert.deepEqual(
      rules({
        ...sound,
        steps: sound.steps.map((step, index) =>
          index === 0 ? { ...step, forAtom: step.atom } : step,
        ),
      }),
      ['self-standing-step'],
    );

    // ② 받치는 것이 없다
    assert.deepEqual(
      rules({
        ...sound,
        steps: sound.steps.map((step, index) => (index === 0 ? { ...step, forAtom: null } : step)),
      }),
      ['orphan-step'],
    );

    // ③ 받치는 것보다 늦게 선다 — 순서가 뒤집혔다
    assert.deepEqual(
      rules({ ...sound, steps: [...sound.steps].reverse().map((step, index) => ({ ...step, order: index })) }),
      ['unordered-step'],
    );
    // 배열만 뒤집고 번호를 그대로 두면 그것도 걸린다 — 적힌 순서와 선 자리가 다르다
    assert.deepEqual(rules({ ...sound, steps: [...sound.steps].reverse() }), ['unordered-step']);

    // ④ 닿지 못한 자리를 남긴 채 온전하다고 한다
    assert.deepEqual(
      rules({
        ...sound,
        complete: true,
        deadEnds: [{ atom: 'produce', slot: 'economic.stock.{entity}', reason: 'no-supplier', note: '' }],
      }),
      ['dangling-need'],
    );
  });

  test('걸림이 성립하는 원자만 사슬에 선다', () => {
    for (const step of planFor('produce', empty, false).steps) {
      assert.notEqual(atomGrounding(step.atom), null);
      assert.ok((STEP_REASONS as readonly string[]).includes(step.reason));
    }
  });

  test('사이가 적히지 않아도 던지지 않는다', () => {
    // 손에 쥔 것은 있으나 사이가 하나도 적히지 않았다 — 설득은 신뢰를 치르므로 먼저 주고받는다.
    const lonely = {
      ...stocked,
      relational: { ...stocked.relational, [plain.id]: {} },
    } as WorldState;
    const plan = planFor('persuade', lonely, true);
    assert.equal(plan.complete, true);
    assert.deepEqual(plan.atoms, ['exchange', 'persuade']);
    assert.ok(neighborId.length > 0);
  });

  test('같은 재료면 같은 계획이다', () => {
    assert.equal(
      stateHash(planFor('produce', empty, false)),
      stateHash(planFor('produce', empty, false)),
    );
    assert.equal(MAX_PLAN_DEPTH, 8);
    assert.equal(denId.length > 0, true);
  });
});
