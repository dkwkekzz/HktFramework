// 얼음 협곡 — depth outer. 백왕령 서쪽 고개 너머 **첫 방** (C019 ADDED · 확정 1).
//
// ICE_CANYON 은 C002 부터 graph.ts 의 **경계 이름**이었다 — 고개가 가리키되 방이 없는 곳.
// 이제 지어졌으므로 이름의 주인이 이 파일이고 경계 목록에서 빠진다 (RED_EYE_TREE ·
// FANTASY_MAZE 의 선례 · spec SPEC-002 경계 ②).
//
// 이 방의 문법은 숲과 하나도 겹치지 않는다. 바닥이 흙이 아니라 **서리**이고, 위험이 나를
// 노리는 것(hazard/creature)이 아니라 **땅 자체**(hazard/terrain)다. 그리고 그 위험은 철도
// 소란도 지나가는 것도 걸지 않는다 — **늘 서 있다** (phases.standing · spec R1).
// 절벽은 무너지지 않으므로 걸리는 데 원인이 필요 없다.
//
// 땅의 모양은 전부 배치 데이터다 (Design 은 "얼음 절벽" 이라고만 한다 · spec 기본형 ①).
// 백왕령의 능선(C005) · 숲 가장자리의 분지(C007)와 같은 성격이고, 컴파일해 실제로 격자를
// 훑어 고정했다 — 해상도 1 · 41×41 vertex 기준 실측:
//   표면   서리 697 · 비탈 164 · 급경사 810 · 평지 10
//   막힘   810 칸 (전부 too-steep — 이 방에는 물이 없다)
//   높이   0.00 ~ 20.00 · 골 바닥(|x| ≤ 4)은 vertex 하나까지 정확히 0
//   hash   c3aaed18 (두 번 컴파일해도 같은 값이다 · C020 에서 d1ff52bf 에서 바뀌었다 —
//          op 가 셋 늘었기 때문이고, 높이 · 표면 · 통행 격자는 위의 넷이 그대로다)
// 평지 10 은 **벽 꼭대기**다 — stamp 여섯의 중심 (±18, −14 · 0 · 14)과 두 원이 맞닿는
// (±18, ±7). 원뿔의 꼭짓점이라 그 한 점만 기울기가 0 이고, 걸어 올라갈 수는 없다.
//
// 방을 가로지르는 길 (1.6m 걸음 · 16방위 BFS — app/main.ts KEY_LOOKAHEAD):
// 들어온 자리 WHITE_KING_SIDE(0, −18) 에서 나가는 자리 FROST_CANYON_TRAIL(0, 18) 까지
// **23 걸음**으로 이어진다 (spec SPEC-004 경계). 둘 다 골 바닥의 서리 위이고 통행 가능하다.
// 반대로 벽은 닫힌다 — 걸어 닿는 가장 바깥이 |x| = 11.5(남북 변 언저리의 완만한 자락)이고
// 방 한가운데 줄에서는 |x| = 8 이 마지막이다.
//
// C020 ADDED — 이 방이 **재료를 낳는 방**이 된다 (원천 하나 · 흔적 둘). 실측:
//   원천     PASS_RIME (8, −16) — 통행 가능 · 표면 frost · 들어온 자리에서 **6 걸음**
//   흔적     방 바닥 frost-breath:1 이 vertex 1681(격자 전부) · 원천 둘레 frost-breath:2 가 49
//            (반지름 4) — 둘레가 방 바닥보다 정확히 한 단계 짙고 둘레끼리 겹칠 것이 없다
//   자락     절벽 자락 둘은 한 값도 달라지지 않는다 (덮는 533 · 걸을 수 있는 128 · 걸어 닿는 79)
// 표면 · 막힘 · 높이는 위의 값 그대로다 — 늘어난 op 셋(흔적 둘 · 원천 point 하나)은
// feature layer 가 아니고 profile 도 없어 컴파일된 땅을 한 값도 건드리지 않는다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import { HAZARD_LAYER } from './phases';
import { FEATURE_LAYER, FROST_TAG } from './terrain-rules';
import {
  CRYSTAL_GROWTH,
  FORM_RIME,
  FROST_CRYSTAL,
  RECOVERY_NIGHT_RIME,
  RESOURCE_LAYER,
  TRACE_LAYER,
  frostBreathTag,
} from './resource-ecology';

