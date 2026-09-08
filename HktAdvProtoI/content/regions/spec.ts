// Region Spec — 한 Region 을 컨텐츠가 적는 형 (C001 ADDED).
//
// space 는 기반(engine/world-authoring)의 Description 그대로다 — 좌표·point 만 있고 게임 명사가 없다.
// 그 위에 이 팩의 의미(id · depth 태그)를 얹은 것이 이 형이다. C001 최소형 —
// L2-World-Region §16 의 나머지 필드는 그 Region 을 실제로 쓰는 Play 가 더한다 (선행 추상화 금지).
//
// 경계 규칙 4 — content/regions 는 engine 만 import 한다. world 와 view 가 함께 읽는 데이터 폴더다.

import type { RegionDescription } from '../../engine/world-authoring/description';
import type { RegionAccess } from './access';
import type { RegionEcology } from './ecology';
import type { RegionPhases } from './phases';
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
  /**
   * 철마다 이 방이 달라지는 것 — **방이 시계를 읽는다** (C016 ADDED · L2-World-Time §2.4 · §3).
   *
   * 없으면 철이 몇 번을 돌아도 한 값도 달라지지 않는 방이다 — 백왕령과 미로가 그렇고,
   * 그것은 결핍이 아니라 "달라지는 것은 데이터가 밝힌 것뿐" 이라는 규율이다 (원칙 T3).
   * rule?(C008) · resourceEcology?(C011) 가 없는 방이 그 계통 밖인 것과 같은 어법이다.
   *
   * **덧씌움이지 재컴파일이 아니다** (T4 · T6) — 높이도 표면도 통행 격자도 hash 도 한 값
   * 바뀌지 않고, 컴파일된 땅 위에 State 가 얹힐 뿐이다.
   *
   * 규칙 코드는 철의 이름을 알지 못한다 — 아는 것은 "위상을 밝힌 방" 뿐이고, 어느 철에
   * 무엇이 달라지는지는 여기에만 있다 (rule? 의 선례 그대로 · C004 가 세운 규율).
   */
  phases?: RegionPhases;
  /**
   * 그 방이 **묻는 것** — 방이 요구를 진다 (C029 ADDED · L2-World-Access §4.4).
   *
   * 없으면 **묻지 않는 방**이다 — 그 방의 문은 전부 언제나 활성이고 표식에 실리는 요구도
   * 없다. 지금 묻는 방은 셋(미로 · 숲 안쪽 · 빙결 협곡)이고 나머지 열은 묻지 않는다 —
   * 그것은 결핍이 아니라 "묻는 것은 데이터가 밝힌 것뿐" 이라는
   * 규율이다. rule?(C008) · resourceEcology?(C011) · phases?(C016) 가 없는 방이 그 계통 밖인
   * 것과 같은 어법이다.
   *
   * **State 가 아니다** — 저장되지 않고 세계가 굴러도 달라지지 않는다. 열렸는가(time · state)는
   * 세계의 시각과 그 방의 지금 pattern 에서 매 tick 유도된다 (C016 이 세운 그 갈래 그대로).
   *
   * 규칙 코드는 어느 문이 무엇을 요구하는지 이름으로 알지 못한다 — 아는 것은 "Lock 을 가진
   * 문" 뿐이고, 요구도 흔적도 사유도 여기에만 있다 (rule? 의 선례 그대로 · C004 가 세운 규율).
   */
  access?: RegionAccess;
  /**
   * 그 방이 품은 **생명 계통** — 무엇이 태어나고 무엇이 사는가 (C022 ADDED · Life §3.1 · §3.2).
   *
   * 없으면 이 계통이 닿지 않는 방이다 — 밝히지 않은 방은 한 값도 달라지지 않는다
   * (spec SPEC-001 경계 ①). rule?(C008) · resourceEcology?(C011) · phases?(C016) 를 밝히지
   * 않은 방이 그 계통 밖인 것과 같은 규율이다.
   *
   * C024 CHANGED — **탄생지 없이 사유만 밝히는 방도 있다** (ecology.absenceReason). 그 방은
   * 여전히 이 계통 밖이고, 다만 왜 밖인지가 세계에 적혀 있다 (Life F6 · 재료의 고립 사유와
   * 같은 어법).
   *
   * **새 layer 도 새 Rule 문법도 별도 Life System 도 나지 않는다** (F13) — 방이 밝히는 자리가
   * 하나 더 서고, 그 위에서 도는 것은 여느 세계 과정과 같은 하나다 (simulation/life-binding.ts).
   *
   * 규칙 코드는 어떤 생명도 어떤 탄생지도 이름으로 알지 못한다 — 아는 것은 "탄생지를 밝힌
   * 방" 뿐이고, 무엇이 무엇인지는 여기에만 있다 (C004 가 세운 규율).
   */
  ecology?: RegionEcology;
}

/** "드나드는 곳" 을 적는 layer 이름 — Connector 의 anchor 는 이 layer 의 point 다 */
export const ANCHOR_LAYER = 'anchor';
