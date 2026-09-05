// 미로의 심장 — depth deep. **규칙 없는 작은 방**이다 (C009 · Play RuleBoundRoom §5.4 · 확정 5).
//
// 미로는 규칙을 품은 방이지만 이 방은 아니다 — rule 이 없으므로 Region State 도 서지 않고
// 여기서 걸어도 미로의 압력은 한 값도 오르지 않는다 (01-spec SPEC-005). 미로의 중첩 자식이지만
// 그 사실은 graph.containment 가 소유하고, 세계 규칙 중 무엇도 그 값을 읽지 않는다.
//
// 심장 호수(heart-lake.ts)의 선례를 그대로 따른다 — anchor 말고 아무 것도 없다.
// 재료도 생물도 규칙도 두지 않았다: Design 이 준 것은 "Region 과 뒤집힌 정원 쪽 문" 까지이고
// 없는 의미를 지어내지 않는다 (확정 5).
//
// extent 한 변 40 — 심장 호수와 같은 크기다. 미로(한 변 80)의 사분의 일 넓이라
// 문을 건너면 방이 **좁아진다**: 걸어도 걸어도 길이 바뀌던 곳에서 한눈에 다 보이는 곳으로
// 왔다는 것이 걸음으로 읽힌다 (Play §5.4 의 도달감).
//
// anchor 둘은 서로 마주 보는 두 변이다 (36.0 떨어져 있다 · 한 걸음 1.6m 로 23 걸음).
//   MAZE_SIDE    미로에서 들어서는 자리 — 남쪽 변. 들어오면 방 전체가 앞에 펼쳐진다
//   GARDEN_DOOR  뒤집힌 정원 쪽 — 북쪽 변. **그 너머는 아직 짓지 않은 곳이다**.
//                들어선 자리에서 곧바로 보이되 건너려면 방을 가로질러야 한다 —
//                이 Cycle 에서 그 문의 대답은 "아직 갈 수 없는 곳이다" 하나뿐이므로
//                (region-not-built) 그 걸음 자체가 이 방이 주는 물음이다.
//
// 경계 규칙 4 — 이 폴더는 engine 만 import 한다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';

export const MAZE_HEART = 'MAZE_HEART';

export const MAZE_HEART_SPEC: RegionSpec = {
  id: MAZE_HEART,
  depth: 'deep',
  space: {
    id: MAZE_HEART,
    // seed 11 — 앞의 열 방이 1~10 을 썼다. 방마다 다른 값이라야 같은 모양이 겹쳐 나지 않는다.
    seed: 11,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    ops: [
      {
        id: 'anchor-maze-side',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'MAZE_SIDE',
        position: { x: 0, z: -18 },
      },
      {
        id: 'anchor-garden-door',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'GARDEN_DOOR',
        position: { x: 0, z: 18 },
      },
    ],
  },
};
