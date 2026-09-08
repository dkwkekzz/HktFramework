// content/regions — 방이 품은 **생명 계통**의 데이터 계약 (C022 ADDED · Life §3.1 · §3.2).
//
// `RegionSpec.ecology` 가 이 형이다 — 그 방의 **탄생지**(lifeFormation)와 **개체군**(populations).
// 새 layer 도 새 Rule 문법도 별도 Life System 도 만들지 않는다 (F13): 방이 규칙을 품고
// (rule? · C008) 재료를 낳는(resourceEcology? · C011) 그 자리 곁에 하나가 더 서는 것뿐이다.
//
// **밝히지 않은 방은 한 값도 달라지지 않는다** — 지금 이것을 밝힌 방은 셋이다 (C024 CHANGED):
// 거목의 방과 포식수 둥지가 탄생지를, 빙결 협곡이 **탄생지가 없는 사유**를 밝힌다 (SPEC-001 경계 ①).
// rule? · resourceEcology? · phases? 를 밝히지 않은 방이 그 계통 밖인 것과 같은 규율이다.
//
// **규칙 코드는 어떤 탄생지도 이름으로 알지 못한다** — 아는 것은 "탄생지를 밝힌 방" ·
// "요구를 밝힌 탄생지" 라는 형뿐이고, 조건 코드의 글자까지 여기 데이터가 준다 (R13).

import type { LifeFormationMode } from './lives';

/**
 * 탄생지의 phase 넷 (spec State 절) — C023 CHANGED: **넷을 다 쓴다.**
 *
 *   DORMANT  맺히지 않았다 (요구가 다 차 있지 않다)
 *   BINDING  맺히는 중이다 (요구가 다 차 있다 · 진행이 오른다)
 *   BORN     태어났다 — **한 tick** 이다. 다섯이 함께 움직이는 그 순간이다 (C023 · SPEC-001)
 *   SPENT    비었다 — 터진 채 머문다. 다 머물면 DORMANT 로 돌아간다 (C023 · SPEC-003)
 */
export type LifeSitePhase = 'DORMANT' | 'BINDING' | 'BORN' | 'SPENT';

// ── 이 세계의 Region Rule id (C022 ADDED · Play §5.2) ─────────────────
//
// 세계 원인(FOREST_CHAIN)과 **같은 갈래의 상수**다: 코드일 뿐이고 사람이 읽을 문구는 View 의
// 표가 옮긴다. 탄생지가 자기를 일으키는 규칙을 이 이름으로 가리키고, 검사 ㉗ 이 그 이름이
// 세계에 실제로 있는지를 잰다 (없으면 끊긴 참조다).

/** 숲의 뿌리에 알집이 맺히는 규칙 */
export const RULE_FOREST_CLUTCH = 'RULE_FOREST_CLUTCH';

/**
 * 둥지의 사체가 균류로 **바뀌는** 규칙 (C024 ADDED · Play §5.7 · Life F3 변성형).
 *
 * 알집의 규칙(RULE_FOREST_CLUTCH)과 **같은 갈래의 코드**다 — 규칙 코드가 늘었다는 뜻이
 * 아니다: 결속도 계승도 변성도 굴리는 것은 여전히 한 규칙(RULE-LIFE-BINDING-001)이고
 * (W40 · spec R4), 이 이름은 그 탄생이 **세계에서 무엇이라 불리는가**일 뿐이다.
 * 검사 ㉗ 이 그 이름이 세계에 실제로 있는지를 잰다.
 */
export const RULE_NEST_TRANSFORM = 'RULE_NEST_TRANSFORM';

/** 세계가 아는 Region Rule id 들 — 검사 계약이 이것을 기반에 건넨다 */
export const REGION_RULE_IDS: readonly string[] = [RULE_FOREST_CLUTCH, RULE_NEST_TRANSFORM];

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
/**
 * **이을 것이 없다** (C023 ADDED · Play §5.4) — 그 개체군이 아직 하나도 없다.
 *
 * `LIFE_HAS_OWNER` 와 **정확히 반대**의 말이다: 결속은 주인이 있으면 서지 않고, 계승은
 * 이을 것이 없으면 서지 않는다. 둘이 갈려 있어야 관찰자가 "지금은 어느 쪽의 때인가" 를
 * 지목 하나로 읽는다 (spec SPEC-008 · 확정 2).
 */
export const LIFE_NEEDS_PARENT = 'life-needs-parent';

/**
 * **삭을 것이 없다** (C024 ADDED · Play §5.7) — 둥지의 사체가 available 이 아니다.
 *
 * `LIFE_NEEDS_MATERIAL` · `LIFE_NEEDS_DECAY` 와 같은 갈래다 (원천이 있는가) — 갈리는 것은
 * 무엇이 모자란가의 글자뿐이고, 규칙은 셋을 갈라 보지 않는다.
 */
export const LIFE_NEEDS_CARCASS = 'life-needs-carcass';

