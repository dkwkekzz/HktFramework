// 포식수 둥지 — depth wild. C002 에서는 출구 하나뿐인 빈 방이다 (01-spec SPEC-001 경계).
//
// anchor NEST_TRAIL 은 동쪽 변 근처 — 숲 안쪽으로 돌아가는 길 하나가 전부다.
//
// C014 ADDED — 이 방이 **사슬의 시작**을 낳는다 (Play §5.0 · A.3 "생태 부산물").
// 포식수가 남긴 사체 위에 균사가 피고, 그 균류가 사체를 삭여 흙을 붉게 되돌린다 —
// 거목이 다시 빨아올릴 것이 거기서 온다 (D2 거목균 ②). 그래서 이 방의 흙은 붉고,
// 이것을 캐 놓으면 두 방 건너 노두까지 멎는다 (spec SPEC-002).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  FOREST_CHAIN,
  FORM_NEST_MYCELIUM,
  GIANT_TREE_FUNGUS,
  RECOVERY_CARCASS_DECAY,
  RESOURCE_LAYER,
  TRACE_LAYER,
  soilStainTag,
} from './resource-ecology';

export const PREDATOR_NEST = 'PREDATOR_NEST';

export const PREDATOR_NEST_SPEC: RegionSpec = {
  id: PREDATOR_NEST,
  depth: 'wild',
  space: {
    id: PREDATOR_NEST,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 5,
    ops: [
      {
        id: 'anchor-nest-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'NEST_TRAIL',
        position: { x: 18, z: 0 },
      },
      // ── C014 ADDED — 흔적과 원천 ──────────────────────────────────────────
      //
      // 바닥 2 · 균사 둘레 4 (spec 데이터 표 · 기본형 ⑧). 중간부(숲 안쪽)와 같은 단계의
      // 바닥 위에 핵심부에 버금가는 둘레가 얹힌다 — 균류가 삭인 흙이 붉게 되돌아오기
      // 때문이다 (D2 거목균 ②). C011 이 세운 사다리를 그대로 잇는다: 방 바닥 위에
      // 원천 둘레가 겹치고, 겹침은 짙기이지 양이 아니다.
      //
      // 자리 (-6, 4) 의 근거 — 이 방은 op 가 anchor 하나뿐이라 어디나 평지이고(컴파일해
      // 격자를 훑어 확인: 방 전체가 통행 가능), 하나뿐인 출구 NEST_TRAIL(18, 0) 에서 24 남짓
      // 떨어져 있어 들어서자마자 밟는 자리가 아니다. 둘레 반지름 7 은 다른 원천의 둘레와
      // 같은 값이고, 그 원이 extent(-20..20) 안에 온전히 든다.
      {
        id: 'trace-nest-base',
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
        id: 'trace-nest-fungus',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: -6, z: 4 }, radius: 7 },
      },
      {
        id: 'source-nest-fungus',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'NEST_FUNGUS',
        position: { x: -6, z: 4 },
      },
    ],
  },
  // 생태 **부산물** — 이 세계의 넷째 기회 자리다 (A.3). 사냥의 결과로 남은 것이지
  // 누가 놓아 둔 것이 아니고, 그래서 살아 있는 포식(3층)이 서면 이 자리의 이유가 완성된다.
  resourceEcology: {
    sources: [
      {
        id: 'NEST_FUNGUS',
        materialId: GIANT_TREE_FUNGUS,
        // 이 숲의 사슬 하나에서 난다 — 사슬의 **끝이자 시작**이 이것이다 (§5.0)
        worldCause: FOREST_CHAIN,
        form: FORM_NEST_MYCELIUM,
        carrier: 'fungus',
        opportunity: 'by-product',
        // 사체의 분해 단계가 와야 다시 핀다 (§5.6 · A.1 거목균의 공급 유형)
        supply: 'conditional-renewable',
        // 다음 사체의 분해 — 살아 있는 포식은 3층의 몫이다 (A.2 회복 원인 · 확정 2)
        recoveryCause: RECOVERY_CARCASS_DECAY,
        // 한 번에 다 뜯긴다 — 균사 한 무리 = 한 번 (D4 의 뿌리혹과 같은 어법 · spec SPEC-001)
        harvests: 1,
        // 부산물 — 균사가 다시 피는 데 두 바퀴 (D3)
        recoverySeconds: 120,
        // 마디 하나뿐인 원천 — 자리를 옮기지 않는다 (siteCurve 없음)
        traceOps: ['trace-nest-fungus'],
      },
    ],
  },
};
