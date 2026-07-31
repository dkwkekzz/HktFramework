import type { PredicateSpec } from '@hkt/k1-predicate-query';
import type { RuleSpec } from '@hkt/k2-rule-transaction';
import { NATURAL_COMPONENT } from '@hkt/s1-natural-state';
import { CAPABILITY_PREFIX, SUBJECT_COMPONENT, SUBJECT_VERB } from './types.js';

/**
 * 주체 법칙 — U0 이 소유하는 규칙집.
 *
 * ## 왜 느끼는 일이 사건인가
 *
 * GI-01 은 "모든 세계 상태 변경에는 원인이 되는 `WorldEvent` 가 존재해야 한다"고 못 박는다.
 * 주체의 욕구와 감정도 세계의 상태다. 배가 고파지는 것을 코드 한 줄로 처리하면 그 변화는
 * **원인 없는 상태 변경**이 되고, 재생도(GI-12) 감사도 할 수 없다.
 *
 * 그래서 여기 적힌 것은 전부 K2 가 읽어 델타로 바꾸고 K3 이 사건으로 남긴다. "왜 저 NPC 는
 * 갑자기 배가 고파졌는가"의 답이 언제나 사건 로그에 있다.
 *
 * ## 왜 L2 인가
 *
 * 원본 15.1 의 사다리에서 `L1` 은 "물리·생명 기본 규칙"이고 `L2` 는 "종과 신체 규칙"이다.
 * 몸이 굶는 것은 L1(S1 의 자연 법칙)이고, **굶은 몸을 어떻게 느끼는가**는 종과 신체의 몫이므로
 * L2 다. 두 층이 한 세계에서 함께 돌 때 L1 이 더 높은 권위를 갖는 것이 옳다 —
 * 아무리 담담한 주체라도 몸이 굶는 것 자체를 막을 수는 없다.
 *
 * ## 한 의도에 한 법칙
 *
 * K2 는 맞은 규칙 중 하나만 고른다. 그래서 느끼는 일을 **의도로 나눠** 놓았다 —
 * `sense_hunger`(허기) · `sense_harm`(상함) · `weigh_means`(수단). 나누지 않으면 "굶으면서
 * 동시에 다친" 하루를 적을 수 없다.
 *
 * ## 세 갈래 구조
 *
 * 각 의도마다 세 규칙이 우선순위로 늘어선다.
 *
 * ```text
 * priority 30   조건이 맞으면 오른다      (requires 가 있다)
 * priority 20   조건이 어긋나면 잦아든다  (반대 조건)
 * priority 10   천장에 닿았으면 그대로다  (조건 없음 · 효과 없음 · 흔적만)
 * ```
 *
 * 마지막 줄이 없으면 욕구가 천장(10)에 닿은 날 의도가 통째로 거부되고, "더 오를 수 없었다"가
 * 아니라 "아무 일도 없었다"로 기록된다. 천장에 닿은 것도 일어난 일이다.
 */

const verbIs = (verb: string): PredicateSpec => ({
  op: 'eq',
  path: 'intent.intent_spec.verb',
  value: verb,
});

/** `not(gt(path, ceiling))` — 천장에 닿았는지. */
const below = (path: string, ceiling: number): PredicateSpec => ({
  op: 'not',
  item: { op: 'gt', path, value: ceiling },
});

const NEEDS = SUBJECT_COMPONENT.NEEDS;
const EMOTIONS = SUBJECT_COMPONENT.EMOTIONS;

/**
 * 죽은 몸은 아무것도 올려 보내지 않는다.
 *
 * **제약 규칙**이다 — 비용도 효과도 흔적도 없다. K2 는 그런 규칙을 골라서 적용하지 않고,
 * 조건이 어긋나면 계층과 무관하게 의도 전체를 막는다. 선을 긋는 것이 이 규칙의 전부다.
 *
 * 조직에 이 규칙이 특히 중요하다. GI-08 은 "국가나 조직의 행동은 실제 구성원·자원·명령 전달을
 * 거쳐야 한다"고 규정한다. 조직의 몸은 구성원이고, 쓰러진 구성원을 통해서는 조직도 느끼지 못한다.
 */
const theDeadDoNotFeel: RuleSpec = {
  id: 'u0_the_dead_do_not_feel',
  title: '쓰러진 몸을 통해서는 아무것도 느끼지 못한다',
  scope: 'L1',
  priority: 90,
  when: {
    op: 'or',
    items: [verbIs(SUBJECT_VERB.SENSE_HUNGER), verbIs(SUBJECT_VERB.SENSE_HARM)],
  },
  requires: { op: 'gt', path: `body.${NATURAL_COMPONENT.POPULATION}.count`, value: 0 },
  costs: [],
  effects: [],
  emits: [],
  tags: ['subject', 'body'],
};

