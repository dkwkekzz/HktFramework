import { describe, expect, it } from 'vitest';
import { QueryRejection, deepEqual, evaluate, resolveBinding, resolvePath } from '../../src/index.js';
import type { PredicateSpec } from '../../src/index.js';
import { buildWorld } from '../../src/module.js';
import { COMPONENT_DEFINITIONS, ROOM } from '../../scenarios/fixtures.js';

const store = buildWorld({ components: COMPONENT_DEFINITIONS, operations: ROOM });
const bindings = { subject: 'wounded_scout', hero: 'hero', wall: 'stone_wall', ghost: 'ghost_child' };

const value = (predicate: PredicateSpec, table = bindings): boolean =>
  evaluate(store, predicate, table).passed;

describe('경로 해석', () => {
  it('컴포넌트 안의 값을 꺼낸다', () => {
    expect(resolvePath(store, bindings, 'subject.health.current', 'at').value).toBe(12);
  });

  it('실체 자체의 항목도 읽는다', () => {
    expect(resolvePath(store, bindings, 'subject.kind', 'at').value).toBe('person');
    expect(resolvePath(store, bindings, 'subject.id', 'at').value).toBe('wounded_scout');
    expect(resolvePath(store, bindings, 'subject.tags', 'at').value).toEqual(['human', 'scout']);
  });

  it('없는 컴포넌트는 found=false 로 알린다', () => {
    const resolution = resolvePath(store, bindings, 'wall.health.current', 'at');
    expect(resolution.found).toBe(false);
    expect(resolution.at).toBe('wall.health');
    expect(resolution.reason).toContain('stone_wall');
  });

  it('없는 필드도 found=false 다', () => {
    expect(resolvePath(store, bindings, 'subject.health.stamina', 'at').found).toBe(false);
  });

  it('선언되지 않은 컴포넌트는 거부한다', () => {
    expect(() => resolvePath(store, bindings, 'subject.healt.current', 'at')).toThrow(QueryRejection);
  });

  it('모르는 결합 이름은 거부한다', () => {
    expect(() => resolvePath(store, bindings, 'villain.health.current', 'at')).toThrow(/모르는 결합/);
  });

  it('문법에 맞지 않는 경로는 거부한다', () => {
    expect(() => resolvePath(store, bindings, 'Subject.Health', 'at')).toThrow(/경로/);
    expect(() => resolvePath(store, bindings, '', 'at')).toThrow(/경로/);
  });

  it('kind 아래로 더 들어갈 수 없다', () => {
    expect(() => resolvePath(store, bindings, 'subject.kind.name', 'at')).toThrow(/더 들어갈 수 없다/);
  });

  it('결합 해석은 없는 실체를 found=false 로 알린다', () => {
    expect(resolveBinding(store, { x: 'no_such' }, 'x', 'at').found).toBe(false);
  });
});

