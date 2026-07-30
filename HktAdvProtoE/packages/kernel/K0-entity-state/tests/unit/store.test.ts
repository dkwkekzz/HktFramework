import { describe, expect, it } from 'vitest';
import { ComponentRegistry, EntityStore, StoreRejection, OWNERSHIP_COMPONENT } from '../../src/index.js';
import { COMPONENT_DEFINITIONS } from '../../scenarios/fixtures.js';

const registry = ComponentRegistry.of(COMPONENT_DEFINITIONS);

function world(): EntityStore {
  return EntityStore.empty(registry)
    .spawn({ id: 'hunter_a', kind: 'person', tags: ['human'], components: { health: { current: 42, max: 100 } } })
    .spawn({ id: 'hunter_b', kind: 'person', components: { health: { current: 91, max: 100 } } });
}

describe('실체 등록', () => {
  it('빈 저장소는 아무것도 갖지 않는다', () => {
    const store = EntityStore.empty(registry);
    expect(store.size).toBe(0);
    expect(store.get('hunter_a')).toBeNull();
    expect(store.list()).toEqual([]);
  });

  it('같은 id 를 두 번 등록하면 거부한다', () => {
    expect(() => world().spawn({ id: 'hunter_a', kind: 'person' })).toThrow(StoreRejection);
    try {
      world().spawn({ id: 'hunter_a', kind: 'person' });
    } catch (error) {
      expect((error as StoreRejection).code).toBe('E_DUPLICATE_ENTITY_ID');
      expect((error as StoreRejection).path).toBe('entity/hunter_a');
    }
  });

  it('id·종류·태그는 소문자 snake_case 여야 한다', () => {
    const empty = EntityStore.empty(registry);
    expect(() => empty.spawn({ id: 'HunterA', kind: 'person' })).toThrow(/실체 id/);
    expect(() => empty.spawn({ id: 'hunter_a', kind: 'Person' })).toThrow(/실체 종류/);
    expect(() => empty.spawn({ id: 'hunter_a', kind: 'person', tags: ['Human'] })).toThrow(/태그/);
  });

  it('태그는 중복이 접히고 오름차순으로 정렬된다', () => {
    const store = EntityStore.empty(registry).spawn({
      id: 'hunter_a',
      kind: 'person',
      tags: ['hunter', 'human', 'hunter'],
    });
    expect(store.get('hunter_a')?.tags).toEqual(['human', 'hunter']);
  });

  it('삭제하면 조회도 인덱스도 사라진다', () => {
    const store = world().despawn('hunter_a');
    expect(store.get('hunter_a')).toBeNull();
    expect([...store.byKind('person')]).toEqual(['hunter_b']);
    expect([...store.withComponent('health')]).toEqual(['hunter_b']);
  });

  it('없는 실체를 삭제하면 거부한다', () => {
    expect(() => world().despawn('ghost')).toThrow(/없는 실체/);
  });

  it('require 는 없는 실체를 거부로 알린다', () => {
    expect(world().require('hunter_a').id).toBe('hunter_a');
    expect(() => world().require('ghost')).toThrow(StoreRejection);
  });
});

describe('컴포넌트 저장', () => {
  it('없는 실체에는 쓸 수 없다', () => {
    expect(() => world().setComponent('ghost', 'health', { current: 1, max: 2 })).toThrow(/없는 실체/);
  });

  it('선언되지 않은 종류는 거부한다', () => {
    try {
      world().setComponent('hunter_a', 'mood', { value: 1 });
      expect.unreachable('거부되어야 한다');
    } catch (error) {
      expect((error as StoreRejection).code).toBe('E_UNKNOWN_COMPONENT_TYPE');
    }
  });

  it('스키마를 어기면 어긴 경로까지 지목한다', () => {
    try {
      world().setComponent('hunter_a', 'health', { current: -1, max: 100 });
      expect.unreachable('거부되어야 한다');
    } catch (error) {
      expect((error as StoreRejection).code).toBe('E_COMPONENT_SCHEMA');
      expect((error as StoreRejection).path).toBe('entity/hunter_a/components/health/current');
    }
  });

  it('같은 종류를 다시 쓰면 덮어쓴다 — 쌓이지 않는다', () => {
    const store = world()
      .setComponent('hunter_a', 'health', { current: 10, max: 100 })
      .setComponent('hunter_a', 'health', { current: 5, max: 100 });
    expect(store.component('hunter_a', 'health')).toEqual({ current: 5, max: 100 });
    expect([...store.withComponent('health')]).toEqual(['hunter_a', 'hunter_b']);
  });

  it('없는 컴포넌트를 지우면 거부한다', () => {
    expect(() => world().removeComponent('hunter_a', 'position')).toThrow(/없는 컴포넌트/);
  });

  it('거부된 연산은 원본 저장소를 바꾸지 않는다', () => {
    const before = world();
    const hash = before.hash();
    expect(() => before.setComponent('hunter_a', 'health', { current: -1, max: 1 })).toThrow();
    expect(before.hash()).toBe(hash);
  });
});

