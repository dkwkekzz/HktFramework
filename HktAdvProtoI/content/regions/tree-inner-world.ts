// 거목 내부 세계 — depth deep. C003 의 큰 방이다 (01-spec SPEC-005 · 확정 4).
//
// extent 가 한 변 80 — 다른 여덟 방(한 변 40)의 두 배이고 걸을 수 있는 넓이는 네 배다.
// 방마다 extent 가 다를 수 있음을 이 방이 처음 쓴다. 부모(붉은 눈의 거목)보다 넓지만 오류가 아니다 —
// Spatial Embedding 이 없기 때문이다 (01-spec SPEC-004 경계).
//
// anchor 둘 — 들어온 문 OUTER_DOOR 와 떨어지는 자리 FALL 이 서로 가장 먼 두 변이다.
// 그래서 "안이 밖보다 크다" 가 걸음으로 읽힌다 (01-spec UNRESOLVED 판정 · Play §5.5).
//
// C030 ADDED — 이 방이 **처음으로 무엇을 낳는다** (spec World Change 4). 흔적 셋과 원천
// 하나가 서고, 그 원천은 열을 저장하는 결정(HEAT_CRYSTAL)을 낸다. 땅은 한 값도 바뀌지
// 않는다 — 늘어난 op 넷(흔적 셋 · 원천 point 하나) 가운데 feature layer 도 profile 도 가진
// 것이 하나도 없다 (spec SPEC-001 경계 ①).
//
// 컴파일해 실제로 격자를 훑어 고정한 실측 (해상도 1 · 81×81 = 6561 vertex):
//   높이   0.00 ~ 0.00 — stamp 가 하나도 없어 이 방은 온전한 평지다
//   표면   평지 6561 (frost · wet · slope · steep 이 하나도 없다)
//   막힘   0 칸 — 어디에나 걸어 닿는다
//   hash   19ac72ff (두 번 컴파일해도 같다 · C003 의 51bcb80b 에서 op 넷이 늘어 바뀐 값이고,
//          위의 높이 · 표면 · 통행 격자 셋은 한 값도 그대로다)
//
// 걸음 실측 (1.6m 걸음 · 16방위 BFS — app/main.ts KEY_LOOKAHEAD · 다른 방들과 같은 자):
//   들어온 문 OUTER_DOOR(0, −38) → 원천 CORE_EMBER(−34, 20)  **42 걸음** (사이 67.2)
//   떨어지는 자리 FALL(0, 38) → 원천                          **24 걸음** (사이 38.5)
//   원천과 떨어지는 자리의 사이 38.5 — 걸어가다 떨어지지 않는다 (spec 기본형 ②, 그 어림값 39)
//
// 온기의 흔적이 **단조롭게 짙어지는지** 실측했다 (문에서 원천까지 곧은 선 위 열한 자리 ·
// traceStrengthAt · 원천이 available 일 때):
//   t        0.0    0.1    0.2    0.3    0.4    0.5    0.6   0.7   0.8   0.9   1.0
//   (x, z) 0,−38 −3,−32 −7,−26 −10,−21 −14,−15 −17,−9 −20,−3 −24,3 −27,8 −31,14 −34,20
//   단계     1      1      1      1      1      1      1     2     2     2     3
//   한 번도 내려가지 않는다 — 문 쪽이 가장 옅고 벽의 한 자리가 가장 짙다 (spec SPEC-002).
//   1 → 2 는 z = 0 을 건너는 자리에서(t ≈ 0.66) · 2 → 3 은 둘레(반지름 6)에 드는 자리에서
//   (t ≈ 0.91) 오른다. 캐서 고갈되면 둘레만 3 → 2 로 한 단계 옅어지고 나머지는 그대로다
//   (실측: 고갈 뒤 원천 자리가 2).

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import {
  EMBER_COOLED,
  FOREST_CHAIN,
  FORM_WALL_EMBER,
  HEAT_CRYSTAL,
  RECOVERY_TREE_UPTAKE,
  RESOURCE_LAYER,
  TRACE_LAYER,
  emberWarmthTag,
} from './resource-ecology';

