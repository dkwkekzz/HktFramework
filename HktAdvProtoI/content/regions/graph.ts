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
// 그리고 이 파일이 **Connector 활성 조건 표** 하나를 새로 소유한다 (아래 CONNECTOR_ACTIVATIONS):
// 어느 문이 어느 방의 어느 패턴에서 열리는가는 규칙이 아니라 데이터가 아는 일이다.

import type { RegionGraph } from '../../engine/world-authoring/graph';
import { BIO_ORE_FIELD } from './bio-ore-field';
import { EXPLORER_RUIN } from './explorer-ruin';
import { FANTASY_MAZE, MAZE_PATTERN_P2 } from './fantasy-maze';
import { FOREST_DEEP } from './forest-deep';
import { FOREST_EDGE } from './forest-edge';
import { HEART_LAKE } from './heart-lake';
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

// 아직 짓지 않은 방들 — Connector 가 가리키되 Description 이 없다 (01-spec SPEC-004).
// 이름만 있고 방은 없다. 지어지면 그 이름은 이 목록에서 빠지고 REGION_SPECS 로 옮겨 간다.
// C003 CHANGED — RED_EYE_TREE 가 그렇게 되었다: 이름은 이제 red-eye-tree.ts 가 소유하고
// 이 목록에는 없다 (01-spec SPEC-009 ②).
// C008 CHANGED — FANTASY_MAZE 도 그렇게 되었다 (이름은 fantasy-maze.ts 가 소유한다).
// C009 CHANGED — 이름 하나가 더 늘었다: 뒤집힌 정원(INVERTED_GARDEN). 심장에서 나가는 문이
// 그것을 가리키되 그 방은 이 Play 밖이다 (01-spec 확정 5). 그 방을 짓는 Play 가 이름을 가져간다 —
// RED_EYE_TREE · FANTASY_MAZE 가 그랬듯. 경계는 셋이 된다.
export const RED_WASTE = 'RED_WASTE';
export const ICE_CANYON = 'ICE_CANYON';
export const INVERTED_GARDEN = 'INVERTED_GARDEN';

/** 이 Graph 가 경계로 밝힌 이름들 — Description 이 없어도 정합 오류가 아니다 (01-spec SPEC-004) */
export const FRONTIER_REGIONS: readonly string[] = [
  RED_WASTE,
  ICE_CANYON,
  INVERTED_GARDEN,
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
    // C009 ADDED — 심장 쪽 문 하나. 미로의 HEART_GATE anchor(구역 B 안 · C008 이 세워 두었다)와
    // 심장을 잇는다. **문은 하나이고 양방향이다** — 들어간 자리로 나온다 (TREE_INNER_DOOR 의 선례).
    // Play §5.4 가 "door Connector 하나로 들어간다" 라고만 적었으므로 되돌아오는 문을 따로
    // 세우지 않았다: 둘을 세우면 문이 둘이 되어 Design 의 "하나" 와 어긋난다.
    // 이 문만이 활성 조건을 가진다 — 아래 CONNECTOR_ACTIVATIONS.
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
  ],
  frontiers: FRONTIER_REGIONS,
};

/**
 * Connector 활성 조건 하나 — "그 방의 지금 패턴이 이 목록에 있을 때만 이 문이 활성이다".
 *
 * region 은 조건을 **가진** 방이지 이 문이 잇는 방이 아니다 (둘이 같을 이유가 없다).
 */
export interface ConnectorActivation {
  /** 어느 방의 State 를 읽는가 */
  region: string;
  /** 그 방의 패턴 이름들 — 지금 패턴이 이 중 하나면 활성이다 */
  patterns: readonly string[];
}

/**
 * **Connector 활성 조건 표** (C009 ADDED · 01-spec R1 · L2-World-Region §10 activation).
 *
 * 정적 컨텐츠 데이터다 — CLOSED_CONNECTORS 와 같은 성격이다. 세계 State 에 들어가지 않고
 * 저장되지도 않는다. 다만 CLOSED_CONNECTORS 가 "언제나 닫힘" 이라는 **정적 사실**인 것과 달리
 * 이것은 "무엇을 읽어 정하는가" 라는 **조건**이다: 답은 그 방의 지금 pattern 에서 온다.
 *
 * 여기에 없는 문은 언제나 활성이다 — 지금까지의 세계 그대로다 (01-spec SPEC-008).
 * 그래서 이 표가 비면 C008 의 세계와 한 글자도 다르지 않다.
 *
 * 세계 규칙은 이 표의 글자를 하나도 알지 못한다 (01-spec R1 비고 · C004 가 세운 규율).
 * 규칙이 아는 것은 "조건을 가진 문" 뿐이고, 어느 문이 어느 패턴에서 열리는지는 여기에만 있다 —
 * 다른 문에 조건을 주는 것도, 여는 패턴을 바꾸는 것도 코드가 아니라 이 표 한 줄이다.
 *
 * **관찰자에게는 이 표를 알려주지 않는다** — 세계는 "지금 열렸는가" 만 투영하고
 * "무엇이 그것을 열었는가" 는 말하지 않는다. 압력을 채워 보고 표식이 바뀌는 것을 보는 것이
 * 이 Cycle 의 플레이다 (01-spec Observable · Region §17).
 */
export const CONNECTOR_ACTIVATIONS: Readonly<Record<string, ConnectorActivation>> = {
  // 심장 쪽 문은 미로의 패턴이 P2 일 때만 열린다 (Play §5.6 "P2 에서만 heartAccess = OPEN" · 확정 2).
  // 되돌아올 때도 같은 조건을 읽는다 — 문이 하나이므로 조건도 하나다.
  [MAZE_HEART_GATE]: { region: FANTASY_MAZE, patterns: [MAZE_PATTERN_P2] },
};
