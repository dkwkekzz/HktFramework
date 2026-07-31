import { describe, expect, it } from 'vitest';
import type { StoreOperation } from '@hkt/k0-entity-state';
import { SpatialIndex } from '@hkt/s0-spatial-affordance';
import {
  buildFoodWeb,
  buildWorld,
  consumersOf,
  livingOrganisms,
  naturalIntentsFor,
  populationOf,
} from '../../src/index.js';
import { COMPONENT_DEFINITIONS, LAYOUT, MEADOW } from '../../scenarios/fixtures.js';

const webOf = (operations: StoreOperation[]) => {
  const store = buildWorld({ components: COMPONENT_DEFINITIONS, operations });
  return { store, web: buildFoodWeb(store, SpatialIndex.build(store, LAYOUT)) };
};

describe('먹이 관계', () => {
  it('종과 거리를 함께 통과한 것만 이어진다', () => {
    const { web } = webOf(MEADOW);
    expect(web.links.map((link) => [link.consumer, link.prey])).toEqual([
      ['deer_herd', 'meadow_grass'],
      ['wolf_pack', 'deer_herd'],
    ]);
    // far_meadow 는 풀이지만 사슴의 서식지 5m 밖에 있다.
    expect(web.links.some((link) => link.prey === 'far_meadow')).toBe(false);
  });

  it('먹이가 서식지 밖에만 있으면 "없다"가 아니라 "멀다"로 말한다', () => {
    const { web } = webOf([...MEADOW, { op: 'despawn', id: 'meadow_grass' }]);
    const gap = web.gaps.find((entry) => entry.consumer === 'deer_herd');
    expect(gap?.code).toBe('E_PREY_OUT_OF_HABITAT');
    expect(gap?.rejected).toEqual(['far_meadow']);
  });

  it('먹이가 세계에 아예 없는 것과 바닥난 것을 구분한다', () => {
    const none = webOf([
      ...MEADOW,
      { op: 'despawn', id: 'meadow_grass' },
      { op: 'despawn', id: 'far_meadow' },
    ]).web.gaps.find((gap) => gap.consumer === 'deer_herd');
    expect(none?.code).toBe('E_NO_PREY_IN_WORLD');

    const empty = webOf([
      ...MEADOW,
      { op: 'set_component', id: 'meadow_grass', type: 'population', data: { count: 0 } },
    ]).web.gaps.find((gap) => gap.consumer === 'deer_herd');
    expect(empty?.code).toBe('E_PREY_EXHAUSTED');
    expect(empty?.rejected).toEqual(['meadow_grass']);
  });

  it('먹이를 선언하지 않은 것은 먹는 쪽이 아니다', () => {
    const { web } = webOf(MEADOW);
    expect(web.links.some((link) => link.consumer === 'meadow_grass')).toBe(false);
    expect(web.gaps.some((gap) => gap.consumer === 'meadow_grass')).toBe(false);
  });

  it('후보가 여럿이면 개체군이 많은 쪽을, 같으면 id 오름차순으로 고른다', () => {
    const twoMeadows: StoreOperation[] = [
      ...MEADOW,
      {
        op: 'spawn',
        id: 'clover_patch',
        kind: 'flora',
        tags: ['grass'],
        components: { position: { x: 5, y: 3, z: 0 }, population: { count: 40 } },
      },
    ];
    expect(webOf(twoMeadows).web.links.find((link) => link.consumer === 'deer_herd')?.prey).toBe('clover_patch');

    const tied: StoreOperation[] = [
      ...twoMeadows,
      { op: 'set_component', id: 'clover_patch', type: 'population', data: { count: 10 } },
    ];
    // 같은 10 포기라면 id 오름차순 — clover_patch < meadow_grass
    expect(webOf(tied).web.links.find((link) => link.consumer === 'deer_herd')?.prey).toBe('clover_patch');
  });

  it('개체군이 0 인 것은 먹는 쪽에서 빠진다', () => {
    const { store } = webOf([
      ...MEADOW,
      { op: 'set_component', id: 'deer_herd', type: 'population', data: { count: 0 } },
    ]);
    expect(consumersOf(store)).toEqual(['wolf_pack']);
    expect(populationOf(store, 'deer_herd')).toBe(0);
  });
});

describe('하루의 순서', () => {
  const { store, web } = webOf(MEADOW);

  it('허기를 가진 것만 하루를 산다 — 풀은 뜯기기만 한다', () => {
    expect(livingOrganisms(store)).toEqual(['deer_herd', 'wolf_pack']);
  });

  it('실체 id 오름차순, 한 실체 안에서는 언제나 같은 순서다', () => {
    expect(naturalIntentsFor(store, web, 1).map((intent) => `${intent.actor}/${intent.verb}`)).toEqual([
      'deer_herd/fester',
      'deer_herd/settle',
      'deer_herd/hunt',
      'wolf_pack/fester',
      'wolf_pack/settle',
      'wolf_pack/hunt',
    ]);
  });

  it('먹이가 없으면 hunt 가 아니라 endure 다 — 없는 대상을 조건식에 넣지 않는다', () => {
    const starving = webOf([...MEADOW, { op: 'despawn', id: 'meadow_grass' }]);
    const verbs = naturalIntentsFor(starving.store, starving.web, 1)
      .filter((intent) => intent.actor === 'deer_herd')
      .map((intent) => intent.verb);
    expect(verbs).toEqual(['fester', 'settle', 'endure']);
  });

  it('의도 id 는 틱과 실체와 동사로 정해진다 — 다시 굴려도 같다', () => {
    expect(naturalIntentsFor(store, web, 7)[0]?.id).toBe('t7_deer_herd_fester');
  });
});
