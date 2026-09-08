// content/regions — 방이 품은 **생명 계통**의 데이터 계약 (C022 ADDED · Life §3.1 · §3.2).
//
// `RegionSpec.ecology` 가 이 형이다 — 그 방의 **탄생지**(lifeFormation)와 **개체군**(populations).
// 새 layer 도 새 Rule 문법도 별도 Life System 도 만들지 않는다 (F13): 방이 규칙을 품고
// (rule? · C008) 재료를 낳는(resourceEcology? · C011) 그 자리 곁에 하나가 더 서는 것뿐이다.
//
// **밝히지 않은 방은 한 값도 달라지지 않는다** — 지금 이것을 밝힌 방은 하나뿐이다 (SPEC-001 경계 ①).
// rule? · resourceEcology? · phases? 를 밝히지 않은 방이 그 계통 밖인 것과 같은 규율이다.
//
// **규칙 코드는 어떤 탄생지도 이름으로 알지 못한다** — 아는 것은 "탄생지를 밝힌 방" ·
// "요구를 밝힌 탄생지" 라는 형뿐이고, 조건 코드의 글자까지 여기 데이터가 준다 (R13).

import type { LifeFormationMode } from './lives';

/**
 * 탄생지의 phase 넷 (spec State 절) — 이 Cycle 이 오가는 것은 앞의 둘이다.
 *
 *   DORMANT  맺히지 않았다 (요구가 다 차 있지 않다)
 *   BINDING  맺히는 중이다 (요구가 다 차 있다 · 진행이 오른다)
 *   BORN     태어났다 (C023)
 *   SPENT    비었다 (C023)
 */
export type LifeSitePhase = 'DORMANT' | 'BINDING' | 'BORN' | 'SPENT';

// ── 이 세계의 Region Rule id (C022 ADDED · Play §5.2) ─────────────────
//
// 세계 원인(FOREST_CHAIN)과 **같은 갈래의 상수**다: 코드일 뿐이고 사람이 읽을 문구는 View 의
// 표가 옮긴다. 탄생지가 자기를 일으키는 규칙을 이 이름으로 가리키고, 검사 ㉗ 이 그 이름이
// 세계에 실제로 있는지를 잰다 (없으면 끊긴 참조다).

/** 숲의 뿌리에 알집이 맺히는 규칙 */
export const RULE_FOREST_CLUTCH = 'RULE_FOREST_CLUTCH';

/** 세계가 아는 Region Rule id 들 — 검사 계약이 이것을 기반에 건넨다 */
export const REGION_RULE_IDS: readonly string[] = [RULE_FOREST_CLUTCH];

// ── 결속이 모자랄 때의 조건 코드 (C022 ADDED · spec R2 경계 ②) ───────
//
// **요구마다 자기 모자람 코드를 데이터가 밝힌다** — 규칙은 무엇이 모자란지 이름으로 알지
// 못하고 밝혀진 글자를 그대로 걸 뿐이다. 원천의 조건 코드(RECOVERY_STALLED · CONDITION_UNMET)
// 와 같은 갈래이고, 사람이 읽을 문구는 View 의 표가 옮긴다.

/** 쌓인 광물이 없다 (뿌리혹이 available 이 아니다) */
export const LIFE_NEEDS_MATERIAL = 'life-needs-material';
/** 삭은 것이 없다 (둥지의 균사가 available 이 아니다 — **다른 방의 원천**이다) */
export const LIFE_NEEDS_DECAY = 'life-needs-decay';
/** 비가 오지 않는다 */
export const LIFE_NEEDS_RAIN = 'life-needs-rain';
/** 이미 주인이 있다 (그 개체군이 0 이 아니다 — 최초는 결속이고 이후는 계승이다 · 확정 2) */
export const LIFE_HAS_OWNER = 'life-has-owner';

/** 걸린 것의 코드 — 땅이 떤다 (위험이 아니라 선 자리의 말이다 · spec 기본형 ⑧) */
export const GROUND_TREMOR = 'ground-tremor';

