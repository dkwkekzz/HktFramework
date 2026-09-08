// content/regions — 이 세계의 **성질 어휘** (C029 ADDED · L2-World-Access §4.1 · D1).
//
// 세계 전체에 **하나**이고 Region 전용이 아니다 (K5). 방도 재료도 문도 이 한 벌의 말로
// 자기가 무엇을 묻는지 · 무엇을 가졌는지 적는다 — 요구와 가능성이 같은 어휘로 적히는 것이
// 이 파일이 하는 일의 전부다.
//
// **규칙 코드는 이 파일의 글자를 하나도 알지 못한다** (C004 가 세운 규율 · K5). 규칙이 아는
// 것은 "성질을 밝힌 재료" 와 "성질을 요구하는 Lock" 뿐이고, 축이 heat 인지 light 인지는
// 여기와 View 의 문구 표에만 있다. 어휘를 통째로 갈아도 세계가 도는 방식은 한 줄도
// 달라지지 않는다 (SPEC-001 경계 ①).
//
// **판정하지 않는다** — answers 의 관계 셋(SUPPORTS · OPPOSES · REVEALS)은 데이터일 뿐이고
// 2층에서 그것을 읽어 무엇을 정하는 자리는 없다 (K11 · spec 기본형 ⑦). 성질이 실제로 요구에
// 답하는가는 3 · 4층의 것이다.
//
// 항목마다 `basis` 를 진다 — **근거 없는 성질은 어휘가 아니라 빈칸이다** (Access §4.1).
// 새 항목을 더하려면 근거 절이 먼저 있어야 한다. 쓰이지 않는 항목(고아)이 있어도 그것은
// 결손이 아니라 아직 오지 않은 행의 자리이고, 검사는 수만 적는다 (SPEC-001 경계 ②).

/** 축과 관계를 잇는 글자 하나 — 태그는 `<축><이것><관계>` 다 */
export const PROPERTY_TAG_SEPARATOR = ':';

/** 그 축의 그 관계를 가리키는 태그 — 데이터도 검사도 이 함수 하나로 이름을 짓는다 */
export function propertyTag(aspect: string, relation: string): string {
  return `${aspect}${PROPERTY_TAG_SEPARATOR}${relation}`;
}

/**
 * 그 재료의 그 성질을 사람의 말로 옮길 때 쓰는 코드 — 데이터도 표현도 이 함수 하나로
 * 이름을 짓는다 (soilStainTag · frostBreathTag 의 선례).
 *
 * 재료 id 가 함께 드는 이유는 하나다 — **성질의 말은 재료마다 다르다** (K7 · spec R5 경계 ②).
 * 같은 `light:emits` 라도 생체 광석은 "쌓인 자리를 붉게 물들인다" 이고 빙정석은 "푸르게
 * 빛난다" 다. 태그는 그 재료의 문장을 가리키는 **색인**이지 문장 자체가 아니다.
 */
export function propertyPhraseCode(seedId: string, tag: string): string {
  return `property:${seedId}:${tag}`;
}

// ── 축 다섯 (D1 — Human 이 "이대로" 로 확정했다) ──────────────────────

export const ASPECT_HEAT = 'heat';
export const ASPECT_LIGHT = 'light';
export const ASPECT_VIBRATION = 'vibration';
export const ASPECT_SPACE = 'space';
export const ASPECT_FLESH = 'flesh';

// ── 관계 일곱 (D1) ────────────────────────────────────────────────────

export const RELATION_ABSORBS = 'absorbs';
export const RELATION_STORES = 'stores';
export const RELATION_EMITS = 'emits';
export const RELATION_SENSES = 'senses';
export const RELATION_HIDES = 'hides';
export const RELATION_GROWS_ON = 'grows-on';
export const RELATION_FIXES = 'fixes';

// ── 요구에 대해 성질이 하는 일 셋 (원문 §8 · K11) ─────────────────────
//
// **2층은 이 글자로 아무것도 판정하지 않는다.** 무엇이 실제로 요구를 채우는지는 주체의
// State(몸 · 소지 · 지식)에서 유도되고 그것은 3 · 4층의 것이다.