describe('태그', () => {
  it('붙이고 뗄 수 있고, 같은 태그를 두 번 붙여도 하나다', () => {
    const store = world().attachTag('hunter_a', 'wounded').attachTag('hunter_a', 'wounded');
    expect(store.get('hunter_a')?.tags).toEqual(['human', 'wounded']);
    expect(store.removeTag('hunter_a', 'wounded').get('hunter_a')?.tags).toEqual(['human']);
  });

  it('없는 태그를 떼면 같은 저장소를 그대로 돌려준다', () => {
    const store = world();
    expect(store.removeTag('hunter_a', 'none_such')).toBe(store);
  });
});

describe('읽기 격리', () => {
  it('읽기 결과와 컴포넌트가 모두 동결되어 있다', () => {
    const state = world().get('hunter_a');
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state?.components['health'])).toBe(true);
  });

  it('넘겨준 입력을 나중에 고쳐도 저장소는 흔들리지 않는다', () => {
    const data = { current: 50, max: 100 };
    const store = world().setComponent('hunter_a', 'health', data);
    data.current = 1;
    expect(store.component('hunter_a', 'health')).toEqual({ current: 50, max: 100 });
  });
});

describe('스냅샷과 해시', () => {
  it('같은 내용이면 삽입 순서와 무관하게 같은 해시다', () => {
    const forward = world();
    const backward = EntityStore.empty(registry)
      .spawn({ id: 'hunter_b', kind: 'person', components: { health: { current: 91, max: 100 } } })
      .spawn({ id: 'hunter_a', kind: 'person', tags: ['human'], components: { health: { current: 42, max: 100 } } });
    expect(backward.hash()).toBe(forward.hash());
  });

  it('내용이 다르면 해시도 다르다', () => {
    expect(world().setComponent('hunter_a', 'health', { current: 41, max: 100 }).hash()).not.toBe(
      world().hash(),
    );
  });

  it('스냅샷으로 되살리면 같은 저장소가 나온다', () => {
    const store = world();
    const restored = EntityStore.restore(store.snapshot(), registry);
    expect(restored.hash()).toBe(store.hash());
    expect(restored.list()).toEqual(store.list());
  });

  it('스냅샷은 동결되어 있다', () => {
    expect(Object.isFrozen(world().snapshot())).toBe(true);
  });
});

describe('감사', () => {
  it('정상 저장소는 감사에 걸리지 않는다', () => {
    expect(world().audit()).toEqual([]);
  });

  it('없는 소유자를 적으면 GI-11 로 걸린다', () => {
    const store = world()
      .spawn({ id: 'relic', kind: 'item' })
      .setComponent('relic', OWNERSHIP_COMPONENT, { ownerId: 'nobody' });
    expect(store.audit().map((issue) => issue.code)).toEqual([
      'E_INVARIANT_owned_entity_must_have_single_owner',
    ]);
  });

  it('소유자가 실재하면 통과한다', () => {
    const store = world()
      .spawn({ id: 'relic', kind: 'item' })
      .setComponent('relic', OWNERSHIP_COMPONENT, { ownerId: 'hunter_a' });
    expect(store.audit()).toEqual([]);
  });
});

describe('컴포넌트 레지스트리', () => {
  it('같은 종류를 두 번 선언하면 거부한다', () => {
    expect(() =>
      ComponentRegistry.of([
        { type: 'health', schema: { type: 'object' } },
        { type: 'health', schema: { type: 'object' } },
      ]),
    ).toThrow(/두 번 선언/);
  });

  it('종류 이름 규약을 강제한다', () => {
    expect(() => ComponentRegistry.of([{ type: 'Health', schema: { type: 'object' } }])).toThrow(
      /snake_case/,
    );
  });

  it('선언 목록을 오름차순으로 돌려준다', () => {
    expect(registry.types()).toEqual(['energy', 'health', 'ownership', 'position']);
  });

  it('extend 는 원본을 바꾸지 않는다', () => {
    const extended = registry.extend([{ type: 'mood', schema: { type: 'object' } }]);
    expect(extended.has('mood')).toBe(true);
    expect(registry.has('mood')).toBe(false);
  });
});