/**
 * **이미 충분히 폈다** (C024 ADDED · spec 기본형 ⑥) — 거목균이 상한만큼 서 있다.
 *
 * `LIFE_HAS_OWNER` 와 **같은 갈래**의 말이다 (그 개체군이 이 값보다 많다) — 갈리는 것은
 * 묻는 값뿐이다. 상한에서 태어남이 통째로 일어나지 않는 것(C023 경계)을 요구로도 밝혀
 * 두면, 관찰자가 "왜 멎었는가" 를 지목 하나로 읽는다. 규칙은 그대로다.
 */
export const LIFE_FUNGUS_CROWDED = 'life-fungus-crowded';

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

/**
 * 그 탄생이 생태에서 맡은 자리 — **삭임의 공급**이 된다 (C024 ADDED · Play §5.7).
 *
 * `LIFE_ROLE_MOLT_SUPPLY` 와 같은 갈래의 코드다: 태어난 것이 사체를 삭여 균사와 붉게
 * 되돌아온 흙을 이 사슬에 돌려놓는다 (Concept §4 · D2 거목균 ②).
 * 규칙은 읽지 않는다 — 밝혀만 두는 자리다 (원천의 recoveryCause 와 같은 어법).
 */
export const LIFE_ROLE_DECAY_SUPPLY = 'decay-supply';

// ── 형 ────────────────────────────────────────────────────────────────

/**
 * 결속의 **요구** 하나 (spec R2 · SPEC-004) — 갈래가 넷이다 (C023 CHANGED — 하나가 늘었다).
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
  | { kind: 'population-at-most'; populationId: string; value: number; unmetCode: string }
  /**
   * 그 개체군의 값이 **이 값 이상인가** (C023 ADDED · Play §5.4 · spec SPEC-007).
   *
   * `population-at-most` 의 짝이다 — 최초는 아무도 없어야 서고(결속), 이후는 이을 것이
   * 있어야 선다(계승). 둘이 같은 개체군을 반대로 물으므로 **둘은 겹치지 않는다**
   * (SPEC-007 경계 ①). 세계가 모르는 개체군은 값이 0 으로 읽히므로 이 갈래는 차지 않는다.
   */
  | { kind: 'population-at-least'; populationId: string; value: number; unmetCode: string };

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
   * 다 차면 어디로 가는가 — **밝혀만 둔다** (규칙은 읽지 않는다).
   * 실제로 도는 차례는 규칙이 안다: DORMANT → BINDING → BORN → SPENT → DORMANT (C023).
   */
  transition: { from: LifeSitePhase; to: LifeSitePhase };
  /**
   * 태어날 때 **무엇을 먹는가** — 원천 id 들 (㉗ · ㉙).
   *
   * C023 CHANGED — **밝혀만 두던 자리가 일을 한다.** 태어나는 그 tick 에 이 원천들이
   * 고갈된다: 캔 것과 **같은 State** 이고 원인만 다르다 (RULE-LIFE-BIRTH-001 ② · SPEC-002).
   * 다른 방의 원천도 같은 규칙으로 먹힌다 — 균사는 둥지의 것이다.
   */
  consumes: readonly string[];
  /**
   * 태어남이 **세우는** 원천 id 들 (C023 ADDED · Play §5.3 ⑤ · §5.4 · Material §6.2 By-product).
   *
   * 그 원천들은 **처음이 고갈**이고 시간으로 돌아오지 않는다 — 되돌리는 것은 **다음 탄생**이다
   * (RULE-SOURCE-RECOVERY-001 CHANGED · SPEC-004). 밝히지 않은 탄생지는 아무것도 남기지 않는다.
   */
  leaves?: readonly string[];
  /**
   * 태어난 뒤 그 자리가 **머무는 세계 초** (C023 ADDED · 확정 5 · SPEC-003).
   *
   * BORN 은 한 tick 이고 곧 SPENT 가 된다. SPENT 는 이만큼 머문 뒤 DORMANT 로 돌아간다 —
   * **밝히지 않은 탄생지는 BORN 다음 tick 에 곧장 DORMANT 다** (spec R2 경계 ②).
   */
  spentSeconds?: number;
  /** 전조와 그 뒤에 남는 것 */
  traces: {
    /** 태어나기 **전**의 자락들 — 하나 이상이어야 한다 (㉙) */
    before: readonly LifeSiteTrace[];
    /**
     * 태어난 **뒤**에 서는 자락들의 op id (C023 CHANGED — 밝혀만 두던 자리가 일을 한다).
     *
     * **SPENT 인 동안에만 선다** — 그 밖의 phase 에서는 단계 0 이다 (전조의 `hiddenWhen` 이
     * 하는 그 기제 그대로 · spec SPEC-004 경계 ③). 원천은 여기 오지 않는다: 태어남이
     * **세우는** 것은 `leaves` 이고 여기 있는 것은 흙에 남는 자국뿐이다.
     */
    after: readonly string[];
  };
  /** 그 탄생이 생태에서 맡은 자리 — 코드일 뿐이고 규칙은 읽지 않는다 */
  ecologicalRole: string;
  /** 이 탄생이 값을 올리는 개체군의 id (㉗ · ㉛) — 태어남이 그 tick 에 1 올린다 (C023 CHANGED) */
  population: string;
  /** 결속에 걸리는 **세계 초** — 값의 유일한 출처가 여기다 (원천의 recoverySeconds 의 선례) */
  bindingSeconds: number;
}

