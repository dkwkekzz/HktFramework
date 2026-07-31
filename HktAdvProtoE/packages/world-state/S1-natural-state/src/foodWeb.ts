import type { EntityId, EntityStore } from '@hkt/k0-entity-state';
import { SpatialIndex, boxDistance, boxOf, positionOf } from '@hkt/s0-spatial-affordance';
import { NATURAL_COMPONENT, type FoodGap, type FoodLink, type FoodWeb } from './types.js';

/**
 * 먹이 관계 — S1 이 소유하는 파생 상태.
 *
 * ## 왜 S0 이 선행인가 (원문 「10」 S1: "선행 K, S0")
 *
 * "늑대가 사슴을 먹는다"는 종의 성질이고, "**지금 그 사슴이 사정권 안에 있는가**"는 공간의 사실이다.
 * 둘을 함께 봐야 먹이 관계가 정해진다. 종만 보면 지구 반대편의 사슴을 먹고, 공간만 보면 늑대가
 * 풀을 뜯는다.
 *
 * ## 왜 규칙이 아니라 여기서 고르는가
 *
 * K2 의 조건식(`PredicateSpec`)은 **주어진 결합**에 대한 참·거짓만 판정한다. 세계를 뒤져 대상을
 * 찾아오지 못한다. 그러니 "무엇을 먹을 것인가"는 규칙 밖에서 정해져 의도에 실려 와야 한다.
 * 대신 "먹어도 되는가"(배가 고픈가·먹이가 남았는가)는 전부 규칙이 판정한다 — 그래야 그 판정이
 * 데이터로 남고 사건으로 기록된다.
 */

/** 먹는 쪽이 될 수 있는 실체 (id 오름차순) — 먹이 관계를 선언했고 아직 살아 있는 것들. */
export function consumersOf(store: EntityStore): EntityId[] {
  return store
    .withComponent(NATURAL_COMPONENT.DIET)
    .filter((id) => populationOf(store, id) > 0)
    .slice()
    .sort();
}

export function populationOf(store: EntityStore, id: EntityId): number {
  const value = store.component(id, NATURAL_COMPONENT.POPULATION)?.['count'];
  return typeof value === 'number' ? value : 0;
}

function dietOf(store: EntityStore, id: EntityId): string[] {
  const eats = store.component(store.has(id) ? id : id, NATURAL_COMPONENT.DIET)?.['eats'];
  if (!Array.isArray(eats)) return [];
  return [...new Set(eats.filter((tag): tag is string => typeof tag === 'string'))].sort();
}

function habitatOf(store: EntityStore, id: EntityId): number {
  const radius = store.component(id, NATURAL_COMPONENT.HABITAT)?.['radius'];
  return typeof radius === 'number' && Number.isFinite(radius) && radius >= 0 ? radius : 0;
}

/**
 * 지금 성립하는 먹이 관계 전부.
 *
 * 후보가 여럿이면 **개체군이 많은 쪽**을 고르고, 같으면 id 오름차순으로 깬다. 가까운 쪽을 고르면
 * 거리가 소수점 한 자리에서 갈릴 때 결과가 흔들린다 — 개체군은 정수이므로 흔들리지 않는다(GI-12).
 */
export function buildFoodWeb(store: EntityStore, index: SpatialIndex): FoodWeb {
  const links: FoodLink[] = [];
  const gaps: FoodGap[] = [];

  for (const consumer of consumersOf(store)) {
    const eats = dietOf(store, consumer);
    if (eats.length === 0) {
      gaps.push({
        consumer,
        code: 'E_NO_DIET',
        message: `${consumer} 가 무엇을 먹는지 선언하지 않았다`,
        rejected: [],
      });
      continue;
    }

    const center = positionOf(store, consumer);
    const consumerBox = boxOf(store, consumer);
    if (!center || !consumerBox) {
      gaps.push({
        consumer,
        code: 'E_PREY_OUT_OF_HABITAT',
        message: `${consumer} 가 공간에 없다 — 사정권을 잴 수 없다`,
        rejected: [],
      });
      continue;
    }

    const radius = habitatOf(store, consumer);
    const inHabitat = new Set(index.within(store, center, radius).matched);
    const edible = store
      .ids()
      .filter((id) => id !== consumer)
      .filter((id) => store.require(id).tags.some((tag) => eats.includes(tag)));

    if (edible.length === 0) {
      gaps.push({
        consumer,
        code: 'E_NO_PREY_IN_WORLD',
        message: `${consumer} 가 먹는 것(${eats.join(', ')})이 세계에 없다`,
        rejected: [],
      });
      continue;
    }

    const reachable = edible.filter((id) => inHabitat.has(id));
    if (reachable.length === 0) {
      gaps.push({
        consumer,
        code: 'E_PREY_OUT_OF_HABITAT',
        message: `${consumer} 의 서식지 ${radius}m 안에 먹이가 없다 — 세계에는 ${edible.join(', ')} 가 있다`,
        rejected: edible,
      });
      continue;
    }

    const alive = reachable.filter((id) => populationOf(store, id) > 0);
    if (alive.length === 0) {
      gaps.push({
        consumer,
        code: 'E_PREY_EXHAUSTED',
        message: `${consumer} 의 먹이(${reachable.join(', ')})가 모두 바닥났다`,
        rejected: reachable,
      });
      continue;
    }

    const prey = alive.reduce((best, id) => {
      const difference = populationOf(store, id) - populationOf(store, best);
      if (difference !== 0) return difference > 0 ? id : best;
      return id < best ? id : best;
    });

    const preyBox = boxOf(store, prey);
    links.push({
      consumer,
      prey,
      distance: preyBox ? round(boxDistance(consumerBox, preyBox)) : 0,
      available: populationOf(store, prey),
      reason: `서식지 ${radius}m 안에서 ${eats.join('·')} 중 가장 많이 남은 것`,
    });
  }

  return { links, gaps };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
