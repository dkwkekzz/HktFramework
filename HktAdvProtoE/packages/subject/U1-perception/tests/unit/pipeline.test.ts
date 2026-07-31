import { describe, expect, it } from 'vitest';
import type { StoreOperation } from '@hkt/k0-entity-state';
import { NATURAL_LAWS } from '@hkt/s1-natural-state';
import { SUBJECT_LAWS } from '@hkt/u0-subject-core';
import {
  buildSensorium,
  buildWorld,
  executeU1,
  phenomenaOf,
  validateInput,
  validateOutput,
  type U1Input,
} from '../../src/index.js';
import {
  A_HUNT_NOBODY_SEES,
  COMPONENT_DEFINITIONS,
  LAYOUT,
  SCENE_RULES,
  TWO_SIDES_OF_A_WALL,
  WIDE_LAYOUT,
  WORLD_SEED,
} from '../../scenarios/fixtures.js';

const input = (operations: StoreOperation[], ticks: number, over: Partial<U1Input> = {}): U1Input => ({
  world: { components: COMPONENT_DEFINITIONS, operations },
  layout: LAYOUT,
  worldSeed: WORLD_SEED,
  ticks,
  ...over,
});

const RING: U1Input['script'] = [{ tick: 1, intent: { id: 't1_toll', actor: 'chapel_bell', verb: 'toll' } }];

describe('WorldEvent → Phenomenon', () => {
  it('사건 하나가 여러 감각의 현상 하나를 남긴다', () => {
    const output = executeU1(input(TWO_SIDES_OF_A_WALL, 1, { script: RING, rules: SCENE_RULES }));
    expect(output.phenomena.length).toBe(1);
    expect(output.phenomena[0]?.channels).toEqual(['audio', 'visual']);
    expect(output.phenomena[0]?.measurements).toEqual({ audio: 12, visual: 6 });
  });

  it('현상은 그것을 일으킨 사건을 증거로 든다', () => {
    const output = executeU1(input(TWO_SIDES_OF_A_WALL, 1, { script: RING, rules: SCENE_RULES }));
    expect(output.phenomena[0]?.evidenceIds.length).toBe(1);
  });

  it('행위자의 자리가 곧 현상의 자리다', () => {
    const output = executeU1(input(TWO_SIDES_OF_A_WALL, 1, { script: RING, rules: SCENE_RULES }));
    expect(output.phenomena[0]?.location).toEqual([5, 3, 0]);
    expect(output.phenomena[0]?.sourceEntityId).toBe('chapel_bell');
  });

  it('주체가 낸 흔적은 그 주체의 몸 자리에서 난다 — 주체 자신은 공간에 없다', () => {
    const output = executeU1(
      input(TWO_SIDES_OF_A_WALL, 1, { subjectLaws: SUBJECT_LAWS }),
    );
    const aura = output.phenomena.find((entry) => entry.channels.includes('aura'));
    expect(aura?.sourceSubjectId).toBeTypeOf('string');
    expect(aura?.location).not.toBeUndefined();
  });

  it('사전에 없는 흔적은 지어내지 않고 이유와 함께 버린다', () => {
    const output = executeU1(
      input(TWO_SIDES_OF_A_WALL, 1, {
        script: RING,
        rules: SCENE_RULES,
        phenomenonBook: [],
      }),
    );
    expect(output.phenomena).toEqual([]);
    expect(output.gaps.map((gap) => gap.code)).toEqual(['E_UNKNOWN_PHENOMENON']);
    expect(output.gaps[0]?.message).not.toBe('');
  });

  it('모르는 채널 이름도 조용히 사라지지 않는다', () => {
    const store = buildWorld({ components: COMPONENT_DEFINITIONS, operations: TWO_SIDES_OF_A_WALL });
    const { phenomena, gaps } = phenomenaOf(
      [
        {
          id: 'event_x',
          tick: 1,
          causeEventIds: [],
          intentIds: ['i'],
          appliedRuleIds: ['r'],
          participantSubjectIds: ['chapel_bell'],
          affectedEntityIds: [],
          stateDelta: [],
          emittedPhenomena: [{ id: 'bell_toll', channels: ['telepathy'] }],
        },
      ],
      [{ id: 'bell_toll', title: '종', measurements: { audio: 12 } }],
      buildSensorium(store),
    );
    expect(phenomena).toEqual([]);
    expect(gaps.map((gap) => gap.code)).toEqual(['E_UNKNOWN_CHANNEL']);
    expect(gaps[0]?.channel).toBe('telepathy');
  });

  it('델타 없는 의도는 사건이 아니므로 흔적도 남기지 않는다', () => {
    // K3 은 "아무 일도 없었던 것이므로 사건도 없다"고 규정한다. 현상은 사건에 얹혀 오므로,
    // 세계를 한 칸도 바꾸지 않는 규칙은 아무에게도 닿을 수 없다. 그 사실을 여기 못 박아 둔다.
    const output = executeU1(
      input(TWO_SIDES_OF_A_WALL, 1, {
        script: RING,
        rules: [{ ...(SCENE_RULES[0] as (typeof SCENE_RULES)[number]), effects: [] }],
      }),
    );
    expect(output.events).toBe(0);
    expect(output.phenomena).toEqual([]);
  });
});

