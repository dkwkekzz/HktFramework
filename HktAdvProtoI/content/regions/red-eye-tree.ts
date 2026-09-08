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
  GROUND_TREMOR,
  LIFE_HAS_OWNER,
  LIFE_NEEDS_DECAY,
  LIFE_NEEDS_MATERIAL,
  LIFE_NEEDS_PARENT,
  LIFE_NEEDS_RAIN,
  LIFE_ROLE_MOLT_SUPPLY,
  LIFE_SOURCE_RAIN,
  POPULATION_DECLINE_CONDITION_LOST,
  RULE_FOREST_CLUTCH,
} from './ecology';
import { FORM_ROOT_CLUTCH, FORM_ROOT_EGGS, ORE_EATER, PRESENCE_ORE_EATER_SWARM } from './lives';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_CLUTCH_HUSK,
  FORM_EGG_HUSK,
  FORM_GLOW_CAP,
  FORM_ORE_PEBBLE,
  FORM_ROOT_NODULE,
  GIANT_TREE_FUNGUS,
  ORE_EATER_MOLT,
  PRESENCE_LAYER,
  RECOVERY_NEXT_BIRTH,
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
      // ── C022 ADDED — 붉은 알집과 그 전조 자락 둘 ───────────────────────────
      //
      // 알집은 **뿌리 곡선 위의 마디 곁**에 맺힌다 (Play §5.2) — 위 root-curve 의 네 번째
      // 점 (9, 1) 이다. 컴파일해 실측한 값:
      //   그 자리와 둘레 반경 6 의 여덟 방위가 전부 통행 가능한 평지(surface=flat)다
      //   뿌리혹 (-8, 2) 에서 17.03 · 안쪽 문 (0, 6) 에서 10.30 · ORE_SIDE (18, 0) 에서 9.06 ·
      //   FOREST_DEEP_SIDE (0, -18) 에서 21.02 — 걸어 닿을 수 있고 이미 선 것들과 겹치지 않는다
      //   (뿌리혹 둘레는 반경 7 이므로 17.03 > 7 + 6 · 두 원이 만나지 않는다)
      //
      // 자리를 여기 Description 이 소유하는 것은 원천과 **같은 규율**이다 (C011 R3) —
      // 탄생지의 id 와 이 point 의 tag 가 같은 이름으로 이어진다.
      {
        id: 'site-root-clutch',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ROOT_CLUTCH',
        position: { x: 9, z: 1 },
      },
      // 부푼 균사 — 둥지 쪽 이음(FOREST_DEEP_SIDE · (0, -18))에서 알집까지 뻗은 얇은 띠다.
      // 폭 2.17 의 곧은 사각형이고, 뿌리혹 둘레(중심 (-8, 2) · 반경 7)와는 15.79 떨어져
      // 만나지 않는다 (실측). 흙보다 **옅다**(2) — 붉은 흙 위에 부푼 흰 균사이므로,
      // 짙어지는 사다리가 아니라 색이 갈리는 자국이다.
      //
      // **NEST_FUNGUS 가 있음이 아닐 때는 서지 않는다** — 그 조건 코드가 걸려 있으면
      // 단계 0 이다 (아래 lifeFormation 의 traces.before 가 그것을 밝힌다).
      {
        id: 'trace-clutch-fungus',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
        shape: {
          kind: 'polygon',
          points: [
            { x: 1.085, z: -18.514 },
            { x: 10.085, z: 0.486 },
            { x: 7.915, z: 1.514 },
            { x: -1.085, z: -17.486 },
          ],
        },
      },
      // 옅어지는 흙 — 알집 둘레다. 이 방 바닥은 3 이므로 평소엔 **한 단계 짙고**(4),
      // 결속하는 동안 한 단계 옅어져 바닥과 같아진다 (재료가 알집으로 간다).
      // 뿌리혹 둘레(5)가 이 방의 정점이라는 C011 의 사실은 그대로다.
      //
      // 결속하는 동안 이 자락에 선 몸의 걸린 것에 **떨림**이 실린다 (위험 태그를 만들지
      // 않는다 — 몸에 아무 일도 하지 않으므로 선 자리의 코드다 · spec 기본형 ⑧).
      {
        id: 'trace-clutch-drain',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 9, z: 1 }, radius: 6 },
      },
      // ── C023 ADDED — 태어남이 남기는 것들과 떼가 도는 자락 ─────────────────
      //
      // **뿌리의 알**(계승형 탄생지 둘째) — 뿌리 곡선의 **다른 마디**다 (Play §5.4).
      // 위 root-curve 의 **세 번째 점 (0, 3)** 이고, 알집이 선 네 번째 점 (9, 1) 과 갈린다.
      // 컴파일해 실측한 값:
      //   그 자리와 둘레 반경 2 · 4 의 여덟 방위가 전부 통행 가능한 평지(surface=flat)다
      //   알집 (9,1) 에서 9.22 · 뿌리혹 (-8,2) 에서 8.06 (그 둘레 반경 7 **밖**이다) ·
      //   안쪽 문 (0,6) 에서 3.00 · ORE_SIDE (18,0) 에서 18.25 · FOREST_DEEP_SIDE (0,-18) 에서 21.00
      // 안쪽 문과 3.00 은 가깝지만 겹치지 않는다 — 그래서 아래 자락(작은 붉은 점)의 반경을
      // **2** 로 두어 문을 덮지 않게 했다 (알집의 자락이 6 인 것과 갈린다: 큰 알집과 작은 점).
      {
        id: 'site-root-eggs',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'ROOT_EGGS',
        position: { x: 0, z: 3 },
      },
      // 작은 붉은 점 — 뿌리 마디에 맺힌 것의 전조 자락이다 (Play §5.4 · 알의 traces.before).
      // 이 방 바닥은 3 이므로 한 단계 짙다(4). 뿌리혹 둘레(중심 (-8,2) · 반경 7 · 단계 5)와
      // 서쪽에서 살짝 겹치지만, 겹친 자리는 **짙은 쪽이 이기므로**(traceStrengthAt) 사다리가
      // 서쪽으로 5 → 4 → 3 으로 단조롭게 내려간다 (실측: 알의 자리 자체는 나눌 것 없이 4 다).
      {
        id: 'trace-eggs-dots',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 0, z: 3 }, radius: 2 },
      },
      // **빈 껍질** — 알집이 터진 그 자리 곁이다 (Observable ② "터진 자리에 빈 껍질이 선다").
      // (12, 2) 는 알집 (9,1) 에서 3.16 · ORE_SIDE (18,0) 에서 6.32 · 붉은 자갈 (12,12) 에서 10.00.
      // 둘레 자락의 반경을 **2.5** 로 두어 알집 자리 (9,1) 를 덮지 않게 했다 (3.16 > 2.5) —
      // 덮으면 결속하는 동안 한 단계 옅어진 알집 둘레를 이 자락이 도로 짙게 만든다.
      {
        id: 'source-clutch-husk',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'CLUTCH_HUSK',
        position: { x: 12, z: 2 },
      },
      {
        id: 'trace-clutch-husk',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 12, z: 2 }, radius: 2.5 },
      },
      // **작은 껍질** — 뿌리의 알이 남기는 것. 알 (0,3) 에서 3.16 · 안쪽 문 (0,6) 에서 3.61 이고,
      // 자락의 반경 2.5 는 알의 자리도 문도 덮지 않는다 (같은 규율 · 실측).
      {
        id: 'source-egg-husk',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'EGG_HUSK',
        position: { x: 3, z: 4 },
      },
      {
        id: 'trace-eggs-husk',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(4),
        shape: { kind: 'circle', center: { x: 3, z: 4 }, radius: 2.5 },
      },
      // **붉은 가루** — 터진 뒤 알집 둘레에 앉는 자국이다 (알집의 traces.after · Play §5.3 ⑤).
      // **SPENT 인 동안에만 선다** (RULE-LIFE-SITE-PHASE-001).
      //
      // 흙이 **한 단계 짙어진다**(4 → 5 · Observable ② "붉은 가루로 한 단계 달라진다") —
      // 알집 둘레는 평소 4 이고 결속하는 동안 3 으로 옅어지므로, 이 자리의 사다리가 세 결로
      // 갈린다: **3 맺히는 중 · 4 그냥 있음 · 5 터진 뒤**. 옅어짐과 같은 눈금의 반대쪽이라
      // 관찰자가 같은 자리에서 "무엇이 지나갔는가" 를 읽는다.
      // 반경은 알집 둘레(6)보다 좁은 5 다 — 재료가 빠져나간 자리가 아니라 터진 자리에 앉은
      // 것이므로 같은 원을 두 벌로 두지 않았고, 그 사이 띠(5..6)는 4 로 남아 테두리가 된다.
      // 뿌리혹 둘레도 5 이지만 그것은 **늘** 5 이고 이것은 120 초뿐이다 — C011 이 적은
      // "뿌리혹 둘레가 이 방의 정점" 은 가만한 세계에서 여전히 참이다.
      {
        id: 'trace-clutch-dust',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(5),
        shape: { kind: 'circle', center: { x: 9, z: 1 }, radius: 5 },
      },
      // **떼가 도는 자락 넷** — 개체군의 값 1 · 2 · 3 · 4 마다 하나씩 넓어진다 (Play §5.3 ⑥ · V21).
      //
      // 뿌리 곡선 위, 두 탄생지 **사이**의 (4, 2) 를 중심으로 한 동심원이다 — 태어난 것들이
      // 제 난 자리 둘레를 돈다는 뜻이고, 값이 오를수록 도는 자락이 넓어진다.
      // 실측: 넷 다 방 안(extent ±20)이고 여덟 방위의 둘레가 전부 통행 가능한 평지다
      //   r=4 x 0..8 z -2..6 · r=7 x -3..11 z -5..9 · r=10 x -6..14 z -8..12 · r=13 x -9..17 z -11..15
      //
      // **뿌리 곡선 · 고래의 선과 같은 layer** 에 산다 (PRESENCE_LAYER) — 땅 위에 무엇이
      // 있다를 적는 표시일 뿐 높이도 표면도 통행도 한 값 건드리지 않는다. 흔적 layer 가
      // 아닌 것도 그 때문이다: 흙이 짙어지는 것이 아니라 **떼가 거기 돈다**는 말이다.
      {
        id: 'presence-swarm-1',
        kind: 'area',
        layer: PRESENCE_LAYER,
        tag: PRESENCE_ORE_EATER_SWARM,
        shape: { kind: 'circle', center: { x: 4, z: 2 }, radius: 4 },
      },
      {
        id: 'presence-swarm-2',
        kind: 'area',
        layer: PRESENCE_LAYER,
        tag: PRESENCE_ORE_EATER_SWARM,
        shape: { kind: 'circle', center: { x: 4, z: 2 }, radius: 7 },
      },
      {
        id: 'presence-swarm-3',
        kind: 'area',
        layer: PRESENCE_LAYER,
        tag: PRESENCE_ORE_EATER_SWARM,
        shape: { kind: 'circle', center: { x: 4, z: 2 }, radius: 10 },
      },
      {
        id: 'presence-swarm-4',
        kind: 'area',
        layer: PRESENCE_LAYER,
        tag: PRESENCE_ORE_EATER_SWARM,
        shape: { kind: 'circle', center: { x: 4, z: 2 }, radius: 13 },
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
      // ── C023 ADDED — 태어남이 **남기고 간** 원천 둘 (확정 7 · Material §6.2 By-product) ──
      //
      // 새 재료가 아니다 — 광식충 허물(ORE_EATER_MOLT)의 다른 형태다. 벗은 것이 아니라
      // **터지고 남은 것**이라는 것만 다르고, 캐면 같은 재료가 손에 든다 (spec R7).
      //
      // **처음이 고갈이다** — 세계가 설 때 그 자리에 아무것도 없다 (SPEC-004 경계 ①).
      // 물길이 아직 오지 않은 원천 · 아직 아무도 지나가지 않은 원천과 **같은 사실**이고
      // (거기 지금 없다), 세우는 자리도 그 하나다 (semantic/region-state.ts 의 initialSourceState).
      //
      // **시간이 되돌리지 않는다** — 되돌리는 것은 **다음 탄생**이다 (RECOVERY_NEXT_BIRTH ·
      // RULE-SOURCE-RECOVERY-001 CHANGED). recoverySeconds 는 그래서 아무 일도 하지 않지만,
      // 되돌아오는 원천의 어법에 맞춰 사건이 되풀이되는 것들과 같은 값(240)을 둔다
      // (FALLEN_SCALE 의 선례) — 값이 아니라 조건이 멎게 하는 자리다.
      {
        id: 'CLUTCH_HUSK',
        materialId: ORE_EATER_MOLT,
        worldCause: FOREST_CHAIN,
        form: FORM_CLUTCH_HUSK,
        // 무언가가 남기고 간 것을 지고 있다 (Material §6.2 의 칸)
        carrier: 'residue',
        // 세계가 낳고 남긴 곁가지 (A.3)
        opportunity: 'by-product',
        // 사건이 되풀이될 때만 온다 — 그 사건이 **탄생**이다 (§5.6 의 넷째)
        supply: 'event-scarce',
        recoveryCause: RECOVERY_NEXT_BIRTH,
        // 한 번 터질 때 하나 (확정 7)
        harvests: 1,
        recoverySeconds: 240,
        traceOps: ['trace-clutch-husk'],
      },
      {
        id: 'EGG_HUSK',
        materialId: ORE_EATER_MOLT,
        worldCause: FOREST_CHAIN,
        form: FORM_EGG_HUSK,
        carrier: 'residue',
        opportunity: 'by-product',
        supply: 'event-scarce',
        recoveryCause: RECOVERY_NEXT_BIRTH,
        harvests: 1,
        recoverySeconds: 240,
        traceOps: ['trace-eggs-husk'],
      },
    ],
  },
  // ── C022 ADDED — 이 방이 품은 생명 계통 (Play §5.2 · 확정 1 · 2 · 3 · 5 · 6) ──
  //
  // 이 세계에서 **무엇이 태어나는지를 밝힌 첫 방**이다. 밝히지 않은 나머지 방은 한 값도
  // 달라지지 않는다 (spec SPEC-001 경계 ①).
  ecology: {
    lifeFormation: [
      {
        // 붉은 알집 — 자리는 위 Description 의 resource point 가 소유한다 (같은 이름으로 잇는다)
        id: 'ROOT_CLUTCH',
        // 최초는 **결속**이다 — 환경의 조건들이 맺혀 태어난다 (확정 2).
        // 이후의 대는 계승(INHERITED)이지만 그것은 이 세계에 아직 서지 않았다
        mode: 'ENVIRONMENTAL_BINDING',
        // 숲의 사슬 하나에 매달린다 — 이 방의 원천이 밝힌 것과 같은 원인이다 (㉘)
        worldCause: FOREST_CHAIN,
        form: FORM_ROOT_CLUTCH,
        // 무엇으로 맺히는가 (확정 3) — 뿌리혹의 축적(생체 광석) · 둥지에서 뻗은 균사(거목균) ·
        // 그리고 재료가 아닌 것 하나: 비
        source: {
          materials: [BIO_ORE, GIANT_TREE_FUNGUS],
          states: [LIFE_SOURCE_RAIN],
        },
        condition: {
          regionRule: RULE_FOREST_CLUTCH,
          // 넷이 **다 차 있는 동안에만** 결속이 오른다 (SPEC-004).
          // 요구마다 자기 모자람 코드를 밝힌다 — 규칙은 무엇이 모자란지 이름으로 알지 못한다
          requires: [
            // 뿌리혹의 축적 — 같은 방의 원천
            { kind: 'source-available', sourceId: 'ROOT_NODULE', unmetCode: LIFE_NEEDS_MATERIAL },
            // 둥지에서 뻗은 균사 — **다른 방의 원천**이다 (포식자 둥지)
            { kind: 'source-available', sourceId: 'NEST_FUNGUS', unmetCode: LIFE_NEEDS_DECAY },
            // 비 — 세계 시각과 철에서 유도된다 (저장되지 않는다)
            { kind: 'rain', unmetCode: LIFE_NEEDS_RAIN },
            // 광식충이 아직 하나도 없다 — 최초는 결속이고 이후는 계승이기 때문이다 (확정 2)
            {
              kind: 'population-at-most',
              populationId: ORE_EATER,
              value: 0,
              unmetCode: LIFE_HAS_OWNER,
            },
          ],
        },
        transition: { from: 'DORMANT', to: 'BORN' },
        // 태어날 때 먹는 것 — 뿌리혹의 축적과 균사의 분해 진행 (C023 CHANGED — 실제로 먹는다).
        // 둘째는 **다른 방의 원천**이다 (둥지의 균사) — 같은 규칙으로 먹힌다 (SPEC-002 경계 ③)
        consumes: ['ROOT_NODULE', 'NEST_FUNGUS'],
        // C023 ADDED — 터지면서 **세우는** 것: 빈 껍질 하나 (Play §5.3 ⑤ · 확정 7)
        leaves: ['CLUTCH_HUSK'],
        // C023 ADDED — 터진 채 머무는 길이 (확정 5). 이만큼 지나면 다시 맺힌 것으로 돌아온다
        spentSeconds: 120,
        traces: {
          before: [
            // 부푼 균사 — 균사가 끊기면 그 자락이 서지 않는다 (SPEC-003 ①)
            { op: 'trace-clutch-fungus', hiddenWhen: LIFE_NEEDS_DECAY },
            // 옅어지는 흙과, 그 위에 선 동안의 떨림 (SPEC-003 ③ ④)
            {
              op: 'trace-clutch-drain',
              fadesWhileBinding: true,
              standingCodeWhileBinding: GROUND_TREMOR,
            },
          ],
          // C023 CHANGED — 태어난 **뒤**에 서는 자락. 붉은 가루 하나뿐이다: 빈 껍질은
          // 자락이 아니라 원천이므로 위 `leaves` 로 갔다 (C022 가 둘을 함께 적어 둔 자리를
          // 이 뜻으로 고쳐 쓴다). **SPENT 인 동안에만 선다**
          after: ['trace-clutch-dust'],
        },
        ecologicalRole: LIFE_ROLE_MOLT_SUPPLY,
        population: ORE_EATER,
        // 결속의 길이 — 60 세계 초 (확정 5). 비 한 번(90 초) 안에 다 찰 수 있는 값이다
        bindingSeconds: 60,
      },
      // ── C023 ADDED — 뿌리의 알 (탄생지 둘째 · 계승형 · Play §5.4 · 확정 2) ──────
      //
      // **최초는 결속이고 이후는 계승이다** (확정 2). 알집이 한 번 터져 광식충이 서고 나면,
      // 다음 대는 알집 없이 뿌리 마디에 저희끼리 맺힌다 — 요구는 둘뿐이고(균사도 비도 묻지
      // 않는다) 먹는 것도 하나뿐이며 남기는 것도 작다.
      //
      // **규칙은 둘을 같은 한 규칙으로 굴린다** (W40 · SPEC-008) — mode 마다 규칙을 따로
      // 두지 않는다. 갈리는 것은 이 데이터(이름 · 형태 · 자리 · 요구 · 길이)뿐이다.
      {
        id: 'ROOT_EGGS',
        // 이미 있는 것이 낳는다 (확정 2 — 이 세계가 계승을 처음 쓰는 자리다)
        mode: 'INHERITED',
        worldCause: FOREST_CHAIN,
        form: FORM_ROOT_EGGS,
        // 무엇으로 맺히는가 (Play §5.4) — 뿌리혹의 축적(생체 광석)과, 재료가 아닌 것 하나:
        // **부모 개체군**. 검사 ㉗ 은 앞의 것만 재고 뒤의 것은 판정하지 않는다 (비와 같은 자리)
        source: {
          materials: [BIO_ORE],
          states: [ORE_EATER],
        },
        condition: {
          // 알집과 **같은 규칙**이 일으킨다 — 숲의 뿌리에 맺히는 그 하나다
          regionRule: RULE_FOREST_CLUTCH,
          // 둘뿐이다 (Play §5.4) — 균사도 비도 묻지 않는다 (SPEC-007 경계 ②)
          requires: [
            // 이을 것이 있다 — 광식충이 하나 이상. 알집의 "아직 아무도 없다" 와 정확히 반대다
            {
              kind: 'population-at-least',
              populationId: ORE_EATER,
              value: 1,
              unmetCode: LIFE_NEEDS_PARENT,
            },
            // 뿌리에 쌓인 것이 있다 — 같은 방의 원천 (SPEC-007 경계 ③)
            { kind: 'source-available', sourceId: 'ROOT_NODULE', unmetCode: LIFE_NEEDS_MATERIAL },
          ],
        },
        transition: { from: 'DORMANT', to: 'BORN' },
        // 먹는 것은 **뿌리혹 하나뿐**이다 — 결속은 둘을 먹는다 (Play §5.4 "결속보다 적게" ·
        // spec 기본형 ③: 이 세계의 원천에는 "얼마나" 가 없고 캘 횟수 하나뿐이므로 수로 읽었다)
        consumes: ['ROOT_NODULE'],
        // 남기는 것은 **작은 껍질**이다 (Play §5.4 · 확정 7)
        leaves: ['EGG_HUSK'],
        // 알집과 **같은 길이**로 머문다 (spec 기본형 ②) — 밝히지 않으면 곧장 DORMANT 라
        // 계승이 90 초마다 끝없이 돌아 상한까지 순식간에 찬다
        spentSeconds: 120,
        traces: {
          // 전조는 하나 — 뿌리 마디의 작은 붉은 점 (Play §5.4). 가려짐도 옅어짐도 없다:
          // 이 자락은 조건이 아니라 **거기 무언가 맺히고 있다**는 것만 말한다
          before: [{ op: 'trace-eggs-dots' }],
          // 계승은 흙에 가루를 남기지 않는다 — 작은 껍질 하나가 전부다 (leaves)
          after: [],
        },
        ecologicalRole: LIFE_ROLE_MOLT_SUPPLY,
        population: ORE_EATER,
        // 계승의 길이 — 90 세계 초 (확정 5). 결속(60)보다 길다
        bindingSeconds: 90,
      },
    ],
    populations: [
      {
        id: ORE_EATER,
        // 이 방이 감당하는 수 (확정 6)
        scale: 4,
        // 값이 내리는 세계 안의 원인 — 조건 결핍 (C024 CHANGED — 그 규칙이 이제 선다)
        declineCause: POPULATION_DECLINE_CONDITION_LOST,
        // **이것이 차 있어야 산다** (C024 ADDED · spec R3 · SPEC-003 · 확정 6) —
        // 먹을 것이 뿌리에 쌓여 있어야 광식충이 산다. 한 철 내내 한 번도 뿌리혹이 서지
        // 않으면 철이 바뀔 때 값이 1 준다 (0 미만은 없다).
        //
        // **한 번이라도 찼으면 내리지 않는다** — 태어남이 뿌리혹을 잠깐 먹어 비는 것으로는
        // 줄지 않는다 (그렇지 않으면 값이 결코 자라지 못한다 · spec 기본형 ②).
        // 사슬을 끊는 길은 그래서 뿌리혹 하나가 아니라 **둥지의 균사까지**다: 균사를 캐
        // 놓으면 뿌리혹의 되돌아옴이 멎어(recovery-stalled · C013) 한 철 내내 서지 못한다
        declineWhen: [
          { kind: 'source-available', sourceId: 'ROOT_NODULE', unmetCode: LIFE_NEEDS_MATERIAL },
        ],
        // C023 ADDED — 떼가 이 방에 선다 (Play §5.3 ⑥ · V21). 관찰 결과에 실리는 것은
        // 이 코드와 지금 선 자락의 이름뿐이고, 값도 상한도 실리지 않는다
        presence: PRESENCE_ORE_EATER_SWARM,
        // 값 1 · 2 · 3 · 4 마다 하나씩 — 값만큼이 앞에서부터 서므로 값이 오를수록 넓어진다
        presenceOps: ['presence-swarm-1', 'presence-swarm-2', 'presence-swarm-3', 'presence-swarm-4'],
        // 탄생 하나가 그 방에 올리는 소란 — 타격과 같은 눈금이고 채취(10)보다 작다 (기본형 ⑤).
        // 임계 300 이므로 탄생만으로는 방이 깨어나지 않는다
        birthDisturbance: 5,
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
