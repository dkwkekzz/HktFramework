import { describe, expect, it } from 'vitest';
import { ComponentRegistry, EntityStore, applyOperations, type StoreOperation } from '@hkt/k0-entity-state';
import {
  bodyIdsOf,
  buildWorld,
  executeU0,
  readSubject,
  subjectIds,
  subjectIntentsFor,
  subjectMarks,
  validateInput,
  validateOutput,
  SUBJECT_VERB,
} from '../../src/index.js';
import {
  COMPONENT_DEFINITIONS,
  FOUR_KINDS_WORLD,
  LAYOUT,
  TWO_PEOPLE,
  WORLD_SEED,
  body,
  subject,
} from '../../scenarios/fixtures.js';

const store = (operations: StoreOperation[] = TWO_PEOPLE): EntityStore =>
  buildWorld({ components: COMPONENT_DEFINITIONS, operations });

const input = (operations: StoreOperation[], ticks: number) => ({
  world: { components: COMPONENT_DEFINITIONS, operations },
  layout: LAYOUT,
  worldSeed: WORLD_SEED,
  ticks,
});

describe('주체 읽기', () => {
  it('욕구를 가진 것이 주체다 (id 오름차순)', () => {
    expect(subjectIds(store())).toEqual(['forager', 'sentinel']);
  });

  it('능력은 태그에서 읽는다 — 원본 10장의 capabilities: Id[]', () => {
    expect(readSubject(store(), 'sentinel').capabilities).toEqual(['stand_watch']);
    expect(readSubject(store(), 'forager').capabilities).toEqual(['forage']);
  });

  it('능력 앞머리가 없는 태그는 능력이 아니다', () => {
    const operations: StoreOperation[] = [
      ...TWO_PEOPLE,
      { op: 'attach_tag', id: 'sentinel', tag: 'wounded' },
      { op: 'attach_tag', id: 'sentinel', tag: 'cap_fight' },
    ];
    expect(readSubject(store(operations), 'sentinel').capabilities).toEqual(['fight', 'stand_watch']);
  });

  it('신체 연결이 없으면 빈 배열이다 — 없는 몸을 지어내지 않는다', () => {
    const operations: StoreOperation[] = [
      ...TWO_PEOPLE,
      { op: 'set_component', id: 'sentinel', type: 'body', data: { entity_ids: [] } },
    ];
    expect(bodyIdsOf(store(operations), 'sentinel')).toEqual([]);
    expect(readSubject(store(operations), 'sentinel').bodyEntityIds).toEqual([]);
  });

  it('숫자가 아닌 칸은 읽지 않는다', () => {
    const registry = ComponentRegistry.of([
      { type: 'needs', schema: { type: 'object' } },
      { type: 'values', schema: { type: 'object' } },
    ]);
    const loose = applyOperations(EntityStore.empty(registry), [
      {
        op: 'spawn',
        id: 'odd',
        kind: 'person',
        components: { needs: { hunger: 3, note: 'much' }, values: {} },
      },
    ]).store;
    expect(readSubject(loose, 'odd').needs).toEqual({ hunger: 3 });
  });
});

describe('의도 만들기', () => {
  it('주체 오름차순 · 몸마다 허기와 상함 · 주체마다 수단 한 번', () => {
    const intents = subjectIntentsFor(store(), 1);
    expect(intents.map((intent) => `${intent.actor}:${intent.verb}`)).toEqual([
      'forager:sense_hunger',
      'forager:sense_harm',
      'forager:weigh_means',
      'sentinel:sense_hunger',
      'sentinel:sense_harm',
      'sentinel:weigh_means',
    ]);
  });

  it('몸이 여럿이면 몸마다 느낀다 — 조직의 몸은 구성원이다', () => {
    const intents = subjectIntentsFor(store(FOUR_KINDS_WORLD), 1).filter(
      (intent) => intent.actor === 'border_watch',
    );
    expect(intents.filter((intent) => intent.verb === SUBJECT_VERB.SENSE_HUNGER).length).toBe(2);
    expect(intents.filter((intent) => intent.verb === SUBJECT_VERB.WEIGH_MEANS).length).toBe(1);
    // 몸 오름차순으로 허기·상함이 짝을 이루고, 저울질은 맨 끝에 한 번이다.
    expect(intents.map((intent) => `${intent.bindings?.['body'] ?? '—'}:${intent.verb}`)).toEqual([
      'militia_fallen:sense_hunger',
      'militia_fallen:sense_harm',
      'militia_standing:sense_hunger',
      'militia_standing:sense_harm',
      '—:weigh_means',
    ]);
  });

  it('세계에 없는 몸은 건너뛴다', () => {
    const operations: StoreOperation[] = [
      ...TWO_PEOPLE,
      { op: 'set_component', id: 'sentinel', type: 'body', data: { entity_ids: ['ghost'] } },
    ];
    const intents = subjectIntentsFor(store(operations), 1).filter((intent) => intent.actor === 'sentinel');
    expect(intents.map((intent) => intent.verb)).toEqual([SUBJECT_VERB.WEIGH_MEANS]);
  });

  it('같은 틱을 두 번 물으면 같은 의도가 나온다', () => {
    expect(JSON.stringify(subjectIntentsFor(store(), 3))).toBe(JSON.stringify(subjectIntentsFor(store(), 3)));
  });
});