export const TREE_INNER_WORLD = 'TREE_INNER_WORLD';

export const TREE_INNER_WORLD_SPEC: RegionSpec = {
  id: TREE_INNER_WORLD,
  depth: 'deep',
  space: {
    id: TREE_INNER_WORLD,
    extent: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 },
    seed: 8,
    ops: [
      {
        id: 'anchor-outer-door',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'OUTER_DOOR',
        position: { x: 0, z: -38 },
      },
      {
        id: 'anchor-fall',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FALL',
        position: { x: 0, z: 38 },
      },
      // ── C030 ADDED — 흔적 셋과 원천 하나 (spec SPEC-001 · SPEC-002) ────────
      //
      // 흔적은 **거목 속의 어휘**다 (emberWarmthTag) — 이 방에는 흙 사다리 area 도 협곡의
      // 숨 사다리 area 도 **하나도 없다** (spec SPEC-002 경계 ①). 사다리는 셋이고, 방
      // 바닥 1 · 원천 쪽 절반 2 · 원천 둘레 3 이다 — 원천 둘레가 방 바닥보다 한 단계 짙은
      // 것은 C011 이 세운 그대로이고, 그 사이에 **절반** 하나가 더 든 것이 이 방의 것이다:
      // 방 하나가 한 변 80 이라 바닥에서 곧바로 둘레로 뛰면 사다리가 방향이 되지 못한다.
      //
      // **ops 의 차례는 옅은 것부터**다 (바닥 → 절반 → 둘레) — 세기를 정하는 것은 가장
      // 큰 단계이지 차례가 아니지만(traceStrengthAt 은 합하지도 덮어쓰지도 않는다), 겹친
      // 자리를 그리는 쪽은 뒤엣것을 위에 둔다. 다른 방들이 바닥을 먼저 적고 둘레를 뒤에
      // 적은 그 차례 그대로다 (붉은 눈의 거목 · 포식수 둥지 · 빙결 협곡).
      {
        id: 'trace-inner-floor',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: emberWarmthTag(1),
        shape: {
          kind: 'polygon',
          points: [
            { x: -40, z: -40 },
            { x: 40, z: -40 },
            { x: 40, z: 40 },
            { x: -40, z: 40 },
          ],
        },
      },
      // 원천 쪽 **절반** — 들어온 문(0, −38)과 원천(−34, 20)을 가르는 자리가 z = 0 이다.
      // 문은 z = −38 로 이 절반 밖이고 원천은 z = 20 으로 안이다. 남북으로 가른 이유는
      // 문과 원천이 남북으로 58 · 동서로 34 벌어져 있어 **남북이 더 긴 축**이기 때문이다 —
      // 짧은 축으로 가르면 방을 가로지르는 동안 단계가 오르지 않는 구간이 길어진다.
      {
        id: 'trace-inner-warm-half',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: emberWarmthTag(2),
        shape: {
          kind: 'polygon',
          points: [
            { x: -40, z: 0 },
            { x: 40, z: 0 },
            { x: 40, z: 40 },
            { x: -40, z: 40 },
          ],
        },
      },
      // 원천 둘레 — 반지름 6 은 배치 데이터다: 중심이 서쪽 경계에서 6 떨어져 있으므로
      // (−34 − 6 = −40) 이 원이 extent 안에 **온전히 드는 가장 큰 값**이고, 그 원 전체가
      // 원천 쪽 절반(z ≥ 0) 안에도 온전히 든다 (20 − 6 = 14). 다른 방들의 둘레(반지름 7 ·
      // 4.5)와 값이 다른 이유는 그것뿐이다 — 기제는 한 줄도 다르지 않다.
      {
        id: 'trace-core-ember',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: emberWarmthTag(3),
        shape: { kind: 'circle', center: { x: -34, z: 20 }, radius: 6 },
      },
      // 자리 (−34, 20) — 서쪽 **경계**를 벽으로 읽고, 들어온 문에서 먼 절반에 두어 흔적이
      // 길잡이가 되게 했다 (spec 기본형 ②). 떨어지는 자리(0, 38)에서 38.5 떨어져 있어
      // 걸어가다 떨어지지 않는다. 이 방은 온전한 평지라 이 자리도 걸어 닿는다 (위 실측).
      {
        id: 'source-core-ember',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'CORE_EMBER',
        position: { x: -34, z: 20 },
      },
    ],
  },
  // 거목의 **속**에서 열이 모여 굳은 자리 하나 (C030 ADDED · spec SPEC-001).
  //
  // 이 방이 낳는 것은 이것 하나이고, 이 재료를 내는 원천도 이 세계에 이것 하나다
  // (spec SPEC-001 경계 ②). 숲의 사슬에 매달리되 사슬의 **가장 위**다: 거목균이 사체를
  // 삭이고 거목이 그것을 빨아올려 속에 쌓는 그 끝이 여기다 (Play §5.3 · A.2).
  resourceEcology: {
    sources: [
      {
        id: 'CORE_EMBER',
        materialId: HEAT_CRYSTAL,
        // 이 숲의 사슬 하나에서 난다 — 뿌리혹 · 균사와 같은 원인이다 (§5.0)
        worldCause: FOREST_CHAIN,
        form: FORM_WALL_EMBER,
        // 거목이 지고 있다 — 살아 있는 것이 아니라 **식물**이다 (Carrier CREATURE 는 3층)
        carrier: 'plant',
        // 이 방의 위험은 이미 있는 추락이다 — 이 Cycle 은 위험을 새로 두지 않았다
        // (RegionGraphRooms §5.5 · spec 기본형 ⑥). 검사 ⑲ 는 자리 유형의 분포만 센다
        opportunity: 'risk',
        // 거목의 축적이 있어야 다시 굳는다 — 그 축적은 거목균에 매달린다 (§5.6)
        supply: 'conditional-renewable',
        // 거목이 삭은 흙에서 다시 빨아올린다 — 뿌리혹과 **같은 원인**이다 (A.2 회복 원인)
        recoveryCause: RECOVERY_TREE_UPTAKE,
        // 벽의 잉걸 하나 = 한 번 (Play §5.3 채취 단위 1 — 뿌리혹 · 균사와 같은 어법)
        harvests: 1,
        // C030 ADDED — **사슬이 방 셋을 건넌다** (spec SPEC-004). 포식수 둥지의 균사를
        // 캐 놓으면 이 자리의 되돌아옴이 멎고(recovery-stalled), 그것은 붉은 눈의 거목의
        // 뿌리혹이 같은 것에 매달린 것과 **같은 자리**다: 거목의 축적이 삭은 흙에서 오기
        // 때문이고, 그래서 원인을 새로 짓지 않았다
        dependsOn: 'NEST_FUNGUS',
        // 깊은 방의 원천 — 이 세계의 값 둘(얕은 것 60 · 깊은 것 180) 가운데 깊은 것이다
        // (spec 기본형 ③)
        recoverySeconds: 180,
        // 마디 하나뿐인 원천 — 자리를 옮기지 않는다 (siteCurve 없음). 그래서 옅어지는
        // 둘레도 하나다
        traceOps: ['trace-core-ember'],
        // C030 ADDED — 고갈된 동안 이 자리가 지는 말 (spec R3 · SPEC-003).
        // **자리를 막지 않는다** — `collapses` 를 밝히지 않았으므로 캔 뒤에도 이 방의 땅도
        // 통행도 한 값 바뀌지 않는다 (경계 ③). 벽의 잉걸은 무너지는 것이 아니라 식는다
        depletedCode: EMBER_COOLED,
      },
    ],
  },
};