describe('세계를 굴리는 자리', () => {
  it('대본이 없으면 아무 일도 일어나지 않는다 — U1 은 사건을 만들지 않는다', () => {
    const output = executeU1(input(TWO_SIDES_OF_A_WALL, 3));
    expect(output.events).toBe(0);
    expect(output.phenomena).toEqual([]);
    expect(validateOutput(output)).toEqual([]);
  });

  it('틱 0 이면 단면이 하나도 없다', () => {
    const output = executeU1(input(TWO_SIDES_OF_A_WALL, 0, { script: RING, rules: SCENE_RULES }));
    expect(output.series).toEqual([]);
    expect(validateOutput(output)).toEqual([]);
  });

  it('지각은 세계를 바꾸지 않는다', () => {
    const output = executeU1(
      input(A_HUNT_NOBODY_SEES, 3, { naturalLaws: NATURAL_LAWS, layout: WIDE_LAYOUT }),
    );
    expect(output.storeHash).toBe(output.storeHashAfterPerceiving);
  });

  it('주체가 없는 세계도 무너지지 않는다', () => {
    const output = executeU1(
      input(
        [
          {
            op: 'spawn',
            id: 'lone_bell',
            kind: 'fixture',
            tags: [],
            components: { position: { x: 1, y: 1, z: 0 }, wear: { tolls: 0 } },
          },
        ],
        1,
        { script: [{ tick: 1, intent: { id: 't1', actor: 'lone_bell', verb: 'toll' } }], rules: SCENE_RULES },
      ),
    );
    expect(output.phenomena.length).toBe(1);
    expect(output.perceived).toEqual([]);
    expect(output.reports).toEqual([]);
    expect(validateOutput(output)).toEqual([]);
  });

  it('같은 세계를 두 번 굴리면 같은 지각이 나온다 (GI-12)', () => {
    const value = input(A_HUNT_NOBODY_SEES, 3, { naturalLaws: NATURAL_LAWS, layout: WIDE_LAYOUT });
    expect(executeU1(value).digest).toBe(executeU1(value).digest);
  });
});

describe('입력 검사', () => {
  it('형태가 어긋나면 왜 어긋났는지 말한다', () => {
    expect(() => validateInput(null)).toThrow(/객체/);
    expect(() => validateInput({ world: {} })).toThrow(/operations/);
    expect(() => validateInput({ world: { operations: [] } })).toThrow(/layout/);
    expect(() => validateInput({ world: { operations: [] }, layout: {} })).toThrow(/worldSeed/);
    expect(() =>
      validateInput({ world: { operations: [] }, layout: {}, worldSeed: '1', ticks: 0.5 }),
    ).toThrow(/ticks/);
    expect(() =>
      validateInput({ world: { operations: [] }, layout: {}, worldSeed: '1', ticks: 1, script: {} }),
    ).toThrow(/script/);
    expect(() =>
      validateInput({ world: { operations: [] }, layout: {}, worldSeed: '1', ticks: 1, testimonies: 3 }),
    ).toThrow(/testimonies/);
  });
});
