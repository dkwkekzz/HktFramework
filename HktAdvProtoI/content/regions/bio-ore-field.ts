// 생체 광석 지대 — depth wild. C002 에서는 출구 둘뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor ORE_TRAIL 은 서쪽 변 근처(숲 안쪽으로 돌아가는 길) ·
// TREE_TRAIL 은 북쪽 변 근처(붉은눈 거목으로 가는 길)다.

// C016 ADDED — 이 방이 **뒤척인다** (phases.onTurn). 철과 철 사이의 뒤척임마다 여기 남은
// 자국이 묻히고 노두가 뿌리의 다음 마디로 옮겨 선다. 땅은 한 값도 달라지지 않는다 —
// 옮겨 서는 것은 원천이고 마디는 C013 이 놓은 그 곡선 그대로다 (T6).

// C017 ADDED — 이 방이 **깨어난다** (phases.awake). 여럿이 함께 캐서 소란이 임계에 닿으면
// 노두가 선 그 자락이 한 단계 깊게 읽히고 위험이 함께 답해진다 — 캐는 자리가 곧 깨우는
// 자리이고 깨어난 자리가 곧 위험해지는 자리다 (Concept §6). 땅은 여전히 한 값도 달라지지
// 않는다: 깨어남도 컴파일 결과 **위**의 덧씌움이다 (T4 · T6).