/** 재료가 아닌 **세계 상태**로 가리킨 것 — 비 (검사는 이 갈래를 판정하지 않는다) */
export const LIFE_SOURCE_RAIN = 'rain';

/** 개체군의 값이 내리는 세계 안의 원인 — 조건 결핍 (확정 6 · 먹힘은 C025) */
export const POPULATION_DECLINE_CONDITION_LOST = 'CONDITION_LOST';

/**
 * 그 탄생이 생태에서 맡은 자리 — 허물 공급의 원인이 된다 (Play §5.2).
 * 코드일 뿐이고 규칙은 읽지 않는다 (원천의 recoveryCause 와 같은 갈래 · 기본형 ⑦).
 */
export const LIFE_ROLE_MOLT_SUPPLY = 'molt-supply';

// ── 형 ────────────────────────────────────────────────────────────────

/**
 * 결속의 **요구** 하나 (spec R2 · SPEC-004) — 갈래가 셋이다.
 *
 * 요구마다 자기 **모자람 코드**를 밝힌다. 세계가 모르는 원천 · 개체군을 가리킨 요구는
 * **차지 않은 것**으로 읽힌다 (끊긴 참조는 아무 일도 하지 않는다) — 검사 ㉗ 이 그것을 잡는다.
 */
export type LifeRequirement =
  /** 그 원천이 **있는가** (available 인가) — 같은 방이든 다른 방이든 */
  | { kind: 'source-available'; sourceId: string; unmetCode: string }
  /** 지금 **비가 오는가** (RULE-RAIN-001 이 시각과 철에서 유도한다) */
  | { kind: 'rain'; unmetCode: string }
  /** 그 개체군의 값이 **이 값 이하인가** */
  | { kind: 'population-at-most'; populationId: string; value: number; unmetCode: string };

/**
 * 탄생지가 밝히는 **전조 자락** 하나 (spec R4 · SPEC-003).
 *
 * 그 방 Description 의 trace layer area 를 op id 로 가리킨다 — 원천이 자기 둘레를
 * `traceOps` 로 가리키는 그 어법 그대로이고, 세기를 정하는 것은 여전히 그 area 의 태그다.
 * **덧씌움이지 재컴파일이 아니다**: 땅도 통행 격자도 hash 도 한 값 바뀌지 않는다.
 */
export interface LifeSiteTrace {
  /** 그 방 Description 의 trace layer area op id */
  op: string;
  /** 이 조건 코드가 걸려 있는 동안은 **서지 않는다** (단계 0) — 밝히지 않으면 언제나 선다 */
  hiddenWhen?: string;
  /**
   * 결속하는 동안 **한 단계 옅어진다** (재료가 그리로 간다).
   *
   * 낮아지는 때는 **결속하는 동안 내내**다 — 진행이 아니라 phase 를 묻는다. 진행은 관찰
   * 결과에 실리지 않으므로(spec Observable) 화면이 그것을 볼 수 없고, 세계와 화면이 같은
   * 자리에서 같은 단계를 내야 하기 때문이다.
   */
  fadesWhileBinding?: boolean;
  /** 결속하는 동안 이 자락에 선 몸의 **걸린 것**에 실리는 코드 */
  standingCodeWhileBinding?: string;
}

/**
 * 탄생지 하나가 밝히는 것 (Life §3.2 그대로) — 자리는 여기 없다.
 *
 * 자리는 그 방 Description 의 **resource layer point** 가 소유하고, 탄생지의 id 와 point 의
 * tag 가 같은 이름으로 이어진다 (원천이 그런 그대로 · C011 R3). 데이터가 둘로 나뉜 이유는
 * 하나다 — 자리는 땅의 일이라 Description 이 소유해야 컴파일·관찰·검사가 다 같은 것을 본다.
 */
