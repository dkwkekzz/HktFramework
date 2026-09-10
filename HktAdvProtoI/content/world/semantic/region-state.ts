// World Semantic — Region State (C008 ADDED)
//
// 땅의 통행이 처음으로 State 가 된다. C007 까지 방의 모든 사실은 Description 을 컴파일해
// 얻는 **유도된 사실**(semantic/terrain.ts)이었다 — 같은 데이터면 언제나 같은 답이므로
// 저장하지 않았다. 이 Cycle 이 더하는 셋(pattern · pressure · rearrangedAt)은 다르다:
// 세계가 겪은 일의 결과이므로 Description 에서 유도되지 않는다. **저장된다** —
// 스냅샷에 실리고 그래서 STATE_VERSION 이 오른다 (spec State 절 · R5).
//
// 규칙은 방의 이름을 알지 못한다. 여기가 아는 것은 "rule 을 가진 방" 뿐이고, 그 방이
// 미로인지 무엇인지는 데이터(content/regions)에만 있다 (C004 가 세운 규율).
//
// 컴파일 결과는 이 State 가 바뀌어도 한 값도 바뀌지 않는다 (spec R3 · SPEC-006 경계) —
// 열림/닫힘은 컴파일된 area 위에 State 가 덧씌워진 것이지 땅이 다시 만들어지는 것이 아니다.
//
// C017 CHANGED — 방 하나의 State 에 **소란**과 **자국**이 함께 선다. 소란은 rule? · sources? 와
// 갈려 **모든 방에 자리를 가진다** (물음표가 없다 · spec 기본형 ⑩) — 그 방이 무엇을 품었는지와
// 무관하게 어느 방에나 있는 값이기 때문이다 (Time §2.5). 그래서 지금까지 State 자체가 없던
// 방(백왕령)에도 State 가 생긴다. 자국은 있을 때만 자리를 가진다 (하나도 없으면 자리가 없다).
//
// C034 CHANGED — 방 하나가 **자기에게 일어난 일을 센다** (RegionState.history). 소란과 같은
// 어법으로 **모든 방에 선다** (물음표가 없다 · spec 기본형 ⑥) — 어느 방에나 있는 값이기
// 때문이다. 다른 것은 하나다: 이 셈은 **지워지지 않는다** (spec State 의 수명 표 · G7 의
// 다섯째 칸). 되돌아옴이 taken 을 0 으로 되돌려도, 뒤척임이 자국을 묻어도 셈은 그대로다.
//
// C012 CHANGED — 방 하나의 State 가 규칙과 원천을 **함께** 든다 (RegionState). 규칙은 통로의
// 열림/닫힘을 들고, 원천은 "몇 번 캤고 고갈되었는가" 를 든다. 둘 다 세계가 겪은 일의 결과이므로
// 저장되고, 둘 다 **없는 방에는 자리 자체가 없다** — 규칙 없는 방에 rule 을, 원천 없는 방에
// sources 를 지어내지 않는다 (C008 SPEC-007 경계의 규율 그대로).

import { tagsAt } from '../../../engine/world-authoring/query';
import {
  REGION_SPECS,
  regionSpec,
  type LifeSitePhase,
  type RegionSpec,
} from '../../regions';
import { findPopulation, leavingLifeSiteOf, lifeSitesInRegion } from './life';
import { leavingRouteOf } from './presence';
import type { WorldPosition } from './position';
import { DISTURBANCE_THRESHOLD, RECOVERY_VISIBLE_FRACTION } from './world-state';
import {
  inflowOf,
  nextStandableSite,
  remembersBrokenSites,
  sourcesInRegion,
  type ResourceSource,
} from './resource';
import { regionTerrain } from './terrain';

/** 그 방이 품은 규칙의 데이터 — content/regions 가 소유하는 형을 그대로 든다 */
export type RegionRuleSpec = NonNullable<RegionSpec['rule']>;

/** 방 하나가 기억하는 것 — 지금 열린 통로 집합의 이름 · 쌓인 압력 · 마지막으로 바뀐 시각 */
export interface RegionRuleState {
  /** 지금 열려 있는 통로 집합의 이름 (규칙 데이터의 patterns 중 하나) */
  pattern: string;
  /** 쌓인 압력 — 0 이상. 임계에서 0 으로 돌아간다 */
  pressure: number;
  /** 마지막으로 패턴이 바뀐 세계 시각. 한 번도 안 바뀌었으면 없다 */
  rearrangedAt?: number;
}

/**
 * 원천 하나의 지금 (C012 ADDED · C013 CHANGED) — 몇 번 캤고, 되돌아옴이 얼마나 왔고,
 * 지금 어느 마디에 서 있고, 어느 마디가 무너진 채 남았는가.
 *
 * 자리 · 재료 · 캘 수 있는 횟수 · 되돌아옴의 길이는 여기 없다. 그것들은 언제나 데이터에서
 * 다시 오는 정적 사실이고 (content/regions · semantic/resource.ts), 여기 있는 것은
 * **세계가 겪은 일**뿐이다.
 */
export interface ResourceSourceState {
  /** 캘 수 있는가 · 다 캤는가 · 되돌아오는 중인가 (C013 CHANGED — 셋이 되었다) */
  phase: 'available' | 'depleted' | 'recovering';
  /** 몇 번 캤는가 (0 부터). phase 에서 유도되지 않으므로 함께 저장한다. 되돌아오면 0 이다 */
  taken: number;
  /**
   * 되돌아옴이 얼마나 왔는가 — **세계 초** (C013 ADDED). available 이면 언제나 0 이다.
   * 관찰에는 실리지 않는다 — 언제 돌아오는지 세계는 말하지 않는다 (spec Observable).
   */
  progress: number;
  /**
   * 지금 선 **마디**의 번호 (C013 ADDED · 기본 0). 마디가 하나뿐인 원천은 언제나 0 이다.
   * 마디의 좌표는 여기 없다 — 데이터(presence 곡선)가 소유한다.
   */
  siteIndex: number;
  /**
   * **무너진 채 남은** 마디 번호들 (C013 ADDED) — 무너지지 않는 원천에는 자리 자체가 없다.
   * 원천이 떠나도 그 자리는 지날 수 없다 (spec R5).
   */
  collapsedSites?: number[];
}

