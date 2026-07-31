import type { RuleSpec } from '@hkt/k2-rule-transaction';
import { NATURAL_VERB } from './types.js';

/**
 * 자연 법칙 — S1 이 소유하는 규칙집.
 *
 * ## 왜 코드가 아니라 데이터인가
 *
 * 원본 15.3 은 규칙을 "임의 JavaScript 실행 코드가 아니라 데이터 AST" 로 저장하라고 규정한다.
 * 자연 법칙도 예외가 아니다. `if (hunger > 8) population -= 1` 을 코드로 적으면 그 감소는
 * **원인 없는 상태 변경**이 되고(GI-01), 재생도 감사도 할 수 없다. 여기 적힌 것은 전부 K2 가
 * 읽어 델타로 바꾸고, K3 이 사건으로 남긴다.
 *
 * ## 왜 전부 L1 인가
 *
 * 원본 15.1 의 사다리에서 `L1` 은 "물리·생명 기본 규칙"이다. S1 이 다루는 것이 정확히 그 층이다.
 * 종마다 다른 규칙(L2)이나 지역 규칙(L4)은 이 층 **안에서만** 예외를 만들 수 있으며, 그것은
 * 뒤에 올 페이즈의 몫이다.
 *
 * ## 한 의도에 한 법칙
 *
 * K2 는 맞은 규칙 중 하나만 고른다. 그래서 하루에 일어나는 일을 하나의 규칙에 몰아넣지 않고,
 * **의도를 나눠** 놓았다 — `fester`(상처와 병) · `settle`(체온) · `hunt`/`endure`(먹이와 허기).
 * 나누지 않으면 "굶으면서 동시에 상처가 곪는" 하루를 적을 수 없다.
 */

const verbIs = (verb: string): RuleSpec['when'] => ({
  op: 'eq',
  path: 'intent.intent_spec.verb',
  value: verb,
});

/** 상처가 곪는다 — 손상이 질병으로 바뀌는 자리다. */
const woundsFester: RuleSpec = {
  id: 'l1_wounds_fester',
  title: '상처는 아물면서 병을 남긴다',
  scope: 'L1',
  priority: 20,
  when: verbIs(NATURAL_VERB.FESTER),
  requires: { op: 'gt', path: 'actor.damage.wounds', value: 0 },
  costs: [],
  effects: [
    { op: 'add', path: 'actor.disease.load', value: 6 },
    { op: 'multiply', path: 'actor.damage.wounds', value: 0.5 },
  ],
  emits: [{ id: 'festering', channels: ['smell'] }],
  tags: ['biological'],
};

/** 성한 몸은 병에서 낫는다. */
const bodyRecovers: RuleSpec = {
  id: 'l1_body_recovers',
  title: '상처가 없으면 병세는 잦아든다',
  scope: 'L1',
  priority: 10,
  when: verbIs(NATURAL_VERB.FESTER),
  costs: [],
  effects: [{ op: 'multiply', path: 'actor.disease.load', value: 0.5 }],
  emits: [{ id: 'recovering', channels: ['sight'] }],
  tags: ['biological'],
};

/** 병이 깊으면 개체군이 준다 — 굶주림 말고도 죽는 길이 있다. */
const plagueTakesItsShare: RuleSpec = {
  id: 'l1_plague_takes_its_share',
  title: '병이 깊으면 개체군이 준다',
  scope: 'L1',
  priority: 30,
  when: verbIs(NATURAL_VERB.SETTLE),
  requires: { op: 'gt', path: 'actor.disease.load', value: 40 },
  costs: [],
  effects: [
    { op: 'add', path: 'actor.population.count', value: -1 },
    { op: 'add', path: 'actor.disease.load', value: -20 },
  ],
  emits: [{ id: 'plague_death', channels: ['sight', 'smell'] }],
  tags: ['biological'],
};

