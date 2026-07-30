import { describe, expect, it } from 'vitest';
import { FixtureError, FixtureLoader } from '../../src/fixture.js';
import sceneStateSchema from '../../schemas/v3-scene-state.schema.json';
import type { JsonSchema } from '@hkt/v1-schema';
import type { Fixture, JsonObject } from '../../src/types.js';

const SCHEMA_ID = 'https://hkt.local/schemas/v3-scene-state.schema.json';

const good: Fixture = {
  id: 'scene',
  title: '정상 장면',
  schemaId: SCHEMA_ID,
  state: { actor: { id: 'a', energy: 10 }, log: [] },
};

function loader(): FixtureLoader {
  return new FixtureLoader().addSchema(sceneStateSchema as JsonSchema);
}

describe('FixtureLoader', () => {
  it('스키마를 지키는 픽스처를 등록한다', () => {
    expect(loader().add(good).ids()).toEqual(['scene']);
  });

  it('스키마를 어기면 경로와 함께 거부한다', () => {
    const broken: Fixture = { ...good, id: 'broken', state: { actor: { id: 'a', energy: 'ten' }, log: [] } };
    const issues = loader().check(broken);
    expect(issues.map((issue) => issue.path)).toEqual(['/fixtures/broken/state/actor/energy']);
    expect(issues[0]?.code).toBe('E_TYPE');
    expect(() => loader().add(broken)).toThrow(FixtureError);
  });

  it('등록되지 않은 스키마 id 를 가리키면 거부한다', () => {
    const issues = new FixtureLoader().check({ ...good, schemaId: 'https://hkt.local/none.json' });
    expect(issues[0]?.code).toBe('E_UNKNOWN_SCHEMA_ID');
  });

  it('픽스처 id 형식을 강제한다', () => {
    expect(loader().check({ ...good, id: 'Scene-1' })[0]?.code).toBe('E_FIXTURE_ID_FORMAT');
  });

  it('같은 id 를 다른 내용으로 두 번 등록하지 못한다', () => {
    const store = loader().add(good);
    expect(() => store.add({ ...good, title: '다른 제목' })).toThrow(/E_DUPLICATE_FIXTURE_ID/);
    // 같은 내용의 재등록은 허용한다 — 순서가 결과를 바꾸지 않게
    expect(() => store.add({ ...good })).not.toThrow();
  });

  it('load 는 매번 새로 복사해 동결한 상태를 준다', () => {
    const store = loader().add(good);
    const first = store.load('scene');
    const second = store.load('scene');
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first['actor'])).toBe(true);
    expect(() => {
      (first['actor'] as JsonObject)['energy'] = 0;
    }).toThrow(TypeError);
  });

  it('모르는 픽스처는 등록된 목록과 함께 거부한다', () => {
    expect(() => loader().add(good).load('none')).toThrow(/E_UNKNOWN_FIXTURE/);
  });

  it('ids 는 등록 순서와 무관하게 오름차순이다', () => {
    const a = loader().add({ ...good, id: 'b_scene' }).add({ ...good, id: 'a_scene' });
    const b = loader().add({ ...good, id: 'a_scene' }).add({ ...good, id: 'b_scene' });
    expect(a.ids()).toEqual(b.ids());
  });
});
