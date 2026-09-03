// content/regions — 이 팩의 Region 데이터 (C001 ADDED · C002 에서 방 여섯 · Connector 열).
//
// world 와 view 가 함께 읽는 정적 사실이다. 세계 State 에 들어가지 않고 저장되지도 않는다 —
// 컨텐츠 데이터에서 다시 온다 (C001 02-world R7 · character-catalog 와 같은 성격).
// 소비처는 이 파일 하나만 import 한다. 경계 규칙 4 — 이 폴더는 engine 만 import 한다.

import type { RegionSpec } from './spec';
import { BIO_ORE_FIELD_SPEC } from './bio-ore-field';
import { EXPLORER_RUIN_SPEC } from './explorer-ruin';
import { FOREST_DEEP_SPEC } from './forest-deep';
import { FOREST_EDGE_SPEC } from './forest-edge';
import { PREDATOR_NEST_SPEC } from './predator-nest';
import { WHITE_KING_DOMAIN_SPEC } from './white-king-domain';

export type { RegionSpec } from './spec';
export { ANCHOR_LAYER } from './spec';
export {
  REGION_GRAPH,
  FRONTIER_REGIONS,
  CLOSED_CONNECTORS,
  FOREST_PATH,
  RUIN_TRAIL,
  DEEP_TRAIL,
  NEST_TRAIL,
  ORE_TRAIL,
  TREE_APPROACH,
  ORE_TREE_TRAIL,
  ANCIENT_GATE,
  RED_WASTE_PASS,
  ICE_CANYON_PASS,
  RED_EYE_TREE,
  FANTASY_MAZE,
  RED_WASTE,
  ICE_CANYON,
} from './graph';
export { WHITE_KING_DOMAIN } from './white-king-domain';
export { FOREST_EDGE } from './forest-edge';
export { FOREST_DEEP } from './forest-deep';
export { EXPLORER_RUIN } from './explorer-ruin';
export { PREDATOR_NEST } from './predator-nest';
export { BIO_ORE_FIELD } from './bio-ore-field';

/** 세계가 아는 Region 들 — graph.regions 와 같은 순서 */
export const REGION_SPECS: readonly RegionSpec[] = [
  WHITE_KING_DOMAIN_SPEC,
  FOREST_EDGE_SPEC,
  FOREST_DEEP_SPEC,
  EXPLORER_RUIN_SPEC,
  PREDATOR_NEST_SPEC,
  BIO_ORE_FIELD_SPEC,
];

export function regionSpec(id: string): RegionSpec | undefined {
  return REGION_SPECS.find((spec) => spec.id === id);
}
