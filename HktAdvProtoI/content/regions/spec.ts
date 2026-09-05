// Region Spec — 한 Region 을 컨텐츠가 적는 형 (C001 ADDED).
//
// space 는 기반(engine/world-authoring)의 Description 그대로다 — 좌표·point 만 있고 게임 명사가 없다.
// 그 위에 이 팩의 의미(id · depth 태그)를 얹은 것이 이 형이다. C001 최소형 —
// L2-World-Region §16 의 나머지 필드는 그 Region 을 실제로 쓰는 Play 가 더한다 (선행 추상화 금지).
//
// 경계 규칙 4 — content/regions 는 engine 만 import 한다. world 와 view 가 함께 읽는 데이터 폴더다.

import type { RegionDescription } from '../../engine/world-authoring/description';
import type { RegionResourceEcology } from './resource-ecology';

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
  /**
   * 그 방이 밝힌 **비상 자리**의 anchor 태그 (C009 ADDED · L2-World-Region §16 exit.emergency).
   *
   * **없으면 그 방에는 비상 자리가 없다** — "돌아가기" 명령이 가용하지 않고 걸어도 거절된다
   * (01-spec SPEC-007). 없는 곳에 지어내지 않는다: 지금 이것을 밝힌 방은 미로 하나다.
   *
   * 컨텐츠 데이터이지 State 가 아니다 — 저장되지 않고 세계가 굴러도 달라지지 않는다.
   * 규칙 코드는 이 값이 어느 방의 어느 자리인지 알지 못한다 — 아는 것은
   * "비상 자리를 밝힌 방" 뿐이다 (C004 가 세운 규율).
   *
   * 같은 방 안의 anchor 다 — 이 자리로 옮겨지는 것은 **방을 건너는 것이 아니다** (01-spec R3).
   */
  emergencyAnchor?: string;
  /**
   * 그 방이 낳는 재료 — **방이 재료를 낳는다** (C011 ADDED · RoomBearsMaterial §6 W17).
   *
   * 없으면 이 계통이 닿지 않는 방이다 — 백왕령이 그렇고, 그것은 결핍이 아니라
   * 백왕령이 안전한 이유와 **같은 조건**이다 (Play 확정 5 · Concept W2).
   *
   * 원천의 **자리**는 여기 없다. 자리는 그 방 Description 의 resource layer point 가 소유하고,
   * 원천의 id 와 point 의 tag 가 같은 이름으로 이어진다 (spec R3). 데이터가 둘로 나뉜 이유는
   * 하나다 — 자리는 땅의 일이라 Description 이 소유해야 컴파일·관찰·검사가 다 같은 것을 본다.
   */
  resourceEcology?: RegionResourceEcology;
}

/** "드나드는 곳" 을 적는 layer 이름 — Connector 의 anchor 는 이 layer 의 point 다 */
export const ANCHOR_LAYER = 'anchor';
