// 백왕령 — depth civil. 관찰자의 몸이 처음 놓이는 방 (C001).
//
// anchor FOREST_PATH 는 북쪽 변 근처 — WE §32 "숲의 South 가 백왕령" 이므로 숲으로 가는 길은 북쪽이다.
// 좌표는 배치 데이터다 (SPAWN_POINTS 선례).
//
// C002 ADDED — 아직 짓지 않은 곳으로 나가는 고개 둘이 동·서 변에 더해진다 (01-spec SPEC-002).
// 방 사이의 좌표는 서로 무관하므로 이 방위는 지도의 방향이 아니라 "길이 아닌 두 곳" 이라는 뜻뿐이다.
//
// C005 ADDED — 북쪽이 솟는다. op 하나(stamp ridge)뿐이고 세계의 규칙은 하나도 늘지 않는다
// (C005 spec SPEC-001 · 확정 2 "산맥은 북쪽").
//
// C006 ADDED — 땅이 막고 흐른다. op 가 일곱 늘어 방이 남북으로 갈리고(강), 건너는 자리가
// 하나 생기고(다리), 도시 곁에 표식이 서고(거목), 안전의 조건 셋과 도시가 자리를 얻는다.
// 세계의 규칙은 이동 하나(RULE-MOVE-001 의 traversable 전제)만 는다 — 나머지는 전부 데이터다
// (C006 spec SPEC-001).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  CITY_TAG,
  CONDITION_RIDGE,
  CONDITION_RIVER,
  CONDITION_TREE,
  BRIDGE_TAG,
  FEATURE_LAYER,
  LANDMARK_LAYER,
  RIVER_TAG,
  SETTLEMENT_LAYER,
} from './terrain-rules';

export const WHITE_KING_DOMAIN = 'WHITE_KING_DOMAIN';

/** 이 방의 표식 하나 — 백색 거목. 그림(sprite)은 View 의 표가 정한다 */
export const WHITE_GIANT_TREE = 'WHITE_GIANT_TREE';

