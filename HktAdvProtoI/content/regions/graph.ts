// Region Graph — 이 팩의 방 사이 연결 (C001 · C002 에서 Connector 열로 는다).
//
// Connector 는 두 방의 anchor 를 잇는 전이다. 목적지의 이름은 관찰 결과에 실리지 않는다 —
// "목적지는 건너야 안다" (Play §5.1). 배열 순서가 exitsOf 의 결정론이므로 01-spec SPEC-003 의
// 표 순서를 그대로 지킨다 — FOREST_PATH 가 여전히 첫째다.
//
// C002 ADDED — 아직 짓지 않은 방을 가리키는 끝이 생겼다. 그 이름들은 frontiers 가 밝힌다:
// 밝혀진 경계는 정합 오류가 아니다 (01-spec SPEC-004). 몸이 그 방에 설 수는 없다 —
// 건너기 요청은 region-not-built 로 거절된다 (02-world R1).
//
// C003 CHANGED — Connector 가 열에서 열셋으로, 중첩(containment)에 값이 처음 들고, 경계가 하나 줄었다
// (RED_EYE_TREE 가 지어졌다). C002 가 놓은 열은 한 글자도 바뀌지 않는다 — 방 하나가 지어졌을 뿐이다
// (01-spec SPEC-003 경계). 새 열 셋은 배열 끝에 이어 붙었다: exitsOf 의 결정론이 이 순서를 따른다.
//
// C008 CHANGED — 방이 열, Connector 가 열넷, 경계가 둘이 된다. 환상의 미로가 지어져 경계 목록에서
// 빠지고(이름은 이제 fantasy-maze.ts 가 소유한다 · RED_EYE_TREE 의 선례) 거기서 나가는 문
// MAZE_GATE_RETURN 하나가 배열 끝에 이어 붙는다. 앞의 열셋은 한 글자도 바뀌지 않는다 —
// 고대 문(ANCIENT_GATE)조차 그대로다: 그 너머가 지어졌다는 것은 데이터가 말할 뿐이다 (C004 의 증명).
//
// C009 CHANGED — 방이 열하나, Connector 가 열여섯, 중첩이 셋, 경계가 셋이 된다. 미로의 심장이
// 지어지고(MAZE_HEART) 거기로 드는 문 하나와 거기서 뒤집힌 정원으로 나가는 문 하나가 배열 끝에
// 이어 붙는다. 앞의 열넷은 한 글자도 바뀌지 않는다 — exitsOf 의 결정론이 이 순서를 따르기 때문이다.
// 그리고 이 파일이 **Connector 활성 조건 표** 하나를 새로 소유했다 (C029 에서 access.ts 로 옮겼다):
// 어느 문이 어느 방의 어느 패턴에서 열리는가는 규칙이 아니라 데이터가 아는 일이다.

// C016 CHANGED — Connector 가 열일곱, 경계가 넷이 된다. 숲 안쪽에서 걷는 숲으로 나가는 문
// 하나가 배열 끝에 이어 붙고(exitsOf 의 결정론이 이 순서를 따른다) 그 너머 이름 하나가
// 경계 목록에 는다. 그리고 활성 조건이 **철**을 함께 지게 된다 — 그 문은 긴 밤에만 열린다.
// 앞의 열여섯은 한 글자도 바뀌지 않고, 미로 심장 문의 조건도 한 값 그대로다.
//
// C019 CHANGED — 방이 열셋, Connector 가 열여덟, 경계가 셋이 된다. 얼음 협곡이 지어져
// 경계 목록에서 빠지고(이름은 이제 ice-canyon.ts 가 소유한다 · RED_EYE_TREE · FANTASY_MAZE 의
// 선례) 그 안쪽 빙결 협곡이 함께 선다. 백왕령 서쪽의 고개 ICE_CANYON_PASS 는 **자리를 그대로
// 둔 채 방향만** one-way → bidirectional 로 바뀌고(고개는 넘어갔다 돌아오는 것이다), 협곡 안으로
// 드는 오솔길 FROST_CANYON_TRAIL 하나가 배열 끝에 이어 붙는다. 앞의 열일곱은 한 글자도 바뀌지
// 않는다 — exitsOf 의 결정론이 이 순서를 따르므로 고개도 옮기지 않았다.
//
// C020 CHANGED — Connector 가 열아홉, 경계가 넷이 된다. 빙결 협곡에서 **빙결 심층**으로 드는
// 문 FROST_DEPTH_DOOR 하나가 배열 끝에 이어 붙고(exitsOf 의 결정론이 이 순서를 따른다) 그
// 너머 이름 하나(FROST_DEPTH)가 경계 목록에 는다. 앞의 열여덟은 한 글자도 바뀌지 않는다.
// 그리고 이 파일이 표 하나를 더 소유했다 (문이 **밝힌 요구**의 코드들 — C029 에서 access.ts 로
// 옮겼다): 활성 표와 같은 갈래의 정적 데이터이되 활성을 판정하지 않는다 (spec R5 경계 ①).
//
// C029 CHANGED — **표 둘이 사라진다.** `CONNECTOR_ACTIVATIONS` 와 `CONNECTOR_REQUIREMENTS` 가
// 지고 있던 것(무엇을 읽어 열림을 정하는가 · 표식에 무엇이 적혀 있는가)은 각 방의
// `RegionSpec.access.locks` 하나로 옮겨 가 `access.ts` 가 형과 색인을 소유한다 (spec R1 · R3 ·
// Access 빈칸 1 의 답). 이 파일에 남는 것은 **어디에서 어디로 이어지는가** 하나다 — 그 문이
// 무엇을 묻는지는 이제 문을 가진 방이 적는다. Connector 도 경계도 중첩도 한 글자 바뀌지 않고,
// 문의 열림도 잠긴 사유도 한 값 달라지지 않는다 (spec SPEC-002).

