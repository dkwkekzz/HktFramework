import { describe, expect, it } from 'vitest';
import { QueryRejection, planQuery, runQuery, runQueryByFullScan } from '../../src/index.js';
import { buildWorld, createK1Module, executeK1, validateInput, validateOutput } from '../../src/module.js';
import { k1Scenarios } from '../../scenarios/index.js';
import { COMPONENT_DEFINITIONS, ROOM } from '../../scenarios/fixtures.js';
import predicateSchema from '../../schemas/k1-predicate.schema.json';
import querySchema from '../../schemas/k1-query.schema.json';

const world = { components: COMPONENT_DEFINITIONS, operations: ROOM };
const store = buildWorld(world);

describe('질의 계획', () => {
  it('from.kind 는 종류 인덱스를 쓴다', () => {
    const { plan } = planQuery(store, { as: 's', from: { kind: 'person' }, where: { op: 'eq', path: 's.kind', value: 'person' } });
    expect(plan.source).toBe('by_kind');
    expect(plan.scanned).toBeLessThan(plan.total);
  });

  it('좁힐 것이 없으면 전수로 훑는다', () => {
    const { plan } = planQuery(store, { as: 's', where: { op: 'has_tag', target: 's', tag: 'human' } });
    expect(plan.source).toBe('full_scan');
    expect(plan.scanned).toBe(plan.total);
  });

  it('or 안쪽의 조건으로는 좁히지 않는다', () => {
    const { plan } = planQuery(store, {
      as: 's',
      where: {
        op: 'or',
        items: [
          { op: 'eq', path: 's.kind', value: 'person' },
          { op: 'eq', path: 's.kind', value: 'structure' },
        ],
      },
    });
    expect(plan.source).toBe('full_scan');
  });

  it('not 안쪽의 조건으로도 좁히지 않는다', () => {
    const { plan } = planQuery(store, {
      as: 's',
      where: { op: 'not', item: { op: 'eq', path: 's.kind', value: 'person' } },
    });
    expect(plan.source).toBe('full_scan');
  });

  it('여러 후보가 있으면 가장 적게 훑는 계획을 고른다', () => {
    const { plan } = planQuery(store, {
      as: 's',
      from: { kind: 'person' },
      where: { op: 'gt', path: 's.faction.rank', value: 0 },
    });
    expect(plan.source).toBe('by_component');
    expect(plan.scanned).toBe(0);
  });

  it('선언되지 않은 컴포넌트를 from 에 적으면 거부한다', () => {
    expect(() => planQuery(store, { as: 's', from: { withComponent: 'mood' }, where: { op: 'has_tag', target: 's', tag: 'human' } })).toThrow(
      QueryRejection,
    );
  });

  it('as 와 고정 결합의 이름이 부딪히면 거부한다', () => {
    expect(() =>
      runQuery(store, { as: 's', bindings: { s: 'hero' }, where: { op: 'has_tag', target: 's', tag: 'human' } }),
    ).toThrow(/부딪힌다/);
  });

  it('as 이름 규약을 강제한다', () => {
    expect(() => runQuery(store, { as: 'S', where: { op: 'has_tag', target: 'S', tag: 'human' } })).toThrow(
      /snake_case/,
    );
  });

  it('결과는 언제나 오름차순이다', () => {
    const report = runQuery(store, { as: 's', where: { op: 'has_tag', target: 's', tag: 'human' } });
    expect(report.matched).toEqual([...report.matched].sort());
  });

  it('from.tag 는 인덱스 없이 걸러 낸다', () => {
    const report = runQuery(store, {
      as: 's',
      from: { kind: 'person', tag: 'healer' },
      where: { op: 'has_tag', target: 's', tag: 'human' },
    });
    expect(report.plan.source).toBe('by_tag');
    expect(report.matched).toEqual(['dying_healer']);
  });

  it('계획과 전수 조회의 답이 같다', () => {
    const spec = { as: 's', from: { kind: 'person' }, where: { op: 'gt' as const, path: 's.health.current', value: 40 } };
    expect(runQuery(store, spec).matched).toEqual(runQueryByFullScan(store, spec));
  });
});

describe('executeK1', () => {
  const input = {
    world,
    queries: [{ id: 'humans', spec: { as: 's', where: { op: 'has_tag' as const, target: 's', tag: 'human' } } }],
    checks: [{ id: 'hero_is_human', predicate: { op: 'has_tag' as const, target: 'h', tag: 'human' }, bindings: { h: 'hero' } }],
  };

  it('질의와 조건을 함께 돌린다', () => {
    const output = executeK1(input);
    expect(output.queries[0]?.report?.matched).toHaveLength(6);
    expect(output.checks[0]?.passed).toBe(true);
  });

  it('세계를 바꾸지 않는다', () => {
    const output = executeK1(input);
    expect(output.worldHashBefore).toBe(output.worldHashAfter);
  });

  it('거부된 질의는 보고 대신 거부를 남긴다', () => {
    const output = executeK1({
      world,
      queries: [{ id: 'bad', spec: { as: 's', where: { op: 'gt', path: 's.healt.current', value: 1 } } }],
    });
    expect(output.queries[0]?.report).toBeNull();
    expect(output.queries[0]?.rejection?.code).toBe('E_UNKNOWN_COMPONENT');
  });

  it('같은 입력이면 같은 digest 다', () => {
    expect(executeK1(input).digest).toBe(executeK1(input).digest);
  });
});

