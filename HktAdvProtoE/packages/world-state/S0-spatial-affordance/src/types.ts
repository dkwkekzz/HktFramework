import type { EntityId } from '@hkt/k0-entity-state';
import type { PredicateCause, PredicateSpec } from '@hkt/k1-predicate-query';

/**
 * S0 의 계약 타입.
 *
 * 세계 설계 원본 [Design-MMO.md](../../../../design/Design-MMO.md) 18.4 는 **논리 공간과 표현 공간을
 * 같은 데이터로 취급하지 말라**고 못 박는다. 그래서 여기에는 메시·머티리얼·카메라가 한 칸도 없다.
 * 이동 가능성·시야·거리만 있고, 그 값들은 전부 K0 의 컴포넌트에서 읽어 온다 — 화면이 없어도 세계는
 * 굴러가야 하기 때문이다(GI-10).
 */

/** 세계 좌표 (m). K0 의 `position` 컴포넌트가 이 모양이다. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 논리 격자의 칸. 정수 좌표이며, 칸 하나가 `SpatialLayout.cellSize` 만큼의 변을 갖는다. */
export interface Cell {
  ix: number;
  iy: number;
  iz: number;
}

/**
 * 논리 공간의 배치 — 격자의 원점과 칸 크기.
 *
 * 격자를 쓰는 이유는 성능이 아니라 **판정의 재현성**이다. 연속 공간에서 경로를 찾으면 부동소수 오차가
 * 갈래를 바꾸고, 같은 세계가 서버마다 다르게 굴러간다(GI-12). 칸은 정수이므로 흔들리지 않는다.
 */
export interface SpatialLayout {
  /** 칸 한 변의 길이 (m). 0 보다 커야 한다. */
  cellSize: number;
  /** 격자에 담기는 영역의 최소 좌표 (칸 `(0,0,0)` 의 중심) */
  origin: Vec3;
  /** 각 축의 칸 수. 1 이상이어야 한다. */
  size: { x: number; y: number; z: number };
}

/** 이동·시야를 막는 실체의 컴포넌트 이름과 모양. */
export const BARRIER_COMPONENT = 'barrier';

/** `barrier` 컴포넌트의 값. 문이 열리면 두 값이 함께 거짓이 된다. */
export interface Barrier {
  /** 통과를 막는가 — 이동과 손닿음(reach) 둘 다에 걸린다 */
  solid: boolean;
  /** 시선을 막는가 */
  opaque: boolean;
}

/** 위치 컴포넌트 (K1 과 같은 이름을 쓴다 — 같은 사실을 두 이름으로 부르지 않는다). */
export const POSITION_COMPONENT = 'position';
/** 반-크기(half extent) 컴포넌트. 없으면 점으로 다룬다. */
export const EXTENT_COMPONENT = 'extent';
/** 주체가 가진 능력 이름 목록. `Affordance.requiredCapabilities` 가 이것과 대조된다. */
export const CAPABILITY_COMPONENT = 'capability';
/** 주체가 제자리에서 손을 뻗어 닿는 거리 (m). */
export const REACH_COMPONENT = 'reach';

/** 축 정렬 상자 — 충돌·점유 판정의 유일한 형태다. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

/**
 * 대상이 어떤 행동을 허용하는지.
 *
 * **원문 「10」 S0 의 `Affordance` 를 한 칸도 늘리지 않고 그대로 옮긴 것이다.**
 * `estimatedCost` 에 이동 비용을 미리 적어 두고 싶어지지만, 이동 비용은 **누가 어디에서 묻는가**에
 * 따라 달라진다 — 대상에 붙는 값이 아니다. 그래서 여기에는 행동 자체의 비용만 적고,
 * 이동 비용은 S0 이 경로에서 계산해 `AffordanceOffer.cost` 에서 합친다.
 */
export interface Affordance {
  id: string;
  verb: string;
  targetEntityId: string;
  condition: PredicateSpec;
  requiredCapabilities: string[];
  estimatedCost: Record<string, number>;
}

