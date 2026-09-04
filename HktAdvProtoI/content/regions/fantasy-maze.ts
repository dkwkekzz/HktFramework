// 환상의 미로 — depth deep. **규칙을 품은 첫 방**이다 (C008).
//
// 미로의 방들은 Region 이 아니라 이 공간 안의 구역(cell area)이고, 방 사이의 복도는 Connector 가
// 아니라 이 공간 안의 통로(passage area)다 (Play RuleBoundRoom §5.1 · Rooms 불변 조건 넷째).
// Connector 는 세계의 전이(고대 문 · 나가는 문)에만 쓴다.
//
// 이 방의 땅은 **아무 데도 막지 않는다** — 높이를 건드리는 op 가 하나도 없어 격자 81×81 = 6561
// vertex 가 전부 평지이고 traversable = 1 이다 (실측). 그러므로 이 미로에서 몸을 세우는 것은
// 오직 **닫힌 통로**뿐이다: 컴파일 결과 위에 Region State 가 열림/닫힘만 덧씌운다 (spec World Change ⑤).
// 그래서 통로 area 의 모양이 곧 이 방의 벽이다 — 아래 값들은 전부 그 사실 위에서 골랐고
// 컴파일해 격자를 훑어 고정했다.
//
// 값의 근거 넷 (실측은 각 op 의 주석에 있다):
//   ① 구역 넷은 80×80 을 정확히 사등분한다 (각 40×40 · Play §5.6 의 배치 그대로: A 좌상 · B 우상 ·
//      C 우하 · D 좌하). 사등분이므로 구역이 맞닿는 자리는 x = 0 과 z = 0 이 그리는 십자 하나뿐이고,
//      **통로 여섯이 그 십자를 빈틈없이 덮는다** — 한 자리라도 통로 밖으로 남으면 그 틈은 어느
//      패턴에서도 열려 있어 미로가 성립하지 않는다 (실측: 십자를 정수 간격 162 자리 ·
//      0.25 간격 642 자리로 훑어 통로 밖 자리 0 개).
//   ② 통로 반폭 4 (폭 8) — 클라이언트의 한 걸음은 진행 방향 1.6m 앞을 요청한다
//      (app/main.ts KEY_LOOKAHEAD). 닫힌 통로는 벽이므로 한 걸음에 뛰어넘을 수 없어야 한다:
//      폭 8 은 그 다섯 배다 (강의 폭 8 과 같은 셈 · terrain-rules RIVER_WATER_DISTANCE).
//   ③ 한가운데 네거리(hub)는 반폭 8 로 통로보다 넓다 — 대각선 통로의 사분면이 자기 구역과
//      **폭 4 로 맞닿게** 하기 위해서다. hub 가 통로와 같은 반폭이면 구역과 점 하나로만 닿아
//      대각선이 바늘구멍이 된다 (실측: 지금 A 의 자유 구역과 hub 의 A 사분면이 z = 8 에서 x −8~−4,
//      x = −8 에서 z 4~8 — 두 곳 다 폭 4 = 걸음 2.5 개로 맞닿는다).
//   ④ 대각선 통로의 목(neck) 3 — A 사분면과 C 사분면은 원점에서 점 하나로 만난다. 목이 없으면
//      한 통로가 두 조각으로 갈라져 그림도 걸음도 끊긴다. 목을 두면 폭 3√2 ≈ 4.24 의 목구멍이
//      생겨 대각선 하나가 실제로 구역 둘을 잇는다.
//
// 패턴 셋에서 어느 구역이 어느 구역과 이어지는지는 실측해 아래 rule 주석의 표에 적었다.
//
// 경계 규칙 4 — 이 폴더는 engine 만 import 한다.

import type { RegionSpec } from './spec';
import { ANCHOR_LAYER } from './spec';
import type { XZ } from '../../engine/world-authoring/description';

export const FANTASY_MAZE = 'FANTASY_MAZE';

