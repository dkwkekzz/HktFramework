// 생체 광석 지대 — depth wild. C002 에서는 출구 둘뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor ORE_TRAIL 은 서쪽 변 근처(숲 안쪽으로 돌아가는 길) ·
// TREE_TRAIL 은 북쪽 변 근처(붉은눈 거목으로 가는 길)다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_OUTCROP,
  PRESENCE_LAYER,
  RECOVERY_TREE_UPTAKE,
  RESOURCE_LAYER,
  ROOT_CURVE_TAG,
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
      // ── C013 ADDED — 뿌리 곡선과 마디 넷 ───────────────────────────────────
      //
      // 거목의 뿌리가 이 방을 지난다 (Play §5.3 · 확정 9). **높이를 건드리지 않는 표시선**이다
      // (profile 없음) — 땅도 컴파일 결과도 한 값 바뀌지 않고, 지면에 뿌리가 보일 뿐이다.
      // 폭 1.5 는 배치 데이터다: 걸음(1.6m)보다 좁아 길을 나누지 않으면서 지면에서 읽힌다.
      //
      // **이 곡선의 points 넷이 곧 노두의 마디 넷이다** (siteCurve · spec R4). 마디 0 은
      // C011 이 놓은 (8, -6) 그대로이고, 노두는 캔 자리에 다시 나지 않고 다음 마디에 선다.
      // 마디 1·2·3 은 방 안을 도는 뿌리를 따라 골랐다 — 넷 다 컴파일 결과에서 평지이고
      // (isTraversableAt 참 · 반경 2 둘레까지), 서로 15 이상 떨어져 있으며(가장 가까운 짝이
      // 마디 0-1 의 15.23), 두 출구 (-18, 0) · (0, 18) 에서 12.8 이상 떨어져 길을 막지 않는다.
      // 반지름 7 의 흔적 원도 넷 다 extent(-20..20) 안에 온전히 든다.
      {
        id: 'root-curve',
        kind: 'curve',
        layer: PRESENCE_LAYER,
        tag: ROOT_CURVE_TAG,
        points: [
          { x: 8, z: -6 },
          { x: -6, z: -12 },
          { x: -8, z: 8 },
          { x: 12, z: 10 },
        ],
        width: 1.5,
      },
      // 마디마다 둘레 흔적 하나와 붕괴 자리 하나 — 마디 0 의 것은 위의
      // trace-ore-outcrop · collapse-ore-outcrop 이고, 여기 셋이 마디 1·2·3 의 것이다.
      // 값(흔적 반지름 7 · 붕괴 반지름 2 · 단계 4)은 C011 · C012 가 마디 0 에 쓴 그대로다.
      {
        id: 'trace-ore-site-1',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: -6, z: -12 }, radius: 7 },
      },
      {
        id: 'collapse-ore-site-1',
        kind: 'area',
        layer: RESOURCE_LAYER,
        tag: 'ORE_OUTCROP',
        shape: { kind: 'circle', center: { x: -6, z: -12 }, radius: 2 },
      },
      {
        id: 'trace-ore-site-2',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: -8, z: 8 }, radius: 7 },
      },
      {
        id: 'collapse-ore-site-2',
        kind: 'area',
        layer: RESOURCE_LAYER,
        tag: 'ORE_OUTCROP',
        shape: { kind: 'circle', center: { x: -8, z: 8 }, radius: 2 },
      },
      {
        id: 'trace-ore-site-3',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 12, z: 10 }, radius: 7 },
      },
      {
        id: 'collapse-ore-site-3',
        kind: 'area',
        layer: RESOURCE_LAYER,
        tag: 'ORE_OUTCROP',
        shape: { kind: 'circle', center: { x: 12, z: 10 }, radius: 2 },
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
        // 이 숲의 사슬 하나에서 난다 (C014 ADDED · §5.0)
        worldCause: FOREST_CHAIN,
        form: FORM_OUTCROP,
        carrier: 'terrain',
        opportunity: 'risk',
        supply: 'migratory',
        // 거목이 삭은 흙에서 다시 빨아올린다 — 그 축적이 뿌리를 타고 여기까지 온다
        // (C014 ADDED · A.2 회복 원인)
        recoveryCause: RECOVERY_TREE_UPTAKE,
        // Risk — 한 번 닿으면 값어치가 있어야 한다 (D4)
        harvests: 3,
        // 광맥의 머리가 무너져 구덩이가 된다 — 그 자리는 지날 수 없다 (A.2 · C012 §5.4 ③)
        collapses: true,
        // 거목의 축적에 매달려 있다 (A.2 회복 원인 · §5.5) — 뿌리혹이 터지면 이것이 멎는다
        dependsOn: 'ROOT_NODULE',
        // 가장 깊은 자리 — 되돌아오는 데 가장 오래 걸린다 (D3)
        recoverySeconds: 180,
        // 마디를 얻는 곡선 — 이 방의 뿌리 곡선이다 (points 넷이 마디 넷)
        siteCurve: ROOT_CURVE_TAG,
        // 마디 순서 그대로 — 마디 0 의 것은 C011 이 놓은 op 그대로다
        traceOps: [
          'trace-ore-outcrop',
          'trace-ore-site-1',
          'trace-ore-site-2',
          'trace-ore-site-3',
        ],
        collapseOps: [
          'collapse-ore-outcrop',
          'collapse-ore-site-1',
          'collapse-ore-site-2',
          'collapse-ore-site-3',
        ],
      },
    ],
  },
};
