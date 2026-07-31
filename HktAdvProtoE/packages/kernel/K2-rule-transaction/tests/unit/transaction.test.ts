import { describe, expect, it } from 'vitest';
import { RuleBook, TransactionRejected, buildWorld, runTransaction, totalOf } from '../../src/index.js';
import type { RuleSpec } from '../../src/index.js';
import { CANYON, COMPONENT_DEFINITIONS, RULES } from '../../scenarios/fixtures.js';

const world = { components: COMPONENT_DEFINITIONS, operations: CANYON };
const book = RuleBook.of(RULES);
const store = buildWorld(world);

const strike = (actor: string, target: string) => ({ id: 'i', actor, verb: 'strike', targets: [target] });

describe('규칙집', () => {
  it('권위 순서로 고정된다', () => {
    expect(book.all().map((rule) => `${rule.scope}:${rule.id}`)).toEqual([
      'L1:l1_living_only',
      'L1:l1_strike',
      'L4:l4_border_blessing',
      'L4:l4_undead_rite',
      'L5:l5_pay',
      'L6:l6_reckless_charge',
      'L6:l6_swear',
    ]);
  });

  it('선언 순서가 달라도 같은 해시다', () => {
    expect(RuleBook.of([...RULES].reverse()).hash()).toBe(book.hash());
  });

  it('겹치는 id 를 거부한다', () => {
    expect(() => RuleBook.of([RULES[0] as RuleSpec, RULES[0] as RuleSpec])).toThrow(/겹친다/);
  });

  it('모르는 계층을 거부한다', () => {
    expect(() => RuleBook.of([{ ...(RULES[0] as RuleSpec), scope: 'L9' as never }])).toThrow(/L0~L6/);
  });

  it('실행 코드가 들어간 규칙을 거부한다', () => {
    const rule = { ...(RULES[0] as RuleSpec), when: (() => true) as never };
    expect(() => RuleBook.of([rule])).toThrow(/실행 코드/);
  });

  it('costs·effects·emits 가 배열이 아니면 거부한다', () => {
    expect(() => RuleBook.of([{ ...(RULES[0] as RuleSpec), costs: null as never }])).toThrow(/배열/);
  });
});