import type { RegionGraph } from '../../engine/world-authoring/graph';
import { BIO_ORE_FIELD } from './bio-ore-field';
import { EXPLORER_RUIN } from './explorer-ruin';
import { FANTASY_MAZE } from './fantasy-maze';
import { FOREST_DEEP } from './forest-deep';
import { FOREST_EDGE } from './forest-edge';
import { FROST_CANYON } from './frost-canyon';
import { HEART_LAKE } from './heart-lake';
import { ICE_CANYON } from './ice-canyon';
import { MAZE_HEART } from './maze-heart';
import { PREDATOR_NEST } from './predator-nest';
import { RED_EYE_TREE } from './red-eye-tree';
import { TREE_INNER_WORLD } from './tree-inner-world';
import { WHITE_KING_DOMAIN } from './white-king-domain';

export const FOREST_PATH = 'FOREST_PATH';
export const RUIN_TRAIL = 'RUIN_TRAIL';
export const DEEP_TRAIL = 'DEEP_TRAIL';
export const NEST_TRAIL = 'NEST_TRAIL';
export const ORE_TRAIL = 'ORE_TRAIL';
export const TREE_APPROACH = 'TREE_APPROACH';
export const ORE_TREE_TRAIL = 'ORE_TREE_TRAIL';
export const ANCIENT_GATE = 'ANCIENT_GATE';
export const RED_WASTE_PASS = 'RED_WASTE_PASS';
export const ICE_CANYON_PASS = 'ICE_CANYON_PASS';
// C003 ADDED — 작은 문 · 추락 · 물길
export const TREE_INNER_DOOR = 'TREE_INNER_DOOR';
export const TREE_FALL = 'TREE_FALL';
export const HEART_RIVER = 'HEART_RIVER';
// C008 ADDED — 미로에서 나가는 문. 들어온 자리로 나온다 (TREE_INNER_DOOR 와 같은 규약)
export const MAZE_GATE_RETURN = 'MAZE_GATE_RETURN';
// C009 ADDED — 심장으로 드는 문과 그 너머로 나가는 문
export const MAZE_HEART_GATE = 'MAZE_HEART_GATE';
export const INVERTED_GARDEN_DOOR = 'INVERTED_GARDEN_DOOR';
// C016 ADDED — 걷는 숲으로 나가는 문. 긴 밤에만 열린다 (숲 안쪽의 access.locks)
export const WALKING_FOREST_DOOR = 'WALKING_FOREST_DOOR';
// C019 ADDED — 협곡 안쪽으로 드는 오솔길
export const FROST_CANYON_TRAIL = 'FROST_CANYON_TRAIL';
// C020 ADDED — 빙결 심층으로 드는 문. 그 표식에 **현상**이 적힌다 (빙결 협곡의 access.locks)
export const FROST_DEPTH_DOOR = 'FROST_DEPTH_DOOR';