// ---------------------------------------------------------------------------
// sense_hunger — 몸의 허기가 욕구가 된다
// ---------------------------------------------------------------------------

const hungerGrowsFromTheBody: RuleSpec = {
  id: 'u0_hunger_grows_from_the_body',
  title: '굶은 몸이 끼니의 욕구를 밀어 올린다',
  scope: 'L2',
  priority: 30,
  when: verbIs(SUBJECT_VERB.SENSE_HUNGER),
  requires: {
    op: 'and',
    items: [
      // S1 의 자연 법칙이 굶주림이라 부르는 것과 같은 문턱이다.
      { op: 'gt', path: `body.${NATURAL_COMPONENT.HUNGER}.value`, value: 5 },
      below(`actor.${NEEDS}.hunger`, 8),
    ],
  },
  costs: [],
  effects: [{ op: 'add', path: `actor.${NEEDS}.hunger`, value: 2 }],
  emits: [{ id: 'pang_of_hunger', channels: ['aura'] }],
  tags: ['subject', 'need'],
};

const hungerFadesWhenTheBodyIsFed: RuleSpec = {
  id: 'u0_hunger_fades_when_the_body_is_fed',
  title: '배를 채운 몸에서는 끼니의 욕구가 잦아든다',
  scope: 'L2',
  priority: 20,
  when: verbIs(SUBJECT_VERB.SENSE_HUNGER),
  requires: below(`body.${NATURAL_COMPONENT.HUNGER}.value`, 5),
  costs: [],
  // 곱셈으로 내린다 — 뺄셈은 하한 아래로 밀어 트랜잭션을 통째로 거부시킨다.
  effects: [{ op: 'multiply', path: `actor.${NEEDS}.hunger`, value: 0.5 }],
  emits: [{ id: 'sated', channels: ['aura'] }],
  tags: ['subject', 'need'],
};

const hungerSitsAtItsPeak: RuleSpec = {
  id: 'u0_hunger_sits_at_its_peak',
  title: '끼니의 욕구는 더 오를 데가 없다',
  scope: 'L2',
  priority: 10,
  when: verbIs(SUBJECT_VERB.SENSE_HUNGER),
  costs: [],
  effects: [],
  emits: [{ id: 'gnawing_hunger', channels: ['aura'] }],
  tags: ['subject', 'need'],
};

// ---------------------------------------------------------------------------
// sense_harm — 상한 몸이 두려움과 안전의 욕구가 된다
// ---------------------------------------------------------------------------

const woundsCallForSafety: RuleSpec = {
  id: 'u0_wounds_call_for_safety',
  title: '상한 몸이 몸을 지키려는 욕구와 두려움을 부른다',
  scope: 'L2',
  priority: 30,
  when: verbIs(SUBJECT_VERB.SENSE_HARM),
  requires: {
    op: 'and',
    items: [
      {
        op: 'or',
        items: [
          { op: 'gt', path: `body.${NATURAL_COMPONENT.DAMAGE}.wounds`, value: 0 },
          { op: 'gt', path: `body.${NATURAL_COMPONENT.DISEASE}.load`, value: 10 },
        ],
      },
      below(`actor.${NEEDS}.safety`, 8),
      below(`actor.${EMOTIONS}.fear`, 0.8),
    ],
  },
  costs: [],
  effects: [
    { op: 'add', path: `actor.${NEEDS}.safety`, value: 2 },
    { op: 'add', path: `actor.${EMOTIONS}.fear`, value: 0.2 },
  ],
  emits: [{ id: 'alarm', channels: ['aura'] }],
  tags: ['subject', 'need', 'emotion'],
};

const aWholeBodyCalmsTheMind: RuleSpec = {
  id: 'u0_a_whole_body_calms_the_mind',
  title: '성한 몸에서는 두려움과 경계가 잦아든다',
  scope: 'L2',
  priority: 20,
  when: verbIs(SUBJECT_VERB.SENSE_HARM),
  requires: {
    op: 'and',
    items: [
      below(`body.${NATURAL_COMPONENT.DAMAGE}.wounds`, 0),
      below(`body.${NATURAL_COMPONENT.DISEASE}.load`, 10),
    ],
  },
  costs: [],
  effects: [
    { op: 'multiply', path: `actor.${NEEDS}.safety`, value: 0.5 },
    { op: 'multiply', path: `actor.${EMOTIONS}.fear`, value: 0.5 },
  ],
  emits: [{ id: 'at_ease', channels: ['aura'] }],
  tags: ['subject', 'need', 'emotion'],
};