/** 병세가 열로 나타난다. */
const feverRises: RuleSpec = {
  id: 'l1_fever_rises',
  title: '병세가 깊어지면 열이 오른다',
  scope: 'L1',
  priority: 20,
  when: verbIs(NATURAL_VERB.SETTLE),
  requires: { op: 'gt', path: 'actor.disease.load', value: 20 },
  costs: [],
  effects: [{ op: 'add', path: 'actor.temperature.celsius', value: 1.5 }],
  emits: [{ id: 'fever', channels: ['touch'] }],
  tags: ['physical'],
};

/**
 * 몸은 제 체온으로 돌아간다.
 *
 * `multiply 0.98` 하나만 두면 고정점이 **0℃** 다 — 성한 사슴의 체온이 45일 만에 19.5℃ 가 되고,
 * 그것을 읽는 법칙이 없어 아무도 이상하다 하지 않는다. 곱한 뒤 더하면 고정점이 생긴다
 * (`0.9t + 3.8` → 38℃). 항온동물의 거시 모형으로 이만하면 족하다.
 */
const bodyHoldsItsHeat: RuleSpec = {
  id: 'l1_body_holds_its_heat',
  title: '몸은 제 체온으로 돌아간다',
  scope: 'L1',
  priority: 10,
  when: verbIs(NATURAL_VERB.SETTLE),
  costs: [],
  effects: [
    { op: 'multiply', path: 'actor.temperature.celsius', value: 0.9 },
    { op: 'add', path: 'actor.temperature.celsius', value: 3.8 },
  ],
  emits: [{ id: 'thermoregulation', channels: ['touch'] }],
  tags: ['physical'],
};

/**
 * 열이 너무 오르면 죽는다.
 *
 * 온도를 **읽는** 유일한 법칙이다. 이것이 없으면 체온은 오르내리기만 하고 아무것도 일으키지 않는
 * 장식이 된다 — 병으로 52℃ 가 된 무리가 멀쩡히 새끼를 쳤다. 손상 → 질병 → 열 → 죽음의 사슬은
 * 여기서 닫힌다.
 */
const heatKills: RuleSpec = {
  id: 'l1_heat_kills',
  title: '열이 너무 오르면 개체군이 준다',
  scope: 'L1',
  priority: 25,
  when: verbIs(NATURAL_VERB.SETTLE),
  requires: { op: 'gt', path: 'actor.temperature.celsius', value: 41 },
  costs: [],
  effects: [
    { op: 'add', path: 'actor.population.count', value: -1 },
    { op: 'add', path: 'actor.temperature.celsius', value: -4 },
  ],
  emits: [{ id: 'heat_death', channels: ['sight'] }],
  tags: ['physical', 'biological'],
};

/**
 * 먹는다.
 *
 * 먹이의 개체군을 **옮겨** 자기 질량으로 삼는다(`transfer`). 빼고 더하는 두 효과로 적으면 총량이
 * 슬쩍 늘거나 줄 수 있다 — `transfer` 는 K2 가 보존을 보장하는 유일한 효과다.
 */
const feed: RuleSpec = {
  id: 'l1_feed',
  title: '배고픈 것은 사정권의 먹이를 먹는다',
  scope: 'L1',
  priority: 30,
  when: verbIs(NATURAL_VERB.HUNT),
  requires: {
    op: 'and',
    items: [
      { op: 'gt', path: 'actor.hunger.value', value: 5 },
      { op: 'gt', path: 'target.population.count', value: 0 },
    ],
  },
  costs: [{ op: 'add', path: 'actor.hunger.value', value: 2 }],
  effects: [
    { op: 'transfer', from: 'target.population.count', to: 'actor.mass.kg', amount: 1 },
    { op: 'add', path: 'actor.hunger.value', value: -8 },
  ],
  emits: [{ id: 'predation', channels: ['sight', 'sound'] }],
  tags: ['biological', 'ecological'],
};

/**
 * 번식한다 — 배가 부를 때만.
 *
 * 개체군이 줄기만 하는 세계는 생태가 아니라 소멸이다. **먹이가 넉넉한 동안 늘어나던 것이
 * 먹이가 사라지자 줄기 시작한다**는 대비가 있어야 대표 검증의 "감소"가 의미를 갖는다.
 */
