import type { EntityId, EntityStore } from '@hkt/k0-entity-state';
import { barrierOf, boxOf } from './transform.js';
import { BARRIER_COMPONENT, type Box, type Vec3 } from './types.js';

/**
 * Collision — 상자와 선분만 다룬다.
 *
 * 메시로 판정하지 않는 이유는 성능이 아니라 **원본 18.4** 다. 시각적 형태와 게임 규칙을 같은 데이터로
 * 취급하면, 아티스트가 문턱을 1cm 낮췄을 때 규칙이 바뀐다. 규칙이 보는 것은 축 정렬 상자뿐이고,
 * 메시는 그 상자를 **표현**할 뿐이다.
 */

export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.min.x <= b.max.x &&
    b.min.x <= a.max.x &&
    a.min.y <= b.max.y &&
    b.min.y <= a.max.y &&
    a.min.z <= b.max.z &&
    b.min.z <= a.max.z
  );
}

/** 경계선에 정확히 닿기만 한 것은 겹친 것으로 보지 않는다 — 벽에 등을 붙이고 서는 것은 통과가 아니다. */
export function boxesIntersect(a: Box, b: Box): boolean {
  return (
    a.min.x < b.max.x &&
    b.min.x < a.max.x &&
    a.min.y < b.max.y &&
    b.min.y < a.max.y &&
    a.min.z < b.max.z &&
    b.min.z < a.max.z
  );
}

/**
 * 선분이 상자를 뚫고 지나가는가 (slab 법).
 *
 * 표본을 찍어 검사하지 않는다 — 표본 간격보다 얇은 벽은 통과해 버리고, 간격을 줄이면 부동소수
 * 오차가 갈래를 바꾼다(GI-12). 축마다 진입·이탈 구간을 구해 교집합이 남는지 보면 정확하고 결정적이다.
 */
export function segmentHitsBox(from: Vec3, to: Vec3, box: Box): boolean {
  let enter = 0;
  let exit = 1;

  for (const axis of ['x', 'y', 'z'] as const) {
    const origin = from[axis];
    const delta = to[axis] - origin;
    const min = box.min[axis];
    const max = box.max[axis];

    if (delta === 0) {
      // 이 축으로는 움직이지 않는다 — 처음부터 구간 밖이면 영원히 밖이다.
      if (origin <= min || origin >= max) return false;
      continue;
    }

    const t1 = (min - origin) / delta;
    const t2 = (max - origin) / delta;
    enter = Math.max(enter, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
    if (enter >= exit) return false;
  }

  return enter < exit;
}

/** 무엇을 막는 장애물을 찾는가. */
export type BlockKind = 'passage' | 'sight';

/**
 * 두 점을 잇는 직선을 끊는 실체들 (id 오름차순).
 *
 * `ignore` 에 준 실체는 세지 않는다 — 문을 여는 손은 문을 통과할 필요가 없고, 대상 자신이 자기
 * 시야를 막는다고 보고하면 아무것도 볼 수 없다.
 */
export function blockersOnSegment(
  store: EntityStore,
  from: Vec3,
  to: Vec3,
  kind: BlockKind,
  ignore: readonly EntityId[] = [],
): EntityId[] {
  const skip = new Set(ignore);
  const hits: EntityId[] = [];
  for (const id of store.withComponent(BARRIER_COMPONENT)) {
    if (skip.has(id)) continue;
    const barrier = barrierOf(store, id);
    if (!barrier) continue;
    if (kind === 'passage' ? !barrier.solid : !barrier.opaque) continue;
    const box = boxOf(store, id);
    if (!box) continue;
    if (segmentHitsBox(from, to, box)) hits.push(id);
  }
  return hits.sort();
}

/** 그 칸을 막고 있는 실체들 (id 오름차순). 비어 있으면 지나갈 수 있는 칸이다. */
export function blockersInBox(store: EntityStore, box: Box, kind: BlockKind = 'passage'): EntityId[] {
  const hits: EntityId[] = [];
  for (const id of store.withComponent(BARRIER_COMPONENT)) {
    const barrier = barrierOf(store, id);
    if (!barrier) continue;
    if (kind === 'passage' ? !barrier.solid : !barrier.opaque) continue;
    const other = boxOf(store, id);
    if (!other) continue;
    if (boxesIntersect(box, other)) hits.push(id);
  }
  return hits.sort();
}
