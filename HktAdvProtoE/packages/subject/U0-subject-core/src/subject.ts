import type { EntityId, EntityStore, JsonValue } from '@hkt/k0-entity-state';
import { CAPABILITY_PREFIX, SUBJECT_COMPONENT, type SubjectView } from './types.js';

/**
 * 주체가 자기 자신에 대해 아는 것을 읽는다.
 *
 * **이 파일은 U0 에서 `EntityStore` 를 만지는 유일한 자리다.** 우선순위 계산(`rank.ts`)은
 * 저장소를 아예 받지 못하고 `SubjectView` 만 받는다. GI-02("주체는 서버의 실제 세계 상태가
 * 아니라 자신의 상태를 통해서만 판단한다")를 주석이 아니라 **호출 규약**으로 만들기 위해서다.
 *
 * 세계를 보고 싶으면 U1(지각)을 거쳐야 하고, U1 은 아직 없다. 지금 주체가 세계에 대해 아는
 * 것은 자기 몸이 올려 보낸 것뿐이며, 그것도 법칙(K2)을 거쳐 자기 상태가 된 뒤에야 읽힌다.
 */

/** 주체인 실체 (id 오름차순) — 욕구를 가진 것이 주체다. */
export function subjectIds(store: EntityStore): EntityId[] {
  return store.withComponent(SUBJECT_COMPONENT.NEEDS).slice().sort();
}

export function readSubject(store: EntityStore, id: EntityId): SubjectView {
  const entity = store.require(id, `subject/${id}`);
  return {
    id,
    kind: entity.kind,
    needs: numbers(store, id, SUBJECT_COMPONENT.NEEDS),
    values: numbers(store, id, SUBJECT_COMPONENT.VALUES),
    traits: numbers(store, id, SUBJECT_COMPONENT.TRAITS),
    emotions: numbers(store, id, SUBJECT_COMPONENT.EMOTIONS),
    // 원본 10장 `capabilities: Id[]` — 태그에서 앞머리를 뗀 것이 그 목록이다.
    capabilities: entity.tags
      .filter((tag) => tag.startsWith(CAPABILITY_PREFIX))
      .map((tag) => tag.slice(CAPABILITY_PREFIX.length))
      .sort(),
    resources: numbers(store, id, SUBJECT_COMPONENT.RESOURCES),
    bodyEntityIds: bodyIdsOf(store, id),
  };
}

/** 이 주체가 세계에 닿아 있는 실체들 (오름차순). 없으면 빈 배열이다. */
export function bodyIdsOf(store: EntityStore, id: EntityId): EntityId[] {
  const body = store.component(id, SUBJECT_COMPONENT.BODY);
  const ids = body?.['entity_ids'];
  if (!Array.isArray(ids)) return [];
  return ids.filter((value): value is string => typeof value === 'string').slice().sort();
}

/**
 * 컴포넌트에서 숫자 칸만 읽어 키 오름차순으로 늘어놓는다.
 *
 * 반올림은 하지 않는다 — 여기 담기는 것은 세계의 실제 값이고, 자르는 일은 점수를 낼 때
 * 한 번만 한다(`rank.ts`). 두 곳에서 자르면 어느 쪽이 진짜인지 알 수 없게 된다.
 */
function numbers(store: EntityStore, id: EntityId, component: string): Record<string, number> {
  const data = store.component(id, component);
  if (!data) return {};
  const out: Record<string, number> = {};
  for (const key of Object.keys(data).sort()) {
    const value: JsonValue | undefined = data[key];
    if (typeof value === 'number') out[key] = value;
  }
  return out;
}
