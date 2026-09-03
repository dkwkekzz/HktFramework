// 거목 내부 세계 — depth deep. C003 의 큰 방이다 (01-spec SPEC-005 · 확정 4).
//
// extent 가 한 변 80 — 다른 여덟 방(한 변 40)의 두 배이고 걸을 수 있는 넓이는 네 배다.
// 방마다 extent 가 다를 수 있음을 이 방이 처음 쓴다. 부모(붉은 눈의 거목)보다 넓지만 오류가 아니다 —
// Spatial Embedding 이 없기 때문이다 (01-spec SPEC-004 경계).
//
// anchor 둘 — 들어온 문 OUTER_DOOR 와 떨어지는 자리 FALL 이 서로 가장 먼 두 변이다.
// 그래서 "안이 밖보다 크다" 가 걸음으로 읽힌다 (01-spec UNRESOLVED 판정 · Play §5.5).
// 이 방에는 anchor 말고 아무 것도 없다 (01-spec SPEC-001 경계).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const TREE_INNER_WORLD = 'TREE_INNER_WORLD';

export const TREE_INNER_WORLD_SPEC: RegionSpec = {
  id: TREE_INNER_WORLD,
  depth: 'deep',
  space: {
    id: TREE_INNER_WORLD,
    extent: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 },
    seed: 8,
    ops: [
      {
        id: 'anchor-outer-door',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'OUTER_DOOR',
        position: { x: 0, z: -38 },
      },
      {
        id: 'anchor-fall',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FALL',
        position: { x: 0, z: 38 },
      },
    ],
  },
};
