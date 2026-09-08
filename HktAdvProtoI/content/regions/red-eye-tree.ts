// 붉은 눈의 거목 — depth wild. C003 에서 지어진 방이다 (C002 까지는 이름만 있던 경계).
//
// anchor 셋 — 숲 안쪽에서 다가서는 FOREST_DEEP_SIDE 는 남쪽 변, 광석 지대에서 오는 ORE_SIDE 는 동쪽 변,
// 안으로 드는 INNER_DOOR 만 변이 아니라 방 안쪽 자리다 — 길이 아니라 나무 밑동의 작은 문이기 때문이다
// (01-spec UNRESOLVED 판정 · Play §5.8).
// 방 사이의 좌표는 서로 무관하다 — 같은 tag 가 다른 방에서 다른 자리다 (C001 SPEC-001).
// 이 방에는 anchor 말고 아무 것도 없다 — 몸도 광맥도 놓이지 않는다 (01-spec SPEC-001 경계).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { DEPTH_LAYER, HAZARD_LAYER } from './phases';
import { WHALE_CURVE_TAG } from './presence-routes';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_GLOW_CAP,
  FORM_ORE_PEBBLE,
  FORM_ROOT_NODULE,
  GIANT_TREE_FUNGUS,
  PRESENCE_LAYER,
  RECOVERY_NIGHT_BLOOM,
  RECOVERY_PEBBLE_WASH,
  RECOVERY_TREE_UPTAKE,
  RESOURCE_LAYER,
  ROOT_CURVE_TAG,
  soilStainTag,
  TRACE_LAYER,
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
      // ── C013 ADDED — 뿌리 곡선 ────────────────────────────────────────────
      //
      // 거목의 뿌리가 밑동에서 나와 광석 지대 쪽(동쪽 변의 ORE_SIDE · (18, 0))으로 뻗는다.
      // 뿌리혹 (-8, 2) 를 지나는 것이 이 선의 뜻이다 — 뿌리혹은 이 뿌리가 부푼 자리다 (§5.3).
      //
      // **뿌리혹은 자리를 옮기지 않는다** — 이 곡선은 siteCurve 로 쓰이지 않는다 (마디 목록이
      // 아니다). 그 뿌리가 이 방을 지나 광석 지대로 이어진다는 **세계 사실**일 뿐이고,
      // 광석 지대 쪽 노두가 그 뿌리를 따라 옮겨 다니는 이유를 땅 위에서 읽히게 한다.
      // profile 이 없으므로 높이를 건드리지 않고, 폭 1.5 는 광석 지대의 뿌리 곡선과 같다.
      {
        id: 'root-curve',
        kind: 'curve',
        layer: PRESENCE_LAYER,
        tag: ROOT_CURVE_TAG,
        points: [
          { x: -15, z: 5 },
          { x: -8, z: 2 },
          { x: 0, z: 3 },
          { x: 9, z: 1 },
          { x: 17, z: -1 },
        ],
        width: 1.5,
      },
      // ── C018 ADDED — 하늘을 지나가는 것의 선 ────────────────────────────────
      //
      // 이 방이 고래의 **마지막 마디**다 — 숲 안쪽에서 들어와 거목 위를 지나 빠져나간다.
      // 뿌리 곡선과 같은 layer 의 표시선이고(profile 없음) 폭만 두 배다: 땅의 것과 하늘의
      // 것이 같은 자리에서 갈려 읽힌다. 땅도 컴파일 결과도 hash 도 한 값 바뀌지 않는다 (T6).
      //
      // 점 넷은 컴파일 결과에서 넷 다 통행 가능한 평지이고(반경 2 의 둘레까지), 남쪽 문
      // FOREST_DEEP_SIDE(0, -18) 에서 1.6m 걸음 · 16방위 BFS 로 11 · 10 · 13 · 20 걸음에
      // 닿는다. 뿌리혹(-8, 2) 에서 가장 가까운 점까지 6.32 · 안쪽 문(0, 6) 까지 5.66 이라
      // 이미 선 것들과 겹치지 않는다. 뿌리 곡선과는 남쪽으로 비껴 지난다.
      {
        id: 'whale-curve',
        kind: 'curve',
        layer: PRESENCE_LAYER,
        tag: WHALE_CURVE_TAG,
        points: [
          { x: -16, z: -10 },
          { x: -6, z: -4 },
          { x: 4, z: 2 },
          { x: 14, z: 8 },
        ],
        width: 3,
      },
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 ──────────────────────
      //
      // Human 의 답: "재료가 너무 적고 채집하는 재미가 부족하다." 방의 중심이던 원천 곁에
      // **작은 것 여럿**이 흩어져 선다 — 걸어 다니며 줍는 것이다. 자리는 이미 선 것들(원천 · 출구 ·
      // 선의 마디 · 막힌 땅)과 겹치지 않는 평지에서 골랐고, 둘레 흔적은 방 바닥보다 한 단계 짙되
      // 반지름 4 로 작다 (중심 원천의 7 과 갈려 "작은 것" 으로 읽힌다). 규칙은 하나도 늘지 않는다.
      {
        id: 'trace-glow-cap-tree',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 8, z: -10 }, radius: 4 },
      },
      {
        id: 'source-glow-cap-tree',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'GLOW_CAP_TREE',
        position: { x: 8, z: -10 },
      },
      {
        id: 'trace-ore-pebble-tree',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 12, z: 12 }, radius: 4 },
      },
      {
        id: 'source-ore-pebble-tree',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ORE_PEBBLE_TREE',
        position: { x: 12, z: 12 },
      },
      // ── RoomNeverSame 실주행 판정 ADDED — 철이 이 방을 바꾸는 자락 ────────────────
      //
      // Human 의 답: "밤낮은 보였는데 다른 변화는 모르겠다 — 확인할 단서 자체가 없다." 철을 타는 방이
      // 숲 가장자리 하나뿐이었다. 이 자락들은 컴파일 결과를 한 값도 바꾸지 않고(높이 · 표면 · 통행 그대로)
      // 철이 그 위에 State 를 덧씌울 뿐이다 (C016 의 형 그대로). 어느 철에 무엇으로 읽히는가는 아래 phases 만이 안다.
      {
        id: 'depth-tree-nodule',
        kind: 'area',
        layer: DEPTH_LAYER,
        tag: 'ROOT_NODULE',
        shape: { kind: 'circle', center: { x: -8, z: 2 }, radius: 8 },
      },
      {
        id: 'hazard-tree-nodule',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'ROOT_NODULE',
        shape: { kind: 'circle', center: { x: -8, z: 2 }, radius: 8 },
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
        // 이 숲의 사슬 하나에서 난다 (C014 ADDED · §5.0)
        worldCause: FOREST_CHAIN,
        form: FORM_ROOT_NODULE,
        carrier: 'plant',
        opportunity: 'risk',
        supply: 'conditional-renewable',
        // 균류가 분해한 흙에서 다시 빨아올린다 (C014 ADDED · A.2 회복 원인)
        recoveryCause: RECOVERY_TREE_UPTAKE,
        // 뿌리혹 하나 = 한 번. 캐면 터진다 (D4) — §5.5 의 장면은 이 1 에서 나온다
        harvests: 1,
        // C014 ADDED — 분해된 흙에 매달린다. C012 가 비워 둔 자리를 그 원천(둥지의 균사)이
        // 선 지금 잇는다: 균사를 캐 놓으면 이 뿌리혹의 되돌아옴이 멎고(recovery-stalled),
        // 그러면 이것에 매달린 노두도 멎는다 — 사슬이 두 마디가 된다 (spec R5 · SPEC-002)
        dependsOn: 'NEST_FUNGUS',
        // 핵심부의 깊은 자리 — 거목이 다시 축적하는 데 오래 걸린다 (C013 ADDED · D3)
        recoverySeconds: 180,
        // **자리를 옮기지 않는다** — siteCurve 를 주지 않으므로 마디는 뿌리혹이 선 자리 하나다
        // (아래 뿌리 곡선은 그 뿌리가 이 방을 지난다는 세계 사실일 뿐이다 · Play §5.3)
        traceOps: ['trace-tree-nodule'],
      },
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 (자리는 위의 point 가 소유한다) ──
      // 어둠에서 희게 빛나는 갓 — 거목균의 밤 형태. **밤에만 선다** (dayPhases): 낮에는 흙 속으로 오므라들어 거기 없다. 밤이 감추는 것이 아니라 종류를 바꾼다 (RoomNeverSame Q25)
      {
        id: 'GLOW_CAP_TREE',
        materialId: GIANT_TREE_FUNGUS,
        worldCause: FOREST_CHAIN,
        form: FORM_GLOW_CAP,
        carrier: 'fungus',
        opportunity: 'by-product',
        supply: 'conditional-renewable',
        recoveryCause: RECOVERY_NIGHT_BLOOM,
        harvests: 1,
        recoverySeconds: 90,
        traceOps: ['trace-glow-cap-tree'],
        // 낮밤을 탄다 — 밤에만 선다
        dayPhases: ['NIGHT'],
      },
      // 흙 위에 흩어진 붉은 자갈 — 뿌리가 밀어 올린 조각이 비에 씻겨 드러난다. 한 알이 한 번이고 곧 되돌아온다
      {
        id: 'ORE_PEBBLE_TREE',
        materialId: BIO_ORE,
        worldCause: FOREST_CHAIN,
        form: FORM_ORE_PEBBLE,
        carrier: 'terrain',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_PEBBLE_WASH,
        harvests: 1,
        recoverySeconds: 45,
        traceOps: ['trace-ore-pebble-tree'],
      },
    ],
  },
  /**
   * 이 방이 철을 타는 방식 (RoomNeverSame 실주행 판정 ADDED).
   *
   * 스밈에 뿌리혹 둘레가 한 단계 깊어진다(wild → deep) — 거목이 가장 많이 빨아올리는 철이다.
   * 긴 밤에는 같은 자락이 위험으로 읽힌다 — 붉은 눈이 뜨는 때다 (2층은 말하는 것까지다).
   */
  phases: {
    seasons: {
      SEEP: {
        depthOverlay: [{ areaId: 'depth-tree-nodule', depth: 'deep' }],
      },
      LONG_NIGHT: {
        hazardExtend: [{ areaId: 'hazard-tree-nodule', hazard: 'hazard/creature' }],
      },
    },
  },
};
