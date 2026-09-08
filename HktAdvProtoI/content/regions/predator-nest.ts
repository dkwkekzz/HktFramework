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
import { DEPTH_LAYER, HAZARD_LAYER } from './phases';
import {
  FOREST_CHAIN,
  FORM_GLOW_CAP,
  FORM_HUSK_SHARD,
  FORM_NEST_MYCELIUM,
  GIANT_TREE_FUNGUS,
  ORE_EATER_MOLT,
  RECOVERY_CARCASS_DECAY,
  RECOVERY_HUSK_SHED,
  RECOVERY_NIGHT_BLOOM,
  RESOURCE_LAYER,
  soilStainTag,
  TRACE_LAYER,
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
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 ──────────────────────
      //
      // Human 의 답: "재료가 너무 적고 채집하는 재미가 부족하다." 방의 중심이던 원천 곁에
      // **작은 것 여럿**이 흩어져 선다 — 걸어 다니며 줍는 것이다. 자리는 이미 선 것들(원천 · 출구 ·
      // 선의 마디 · 막힌 땅)과 겹치지 않는 평지에서 골랐고, 둘레 흔적은 방 바닥보다 한 단계 짙되
      // 반지름 4 로 작다 (중심 원천의 7 과 갈려 "작은 것" 으로 읽힌다). 규칙은 하나도 늘지 않는다.
      {
        id: 'trace-glow-cap-nest-1',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 6, z: -8 }, radius: 4 },
      },
      {
        id: 'source-glow-cap-nest-1',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'GLOW_CAP_NEST_1',
        position: { x: 6, z: -8 },
      },
      {
        id: 'trace-glow-cap-nest-2',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: -10, z: -12 }, radius: 4 },
      },
      {
        id: 'source-glow-cap-nest-2',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'GLOW_CAP_NEST_2',
        position: { x: -10, z: -12 },
      },
      {
        id: 'trace-husk-shard-nest',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 8, z: 8 }, radius: 4 },
      },
      {
        id: 'source-husk-shard-nest',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'HUSK_SHARD_NEST',
        position: { x: 8, z: 8 },
      },
      // ── RoomNeverSame 실주행 판정 ADDED — 철이 이 방을 바꾸는 자락 ────────────────
      //
      // Human 의 답: "밤낮은 보였는데 다른 변화는 모르겠다 — 확인할 단서 자체가 없다." 철을 타는 방이
      // 숲 가장자리 하나뿐이었다. 이 자락들은 컴파일 결과를 한 값도 바꾸지 않고(높이 · 표면 · 통행 그대로)
      // 철이 그 위에 State 를 덧씌울 뿐이다 (C016 의 형 그대로). 어느 철에 무엇으로 읽히는가는 아래 phases 만이 안다.
      {
        id: 'depth-nest-den',
        kind: 'area',
        layer: DEPTH_LAYER,
        tag: 'NEST_FUNGUS',
        shape: { kind: 'circle', center: { x: -6, z: 4 }, radius: 9 },
      },
      {
        id: 'hazard-nest-den',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'NEST_FUNGUS',
        shape: { kind: 'circle', center: { x: -6, z: 4 }, radius: 9 },
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
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 (자리는 위의 point 가 소유한다) ──
      // 어둠에서 희게 빛나는 갓 — 거목균의 밤 형태. **밤에만 선다** (dayPhases): 낮에는 흙 속으로 오므라들어 거기 없다. 밤이 감추는 것이 아니라 종류를 바꾼다 (RoomNeverSame Q25)
      {
        id: 'GLOW_CAP_NEST_1',
        materialId: GIANT_TREE_FUNGUS,
        worldCause: FOREST_CHAIN,
        form: FORM_GLOW_CAP,
        carrier: 'fungus',
        opportunity: 'by-product',
        supply: 'conditional-renewable',
        recoveryCause: RECOVERY_NIGHT_BLOOM,
        harvests: 1,
        recoverySeconds: 90,
        traceOps: ['trace-glow-cap-nest-1'],
        // 낮밤을 탄다 — 밤에만 선다
        dayPhases: ['NIGHT'],
      },
      // 어둠에서 희게 빛나는 갓 — 거목균의 밤 형태. **밤에만 선다** (dayPhases): 낮에는 흙 속으로 오므라들어 거기 없다. 밤이 감추는 것이 아니라 종류를 바꾼다 (RoomNeverSame Q25)
      {
        id: 'GLOW_CAP_NEST_2',
        materialId: GIANT_TREE_FUNGUS,
        worldCause: FOREST_CHAIN,
        form: FORM_GLOW_CAP,
        carrier: 'fungus',
        opportunity: 'by-product',
        supply: 'conditional-renewable',
        recoveryCause: RECOVERY_NIGHT_BLOOM,
        harvests: 1,
        recoverySeconds: 90,
        traceOps: ['trace-glow-cap-nest-2'],
        // 낮밤을 탄다 — 밤에만 선다
        dayPhases: ['NIGHT'],
      },
      // 풀줄기에 걸린 껍질 조각 — 광식충이 줄기를 타고 오르며 벗은 것. 밑동의 허물과 같은 재료의 다른 형태다
      {
        id: 'HUSK_SHARD_NEST',
        materialId: ORE_EATER_MOLT,
        worldCause: FOREST_CHAIN,
        form: FORM_HUSK_SHARD,
        carrier: 'plant',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_HUSK_SHED,
        harvests: 2,
        recoverySeconds: 75,
        traceOps: ['trace-husk-shard-nest'],
      },
    ],
  },
  /**
   * 이 방이 철을 타는 방식 (RoomNeverSame 실주행 판정 ADDED).
   *
   * 긴 밤에 균사가 선 사체 둘레가 한 단계 깊어지고(wild → deep) 같은 자락이 위험으로 읽힌다 —
   * 둥지의 주인이 돌아오는 때다 (살아 있는 포식은 3층의 몫이고, 2층은 그 자락이 위험하다고 말하는 것까지다).
   * 깊이와 위험이 같은 자락이다 (Concept §6).
   */
  phases: {
    seasons: {
      LONG_NIGHT: {
        depthOverlay: [{ areaId: 'depth-nest-den', depth: 'deep' }],
        hazardExtend: [{ areaId: 'hazard-nest-den', hazard: 'hazard/creature' }],
      },
    },
  },
};