/**
 * 그 방의 **소란** (C017 ADDED · spec State · RULE-DISTURBANCE-001).
 *
 * 그 방 안의 몸들이 한 일이 쌓이는 값이다 — 누가 했는지는 묻지 않는다 (미로의 압력의 선례).
 * 값은 0 이상 임계 이하이고(spec 기본형 ①), 위상은 그 값이 임계에 닿거나 0 에 닿을 때만
 * 갈린다 (RULE-DISTURBANCE-PHASE-001 이 유일한 판정 자리다).
 *
 * **위상은 값에서 유도되지 않는다** — 임계에서 깨어난 방은 값이 임계 아래로 내려가도
 * 0 에 닿기 전까지 깨어남 그대로다 (spec 기본형 ②). 그래서 함께 저장한다.
 */
export interface RegionDisturbanceState {
  /** 쌓인 소란 — 0 이상 DISTURBANCE_THRESHOLD 이하 */
  value: number;
  /** 그 방의 지금 위상 */
  phase: 'dormant' | 'awake';
}

/**
 * 땅에 남은 **자국** 하나 (C017 ADDED · spec State · RULE-TRACK-001).
 *
 * **누구인지는 없다** (Play 확정 11) — 관찰자의 이름도 자율 존재의 이름도 여기 없고,
 * 몇 사람이 지나갔는지도 없다. 아는 것은 자리와 가던 방향과 언제 났는가 뿐이다.
 *
 * 나이를 들지 않고 시각을 드는 것은 StrikeEvent 의 선례 그대로다 — **나이는 관찰자가 잰다.**
 */
export interface Track {
  /** 자국이 난 자리 (그 방의 Local Space 좌표) */
  position: WorldPosition;
  /** 그 몸이 그 자리에서 가던 방향 (단위 벡터 — Actor.facing 과 같은 형) */
  heading: WorldPosition;
  /** 난 세계 시각 */
  at: number;
}

/**
 * 탄생지 하나의 지금 (C022 ADDED · spec State) — 어느 phase 이고 결속이 얼마나 왔는가.
 *
 * 자리 · 형태 · 요구 · 결속의 길이는 여기 없다. 그것들은 언제나 데이터에서 다시 오는 정적
 * 사실이고 (content/regions · semantic/life.ts), 여기 있는 것은 **세계가 겪은 일**뿐이다
 * (ResourceSourceState 가 그런 그대로).
 */
export interface LifeSiteState {
  /** 맺히지 않았는가 · 맺히는 중인가 · 태어났는가 · 비었는가 — C023 CHANGED: 넷을 다 쓴다 */
  phase: LifeSitePhase;
  /**
   * **지금 phase 안에서 얼마나 왔는가** — 0..1 (C023 CHANGED).
   *
   * BINDING 이면 결속의 진행이고, SPENT 면 머묾의 진행이다. 한 값으로 둘을 함께 드는 것은
   * 그 둘이 **같은 것**이기 때문이다 — 지금 이 자리에 얼마나 머물렀는가. 나뉘어 있으면
   * phase 마다 어느 값을 볼지 규칙이 두 번 판정하게 되고, 저장되는 자리도 둘이 된다.
   *
   * BINDING 에서는 조건이 깨져도 **지워지지 않고 그 자리에 멎는다** (spec R3 · C022 기본형 ③).
   * phase 가 갈릴 때는 언제나 0 에서 다시 시작한다 — 관찰에는 실리지 않는다.
   */
  progress: number;
}

/**
 * 개체군 하나의 지금 (C022 ADDED · spec State) — 값 하나뿐이다.
 *
 * 상한도 내리는 원인도 여기 없다 — 데이터가 소유한다 (PopulationSpec).
 *
 * C023 CHANGED — **태어남이 이 값을 1 올린다** (RULE-LIFE-BIRTH-001 ④). 상한에서 멈추고,
 * 상한에 닿으면 태어남 자체가 일어나지 않는다 (반만 일어나는 자리를 만들지 않는다).
 *
 * C024 CHANGED — **값이 내린다** (RULE-POPULATION-DECLINE-001). 그래서 값 곁에 하나가 더
 * 선다: 이 철에 요구가 한 번이라도 다 찼는가. 상한도 내리는 원인도 여전히 여기 없다.
 */
export interface PopulationState {
  /** 0 과 그 개체군의 상한 사이 */
  value: number;
  /**
   * 이 철에 요구(declineWhen)가 **한 번이라도** 다 찼는가 (C024 ADDED · spec State · R3).
   *
   * **저장된다.** 철이 바뀌는 순간에만 읽히지만 그 순간까지 한 철 내내 쌓인 답이라,
   * 껐다 켠 세계가 이것을 잃으면 못 찬 것으로 읽혀 값이 억울하게 내린다.
   *
   * 철이 바뀔 때마다 **거짓으로 되돌아간다** — 그 철의 답이지 세계의 답이 아니다.
   * 요구를 밝히지 않은 개체군에서는 아무도 이 값을 건드리지 않는다 (경계 ④).
   */
  metThisSeason: boolean;
  /**
   * 그 철에 값이 **어느 쪽으로 움직였는가** (C025 ADDED · spec State · SPEC-006).
   *
   * 철이 바뀌는 자리에서 그 철의 **처음과 끝**을 견주어 적힌다 — 오르고 내려 제자리면
   * 멈춤이다 (한 철의 결과만 본다 · 경계 ③). 오르는 것과 내리는 것이 둘 이상이 되어야
   * 방향이 뜻을 가지므로 C022~C024 가 비워 둔 자리다 (Life §3.2).
   *
   * **저장된다.** 아직 한 철도 지나지 않은 개체군에는 자리 자체가 없다 — 방향이 없는 것과
   * 멈춤은 다른 말이다 (없는 것을 지어내지 않는 그 규율).
   *
   * **투영되지 않는다** (spec Observable) — 세계 안의 값이고 읽는 것은 도구뿐이다.
   */
  trend?: 'rising' | 'falling' | 'steady';
}

/**
 * 그 **원천**에 일어난 일의 셈 (C034 ADDED · spec State · D4).
 *
 * `ResourceSourceState.taken` 과 갈리는 자리다 — 저것은 "지금 몇 번 캤는가" 라 되돌아오면
 * 0 이 되고, 이것은 "여태 몇 번 캐였는가" 라 **아무것도 지우지 못한다**.
 *
 * 나이를 들지 않고 시각을 드는 것은 Track.at · RegionRuleState.rearrangedAt 의 선례
 * 그대로다 — **나이는 관찰자가 잰다**. 누가 캤는지는 여기 없다 (spec World Change 4).
 */
