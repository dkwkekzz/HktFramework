// 숲 가장자리 — depth outer. C002 에서 출구가 셋이 된다 (01-spec SPEC-003).
//
// anchor FOREST_PATH 는 남쪽 변 근처 — 백왕령이 이 숲의 South 에 있다 (WE §32).
// 두 Region 의 좌표는 서로 무관하다 — 같은 (x, z) 가 다른 자리다.
//
// C002 ADDED — 숲 안쪽으로 가는 DEEP_TRAIL(북) · 탐험대 폐허로 가는 RUIN_TRAIL(서) (01-spec SPEC-002).
//
// C007 ADDED — 이 방의 동쪽이 꺼진다. op 하나(stamp basin)뿐이고 세계의 규칙도 관찰 계약도 한 글자도
// 늘지 않는다 (C007 spec SPEC-009 · Play §5.5 "숲 가장자리 space 에 stamp(basin) 하나만 더한다").

// C016 ADDED — 이 방이 **철을 탄다** (phases). 숲 안쪽으로 나가는 출구 둘레 한 자락이 스밈에
// 한 단계 깊어지고(outer → wild) 같은 자락이 위험으로 읽히며, 그 자락에 스밈에만 나는 원천이
// 하나 선다. 땅은 한 값도 달라지지 않는다 — 덧씌움이지 재컴파일이 아니다 (T4 · T6).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { DEPTH_LAYER, HAZARD_LAYER } from './phases';
import {
  BIO_ORE,
  FOREST_CHAIN,
  FORM_MOLT_LITTER,
  FORM_SEEP_CRUST,
  ORE_EATER_MOLT,
  RECOVERY_MOLT_CYCLE,
  RECOVERY_TREE_UPTAKE,
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
      // ── C016 ADDED — 스밈에 깊어지는 자락 ─────────────────────────────────
      //
      // 자락은 **숲 안쪽으로 나가는 출구 DEEP_TRAIL(0, 18) 둘레**다. 깊이가 스미는 방향이
      // 곧 깊은 쪽이라는 것이 Concept §13 이고, 이 방에서 안쪽으로 난 끝은 그 하나뿐이다.
      // 반지름 8 은 C011 이 출구 둘레 흔적에 쓴 값 그대로다 (숲 안쪽의 trace-deep-toward-* 셋).
      //
      // **깊이와 위험이 같은 자락이다** (Concept §6 — 위험과 보상은 같은 근원에서 온다).
      // 자리를 나누면 "깊어졌다" 와 "위험하다" 가 두 곳에서 오는 두 사실이 되어 버린다.
      //
      // 이 두 area 는 **캐기 전의 붕괴 자리(C012)와 같은 성격**이다: 컴파일 결과를 한 값도
      // 바꾸지 않고(높이도 표면도 통행도 그대로) 철이 그 위에 State 를 덧씌울 뿐이다.
      // 어느 철에 무엇으로 읽히는가는 아래 phases 만이 안다.
      //
      // 태그는 둘러싼 것의 이름이다 — 붕괴 area 가 원천 이름을 다는 어법 그대로 (C012).
      {
        id: 'depth-edge-deep-trail',
        kind: 'area',
        layer: DEPTH_LAYER,
        tag: 'DEEP_TRAIL',
        shape: { kind: 'circle', center: { x: 0, z: 18 }, radius: 8 },
      },
      {
        id: 'hazard-edge-deep-trail',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'DEEP_TRAIL',
        shape: { kind: 'circle', center: { x: 0, z: 18 }, radius: 8 },
      },
      // ── C016 ADDED — 스밈에만 나는 원천 ──────────────────────────────────
      //
      // 위험이 온 철에 보상도 함께 온다 — 그래서 위 두 area 와 **같은 자락**이다.
      //
      // 자리 (4, 14) 의 근거 — 그 자락 안이고(출구에서 5.66 · 반지름 8 안쪽), C007 의 분지
      // 바깥이며(중심 (10, 0) 에서 15.23 · 반경 10 밖) 출구 anchor 와 겹치지 않는다.
      // 둘레 반지름 7 은 이 방의 다른 흔적 원과 같은 값이고, 허물의 둘레(-8, 6 · 반지름 7)와는
      // 중심 거리 14.42 라 서로 닿지 않는다 — 허물 자리의 짙기는 한 값도 달라지지 않는다.
      //
      // 흔적의 단계는 사다리 그대로다 — 이 방 바닥이 1 이고 원천 둘레가 한 단계 짙은 2 다 (C011).
      {
        id: 'trace-edge-seep-crust',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: soilStainTag(2),
        shape: { kind: 'circle', center: { x: 4, z: 14 }, radius: 7 },
      },
      {
        id: 'source-seep-crust',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'SEEP_CRUST',
        position: { x: 4, z: 14 },
      },
    ],
  },
  // 경계부의 Baseline — 먼저 온 사람이 다 가져갈 수 없는 자리를 가장 얕은 곳에 둔다 (Play §5.1 · M7)
  resourceEcology: {
    sources: [
      {
        id: 'MOLT_LITTER',
        materialId: ORE_EATER_MOLT,
        // 이 숲의 사슬 하나에서 난다 — 원천 일곱이 전부 그렇다 (C014 ADDED · §5.0)
        worldCause: FOREST_CHAIN,
        form: FORM_MOLT_LITTER,
        carrier: 'residue',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        // 탈피 주기 — 가장 안정된 공급 (C014 ADDED · A.2 회복 원인)
        recoveryCause: RECOVERY_MOLT_CYCLE,
        // 넉넉하다 — 가장 얕은 자리의 Baseline (D4). 다녀와도 남이 캘 몫이 있다
        harvests: 3,
        // 가장 얕은 자리 — 가장 빨리 되돌아온다 (C013 ADDED · D3)
        recoverySeconds: 60,
        // 마디 하나뿐인 원천 — 목록의 원소도 하나다 (C013 CHANGED · 옛 traceOp)
        traceOps: ['trace-edge-molt'],
      },
      // C016 ADDED — 스밈에만 서는 조건부 자리 하나.
      //
      // **새 재료가 아니다** — 생체 광석의 다른 형태다 (같은 Seed 의 다른 순도 · A.1).
      // 스밈에 흙이 붉어지는 철에 그 붉은 것이 가장자리까지 밀려 올라와 굳는다 —
      // 어귀의 알갱이가 물길이 실어 온 같은 것인 것과 같은 어법이다 (C014 D2 ③).
      //
      // 채취 단위와 되돌아옴의 길이는 **같은 계통의 얕은 원천**(허물)을 따른다 — 이 방은
      // 계통의 가장 얕은 자리이고, 그 자리의 값은 이미 정해져 있다 (D3 · D4).
      // 되돌아옴의 원인도 새로 짓지 않는다: 노두·뿌리혹을 되돌리는 거목의 축적 그대로이고,
      // 그 축적이 가장자리까지 밀려 올라온 것이 이 껍질이기 때문이다 (A.2).
      {
        id: 'SEEP_CRUST',
        materialId: BIO_ORE,
        // 이 숲의 사슬 하나에서 난다 — 원천 여덟이 전부 그렇다 (§5.0)
        worldCause: FOREST_CHAIN,
        form: FORM_SEEP_CRUST,
        // 지표에 굳은 것 — 땅이 지고 있다 (노두와 같은 갈래 · A.2 Carrier)
        carrier: 'terrain',
        opportunity: 'conditional',
        // 그 철이 오면 다시 선다 — 되풀이되는 조건이다 (§5.6 의 둘째)
        supply: 'conditional-renewable',
        // 거목이 삭은 흙에서 다시 빨아올린다 (A.2 회복 원인 — 노두와 같은 원인)
        recoveryCause: RECOVERY_TREE_UPTAKE,
        // 얕은 자리의 값 — 허물 그대로 (D4)
        harvests: 3,
        // 얕은 자리의 값 — 허물 그대로 (D3)
        recoverySeconds: 60,
        // 마디 하나뿐인 원천 — 자리를 옮기지 않는다 (siteCurve 없음)
        traceOps: ['trace-edge-seep-crust'],
        // **그 철에만 선다** — 다른 철에는 이 자리에 아무것도 없다 (C016 ADDED · spec R6)
        occurrence: { seasons: ['SEEP'] },
      },
    ],
  },
  /**
   * 이 방이 철을 타는 방식 (C016 ADDED · spec SPEC-001 · SPEC-002).
   *
   * 스밈 하나만 밝힌다 — 나머지 세 철에는 이 방에 달라지는 것이 없고, 그래서 고요에 온
   * 관찰자에게는 지난번 그대로의 방이다. 뒤척임(onTurn)도 밝히지 않는다: 이 방의 원천은
   * 자리를 옮기지 않고, 묻을 자국은 뒤척임이 도는 곳(생체 광석 지대)의 일이다 (기본형 ⑧).
   */
  phases: {
    seasons: {
      SEEP: {
        // 방은 outer 다. 그 자락만 한 단계 깊게 읽힌다 — 어휘 다섯의 다음 칸이다
        // (civil · outer · **wild** · deep · abyss · Concept §3.2)
        depthOverlay: [{ areaId: 'depth-edge-deep-trail', depth: 'wild' }],
        // 갈래는 어휘 일곱 안의 하나다 (content/authoring/contracts.ts 의 HAZARD_KINDS).
        // 살아 있는 것이 그 자락까지 내려오는 철이다 — 깊어지는 것과 같은 근원이다.
        // 이 폴더는 그 파일을 읽지 않으므로(경계 규칙 4) 글자로 적는다 — 흔적 태그와 같은 어법.
        hazardExtend: [{ areaId: 'hazard-edge-deep-trail', hazard: 'hazard/creature' }],
      },
    },
  },
};
