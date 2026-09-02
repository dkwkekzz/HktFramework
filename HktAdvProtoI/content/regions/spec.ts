// Region Spec — 한 Region 을 컨텐츠가 적는 형 (C001 ADDED).
//
// space 는 기반(engine/world-authoring)의 Description 그대로다 — 좌표·point 만 있고 게임 명사가 없다.
// 그 위에 이 팩의 의미(id · depth 태그)를 얹은 것이 이 형이다. C001 최소형 —
// L2-World-Region §16 의 나머지 필드는 그 Region 을 실제로 쓰는 Play 가 더한다 (선행 추상화 금지).
//
// 경계 규칙 4 — content/regions 는 engine 만 import 한다. world 와 view 가 함께 읽는 데이터 폴더다.

import type { RegionDescription } from '../../engine/world-authoring/description';

export interface RegionSpec {
  id: string;
  /** L2-World-Concept §3.2 의 depth 태그 — civil | outer … 문구는 View 의 표가 정한다 */
  depth: string;
  /** 그 Region 의 Local Space — Source of Truth */
  space: RegionDescription;
}

/** "드나드는 곳" 을 적는 layer 이름 — Connector 의 anchor 는 이 layer 의 point 다 */
export const ANCHOR_LAYER = 'anchor';
