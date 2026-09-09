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

// C016 CHANGED — anchor 가 일곱이 된다. 걷는 숲으로 나가는 문의 이쪽 자리 하나가 늘고,
// 그 문은 **긴 밤에만 열린다** (조건은 graph.ts 의 활성 표가 진다 — 판정하는 함수가 하나여야
// 하기 때문이다). 이 방에서 나가는 끝은 다섯에서 여섯이 된다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { DEPTH_LAYER, HAZARD_LAYER } from './phases';
import { HUNTER_CURVE_TAG, WHALE_CURVE_TAG } from './presence-routes';
import { POPULATION_DECLINE_EATEN } from './ecology';
import { BIG_BIRD, ORE_EATER, PREDATOR, PRESENCE_BIG_BIRD } from './lives';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_GLOW_CAP,
  FORM_HUSK_SHARD,
  FORM_ORE_PEBBLE,
  FORM_RIVER_GRAIN,
  FORM_SEEP_CRUST,
  GIANT_TREE_FUNGUS,
  ORE_EATER_MOLT,
  PRESENCE_LAYER,
  RECOVERY_FLOW_ARRIVAL,
  RECOVERY_HUSK_SHED,
  RECOVERY_NIGHT_BLOOM,
  RECOVERY_PEBBLE_WASH,
  RECOVERY_TREE_UPTAKE,
  RESOURCE_LAYER,
  soilStainTag,
  TRACE_LAYER,
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
      // C016 ADDED — 걷는 숲으로 나가는 문의 이쪽 자리.
      //
      // 네 변은 이미 찼으므로 안쪽 자리다 (RIVER_MOUTH 가 그랬던 그대로). (13, 13) 은
      // 고대 문(-13, 13)의 맞은편 모서리 안쪽이다 — 길이 아니라 문이므로 변에 두지 않는다는
      // 규율을 이 방이 이미 세워 두었다 (C002 UNRESOLVED 판정).
      //
      // 기존 여섯 어느 것과도 겹치지 않고(가장 가까운 TREE_APPROACH(0, 18)까지 13.93),
      // 안쪽 출구 둘레의 흔적 원(반지름 8) 밖이라 그 짙기도 한 값 달라지지 않는다.
      // 이 방은 anchor 와 흔적뿐이라 어디나 평지다 — 걸어 닿는다.
      {
        id: 'anchor-walking-forest-door',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'WALKING_FOREST_DOOR',
        position: { x: 13, z: 13 },
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
      // ── C018 ADDED — 지나가는 것들의 선 둘과 눈 없는 것의 자락 ─────────────
      //
      // 둘 다 **높이를 건드리지 않는 표시선**이다 (profile 없음 · 뿌리 곡선이 세운 그 형) —
      // 땅도 컴파일 결과도 hash 도 한 값 바뀌지 않는다 (T6). 이 방은 anchor 와 흔적뿐이라
      // 어디나 평지이고, 아래 점 일곱은 전부 컴파일 결과에서 통행 가능함을 실측했다
      // (반경 2 의 둘레까지). 남쪽 문 DEEP_TRAIL(0, -18) 에서 1.6m 걸음 · 16방위 BFS 로
      // 하늘의 선은 6 · 9 · 15 · 23 걸음, 눈 없는 것의 선은 15 · 12 · 9 걸음에 닿는다.
      //
      // 하늘의 선 — 숲 가장자리 쪽(남)에서 들어와 거목 쪽 문 TREE_APPROACH(0, 18) 로 빠진다.
      // 지나가는 차례가 그 방향이다. 어귀의 퇴적(11, -11) 에서 가장 가까운 마디까지 16.55 이라
      // 그 원천의 자리와 겹치지 않는다.
      {
        id: 'whale-curve',
        kind: 'curve',
        layer: PRESENCE_LAYER,
        tag: WHALE_CURVE_TAG,
        points: [
          { x: -10, z: -14 },
          { x: -4, z: -4 },
          { x: 2, z: 6 },
          { x: 8, z: 16 },
        ],
        width: 3,
      },
      // 눈 없는 것의 선 — 이 방이 그것의 **첫 마디**다 (숲 안쪽에서 내려온다 · Play §5.2).
      // 걷는 숲 쪽(북동)에서 물길이 나오는 어귀 쪽(남동)으로 비스듬히 지난다.
      //
      // **어귀를 스쳐 지나는 것이 이 방향의 뜻이다** — 위험과 보상은 같은 근원에서 온다
      // (Concept §6). 이 방이 낳는 것(어귀의 퇴적 · (11, -11))은 그 자락 안에 들어, 긴 밤에
      // 그것을 캐러 오는 것과 그때 여기를 지나는 것이 **같은 자리의 일**이 된다.
      // 하늘의 선과는 방을 가로질러 반대쪽이라 한 점에서도 겹치지 않는다 — 둘은 다른 때에
      // 오는 다른 것이다 (가장 가까운 마디끼리 8.06).
      {
        id: 'hunter-curve',
        kind: 'curve',
        layer: PRESENCE_LAYER,
        tag: HUNTER_CURVE_TAG,
        points: [
          { x: 4, z: 6 },
          { x: 9, z: -2 },
          { x: 13, z: -10 },
        ],
        width: 3,
      },
      // 그 선의 **자락** — 지나는 동안에만 위험으로 읽힌다 (spec R4). 중심은 가운데 마디이고
      // 반지름 10 은 양 끝(9.43 · 8.94)과 **어귀의 퇴적**(9.22)을 함께 품는다.
      // 컴파일 결과를 한 값도 바꾸지 않는다 — 어느 때에 무엇으로 읽히는가는 경로 데이터만이 안다.
      {
        id: 'hazard-deep-hunter-path',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: HUNTER_CURVE_TAG,
        shape: { kind: 'circle', center: { x: 9, z: -2 }, radius: 10 },
      },
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 ──────────────────────
      //
      // Human 의 답: "재료가 너무 적고 채집하는 재미가 부족하다." 방의 중심이던 원천 곁에
      // **작은 것 여럿**이 흩어져 선다 — 걸어 다니며 줍는 것이다. 자리는 이미 선 것들(원천 · 출구 ·
      // 선의 마디 · 막힌 땅)과 겹치지 않는 평지에서 골랐고, 둘레 흔적은 방 바닥보다 한 단계 짙되
      // 반지름 4 로 작다 (중심 원천의 7 과 갈려 "작은 것" 으로 읽힌다). 규칙은 하나도 늘지 않는다.
      {
        id: 'trace-ore-pebble-deep-1',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: -8, z: -8 }, radius: 4 },
      },
      {
        id: 'source-ore-pebble-deep-1',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ORE_PEBBLE_DEEP_1',
        position: { x: -8, z: -8 },
      },
      {
        id: 'trace-ore-pebble-deep-2',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 6, z: 10 }, radius: 4 },
      },
      {
        id: 'source-ore-pebble-deep-2',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ORE_PEBBLE_DEEP_2',
        position: { x: 6, z: 10 },
      },
      {
        id: 'trace-husk-shard-deep',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: -10, z: 6 }, radius: 4 },
      },
      {
        id: 'source-husk-shard-deep',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'HUSK_SHARD_DEEP',
        position: { x: -10, z: 6 },
      },
      {
        id: 'trace-glow-cap-deep',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: -14, z: -8 }, radius: 4 },
      },
      {
        id: 'source-glow-cap-deep',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'GLOW_CAP_DEEP',
        position: { x: -14, z: -8 },
      },
      // ── RoomNeverSame 실주행 판정 ADDED — 철이 이 방을 바꾸는 자락 ────────────────
      //
      // Human 의 답: "밤낮은 보였는데 다른 변화는 모르겠다 — 확인할 단서 자체가 없다." 철을 타는 방이
      // 숲 가장자리 하나뿐이었다. 이 자락들은 컴파일 결과를 한 값도 바꾸지 않고(높이 · 표면 · 통행 그대로)
      // 철이 그 위에 State 를 덧씌울 뿐이다 (C016 의 형 그대로). 어느 철에 무엇으로 읽히는가는 아래 phases 만이 안다.
      {
        id: 'depth-deep-toward-ore',
        kind: 'area',
        layer: DEPTH_LAYER,
        tag: 'ORE_TRAIL',
        shape: { kind: 'circle', center: { x: 18, z: 0 }, radius: 8 },
      },
      {
        id: 'hazard-deep-toward-ore',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'ORE_TRAIL',
        shape: { kind: 'circle', center: { x: 18, z: 0 }, radius: 8 },
      },
      {
        id: 'hazard-deep-ancient-gate',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'ANCIENT_GATE',
        shape: { kind: 'circle', center: { x: -13, z: 13 }, radius: 6 },
      },
      // 스밈에만 서는 원천 — 숲 가장자리의 껍질과 같은 것이 이 방의 광석 지대 쪽 자락에도 배어 나온다.
      // 자리 (12, 4) 는 그 자락 안(출구 ORE_TRAIL 까지 7.2)이고 어귀의 퇴적 · 눈 없는 것의 마디와 겹치지 않는다
      {
        id: 'trace-deep-seep-crust',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(3),
        shape: { kind: 'circle', center: { x: 12, z: 4 }, radius: 4 },
      },
      {
        id: 'source-seep-crust-deep',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'SEEP_CRUST_DEEP',
        position: { x: 12, z: 4 },
      },
      // ── C025 ADDED — **새가 드는 자락 둘** (Play §5.6 · V21 · spec World Change 8) ─────
      //
      // 개체군의 값 1 · 2 마다 하나씩 넓어진다 — 거목의 방이 떼에 세운 그 형 그대로의
      // 동심원이고(presence-swarm-*), 갈리는 것은 값의 눈금(상한 2)과 중심뿐이다.
      //
      // **중심 (-6, 11) 의 근거** — 이 방에서 새가 드는 뜻은 "거목 쪽에서 와서 둥지 쪽으로
      // 불린다" 이므로, 거목으로 나가는 문 TREE_APPROACH(0, 18)과 둥지로 나가는 문
      // NEST_TRAIL(-18, 0) **사이**의 북서 안쪽이다 (두 문에서 8.6 · 16.3).
      //   · 컴파일해 격자를 훑어 확인했다 — 중심과 두 반지름의 여덟 방위가 전부 통행 가능한
      //     평지(surface=flat · 높이 0)다. 이 방은 anchor 와 흔적뿐이라 어디나 평지다.
      //   · 자락이 extent(-20..20) 안에 온전히 든다 — r=4 x -10..-2 z 7..15 ·
      //     r=7 x -13..1 z 4..18.
      //   · **이 layer 에 이미 선 것과 겹치지 않는다** — 하늘의 선(가장 가까운 마디 (2, 6)
      //     까지 9.43)과 눈 없는 것의 선((4, 6) 까지 11.18)이 둘 다 바깥 원 밖이다.
      //     고대 문 anchor(-13, 13)도 7.28 로 밖이다 (그 문 언저리의 자락과 갈린다).
      //
      // **흔적 layer 가 아닌 것도 거목의 방과 같은 까닭이다** — 흙이 짙어지는 것이 아니라
      // **새가 거기 돈다**는 말이고, 그래서 높이도 표면도 통행도 한 값 건드리지 않는다.
      {
        id: 'presence-bird-1',
        kind: 'area',
        layer: PRESENCE_LAYER,
        tag: PRESENCE_BIG_BIRD,
        shape: { kind: 'circle', center: { x: -6, z: 11 }, radius: 4 },
      },
      {
        id: 'presence-bird-2',
        kind: 'area',
        layer: PRESENCE_LAYER,
        tag: PRESENCE_BIG_BIRD,
        shape: { kind: 'circle', center: { x: -6, z: 11 }, radius: 7 },
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
      // ── RoomBearsMaterial 실주행 판정 ADDED — 흩어진 것들 (자리는 위의 point 가 소유한다) ──
      // 흙 위에 흩어진 붉은 자갈 — 뿌리가 밀어 올린 조각이 비에 씻겨 드러난다. 한 알이 한 번이고 곧 되돌아온다
      {
        id: 'ORE_PEBBLE_DEEP_1',
        materialId: BIO_ORE,
        worldCause: FOREST_CHAIN,
        form: FORM_ORE_PEBBLE,
        carrier: 'terrain',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_PEBBLE_WASH,
        harvests: 1,
        recoverySeconds: 45,
        traceOps: ['trace-ore-pebble-deep-1'],
      },
      // 흙 위에 흩어진 붉은 자갈 — 뿌리가 밀어 올린 조각이 비에 씻겨 드러난다. 한 알이 한 번이고 곧 되돌아온다
      {
        id: 'ORE_PEBBLE_DEEP_2',
        materialId: BIO_ORE,
        worldCause: FOREST_CHAIN,
        form: FORM_ORE_PEBBLE,
        carrier: 'terrain',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_PEBBLE_WASH,
        harvests: 1,
        recoverySeconds: 45,
        traceOps: ['trace-ore-pebble-deep-2'],
      },
      // 풀줄기에 걸린 껍질 조각 — 광식충이 줄기를 타고 오르며 벗은 것. 밑동의 허물과 같은 재료의 다른 형태다
      {
        id: 'HUSK_SHARD_DEEP',
        materialId: ORE_EATER_MOLT,
        worldCause: FOREST_CHAIN,
        form: FORM_HUSK_SHARD,
        carrier: 'plant',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        recoveryCause: RECOVERY_HUSK_SHED,
        harvests: 2,
        recoverySeconds: 75,
        traceOps: ['trace-husk-shard-deep'],
      },
      // 어둠에서 희게 빛나는 갓 — 거목균의 밤 형태. **밤에만 선다** (dayPhases): 낮에는 흙 속으로 오므라들어 거기 없다. 밤이 감추는 것이 아니라 종류를 바꾼다 (RoomNeverSame Q25)
      {
        id: 'GLOW_CAP_DEEP',
        materialId: GIANT_TREE_FUNGUS,
        worldCause: FOREST_CHAIN,
        form: FORM_GLOW_CAP,
        carrier: 'fungus',
        opportunity: 'by-product',
        supply: 'conditional-renewable',
        recoveryCause: RECOVERY_NIGHT_BLOOM,
        harvests: 1,
        recoverySeconds: 90,
        traceOps: ['trace-glow-cap-deep'],
        // 낮밤을 탄다 — 밤에만 선다
        dayPhases: ['NIGHT'],
      },
      // 스밈에만 서는 것 (RoomNeverSame 실주행 판정) — 숲 가장자리의 껍질(SEEP_CRUST)과 같은 형태 · 같은 값이다
      {
        id: 'SEEP_CRUST_DEEP',
        materialId: BIO_ORE,
        worldCause: FOREST_CHAIN,
        form: FORM_SEEP_CRUST,
        carrier: 'terrain',
        opportunity: 'conditional',
        supply: 'conditional-renewable',
        recoveryCause: RECOVERY_TREE_UPTAKE,
        harvests: 3,
        recoverySeconds: 60,
        traceOps: ['trace-deep-seep-crust'],
        occurrence: { seasons: ['SEEP'] },
      },
    ],
  },
  /**
   * 이 방이 품은 **생명 계통** (C025 ADDED · Play §5.6 · Concept §4 의 숲의 생태 사슬).
   *
   * **탄생지가 없는 방이 처음으로 개체군을 밝힌다.** 여기서 나는 것은 없고 **드는 것**만
   * 있기 때문이다 — 새는 광식충이 불어난 뒤에 오고, 오게 하는 것은 탄생이 아니라
   * **관계**다 (spec World Change 1 · 2). 그래서 이 방의 계통에는 lifeFormation 이 없다:
   * 없는 것을 지어내지 않는다 (탄생지 없는 방에 lifeFormation 을 두지 않는 그 규율).
   */
  ecology: {
    populations: [
      {
        id: BIG_BIRD,
        // 이 방이 감당하는 수 (확정 6 의 눈금 4 · 2 · 1 에서 가운데)
        scale: 2,
        // 값이 내리는 세계 안의 원인 — **먹힘**이다 (포식수가 먹는다 · C025 ADDED).
        // 광식충 · 거목균과 갈리는 자리다: 저 둘은 조건이 끊겨 마르고 이것은 먹혀서 준다
        declineCause: POPULATION_DECLINE_EATEN,
        // **declineWhen 을 밝히지 않는다** (spec 기본형 ⑤) — 이 값을 굴리는 것이 관계이기
        // 때문이다. 조건 결핍으로 마르는 것은 광식충과 거목균 둘뿐이고(확정 6), 밝히지 않은
        // 개체군은 철이 바뀌어도 내리지 않는다 (RULE-POPULATION-DECLINE-001 경계 ④)
        //
        // **소란도 밝히지 않는다** (spec 기본형 ⑥) — 소란을 올리는 것은 탄생의 일이고
        // 이것은 태어나지 않는다 (관계가 값을 옮길 뿐이다)
        presence: PRESENCE_BIG_BIRD,
        // 값 1 · 2 마다 하나씩 — 값만큼이 앞에서부터 서므로 값이 오를수록 넓어진다
        presenceOps: ['presence-bird-1', 'presence-bird-2'],
      },
    ],
    /**
     * 이 방의 새가 **거는** 관계 둘 (spec 데이터 값 표 · SPEC-005).
     *
     * 둘 다 **방을 넘는다** — 먹는 것은 거목의 방에 있고 부르는 것은 둥지에 있다. 그래서
     * 둘 다 이음을 밝힌다: 그 이음이 실제로 두 방을 잇지 않으면 이 관계는 아무 일도 하지
     * 않는다 (Flow 의 anchor 가 그런 그대로).
     *
     * 문 이름을 **글자로** 적는다 — graph.ts 가 이 방을 부르고 있으므로 되부르면 순환이
     * 난다 (위 access.locks 가 세운 어법 그대로).
     */
    links: [
      // 새가 광식충을 먹는다 — 거목의 방의 값이 준다 (값이 달라지는 것은 **to 의 방**이다)
      { from: BIG_BIRD, to: ORE_EATER, kind: 'EATS', via: 'TREE_APPROACH' },
      // 새가 모이면 둥지의 주인이 온다 — 사슬의 다음 마디다
      { from: BIG_BIRD, to: PREDATOR, kind: 'CALLS', via: 'NEST_TRAIL' },
    ],
  },
  /**
   * 이 방이 **묻는 것** — 걷는 숲으로 나가는 문 하나 (C029 ADDED · Access §9.1).
   *
   * **옮겨 온 것이고 한 값도 새로 정하지 않았다** — C016 이 활성 조건 표(graph.ts)에 적어 둔
   * 그 조건이 형만 바뀌어 여기 온다. 그 문은 **긴 밤에만** 열리고(Play §5.2 · 확정 6) 다른
   * 철에는 "이 철이 아니다" 로 잠긴다. 방의 State 를 읽지 않는다: 이 문을 여는 것은 어느 방의
   * 사정도 아니고 세계의 시각이다.
   *
   * 문 이름을 **글자로** 적는다 — graph.ts 가 이 방을 부르고 있으므로 되부르면 순환이 난다
   * (phases.outflow · PRESENCE_ROUTES 가 세운 어법 그대로).
   *
   * 흔적은 **숲 안쪽의 흙** 하나다 (Access §9.1 "하늘 · 흙 · 발자국이 철을 말한다" · spec
   * 기본형 ⑥) — 셋 중 이 방에 op 로 놓인 것은 흙 하나이고, 하늘은 놓인 자리가 아니며 발자국은
   * 그때그때 나는 것이다. 몸에 아무것도 걸지 않는다 (showsOnBody 를 밝히지 않았다) — 흙은
   * 보는 것이지 몸에 서리는 것이 아니다.
   *
   * 현상의 코드(reason)를 밝히지 않는다 — 이 문의 표식은 C016 때와 한 값도 달라지지 않는다
   * (spec R3 ELSE).
   */
  access: {
    locks: [
      {
        id: 'WALKING_FOREST_DOOR',
        at: { kind: 'connector', ref: 'WALKING_FOREST_DOOR' },
        strength: 'hard',
        requires: [{ time: { seasons: ['LONG_NIGHT'] } }],
        traces: [{ op: 'trace-deep-base' }],
      },
    ],
  },
  /**
   * 이 방이 철을 타는 방식 (RoomNeverSame 실주행 판정 ADDED).
   *
   * 스밈에 광석 지대 쪽 출구 둘레가 한 단계 깊어지고(wild → deep) 같은 자락이 위험으로 읽힌다 —
   * 숲 가장자리가 안쪽 출구에 한 그것을 한 방 더 안쪽에서 되풀이한다 (깊이가 스미는 방향이 곧 깊은 쪽 ·
   * Concept §13). 긴 밤에는 고대 문 언저리에서 무언가가 일어난다 — 그 문 너머(미로)가 이 세계에서
   * 규칙을 품은 유일한 방이라는 것이 긴 밤에 문 앞에서 읽히는 자리다.
   */
  phases: {
    seasons: {
      SEEP: {
        depthOverlay: [{ areaId: 'depth-deep-toward-ore', depth: 'deep' }],
        hazardExtend: [{ areaId: 'hazard-deep-toward-ore', hazard: 'hazard/creature' }],
      },
      LONG_NIGHT: {
        hazardExtend: [{ areaId: 'hazard-deep-ancient-gate', hazard: 'hazard/phenomenon' }],
      },
    },
  },
};