describe('경계값과 거부', () => {
  it('틱 0 이면 초기 단면 하나만 나온다', () => {
    const output = executeU0(input(TWO_PEOPLE, 0));
    expect(output.series.length).toBe(1);
    expect(output.events).toBe(0);
    expect(validateOutput(output)).toEqual([]);
  });

  it('주체가 하나도 없는 세계도 무너지지 않는다', () => {
    const output = executeU0(input([body('lonely_body', { x: 1, y: 1 }, 3)], 2));
    expect(output.subjects).toEqual([]);
    expect(validateOutput(output)).toEqual([]);
  });

  it('욕구는 천장에서 멈추고 거부되지 않는다', () => {
    const output = executeU0(input(TWO_PEOPLE, 8));
    const last = output.series[output.series.length - 1];
    expect(last?.views['sentinel']?.needs['hunger']).toBe(10);
    expect(last?.rejections).toEqual([]);
    expect(validateOutput(output)).toEqual([]);
  });

  it('쓰러진 몸을 통한 감각은 막히고, 막은 자리를 이름으로 지목한다', () => {
    const output = executeU0(input(FOUR_KINDS_WORLD, 2));
    const blocked = output.series.flatMap((sample) => sample.rejections);
    expect(blocked.length).toBeGreaterThan(0);
    for (const rejection of blocked) {
      expect(rejection.actor).toBe('border_watch');
      expect(rejection.path).toContain('u0_the_dead_do_not_feel');
      expect(rejection.message).not.toBe('');
    }
  });

  it('거부된 의도는 세계를 한 칸도 바꾸지 않는다', () => {
    const fallenOnly = [
      body('fallen', { x: 1, y: 1 }, 7),
      { op: 'set_component', id: 'fallen', type: 'population', data: { count: 0 } } as StoreOperation,
      subject({
        id: 'mourner',
        kind: 'person',
        needs: { hunger: 4, duty: 1, safety: 1 },
        values: { survival: 0.5, duty: 0.5, temperance: 0.5 },
        traits: { patient: 0.5, impulsive: 0.5, cautious: 0.5 },
        emotions: { fear: 0, despair: 0 },
        resources: { provision: 1, salve: 0 },
        bodies: ['fallen'],
        capabilities: [],
      }),
    ];
    const output = executeU0(input(fallenOnly, 3));
    const first = output.series[0]?.views['mourner']?.needs;
    const last = output.series[output.series.length - 1]?.views['mourner']?.needs;
    expect(last).toEqual(first);
  });
});

describe('사건 표시', () => {
  it('주체를 바꾼 법칙만 골라낸다', () => {
    const output = executeU0(input(TWO_PEOPLE, 2));
    expect(output.subjectDeltaLaws.every((law) => law.startsWith('u0_'))).toBe(true);
    expect(output.subjectDeltaPaths.every((path) => path.startsWith('entity/'))).toBe(true);
    expect(output.subjectDeltaPaths.some((path) => path.includes('/needs/'))).toBe(true);
  });

  it('빈 로그에서는 빈 목록이 나온다', () => {
    expect(subjectMarks([])).toEqual({ paths: [], laws: [] });
  });
});

describe('입력 검사', () => {
  it('형태가 어긋나면 왜 어긋났는지 말한다', () => {
    expect(() => validateInput(null)).toThrow(/객체/);
    expect(() => validateInput({ world: [] })).toThrow(/객체/);
    expect(() => validateInput({ world: {} })).toThrow(/operations/);
    expect(() => validateInput({ world: { operations: [] } })).toThrow(/layout/);
    expect(() => validateInput({ world: { operations: [] }, layout: {} })).toThrow(/worldSeed/);
    expect(() =>
      validateInput({ world: { operations: [] }, layout: {}, worldSeed: '1', ticks: -1 }),
    ).toThrow(/ticks/);
    expect(() =>
      validateInput({ world: { operations: [] }, layout: {}, worldSeed: '1', ticks: 1, needBook: {} }),
    ).toThrow(/needBook/);
  });

  it('맞는 입력은 그대로 돌려준다', () => {
    const value = input(TWO_PEOPLE, 2);
    expect(validateInput(value)).toBe(value);
  });
});