import { DEPTH_LAYER, HAZARD_LAYER } from './phases';
import { HUNTER_CURVE_TAG } from './presence-routes';
import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_HUSK_SHARD,
  FORM_ORE_PEBBLE,
  FORM_OUTCROP,
  ORE_EATER_MOLT,
  PRESENCE_LAYER,
  RECOVERY_HUSK_SHED,
  RECOVERY_PEBBLE_WASH,
  RECOVERY_TREE_UPTAKE,
  RESOURCE_LAYER,
  ROOT_CURVE_TAG,
  soilStainTag,
  TRACE_LAYER,
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
      // ── C017 ADDED — 깨어남에 달라지는 자락 ────────────────────────────────
      //
      // 자락은 **노두가 선 뿌리 쪽**, 곧 마디 0 (8, -6) 둘레다. 반지름 7 은 C011 이 그 자리의
      // 흔적 원에 쓴 값 그대로다 — 캐러 서는 자리가 곧 그 자락 안이다.
      //
      // **깊이와 위험이 같은 자락이다** (Concept §6 · 이 방에서는 §5.5) — 캐는 자리가 곧
      // 깨우는 자리이고, 깨어난 자리가 곧 위험해지는 자리다. 자리를 나누면 "깊어졌다" 와
      // "위험하다" 가 두 곳에서 오는 두 사실이 되어 버린다 (C016 이 숲 경계부에 세운 그 어법).
      //
      // 이 두 area 는 **캐기 전의 붕괴 자리(C012) · 철의 덧씌움(C016)과 같은 성격**이다:
      // 컴파일 결과를 한 값도 바꾸지 않고(높이도 표면도 통행도 그대로 — 표면·막힘·통과 규칙은
      // feature layer 만 읽고 이 둘은 profile 이 없다) 소란이 그 위에 State 를 덧씌울 뿐이다.
      // 어느 위상에 무엇으로 읽히는가는 아래 phases.awake 만이 안다.
      //
      // 태그는 둘러싼 것의 이름이다 — 붕괴 area 가 원천 이름을 다는 어법 그대로 (C012 · C016).
      {
        id: 'depth-ore-outcrop',
        kind: 'area',
        layer: DEPTH_LAYER,
        tag: 'ORE_OUTCROP',
        shape: { kind: 'circle', center: { x: 8, z: -6 }, radius: 7 },
      },
      {
        id: 'hazard-ore-outcrop',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'ORE_OUTCROP',
        shape: { kind: 'circle', center: { x: 8, z: -6 }, radius: 7 },
      },
      // ── C018 ADDED — 눈 없는 것의 선과 그 자락 ─────────────────────────────
      //
      // 이 방은 그것의 **둘째 마디의 후보**다 — 숲 가장자리와 이 방 가운데 **소란이 높은
      // 쪽**으로 내려온다 (spec R3). 여기서 캐 놓으면 그것이 이쪽으로 오고, 그러면 숲
      // 가장자리에는 오지 않는다. 어느 쪽으로 휘는지는 경로 데이터와 소란만이 안다.
      //
      // **높이를 건드리지 않는 표시선**이다 (profile 없음 · 뿌리 곡선이 세운 그 형) —
      // 땅도 컴파일 결과도 hash 도 한 값 바뀌지 않는다 (T6). 이 방은 평지이고, 점 셋은
      // 컴파일 결과에서 셋 다 통행 가능함을 실측했다 (반경 2 의 둘레까지). 서쪽 문
      // ORE_TRAIL(-18, 0) 에서 1.6m 걸음 · 16방위 BFS 로 8 · 9 · 12 걸음에 닿는다.
      // 뿌리 곡선의 마디 넷 어느 것과도 겹치지 않는다 — 가장 가까운 마디 2(-8, 8) 까지
      // 2.83 이고 그 마디의 붕괴 자리(반지름 2) 밖이다.
      {
        id: 'hunter-curve',
        kind: 'curve',
        layer: PRESENCE_LAYER,
        tag: HUNTER_CURVE_TAG,
        points: [
          { x: -10, z: 10 },
          { x: -4, z: 4 },
          { x: 2, z: -2 },
        ],
        width: 3,
      },
      // 그 선의 **자락** — 지나는 동안에만 위험으로 읽힌다 (spec R4). 중심은 가운데 마디이고
      // 반지름 9 는 양 끝을 다 품는다 (끝까지 8.49 · 8.49). 깨어남의 자락(중심 (8, -6) ·
      // 반지름 7)과는 중심 거리 15.6 이라 서로 닿지 않는다 — 소란이 거는 것과 지나가는 것이
      // 거는 것이 **다른 자리**이고, 둘 다 걸리면 걸린 것이 전부 실린다 (spec R4 경계 ②).
      {
        id: 'hazard-ore-hunter-path',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: HUNTER_CURVE_TAG,
        shape: { kind: 'circle', center: { x: -4, z: 4 }, radius: 9 },
      },
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 ──────────────────────
      //
      // Human 의 답: "재료가 너무 적고 채집하는 재미가 부족하다." 방의 중심이던 원천 곁에
      // **작은 것 여럿**이 흩어져 선다 — 걸어 다니며 줍는 것이다. 자리는 이미 선 것들(원천 · 출구 ·
      // 선의 마디 · 막힌 땅)과 겹치지 않는 평지에서 골랐고, 둘레 흔적은 방 바닥보다 한 단계 짙되
      // 반지름 4 로 작다 (중심 원천의 7 과 갈려 "작은 것" 으로 읽힌다). 규칙은 하나도 늘지 않는다.
      {
        id: 'trace-ore-pebble-ore-1',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: -14, z: -14 }, radius: 4 },
      },
      {
        id: 'source-ore-pebble-ore-1',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ORE_PEBBLE_ORE_1',
        position: { x: -14, z: -14 },
      },
      {
        id: 'trace-ore-pebble-ore-2',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 14, z: -14 }, radius: 4 },
      },
      {
        id: 'source-ore-pebble-ore-2',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ORE_PEBBLE_ORE_2',
        position: { x: 14, z: -14 },
      },
      {
        id: 'trace-ore-pebble-ore-3',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: -12, z: 14 }, radius: 4 },
      },
      {
        id: 'source-ore-pebble-ore-3',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ORE_PEBBLE_ORE_3',
        position: { x: -12, z: 14 },
      },
      {
        id: 'trace-husk-shard-ore',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 2, z: 14 }, radius: 4 },
      },
      {
        id: 'source-husk-shard-ore',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'HUSK_SHARD_ORE',
        position: { x: 2, z: 14 },
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
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 (자리는 위의 point 가 소유한다) ──
      // 흙 위에 흩어진 붉은 자갈 — 뿌리가 밀어 올린 조각이 비에 씻겨 드러난다. 한 알이 한 번이고 곧 되돌아온다
      {
        id: 'ORE_PEBBLE_ORE_1',
        materialId: BIO_ORE,
        worldCause: FOREST_CHAIN,
        form: FORM_ORE_PEBBLE,
        carrier: 'terrain',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_PEBBLE_WASH,
        harvests: 1,
        recoverySeconds: 45,
        traceOps: ['trace-ore-pebble-ore-1'],
      },
      // 흙 위에 흩어진 붉은 자갈 — 뿌리가 밀어 올린 조각이 비에 씻겨 드러난다. 한 알이 한 번이고 곧 되돌아온다
      {
        id: 'ORE_PEBBLE_ORE_2',
        materialId: BIO_ORE,
        worldCause: FOREST_CHAIN,
        form: FORM_ORE_PEBBLE,
        carrier: 'terrain',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_PEBBLE_WASH,
        harvests: 1,
        recoverySeconds: 45,
        traceOps: ['trace-ore-pebble-ore-2'],
      },
      // 흙 위에 흩어진 붉은 자갈 — 뿌리가 밀어 올린 조각이 비에 씻겨 드러난다. 한 알이 한 번이고 곧 되돌아온다
      {
        id: 'ORE_PEBBLE_ORE_3',
        materialId: BIO_ORE,
        worldCause: FOREST_CHAIN,
        form: FORM_ORE_PEBBLE,
        carrier: 'terrain',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_PEBBLE_WASH,
        harvests: 1,
        recoverySeconds: 45,
        traceOps: ['trace-ore-pebble-ore-3'],
      },
      // 풀줄기에 걸린 껍질 조각 — 광식충이 줄기를 타고 오르며 벗은 것. 밑동의 허물과 같은 재료의 다른 형태다
      {
        id: 'HUSK_SHARD_ORE',
        materialId: ORE_EATER_MOLT,
        worldCause: FOREST_CHAIN,
        form: FORM_HUSK_SHARD,
        carrier: 'plant',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_HUSK_SHED,
        harvests: 2,
        recoverySeconds: 75,
        traceOps: ['trace-husk-shard-ore'],
      },
    ],
  },
  /**
   * 이 방이 철을 타는 방식 (C016 ADDED · spec SPEC-005 · SPEC-006 · 확정 8).
   *
   * 철별 덧씌움(seasons)은 밝히지 않는다 — 이 방은 어느 철에도 지금 그대로 읽힌다.
   * 달라지는 것은 **뒤척임이 지나갈 때**뿐이다: 어제의 구덩이가 묻히고 노두가 다른 자리에 선다.
   *
   * 묻는다는 것은 "없던 일로 한다" 이지 "다 채워 준다" 가 아니다 — 이 방의 원천은 처음 상태가
   * 캘 수 있는 것이므로 결과가 같아 보이지만, 그 뜻은 **처음 상태로 되돌린다** 이다
   * (흐름에 매달린 원천은 처음이 고갈이라 고갈로 돌아간다 · 기본형 ⑦).
   *
   * 캐지 않았어도 옮긴다 — 뒤척임은 관찰자와 무관한 세계의 일이다.
   */
  phases: {
    /**
     * 긴 밤에 노두 자락이 위험으로 읽힌다 (RoomNeverSame 실주행 판정 ADDED) — 깨어남이 거는 그
     * 자락과 **같은 자락**이다. 철과 깨어남이 한 자락에 함께 걸리는 첫 자리이고(TODO §5 의 부채 —
     * "함께 밝힌 방이 없어 참인지 못 봤다"), 겹치면 걸린 것이 전부 실린다 (C017 spec R4 경계).
     */
    seasons: {
      LONG_NIGHT: {
        hazardExtend: [{ areaId: 'hazard-ore-outcrop', hazard: 'hazard/creature' }],
      },
    },
    /**
     * **깨어난 이 방**이 달라지는 것 (C017 ADDED · spec SPEC-005 · 기본형 ⑨).
     *
     * 셋이 함께 캐야 넘는 임계다 — 넘으면 노두가 선 그 자락이 한 단계 깊게 읽히고 그 자리의
     * 위험이 답해진다. 방은 wild 이므로 한 단계 깊은 값은 어휘 다섯의 다음 칸인 deep 이다
     * (civil · outer · wild · **deep** · abyss · Concept §3.2).
     *
     * 갈래는 어휘 일곱 안의 하나다 (content/authoring/contracts.ts 의 HAZARD_KINDS). 캐는
     * 소리에 살아 있는 것이 모여드는 자리다 — 깊어지는 것과 같은 근원이다 (Concept §6).
     * 이 폴더는 그 파일을 읽지 않으므로(경계 규칙 4) 글자로 적는다 — 흔적 태그와 같은 어법.
     *
     * 철별 덧씌움(seasons)은 여전히 밝히지 않는다 — 이 방은 철이 아니라 **소란**에 달라진다.
     */
    awake: {
      depthOverlay: [{ areaId: 'depth-ore-outcrop', depth: 'deep' }],
      hazardExtend: [{ areaId: 'hazard-ore-outcrop', hazard: 'hazard/creature' }],
    },
    onTurn: {
      // 이 방에 남은 자국 — 캔 횟수 · 되돌아옴의 진행 · 무너진 마디
      burySigns: true,
      // 자리를 옮기는 원천 하나. 마디 목록은 뿌리 곡선(siteCurve)이 이미 가지고 있다 (C013)
      migrateSources: ['ORE_OUTCROP'],
    },
  },
};
