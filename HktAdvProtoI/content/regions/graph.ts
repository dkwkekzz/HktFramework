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

import type { RegionGraph } from '../../engine/world-authoring/graph';
import { BIO_ORE_FIELD } from './bio-ore-field';
import { EXPLORER_RUIN } from './explorer-ruin';
import { FANTASY_MAZE } from './fantasy-maze';
import { FOREST_DEEP } from './forest-deep';
import { FOREST_EDGE } from './forest-edge';
import { HEART_LAKE } from './heart-lake';
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

// 아직 짓지 않은 방들 — Connector 가 가리키되 Description 이 없다 (01-spec SPEC-004).
// 이름만 있고 방은 없다. 지어지면 그 이름은 이 목록에서 빠지고 REGION_SPECS 로 옮겨 간다.
// C003 CHANGED — RED_EYE_TREE 가 그렇게 되었다: 이름은 이제 red-eye-tree.ts 가 소유하고
// 이 목록에는 없다 (01-spec SPEC-009 ②).
// C008 CHANGED — FANTASY_MAZE 도 그렇게 되었다 (이름은 fantasy-maze.ts 가 소유한다).
// 남은 경계는 둘이다.
export const RED_WASTE = 'RED_WASTE';
export const ICE_CANYON = 'ICE_CANYON';

/** 이 Graph 가 경계로 밝힌 이름들 — Description 이 없어도 정합 오류가 아니다 (01-spec SPEC-004) */
export const FRONTIER_REGIONS: readonly string[] = [
  RED_WASTE,
  ICE_CANYON,
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
  ],
  // 어떤 방을 통해 발견되며 세계관상 어디에 속하는가 (L2-World-Region §7 의 사슬).
  // Connectivity(Connector)와도 Spatial Embedding 과도 다른 관계다 — 자식이 부모보다 넓어도 오류가 아니다.
  // 세계 규칙 중 무엇도 이 값을 읽지 않는다: 이 Cycle 에서 중첩이 하는 일은 검사 하나뿐이다
  // (01-spec SPEC-004 경계).
  containment: [
    { parent: RED_EYE_TREE, child: TREE_INNER_WORLD },
    { parent: TREE_INNER_WORLD, child: HEART_LAKE },
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
    {
      id: ICE_CANYON_PASS,
      from: { region: WHITE_KING_DOMAIN, anchor: ICE_CANYON_PASS },
      to: { region: ICE_CANYON, anchor: 'WHITE_KING_SIDE' },
      direction: 'one-way',
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
  ],
  frontiers: FRONTIER_REGIONS,
};