export interface SourceMemory {
  /** 캐인 횟수 누계 — 상한이 없다 (spec 기본형 ⑦) */
  takenTotal: number;
  /** 고갈된 횟수 — 캐서든 먹혀서든 다 캐진 그 순간마다 하나 */
  depletedTimes: number;
  /** 마지막 고갈의 세계 시각. 한 번도 고갈된 적 없으면 자리가 없다 */
  lastDepletedAt?: number;
}

/**
 * 횟수와 마지막 시각 하나 (C034 ADDED) — 깨어남과 지나감이 같은 형을 쓴다.
 *
 * 한 번도 없었으면 `times` 가 0 이고 시각의 자리가 없다 — "한 번도 없었다" 는 저장된 표시가
 * 아니라 그 둘에서 읽는 것이다 (spec State 유도되는 것).
 */
export interface MemoryCount {
  times: number;
  lastAt?: number;
}

/**
 * 방 하나에 일어난 일의 셈 — **기억** (C034 ADDED · spec State · Foundation §4.3).
 *
 * **누가 했는지는 세지 않는다** (spec World Change 4 · T2.7) — 관찰자의 이름도 수도 여기
 * 없고, 셈을 올리는 자리도 몸을 넘겨받지 않는다. 방이 세는 것은 **우리**가 한 일이다.
 *
 * **판정하지 않는다** — 이 Cycle 에서 이 값을 읽는 규칙은 하나도 없다 (spec R1 경계 ④).
 * 자리가 있는 것과 값이 찬 것이 다르다: 아무 일도 없던 방의 기억은 비어 있다 (SPEC-001 ③).
 */
export interface RegionMemory {
  /** 그 방의 원천마다 (원천 id → 셈) — **캔 적 있는 원천만** 자리를 가진다 */
  sources: Record<string, SourceMemory>;
  /** 이 방이 겪은 뒤척임의 수 — 뒤척임은 세계의 순간이므로 모든 방이 함께 센다 (spec R3 ②) */
  turns: number;
  /** 이 방이 깨어난 횟수와 마지막 시각 — 잠듦 → 깨어남의 **전이**만 센다 (spec R4) */
  awakenings: MemoryCount;
  /** 지나간 것마다 (경로 id → 셈) — **지난 적 있는 경로만** 자리를 가진다 (spec SPEC-004 ③) */
  passages: Record<string, MemoryCount>;
  /**
   * 태어난 것마다 (탄생지 id → 셈) — **태어난 적 있는 탄생지만** 자리를 가진다
   * (C037 ADDED · spec SPEC-007 · Foundation G8 의 마지막 마디 · passages 와 같은 어법).
   *
   * **옛 스냅샷에는 이 자리가 없다** — STATE_VERSION 을 올리지 않았기 때문이다 (spec 기본형 ④).
   * 그래서 읽는 쪽은 언제나 없을 수 있는 것으로 다뤄야 한다 (되살리기가 그 자리를 세운다 ·
   * semantic/persistence 의 되살리기 경로 · 셈은 0 에서 시작한다).
   */
  births: Record<string, MemoryCount>;
}

/**
 * 방 하나가 기억하는 것 (C012 CHANGED · C017 CHANGED · C034 CHANGED) —
 * 규칙 · 원천 · 소란 · 자국 · 기억을 함께 든다.
 *
 * 규칙과 원천과 자국은 있을 때만 자리를 가진다 — 규칙 없는 방의 rule 도 원천 없는 방의
 * sources 도 자국 없는 방의 tracks 도 지어내지 않는다.
 *
 * **소란만이 갈린다** (C017 · spec 기본형 ⑩) — 물음표가 없고 모든 방에 선다. 갈리는 이유는
 * 하나다: 소란은 그 방이 무엇을 품었는지와 무관하게 어느 방에나 있는 값이다 (Time §2.5).
 */
export interface RegionState {
  /** 그 방이 품은 규칙의 지금 — 규칙 없는 방에는 없다 */
  rule?: RegionRuleState;
  /** 그 방이 낳는 원천들의 지금 (원천 id → State) — 원천 없는 방에는 없다 */
  sources?: Record<string, ResourceSourceState>;
  /** 그 방의 소란 — **모든 방에 있다** */
  disturbance: RegionDisturbanceState;
  /** 그 방에 남은 자국들 (난 순서) — 하나도 없으면 자리가 없다 */
  tracks?: Track[];
  /**
   * 그 방의 탄생지들의 지금 (탄생지 id → State) — **탄생지 없는 방에는 없다** (C022 ADDED).
   * rule? · sources? 와 같은 규율이다: 없는 것을 지어내지 않는다.
   */
  lifeSites?: Record<string, LifeSiteState>;
  /** 그 방의 개체군들의 지금 (개체군 id → State) — 개체군 없는 방에는 없다 (C022 ADDED) */
  populations?: Record<string, PopulationState>;
  /**
   * 그 방의 **기억** — **모든 방에 있다** (C034 ADDED · 소란과 같은 어법 · 물음표가 없다).
   *
   * 갈리는 이유는 소란의 그것과 같다: 무엇을 품었는지와 무관하게 어느 방에나 있는 값이다.
   * 그리고 **아무것도 이것을 지우지 못한다** (spec State 수명 표) — 되돌아옴도 뒤척임도.
   */
  history: RegionMemory;
}

/** 아직 아무 일도 겪지 않은 방의 소란 — 값 0 · 잠듦 (C017 ADDED) */
export function initialDisturbanceState(): RegionDisturbanceState {
  return { value: 0, phase: 'dormant' };
}

/**
 * 아직 아무 일도 겪지 않은 방의 기억 — 셈 0 · 시각 없음 · 키 없음 (C034 ADDED).
 *
 * **짓는 자리는 하나다** (initialDisturbanceState 의 선례) — 두 벌로 만들면 기억 없는
 * State 가 생겨 형이 거짓말을 한다. 원천과 경로의 자리는 **여기서 짓지 않는다**:
 * 한 번도 캔 적 없는 원천 · 한 번도 지난 적 없는 경로에는 자리가 없는 것이 그 사실이고,
 * 자리를 미리 깔면 "아무 일도 없었다" 와 "0 번 일어났다" 가 갈리지 않는다 (SPEC-001 ③).
 */
export function initialMemory(): RegionMemory {
  return { sources: {}, turns: 0, awakenings: { times: 0 }, passages: {}, births: {} };
}