// 아직 짓지 않은 방들 — Connector 가 가리키되 Description 이 없다 (01-spec SPEC-004).
// 이름만 있고 방은 없다. 지어지면 그 이름은 이 목록에서 빠지고 REGION_SPECS 로 옮겨 간다.
// C003 CHANGED — RED_EYE_TREE 가 그렇게 되었다: 이름은 이제 red-eye-tree.ts 가 소유하고
// 이 목록에는 없다 (01-spec SPEC-009 ②).
// C008 CHANGED — FANTASY_MAZE 도 그렇게 되었다 (이름은 fantasy-maze.ts 가 소유한다).
// C009 CHANGED — 이름 하나가 더 늘었다: 뒤집힌 정원(INVERTED_GARDEN). 심장에서 나가는 문이
// 그것을 가리키되 그 방은 이 Play 밖이다 (01-spec 확정 5). 그 방을 짓는 Play 가 이름을 가져간다 —
// RED_EYE_TREE · FANTASY_MAZE 가 그랬듯. 경계는 셋이 된다.
// C019 CHANGED — ICE_CANYON 도 그렇게 되었다: 이름은 이제 ice-canyon.ts 가 소유하고 이
// 목록에는 없다. 그 너머 FROST_CANYON 은 frost-canyon.ts 가 소유한다 — 처음부터 지어진 방이라
// 경계였던 적이 없다. 경계는 셋이 된다 (RED_WASTE · INVERTED_GARDEN · WALKING_FOREST).
export const RED_WASTE = 'RED_WASTE';
export const INVERTED_GARDEN = 'INVERTED_GARDEN';
// C016 ADDED — 걷는 숲. 정식 이름 표에 있되 **그래프 자리가 미정**인 이름이다
// (L2-World-Region §5.1). 긴 밤에만 열리는 문이 그것을 가리키되 그 방은 이 Cycle 밖이고,
// 그 방을 짓는 Play 가 이름을 가져간다 — RED_EYE_TREE · FANTASY_MAZE 가 그랬듯.
export const WALKING_FOREST = 'WALKING_FOREST';
// C020 ADDED — 빙결 심층. 정식 이름 표에 있되 **아직 짓지 않은 곳**이다
// (L2-World-Region §5.1). 빙결 협곡에서 드는 문이 그것을 가리키되 그 방은 이 Cycle 밖이고,
// 그 방을 짓는 Play 가 이름을 가져간다 — RED_EYE_TREE · FANTASY_MAZE · ICE_CANYON 이 그랬듯.
export const FROST_DEPTH = 'FROST_DEPTH';

/** 이 Graph 가 경계로 밝힌 이름들 — Description 이 없어도 정합 오류가 아니다 (01-spec SPEC-004) */
export const FRONTIER_REGIONS: readonly string[] = [
  RED_WASTE,
  INVERTED_GARDEN,
  WALKING_FOREST,
  // C020 ADDED — 경계가 넷이 된다. **배열 끝**에 붙는다 (C003 부터의 어법)
  FROST_DEPTH,
];

/**
 * 닫힌 Connector 의 id 들 (C002 ADDED · 01-spec SPEC-005).
 * 정적 컨텐츠 데이터다 — 세계 State 에 들어가지 않고 저장되지도 않는다.
 * 여는 규칙도 닫는 규칙도 세계에 없다 (Play W7) — 이 목록이 처음부터 그렇다고 적을 뿐이다.
 *
 * C004 CHANGED — 비었다. 고대 문(ANCIENT_GATE)이 열렸다.
 * **규칙은 한 글자도 바뀌지 않았다** — 이 한 줄이 세계의 대답을 "잠겨 있다" 에서
 * "아직 갈 수 없는 곳이다" 로 옮겼다 (그 너머는 아직 경계다). 그것이 C004 의 증명이고,
 * 미로의 입구가 이렇게 선다 (RuleBoundRoom 확정 4 — 방들은 C005 가 짓는다).
 * 닫힌 문이라는 갈래는 그대로다: 여기에 id 하나를 도로 넣으면 그 문은 다시 잠긴다.
 */
export const CLOSED_CONNECTORS: readonly string[] = [];

/**
 * 세계가 시작하는 방 — 관찰자의 새 몸 · 기본 자율 존재 · 광맥이 놓이는 자리 (C004 ADDED).
 *
 * C003 까지는 content/world 가 이 이름을 알고 있었다. 그것이 규칙 코드가 이름으로 아는
 * **마지막 한 곳**이었으므로 데이터로 옮겼다 — 이제 규칙은 어떤 방도 어떤 연결도 이름으로 알지 못하고,
 * 시작 방을 옮기는 것도 다른 폴리싱과 똑같이 이 파일 한 줄이다 (01-spec SPEC-003 · SPEC-004).
 */