export const ICE_CANYON = 'ICE_CANYON';

export const ICE_CANYON_SPEC: RegionSpec = {
  id: ICE_CANYON,
  depth: 'outer',
  space: {
    id: ICE_CANYON,
    extent: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    seed: 12,
    ops: [
      // 드나드는 곳 둘 — 남쪽이 고개(백왕령 쪽), 북쪽이 협곡 안쪽으로 드는 오솔길이다.
      // 둘 다 골 바닥 한가운데 x = 0 에 둔다: 골이 남북으로 뚫려 있어야 들어온 자리에서
      // 나가는 자리까지 걸어서 이어진다. 두 Region 의 좌표는 서로 무관하므로 이 방위는
      // 지도의 방향이 아니라 "골의 양 끝" 이라는 뜻뿐이다 (C001 부터의 규약).
      {
        id: 'anchor-white-king-side',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'WHITE_KING_SIDE',
        position: { x: 0, z: -18 },
      },
      {
        id: 'anchor-frost-canyon-trail',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'FROST_CANYON_TRAIL',
        position: { x: 0, z: 18 },
      },
      // ── 얼음 절벽 — ridge stamp 여섯 (양옆 벽) ──────────────────────────────
      //
      // 벽 하나를 큰 stamp 하나로 세우지 않고 셋으로 나눈 이유는 하나다: ridge 는 원뿔이라
      // 하나로는 방의 남북 끝이 잘려 벽이 끊긴다. 셋을 z = −14 · 0 · 14 에 반경 14 로 겹쳐
      // 놓으면 이웃한 원이 서로의 중심을 지나 맞닿아, 남북 변까지 끊긴 데 없이 이어진다
      // (실측: 벽 쪽 급경사 810 칸이 x = ±9 부터 변까지 한 줄도 비지 않는다).
      //
      // 중심이 x = ±18 이고 반경이 14 이므로 **골 바닥 |x| ≤ 4 는 stamp 반경 밖**이다 —
      // t ≥ 1 인 vertex 는 한 톨도 건드리지 않으므로 어디서나 높이가 정확히 0 인 평지이고,
      // 그래서 이 방의 골은 어느 자리에서도 걸어 다닐 수 있다 (실측: |x| ≤ 4 에서 높이 ≠ 0
      // 인 vertex 0 개).
      //
      // falloff 2 — 능선(C005) · 분지(C007)와 같은 족(族)이다. 가장자리 기울기가 0 이라
      // 골 쪽으로 평지 → 비탈 → 급경사가 차례로 서고 태그가 다 생긴다.
      // height 20 — 급경사가 **골에 닿기 전에** 서게 하는 높이다. ridge falloff 2 의 기울기는
      //   2·h/r·(1 − d/r) 이므로 45° (기울기 1) 가 서는 자리는 중심에서 d = r·(1 − r/(2h))
      //   = 14·(1 − 14/40) = 9.1 이고, 벽 중심 x = ∓18 에서 그만큼이면 x = ∓8.9 다.
      //   실측 격자에서는 급경사(막힘)가 |x| = 9 에서 시작하고 |x| = 8 이 마지막 비탈이다 —
      //   서리(FROST_SURFACE_DISTANCE 8)가 딱 그 마지막 줄까지만 깔린다.
      { id: 'cliff-west-south', kind: 'stamp', stamp: 'ridge', center: { x: -18, z: -14 }, radius: 14, height: 20, falloff: 2 },
      { id: 'cliff-west-mid', kind: 'stamp', stamp: 'ridge', center: { x: -18, z: 0 }, radius: 14, height: 20, falloff: 2 },
      { id: 'cliff-west-north', kind: 'stamp', stamp: 'ridge', center: { x: -18, z: 14 }, radius: 14, height: 20, falloff: 2 },
      { id: 'cliff-east-south', kind: 'stamp', stamp: 'ridge', center: { x: 18, z: -14 }, radius: 14, height: 20, falloff: 2 },
      { id: 'cliff-east-mid', kind: 'stamp', stamp: 'ridge', center: { x: 18, z: 0 }, radius: 14, height: 20, falloff: 2 },
      { id: 'cliff-east-north', kind: 'stamp', stamp: 'ridge', center: { x: 18, z: 14 }, radius: 14, height: 20, falloff: 2 },
      // ── 서리 선 — 골 바닥을 남북으로 따르는 표시선 ────────────────────────
      //
      // **높이를 건드리지 않는다** (profile 을 두지 않는다 · C018 whale-curve 의 선례).
      // 서리는 땅의 모양이 아니라 그 위에 앉은 것이므로 파지도 솟지도 않는다 — 이 선이 하는
      // 일은 표면 규칙의 첫 줄(SURFACE_FROST)에게 "어디서부터" 를 주는 것 하나뿐이고, 높이도
      // 통행 격자도 hash 도 이 선이 있든 없든 같다.
      //
      // 점 넷은 남쪽 변에서 북쪽 변까지 x = 0 을 곧게 잇는다 (양 끝이 변 위여야 골이 끝까지
      // 언다). 가운데 두 점은 굽지 않되 두는데, 이 선의 자리가 곧 서리의 자리이므로 나중에
      // 골을 굽히면 서리도 함께 굽어야 하기 때문이다 — 굽힐 마디를 미리 둔 것뿐이다.
      //
      // width 2 는 작게 둔다 — 서리가 깔리는 폭을 정하는 것은 이 값이 아니라
      // FROST_SURFACE_DISTANCE(8)다. 파지 않는 선에서 width 는 아무 일도 하지 않는다.
      //
      // 실측: 서리가 붙는 가장 바깥이 |x| = 8 이고 **급경사 vertex 는 한 칸도 서리가 아니다**
      // (골 바닥과 그 비탈만 언다 · spec 기본형 ③).
      {
        id: 'frost-canyon-floor',
        kind: 'curve',
        layer: FEATURE_LAYER,
        tag: FROST_TAG,
        points: [
          { x: 0, z: -20 },
          { x: 0, z: -7 },
          { x: 0, z: 7 },
          { x: 0, z: 20 },
        ],
        width: 2,
      },
      // ── C020 ADDED — 흔적과 원천 하나 (spec SPEC-001 · SPEC-002 · 기본형 ① ②) ──
      //
      // 협곡의 흔적은 흙이 아니라 **숨이 어는 정도**다 (frostBreathTag) — 숲의 흙 사다리와
      // 같은 기제이고 태그만 다르다. 이 방에는 흙 사다리 area 가 **하나도 없다**:
      // 두 어휘가 한 자리에서 섞이지 않는다 (spec SPEC-002 경계 ②).
      //
      // 고개 너머 첫 방이므로 바닥이 가장 옅다 (1) — 그 안쪽 빙결 협곡이 2 이고, 원천
      // 둘레는 방 바닥보다 한 단계 짙다 (2). 방 바닥의 사각형은 extent 를 그대로 덮는다
      // (생체 광석 지대의 trace-ore-base 가 그런 그대로).
      {
        id: 'trace-canyon-base',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: frostBreathTag(1),
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
      // 고개의 서리 — 백왕령 쪽 anchor (0, −18) **곁**이면서 **절벽 자락 안**이다
      // (Design 은 "anchor 곁" 까지만 말한다 · 기본형 ①).
      //
      // 처음에는 골 한가운데 (3, −14) 에 두었다가 벽 쪽으로 옮겼다. 이유는 하나다 —
      // **위험을 만든 것이 곧 재료다** (Concept §6)가 이 방에서도 데이터로 참이어야 한다:
      // 이 방의 위험은 얼음 절벽 하나뿐이고, 원천이 그 자락에 닿지 않으면 검사 ①
      // (자원과 위험이 같은 근원인가)이 이 방에서 끊긴 것으로 읽는다. 서리는 골 한가운데
      // 허공에 끼는 것이 아니라 벽에 앉는 것이므로 세계 사실로도 이쪽이 옳다.
      //
      // 자리 (8, −16) — anchor 에서 8.25 이고, 걸을 수 있는 마지막 줄(|x| = 8)이자 절벽
      // 자락(|x| ≥ 8)의 변 위다 (변 위는 안으로 친다 · engine 의 areaCoversPoint). 들어온
      // 자리에서 6 걸음이라 고개를 넘자마자 벽을 따라가면 만난다.
      //
      // 둘레 반지름 4 는 배치 데이터다 — 남쪽 변에서 4 밖에 안 떨어져 있으므로 그보다 크면
      // 흔적 원이 extent(−20..20) 밖으로 나간다 (생체 광석 지대가 마디 넷에 건 그 조건).
      {
        id: 'trace-pass-rime',
        kind: 'area',
        layer: TRACE_LAYER,
        tag: frostBreathTag(2),
        shape: { kind: 'circle', center: { x: 8, z: -16 }, radius: 4 },
      },
      {
        id: 'source-pass-rime',
        kind: 'point',
        layer: RESOURCE_LAYER,
        tag: 'PASS_RIME',
        position: { x: 8, z: -16 },
      },
      // ── 절벽 자락 둘 — 늘 서 있는 위험 (아래 phases.standing) ──────────────
      //
      // 자락의 자리와 크기는 Design 에 없다 (spec 기본형 ②) — **실측한 급경사 띠**로 정했다.
      // 급경사는 |x| = 9 에서 서므로 자락의 안쪽 변을 |x| = 8 에 둔다. 한 칸을 더 먹는 이유는
      // 하나다: 급경사는 **설 수 없는 자리**라 자락이 그것만 덮으면 그 코드가 영영 읽히지
      // 않는다. 벽 바로 앞의 마지막 걸을 수 있는 줄까지 덮어야 "절벽 앞에 섰다" 가 발밑을
      // 말하는 판에 뜬다 (걸린 것은 서야 참이다 · spec R3 비고).
      //
      // 실측 (한 자락당): 덮는 vertex 중 막힌 것 405 · 걸을 수 있는 것 128 이고, 걸어 닿으면서
      // 자락 안인 자리가 979(서) · 972(동)다 — 벽을 따라 걷는 내내 그 코드가 실린다.
      //
      // 남북 변까지 곧게 자른 사각형이다 — 벽이 방의 남북 끝까지 이어지므로 자락도 그렇다.
      // tag 는 둘러싼 것의 이름이다 (붕괴 area 가 원천 이름을 다는 어법 그대로 · C012).
      // 규칙은 이 글자를 읽지 않는다 — 위상이 가리키는 것은 op id 다.
      {
        id: 'hazard-ice-cliff-west',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'ICE_CLIFF',
        shape: {
          kind: 'polygon',
          points: [
            { x: -20, z: -20 },
            { x: -8, z: -20 },
            { x: -8, z: 20 },
            { x: -20, z: 20 },
          ],
        },
      },
      {
        id: 'hazard-ice-cliff-east',
        kind: 'area',
        layer: HAZARD_LAYER,
        tag: 'ICE_CLIFF',
        shape: {
          kind: 'polygon',
          points: [
            { x: 8, z: -20 },
            { x: 20, z: -20 },
            { x: 20, z: 20 },
            { x: 8, z: 20 },
          ],
        },
      },
    ],
  },
  /**
   * 이 방이 낳는 것 — 원천 하나 (C020 ADDED · spec SPEC-001 · SPEC-009).
   *
   * 고개의 서리 하나뿐이다. 고개 너머 첫 방이므로 가장 얕은 자리이고, 그래서 맡은 자리가
   * **Baseline** 이다 — 먼저 온 사람이 다 가져갈 수 없는 자리를 가장 얕은 곳에 둔다
   * (숲 가장자리의 허물이 세운 그 어법 · Play §5.1 · M7).
   *
   * 붙잡는 것이 **현상**인 이유 — 서리는 몸도 생명도 땅도 아니고 밤이 지나가며 두고 가는
   * 것이다 (C018 이 떨어진 비늘에 쓴 그 칸). 그래서 되돌아옴의 원인도 시간이 아니라
   * **밤마다 다시 낀다** 이고, 그 밤이 하루마다 오므로 되돌아옴이 하루(360 초)다.
   */
  resourceEcology: {
    sources: [
      {
        id: 'PASS_RIME',
        materialId: FROST_CRYSTAL,
        // 숲의 사슬도 하늘의 지나감도 아닌 셋째 — 결정이 자라며 열을 먹는다 (확정 2)
        worldCause: CRYSTAL_GROWTH,
        form: FORM_RIME,
        carrier: 'phenomenon',
        opportunity: 'baseline',
        supply: 'baseline-renewable',
        // 밤마다 다시 낀다 (A.2 회복 원인)
        recoveryCause: RECOVERY_NIGHT_RIME,
        // Baseline — 넉넉하다. 다녀와도 남이 캘 몫이 있다 (D4 · 허물 셋의 선례)
        harvests: 3,
        // 하루 = 360 세계 초 (C015 의 시계 · spec 데이터 값 표) — 되돌리는 것이 밤이므로
        // 길이도 하루다. 밤을 한 번 보내면 다시 낀다
        recoverySeconds: 360,
        // 마디 하나뿐인 원천 — 자리를 옮기지 않는다 (siteCurve 없음)
        traceOps: ['trace-pass-rime'],
      },
    ],
    // C020 ADDED (spec SPEC-009) — **밖에서 아무것도 받지 않는다.** 원천이 서 있어도
    // 밝힌다: 검사 ㉒ 가 묻는 자리는 아니지만, "협곡이 요구하는 것이 협곡에 없다" 가
    // 결손이 아니라 밝혀진 사실이려면 이 계통이 무엇으로 닫혀 있는지가 데이터에 있어야 한다.
    isolationReason:
      '얼음 절벽이 양옆을 막고 고개 하나로만 이어진다 — 이 방이 내는 것은 여기서 자란 것뿐이고 실려 오는 것이 없다',
  },
  /**
   * 이 방이 **늘** 서 있는 위상 (C019 ADDED · spec R1 · SPEC-005).
   *
   * seasons 도 awake 도 밝히지 않는다 — 이 방은 철을 타지 않고 깨어나지도 않는다.
   * 밝힌 것은 상시 하나뿐이고, 그것이 이 방과 숲의 차이다: 숲의 위험은 무언가가 걸어 왔지만
   * (철 · 소란 · 지나가는 것) 협곡의 위험은 **방 자체**다.
   *
   * 절벽은 관찰 범위를 좁히지도(observeRange) 닿음을 말하지도(contact) 않는다 — 밝히지
   * 않았으므로 아무 일도 하지 않는다. 절벽이 하는 일은 이미 땅이 한다(급경사가 몸을 세운다).
   * 여기가 더하는 것은 "왜 여기가 위험한가" 라는 **말** 하나뿐이다.
   *
   * 갈래 hazard/terrain 은 어휘 일곱 안의 값이다 (content/authoring/contracts.ts 의
   * HAZARD_KINDS). 이 폴더는 그 파일을 읽지 않으므로(경계 규칙 4) 글자로 적는다 —
   * 흔적 태그 · 숲의 hazard/creature 와 같은 어법이다.
   */
  phases: {
    standing: {
      hazardExtend: [
        { areaId: 'hazard-ice-cliff-west', hazard: 'hazard/terrain' },
        { areaId: 'hazard-ice-cliff-east', hazard: 'hazard/terrain' },
      ],
    },
  },
};