/**
 * 그 방의 State — 없으면 **여기서 세운다** (C017 ADDED).
 *
 * 소란이 모든 방에 서므로 "State 가 없는 방" 은 이제 되살린 옛 세계나 데이터에 없는 방뿐이다.
 * 그런 자리에서도 규칙이 소란을 올리거나 자국을 남길 수 있어야 하므로, State 를 짓는 자리를
 * 하나로 둔다 — 두 벌로 만들면 소란이 없는 State 가 생겨 형이 거짓말을 한다.
 *
 * C034 CHANGED — **빈 기억도 함께 짓는다.** 기억도 모든 방에 서므로 같은 이유로 여기가
 * 그 자리다 (짓는 자리는 하나다).
 */
export function regionStateOf(
  regionStates: Record<string, RegionState>,
  regionId: string,
): RegionState {
  return (regionStates[regionId] ??= {
    disturbance: initialDisturbanceState(),
    history: initialMemory(),
  });
}

/**
 * 셀 만한 일 하나 — 여섯뿐이다 (C034 ADDED · C037 CHANGED — 태어남이 여섯째다).
 *
 * **누가 했는지가 없다** (spec R1 경계 ②) — 몸을 넘겨주는 자리 자체를 두지 않았다.
 * 어느 방인지는 이 값이 아니라 부르는 쪽이 말한다 (addDisturbance 가 그런 그대로).
 */
export type MemoryEvent =
  | { kind: 'taken'; sourceId: string }
  | { kind: 'depleted'; sourceId: string }
  | { kind: 'turn' }
  | { kind: 'awakening' }
  | { kind: 'passage'; routeId: string }
  // C037 ADDED (spec R2 · SPEC-007) — 그 방의 탄생지에서 하나가 태어났다
  | { kind: 'birth'; formationId: string };

/**
 * RULE-REGION-MEMORY-001 (C034 ADDED · spec R1) — **일어난 일이 그 방의 셈이 된다**.
 *
 * 올리는 자리는 다섯(채취의 완료 · 고갈 · 뒤척임 · 깨어남 · 경로 통과)이지만 **올리는 일은
 * 여기 하나**가 한다 — 다섯 자리에서 각자 세면 자리 없던 키를 내는 법도 시각을 적는 법도
 * 다섯 벌이 되어 방이 여러 말을 한다 (addDisturbance 가 소란에 대해 하는 그 자리다).
 *
 * **조건이 없다** (spec R1 경계 ①) — 관찰자가 있는지도, 어느 철인지도, 어느 방인지도 묻지
 * 않는다. 뒤척임 · 깨어남 · 지나감은 아무도 보고 있지 않아도 도는 것이고, 방이 세는 것은
 * 본 사람이 아니라 **일어난 일**이다.
 *
 * **아무것도 판정하지 않는다** (경계 ④) — 이 셈을 읽는 규칙은 이 Cycle 에 하나도 없다.
 * 상한도 두지 않고(기본형 ⑦), 오래된 것을 버리지도 않는다.
 *
 * 자리가 없던 키는 **그 순간 난다** (경계 ③) — 한 번도 캔 적 없는 원천 · 한 번도 지난 적
 * 없는 경로에 자리가 없다는 것이 그 사실이므로, 미리 깔지 않고 일이 일어날 때 낸다.
 */
export function remember(
  regionStates: Record<string, RegionState>,
  regionId: string,
  at: number,
  event: MemoryEvent,
): void {
  // **무엇을 무엇으로 세는가 — 확정** (Human 결정):
  //   `taken` 은 **사람이 캔 것**만이다.
  //   `depleted` 는 **그 자리가 비었다**는 사실 하나다 — 캐서 비든, 먹혀서 비든(광식충이
  //   뿌리혹을 먹는다), 스러져서 비든(지나간 것이 남긴 것이 머무는 동안을 다한다) 한 셈으로
  //   센다. 누가 비웠는지로 셈을 가르면 같은 사실을 세계가 여러 말로 하게 된다.
  //   `turn` 은 **밝히지 않은 방도** 센다 — 자국을 묻는 것은 밝힌 방만이지만 뒤척임은
  //   세계의 순간이고, 방은 자기에게 일어난 일이 아니라 **일어난 일**을 센다.
  const history = regionStateOf(regionStates, regionId).history;
  switch (event.kind) {
    case 'taken': {
      memoryOfSource(history, event.sourceId).takenTotal += 1;
      return;
    }
    case 'depleted': {
      const source = memoryOfSource(history, event.sourceId);
      source.depletedTimes += 1;
      source.lastDepletedAt = at;
      return;
    }
    case 'turn': {
      // 시각을 적지 않는다 — 뒤척임은 세계의 순간이고 "언제 뒤척였는가" 는 시계가 답한다.
      history.turns += 1;
      return;
    }
    case 'awakening': {
      history.awakenings.times += 1;
      history.awakenings.lastAt = at;
      return;
    }
    case 'passage': {
      const passage = (history.passages[event.routeId] ??= { times: 0 });
      passage.times += 1;
      passage.lastAt = at;
      return;
    }
    case 'birth': {
      // C037 ADDED — 지나감과 **같은 어법**이다: 자리가 없던 열쇠는 그 순간 나고, 횟수와
      // 마지막 시각을 함께 든다. 무엇이 태어났는지는 세지 않는다 — 방이 세는 것은 그 자리에
      // 일어난 일이고, 그 탄생지가 무엇을 낳는지는 데이터가 안다 (규칙은 이름을 모른다).
      //
      // 옛 스냅샷을 되살리면 이 자리 자체가 없을 수 있다 (STATE_VERSION 을 올리지 않았다) —
      // `??=` 가 그때 빈 표를 세우므로 셈은 0 에서 시작한다 (SPEC-007 경계 ②).
      const births = (history.births ??= {});
      const birth = (births[event.formationId] ??= { times: 0 });
      birth.times += 1;
      birth.lastAt = at;
      return;
    }
  }
}

/** 그 원천의 셈 — 없으면 그 순간 난다 (아직 아무 일도 없던 원천은 자리가 없다) */
function memoryOfSource(history: RegionMemory, sourceId: string): SourceMemory {
  return (history.sources[sourceId] ??= { takenTotal: 0, depletedTimes: 0 });
}