// op 의 layer 이름 — Description 을 적는 이 파일과 그것을 읽는 쪽(세계의 판정 · 화면의 그림)이
// 같은 글자를 쓰도록 상수로 둔다. 기반에게도 규칙에게도 불투명 문자열이다.
/** 구역 — 미로의 방 넷. 어느 구역에 서 있는가 */
export const CELL_LAYER = 'cell';
/** 통로 — 열리고 닫히는 자리. 규칙 데이터의 passageLayer 가 이것을 가리킨다 */
export const PASSAGE_LAYER = 'passage';
/** 식물 — 구역마다 다른 표식. 재배열이 건드리지 않는 기준점이다 (spec R3) */
export const CLUE_LAYER = 'clue';

// 구역 넷과 통로 여섯의 태그. 패턴 표와 area 가 같은 글자를 쓰도록 상수로 묶는다 —
// 표에 없는 통로가 area 로만 서 있거나 그 반대이면 그 통로는 영영 닫힌 벽이 된다.
const CELL_A = 'A';
const CELL_B = 'B';
const CELL_C = 'C';
const CELL_D = 'D';
const AB = 'AB';
const BC = 'BC';
const CD = 'CD';
const DA = 'DA';
const AC = 'AC';
const BD = 'BD';

/**
 * 구역마다 다른 안정된 식물 넷 — **구역의 이름표**다 (Play §5.3 · §5.5 가 이름 짓기를 위임했다).
 *
 * 넷을 같은 속(고사리)의 다른 빛깔로 지었다. 셋을 보고 골랐다.
 *   ① 이름표는 한눈에 갈려야 한다 — 은빛·호박빛·진홍·쪽빛은 색상환에서 서로 가장 먼 넷이라
 *      멀리서 스쳐도 어느 구역인지 읽힌다 (그림은 View 의 표가 정한다).
 *   ② 그러나 **한 종류로 보여야** 한다 — 넷이 서로 다른 식물이면 관찰자는 "이 방에 여러 식물이
 *      산다" 로 읽고, 같은 잎의 다른 빛깔이면 "빛깔이 구역의 이름이다" 로 읽는다. 이 Play 가
 *      필요로 하는 것은 뒤쪽이다 (§5.3 Exploit "지도는 못 그려도 이름표는 읽는다").
 *   ③ 구역과 짝짓는 순서는 A → B → C → D 를 시계 방향으로 도는 순서다 (좌상 → 우상 → 우하 → 좌하).
 *      은 → 호박 → 진홍 → 쪽 은 밝기가 도는 순서이기도 해서, 넷을 다 본 관찰자가
 *      "어느 쪽으로 돌고 있는가" 를 색만으로 셀 수 있다.
 * 심장(C009)이 있는 구역 B 의 이름에 심장을 암시하는 말을 넣지 않았다 — 그것을 알아내는 것이
 * 다음 Cycle 의 플레이이므로 이름표가 먼저 말해서는 안 된다.
 */
export const SILVER_FERN = 'SILVER_FERN';
export const AMBER_FERN = 'AMBER_FERN';
export const CRIMSON_FERN = 'CRIMSON_FERN';
export const INDIGO_FERN = 'INDIGO_FERN';

// ── 자리를 정하는 수 넷 ───────────────────────────────────────
/** 방의 반폭 — extent 80×80 (spec) */
const EXTENT_HALF = 40;
/** 구역의 반폭 — 80 을 정확히 사등분하므로 구역 하나가 40×40 이다 */
const CELL_HALF = EXTENT_HALF / 2;
/** 통로의 반폭 (폭 8) — 근거 ② */
const CORRIDOR_HALF = 4;
/** 한가운데 네거리의 반폭 (16×16) — 근거 ③ */
const HUB_HALF = 8;
/** 대각선 통로의 목 — 원점 곁에서 사분면 둘을 잇는 빗변의 끝 (폭 3√2 ≈ 4.24) — 근거 ④ */
const NECK = 3;

