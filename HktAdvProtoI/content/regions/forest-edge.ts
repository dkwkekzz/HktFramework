// 숲 가장자리 — depth outer. C002 에서 출구가 셋이 된다 (01-spec SPEC-003).
//
// anchor FOREST_PATH 는 남쪽 변 근처 — 백왕령이 이 숲의 South 에 있다 (WE §32).
// 두 Region 의 좌표는 서로 무관하다 — 같은 (x, z) 가 다른 자리다.
//
// C002 ADDED — 숲 안쪽으로 가는 DEEP_TRAIL(북) · 탐험대 폐허로 가는 RUIN_TRAIL(서) (01-spec SPEC-002).
//
// C007 ADDED — 이 방의 동쪽이 꺼진다. op 하나(stamp basin)뿐이고 세계의 규칙도 관찰 계약도 한 글자도
// 늘지 않는다 (C007 spec SPEC-009 · Play §5.5 "숲 가장자리 space 에 stamp(basin) 하나만 더한다").

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  FORM_MOLT_LITTER,
  ORE_EATER_MOLT,
  RESOURCE_LAYER,
  TRACE_LAYER,
  soilStainTag,
} from './resource-ecology';

export const FOREST_EDGE = 'FOREST_EDGE';

export const FOREST_EDGE_SPEC: RegionSpec = {
  id: FOREST_EDGE,
  depth: 'outer',
  space: {
    id: FOREST_EDGE,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 2,
    ops: [
      {
        id: 'anchor-forest-path',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FOREST_PATH',
        position: { x: 0, z: -18 },
      },
      {
        id: 'anchor-deep-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'DEEP_TRAIL',
        position: { x: 0, z: 18 },
      },
      {
        id: 'anchor-ruin-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'RUIN_TRAIL',
        position: { x: -18, z: 0 },
      },
      // ── C007 ADDED — 분지 하나 ────────────────────────────────────────────────
      //
      // 값(중심 · 반경 · 깊이 · falloff)은 전부 배치 데이터다 (C005 의 능선 · C006 의 강과 같은
      // 성격). 컴파일해 실제로 격자를 훑어 고정했다 — 해상도 1 · 41×41 vertex 기준 실측:
      //   표면   평지 1386 · 비탈 127 · 급경사 168 칸
      //   막힘   168 칸 (전부 too-steep — 이 방에는 물이 없다)
      //   높이   −9.00 ~ 0.00 · 최대 경사 53.8° · 급경사 띠는 중심에서 3.16 ~ 8.00
      //   hash   4388b995 → 50600236 (두 번 컴파일해도 같은 값이다)
      //
      // 고른 근거 넷:
      //   ① 중심 (10, 0) — 방 한가운데가 아니다. falloff 2 의 분지는 급경사가 **닫힌 고리**로
      //      둘러서므로 중심을 (0, 0) 에 두면 그 안에 놓인 몸이 갇힌다 (실측: 반경 12 · 깊이 10 을
      //      (0, 0) 에 두면 밖에서 걸어 들어갈 수 있는 가장 안쪽이 중심에서 8.75 이고 바닥에
      //      닿는 걸음이 하나도 없다). (0, 0) 은 SPAWN_POINTS[0] — 검증과 촬영이 이 방에 몸을
      //      놓는 자리이므로(vite.config.ts HKT_SPAWN_REGION) 분지 밖에 남겨야 한다.
      //      지금 자리에서 (0, 0) 은 서쪽 가장자리의 평지다 (높이 0.00 · 경사 9°).
      //   ② 반경 10 — 중심이 (10, 0) 이므로 동쪽 변 x = 20 에서 정확히 0 으로 잦아든다. 분지가
      //      방 안에 온전히 담겨 변에 잘린 절벽이 서지 않고, 방의 동쪽 절반을 차지한다.
      //      출구 셋은 전부 반경 밖이다 — FOREST_PATH · DEEP_TRAIL 까지 20.6 · RUIN_TRAIL 까지 28.0.
      //   ③ 깊이 9 — falloff 2 의 최대 기울기는 1.54 × 깊이 / 반경 이므로 45° 를 넘으려면
      //      깊이/반경 > 0.65 여야 한다. 0.9 로 두어 실측 최대 53.8° 다. 임계에 붙여 두면
      //      (깊이 8 은 최대 45.4° · 급경사 56 칸) 고리가 끊겨 바닥까지 걸어 들어가진다.
      //      그러면 C006 의 임계(45°)가 이 방에서 몸을 세우는 것을 볼 수 없다 (SPEC-010).
      //   ④ falloff 2 — C005 의 능선 · C006 의 강 단면과 같은 족(族)이다. 바닥과 가장자리 둘 다
      //      기울기가 0 이라 "가운데가 파이고 가장자리로 갈수록 완만" 이 데이터로 성립한다.
      //      중심에서 서쪽으로 잰 단면(거리: 높이 · 경사 · 표면):
      //      0: −9.00 · 0° 평지 | 3: −7.45 · 44° 비탈 | 4~8: 급경사(막힌다) |
      //      9: −0.32 · 30° 비탈 | 10: 0.00 · 9° 평지
      //
      // 방을 가로지르는 길은 그대로다 (1.6m 걸음 · 16방위 BFS — app/main.ts KEY_LOOKAHEAD).
      // 출구 셋과 몸이 놓이는 (0, 0) 이 전부 통행 가능하고 서로 이어진다: (0, 0) → 출구 셋이
      // 각각 12 걸음 · FOREST_PATH ↔ DEEP_TRAIL 24 걸음 · 나머지 두 짝이 16 걸음으로,
      // **분지를 놓기 전(평평하던 방)과 걸음 수가 같다** — 분지는 길을 한 걸음도 돌리지 않는다.
      // 반대로 분지 안쪽은 닫힌다: 걸어 들어갈 수 있는 가장 안쪽이 중심에서 7.53 이고 바닥
      // (10, 0) 에는 걸음이 닿지 않는다 — 급경사 고리가 끊긴 데 없이 둘러섰다는 뜻이다.
      {
        id: 'basin-forest-hollow',
        kind: 'stamp',
        stamp: 'basin',
        center: { x: 10, z: 0 },
        radius: 10,
        height: 9,
        falloff: 2,
      },
      // ── C011 ADDED — 흔적과 원천 ──────────────────────────────────────────
      //
      // 이 방은 계통의 **가장 얕은 자리**다 (A.3 경계부). 흙 색이 방 전체에 옅게 깔리고,
      // 서쪽 나무 밑동 그늘에 허물이 모인 자리 둘레만 한 단계 짙다 — 그 한 단계가 방향이다.
      // 광식충이 뿌리 곁에서 먹기 때문에 그늘에 모인다 (D2 광식충 허물 ③).
      //
      // 자리 (-8, 6) 의 근거 — 동쪽 절반은 C007 의 분지다(중심 (10, 0) · 반경 10). 그 급경사
      // 고리 안은 걸어 들어갈 수 없으므로 원천을 거기 두면 닿지 못한다. 서쪽 평지에 두되
      // 출구 셋(0,-18 · 0,18 · -18,0)과 몸이 놓이는 (0, 0) 어느 쪽에서도 걸어 닿는 자리다.
      {
        id: 'trace-edge-base',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(1),
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
        id: 'trace-edge-molt',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
        shape: { kind: 'circle', center: { x: -8, z: 6 }, radius: 7 },
      },
      {
        id: 'source-molt-litter',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'MOLT_LITTER',
        position: { x: -8, z: 6 },
      },
    ],
  },
  // 경계부의 Baseline — 먼저 온 사람이 다 가져갈 수 없는 자리를 가장 얕은 곳에 둔다 (Play §5.1 · M7)
  resourceEcology: {
    sources: [
      {
        id: 'MOLT_LITTER',
        materialId: ORE_EATER_MOLT,
        form: FORM_MOLT_LITTER,
        carrier: 'residue',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        // 넉넉하다 — 가장 얕은 자리의 Baseline (D4). 다녀와도 남이 캘 몫이 있다
        harvests: 3,
        // 가장 얕은 자리 — 가장 빨리 되돌아온다 (C013 ADDED · D3)
        recoverySeconds: 60,
        // 마디 하나뿐인 원천 — 목록의 원소도 하나다 (C013 CHANGED · 옛 traceOp)
        traceOps: ['trace-edge-molt'],
      },
    ],
  },
};
