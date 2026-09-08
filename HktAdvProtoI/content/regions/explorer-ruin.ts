// 탐험대 폐허 — depth wild. C002 에서는 출구 하나뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor RUIN_TRAIL 은 동쪽 변 근처 — 숲 가장자리로 돌아가는 길 하나가 전부다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { HAZARD_LAYER } from './phases';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_HUSK_SHARD,
  FORM_ORE_PEBBLE,
  FORM_SPOIL_PILE,
  ORE_EATER_MOLT,
  RECOVERY_HUSK_SHED,
  RECOVERY_PEBBLE_WASH,
  RECOVERY_PILE_EROSION,
  RESOURCE_LAYER,
  soilStainTag,
  TRACE_LAYER,
} from './resource-ecology';

export const EXPLORER_RUIN = 'EXPLORER_RUIN';

export const EXPLORER_RUIN_SPEC: RegionSpec = {
  id: EXPLORER_RUIN,
  depth: 'wild',
  space: {
    id: EXPLORER_RUIN,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 4,
    ops: [
      {
        id: 'anchor-ruin-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'RUIN_TRAIL',
        position: { x: 18, z: 0 },
      },
      // ── C011 ADDED — 흔적과 원천 ──────────────────────────────────────────
      //
      // 버려진 선광 더미 (Play 확정 4) — 앞서 온 탐험대가 캐다 버리고 간 것이다.
      // 숲 가장자리의 허물과 **같은 재료**가 섞여 있고, 그래서 두 자리를 다녀온 사람이
      // "이 숲에 계통이 하나 있다" 를 추측하게 된다 (§4 Breath · §5.1 추론).
      // 이 방도 경계부이므로 바닥의 흔적은 숲 가장자리와 같은 단계다.
      {
        id: 'trace-ruin-base',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(1),
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
        id: 'trace-ruin-spoil',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
        shape: { kind: 'circle', center: { x: -4, z: 4 }, radius: 7 },
      },
      {
        id: 'source-ruin-spoil',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'RUIN_SPOIL',
        position: { x: -4, z: 4 },
      },
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 ──────────────────────
      //
      // Human 의 답: "재료가 너무 적고 채집하는 재미가 부족하다." 방의 중심이던 원천 곁에
      // **작은 것 여럿**이 흩어져 선다 — 걸어 다니며 줍는 것이다. 자리는 이미 선 것들(원천 · 출구 ·
      // 선의 마디 · 막힌 땅)과 겹치지 않는 평지에서 골랐고, 둘레 흔적은 방 바닥보다 한 단계 짙되
      // 반지름 4 로 작다 (중심 원천의 7 과 갈려 "작은 것" 으로 읽힌다). 규칙은 하나도 늘지 않는다.
      {
        id: 'trace-ore-pebble-ruin',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
        shape: { kind: 'circle', center: { x: 8, z: -8 }, radius: 4 },
      },
      {
        id: 'source-ore-pebble-ruin',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ORE_PEBBLE_RUIN',
        position: { x: 8, z: -8 },
      },
      {
        id: 'trace-husk-shard-ruin-1',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
        shape: { kind: 'circle', center: { x: -12, z: -6 }, radius: 4 },
      },
      {
        id: 'source-husk-shard-ruin-1',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'HUSK_SHARD_RUIN_1',
        position: { x: -12, z: -6 },
      },
      {
        id: 'trace-husk-shard-ruin-2',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
        shape: { kind: 'circle', center: { x: 4, z: 10 }, radius: 4 },
      },
      {
        id: 'source-husk-shard-ruin-2',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'HUSK_SHARD_RUIN_2',
        position: { x: 4, z: 10 },
      },
      // ── RoomNeverSame 실주행 판정 ADDED — 철이 이 방을 바꾸는 자락 ────────────────
      //
      // Human 의 답: "밤낮은 보였는데 다른 변화는 모르겠다 — 확인할 단서 자체가 없다." 철을 타는 방이
      // 숲 가장자리 하나뿐이었다. 이 자락들은 컴파일 결과를 한 값도 바꾸지 않고(높이 · 표면 · 통행 그대로)
      // 철이 그 위에 State 를 덧씌울 뿐이다 (C016 의 형 그대로). 어느 철에 무엇으로 읽히는가는 아래 phases 만이 안다.
      {
        id: 'hazard-ruin-rot',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'RUIN_SPOIL',
        shape: { kind: 'circle', center: { x: -4, z: 4 }, radius: 8 },
      },
    ],
  },
  // 경계부의 Baseline 둘째 — 인공물 곁의 더미. 먼저 온 사람이 있었다는 흔적이기도 하다 (확정 4)
  resourceEcology: {
    sources: [
      {
        id: 'RUIN_SPOIL',
        materialId: ORE_EATER_MOLT,
        // 이 숲의 사슬 하나에서 난다 (C014 ADDED · §5.0)
        worldCause: FOREST_CHAIN,
        form: FORM_SPOIL_PILE,
        carrier: 'residue',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        // 비와 바람이 더미를 씻어 새 조각이 드러난다 (C014 ADDED · A.2 회복 원인)
        recoveryCause: RECOVERY_PILE_EROSION,
        // 더미는 남이 캐다 버린 것이다 — 많지 않다 (D4)
        harvests: 2,
        // 허물보다 조금 느리다 — 남이 캐다 버린 더미가 다시 쌓이는 시간 (C013 ADDED · D3)
        recoverySeconds: 90,
        // 마디 하나뿐인 원천 — 목록의 원소도 하나다 (C013 CHANGED · 옛 traceOp)
        traceOps: ['trace-ruin-spoil'],
      },
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 (자리는 위의 point 가 소유한다) ──
      // 흙 위에 흩어진 붉은 자갈 — 뿌리가 밀어 올린 조각이 비에 씻겨 드러난다. 한 알이 한 번이고 곧 되돌아온다
      {
        id: 'ORE_PEBBLE_RUIN',
        materialId: BIO_ORE,
        worldCause: FOREST_CHAIN,
        form: FORM_ORE_PEBBLE,
        carrier: 'terrain',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_PEBBLE_WASH,
        harvests: 1,
        recoverySeconds: 45,
        traceOps: ['trace-ore-pebble-ruin'],
      },
      // 풀줄기에 걸린 껍질 조각 — 광식충이 줄기를 타고 오르며 벗은 것. 밑동의 허물과 같은 재료의 다른 형태다
      {
        id: 'HUSK_SHARD_RUIN_1',
        materialId: ORE_EATER_MOLT,
        worldCause: FOREST_CHAIN,
        form: FORM_HUSK_SHARD,
        carrier: 'plant',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_HUSK_SHED,
        harvests: 2,
        recoverySeconds: 75,
        traceOps: ['trace-husk-shard-ruin-1'],
      },
      // 풀줄기에 걸린 껍질 조각 — 광식충이 줄기를 타고 오르며 벗은 것. 밑동의 허물과 같은 재료의 다른 형태다
      {
        id: 'HUSK_SHARD_RUIN_2',
        materialId: ORE_EATER_MOLT,
        worldCause: FOREST_CHAIN,
        form: FORM_HUSK_SHARD,
        carrier: 'plant',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_HUSK_SHED,
        harvests: 2,
        recoverySeconds: 75,
        traceOps: ['trace-husk-shard-ruin-2'],
      },
    ],
  },
  /**
   * 이 방이 철을 타는 방식 (RoomNeverSame 실주행 판정 ADDED).
   *
   * 스밈에 더미 둘레에 붉은 곰팡이가 번진다 — 흙이 붉어지는 철에 버려진 더미가 먼저 삭는다.
   * 위험의 갈래는 어휘 일곱 안의 hazard/ecology 다 (content/authoring/contracts.ts).
   */
  phases: {
    seasons: {
      SEEP: {
        hazardExtend: [{ areaId: 'hazard-ruin-rot', hazard: 'hazard/ecology' }],
      },
    },
  },
};
