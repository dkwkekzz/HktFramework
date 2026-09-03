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

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const WHITE_KING_DOMAIN = 'WHITE_KING_DOMAIN';

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
    ],
  },
};
