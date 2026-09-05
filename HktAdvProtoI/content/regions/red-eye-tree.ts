// 붉은 눈의 거목 — depth wild. C003 에서 지어진 방이다 (C002 까지는 이름만 있던 경계).
//
// anchor 셋 — 숲 안쪽에서 다가서는 FOREST_DEEP_SIDE 는 남쪽 변, 광석 지대에서 오는 ORE_SIDE 는 동쪽 변,
// 안으로 드는 INNER_DOOR 만 변이 아니라 방 안쪽 자리다 — 길이 아니라 나무 밑동의 작은 문이기 때문이다
// (01-spec UNRESOLVED 판정 · Play §5.8).
// 방 사이의 좌표는 서로 무관하다 — 같은 tag 가 다른 방에서 다른 자리다 (C001 SPEC-001).
// 이 방에는 anchor 말고 아무 것도 없다 — 몸도 광맥도 놓이지 않는다 (01-spec SPEC-001 경계).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  BIO_ORE,
  FORM_ROOT_NODULE,
  RESOURCE_LAYER,
  TRACE_LAYER,
  soilStainTag,
} from './resource-ecology';

export const RED_EYE_TREE = 'RED_EYE_TREE';

export const RED_EYE_TREE_SPEC: RegionSpec = {
  id: RED_EYE_TREE,
  depth: 'wild',
  space: {
    id: RED_EYE_TREE,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 7,
    ops: [
      {
        id: 'anchor-forest-deep-side',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FOREST_DEEP_SIDE',
        position: { x: 0, z: -18 },
      },
      {
        id: 'anchor-ore-side',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ORE_SIDE',
        position: { x: 18, z: 0 },
      },
      {
        id: 'anchor-inner-door',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'INNER_DOOR',
        position: { x: 0, z: 6 },
      },
      // ── C011 ADDED — 흔적과 원천 ──────────────────────────────────────────
      //
      // 이 세계에서 흙이 **가장 짙은** 자리다. 생체 광석이 쌓인 자리를 붉게 물들이고,
      // 거목의 붉은 눈이 가장 많이 쌓인 자리이므로 (D2 생체 광석 ②) 뿌리혹 둘레가 그 정점이다.
      // 자리 (-8, 2) 는 안쪽 문(0, 6)과 겹치지 않고 출구 둘에서 걸어 닿는 자리다.
      {
        id: 'trace-tree-base',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: {
          kind: 'polygon',
          points: [
            { x: -20, z: -20 },
            { x: 20, z: -20 },
            { x: 20, z: 20 },
            { x: -20, z: 20 },
          ],
        },
      },
      {
        id: 'trace-tree-nodule',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(5),
        shape: { kind: 'circle', center: { x: -8, z: 2 }, radius: 7 },
      },
      {
        id: 'source-root-nodule',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ROOT_NODULE',
        position: { x: -8, z: 2 },
      },
    ],
  },
  // 핵심부의 Risk 둘째 — 같은 Material Seed 가 다른 순도로 난다 (A.1 "같은 것의 세 순도").
  // 종류를 늘린 것이 아니라 기회를 늘린 것이다 (Play §5.3).
  // supply 가 CONDITIONAL_RENEWABLE 인 이유는 분해된 흙이 있어야 축적되기 때문이다 —
  // 그 의존(NEST_FUNGUS)은 C014 가 세우고 C013 이 굴린다.
  resourceEcology: {
    sources: [
      {
        id: 'ROOT_NODULE',
        materialId: BIO_ORE,
        form: FORM_ROOT_NODULE,
        carrier: 'plant',
        opportunity: 'risk',
        supply: 'conditional-renewable',
      },
    ],
  },
};
