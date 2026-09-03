// Region Graph — 이 팩의 방 사이 연결 (C001 · C002 에서 Connector 열로 는다).
//
// Connector 는 두 방의 anchor 를 잇는 전이다. 목적지의 이름은 관찰 결과에 실리지 않는다 —
// "목적지는 건너야 안다" (Play §5.1). 배열 순서가 exitsOf 의 결정론이므로 01-spec SPEC-003 의
// 표 순서를 그대로 지킨다 — FOREST_PATH 가 여전히 첫째다.
//
// C002 ADDED — 아직 짓지 않은 방을 가리키는 끝이 생겼다. 그 이름들은 frontiers 가 밝힌다:
// 밝혀진 경계는 정합 오류가 아니다 (01-spec SPEC-004). 몸이 그 방에 설 수는 없다 —
// 건너기 요청은 region-not-built 로 거절된다 (02-world R1).

import type { RegionGraph } from '../../engine/world-authoring/graph';
import { BIO_ORE_FIELD } from './bio-ore-field';
import { EXPLORER_RUIN } from './explorer-ruin';
import { FOREST_DEEP } from './forest-deep';
import { FOREST_EDGE } from './forest-edge';
import { PREDATOR_NEST } from './predator-nest';
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

// 아직 짓지 않은 방들 — Connector 가 가리키되 Description 이 없다 (01-spec SPEC-004).
// 이름만 있고 방은 없다. 지어지면 그 이름은 이 목록에서 빠지고 REGION_SPECS 로 옮겨 간다.
export const RED_EYE_TREE = 'RED_EYE_TREE';
export const FANTASY_MAZE = 'FANTASY_MAZE';
export const RED_WASTE = 'RED_WASTE';
export const ICE_CANYON = 'ICE_CANYON';

/** 이 Graph 가 경계로 밝힌 이름들 — Description 이 없어도 정합 오류가 아니다 (01-spec SPEC-004) */
export const FRONTIER_REGIONS: readonly string[] = [
  RED_EYE_TREE,
  FANTASY_MAZE,
  RED_WASTE,
  ICE_CANYON,
];

/**
 * 닫힌 Connector 의 id 들 (C002 ADDED · 01-spec SPEC-005).
 * 정적 컨텐츠 데이터다 — 세계 State 에 들어가지 않고 저장되지도 않는다.
 * 이 Cycle 에는 여는 규칙도 닫는 규칙도 없다 (Play W7).
 */
export const CLOSED_CONNECTORS: readonly string[] = [ANCIENT_GATE];

export const REGION_GRAPH: RegionGraph = {
  regions: [
    WHITE_KING_DOMAIN,
    FOREST_EDGE,
    FOREST_DEEP,
    EXPLORER_RUIN,
    PREDATOR_NEST,
    BIO_ORE_FIELD,
  ],
  containment: [],
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
  ],
  frontiers: FRONTIER_REGIONS,
};