describe('연산자', () => {
  it('eq 는 깊은 비교다', () => {
    expect(value({ op: 'eq', path: 'subject.health', value: { max: 100, current: 12 } })).toBe(true);
    expect(value({ op: 'eq', path: 'subject.health', value: { current: 12 } })).toBe(false);
  });

  it('gt · lt', () => {
    expect(value({ op: 'gt', path: 'subject.health.current', value: 5 })).toBe(true);
    expect(value({ op: 'lt', path: 'subject.health.current', value: 5 })).toBe(false);
  });

  it('수가 아닌 값은 비교할 수 없다고 알린다', () => {
    const result = evaluate(store, { op: 'gt', path: 'subject.kind', value: 1 }, bindings);
    expect(result.passed).toBe(false);
    expect(result.causes[0]?.reason).toContain('E_NOT_COMPARABLE');
  });

  it('비교값이 수가 아니면 거부한다', () => {
    expect(() => value({ op: 'gt', path: 'subject.health.current', value: 'x' as unknown as number })).toThrow(
      QueryRejection,
    );
  });

  it('has_tag', () => {
    expect(value({ op: 'has_tag', target: 'subject', tag: 'human' })).toBe(true);
    expect(value({ op: 'has_tag', target: 'subject', tag: 'beast' })).toBe(false);
  });

  it('within_distance 는 경계를 포함한다', () => {
    expect(value({ op: 'within_distance', a: 'subject', b: 'hero', max: 3 })).toBe(true);
    expect(value({ op: 'within_distance', a: 'subject', b: 'hero', max: 2.9 })).toBe(false);
  });

  it('within_distance 는 대칭이다', () => {
    expect(value({ op: 'within_distance', a: 'subject', b: 'hero', max: 3 })).toBe(
      value({ op: 'within_distance', a: 'hero', b: 'subject', max: 3 }),
    );
  });

  it('위치가 없으면 거짓이고 이유가 남는다', () => {
    const result = evaluate(store, { op: 'within_distance', a: 'subject', b: 'nowhere', max: 100 }, {
      ...bindings,
      nowhere: 'no_such',
    });
    expect(result.passed).toBe(false);
    expect(result.causes[0]?.reason).toContain('E_MISSING_POSITION');
  });

  it('음수 거리는 거부한다', () => {
    expect(() => value({ op: 'within_distance', a: 'subject', b: 'hero', max: -1 })).toThrow(/0 이상/);
  });

  it('and · or · not', () => {
    const t: PredicateSpec = { op: 'has_tag', target: 'subject', tag: 'human' };
    const f: PredicateSpec = { op: 'has_tag', target: 'subject', tag: 'beast' };
    expect(value({ op: 'and', items: [t, t] })).toBe(true);
    expect(value({ op: 'and', items: [t, f] })).toBe(false);
    expect(value({ op: 'or', items: [t, f] })).toBe(true);
    expect(value({ op: 'or', items: [f, f] })).toBe(false);
    expect(value({ op: 'not', item: f })).toBe(true);
  });

  it('빈 and · or 는 거부한다', () => {
    expect(() => value({ op: 'and', items: [] })).toThrow(/비어 있지 않은/);
    expect(() => value({ op: 'or', items: [] })).toThrow(/비어 있지 않은/);
  });

  it('모르는 연산자는 거부한다', () => {
    expect(() => value({ op: 'like' } as unknown as PredicateSpec)).toThrow(/모르는 연산자/);
  });
});

describe('실패 원인', () => {
  it('and 는 어긴 항목만 원인으로 남긴다', () => {
    const result = evaluate(
      store,
      {
        op: 'and',
        items: [
          { op: 'has_tag', target: 'subject', tag: 'human' },
          { op: 'gt', path: 'subject.health.current', value: 1000 },
        ],
      },
      bindings,
    );
    expect(result.causes.map((cause) => cause.at)).toEqual(['subject.health.current']);
  });

  it('or 는 모든 항목이 원인이다', () => {
    const result = evaluate(
      store,
      {
        op: 'or',
        items: [
          { op: 'has_tag', target: 'subject', tag: 'beast' },
          { op: 'gt', path: 'subject.health.current', value: 1000 },
        ],
      },
      bindings,
    );
    expect(result.causes.map((cause) => cause.at)).toEqual(['subject.tags', 'subject.health.current']);
  });

  it('not 은 참이 된 안쪽 조건을 지목한다', () => {
    const result = evaluate(store, { op: 'not', item: { op: 'has_tag', target: 'subject', tag: 'human' } }, bindings);
    expect(result.causes.map((cause) => cause.at)).toEqual(['subject.tags']);
  });

  it('참이면 원인이 없다', () => {
    expect(evaluate(store, { op: 'has_tag', target: 'subject', tag: 'human' }, bindings).causes).toEqual([]);
  });

  it('판정 과정 전체가 남는다', () => {
    const result = evaluate(store, { op: 'and', items: [{ op: 'has_tag', target: 'subject', tag: 'human' }] }, bindings);
    expect(result.trace.op).toBe('and');
    expect(result.trace.children).toHaveLength(1);
    expect(result.trace.children[0]?.reason).not.toBe('');
  });
});

describe('deepEqual', () => {
  it('키 순서를 무시한다', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('배열은 순서를 지킨다', () => {
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('키 개수가 다르면 다르다', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('null 과 객체를 구분한다', () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
  });
});
