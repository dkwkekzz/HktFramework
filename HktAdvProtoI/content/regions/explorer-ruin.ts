// 탐험대 폐허 — depth wild. C002 에서는 출구 하나뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor RUIN_TRAIL 은 동쪽 변 근처 — 숲 가장자리로 돌아가는 길 하나가 전부다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  FORM_SPOIL_PILE,
  ORE_EATER_MOLT,
  RESOURCE_LAYER,
  TRACE_LAYER,
  soilStainTag,
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
    ],
  },
  // 경계부의 Baseline 둘째 — 인공물 곁의 더미. 먼저 온 사람이 있었다는 흔적이기도 하다 (확정 4)
  resourceEcology: {
    sources: [
      {
        id: 'RUIN_SPOIL',
        materialId: ORE_EATER_MOLT,
        form: FORM_SPOIL_PILE,
        carrier: 'residue',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        // 더미는 남이 캐다 버린 것이다 — 많지 않다 (D4)
        harvests: 2,
        // 허물보다 조금 느리다 — 남이 캐다 버린 더미가 다시 쌓이는 시간 (C013 ADDED · D3)
        recoverySeconds: 90,
        // 마디 하나뿐인 원천 — 목록의 원소도 하나다 (C013 CHANGED · 옛 traceOp)
        traceOps: ['trace-ruin-spoil'],
      },
    ],
  },
};
