// Region Graph — 이 팩의 방 사이 연결 (C001).
//
// Connector 하나 FOREST_PATH — 백왕령의 anchor FOREST_PATH ⇄ 숲 가장자리의 anchor FOREST_PATH.
// 양방향 · transition road. 목적지의 이름은 관찰 결과에 실리지 않는다 — "목적지는 건너야 안다".

import type { RegionGraph } from '../../engine/world-authoring/graph';
import { FOREST_EDGE } from './forest-edge';
import { WHITE_KING_DOMAIN } from './white-king-domain';

export const FOREST_PATH = 'FOREST_PATH';

export const REGION_GRAPH: RegionGraph = {
  regions: [WHITE_KING_DOMAIN, FOREST_EDGE],
  containment: [],
  connectors: [
    {
      id: FOREST_PATH,
      from: { region: WHITE_KING_DOMAIN, anchor: FOREST_PATH },
      to: { region: FOREST_EDGE, anchor: FOREST_PATH },
      direction: 'bidirectional',
      transition: 'road',
    },
  ],
};