describe('트랜잭션', () => {
  it('성공하면 비용과 효과가 함께 간다', () => {
    const { store: next, outcome } = runTransaction(store, book, strike('hunter_a', 'beast_ka'));
    expect(outcome.ok).toBe(true);
    expect(next.component('hunter_a', 'energy')).toEqual({ current: 7 });
    expect(next.component('beast_ka', 'health')).toEqual({ current: 890, max: 900 });
  });

  it('거부되면 입력과 같은 저장소를 그대로 돌려준다', () => {
    const poor = store.setComponent('hunter_a', 'energy', { current: 1 });
    const result = runTransaction(poor, book, strike('hunter_a', 'beast_ka'));
    expect(result.outcome.ok).toBe(false);
    expect(result.store).toBe(poor);
  });

  it('임시 의도 실체는 남지 않는다', () => {
    const { store: next } = runTransaction(store, book, strike('hunter_a', 'beast_ka'));
    expect(next.has('transient_intent')).toBe(false);
    expect(next.byKind('intent')).toEqual([]);
  });

  it('사거리 밖이면 조건 미충족으로 거부한다', () => {
    const { outcome } = runTransaction(store, book, strike('hunter_a', 'far_beast'));
    expect(outcome.rejection?.code).toBe('E_REQUIRES_UNMET');
    expect(outcome.rejection?.causes[0]?.at).toBe('actor↔target');
  });

  it('규칙이 없으면 거부한다', () => {
    const { outcome } = runTransaction(store, book, { id: 'i', actor: 'hunter_a', verb: 'dance' });
    expect(outcome.rejection?.code).toBe('E_NO_RULE_FOR_INTENT');
  });

  it('없는 행위자는 거부한다', () => {
    const { outcome } = runTransaction(store, book, strike('nobody', 'beast_ka'));
    expect(outcome.rejection?.code).toBe('E_UNKNOWN_ACTOR');
  });

  it('상위 규칙이 막으면 국소 예외가 성립하지 않는다', () => {
    const { outcome } = runTransaction(store, book, strike('dead_knight', 'beast_ka'));
    expect(outcome.rejection?.code).toBe('E_FORBIDDEN_BY_HIGHER_AUTHORITY');
    expect(outcome.appliedRuleId).toBeNull();
  });

  it('조건식이 잘못된 규칙은 조용히 넘어가지 않는다', () => {
    const broken = RuleBook.of([
      { ...(RULES[1] as RuleSpec), id: 'broken', when: { op: 'eq', path: 'actor.healt.current', value: 1 } },
    ]);
    const { outcome } = runTransaction(store, broken, strike('hunter_a', 'beast_ka'));
    expect(outcome.rejection?.code).toBe('E_BAD_RULE');
  });

  it('실패 효과를 선언한 규칙만 실패해도 흔적을 남긴다', () => {
    const { store: next, outcome } = runTransaction(store, book, {
      id: 'i',
      actor: 'hunter_a',
      verb: 'charge',
      targets: ['far_beast'],
    });
    expect(outcome.ok).toBe(false);
    expect(next.get('hunter_a')?.tags).toContain('stumbled');
    expect(outcome.costDelta).toEqual([]);
    expect(outcome.effectDelta).toEqual([]);
    expect(outcome.delta.map((change) => change.path)).toEqual(['entity/hunter_a/tags']);
  });

  it('비용은 효과가 일어나기 전 상태를 기준으로 잰다', () => {
    // 효과가 에너지를 10 채워 주더라도, 지금 없는 에너지로 비용을 낼 수는 없다.
    const refund = RuleBook.of([
      {
        id: 'refunding_strike',
        scope: 'L6',
        priority: 1,
        when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'strike' },
        costs: [{ op: 'add', path: 'actor.energy.current', value: -5 }],
        effects: [{ op: 'add', path: 'actor.energy.current', value: 10 }],
        emits: [{ id: 'x', channels: ['audio'] }],
        tags: [],
      },
    ]);
    const drained = store.setComponent('hunter_a', 'energy', { current: 2 });
    const { outcome } = runTransaction(drained, refund, strike('hunter_a', 'beast_ka'));
    expect(outcome.ok).toBe(false);
    expect(outcome.rejection?.code).toBe('E_UNAFFORDABLE_COST');
  });

  it('원자성은 순서가 아니라 작업용 저장소를 버리는 데서 온다', () => {
    // 효과가 두 개인데 두 번째가 어긋나면 첫 번째도 남지 않는다.
    const halfBroken = RuleBook.of([
      {
        id: 'half_broken',
        scope: 'L6',
        priority: 1,
        when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'strike' },
        costs: [],
        effects: [
          { op: 'add', path: 'target.health.current', value: -10 },
          { op: 'add', path: 'actor.energy.current', value: -1000 },
        ],
        emits: [{ id: 'x', channels: ['audio'] }],
        tags: [],
      },
    ]);
    const { store: next, outcome } = runTransaction(store, halfBroken, strike('hunter_a', 'beast_ka'));
    expect(outcome.ok).toBe(false);
    expect(next).toBe(store);
    expect(next.component('beast_ka', 'health')).toEqual({ current: 900, max: 900 });
  });

  it('검토 기록에 모든 규칙이 남는다', () => {
    const { outcome } = runTransaction(store, book, strike('hunter_a', 'beast_ka'));
    expect(outcome.matches).toHaveLength(RULES.length);
    expect(outcome.matches.filter((match) => match.matched).map((match) => match.ruleId)).toEqual([
      'l1_living_only',
      'l1_strike',
    ]);
  });
});