const alarmHasNowhereLeftToRise: RuleSpec = {
  id: 'u0_alarm_has_nowhere_left_to_rise',
  title: '두려움은 더 오를 데가 없다',
  scope: 'L2',
  priority: 10,
  when: verbIs(SUBJECT_VERB.SENSE_HARM),
  costs: [],
  effects: [],
  emits: [{ id: 'dread', channels: ['aura'] }],
  tags: ['subject', 'emotion'],
};

// ---------------------------------------------------------------------------
// weigh_means — 능력과 자원을 읽는 자리
// ---------------------------------------------------------------------------

/**
 * 손에 쥔 것이 없는 절박은 절망이 된다.
 *
 * **능력(태그)과 자원(수치)을 읽는 유일한 법칙**이다. 이것이 없으면 둘은 화면에만 나오는
 * 장식이 된다 — 원문 「11」 U0 의 「포함」에 적힌 항목이 아무것도 일으키지 않는 것은,
 * 있는 척만 하는 것과 같다.
 *
 * 여기 적힌 `forage` · `provision` 은 이 법칙집이 전제하는 콘텐츠 이름이다. 법칙집을 갈아
 * 끼우면 이름도 함께 바뀐다(`U0Input.laws`).
 */
const helplessnessBreedsDespair: RuleSpec = {
  id: 'u0_helplessness_breeds_despair',
  title: '다룰 능력도 기댈 자원도 없는 절박은 절망이 된다',
  scope: 'L2',
  priority: 30,
  when: verbIs(SUBJECT_VERB.WEIGH_MEANS),
  requires: {
    op: 'and',
    items: [
      { op: 'gt', path: `actor.${NEEDS}.hunger`, value: 6 },
      { op: 'not', item: { op: 'has_tag', target: 'actor', tag: `${CAPABILITY_PREFIX}forage` } },
      { op: 'not', item: { op: 'gt', path: `actor.${SUBJECT_COMPONENT.RESOURCES}.provision`, value: 0 } },
      below(`actor.${EMOTIONS}.despair`, 0.75),
    ],
  },
  costs: [],
  effects: [{ op: 'add', path: `actor.${EMOTIONS}.despair`, value: 0.25 }],
  emits: [{ id: 'despair', channels: ['aura'] }],
  tags: ['subject', 'emotion'],
};

const meansAtHandCalmTheMind: RuleSpec = {
  id: 'u0_means_at_hand_calm_the_mind',
  title: '다룰 수 있거나 기댈 것이 있으면 절망이 잦아든다',
  scope: 'L2',
  priority: 20,
  when: verbIs(SUBJECT_VERB.WEIGH_MEANS),
  requires: {
    op: 'or',
    items: [
      { op: 'has_tag', target: 'actor', tag: `${CAPABILITY_PREFIX}forage` },
      { op: 'gt', path: `actor.${SUBJECT_COMPONENT.RESOURCES}.provision`, value: 0 },
      { op: 'not', item: { op: 'gt', path: `actor.${NEEDS}.hunger`, value: 6 } },
    ],
  },
  costs: [],
  effects: [{ op: 'multiply', path: `actor.${EMOTIONS}.despair`, value: 0.5 }],
  emits: [{ id: 'steadied', channels: ['aura'] }],
  tags: ['subject', 'emotion'],
};

const despairHolds: RuleSpec = {
  id: 'u0_despair_holds',
  title: '절망은 더 깊어질 데가 없다',
  scope: 'L2',
  priority: 10,
  when: verbIs(SUBJECT_VERB.WEIGH_MEANS),
  costs: [],
  effects: [],
  emits: [{ id: 'hollow', channels: ['aura'] }],
  tags: ['subject', 'emotion'],
};

/**
 * 주체 법칙 한 벌.
 *
 * 순서는 뜻이 없다 — K2 의 `RuleBook` 이 `scope` → `priority` → `id` 로 다시 정렬한다.
 * 여기서는 사람이 읽기 좋게 몸(허기·상함)에서 마음(수단·절망)으로 올라간다.
 */
export const SUBJECT_LAWS: RuleSpec[] = [
  theDeadDoNotFeel,
  hungerGrowsFromTheBody,
  hungerFadesWhenTheBodyIsFed,
  hungerSitsAtItsPeak,
  woundsCallForSafety,
  aWholeBodyCalmsTheMind,
  alarmHasNowhereLeftToRise,
  helplessnessBreedsDespair,
  meansAtHandCalmTheMind,
  despairHolds,
];

/** 법칙 id 오름차순 — 계약과 화면이 같은 목록을 본다. */
export const SUBJECT_LAW_IDS: string[] = SUBJECT_LAWS.map((law) => law.id).sort();