/**
 * RULE-DISTURBANCE-001 (C017 ADDED · spec R1) — **한 일이 그 방의 소란이 된다**.
 *
 * 올리는 자리는 셋(채취의 완료 · 닿은 타격 · 건넌 뒤)이지만 **올리는 일은 여기 하나**가 한다 —
 * 세 자리에서 각자 계산하면 상한이 세 벌이 되어 방이 두 말을 한다.
 *
 * **임계에서 멈춘다** (spec 기본형 ①) — 넘친 만큼을 쌓아 두면 여럿이 오래 머문 방은 몇 철을
 * 비워도 잠들지 않는다. 위상은 여기서 건드리지 않는다: 판정은 한 자리에서만 난다
 * (RULE-DISTURBANCE-PHASE-001 · spec R3 경계 ②).
 *
 * 규칙은 방의 이름도, 무엇이 이 값을 올렸는지도 묻지 않는다 — 아는 것은 "그 일이 일어난 방"
 * 하나뿐이다 (spec R1 경계 ③).
 */
export function addDisturbance(
  regionStates: Record<string, RegionState>,
  regionId: string,
  amount: number,
): void {
  const disturbance = regionStateOf(regionStates, regionId).disturbance;
  disturbance.value = Math.min(DISTURBANCE_THRESHOLD, disturbance.value + amount);
}

/** 거절 사유 코드 — 지금 패턴이 열지 않은 통로다. 문구는 View 의 표가 옮긴다 */
export const PASSAGE_CLOSED = 'passage-closed';

/** 그 방이 품은 규칙 — 없으면 규칙 없는 방이다 (State 도 서지 않는다) */
export function regionRuleOf(regionId: string): RegionRuleSpec | undefined {
  return regionSpec(regionId)?.rule;
}

/**
 * **아직 아무 일도 겪지 않은 원천의 State** (C012 ADDED · C013 · C014 CHANGED · C016 CHANGED).
 *
 * 캘 수 있고 · 한 번도 캐지 않았고 · 되돌아올 것이 없고(progress 0) · 첫 마디에 선다.
 * 무너진 마디는 하나도 없으므로 collapsedSites 는 자리 자체가 없다 (빈 배열로 지어내지 않는다).
 *
 * 다만 **유입 흐름을 가진 원천은 처음이 고갈이다** (C014 · spec R4). 실려 와야 생기는 것이므로
 * 세계가 설 때는 아직 거기 없고, 관찰자에게 "아직 실려 오지 않았다" 와 "다 캐 갔다" 는 같은
 * 사실이다 — 거기 지금 없다는 것. phase 를 넷으로 늘리지 않고 C013 의 셋으로 같은 것을 말한다.
 * 규칙이 스스로 도달할 수 있는 State 만 세운다: 다 캔 것과 한 값도 다르지 않다
 * (taken = harvests · progress 0).
 *
 * **어느 원천인지 이름으로 알지 못한다** — 아는 것은 "유입 흐름을 가진 원천" 이라는 형뿐이고,
 * 흐름의 표는 데이터의 것이다 (C014 R13).
 *
 * C016 CHANGED — 이 자리가 **둘에게 쓰인다.** 세계가 설 때(createRegionStates)와 세계가
 * 뒤척일 때(RULE-SEASON-TURN-001 의 자국 묻기)가 같은 "처음 상태" 를 물으므로 한 자리에서
 * 답한다 — 두 벌로 만들면 갈린다. 묻는다는 것이 "다 채워 준다" 가 아니라 "없던 일로 한다"
 * 라는 뜻인 것이 여기서 나온다 (spec 기본형 ⑦): 처음이 고갈인 원천은 고갈로 돌아간다.
 *
 * C018 CHANGED (spec R6 · 기본형 ⑧) — **지나가야만 서는 원천도 처음이 고갈이다.** 실려 와야
 * 생기는 것과 **같은 사실**이기 때문이다: 세계가 설 때 아직 아무것도 지나가지 않았으므로
 * 거기 없고, 관찰자에게 "아직 지나가지 않았다" 와 "다 캐 갔다" 는 같은 것 — 거기 지금 없다.
 * phase 를 넷으로 늘리지 않고 C013 의 셋으로 같은 것을 말한다.
 *
 * C025 는 이 자리를 **한 글자도 건드리지 않는다** (spec REUSED · SPEC-003). 관계가 남기는
 * 원천(둥지의 사체)은 세계가 설 때 **거기 있다** — spec 이 처음을 고갈이라 말하지 않았고,
 * 밝히지 않은 것을 지어내지 않는다. 갈아 끼워진 것은 처음이 아니라 **되돌아옴**이다: 한 번
 * 없어지고 나면 시간이 그것을 되돌리지 않고 `condition-unmet` 이 걸린 채 다음 사냥을
 * 기다린다 (RULE-SOURCE-CONDITION-001 · semantic/resource.ts).
 *
 * **어느 원천인지 이름으로 알지 못한다** — 아는 것은 "유입 흐름을 가진 원천" 과 "누군가
 * 지나가며 남기는 원천" 이라는 형 둘뿐이고, 흐름의 표도 경로의 표도 데이터의 것이다.
 */
export function initialSourceState(source: ResourceSource): ResourceSourceState {
  return inflowOf(source.id) || leavingRouteOf(source.id) || leavingLifeSiteOf(source.id)
    ? { phase: 'depleted', taken: source.harvests, progress: 0, siteIndex: 0 }
    : { phase: 'available', taken: 0, progress: 0, siteIndex: 0 };
}

/**
 * **원천을 다 캔 것으로 만드는 전이** — RULE-MINE-COMPLETE-001 · RULE-LIFE-BIRTH-001 ②
 * (C023 ADDED · spec SPEC-002).
 *
 * 이 전이를 내는 자리는 **하나뿐이다.** 캐서 고갈되는 것과 태어남이 먹어 고갈되는 것은
 * 원인만 다르고 State 는 **글자 하나 다르지 않아야** 하기 때문이다 — 두 벌로 만들면
 * 캔 것과 먹힌 것이 갈리고, 그러면 관찰자가 보는 "다 캐 간 자리" 가 두 가지가 된다
 * (initialSourceState 가 세계가 설 때와 뒤척일 때의 "처음" 을 한 자리에서 답하는 그 규율).
 *
 * 캔 횟수를 다 채우고 · phase 는 고갈이고 · 되돌아옴의 진행은 0 에서 시작한다. 무너지는
 * 원천 · 깨진 자리가 자락을 거는 원천은 **지금 마디**를 기억한다 (remembersBrokenSites) —
 * 이미 있는 마디를 두 번 더하지 않는다.
 *
 * **어느 원천인지 이름으로 알지 못한다** — 받는 것은 그 원천의 성질과 지금 State 뿐이다.
 */
export function depleteSourceState(
  source: ResourceSource,
  sourceState: ResourceSourceState,
): void {
  sourceState.taken = source.harvests;
  sourceState.phase = 'depleted';
  sourceState.progress = 0;
  if (remembersBrokenSites(source)) {
    const collapsed = (sourceState.collapsedSites ??= []);
    if (!collapsed.includes(sourceState.siteIndex)) collapsed.push(sourceState.siteIndex);
  }
}

