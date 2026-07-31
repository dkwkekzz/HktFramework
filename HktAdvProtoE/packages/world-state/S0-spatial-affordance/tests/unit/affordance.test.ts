import { describe, expect, it } from 'vitest';
import type { StoreOperation } from '@hkt/k0-entity-state';
import { QueryRejection } from '@hkt/k1-predicate-query';
import {
  SpatialIndex,
  SpatialRejection,
  assertAffordance,
  buildWorld,
  executeS0,
  resolveAffordances,
  validateInput,
  validateOutput,
} from '../../src/index.js';
import type { Affordance, S0Input } from '../../src/index.js';
import {
  AFFORDANCES,
  COMPONENT_DEFINITIONS,
  LAYOUT,
  RULES,
  TAKE_RELIC,
  TWO_ROOMS,
} from '../../scenarios/fixtures.js';

const store = buildWorld({ components: COMPONENT_DEFINITIONS, operations: TWO_ROOMS });
const index = SpatialIndex.build(store, LAYOUT);

const baseInput: S0Input = {
  world: { components: COMPONENT_DEFINITIONS, operations: TWO_ROOMS },
  layout: LAYOUT,
  affordances: AFFORDANCES,
  rules: RULES,
  steps: [{ kind: 'resolve', id: 'ask', actor: 'hunter' }],
};

describe('행동 가능성 계약', () => {
  it('비용이 하나도 없는 행동은 둘 수 없다 (GI-06)', () => {
    const naked = { ...TAKE_RELIC, estimatedCost: {} } as Affordance;
    expect(() => assertAffordance(naked)).toThrow(SpatialRejection);
    expect(() => assertAffordance({ ...TAKE_RELIC, estimatedCost: { stamina: -1 } })).toThrow(SpatialRejection);
  });

  it('조건 없는 행동도 둘 수 없다', () => {
    const noCondition = { ...TAKE_RELIC, condition: undefined } as unknown as Affordance;
    expect(() => assertAffordance(noCondition)).toThrow(SpatialRejection);
  });

  it('빈 칸이 없으면 통과한다', () => {
    expect(() => assertAffordance(TAKE_RELIC)).not.toThrow();
  });
});

describe('접근 가능성 판정', () => {
  it('없는 주체를 물으면 거짓이 아니라 거부다', () => {
    expect(() => resolveAffordances(store, index, 'nobody', AFFORDANCES)).toThrow(SpatialRejection);
  });

  it('공간에 없는 주체도 거부다 — 어디에서 묻는지 알 수 없다', () => {
    const ghostly = buildWorld({
      components: COMPONENT_DEFINITIONS,
      operations: [{ op: 'spawn', id: 'idea', kind: 'person' }],
    });
    expect(() =>
      resolveAffordances(ghostly, SpatialIndex.build(ghostly, LAYOUT), 'idea', AFFORDANCES),
    ).toThrow(SpatialRejection);
  });

  it('동사로 걸러 물을 수 있다', () => {
    const offers = resolveAffordances(store, index, 'hunter', AFFORDANCES, { verbs: ['open'] });
    expect(offers.map((offer) => offer.affordanceId)).toEqual(['open_the_door']);
  });

  /**
   * 속성 테스트가 잡아낸 구멍.
   *
   * 대상이 사방으로 둘러싸이면 **설 자리가 하나도 남지 않는다.** 그때 경로 탐색은 시작조차 하지
   * 않으므로 "탐색 중 마주친 장애물"이 없고, 거절이 아무 이름도 지목하지 못했다.
   */
  it('사방이 막힌 대상은 후보 자리를 지운 실체들을 이름으로 남긴다', () => {
    const sealed = buildWorld({
      components: COMPONENT_DEFINITIONS,
      operations: [
        {
          op: 'spawn',
          id: 'hunter',
          kind: 'person',
          components: {
            position: { x: 0, y: 0, z: 0 },
            capability: { names: ['grasp'] },
            reach: { max: 1 },
          },
        },
        { op: 'spawn', id: 'prize', kind: 'item', tags: ['portable'], components: { position: { x: 4, y: 2, z: 0 } } },
        ...(
          [
            ['cage_w', 3, 2],
            ['cage_e', 5, 2],
            ['cage_s', 4, 1],
            ['cage_n', 4, 3],
          ] as const
        ).map(([id, x, y]): StoreOperation => ({
          op: 'spawn',
          id,
          kind: 'structure',
          components: { position: { x, y, z: 0 }, extent: { x: 0.5, y: 0.5, z: 0.5 }, barrier: { solid: true, opaque: true } },
        })),
      ],
    });
    const offer = resolveAffordances(sealed, SpatialIndex.build(sealed, LAYOUT), 'hunter', [
      { ...TAKE_RELIC, id: 'take_prize', targetEntityId: 'prize' },
    ])[0];

    expect(offer?.available).toBe(false);
    expect(offer?.refusals[0]?.code).toBe('E_UNREACHABLE');
    expect(offer?.refusals[0]?.blockedBy).toEqual(['cage_e', 'cage_n', 'cage_s', 'cage_w']);
  });

  it('격자 밖의 대상은 막힌 것이 아니라 배치가 담지 못한 것이다', () => {
    const offer = resolveAffordances(store, index, 'hunter', [
      {
        ...TAKE_RELIC,
        id: 'take_watchtower',
        targetEntityId: 'far_watchtower',
        condition: { op: 'has_tag', target: 'target', tag: 'stone' },
      },
    ])[0];
    expect(offer?.refusals.map((refusal) => refusal.code)).toEqual(['E_OUTSIDE_GRID']);
  });

  it('조건식의 오타는 거짓이 아니라 예외로 오른다 (K1 과 같은 선)', () => {
    const typo: Affordance = {
      ...TAKE_RELIC,
      id: 'typo',
      condition: { op: 'gt', path: 'target.healt.current', value: 1 },
    };
    expect(() => resolveAffordances(store, index, 'hunter', [typo])).toThrow(QueryRejection);
  });

  it('예외로 오른 거절은 걸음 보고에 남고 세계는 그대로다', () => {
    const output = executeS0({
      ...baseInput,
      affordances: [{ ...TAKE_RELIC, id: 'typo', condition: { op: 'eq', path: 'Target.Tags', value: 1 } }],
    });
    expect(output.steps[0]?.rejection?.code).toBe('E_BAD_PATH');
    expect(output.worldHashBefore).toBe(output.worldHashAfter);
  });
});