/** 축에 나란한 네모 — 왼쪽아래에서 시작해 x 를 먼저 늘린다 (extentPolygon 과 같은 방향) */
const rect = (minX: number, minZ: number, maxX: number, maxZ: number): XZ[] => [
  { x: minX, z: minZ },
  { x: maxX, z: minZ },
  { x: maxX, z: maxZ },
  { x: minX, z: maxZ },
];

export const FANTASY_MAZE_SPEC: RegionSpec = {
  id: FANTASY_MAZE,
  depth: 'deep',
  space: {
    id: FANTASY_MAZE,
    extent: { minX: -EXTENT_HALF, maxX: EXTENT_HALF, minZ: -EXTENT_HALF, maxZ: EXTENT_HALF },
    seed: 10,
    ops: [
      // ── 구역 넷 — 80×80 의 사등분 (Play §5.6 의 그림 그대로) ──────────────
      //
      //   ┌────────┬────────┐   z +40
      //   │ ✚ A    │  B  ◇  │        A 좌상(x −40~0 · z 0~40)  B 우상(x 0~40 · z 0~40)
      //   ├────────┼────────┤   z 0   ✚ = ANCIENT_GATE(입구) · ◇ = HEART_GATE
      //   │  D     │  C     │        D 좌하             C 우하
      //   └────────┴────────┘   z −40
      //   x −40        0     +40
      //
      // 구역은 겹치지 않고 빈틈도 없다 — 변 위의 자리(x = 0 · z = 0)만 두 구역에 함께 든다
      // (tagsAt 은 걸린 것을 전부 준다). 그 변은 통로가 덮고 있으므로 구역이 갈리는 자리에
      // 서는 일은 통로 안에서만 일어난다.
      {
        id: 'cell-a',
        kind: 'area',
        layer: CELL_LAYER,
        tag: CELL_A,
        shape: { kind: 'polygon', points: rect(-EXTENT_HALF, 0, 0, EXTENT_HALF) },
      },
      {
        id: 'cell-b',
        kind: 'area',
        layer: CELL_LAYER,
        tag: CELL_B,
        shape: { kind: 'polygon', points: rect(0, 0, EXTENT_HALF, EXTENT_HALF) },
      },
      {
        id: 'cell-c',
        kind: 'area',
        layer: CELL_LAYER,
        tag: CELL_C,
        shape: { kind: 'polygon', points: rect(0, -EXTENT_HALF, EXTENT_HALF, 0) },
      },
      {
        id: 'cell-d',
        kind: 'area',
        layer: CELL_LAYER,
        tag: CELL_D,
        shape: { kind: 'polygon', points: rect(-EXTENT_HALF, -EXTENT_HALF, 0, 0) },
      },
      // ── 통로 여섯 — 십자를 빈틈없이 덮는다 ────────────────────────────────
      //
      // 인접 넷은 구역이 맞닿는 변 위의 복도이고, 대각선 둘은 그 십자가 만나는
      // 한가운데 네거리(16×16)를 사분면으로 나눠 갖는다:
      //
      //        x −8  0  +8
      //   z +8  ┌───┬───┐     AC = A 사분면(좌상) + C 사분면(우하) + 원점의 목
      //         │AC │BD │     BD = B 사분면(우상) + D 사분면(좌하) + 원점의 목
      //   z  0  ├───┼───┤     인접 통로 넷은 이 네거리 **밖**에서 시작한다 (|좌표| ≥ 8)
      //         │BD │AC │     — 안까지 들어오면 네거리가 늘 열려 있게 되어
      //   z −8  └───┴───┘        닫힌 통로를 우회하는 지름길이 생긴다
      //
      // 겹치는 자리 둘 (실측 · 81×81 vertex):
      //   ① 두 대각선의 목이 서로의 사분면을 지난다 — 원점 곁 41 자리에서 AC 와 BD 가 함께 걸린다.
      //      패턴 셋 어디에서도 이 둘은 늘 함께 열리고 함께 닫히므로 그 겹침은 관찰되지 않는다.
      //   ② 인접 통로와 네거리는 변 하나(z = ±8 · x = ±8 위의 선분)를 함께 쓴다 — 기반의 area
      //      판정이 변 위를 안으로 치기 때문이다 (변마다 4~9 자리).
      //      **폭이 없는 선분이라 길이 되지는 않는다**: 겹친 자리의 판정을 "하나라도 열리면 열림"
      //      에서 "하나라도 닫히면 닫힘" 으로 뒤집어 같은 BFS 를 다시 재도 아래 걸음 표가 한 칸도
      //      달라지지 않았다 (실측 · 격자를 그 선분에서 0.125 어긋나게 두고도 같다).
      {
        // A|B 사이 — 북쪽 세로 복도. 네거리 위(z ≥ 8)에서 방의 북쪽 변까지 (8 × 32).
        // 이 복도가 닫히면 A 와 B 를 잇는 자리는 네거리뿐이다 (실측: 식물 A → 식물 B 가
        // DEFAULT 에서 25 걸음, 이 복도가 닫힌 P1 에서 33 걸음 — 왔던 길이 막히고 길이 돌아간다).
        id: 'passage-ab',
        kind: 'area',
        layer: PASSAGE_LAYER,
        tag: AB,
        shape: {
          kind: 'polygon',
          points: rect(-CORRIDOR_HALF, HUB_HALF, CORRIDOR_HALF, EXTENT_HALF),
        },
      },
      {
        // B|C 사이 — 동쪽 가로 복도 (32 × 8)
        id: 'passage-bc',
        kind: 'area',
        layer: PASSAGE_LAYER,
        tag: BC,
        shape: {
          kind: 'polygon',
          points: rect(HUB_HALF, -CORRIDOR_HALF, EXTENT_HALF, CORRIDOR_HALF),
        },
      },
      {
        // C|D 사이 — 남쪽 세로 복도 (8 × 32)
        id: 'passage-cd',
        kind: 'area',
        layer: PASSAGE_LAYER,
        tag: CD,
        shape: {
          kind: 'polygon',
          points: rect(-CORRIDOR_HALF, -EXTENT_HALF, CORRIDOR_HALF, -HUB_HALF),
        },
      },
      {
        // D|A 사이 — 서쪽 가로 복도 (32 × 8)
        id: 'passage-da',
        kind: 'area',
        layer: PASSAGE_LAYER,
        tag: DA,
        shape: {
          kind: 'polygon',
          points: rect(-EXTENT_HALF, -CORRIDOR_HALF, -HUB_HALF, CORRIDOR_HALF),
        },
      },
      {
        // A↔C 대각선 — 네거리의 좌상 사분면과 우하 사분면, 그리고 원점을 지나는 목.
        // 좌상에서 시작해 x = 0 을 따라 내려오다 목의 빗변(0,3)→(3,0) 으로 건너뛰고
        // 우하 사분면을 돌아 다시 목(0,−3)→(−3,0) 으로 돌아온다. 자기와 겹치지 않는 홑 다각형이다.
        id: 'passage-ac',
        kind: 'area',
        layer: PASSAGE_LAYER,
        tag: AC,
        shape: {
          kind: 'polygon',
          points: [
            { x: -HUB_HALF, z: HUB_HALF },
            { x: 0, z: HUB_HALF },
            { x: 0, z: NECK },
            { x: NECK, z: 0 },
            { x: HUB_HALF, z: 0 },
            { x: HUB_HALF, z: -HUB_HALF },
            { x: 0, z: -HUB_HALF },
            { x: 0, z: -NECK },
            { x: -NECK, z: 0 },
            { x: -HUB_HALF, z: 0 },
          ],
        },
      },
      {
        // B↔D 대각선 — AC 를 x 축으로 뒤집은 것. 우상 사분면과 좌하 사분면을 잇는다.
        id: 'passage-bd',
        kind: 'area',
        layer: PASSAGE_LAYER,
        tag: BD,
        shape: {
          kind: 'polygon',
          points: [
            { x: HUB_HALF, z: HUB_HALF },
            { x: 0, z: HUB_HALF },
            { x: 0, z: NECK },
            { x: -NECK, z: 0 },
            { x: -HUB_HALF, z: 0 },
            { x: -HUB_HALF, z: -HUB_HALF },
            { x: 0, z: -HUB_HALF },
            { x: 0, z: -NECK },
            { x: NECK, z: 0 },
            { x: HUB_HALF, z: 0 },
          ],
        },
      },
      // ── 식물 넷 — 구역의 한가운데 ─────────────────────────────────────────
      //
      // 자리는 구역의 정중앙(|20|, |20|)이다. 셋을 보고 골랐다.
      //   ① 통로에 들지 않는다 — 통로 안에 서면 그 식물이 재배열로 닫힌 벽 속에 갇혀
      //      "재배열이 건드리지 않는 것" 이라는 뜻이 흐려진다 (실측: 네 자리 다 통로 태그 0 개).
      //   ② 구역의 세 입구에서 거의 같은 거리다 — 복도 둘의 입구에서 16.0 · 16.0, 네거리
      //      사분면의 모서리에서 17.0 (실측). 어느 문으로 들어서도 곧 눈에 든다.
      //   ③ 구역 안 어느 자리에서도 28.3 이내다 (가장 먼 구역 모서리까지 20√2 · 실측).
      //      그러면서 이웃 구역의 식물까지는 40.0, 대각선 구역의 식물까지는 56.6 이라
      //      한 자리에서 이름표 둘이 함께 읽히지 않는다 — 이름표는 한 번에 하나다.
      {
        id: 'clue-a',
        kind: 'point',
        layer: CLUE_LAYER,
        tag: SILVER_FERN,
        position: { x: -CELL_HALF, z: CELL_HALF },
      },
      {
        id: 'clue-b',
        kind: 'point',
        layer: CLUE_LAYER,
        tag: AMBER_FERN,
        position: { x: CELL_HALF, z: CELL_HALF },
      },
      {
        id: 'clue-c',
        kind: 'point',
        layer: CLUE_LAYER,
        tag: CRIMSON_FERN,
        position: { x: CELL_HALF, z: -CELL_HALF },
      },
      {
        id: 'clue-d',
        kind: 'point',
        layer: CLUE_LAYER,
        tag: INDIGO_FERN,
        position: { x: -CELL_HALF, z: -CELL_HALF },
      },
      // ── anchor 둘 ─────────────────────────────────────────────────────────
      {
        // 고대 문으로 들어서는 자리 — 구역 A 안이다 (spec SPEC-002). 나가는 문
        // MAZE_GATE_RETURN 도 이 자리를 쓴다: 들어온 문으로 나간다 (TREE_INNER_DOOR 의 선례).
        //
        // (−30, 30) — 방의 북서 모서리에서 10 들어온 자리다. 셋을 보고 골랐다.
        //   ① 통로 밖이다 (통로 태그 0 개) — 어느 패턴에서도 몸이 벽 속에 놓이지 않는다.
        //   ② 미로의 한가운데에서 가장 먼 구석이다 (원점까지 42.4 · 실측) — 문을 지나면 미로가
        //      안쪽으로 펼쳐진다. 자기 구역의 식물(은빛 고사리)까지는 14.1 로 곧 눈에 든다.
        //   ③ 여기서 나가는 길은 어느 패턴에서도 열려 있다 — 이 자리에서 BFS 로 훑으면
        //      DEFAULT · P1 · P2 셋 다 구역 넷(ABCD) 전부에 닿는다 (실측). 갇히지 않는다.
        id: 'anchor-ancient-gate',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'ANCIENT_GATE',
        position: { x: -30, z: 30 },
      },
      {
        // 심장 쪽 문 — 구역 B 안 (Play §5.4 · C009 가 쓴다). 입구를 x 축으로 뒤집은 자리다:
        // 입구에서 보면 통로 하나 너머 마주 보이지만 그리 가려면 열린 통로를 찾아야 한다
        // (실측: 두 자리는 60.0 떨어져 있고, 걸음으로는 DEFAULT 에서 38 · AB 가 닫힌 P1 과 P2 에서 53).
        id: 'anchor-heart-gate',
        kind: 'point',
        layer: ANCHOR_LAYER,
        tag: 'HEART_GATE',
        position: { x: 30, z: 30 },
      },
    ],
  },
  /**
   * 이 방이 품은 규칙의 데이터 (spec 의 패턴 표 그대로 · Play §5.6).
   *
   *   DEFAULT  AB · BC · CD · DA   고리 — 네 복도가 다 열려 있고 한가운데 네거리는 닫혀 있다.
   *                               지도를 그릴 수 있어 보이는 자리다
   *   P1       AC · CB · BD · DA   고리가 끊긴다 (AB · CD 가 닫힌다). 대신 네거리가 열린다
   *   P2       AD · DC · CA · BD   또 다르게 끊긴다 (AB · BC 가 닫힌다)
   *
   * spec 이 CB · AD · DC · CA 로 적은 넷은 여기 BC · DA · CD · AC 와 같은 통로다 —
   * 통로는 하나이고 이름은 한 방향으로만 적는다.
   *
   * 배열 순서가 곧 순환이다: DEFAULT → P1 → P2 → DEFAULT. 세계가 설 때는 첫 줄(DEFAULT)이다.
   *
   * 패턴 셋이 실제로 무엇을 잇는가 — 식물에서 식물까지의 **걸음 수**로 쟀다
   * (실측 · 한 걸음 1.6m · 격자 0.4 의 16방위 BFS · 세계처럼 목표 자리만 보는 판정):
   *
   *              A—B   B—C   C—D   D—A   A—C   B—D      입구(A) → HEART_GATE(B)
   *   DEFAULT     25    25    25    25    43    43              38
   *   P1          33    25    33    25    40    40              53
   *   P2          33    33    25    25    40    40              53
   *
   *   읽는 법 — 닫힌 복도의 두 구역은 25 → 33 으로 여덟 걸음 **돌아가고**(그 길은 네거리를
   *   지난다), 열린 대각선의 두 구역은 43 → 40 으로 가까워진다. DEFAULT 에서만 네거리가
   *   닫혀 있어 고리 넷이 길의 전부다 — 지도를 그릴 수 있어 보이는 자리가 여기다.
   *
   *   네 구역은 어느 패턴에서도 서로 닿는다 (실측: 입구에서 BFS 로 훑으면 셋 다 ABCD 전부).
   *   갇히는 구역이 없다는 뜻이고, 사등분한 방에서는 네 구역이 한 점에서 만나므로 **열린
   *   네거리는 언제나 넷을 함께 잇는다** — 통로 여섯으로 구역을 갈라 세우는 이 배치에서
   *   피할 수 없는 사실이다. 그래서 재배열이 바꾸는 것은 "갈 수 있는가" 가 아니라
   *   **"어느 길로 가는가"** 다: 패턴이 넘어갈 때마다 복도 둘이 벽이 되고 왔던 길이 막힌다.
   */
  rule: {
    patterns: [
      { name: 'DEFAULT', open: [AB, BC, CD, DA] },
      { name: 'P1', open: [AC, BC, BD, DA] },
      { name: 'P2', open: [DA, CD, AC, BD] },
    ],
    // 확정 1 — 결정론 시뮬 상수가 아니라 이 방의 데이터다. 임계를 바꾸는 것도 코드가 아니다.
    pressureLimit: 120,
    pressurePerDistance: 1,
    passageLayer: PASSAGE_LAYER,
  },
};