/**
 * **원천을 다시 캘 수 있게 세우는 전이** — RULE-SOURCE-RECOVERY-001 · RULE-LIFE-BIRTH-001 ③
 * (C023 ADDED · spec SPEC-004).
 *
 * 위 `depleteSourceState` 의 짝이고 같은 규율이다 — 시간이 되돌려 세우는 것과 탄생이 세우는
 * 것은 원인만 다르고 State 는 같아야 한다. 캔 횟수가 0 으로 돌아가지 않으면 돌아온 것이
 * 아니다 (C013 기본형 ⑥). **자리는 건드리지 않는다** — 어느 마디에 서는가는 되돌아옴의
 * 세계 과정이 자기 문턱에서 정하는 일이고, 여기서 두 번 정하지 않는다.
 */
export function standSourceState(sourceState: ResourceSourceState): void {
  sourceState.phase = 'available';
  sourceState.taken = 0;
  sourceState.progress = 0;
}

/**
 * 세계가 설 때의 Region State 들 — `rule` 을 가진 방은 첫 패턴 · 압력 0 으로,
 * 원천을 가진 방은 원천마다 available · taken 0 으로 선다 (C012 CHANGED).
 * 다만 **유입 흐름을 가진 원천은 고갈로 선다** (C014 CHANGED · spec R4).
 *
 * C017 CHANGED — **모든 방이 State 를 가진다.** 소란이 어느 방에나 있는 값이기 때문이다
 * (spec 기본형 ⑩ · Time §2.5). 그래서 규칙도 원천도 없던 방(백왕령)에도 자리가 생기고,
 * 그 자리에 있는 것은 소란 하나뿐이다.
 *
 * 규칙 없는 방에 rule 은, 원천 없는 방에 sources 는, 자국 없는 방에 tracks 는 자리 자체가
 * 없다 — 없는 것을 지어내지 않는다 (SPEC-007 경계). 그 규율은 한 값도 바뀌지 않았다.
 * 되살린 세계는 이것을 부르지 않는다: State 는 스냅샷에서 그대로 온다 (SPEC-009).
 *
 * 원천의 자리는 여기서 짓지 않는다 — **서 있는 원천**(RULE-RESOURCE-PLACEMENT-001 이 세운 것)
 * 에게만 State 를 준다. 데이터에 적혀 있어도 자리를 못 얻은 원천은 세계에 없기 때문이다.
 */
export function createRegionStates(): Record<string, RegionState> {
  const states: Record<string, RegionState> = {};
  for (const spec of REGION_SPECS) {
    // 소란은 모든 방에 선다 — 값 0 · 잠듦 (C017 CHANGED).
    // C034 CHANGED — 기억도 그렇다: 빈 기억이 함께 선다 (셈 0 · 시각 없음 · 키 없음).
    const state: RegionState = {
      disturbance: initialDisturbanceState(),
      history: initialMemory(),
    };

    const first = spec.rule?.patterns[0];
    if (first) state.rule = { pattern: first.name, pressure: 0 };

    const sources = sourcesInRegion(spec.id);
    if (sources.length > 0) {
      const sourceStates: Record<string, ResourceSourceState> = {};
      // 처음 상태를 짓는 자리는 하나다 (위 initialSourceState) — 세계가 설 때와 세계가
      // 뒤척일 때가 같은 것을 묻기 때문이다 (C016 spec R8).
      for (const source of sources) sourceStates[source.id] = initialSourceState(source);
      state.sources = sourceStates;
    }

    // C022 CHANGED — 탄생지와 개체군이 함께 선다. 탄생지는 **맺히지 않은 채**(DORMANT ·
    // 진행 0), 개체군은 **0** 으로 선다 — 규칙이 스스로 도달할 수 있는 자리다 (아직 아무
    // 일도 겪지 않았다는 뜻이고, 처음은 결속이므로 아직 아무것도 살지 않는다 · 확정 2).
    // 밝히지 않은 방에는 자리 자체가 없다 (rule · sources 의 규율 그대로).
    //
    // 탄생지의 자리는 여기서 짓지 않는다 — **서 있는 탄생지**(lifeSitesInRegion 이 세운 것)
    // 에게만 State 를 준다. 데이터에 적혀 있어도 자리를 못 얻은 탄생지는 세계에 없다.
    const sites = lifeSitesInRegion(spec.id);
    if (sites.length > 0) {
      const siteStates: Record<string, LifeSiteState> = {};
      for (const site of sites) siteStates[site.id] = { phase: 'DORMANT', progress: 0 };
      state.lifeSites = siteStates;
    }

    const populations = spec.ecology?.populations ?? [];
    if (populations.length > 0) {
      const populationStates: Record<string, PopulationState> = {};
      // C024 CHANGED — 이 철에 요구가 찼는지도 함께 든다. 아직 아무 일도 겪지 않은 세계는
      // **거짓**에서 선다 — 없는 것을 찬 것으로 읽지 않는다 (원천이 available 로 서는 것과
      // 반대쪽이지만 같은 규율이다: 그 철이 시작된 뒤 실제로 차야 참이 된다).
      for (const population of populations) {
        populationStates[population.id] = { value: 0, metThisSeason: false };
      }
      state.populations = populationStates;
    }

    states[spec.id] = state;
  }
  return states;
}

/**
 * 순환의 **다음 한 칸** — 배열 순서가 곧 다음 패턴이고 마지막 다음은 처음이다.
 * 모르는 이름이면 처음으로 되돌린다 (데이터가 바뀐 뒤 되살린 세계).
 */
export function nextPatternName(rule: RegionRuleSpec, current: string): string {
  const patterns = rule.patterns;
  const index = patterns.findIndex((pattern) => pattern.name === current);
  const next = patterns[(index + 1) % patterns.length] ?? patterns[0];
  return next ? next.name : current;
}

/**
 * 지금 열려 있는 통로 태그들 — 패턴 표에서 그 이름의 줄을 읽는다.
 * 모르는 이름이면 열린 통로가 없다 (지어내지 않는다).
 */
export function openPassageTags(rule: RegionRuleSpec, pattern: string): readonly string[] {
  return rule.patterns.find((entry) => entry.name === pattern)?.open ?? [];
}