export const ACCESS_ISSUE = {
  NO_POSITION: 'E_NO_POSITION',
  UNKNOWN_TARGET: 'E_UNKNOWN_TARGET',
  UNKNOWN_ACTOR: 'E_UNKNOWN_ACTOR',
  OUTSIDE_GRID: 'E_OUTSIDE_GRID',
  BAD_LAYOUT: 'E_BAD_LAYOUT',
  BAD_AFFORDANCE: 'E_BAD_AFFORDANCE',
  CONDITION_UNMET: 'E_CONDITION_UNMET',
  MISSING_CAPABILITY: 'E_MISSING_CAPABILITY',
  UNREACHABLE: 'E_UNREACHABLE',
  SIGHT_BLOCKED: 'E_SIGHT_BLOCKED',
} as const;

export type AccessIssueCode = (typeof ACCESS_ISSUE)[keyof typeof ACCESS_ISSUE];

/**
 * 거절 한 줄 — **무엇이 막았는지**를 반드시 이름으로 지목한다.
 *
 * "닿을 수 없다"만 돌려주면 화면에서 "왜 이 NPC 는 저것을 집지 못하는가"에 답할 수 없다.
 * 막은 것이 벽인지 문인지 능력인지가 여기 남아야 다음 행동(문을 연다)이 나온다.
 */
export interface AccessRejection {
  code: AccessIssueCode;
  /** 세계 안 좌표 (`entity/<id>` · `affordance/<id>/condition`) */
  path: string;
  message: string;
  /** 길을 막은 실체 id (오름차순). 능력·조건 거절이면 빈 배열이다. */
  blockedBy: EntityId[];
  /** 조건이 어긋나 거절되었으면 K1 이 지목한 잎 조건들 */
  causes: PredicateCause[];
}

/** 격자 위에서 찾은 길. `found` 가 거짓이면 `cells` 는 비고 `blockedBy` 가 채워진다. */
export interface PathReport {
  found: boolean;
  /** 출발 칸부터 도착 칸까지. 출발과 도착이 같으면 칸 하나짜리 경로다. */
  cells: Cell[];
  /** 걸음 수 × `cellSize`. `cells.length - 1` 걸음이다. */
  cost: number;
  /** 살펴본 칸 수 — 판정이 아니라 성능의 근거다. */
  expanded: number;
  /** 길이 막혔을 때, 도달 가능한 영역에 맞닿아 길을 끊은 실체들 (오름차순) */
  blockedBy: EntityId[];
  reason: string;
}

/** 반경 질의의 답. `matched` 는 언제나 실체 id 오름차순이다. */
export interface RangeReport {
  matched: EntityId[];
  /** 격자에서 실제로 들여다본 칸 수 · 세계 전체 실체 수 — 성능의 근거다. */
  cellsScanned: number;
  scanned: number;
  total: number;
  reason: string;
}

/** 주체 하나에게 제시된 행동 하나. */
export interface AffordanceOffer {
  affordanceId: string;
  verb: string;
  targetEntityId: string;
  available: boolean;
  /** 선언 비용 + 이동 비용(`movement`). 열쇠 하나 이상이 반드시 있다. */
  cost: Record<string, number>;
  /** 대상에 손이 닿는 자리까지의 길. 닿을 수 없으면 막힌 경로 보고가 들어간다. */
  path: PathReport | null;
  /** 대상까지의 직선 거리 (m) */
  distance: number | null;
  /** 대상이 보이는가 — `opaque` 장애물이 시선을 끊으면 거짓이다 */
  visible: boolean;
  /** 주체와 대상을 잇는 **직선**을 끊는 `solid` 장애물들 (오름차순). 손이 닿을 거리여도 이것이 있으면 닿지 않는다. */
  lineBlockers: EntityId[];
  /** 통과하지 못한 이유들. `available` 이면 빈 배열이다. */
  refusals: AccessRejection[];
}