export const START_REGION_ID = WHITE_KING_DOMAIN;

export const REGION_GRAPH: RegionGraph = {
  regions: [
    WHITE_KING_DOMAIN,
    FOREST_EDGE,
    FOREST_DEEP,
    EXPLORER_RUIN,
    PREDATOR_NEST,
    BIO_ORE_FIELD,
    RED_EYE_TREE,
    TREE_INNER_WORLD,
    HEART_LAKE,
    FANTASY_MAZE,
    MAZE_HEART,
    // C019 ADDED — 고개 너머 둘. **배열 끝**에 붙는다 (C003 부터의 어법) — 앞의 열하나의
    // 자리가 한 칸도 밀리지 않는다.
    ICE_CANYON,
    FROST_CANYON,
  ],
  // 어떤 방을 통해 발견되며 세계관상 어디에 속하는가 (L2-World-Region §7 의 사슬).
  // Connectivity(Connector)와도 Spatial Embedding 과도 다른 관계다 — 자식이 부모보다 넓어도 오류가 아니다.
  // 세계 규칙 중 무엇도 이 값을 읽지 않는다: 이 Cycle 에서 중첩이 하는 일은 검사 하나뿐이다
  // (01-spec SPEC-004 경계).
  containment: [
    { parent: RED_EYE_TREE, child: TREE_INNER_WORLD },
    { parent: TREE_INNER_WORLD, child: HEART_LAKE },
    // C009 ADDED — 심장은 미로의 중첩 자식이다 (01-spec SPEC-001 · Spec topology.children).
    // 둘을 잇는 Connector 가 있으므로 검사 ⑥(containment-unlinked)이 걸리지 않는다.
    { parent: FANTASY_MAZE, child: MAZE_HEART },
  ],
  connectors: [
    {
      id: FOREST_PATH,
      from: { region: WHITE_KING_DOMAIN, anchor: FOREST_PATH },
      to: { region: FOREST_EDGE, anchor: FOREST_PATH },
      direction: 'bidirectional',
      transition: 'road',
    },
    {
      id: RUIN_TRAIL,
      from: { region: FOREST_EDGE, anchor: RUIN_TRAIL },
      to: { region: EXPLORER_RUIN, anchor: RUIN_TRAIL },
      direction: 'bidirectional',
      transition: 'trail',
    },
    {
      id: DEEP_TRAIL,
      from: { region: FOREST_EDGE, anchor: DEEP_TRAIL },
      to: { region: FOREST_DEEP, anchor: DEEP_TRAIL },
      direction: 'bidirectional',
      transition: 'trail',
    },
    {
      id: NEST_TRAIL,
      from: { region: FOREST_DEEP, anchor: NEST_TRAIL },
      to: { region: PREDATOR_NEST, anchor: NEST_TRAIL },
      direction: 'bidirectional',
      transition: 'trail',
    },
    {
      id: ORE_TRAIL,
      from: { region: FOREST_DEEP, anchor: ORE_TRAIL },
      to: { region: BIO_ORE_FIELD, anchor: ORE_TRAIL },
      direction: 'bidirectional',
      transition: 'trail',
    },
    // 거목으로 가는 두 끝 — 방은 C003 이 짓는다. 그때 Description 하나가 늘고
    // 경계 목록에서 이름 하나가 빠질 뿐 이 Connector 는 그대로다 (01-spec UNRESOLVED 판정).
    {
      id: TREE_APPROACH,
      from: { region: FOREST_DEEP, anchor: TREE_APPROACH },
      to: { region: RED_EYE_TREE, anchor: 'FOREST_DEEP_SIDE' },
      direction: 'bidirectional',
      transition: 'interaction',
    },
    {
      id: ORE_TREE_TRAIL,
      from: { region: BIO_ORE_FIELD, anchor: 'TREE_TRAIL' },
      to: { region: RED_EYE_TREE, anchor: 'ORE_SIDE' },
      direction: 'bidirectional',
      transition: 'trail',
    },
    // 고대 문 — 닫혀 있는 하나 (CLOSED_CONNECTORS). 건너간 뒤도 아직 짓지 않은 곳이다.
    {
      id: ANCIENT_GATE,
      from: { region: FOREST_DEEP, anchor: ANCIENT_GATE },
      to: { region: FANTASY_MAZE, anchor: 'ANCIENT_GATE' },
      direction: 'one-way',
      transition: 'door',
    },
    {
      id: RED_WASTE_PASS,
      from: { region: WHITE_KING_DOMAIN, anchor: RED_WASTE_PASS },
      to: { region: RED_WASTE, anchor: 'WHITE_KING_SIDE' },
      direction: 'one-way',
      transition: 'pass',
    },
    // C019 CHANGED — 고개가 **양방향**이 된다 (spec SPEC-001 · 기본형 ⑥).
    // Design 은 "고개가 열린다" 만 말하고 돌아오는 길을 따로 적지 않았다. 고개는 넘어갔다
    // 돌아오는 것이므로 문 둘(C008 의 MAZE_GATE_RETURN 선례)을 세우지 않고 하나를 양방향으로
    // 두었다 — 문을 둘로 세우면 이 방에 없는 "돌아오는 다른 길" 이 생기고, 백왕령의 출구
    // 차례에도 한 자리가 더 난다. **배열 자리는 그대로다** — exitsOf 의 결정론이 순서를
    // 따르므로 옮기지 않았고, 그래서 백왕령의 출구 차례는 한 자리도 바뀌지 않는다
    // (spec SPEC-001 경계 ②). 바뀐 것은 direction 한 글자뿐이다.
    {
      id: ICE_CANYON_PASS,
      from: { region: WHITE_KING_DOMAIN, anchor: ICE_CANYON_PASS },
      to: { region: ICE_CANYON, anchor: 'WHITE_KING_SIDE' },
      direction: 'bidirectional',
      transition: 'pass',
    },
    // C003 ADDED — 작은 문 하나와 돌아올 수 없는 길 둘 (01-spec SPEC-003).
    // 나무 밑동의 작은 문. 되돌아가는 문도 이 하나다 — 들어간 자리로 나온다.
    {
      id: TREE_INNER_DOOR,
      from: { region: RED_EYE_TREE, anchor: 'INNER_DOOR' },
      to: { region: TREE_INNER_WORLD, anchor: 'OUTER_DOOR' },
      direction: 'bidirectional',
      transition: 'door',
    },
    // 추락 — 요청 없이 건너진다 (RULE-REGION-FALL-001). 세계가 묻지 않고 데려간다.
    {
      id: TREE_FALL,
      from: { region: TREE_INNER_WORLD, anchor: 'FALL' },
      to: { region: HEART_LAKE, anchor: 'FALL_LANDING' },
      direction: 'one-way',
      transition: 'falling',
    },
    // 물길 — 심장 호수에서 나가는 끝 하나. 숲 안쪽으로 나오되 들어갔던 자리가 아니다.
    {
      id: HEART_RIVER,
      from: { region: HEART_LAKE, anchor: 'RIVER' },
      to: { region: FOREST_DEEP, anchor: 'RIVER_MOUTH' },
      direction: 'one-way',
      transition: 'river',
    },
    // C008 ADDED — 미로에서 나가는 문 하나. 들어간 자리(미로의 ANCIENT_GATE anchor)에서
    // 들어온 자리(숲 안쪽의 ANCIENT_GATE anchor)로 나온다 — 고대 문의 이쪽과 저쪽이다.
    // 고대 문이 one-way 이므로 돌아오는 끝을 따로 세운다: 방향이 둘이라 문도 둘이다.
    // 이 문이 없으면 미로에 나갈 곳이 없어 검사 ⑦(no-exit)이 걸린다 — C001 부터의 불변이다.
    {
      id: MAZE_GATE_RETURN,
      from: { region: FANTASY_MAZE, anchor: 'ANCIENT_GATE' },
      to: { region: FOREST_DEEP, anchor: 'ANCIENT_GATE' },
      direction: 'one-way',
      transition: 'door',
    },
    // C009 ADDED — 심장 쪽 문 하나. 미로의 HEART_GATE anchor(구역 B 안 · C008 이 세워 두었다)와
    // 심장을 잇는다. **문은 하나이고 양방향이다** — 들어간 자리로 나온다 (TREE_INNER_DOOR 의 선례).
    // Play §5.4 가 "door Connector 하나로 들어간다" 라고만 적었으므로 되돌아오는 문을 따로
    // 세우지 않았다: 둘을 세우면 문이 둘이 되어 Design 의 "하나" 와 어긋난다.
    // 이 문만이 활성 조건을 가진다 — 미로의 access.locks (C029 까지는 이 파일의 활성 표).
    {
      id: MAZE_HEART_GATE,
      from: { region: FANTASY_MAZE, anchor: 'HEART_GATE' },
      to: { region: MAZE_HEART, anchor: 'MAZE_SIDE' },
      direction: 'bidirectional',
      transition: 'door',
    },
    // C009 ADDED — 뒤집힌 정원 쪽 문. 심장에서 나가는 끝이고 **그 너머는 아직 짓지 않은 곳**이다.
    // one-way 인 것은 저쪽에서 이쪽으로 오는 길을 이 Play 가 정하지 않았기 때문이다 —
    // 그 방을 짓는 Play 가 돌아오는 끝까지 함께 정한다 (고대 문이 그랬던 그대로).
    // 건너기 요청은 region-not-built 로 거절된다 (C002 가 세운 대답 그대로).
    {
      id: INVERTED_GARDEN_DOOR,
      from: { region: MAZE_HEART, anchor: 'GARDEN_DOOR' },
      to: { region: INVERTED_GARDEN, anchor: 'MAZE_HEART_SIDE' },
      direction: 'one-way',
      transition: 'door',
    },
    // C016 ADDED — 걷는 숲으로 나가는 문. **긴 밤에만 활성**이고(그 방의 access.locks) 그 너머는
    // 아직 짓지 않은 곳이다 — 건너기 요청은 region-not-built 로 거절된다 (C002 가 세운 대답).
    // one-way 인 것은 저쪽에서 이쪽으로 오는 길을 이 Cycle 이 정하지 않았기 때문이다:
    // 그 방을 짓는 Play 가 돌아오는 끝까지 함께 정한다 (고대 문 · 뒤집힌 정원 문 그대로).
    // 배열 **끝**에 붙는다 — exitsOf 의 결정론이 이 순서를 따르므로 중간에 끼우지 않는다.
    {
      id: WALKING_FOREST_DOOR,
      from: { region: FOREST_DEEP, anchor: WALKING_FOREST_DOOR },
      to: { region: WALKING_FOREST, anchor: 'FOREST_DEEP_SIDE' },
      direction: 'one-way',
      transition: 'door',
    },
    // C019 ADDED — 협곡 안쪽으로 드는 오솔길 하나. 얼음 협곡의 북쪽 끝과 빙결 협곡의 남쪽
    // 끝을 잇는다. **양방향**이다 — 들어간 자리로 나온다 (TREE_INNER_DOOR · MAZE_HEART_GATE 의
    // 선례). 빙결 협곡에서 나가는 끝은 이 하나뿐이므로(spec SPEC-002 경계 ①) 이것이 없으면
    // 검사 ⑦(no-exit)이 걸린다.
    // 종류가 **오솔길(trail)** 인 이유 — Design 에 없다 (spec 기본형 ⑦). 협곡 안으로 난 좁은
    // 길이므로 일곱 중 그것이 가장 가깝고, 고개(pass)는 넘는 것이라 안쪽으로 드는 데 쓰지
    // 않았다. 배열 **끝**에 붙는다 — exitsOf 의 결정론이 이 순서를 따른다.
    {
      id: FROST_CANYON_TRAIL,
      from: { region: ICE_CANYON, anchor: FROST_CANYON_TRAIL },
      to: { region: FROST_CANYON, anchor: 'ICE_CANYON_SIDE' },
      direction: 'bidirectional',
      transition: 'trail',
    },
    // C020 ADDED — 빙결 심층으로 드는 문 하나. 그 너머는 **아직 짓지 않은 곳**이므로
    // 건너기 요청은 region-not-built 로 거절된다 (C002 가 세운 대답 그대로).
    // one-way 인 것은 저쪽에서 이쪽으로 오는 길을 이 Cycle 이 정하지 않았기 때문이다 —
    // 그 방을 짓는 Play 가 돌아오는 끝까지 함께 정한다 (고대 문 · 뒤집힌 정원 문 · 걷는 숲
    // 문이 그랬던 그대로). 종류가 **문(door)** 인 것은 Play §5.3 이 "문" 이라고 부르기
    // 때문이다 (기본형 ⑧ — 일곱 중 그대로 골랐다).
    // 배열 **끝**에 붙는다 — exitsOf 의 결정론이 이 순서를 따르므로 중간에 끼우지 않는다.
    {
      id: FROST_DEPTH_DOOR,
      from: { region: FROST_CANYON, anchor: FROST_DEPTH_DOOR },
      to: { region: FROST_DEPTH, anchor: 'FROST_CANYON_SIDE' },
      direction: 'one-way',
      transition: 'door',
    },
  ],
  frontiers: FRONTIER_REGIONS,
};