/**
 * 그 자리가 **지금 닫혀 있는 통로 안**인가 — RULE-MOVE-001 의 새 전제가 읽는다.
 *
 * 자리 판정은 컴파일 결과에 그대로 묻는다 (`tagsAt`) — 통로는 컴파일된 area 이고,
 * State 는 그 위에 열림/닫힘만 덧씌운다. 규칙 없는 방 · 땅이 없는 방 · 통로 밖의 자리는
 * 언제나 거짓이다 — 이 전제가 없는 것과 같다.
 *
 * 겹친 통로 area 가 여럿이면 **하나라도 열려 있으면 열린 자리**로 친다 — 닫힘이 이기면
 * 열린 통로 위를 걸으면서도 막히는 자리가 생긴다.
 */
export function isClosedPassageAt(
  regionStates: Record<string, RegionState>,
  regionId: string,
  position: WorldPosition,
): boolean {
  const rule = regionRuleOf(regionId);
  const regionState = regionStates[regionId]?.rule;
  if (!rule || !regionState) return false;
  const terrain = regionTerrain(regionId);
  if (!terrain) return false;

  const here = tagsAt(terrain, position.x, position.z, rule.passageLayer);
  if (here.length === 0) return false;
  const open = openPassageTags(rule, regionState.pattern);
  return !here.some((tag) => open.includes(tag));
}

/**
 * 세계가 설 때의 패턴을 밝힌 대로 세운다 — 검증·촬영용 초기 배치 (C009 ADDED · WorldSetup.regionPatterns).
 *
 * 규칙을 하나도 바꾸지 않는다: 여기서 세운 패턴도 그 다음부터는 압력이 굴린다.
 * 밝히지 않은 방은 첫 패턴 그대로다.
 *
 * 손잡이가 세계를 깨뜨리지 않게 **모르는 것은 조용히 무시한다** — 규칙 없는 방의 이름도,
 * 그 방의 패턴 표에 없는 이름도 그냥 지나간다 (없는 패턴을 세우면 열린 통로가 하나도 없는
 * 방이 되어 몸이 갇힌다).
 */
export function applyPatternSetup(
  states: Record<string, RegionState>,
  patterns: Record<string, string> | undefined,
): Record<string, RegionState> {
  if (!patterns) return states;
  for (const [regionId, name] of Object.entries(patterns)) {
    const state = states[regionId]?.rule;
    const rule = regionRuleOf(regionId);
    if (!state || !rule) continue;
    if (!rule.patterns.some((entry) => entry.name === name)) continue;
    state.pattern = name;
  }
  return states;
}

/**
 * 세계가 설 때 방의 **소란이 얼마나 쌓여 있는가**를 밝힌 대로 세운다 —
 * 검증·촬영용 초기 배치 (C017 ADDED · WorldSetup.disturbances).
 *
 * regionPatterns · sourcePhases 와 **같은 갈래**의 손잡이다: 해서 닿을 수 있는 값을 하지 않고
 * 시작하기 위한 것이며 **세계의 규칙을 하나도 바꾸지 않는다.** 임계(300)에 닿으려면 한 방에서
 * 서른 번을 캐야 하고 그 사이 원천이 고갈과 되돌아옴을 여러 바퀴 도는데, 촬영 하네스의 요청
 * 왕복은 그 시간을 기다릴 수 없다. 규칙이 그 값으로 데려간다는 것은 시나리오 테스트가 증명하고,
 * 그림은 **그 값에서 무엇이 보이는가**를 보인다.
 *
 * **위상은 여기서 세우지 않는다** — 값만 두면 다음 Tick 에 세계 자신의 규칙
 * (RULE-DISTURBANCE-PHASE-001)이 깨우거나 재운다. 손잡이가 위상을 직접 쓰면 값과 위상이
 * 어긋난 State 가 생기고, 그것은 규칙이 스스로 도달할 수 없는 자리다.
 *
 * 손잡이가 세계를 깨뜨리지 않게 **모르는 것은 조용히 무시한다** — 이 세계에 없는 방 이름도,
 * 수가 아닌 값도 그냥 지나간다. 값은 0 과 임계 사이로 잘린다 (기본형 ①).
 */
export function applyDisturbanceSetup(
  states: Record<string, RegionState>,
  values: Record<string, number> | undefined,
): Record<string, RegionState> {
  if (!values) return states;
  for (const [regionId, value] of Object.entries(values)) {
    const state = states[regionId];
    if (!state) continue;
    if (!Number.isFinite(value)) continue;
    state.disturbance.value = Math.min(DISTURBANCE_THRESHOLD, Math.max(0, value));
  }
  return states;
}

/**
 * 세계가 설 때 원천이 **어느 phase 로 서는가**를 밝힌 대로 세운다 —
 * 검증·촬영용 초기 배치 (C012 ADDED · WorldSetup.sourcePhases).
 *
 * regionPatterns 와 **같은 갈래**의 손잡이다: 캐서 닿을 수 있는 State 를 캐지 않고
 * 시작하기 위한 것이며 **세계의 규칙을 하나도 바꾸지 않는다.** 여기서 세운 phase 위에서도
 * 채취(RULE-MINE-001 · -COMPLETE-001)와 자국의 셋(외형 · 흔적 · 통행)이 그대로 굴러간다.
 *
 * **규칙이 스스로 도달할 수 있는 State 만 세운다** — phase 와 나머지가 어긋난 State 를
 * 만들지 않는다 (C013 CHANGED · spec R1 · R6 의 전이를 그대로 흉내 낸다).
 *   depleted    taken = harvests · progress 0 · 무너지는 원천이면 collapsedSites 에 지금 마디
 *   recovering  taken = harvests · progress = 눈에 보이기 시작하는 임계 ·
 *               자리를 옮기는 원천이면 siteIndex 가 다음 마디 · 무너지는 원천이면 옛 마디가 무너진 채
 *   available   taken 0 · progress 0 (아직 아무 일도 겪지 않은 것과 같다)
 *
 * 손잡이가 세계를 깨뜨리지 않게 **모르는 것은 조용히 무시한다** — 서 있지 않은 원천 id 도,
 * 이 세계에 없는 phase 이름도 그냥 지나간다 (applyPatternSetup 의 선례).
 */
