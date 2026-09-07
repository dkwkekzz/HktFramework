// 숲 안쪽 — depth wild. C002 에서 문이 가장 많은 방이다 (출구 다섯 · 01-spec SPEC-003).
//
// anchor 다섯 — 돌아가는 길 DEEP_TRAIL 은 남쪽 변, 둥지와 광석 지대는 서·동 변,
// 붉은눈 거목으로 다가서는 TREE_APPROACH 는 북쪽 변이다.
// ANCIENT_GATE 만 변이 아닌 안쪽 모서리 자리다 — 길이 아니라 문이기 때문이다 (01-spec UNRESOLVED 판정).
// 방 사이의 좌표는 서로 무관하다 — 같은 tag 가 다른 방에서 다른 자리다 (C001 SPEC-001).
//
// C003 CHANGED — anchor 가 여섯이 된다. 물길이 나오는 RIVER_MOUTH 는 네 변이 이미 찼으므로 안쪽 자리이고,
// 거목으로 나가는 TREE_APPROACH(0, 18) 와 가장 먼 쪽이다 — "들어갔던 자리가 아니다" 가 걸음으로 읽힌다.
// 이 방에서 나가는 끝은 그래도 다섯 그대로다 — RIVER_MOUTH 로 나가는 Connector 가 없기 때문이다
// (물길은 들어오기만 하는 one-way 다 · 01-spec SPEC-002 경계).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_RIVER_GRAIN,
  RECOVERY_FLOW_ARRIVAL,
  RESOURCE_LAYER,
  TRACE_LAYER,
  soilStainTag,
} from './resource-ecology';

export const FOREST_DEEP = 'FOREST_DEEP';

export const FOREST_DEEP_SPEC: RegionSpec = {
  id: FOREST_DEEP,
  depth: 'wild',
  space: {
    id: FOREST_DEEP,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 3,
    ops: [
      {
        id: 'anchor-deep-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'DEEP_TRAIL',
        position: { x: 0, z: -18 },
      },
      {
        id: 'anchor-nest-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'NEST_TRAIL',
        position: { x: -18, z: 0 },
      },
      {
        id: 'anchor-ore-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ORE_TRAIL',
        position: { x: 18, z: 0 },
      },
      {
        id: 'anchor-tree-approach',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'TREE_APPROACH',
        position: { x: 0, z: 18 },
      },
      {
        id: 'anchor-ancient-gate',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ANCIENT_GATE',
        position: { x: -13, z: 13 },
      },
      {
        id: 'anchor-river-mouth',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'RIVER_MOUTH',
        position: { x: 14, z: -8 },
      },
      // ── C011 ADDED — 흔적만 있고 원천은 없다 ───────────────────────────────
      //
      // A.3 의 **중간부**다: "원천은 없고 방향이 있다". 방 전체가 경계부보다 한 단계 짙고,
      // 안쪽으로 가는 출구 둘 둘레가 다시 한 단계 짙다 —
      //   동쪽 ORE_TRAIL (18, 0)     → 생체 광석 지대
      //   북쪽 TREE_APPROACH (0, 18) → 붉은 눈의 거목
      // 서쪽 NEST_TRAIL (-18, 0) 둘레는 C011 에서 짙어지지 않았다. 둥지의 균류는 이 계통의
      // **끝**이고 그 원천은 C014 의 것이었기 때문이다 — 없는 방향을 미리 가리키지 않았다.
      //
      // C014 CHANGED — 그 원천이 섰으므로 그 방향도 선다 (spec R7 · SPEC-009). 이제 안쪽
      // 출구 **셋** 둘레가 다 짙다. 값도 반지름도 앞의 둘과 같다 — 사다리는 그대로이고
      // 방향이 하나 는 것뿐이다. 방 바닥(2)과 바깥쪽 출구 DEEP_TRAIL(0, -18) 둘레는
      // 한 값도 달라지지 않는다 (경계).
      {
        id: 'trace-deep-base',
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
        id: 'trace-deep-toward-ore',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 18, z: 0 }, radius: 8 },
      },
      {
        id: 'trace-deep-toward-tree',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 0, z: 18 }, radius: 8 },
      },
      {
        id: 'trace-deep-toward-nest',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: -18, z: 0 }, radius: 8 },
      },
      // ── C014 ADDED — 어귀의 퇴적 ──────────────────────────────────────────
      //
      // 이 방에 처음으로 원천이 선다. 그래도 A.3 의 "중간부에는 원천이 없다" 는 깨지지 않는다 —
      // 이것은 이 방이 **낳는** 것이 아니라 다른 방에서 **실려 오는** 것이기 때문이다
      // (조건부 자리 · FLOW_HEART_SILT 의 도착).
      //
      // 자리 (11, -11) 의 근거 — 물길이 나오는 어귀 RIVER_MOUTH(14, -8) 에서 4.2 떨어진
      // 곁이고(anchor 와 겹치지 않는다), 컴파일해 격자를 훑어 통행 가능한 평지임을 확인했다
      // (이 방은 anchor 와 흔적뿐이라 어디나 평지다). 둘레 반지름 7 은 다른 원천의 둘레와
      // 같은 값이고 그 원이 extent 안에 온전히 든다. 안쪽 출구 셋의 둘레(반지름 8)와는
      // 서로의 **중심을 덮지 않는다** — 가장 가까운 ORE_TRAIL(18, 0) 까지 13 이므로
      // 두 원의 언저리가 스칠 뿐이고, 출구 둘레의 세기는 한 값도 달라지지 않는다.
      {
        id: 'trace-deep-river-silt',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 11, z: -11 }, radius: 7 },
      },
      {
        id: 'source-river-silt',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'RIVER_SILT',
        position: { x: 11, z: -11 },
      },
    ],
  },
  // 조건부 기회 하나 — 이 세계에서 **세계 시각이 여는** 유일한 자리다 (A.3 "조건부 상태").
  // 무엇에 매달렸는지는 여기 적지 않는다: 유입 흐름(RESOURCE_FLOWS)의 출발이 곧 그 매달림이고,
  // 그래서 호수 바닥을 캐 놓으면 물길이 불어도 여기에 오는 것이 없다 (spec R3 · SPEC-005).
  resourceEcology: {
    sources: [
      {
        id: 'RIVER_SILT',
        materialId: BIO_ORE,
        // 이 숲의 사슬 하나에서 난다 (§5.0)
        worldCause: FOREST_CHAIN,
        // 원석이 물에 갈려 붉은빛을 잃은 것 — 노두와 **같은 재료**이고 형태만 다르다 (D2 ③)
        form: FORM_RIVER_GRAIN,
        carrier: 'water',
        opportunity: 'conditional',
        // 물길이 불어난 때만 실려 온다. 사건은 되풀이된다 (§5.6 의 넷째 · C013 이 남긴 자리)
        supply: 'event-scarce',
        // 다음 흐름이 실어 온다 (A.2 회복 원인)
        recoveryCause: RECOVERY_FLOW_ARRIVAL,
        // 한 번 실려 온 퇴적선에서 두 번 (D4 의 더미와 같은 어법)
        harvests: 2,
        // 활성 구간 하나 — 물길이 불어 있는 동안에만 진행이 오르므로 한 구간을 채우면
        // 도착이고, 구간 안에 캐 버리면 다음 주기를 기다린다 (D3 · 기본형 ③)
        recoverySeconds: 30,
        // 마디 하나뿐인 원천 — 자리를 옮기지 않는다 (siteCurve 없음)
        traceOps: ['trace-deep-river-silt'],
      },
    ],
  },
};