describe('효과', () => {
  it('transfer 는 총량을 지킨다', () => {
    const before = totalOf(store, 'purse', 'coins');
    const { store: next } = runTransaction(store, book, { id: 'i', actor: 'hunter_a', verb: 'pay', targets: ['beast_ka'] });
    expect(totalOf(next, 'purse', 'coins')).toBe(before);
  });

  it('낼 수 없는 transfer 는 받는 쪽도 늘리지 않는다', () => {
    const poor = store.setComponent('hunter_a', 'purse', { coins: 1 });
    const { store: next, outcome } = runTransaction(poor, book, {
      id: 'i',
      actor: 'hunter_a',
      verb: 'pay',
      targets: ['beast_ka'],
    });
    expect(outcome.rejection?.code).toBe('E_UNAFFORDABLE_COST');
    expect(next.component('beast_ka', 'purse')).toEqual({ coins: 0 });
  });

  it('약속을 만들고 예약을 남긴다', () => {
    const { store: next, outcome } = runTransaction(store, book, { id: 'i', actor: 'hunter_a', verb: 'swear' });
    expect(next.component('hunter_a', 'commitments')).toEqual({ open: ['oath_of_protection'], breached: [] });
    expect(outcome.scheduled).toEqual([{ eventTemplateId: 'oath_reminder', delayTicks: 5 }]);
  });

  it('예약은 상태를 바꾸지 않는다', () => {
    const onlySchedule = RuleBook.of([
      {
        id: 'only_schedule',
        scope: 'L6',
        priority: 1,
        when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'wait' },
        costs: [],
        effects: [{ op: 'schedule_event', eventTemplateId: 'later', delayTicks: 3 }],
        emits: [],
        tags: [],
      },
    ]);
    const { store: next, outcome } = runTransaction(store, onlySchedule, { id: 'i', actor: 'hunter_a', verb: 'wait' });
    expect(outcome.ok).toBe(true);
    expect(outcome.delta).toEqual([]);
    expect(next.hash()).toBe(store.hash());
  });

  it('모르는 효과를 거부한다', () => {
    const bad = RuleBook.of([
      {
        id: 'bad_effect',
        scope: 'L6',
        priority: 1,
        when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'zap' },
        costs: [],
        effects: [{ op: 'teleport' } as never],
        emits: [],
        tags: [],
      },
    ]);
    const { outcome } = runTransaction(store, bad, { id: 'i', actor: 'hunter_a', verb: 'zap' });
    expect(outcome.rejection?.code).toBe('E_BAD_EFFECT');
  });

  it('수가 아닌 값은 셈하지 않는다', () => {
    const bad = RuleBook.of([
      {
        id: 'bad_add',
        scope: 'L6',
        priority: 1,
        when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'zap' },
        costs: [],
        effects: [{ op: 'add', path: 'actor.position', value: 1 }],
        emits: [],
        tags: [],
      },
    ]);
    const { outcome } = runTransaction(store, bad, { id: 'i', actor: 'hunter_a', verb: 'zap' });
    expect(outcome.rejection?.message).toContain('셈할 수 없다');
  });

  it('multiply · set 도 델타를 남긴다', () => {
    const book2 = RuleBook.of([
      {
        id: 'reshape',
        scope: 'L6',
        priority: 1,
        when: { op: 'eq', path: 'intent.intent_spec.verb', value: 'reshape' },
        costs: [],
        effects: [
          { op: 'multiply', path: 'actor.energy.current', value: 2 },
          { op: 'set', path: 'actor.position', value: { x: 5, y: 0, z: 0 } },
        ],
        emits: [],
        tags: [],
      },
    ]);
    const { store: next, outcome } = runTransaction(store, book2, { id: 'i', actor: 'hunter_a', verb: 'reshape' });
    expect(next.component('hunter_a', 'energy')).toEqual({ current: 20 });
    expect(next.component('hunter_a', 'position')).toEqual({ x: 5, y: 0, z: 0 });
    expect(outcome.delta.map((change) => change.op)).toEqual(['multiply', 'set']);
  });

  it('TransactionRejected 는 코드와 위치를 함께 싣는다', () => {
    const rejection = new TransactionRejected('E_BAD_EFFECT', 'rule/x/effects/0', '메시지');
    expect(rejection.toRejection()).toEqual({
      code: 'E_BAD_EFFECT',
      path: 'rule/x/effects/0',
      message: '메시지',
      causes: [],
    });
  });
});