export function applySourcePhaseSetup(
  states: Record<string, RegionState>,
  phases: Record<string, string> | undefined,
): Record<string, RegionState> {
  if (!phases) return states;
  for (const [regionId, regionState] of Object.entries(states)) {
    if (!regionState.sources) continue;
    for (const source of sourcesInRegion(regionId)) {
      const phase = phases[source.id];
      const sourceState = regionState.sources[source.id];
      if (!sourceState) continue;
      if (phase === 'available') {
        sourceState.phase = 'available';
        sourceState.taken = 0;
        sourceState.progress = 0;
      } else if (phase === 'depleted') {
        sourceState.phase = 'depleted';
        sourceState.taken = source.harvests;
        sourceState.progress = 0;
        // 지금 마디에서 고갈되었으므로 그 마디가 깨진다 (RULE-MINE-COMPLETE-001 이 하는 그대로 ·
        // C020 CHANGED — 기억하는 이유가 둘이다: 무너지거나 · 깨진 자리가 자락을 걸거나)
        if (remembersBrokenSites(source)) sourceState.collapsedSites = [sourceState.siteIndex];
      } else if (phase === 'recovering') {
        sourceState.phase = 'recovering';
        sourceState.taken = source.harvests;
        sourceState.progress = source.recoverySeconds * RECOVERY_VISIBLE_FRACTION;
        // 캐서 고갈된 마디는 무너진 채 남고, 자리를 옮기는 원천은 그 다음 마디로 옮겨 선다
        // (RULE-SOURCE-RECOVERY-001 이 임계를 넘을 때 하는 그대로 · 옛 마디를 먼저 무너뜨린다)
        const here = sourceState.siteIndex;
        if (remembersBrokenSites(source)) sourceState.collapsedSites = [here];
        const next = nextStandableSite(source, here, sourceState.collapsedSites);
        if (next !== null) sourceState.siteIndex = next;
      }
    }
  }
  return states;
}

/**
 * 세계가 설 때 탄생지가 **어느 phase 로 서는가**를 밝힌 대로 세운다 —
 * 검증·촬영용 초기 배치 (C022 ADDED · WorldSetup.lifeSitePhases).
 *
 * sourcePhases · disturbances 와 **같은 갈래**의 손잡이다: 기다려서 닿을 수 있는 State 를
 * 기다리지 않고 시작하기 위한 것이며 **세계의 규칙을 하나도 바꾸지 않는다.** 여기서 세운
 * phase 위에서도 결속(RULE-LIFE-BINDING-001)과 전조의 셋(외형 · 흔적 · 걸린 것)이 그대로
 * 굴러간다 — 조건이 차 있지 않으면 다음 Tick 에 규칙이 스스로 DORMANT 로 되돌린다.
 *
 * **규칙이 스스로 도달할 수 있는 State 만 세운다** (spec 손잡이의 규율) — 진행은 언제나
 * 0 이다: 결속은 오르는 것이고, 오른 만큼을 손잡이가 지어내면 "그 자리에 멎었다" 와
 * "여기까지 왔다" 가 갈리지 않는다.
 *   dormant  맺히지 않은 채 · 진행 0
 *   binding  맺히는 채 · 진행 0 (조건이 다 차 있으면 그 자리에서 이어 오른다)
 *   born     태어난 그 tick · 진행 0 (다음 Tick 에 세계가 SPENT 로 넘긴다 · C023 ADDED)
 *   spent    터진 채 머무는 참 · 진행 0 (거기서부터 세계 시간이 흐른다 · C023 ADDED)
 *
 * C023 CHANGED — **phase 넷을 다 받는다.** 규칙이 넷을 다 도므로 넷 다 규칙이 스스로 도달할
 * 수 있는 자리가 되었기 때문이다. 진행은 여전히 언제나 0 이다 — 결속도 머묾도 오르는
 * 것이고, 오른 만큼을 손잡이가 지어내면 "그 자리에 멎었다" 와 "여기까지 왔다" 가 갈리지
 * 않는다. **태어남을 여기서 일으키지 않는다**: born 으로 세워도 먹지도 세우지도 않고
 * 값도 오르지 않는다 — 다섯이 함께 움직이는 자리는 규칙 하나뿐이다 (원칙 4).
 *
 * 손잡이가 세계를 깨뜨리지 않게 **모르는 것은 조용히 무시한다** — 서 있지 않은 탄생지 id 도,
 * 이 세계에 없는 phase 이름도 그냥 지나간다 (applySourcePhaseSetup 의 선례).
 */
export function applyLifeSitePhaseSetup(
  states: Record<string, RegionState>,
  phases: Record<string, string> | undefined,
): Record<string, RegionState> {
  if (!phases) return states;
  for (const [regionId, regionState] of Object.entries(states)) {
    if (!regionState.lifeSites) continue;
    // 데이터의 탄생지 순서로 돈다 — State 의 키 순서에 기대지 않는다 (결정론).
    for (const site of lifeSitesInRegion(regionId)) {
      const wanted = phases[site.id];
      const siteState = regionState.lifeSites[site.id];
      if (!siteState) continue;
      if (wanted === 'dormant') {
        siteState.phase = 'DORMANT';
        siteState.progress = 0;
      } else if (wanted === 'binding') {
        siteState.phase = 'BINDING';
        siteState.progress = 0;
      } else if (wanted === 'born') {
        siteState.phase = 'BORN';
        siteState.progress = 0;
      } else if (wanted === 'spent') {
        siteState.phase = 'SPENT';
        siteState.progress = 0;
      }
    }
  }
  return states;
}

/**
 * 세계가 설 때 개체군의 **값이 얼마인가**를 밝힌 대로 세운다 —
 * 검증·촬영용 초기 배치 (C022 ADDED · WorldSetup.populations).
 *
 * disturbances 와 **같은 갈래**의 손잡이다: 이 Cycle 에는 값을 올리는 것이 세계에 하나도
 * 없으므로(SPEC-007 경계 ①), "값이 0 이 아니면 결속이 서지 않는다" 를 재려면 그 값을 세우고
 * 시작해야 한다. **세계의 규칙은 하나도 바뀌지 않는다** — 세우는 것은 값뿐이다.
 *
 * 손잡이가 세계를 깨뜨리지 않게 **모르는 것은 조용히 무시한다** — 이 세계에 없는 개체군도,
 * 수가 아닌 값도 그냥 지나간다. 값은 0 과 그 개체군의 상한 사이로 잘린다.
 */
export function applyPopulationSetup(
  states: Record<string, RegionState>,
  values: Record<string, number> | undefined,
): Record<string, RegionState> {
  if (!values) return states;
  for (const [populationId, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) continue;
    const population = findPopulation(populationId);
    if (!population) continue;
    const populationState = states[population.regionId]?.populations?.[populationId];
    if (!populationState) continue;
    populationState.value = Math.min(population.scale, Math.max(0, value));
  }
  return states;
}