/**
 * 개체군 하나가 밝히는 것 (확정 6 · Life §3.2).
 *
 * 값은 여기 없다 — 값은 세계가 겪은 일이므로 Region State 가 든다 (populations[id].value).
 *
 * C023 CHANGED — **어디에 사는가가 선다** (presence · presenceOps). C022 가 비워 둔 그 자리를
 * 태어난 것이 서고 난 지금 잇는다 (Time §2.6 의 presence layer 와 같은 자리).
 */
export interface PopulationSpec {
  /** 그 생명의 코드이자 개체군의 id (content/regions/lives.ts 의 LifeSeed) */
  id: string;
  /** 상한 — 값은 0 과 이 값 사이다 */
  scale: number;
  /** 값이 내리는 **세계 안의 원인** 코드 — 실제로 내리는 규칙은 C024 다 (밝혀만 둔다) */
  declineCause: string;
  /**
   * 그 떼의 **의미 코드** (C023 ADDED · Play §5.3 ⑥ · V21) — 관찰 결과의 `presences[].presence`.
   *
   * 개체군의 id 와 갈린다: 세계는 개체군의 값도 그 이름도 투영하지 않으므로(spec Observable),
   * 관찰자에게 가는 것은 "여기 무엇이 돌고 있다" 는 코드 하나뿐이다.
   * 밝히지 않은 개체군은 아무것도 서지 않는다 — 자락을 밝혔어도 실을 이름이 없다.
   */
  presence?: string;
  /**
   * 값 1..상한 마다의 **자락 op id** (C023 ADDED · spec R5 · SPEC-006).
   *
   * 지금 값만큼이 **앞에서부터** 선다 — 값이 0 이면 하나도 서지 않고, 값이 오를수록 뒤의
   * 것이 더 선다 (넓어지는 것은 자락의 데이터가 정한다 · 자리는 그 방 Description 의
   * presence layer area 가 소유한다 · C011 R3 의 규율 그대로).
   * 밝히지 않은 개체군은 자락이 없다.
   */
  presenceOps?: readonly string[];
  /**
   * 탄생 하나가 그 방에 올리는 **소란** (C023 ADDED · 확정 6 · spec R1 ⑤).
   *
   * 올리는 일은 C017 의 그 한 자리가 한다 (RULE-DISTURBANCE-001) — 여기 있는 것은 값뿐이고
   * 임계에서 멈추는 것도 그 규칙이 안다. 밝히지 않으면 탄생이 소란을 올리지 않는다.
   */
  birthDisturbance?: number;
  /**
   * **이것들이 차 있어야 산다** (C024 ADDED · spec R3 · SPEC-003 · 확정 6).
   *
   * 결속의 요구와 **같은 어휘**를 쓴다 (LifeRequirement) — 새 형을 만들지 않는다: 묻는 것이
   * "지금 이것이 차 있는가" 로 똑같기 때문이고, 갈리는 것은 **못 찼을 때 무슨 일이
   * 일어나는가**뿐이다 (탄생지는 결속이 멎고, 개체군은 철이 바뀔 때 값이 준다).
   *
   * 판정은 **철 단위**다 — 그 철 동안 한 번이라도 다 차면 그 철에는 내리지 않고, 한 번도
   * 차지 않은 채 철이 바뀌면 값이 1 준다 (0 미만은 없다). 태어남이 잠깐 먹어 비는 것으로
   * 줄지 않게 하는 자리가 그 "한 번이라도" 다 (기본형 ②).
   *
   * **밝히지 않은 개체군은 내리지 않는다** (spec SPEC-003 경계 ④) — presence? ·
   * birthDisturbance? 를 밝히지 않은 개체군이 그 계통 밖인 것과 같은 규율이다.
   * 모자람 코드는 여기서 쓰이지 않지만 요구가 그것을 지고 다닌다 — 어휘를 갈라 두 벌로
   * 만들지 않기 위해서다.
   */
  declineWhen?: readonly LifeRequirement[];
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
  /**
   * 탄생지가 **하나도 없는 방**이 밝히는 사유 (C024 ADDED · Life F6 · spec SPEC-009).
   *
   * 재료의 고립 사유(`resourceEcology.isolationReason`)를 생명에 그대로 옮긴 것이다 —
   * **없음이 침묵이 아니라 답이 된다**: 협곡에 탄생지가 없는 것은 결손이 아니라 열을 먹는
   * 결정이 있어 결속에 쓸 열이 남지 않기 때문이고, 그것이 세계에 적혀 있어야 도구가
   * "여기는 아직 안 만들었다" 와 "여기는 원래 없다" 를 갈라 읽는다.
   *
   * **규칙은 이 글자를 읽지 않는다** — 읽는 것은 검사 ㉚ 하나이고 그것도 판정하지 않는다
   * (사유가 있든 없든 `report` 다 · SPEC-009 경계 ③). 밝히지 않은 방은 지금 그대로다.
   */
  absenceReason?: string;
}
