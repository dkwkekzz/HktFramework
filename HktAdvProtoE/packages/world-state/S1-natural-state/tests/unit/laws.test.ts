import { describe, expect, it } from 'vitest';
import { RuleBook } from '@hkt/k2-rule-transaction';
import {
  NATURAL_LAWS,
  NATURAL_LAW_IDS,
  declinesOf,
  executeS1,
  validateInput,
  validateOutput,
} from '../../src/index.js';
import type { NaturalSample, S1Input } from '../../src/index.js';
import { COMPONENT_DEFINITIONS, LAYOUT, MEADOW, WORLD_SEED } from '../../scenarios/fixtures.js';

const baseInput: S1Input = {
  world: { components: COMPONENT_DEFINITIONS, operations: MEADOW },
  layout: LAYOUT,
  worldSeed: WORLD_SEED,
  ticks: 8,
};

describe('자연 법칙집', () => {
  it('K2 의 규칙집이 그대로 받아들인다', () => {
    expect(() => RuleBook.of(NATURAL_LAWS)).not.toThrow();
  });

  it('법칙 id 는 겹치지 않고 전부 L1 이다', () => {
    expect(NATURAL_LAW_IDS).toEqual([...new Set(NATURAL_LAW_IDS)].sort());
    expect(NATURAL_LAWS.every((law) => law.scope === 'L1')).toBe(true);
  });

  it('모든 법칙이 흔적을 남긴다 — 아무 일도 하지 않는 성공이 없다', () => {
    for (const law of NATURAL_LAWS) {
      expect(
        law.costs.length + law.effects.length + law.emits.length,
        `${law.id} 가 비용도 효과도 흔적도 없다`,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * 목적 도달 감사가 잡아낸 구멍을 다시 열리지 않게 막는다.
   *
   * 원문 「10」 S1 의 포함 항목은 **표현되는 것만으로는 부족하다.** 아무 법칙도 읽지 않는 상태는
   * 오르내리기만 하고 세계에 아무 일도 일으키지 않는 장식이다 — 실제로 체온이 52℃ 인 무리가
   * 멀쩡히 새끼를 쳤고, 성한 무리의 체온은 45일 만에 19.5℃ 로 식었다.
   */
  it('원문 「10」 S1 의 포함 항목은 모두 읽는 법칙과 쓰는 법칙을 함께 갖는다', () => {
    const reads = (component: string): string[] =>
      NATURAL_LAWS.filter((law) => JSON.stringify(law.requires ?? {}).includes(`.${component}.`)).map(
        (law) => law.id,
      );
    const writes = (component: string): string[] =>
      NATURAL_LAWS.filter((law) => JSON.stringify([law.costs, law.effects]).includes(`.${component}.`)).map(
        (law) => law.id,
      );

    for (const component of ['mass', 'temperature', 'damage', 'hunger', 'disease', 'population']) {
      expect(reads(component), `${component} 를 읽는 법칙이 없다 — 아무것도 일으키지 못하는 상태다`).not.toEqual([]);
      expect(writes(component), `${component} 를 바꾸는 법칙이 없다`).not.toEqual([]);
    }
  });

  it('성한 몸의 체온은 식어 사라지지 않는다 — 고정점이 0℃ 가 아니다', () => {
    const output = executeS1({ ...baseInput, ticks: 45 });
    for (const sample of output.series) {
      expect(sample.temperature['wolf_pack'], `${sample.tick}일`).toBeGreaterThan(36);
    }
  });

  it('법칙집을 갈아 끼울 수 있다 — 법칙은 코드가 아니라 데이터다', () => {
    const barren = executeS1({
      ...baseInput,
      ticks: 20,
      laws: NATURAL_LAWS.filter((law) => law.id !== 'l1_breed'),
    });
    // 번식 법칙을 빼면 개체군은 늘지 않는다 — 같은 세계가 다른 역사를 갖는다.
    const deer = barren.declines.find((decline) => decline.entity === 'deer_herd');
    expect(deer?.peak).toBe(deer?.start);
    expect(barren.digest).not.toBe(executeS1({ ...baseInput, ticks: 20 }).digest);
  });

  it('법칙이 없는 의도는 거부되고 세계는 그대로다', () => {
    const silent = executeS1({ ...baseInput, laws: NATURAL_LAWS.filter((law) => law.id === 'l1_endure') });
    const last = silent.series[silent.series.length - 1] as NaturalSample;
    expect(silent.rejected).toBeGreaterThan(0);
    expect(silent.events).toBe(0);
    expect(last.population).toEqual((silent.series[0] as NaturalSample).population);
  });
});

describe('감소 표식', () => {
  const sample = (tick: number, count: number): NaturalSample => ({
    tick,
    population: { herd: count },
    hunger: {},
    mass: {},
    disease: {},
    temperature: {},
    links: [],
    appliedLaws: [],
    rejected: 0,
  });

  it('오르내림은 감소가 아니다 — 정점으로 돌아오면 세지 않는다', () => {
    const series = [4, 5, 4, 5, 4, 5].map((count, tick) => sample(tick, count));
    expect(declinesOf(series)[0]?.declineTick).toBeNull();
  });

  it('정점을 마지막으로 찍은 다음 틱부터가 돌아오지 못하는 감소다', () => {
    const series = [4, 5, 4, 5, 3, 2, 1].map((count, tick) => sample(tick, count));
    expect(declinesOf(series)[0]).toEqual({
      entity: 'herd',
      start: 4,
      peak: 5,
      end: 1,
      peakTick: 3,
      declineTick: 4,
    });
  });

  it('끝까지 그대로면 감소가 없다', () => {
    const series = [30, 30, 30].map((count, tick) => sample(tick, count));
    expect(declinesOf(series)[0]?.declineTick).toBeNull();
  });
});

describe('입력 검증', () => {
  it('시드는 10진 문자열이어야 한다 — K3 의 결정적 시드 조합이 그대로 읽는다', () => {
    expect(() => validateInput({ ...baseInput, worldSeed: 'seed' })).toThrow(TypeError);
    expect(() => validateInput({ ...baseInput, worldSeed: 7 })).toThrow(TypeError);
  });

  it('격자 없이는 먹이 관계를 잴 수 없다', () => {
    expect(() => validateInput({ ...baseInput, layout: undefined })).toThrow(TypeError);
  });

  it('틱은 0 이상의 정수다', () => {
    expect(() => validateInput({ ...baseInput, ticks: -1 })).toThrow(TypeError);
    expect(() => validateInput({ ...baseInput, ticks: 1.5 })).toThrow(TypeError);
    expect(validateInput({ ...baseInput, ticks: 0 })).toBeTruthy();
  });
});

describe('출력 불변조건 검사기 자체', () => {
  it('멀쩡한 출력에는 아무 문제도 없다', () => {
    expect(validateOutput(executeS1(baseInput))).toEqual([]);
  });

  it('사건 없는 상태 변화를 잡는다 (GI-01)', () => {
    const output = executeS1(baseInput);
    output.audit.everyChangeHasAnEvent = false;
    expect(validateOutput(output).map((issue) => issue.code)).toContain(
      'E_INVARIANT_every_natural_change_must_have_a_causing_event',
    );
  });

  it('재시뮬레이션이 어긋난 것을 잡는다 (GI-12)', () => {
    const output = executeS1(baseInput);
    output.resimulatedLogHash = 'sha256:다른값';
    expect(validateOutput(output).map((issue) => issue.code)).toContain(
      'E_INVARIANT_identical_world_and_seed_must_produce_identical_series',
    );
  });

  it('음수 개체군을 잡는다', () => {
    const output = executeS1(baseInput);
    const first = output.series[0];
    if (first) first.population['deer_herd'] = -1;
    expect(validateOutput(output).map((issue) => issue.code)).toContain(
      'E_INVARIANT_population_must_not_fall_below_zero',
    );
  });

  it('바닥난 먹이에 이어진 관계를 잡는다', () => {
    const output = executeS1(baseInput);
    const first = output.series[0];
    if (first?.links[0]) first.links[0].available = 0;
    expect(validateOutput(output).map((issue) => issue.code)).toContain(
      'E_INVARIANT_food_must_be_within_the_habitat_to_be_eaten',
    );
  });
});

describe('실행', () => {
  it('0틱이면 초기 단면 하나만 나온다', () => {
    const output = executeS1({ ...baseInput, ticks: 0 });
    expect(output.series.length).toBe(1);
    expect(output.events).toBe(0);
    expect(output.finalTick).toBe(0);
  });

  it('같은 입력이면 같은 요약 해시다 (GI-12)', () => {
    expect(executeS1(baseInput).digest).toBe(executeS1(baseInput).digest);
  });
});