export interface LifeSiteSpec {
  /** 그 방 Description 의 resource layer point 태그이기도 하다 */
  id: string;
  /** 어떻게 태어나는가 — 어휘 넷 중 하나 */
  mode: LifeFormationMode;
  /** 이 탄생이 매달린 **세계 원인** — 그 방의 원천들이 밝힌 것과 같은 갈래의 코드다 (㉘) */
  worldCause: string;
  /** 그 자리에 난 자연 형태 코드 — 관찰의 kind 가 이것이다 */
  form: string;
  /** 무엇으로 맺히는가 — 재료와, 재료가 아닌 세계 상태 (검사 ㉗ 은 앞의 것만 잰다) */
  source: {
    /** Material Seed 코드들 */
    materials: readonly string[];
    /** 재료가 아닌 것들 (비 …) — 판정하지 않는다 */
    states: readonly string[];
  };
  /** 무엇이 이것을 일으키고 무엇을 요구하는가 */
  condition: {
    /** 이 탄생을 일으키는 Region Rule id (㉗) */
    regionRule: string;
    /** 다 차 있는 동안에만 결속이 오른다 — 하나라도 모자라면 멎는다 */
    requires: readonly LifeRequirement[];
  };
  /**
   * 다 차면 어디로 가는가 — **밝혀만 둔다** (이 Cycle 의 규칙은 읽지 않는다).
   * 이 Cycle 이 오가는 것은 DORMANT ↔ BINDING 이고, BORN 으로 가는 것은 C023 이다.
   */
  transition: { from: LifeSitePhase; to: LifeSitePhase };
  /**
   * 태어날 때 **무엇을 먹는가** — 원천 id 들 (㉗ · ㉙).
   * 실제 소비는 C023 이다 — 이 Cycle 의 알집은 아무것도 먹지 않는다 (spec R7).
   */
  consumes: readonly string[];
  /** 전조와 그 뒤에 남는 것 */
  traces: {
    /** 태어나기 **전**의 자락들 — 하나 이상이어야 한다 (㉙) */
    before: readonly LifeSiteTrace[];
    /** 태어난 **뒤**에 남는 것들 — **밝혀만 둔다** (C023 이 쓴다 · 투영되지 않는다) */
    after: readonly string[];
  };
  /** 그 탄생이 생태에서 맡은 자리 — 코드일 뿐이고 규칙은 읽지 않는다 */
  ecologicalRole: string;
  /** 이 탄생이 값을 올리는 개체군의 id (㉗ · ㉛). 올리는 것은 C023 이다 */
  population: string;
  /** 결속에 걸리는 **세계 초** — 값의 유일한 출처가 여기다 (원천의 recoverySeconds 의 선례) */
  bindingSeconds: number;
}

/**
 * 개체군 하나가 밝히는 것 (확정 6 · Life §3.2).
 *
 * 값은 여기 없다 — 값은 세계가 겪은 일이므로 Region State 가 든다 (populations[id].value).
 * **presence 는 밝히지 않는다** — 어디에 사는가는 태어난 것이 서고 나서의 일이다 (C023).
 */
export interface PopulationSpec {
  /** 그 생명의 코드이자 개체군의 id (content/regions/lives.ts 의 LifeSeed) */
  id: string;
  /** 상한 — 값은 0 과 이 값 사이다 */
  scale: number;
  /** 값이 내리는 **세계 안의 원인** 코드 — 실제로 내리는 규칙은 C024 다 (밝혀만 둔다) */
  declineCause: string;
}

/**
 * 그 방이 품은 생명 계통 — 없으면 이 계통이 닿지 않는 방이다 (지금 밝힌 방은 하나다).
 *
 * 둘 다 있을 때만 자리를 가진다 — 탄생지 없는 방에 lifeFormation 을, 개체군 없는 방에
 * populations 를 지어내지 않는다 (resourceEcology 의 어법 그대로).
 */
export interface RegionEcology {
  lifeFormation?: readonly LifeSiteSpec[];
  populations?: readonly PopulationSpec[];
}
