// content/regions — 세계가 아는 방들의 목록 (C029 ADDED — index.ts 에서 **옮겨 온 것**이고
// 값도 차례도 한 글자 바뀌지 않았다).
//
// 옮긴 이유는 하나다 — 이 폴더 안에서 방 목록을 읽어야 하는 데이터 파일이 처음 생겼다
// (access.ts 의 Lock 색인 셋). 그것이 `index.ts` 를 부르면 index → access → index 의 순환이
// 나고, 순환의 안쪽에서 `REGION_SPECS` 를 읽는 쪽이 먼저 도는 날 그 이름은 아직 서지 않았다.
// 방 파일끼리 서로 부르지 않고 이름을 글자로 적는 이 폴더의 어법(PRESENCE_ROUTES ·
// phases.outflow)과 같은 자리의 결정이다.
//
// 소비처는 여전히 `index.ts` 하나만 부른다 — 이 파일은 그 문(門) 뒤에 있다.

import type { RegionSpec } from './spec';
import { BIO_ORE_FIELD_SPEC } from './bio-ore-field';
import { EXPLORER_RUIN_SPEC } from './explorer-ruin';
import { FANTASY_MAZE_SPEC } from './fantasy-maze';
import { FOREST_DEEP_SPEC } from './forest-deep';
import { FOREST_EDGE_SPEC } from './forest-edge';
import { FROST_CANYON_SPEC } from './frost-canyon';
import { HEART_LAKE_SPEC } from './heart-lake';
import { ICE_CANYON_SPEC } from './ice-canyon';
import { MAZE_HEART_SPEC } from './maze-heart';
import { PREDATOR_NEST_SPEC } from './predator-nest';
import { RED_EYE_TREE_SPEC } from './red-eye-tree';
import { TREE_INNER_WORLD_SPEC } from './tree-inner-world';
import { WHITE_KING_DOMAIN_SPEC } from './white-king-domain';

/** 세계가 아는 Region 들 — graph.regions 와 같은 순서 */
export const REGION_SPECS: readonly RegionSpec[] = [
  WHITE_KING_DOMAIN_SPEC,
  FOREST_EDGE_SPEC,
  FOREST_DEEP_SPEC,
  EXPLORER_RUIN_SPEC,
  PREDATOR_NEST_SPEC,
  BIO_ORE_FIELD_SPEC,
  RED_EYE_TREE_SPEC,
  TREE_INNER_WORLD_SPEC,
  HEART_LAKE_SPEC,
  FANTASY_MAZE_SPEC,
  MAZE_HEART_SPEC,
  // C019 ADDED — 고개 너머 둘. graph.regions 와 같은 차례로 배열 **끝**에 붙는다.
  ICE_CANYON_SPEC,
  FROST_CANYON_SPEC,
];

export function regionSpec(id: string): RegionSpec | undefined {
  return REGION_SPECS.find((spec) => spec.id === id);
}