const breed: RuleSpec = {
  id: 'l1_breed',
  title: '배부른 것은 새끼를 친다',
  scope: 'L1',
  priority: 25,
  when: {
    op: 'or',
    items: [verbIs(NATURAL_VERB.HUNT), verbIs(NATURAL_VERB.ENDURE)],
  },
  requires: {
    op: 'and',
    items: [
      { op: 'not', item: { op: 'gt', path: 'actor.hunger.value', value: 2 } },
      // 배부른 하루만으로는 모자란다 — 몸에 쌓아 둔 것이 있어야 새끼를 친다.
      { op: 'gt', path: 'actor.mass.kg', value: 50 },
    ],
  },
  costs: [{ op: 'add', path: 'actor.hunger.value', value: 2 }],
  effects: [
    { op: 'add', path: 'actor.population.count', value: 1 },
    { op: 'add', path: 'actor.hunger.value', value: 3 },
  ],
  emits: [{ id: 'birth', channels: ['sight'] }],
  tags: ['biological'],
};

/** 굶어 죽는다. */
const starve: RuleSpec = {
  id: 'l1_starve',
  title: '먹을 것이 없는 채로 오래 버티면 개체군이 준다',
  scope: 'L1',
  priority: 20,
  when: verbIs(NATURAL_VERB.ENDURE),
  requires: { op: 'gt', path: 'actor.hunger.value', value: 8 },
  costs: [{ op: 'add', path: 'actor.hunger.value', value: 2 }],
  effects: [
    { op: 'add', path: 'actor.population.count', value: -1 },
    { op: 'add', path: 'actor.hunger.value', value: -6 },
    // 굶으면 제 몸을 태운다. 먹는 것이 옮기는 일이라면, 굶는 것은 잃는 일이다.
    { op: 'add', path: 'actor.mass.kg', value: -2 },
  ],
  emits: [{ id: 'starvation', channels: ['sight'] }],
  tags: ['biological', 'ecological'],
};

/** 먹이를 앞에 두고도 배가 덜 고파 그냥 하루를 보낸다. */
const prowl: RuleSpec = {
  id: 'l1_prowl',
  title: '아직 배가 고프지 않으면 먹이를 두고도 지나간다',
  scope: 'L1',
  priority: 10,
  when: verbIs(NATURAL_VERB.HUNT),
  costs: [{ op: 'add', path: 'actor.hunger.value', value: 2 }],
  effects: [],
  emits: [{ id: 'prowling', channels: ['sight'] }],
  tags: ['biological'],
};

/** 먹을 것 없는 하루 — 허기만 는다. */
const endure: RuleSpec = {
  id: 'l1_endure',
  title: '먹을 것이 없는 하루는 허기만 늘린다',
  scope: 'L1',
  priority: 10,
  when: verbIs(NATURAL_VERB.ENDURE),
  costs: [{ op: 'add', path: 'actor.hunger.value', value: 2 }],
  effects: [],
  emits: [{ id: 'enduring', channels: ['sight'] }],
  tags: ['biological'],
};

/**
 * 자연 법칙 한 벌.
 *
 * 순서는 뜻이 없다 — K2 의 `RuleBook` 이 `scope` → `priority` → `id` 로 다시 정렬한다.
 * 여기서는 사람이 읽기 좋게 몸(질병·체온)에서 생태(먹이·개체군)로 내려간다.
 */
export const NATURAL_LAWS: RuleSpec[] = [
  woundsFester,
  bodyRecovers,
  plagueTakesItsShare,
  heatKills,
  feverRises,
  bodyHoldsItsHeat,
  feed,
  breed,
  starve,
  prowl,
  endure,
];

/** 법칙 id 오름차순 — 계약과 화면이 같은 목록을 본다. */
export const NATURAL_LAW_IDS: string[] = NATURAL_LAWS.map((law) => law.id).sort();