/** 그 성질이 요구를 채우는 쪽으로 돕는다 */
export const ANSWER_SUPPORTS = 'SUPPORTS';
/** 그 성질이 요구를 거스른다 (횃불을 든 채로 숨을 수 없다) */
export const ANSWER_OPPOSES = 'OPPOSES';
/** 그 성질이 요구를 도리어 드러낸다 (차가운 물체는 반응하지 않는다) */
export const ANSWER_REVEALS = 'REVEALS';

/**
 * 재료가 관찰되는 문장 다섯 항 (L2-World-Material §6.1 observableProperties).
 * 성질 태그는 이 중 **어느 문장에서 나왔는가**를 함께 밝힌다 (K7) — 문장에 없는 성질을
 * 태그가 말하지 않게 하는 자리다.
 */
export const STATEMENT_KINDS = [
  'appearance',
  'behavior',
  'conditionResponse',
  'persistence',
  'danger',
] as const;

export type StatementKind = (typeof STATEMENT_KINDS)[number];

// ── 답의 종류 여섯 (원문 §2.3 · 검사 ㊴ ㊵ 가 이 차례로 센다) ──────────
//
// 지금 이 세계에 실제로 서 있는 것은 Material 하나뿐이다 (그것마저 원천이 아직 없다 —
// C030 의 것). 나머지 다섯은 **자리만** 이고, 그것이 결손이 아니라 "답이 한 종류뿐인 중요
// Lock 은 완성된 설계가 아니다" 를 도구가 세게 하는 눈금이다 (원문 §2.3).

export const ANSWER_KIND_MATERIAL = 'Material';
export const ANSWER_KIND_LIFE = 'Life';
export const ANSWER_KIND_ENVIRONMENT = 'Environment';
export const ANSWER_KIND_ACTOR = 'Actor';
export const ANSWER_KIND_KNOWLEDGE = 'Knowledge';
export const ANSWER_KIND_COMBINATION = 'Combination';

/** 답의 종류 여섯 — 도구가 세는 차례가 이 차례다 */
export const ANSWER_KINDS: readonly string[] = [
  ANSWER_KIND_MATERIAL,
  ANSWER_KIND_LIFE,
  ANSWER_KIND_ENVIRONMENT,
  ANSWER_KIND_ACTOR,
  ANSWER_KIND_KNOWLEDGE,
  ANSWER_KIND_COMBINATION,
];

/** 어휘 항목 하나 — 무엇인가(meaning)와 어디서 왔는가(basis) */
export interface PropertyVocabularyEntry {
  id: string;
  meaning: string;
  basis: string;
}

/** 축 다섯 (Access §4.1 그대로 — 뜻도 근거도 옮겨 적은 것이고 새로 지은 것이 없다) */
export const PROPERTY_ASPECTS: readonly PropertyVocabularyEntry[] = [
  {
    id: ASPECT_HEAT,
    meaning: '열 · 체온 · 추위',
    basis: 'Concept §6 · Region §4.2 · §12 · RoomOfAnotherKind 확정 2·3',
  },
  {
    id: ASPECT_LIGHT,
    meaning: '빛 · 색 · 어둠',
    basis: 'Time 2.2 · RoomOfAnotherKind 확정 3 · RoomBearsMaterial D2',
  },
  {
    id: ASPECT_VIBRATION,
    meaning: '진동 · 소리 · 정지',
    basis: 'Concept §11 맹목의 사냥꾼 · §12 침묵의 계곡 · Time 2.6',
  },
  {
    id: ASPECT_SPACE,
    meaning: '공간 연결 · 전이 목적지',
    basis: 'Region §12 · §16 FIX_TRANSITION_DESTINATION · Concept §5 현상',
  },
  {
    id: ASPECT_FLESH,
    meaning: '살아 있는 것의 몸 — 결정화 · 붙음 · 안에 쌓임',
    basis: 'Concept §5 물질 · D2 · Life F7',
  },
];

