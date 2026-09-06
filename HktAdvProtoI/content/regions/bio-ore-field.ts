// 생체 광석 지대 — depth wild. C002 에서는 출구 둘뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor ORE_TRAIL 은 서쪽 변 근처(숲 안쪽으로 돌아가는 길) ·
// TREE_TRAIL 은 북쪽 변 근처(붉은눈 거목으로 가는 길)다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  BIO_ORE,
  FORM_OUTCROP,
  RESOURCE_LAYER,
  TRACE_LAYER,
  soilStainTag,
} from './resource-ecology';

export const BIO_ORE_FIELD = 'BIO_ORE_FIELD';

export const BIO_ORE_FIELD_SPEC: RegionSpec = {
  id: BIO_ORE_FIELD,
  depth: 'wild',
  space: {
    id: BIO_ORE_FIELD,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 6,
    ops: [
      {
        id: 'anchor-ore-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ORE_TRAIL',
        position: { x: -18, z: 0 },
      },
      {
        id: 'anchor-tree-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'TREE_TRAIL',
        position: { x: 0, z: 18 },
      },
      // ── C011 ADDED — 흔적과 원천 ──────────────────────────────────────────
      //
      // A.3 의 **핵심부**. 방 바닥이 중간부보다 짙고, 노두 둘레가 다시 한 단계 짙다.
      // 노두는 거목의 뿌리가 뻗어 온 자리에 선 광맥의 머리다 (A.2 · Carrier TERRAIN).
      // 자리 (8, -6) 은 두 출구(-18, 0 · 0, 18) 어느 쪽에서 들어와도 걸어 닿는 평지다.
      {
        id: 'trace-ore-base',
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
        id: 'trace-ore-outcrop',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 8, z: -6 }, radius: 7 },
      },
      {
        id: 'source-ore-outcrop',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ORE_OUTCROP',
        position: { x: 8, z: -6 },
      },
      // C012 ADDED — 무너지면 구덩이가 될 자리. **캐기 전에는 아무 일도 하지 않는다** —
      // 이 area 는 컴파일 결과를 한 값도 바꾸지 않고(높이도 표면도 traversable 도 그대로),
      // 원천이 고갈된 뒤에야 그 위에 State 가 덧씌워진다 (C008 의 통로와 같은 형).
      // 반경 2 는 배치 데이터다 — 화면에서 구덩이로 보이면서 방을 끊지 않는 크기다
      // (방은 40×40 이고 출구 둘은 (-18, 0) · (0, 18) 로 멀다).
      {
        id: 'collapse-ore-outcrop',
        kind: 'area',
        layer: RESOURCE_LAYER,
        tag: 'ORE_OUTCROP',
        shape: { kind: 'circle', center: { x: 8, z: -6 }, radius: 2 },
      },
    ],
  },
  // 핵심부의 Risk — 깊은 자리일수록 위험이 함께 온다 (Concept §6 위험과 보상의 동근원).
  // supply 가 MIGRATORY 인 이유는 A.2 그대로다: 캔 자리에는 다시 나지 않고 뿌리 곡선의
  // 다음 마디에 선다 (확정 9). 그 자리 이동은 C013 이 굴린다 — 여기서는 밝히기만 한다.
  resourceEcology: {
    sources: [
      {
        id: 'ORE_OUTCROP',
        materialId: BIO_ORE,
        form: FORM_OUTCROP,
        carrier: 'terrain',
        opportunity: 'risk',
        supply: 'migratory',
        // Risk — 한 번 닿으면 값어치가 있어야 한다 (D4)
        harvests: 3,
        // 광맥의 머리가 무너져 구덩이가 된다 — 그 자리는 지날 수 없다 (A.2 · C012 §5.4 ③)
        collapses: true,
        // 거목의 축적에 매달려 있다 (A.2 회복 원인 · §5.5) — 뿌리혹이 터지면 이것이 멎는다
        dependsOn: 'ROOT_NODULE',
        traceOp: 'trace-ore-outcrop',
      },
    ],
  },
};
