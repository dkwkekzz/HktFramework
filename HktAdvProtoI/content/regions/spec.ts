// Region Spec — 한 Region 을 컨텐츠가 적는 형 (C001 ADDED).
//
// space 는 기반(engine/world-authoring)의 Description 그대로다 — 좌표·point 만 있고 게임 명사가 없다.
// 그 위에 이 팩의 의미(id · depth 태그)를 얹은 것이 이 형이다. C001 최소형 —
// L2-World-Region §16 의 나머지 필드는 그 Region 을 실제로 쓰는 Play 가 더한다 (선행 추상화 금지).
//
// 경계 규칙 4 — content/regions 는 engine 만 import 한다. world 와 view 가 함께 읽는 데이터 폴더다.

import type { RegionDescription } from '../../engine/world-authoring/description';

/**
 * 그 방이 품은 규칙의 데이터 — **방이 규칙을 품는다** (C008 ADDED · RuleBoundRoom §5.2).
 * 없으면 규칙 없는 방이다 (Region State 도 서지 않는다).
 *
 * 규칙 코드는 방 이름을 알지 못한다 (C004 가 세운 규율) — 세계가 아는 것은 "rule 을 가진 방" 뿐이고,
 * 어느 방이 그런 방인지는 이 데이터에만 있다. 패턴을 더하거나 통로를 더하거나 임계를 바꾸는 것은
 * 코드가 아니라 이 자리다 (RuleBoundRoom 불변 조건 — 코드 변경 없이 폴리싱).
 */
export interface RegionRuleSpec {
  /** 통로 패턴의 **순환** — 배열 순서가 곧 다음 패턴이다. 마지막 다음은 처음 */
  patterns: readonly { name: string; open: readonly string[] }[];
  /** 압력이 이 값 이상이면 다음 패턴으로 (P) */
  pressureLimit: number;
  /** 움직인 거리 1 이 올리는 압력 (k) */
  pressurePerDistance: number;
  /** 어느 layer 의 area 가 통로인가 — 기반도 규칙도 'passage' 라는 말을 모른다 */
  passageLayer: string;
}

export interface RegionSpec {
  id: string;
  /** L2-World-Concept §3.2 의 depth 태그 — civil | outer … 문구는 View 의 표가 정한다 */
  depth: string;
  /** 그 Region 의 Local Space — Source of Truth */
  space: RegionDescription;
  /** 이 방이 품은 규칙 (C008 ADDED). 있는 방에만 Region State 가 선다 */
  rule?: RegionRuleSpec;
}

/** "드나드는 곳" 을 적는 layer 이름 — Connector 의 anchor 는 이 layer 의 point 다 */
export const ANCHOR_LAYER = 'anchor';