/** 관계 일곱 (Access §4.1 그대로) */
export const PROPERTY_RELATIONS: readonly PropertyVocabularyEntry[] = [
  { id: RELATION_ABSORBS, meaning: '먹는다 (줄인다)', basis: 'RoomOfAnotherKind 확정 3' },
  { id: RELATION_STORES, meaning: '담아 둔다', basis: 'Region §12 열을 저장하는 결정' },
  { id: RELATION_EMITS, meaning: '낸다', basis: 'RoomOfAnotherKind 확정 3 · D2' },
  { id: RELATION_SENSES, meaning: '감지한다', basis: 'Region §4.2 · Concept §11' },
  {
    id: RELATION_HIDES,
    meaning: '숨긴다',
    basis: 'Concept §11 움직이지 않으면 찾지 못한다',
  },
  { id: RELATION_GROWS_ON, meaning: '닿으면 자란다', basis: 'RoomOfAnotherKind 확정 3' },
  { id: RELATION_FIXES, meaning: '고정한다', basis: 'Region §12 · §16' },
];

/** 요구에 대해 성질이 하는 일 하나 */
export interface PropertyAnswer {
  /** 어느 요구에 대해서인가 — 축:관계 태그 */
  requirement: string;
  /** 무엇이 하는가 — 축:관계 태그 */
  property: string;
  /** SUPPORTS | OPPOSES | REVEALS */
  kind: string;
  basis: string;
  note?: string;
}

/**
 * answers 다섯 (Access §4.1 그대로) — 원문 §8 이 남긴 의미 공간이고, 이 다섯 줄은 원문과
 * 확정 문서에서 나온 것만이다. **여기에 없는 관계는 이 세계가 아직 말하지 않은 것이다.**
 */
export const PROPERTY_ANSWERS: readonly PropertyAnswer[] = [
  {
    requirement: propertyTag(ASPECT_HEAT, RELATION_HIDES),
    property: propertyTag(ASPECT_HEAT, RELATION_STORES),
    kind: ANSWER_SUPPORTS,
    basis: 'Region §12 열 저장 결정 → 체온 유지',
  },
  {
    requirement: propertyTag(ASPECT_HEAT, RELATION_HIDES),
    property: propertyTag(ASPECT_HEAT, RELATION_ABSORBS),
    kind: ANSWER_SUPPORTS,
    note: '감지는 약해지되 몸이 식는다 — 비용은 4층',
    basis: '원문 §8',
  },
  {
    requirement: propertyTag(ASPECT_HEAT, RELATION_HIDES),
    property: propertyTag(ASPECT_HEAT, RELATION_EMITS),
    kind: ANSWER_OPPOSES,
    basis: '원문 §8 횃불',
  },
  {
    requirement: propertyTag(ASPECT_HEAT, RELATION_HIDES),
    property: propertyTag(ASPECT_HEAT, RELATION_ABSORBS),
    kind: ANSWER_REVEALS,
    basis: '원문 §7 차가운 물체는 반응하지 않는다',
  },
  {
    requirement: propertyTag(ASPECT_HEAT, RELATION_ABSORBS),
    property: propertyTag(ASPECT_HEAT, RELATION_STORES),
    kind: ANSWER_SUPPORTS,
    basis: '혹한 area — Region §6.1 소프트 예시',
  },
];

/**
 * **세계 전체 하나**인 성질의 어휘 (spec State 의 PropertyVocabulary).
 *
 * 위의 셋을 한 값으로 묶은 것이고 새로 정하는 것이 하나도 없다 — 어휘가 하나라는 것(K5)이
 * 값 하나로도 읽혀야 하기 때문이다. 낱낱으로 쓰는 쪽(도구의 계약)은 위의 셋을 그대로 쓰고,
 * "이 세계의 어휘" 를 통째로 묻는 쪽은 이것을 읽는다.
 */
export const PROPERTY_VOCABULARY = {
  aspects: PROPERTY_ASPECTS,
  relations: PROPERTY_RELATIONS,
  answers: PROPERTY_ANSWERS,
} as const;