describe('입력 검증', () => {
  it('격자 없이는 접근 가능성을 물을 수 없다', () => {
    expect(() => validateInput({ ...baseInput, layout: undefined })).toThrow(TypeError);
  });

  it('모르는 걸음 종류는 거부한다', () => {
    expect(() => validateInput({ ...baseInput, steps: [{ id: 'x', kind: 'teleport' }] })).toThrow(TypeError);
  });

  it('id 없는 걸음은 거부한다 — 보고를 짚을 수 없다', () => {
    expect(() => validateInput({ ...baseInput, steps: [{ kind: 'resolve', actor: 'hunter' }] })).toThrow(TypeError);
  });

  it('제대로 된 입력은 그대로 통과한다', () => {
    expect(validateInput(baseInput)).toBe(baseInput);
  });
});

describe('출력 불변조건 검사기 자체', () => {
  it('멀쩡한 출력에는 아무 문제도 없다', () => {
    expect(validateOutput(executeS0(baseInput), LAYOUT)).toEqual([]);
  });

  it('닿을 수 없는데 제시된 행동을 잡는다', () => {
    const output = executeS0(baseInput);
    const offer = output.steps[0]?.offers?.find((entry) => entry.affordanceId === 'take_relic');
    expect(offer?.available).toBe(false);
    // 손으로 뒤집어 본다 — 검사기가 실제로 이 조건을 보는지 확인한다.
    if (offer) {
      offer.available = true;
      offer.refusals = [];
    }
    const codes = validateOutput(output, LAYOUT).map((issue) => issue.code);
    expect(codes).toContain('E_INVARIANT_unreachable_target_must_not_be_offered');
  });

  it('세계를 바꾼 resolve 걸음을 잡는다', () => {
    const output = executeS0(baseInput);
    const step = output.steps[0];
    if (step) step.hashAfter = 'sha256:다른값';
    expect(validateOutput(output, LAYOUT).map((issue) => issue.code)).toContain(
      'E_INVARIANT_affordance_resolution_must_not_change_world_state',
    );
  });

  it('색인과 전수 조회가 어긋난 반경 질의를 잡는다', () => {
    const output = executeS0({
      ...baseInput,
      steps: [{ kind: 'range', id: 'look', center: 'hunter', radius: 3 }],
    });
    const step = output.steps[0];
    if (step) step.rangeByFullScan = ['조작된_답'];
    expect(validateOutput(output, LAYOUT).map((issue) => issue.code)).toContain(
      'E_INVARIANT_spatial_index_result_must_equal_full_scan',
    );
  });

  it('이유 없는 거절을 잡는다', () => {
    const output = executeS0(baseInput);
    const offer = output.steps[0]?.offers?.find((entry) => entry.affordanceId === 'take_relic');
    if (offer) offer.refusals = [];
    expect(validateOutput(output, LAYOUT).map((issue) => issue.code)).toContain(
      'E_INVARIANT_refusal_must_name_what_blocks_it',
    );
  });

  it('걸음수와 맞지 않는 경로 비용을 잡는다', () => {
    const output = executeS0({
      ...baseInput,
      steps: [{ kind: 'path', id: 'walk', from: 'hunter', to: 'dropped_coin' }],
    });
    const step = output.steps[0];
    if (step?.path) step.path.cost = 99;
    expect(validateOutput(output, LAYOUT).map((issue) => issue.code)).toContain(
      'E_INVARIANT_path_cost_must_equal_the_sum_of_its_steps',
    );
  });
});

describe('걸음 실행', () => {
  it('공간에 없는 것을 향해 길을 물으면 거절이 기록된다', () => {
    const output = executeS0({
      ...baseInput,
      steps: [{ kind: 'path', id: 'walk', from: 'hunter', to: 'no_such_entity' }],
    });
    expect(output.steps[0]?.rejection?.code).toBe('E_NO_POSITION');
    expect(output.steps[0]?.path).toBeNull();
  });

  it('규칙이 없으면 의도는 거부되고 세계는 그대로다', () => {
    const output = executeS0({
      ...baseInput,
      rules: [],
      steps: [{ kind: 'act', id: 'open', intent: { id: 'i', actor: 'hunter', verb: 'open', targets: ['oak_door'] } }],
    });
    expect(output.steps[0]?.outcome?.ok).toBe(false);
    expect(output.steps[0]?.hashBefore).toBe(output.steps[0]?.hashAfter);
  });

  it('격자 밖에 있는 실체를 드러낸다 — 조용히 사라지지 않는다', () => {
    expect(executeS0(baseInput).outsideGrid).toEqual(['far_watchtower']);
  });

  it('같은 입력이면 같은 요약 해시다 (GI-12)', () => {
    expect(executeS0(baseInput).digest).toBe(executeS0(baseInput).digest);
  });
});
