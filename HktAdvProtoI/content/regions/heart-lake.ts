// 심장 호수 — depth deep. 떨어져 닿는 방이다 (01-spec SPEC-007).
//
// anchor 둘 — FALL_LANDING 은 방 한가운데다. 떨어진 자리는 변이 아니라 어디의 한복판이고,
// 그래서 "올라갈 길이 없다" 가 사방으로 읽힌다 (01-spec UNRESOLVED 판정).
// 그 자리로 되돌아오는 Connector 는 하나도 없다 — 나가는 끝은 물길 RIVER 하나뿐이고 남쪽 변이다.
//
// C014 ADDED — 이 방이 **흐름의 출발**을 낳는다 (A.4 · Play §5.7). 거목 안에서 계속 가라앉는
// 침전이 여기 쌓이고, 그 일부가 물길(HEART_RIVER)을 타고 숲 깊은 곳의 어귀로 내려간다.
// 그래서 이 방의 침전을 캐 놓으면 **다른 방의 어귀에 아무것도 오지 않는다** (spec SPEC-005) —
// 나가는 길 하나뿐인 이 막다른 방이 두 방 건너의 기회를 쥔다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_SILT_BED,
  RECOVERY_LAKE_SETTLING,
  RESOURCE_LAYER,
  TRACE_LAYER,
  soilStainTag,
} from './resource-ecology';

export const HEART_LAKE = 'HEART_LAKE';

export const HEART_LAKE_SPEC: RegionSpec = {
  id: HEART_LAKE,
  depth: 'deep',
  space: {
    id: HEART_LAKE,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 9,
    ops: [
      {
        id: 'anchor-fall-landing',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FALL_LANDING',
        position: { x: 0, z: 0 },
      },
      {
        id: 'anchor-river',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'RIVER',
        position: { x: 0, z: -18 },
      },
      // ── C014 ADDED — 흔적과 원천 ──────────────────────────────────────────
      //
      // 바닥 2 · 침전 둘레 4 (spec 데이터 표 · 기본형 ⑧). 여기서 흙의 변색은 **물빛의
      // 탁함**이다 (A.2 Trace) — 같은 사다리의 같은 단계이고, 무엇으로 보이는지는 View 가 정한다.
      //
      // 자리 (-8, -6) 의 근거 — 이 방은 op 가 anchor 둘뿐이라 어디나 평지이고(컴파일해 격자를
      // 훑어 확인: 방 전체가 통행 가능), 떨어져 닿는 자리 FALL_LANDING(0, 0) 에서 10 ·
      // 나가는 물길 RIVER(0, -18) 에서 14 남짓 떨어져 두 anchor 어느 쪽과도 겹치지 않는다.
      // 떨어진 자리에서 물길로 곧장 걷는 선(x = 0) 밖이므로 나가는 길을 막지도 않는다.
      // 둘레 반지름 7 은 다른 원천의 둘레와 같은 값이고 extent 안에 온전히 든다.
      {
        id: 'trace-lake-base',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
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
        id: 'trace-lake-silt',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: -8, z: -6 }, radius: 7 },
      },
      {
        id: 'source-lake-silt-bed',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'LAKE_SILT_BED',
        position: { x: -8, z: -6 },
      },
    ],
  },
  // 핵심부의 Risk 셋째 — 가장 깊은 방(depth deep)의 것이고, **흐름의 출발**이다 (A.2 · A.4).
  // 같은 Seed 가 여기서는 침전으로, 어귀에서는 알갱이로 난다 — 물에 갈린 만큼 순도가 다르다
  // (A.1 · D2 ③). 종류를 늘린 것이 아니라 사슬을 옮겨 적은 것이다.
  resourceEcology: {
    sources: [
      {
        id: 'LAKE_SILT_BED',
        materialId: BIO_ORE,
        // 이 숲의 사슬 하나에서 난다 (§5.0)
        worldCause: FOREST_CHAIN,
        form: FORM_SILT_BED,
        carrier: 'water',
        opportunity: 'risk',
        // 거목 안에서 **계속** 가라앉는다 — 조건이 붙지 않는 되돌아옴이다 (A.2 회복 원인).
        // 매달린 것도 유입 흐름도 없으므로 이 원천만은 제 길이대로만 돌아온다 (SPEC-004 경계 ③)
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_LAKE_SETTLING,
        // 바닥에 깔린 것이라 한 번에 다 걷히지 않는다 (D4 의 더미와 같은 어법)
        harvests: 2,
        // 핵심부의 값 — 가장 깊은 자리는 가장 느리게 돌아온다 (D3 의 비율 · 기본형 ②)
        recoverySeconds: 180,
        // 마디 하나뿐인 원천 — 자리를 옮기지 않는다 (siteCurve 없음)
        traceOps: ['trace-lake-silt'],
      },
    ],
  },
};
