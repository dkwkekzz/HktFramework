import type { EntityId, EntityStore } from '@hkt/k0-entity-state';
import { blockersOnSegment, positionOf, type Vec3 } from '@hkt/s0-spatial-affordance';
import { bodyIdsOf, readSubject, subjectIds } from '@hkt/u0-subject-core';
import { SENSES_COMPONENT } from './types.js';

/**
 * 감각이 세계에 대해 물어볼 수 있는 것 전부.
 *
 * **이 파일은 U1 에서 `EntityStore` 를 만지는 유일한 자리다.** 걸러 내는 쪽(`perceive.ts`)은
 * 저장소를 받지 못하고 이 좁은 창만 받는다 — U0 의 `rank.ts` 가 `SubjectView` 만 받는 것과 같은
 * 규율이며, 이유도 같다. 열어 두면 언젠가 "이 판정만 세계를 한 번 들여다보면 쉬운데" 하는 자리가
 * 생기고, 그 순간 GI-02 가 무너진다.
 *
 * 창이 좁다는 것이 곧 지각이 좁다는 뜻은 아니다. U1 은 세계의 실제 사건을 **읽어야 한다** —
 * 그것이 이 모듈의 일이다. 다만 읽은 것을 주체에게 그대로 건네지 않고, 여기서 물어본 것만으로
 * 걸러 건넨다.
 */
export interface Sensorium {
  /** 주체 id (오름차순) */
  subjects(): EntityId[];
  kindOf(subject: EntityId): string;
  /** 이 주체의 몸들 (오름차순) — 지각의 자리는 주체가 아니라 몸이다 */
  bodiesOf(subject: EntityId): EntityId[];
  /** 이 몸이 어느 주체의 것인가. 주인이 없으면 null */
  ownerOfBody(entity: EntityId): EntityId | null;
  positionOf(entity: EntityId): Vec3 | null;
  /** 두 점 사이에서 시선을 막는 것들 (id 오름차순) */
  sightBlockers(from: Vec3, to: Vec3, ignore: readonly EntityId[]): EntityId[];
  /** 채널 → 문턱. 채널이 없으면 그 감각이 없는 주체다 */
  sensesOf(subject: EntityId): Record<string, number>;
  /** 능력 id (오름차순) — U0 의 `cap_` 태그에서 온다 */
  capabilitiesOf(subject: EntityId): string[];
  has(entity: EntityId): boolean;
}

export function buildSensorium(store: EntityStore): Sensorium {
  // 몸 → 주인. 한 번만 세우고 돌려 쓴다. 나중에 오는 주체가 이기지 않도록 id 오름차순으로 돈다.
  const owners = new Map<EntityId, EntityId>();
  for (const subject of subjectIds(store)) {
    for (const body of bodyIdsOf(store, subject)) {
      if (!owners.has(body)) owners.set(body, subject);
    }
  }

  return {
    subjects: () => subjectIds(store),
    kindOf: (subject) => store.get(subject)?.kind ?? '',
    bodiesOf: (subject) => bodyIdsOf(store, subject).filter((body) => store.has(body)),
    ownerOfBody: (entity) => owners.get(entity) ?? null,
    positionOf: (entity) => (store.has(entity) ? positionOf(store, entity) : null),
    sightBlockers: (from, to, ignore) => blockersOnSegment(store, from, to, 'sight', ignore),
    sensesOf: (subject) => {
      const data = store.component(subject, SENSES_COMPONENT);
      if (!data) return {};
      const out: Record<string, number> = {};
      for (const key of Object.keys(data).sort()) {
        const value = data[key];
        if (typeof value === 'number') out[key] = value;
      }
      return out;
    },
    capabilitiesOf: (subject) => (store.has(subject) ? readSubject(store, subject).capabilities : []),
    has: (entity) => store.has(entity),
  };
}