describe('validateInput', () => {
  it('world 가 없으면 거부한다', () => {
    expect(() => validateInput({})).toThrow(/world/);
    expect(() => validateInput({ world: {} })).toThrow(/operations/);
  });

  it('queries·checks 는 id 를 가진 객체 배열이어야 한다', () => {
    expect(() => validateInput({ world: { operations: [] }, queries: [{}] })).toThrow(/id/);
    expect(() => validateInput({ world: { operations: [] }, checks: 'x' })).toThrow(/checks/);
  });
});

describe('validateOutput', () => {
  it('정상 출력에는 위반이 없다', () => {
    expect(validateOutput(executeK1({ world, queries: [{ id: 'a', spec: { as: 's', where: { op: 'has_tag', target: 's', tag: 'human' } } }] }))).toEqual([]);
  });

  it('계획과 전수의 답이 다르면 잡는다', () => {
    const output = executeK1({ world, queries: [{ id: 'a', spec: { as: 's', where: { op: 'has_tag', target: 's', tag: 'human' } } }] });
    const first = output.queries[0] as NonNullable<(typeof output.queries)[number]>;
    const forged: typeof output = { ...output, queries: [{ ...first, fullScan: ['nobody'] }] };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_planned_result_must_equal_full_scan',
    );
  });

  it('세계 해시가 달라지면 잡는다', () => {
    const output = executeK1({ world });
    expect(validateOutput({ ...output, worldHashAfter: 'sha256:x' }).map((issue) => issue.code)).toContain(
      'E_INVARIANT_query_must_not_change_world_state',
    );
  });

  it('떨어졌는데 원인이 없으면 잡는다', () => {
    const output = executeK1({ world, queries: [{ id: 'a', spec: { as: 's', where: { op: 'has_tag', target: 's', tag: 'beast' } } }] });
    const first = output.queries[0] as NonNullable<(typeof output.queries)[number]>;
    const report = first.report as NonNullable<typeof first.report>;
    const forged: typeof output = {
      ...output,
      queries: [
        {
          ...first,
          report: { ...report, candidates: report.candidates.map((candidate) => ({ ...candidate, causes: [] })) },
        },
      ],
    };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_failure_cause_must_point_at_the_failing_condition',
    );
  });
});

describe('모듈 정의', () => {
  const module = createK1Module(k1Scenarios);

  it('원문 「3.2」의 형태를 갖춘다', () => {
    expect(module.id).toBe('K1');
    expect(module.dependencies).toEqual(['V0', 'K0']);
    expect(module.purpose.split(/[.。]\s+/).filter((part) => part.trim() !== '').length).toBe(1);
  });
});

describe('스키마 문서', () => {
  /**
   * V1 로 실제 컴파일·검증하는 일은 저장소 규약 검사(`tests/conventions.test.ts`)가 모든 모듈에
   * 대해 한다. K1 은 V1 을 선행으로 두지 않으므로(원문 「9」) 여기서는 **스키마가 구현과 같은
   * 연산자 집합을 말하는지**만 본다 — 문서와 코드가 갈라지는 것을 막는 것이 목적이다.
   */
  it('조건식 스키마의 연산자 목록이 구현과 같다', () => {
    const declared = (predicateSchema.properties.op.enum as string[]).slice().sort();
    expect(declared).toEqual(['and', 'eq', 'gt', 'has_tag', 'lt', 'not', 'or', 'within_distance']);
  });

  it('조건식 스키마가 자기 자신을 참조해 재귀 구조를 말한다', () => {
    expect(predicateSchema.properties.items.items.$ref).toBe(predicateSchema.$id);
    expect(predicateSchema.properties.item.$ref).toBe(predicateSchema.$id);
    expect(predicateSchema.properties.items.minItems).toBe(1);
  });

  it('질의 스키마가 대표 질의의 필드를 모두 안다', () => {
    const spec = k1Scenarios[0]?.arrange().queries?.[0]?.spec as unknown as Record<string, unknown>;
    const known = Object.keys(querySchema.properties);
    expect(Object.keys(spec).every((key) => known.includes(key))).toBe(true);
    expect(querySchema.required).toEqual(['as', 'where']);
  });
});
