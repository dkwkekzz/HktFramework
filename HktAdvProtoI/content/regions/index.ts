// content/regions — 이 팩의 Region 데이터 (C001 ADDED).
//
// world 와 view 가 함께 읽는 정적 사실이다. 세계 State 에 들어가지 않고 저장되지도 않는다 —
// 컨텐츠 데이터에서 다시 온다 (02-world R7 · character-catalog 와 같은 성격).
// 소비처는 이 파일 하나만 import 한다. 경계 규칙 4 — 이 폴더는 engine 만 import 한다.

import type { RegionSpec } from './spec';
import { FOREST_EDGE_SPEC } from './forest-edge';
import { WHITE_KING_DOMAIN_SPEC } from './white-king-domain';

export type { RegionSpec } from './spec';
export { ANCHOR_LAYER } from './spec';
export { REGION_GRAPH, FOREST_PATH } from './graph';
export { WHITE_KING_DOMAIN } from './white-king-domain';
export { FOREST_EDGE } from './forest-edge';

/** 세계가 아는 Region 들 — graph.regions 와 같은 순서 */
export const REGION_SPECS: readonly RegionSpec[] = [WHITE_KING_DOMAIN_SPEC, FOREST_EDGE_SPEC];

export function regionSpec(id: string): RegionSpec | undefined {
  return REGION_SPECS.find((spec) => spec.id === id);
}
