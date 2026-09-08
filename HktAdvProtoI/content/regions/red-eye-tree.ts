// 붉은 눈의 거목 — depth wild. C003 에서 지어진 방이다 (C002 까지는 이름만 있던 경계).
//
// anchor 셋 — 숲 안쪽에서 다가서는 FOREST_DEEP_SIDE 는 남쪽 변, 광석 지대에서 오는 ORE_SIDE 는 동쪽 변,
// 안으로 드는 INNER_DOOR 만 변이 아니라 방 안쪽 자리다 — 길이 아니라 나무 밑동의 작은 문이기 때문이다
// (01-spec UNRESOLVED 판정 · Play §5.8).
// 방 사이의 좌표는 서로 무관하다 — 같은 tag 가 다른 방에서 다른 자리다 (C001 SPEC-001).
// 이 방에는 anchor 말고 아무 것도 없다 — 몸도 광맥도 놓이지 않는다 (01-spec SPEC-001 경계).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { WHALE_CURVE_TAG } from './presence-routes';
import {
  GROUND_TREMOR,
  LIFE_HAS_OWNER,
  LIFE_NEEDS_DECAY,
  LIFE_NEEDS_MATERIAL,
  LIFE_NEEDS_RAIN,
  LIFE_ROLE_MOLT_SUPPLY,
  LIFE_SOURCE_RAIN,
  POPULATION_DECLINE_CONDITION_LOST,
  RULE_FOREST_CLUTCH,
} from './ecology';
import { FORM_ROOT_CLUTCH, ORE_EATER } from './lives';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_ROOT_NODULE,
  GIANT_TREE_FUNGUS,
  PRESENCE_LAYER,
  RECOVERY_TREE_UPTAKE,
  RESOURCE_LAYER,
  ROOT_CURVE_TAG,
  TRACE_LAYER,
  soilStainTag,
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
        // 밝혀만 둔다 — 이 Cycle 은 BINDING 까지만 간다 (BORN 은 C023)
        transition: { from: 'DORMANT', to: 'BORN' },
        // 태어날 때 먹는 것 — 뿌리혹의 축적과 균사의 분해 진행 (실제 소비는 C023)
        consumes: ['ROOT_NODULE', 'NEST_FUNGUS'],
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
          // 태어난 뒤에 남는 것 — **밝혀만 둔다** (C023 이 그 자리를 세운다).
          // 빈 껍질과 붉은 가루다 (Play §5.3) — 아직 이 방 Description 에 그 자락이 없다
          after: ['clutch-husk', 'clutch-dust'],
        },
        ecologicalRole: LIFE_ROLE_MOLT_SUPPLY,
        population: ORE_EATER,
        // 결속의 길이 — 60 세계 초 (확정 5). 비 한 번(90 초) 안에 다 찰 수 있는 값이다
        bindingSeconds: 60,
      },
    ],
    populations: [
      {
        id: ORE_EATER,
        // 이 방이 감당하는 수 (확정 6)
        scale: 4,
        // 값이 내리는 세계 안의 원인 — 조건 결핍. 실제로 내리는 규칙은 C024 다
        declineCause: POPULATION_DECLINE_CONDITION_LOST,
      },
    ],
  },
};