export const WHITE_KING_DOMAIN_SPEC: RegionSpec = {
  id: WHITE_KING_DOMAIN,
  depth: 'civil',
  space: {
    id: WHITE_KING_DOMAIN,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 1,
    ops: [
      {
        id: 'anchor-forest-path',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FOREST_PATH',
        position: { x: 0, z: 18 },
      },
      {
        id: 'anchor-red-waste-pass',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'RED_WASTE_PASS',
        position: { x: 18, z: 0 },
      },
      {
        id: 'anchor-ice-canyon-pass',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ICE_CANYON_PASS',
        position: { x: -18, z: 0 },
      },
      // 북쪽 능선 — 이 방의 유일한 융기다. 값은 전부 배치 데이터이며(anchor 좌표와 같은 성격)
      // 고른 근거는 아래 넷이다. 컴파일해 실제로 경사를 재고 고정했다
      // (해상도 1 · 41×41 vertex 기준: 평지 75.8% · 비탈 19.2% · 급경사 5.0%).
      //
      //   ① 방을 다 덮지 않는다 — 남쪽 절반(z < 0)은 vertex 하나까지 평지다(최대 높이 0.14).
      //      올라가 볼 평지가 남아야 융기가 관찰된다.
      //   ② falloff 2 — ridge 는 감쇠 지수가 1 이면 원뿔이라 어디나 같은 경사다(태그가 하나뿐이다).
      //      2 로 두면 기울기가 가장자리 0 에서 꼭대기 54.5° 까지 이어져 세 태그가 다 생긴다:
      //      기슭이 평지 · 허리가 비탈 · 꼭대기 언저리(중심에서 5.7 안쪽)가 급경사다.
      //   ③ 북쪽 변을 따르되 서쪽으로 치우친다 — 중심을 x = 0 에 두면 숲으로 가는 문
      //      FOREST_PATH(0, 18) 이 꼭대기에 파묻혀(경사 50° 넘음) 출구로 걸어갈 수 없다.
      //      지금 자리에서 그 문은 산기슭이다 — 높이 1.7 · 경사 26°, 몸이 놓이는 (0,0) 에서
      //      문까지 곧장 걸어도 경사가 26° 를 넘지 않는다(45° 가 몸을 세우는 C006 에서도 열린 길).
      //   ④ 높이 14 — 몸 높이의 서너 배. 꼭대기가 방 안(x −13 · z 17)에 있어 올라설 수 있고,
      //      원뿔의 나머지는 북서로 잘려 나간다 — 산맥은 이 방에서 끝나지 않는다.
      {
        id: 'ridge-north',
        kind: 'stamp',
        stamp: 'ridge',
        center: { x: -13, z: 17 },
        radius: 20,
        height: 14,
        falloff: 2,
      },
      // ── C006 ADDED — 강 하나 · 다리 하나 · 거목 하나 · 자리 넷 ───────────────────────
      //
      // 강이 이 방을 동서로 가로질러 **남북을 가른다** (확정 2). 건너는 자리는 다리 하나뿐이다
      // (확정 3). 남쪽에는 몸이 놓이는 자리(0, 0)와 도시가 있고, 북쪽에는 산맥과 숲으로 가는 문이
      // 있다 — 그래서 숲으로 가려면 반드시 다리를 지난다.
      //
      // 값은 전부 배치 데이터다 (anchor 좌표 · C005 의 stamp 와 같은 성격). 컴파일해 실제로
      // 격자를 훑어 고정했고, 근거는 아래 각 op 의 주석에 적었다.
      {
        // 강 — 중심선 네 점으로 서쪽 변에서 동쪽 변까지 잇는다 (양 끝이 extent 밖이 아니라
        // 변 위여야 방을 끝까지 가른다). 살짝 굽는 것은 "곧은 선은 사람이 판 도랑처럼 보인다" 는
        // 이유뿐이고, 굽이의 폭(z 7~9)은 두 가지에 걸린다.
        //   ① 몸이 놓이는 자리 (0, 0) 와 남쪽 두 출구 RED_WASTE_PASS(18, 0) · ICE_CANYON_PASS(−18, 0)
        //      가 물에도 젖음에도 들지 않아야 한다 — 실측 중심선까지 7.92 · 8.59 · 7.22
        //      (물 4 · 젖음 6 을 둘 다 넘는다).
        //   ② 북쪽 문 FOREST_PATH(0, 18) 이 물 밖이어야 한다 — 실측 9.93.
        //
        // width 8 — 클라이언트의 한 걸음은 1.6m 앞을 요청한다 (app/main.ts KEY_LOOKAHEAD).
        //   그 다섯 배 폭이므로 어느 각도로도 한 걸음에 물을 뛰어넘지 못한다.
        // depth 1.5 — 강둑이 45° 를 넘지 않을 만큼만 판다. 막는 것은 물이지 둑이 아니다
        //   (spec SPEC-003). 반폭 4 에 깊이 1.5 이므로 둑의 기울기는 아무리 급해도 약 37°
        //   (실측: 능선에서 떨어진 구간의 최대 경사 27.8° · 물 밖 젖은 띠에 급경사 칸 0 개).
        //   더 깊이 파면 둑이 먼저 막아 "다리로만 건넌다" 가 깨진다.
        //
        // 실측 (해상도 1 · 41×41 vertex): 표면 평지 1022 · 젖음 497 · 비탈 95 · 급경사 67 칸,
        //   막힌 칸 344 (물 214 · 급경사 130). 중심선 위 높이는 파기 전 → 후로
        //   x = 0 에서 0.61 → −0.89, x = 8 에서 0.00 → −1.50 (폭 밖은 한 톨도 안 바뀐다).
        id: 'river-white-king',
        kind: 'curve',
        layer: FEATURE_LAYER,
        tag: RIVER_TAG,
        points: [
          { x: -20, z: 7 },
          { x: -7, z: 9 },
          { x: 7, z: 7 },
          { x: 20, z: 9 },
        ],
        width: 8,
        profile: 'carve',
        depth: 1.5,
      },
      {
        // 다리 — 강 위 한 자리. 중심선에서 0.15 만 벗어나 있어 통과 반경 5 가 강의 양쪽 물가를
        // 함께 덮는다. 몸이 놓이는 자리 (0, 0) 에서 동북쪽으로 8 남짓 — 곧장 북으로 걸으면
        // 물에 막히고, 물가를 따라 걸어야 찾는다 (미지감: 봉투는 다리의 자리를 알려주지 않는다).
        //
        // 실측 (1.6m 걸음 · 16방위 BFS): 몸이 놓이는 (0, 0) 에서 다리까지 8 걸음 · 강 건너
        // FOREST_PATH(0, 18) 까지 14 걸음으로 이어진다. 같은 걸음으로 남쪽 두 출구
        // RED_WASTE_PASS · ICE_CANYON_PASS · 도시 · 거목 · 능선 동쪽(−7, 17)에도 닿는다.
        // **다리 하나를 지우면 강 북쪽(z > 13)에 닿는 칸이 0 이다** — 건너는 자리는 여기뿐이다.
        id: 'bridge-river-crossing',
        kind: 'point',
        layer: FEATURE_LAYER,
        tag: BRIDGE_TAG,
        position: { x: 8, z: 7 },
      },
      {
        // 백색 거목 — 도시 곁 (확정 2). 도시 원의 동쪽 가장자리(중심에서 4)에 서므로 도시 안에서도
        // 밖에서도 보인다. 몸이 놓이는 자리 (0, 0) 에서 5 — 처음 눈에 들어오는 표식이다.
        id: 'landmark-white-giant-tree',
        kind: 'point',
        layer: LANDMARK_LAYER,
        tag: WHITE_GIANT_TREE,
        position: { x: -5, z: 0 },
      },
      // 안전의 조건 셋과 그 가운데의 도시 (Play §5.3). 셋은 자리만 정해져 있었고 모양과 크기는
      // 데이터다 (spec UNRESOLVED). 넷 다 **강 남쪽**에 둔다 — 서로 겹쳐야 "겹치면 전부" 가
      // 관찰되고(SPEC-007 경계), 물 안에 들면 설 수 없어 조건이 관찰되지 않는다.
      // 실측: 물의 남쪽 끝은 이 언저리에서 z ≈ 3.6~4.6 이므로 넷 다 그 아래로 두었다.
      {
        // 산맥이 막는다 — 능선 stamp(중심 (−13, 17) · 반경 20)의 남쪽 기슭. 원의 북쪽 끝(z = 4)이
        // 물의 남쪽 끝(x = −13 에서 z ≈ 4.4)에 닿지 않는다.
        id: 'condition-ridge-foot',
        kind: 'area',
        layer: SETTLEMENT_LAYER,
        tag: CONDITION_RIDGE,
        shape: { kind: 'circle', center: { x: -13, z: 0 }, radius: 4 },
      },
      {
        // 강이 먹인다 — 강 남쪽 물가의 띠. 북쪽 변 z = 3 은 물 밖이고 젖음 안이다
        // (실측: x = −10 에서 중심선까지 5.86 — 물 4 밖 · 젖음 6 안). 즉 이 조건은 언제나
        // 젖은 땅 위에 있다. 산기슭 원과 거목 원 둘 다와 겹친다.
        id: 'condition-river-bank',
        kind: 'area',
        layer: SETTLEMENT_LAYER,
        tag: CONDITION_RIVER,
        shape: {
          kind: 'polygon',
          points: [
            { x: -16, z: 0.5 },
            { x: -4, z: 0.5 },
            { x: -4, z: 3 },
            { x: -16, z: 3 },
          ],
        },
      },
      {
        // 거목이 물린다 — 거목 둘레. 반경 3.5 는 도시 원과 겹치되(중심 사이 4) 물까지는 닿지
        // 않는 크기다.
        id: 'condition-tree-shade',
        kind: 'area',
        layer: SETTLEMENT_LAYER,
        tag: CONDITION_TREE,
        shape: { kind: 'circle', center: { x: -5, z: 0 }, radius: 3.5 },
      },
      {
        // 사람이 사는 자리 — 조건 셋 가운데. 산기슭 원(중심 사이 4)과도 거목 원(중심 사이 4)과도
        // 겹치고 물가 띠도 지난다. 조건이 아니라 표시이므로 관찰의 safe-by 에는 실리지 않는다
        // (settlement layer 이지만 condition: 접두사가 없다).
        id: 'settlement-city',
        kind: 'area',
        layer: SETTLEMENT_LAYER,
        tag: CITY_TAG,
        shape: { kind: 'circle', center: { x: -9, z: 0 }, radius: 4 },
      },
    ],
  },
};
