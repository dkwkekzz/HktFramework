// O0 검증 장면 — 붉은 장막 세계에 들이려는 정의들.
//
// O1 장면은 그 컷에 무엇이 **있는지**(12타입), O2 장면은 그 존재들이 지금 어떤 **값**에
// 있는지를 적었다. 여기서는 그보다 앞선 것을 적는다 — 애초에 **무엇이 세계에 설 수 있는가**.
//
// 능력 셋과 종 넷이 공리를 근거로 서고, 그 정의들이 O2 의 자리(의념 에너지·능력 흔적·
// 숭배량·소문 전파)를 실제로 가리킨다. 즉 O0 → O2 는 말이 아니라 자리로 이어진다.
//
// 결함 정의 14종은 각자 다른 조항을 하나씩 어긴다. 대부분은 **O1 로서는 온전한 Rule** 이다 —
// O0 가 없으면 그대로 세계에 들어갔을 정의들이다.

import { deterministicId, type Id } from '@hkt/core/v1';
import {
  axiomId,
  type AbilityDefinition,
  type AxiomViolationRule,
  type Definition,
  type SpeciesDefinition,
} from '@hkt/core/o0';

import { healingClaim, herbId, nestId } from './o2-hunter-world.ts';

export { healingClaim, herbId, nestId };

/** 신을 낳은 두 집단 — 반복 행동의 주체다 (emergent-divinity). */
export const villagersId: Id = deterministicId('subject', 'organization', '아랫마을 사람들');
export const peddlersId: Id = deterministicId('subject', 'organization', '고개를 넘는 행상단');

/** 정의의 ID 는 규칙의 ID 다 — 능력의 흔적 자리가 이 ID 를 매개로 받는다. */
function definitionId(kind: 'ability' | 'species', name: string): Id {
  return deterministicId('rule', kind, name);
}

export const veilId = definitionId('ability', '붉은 장막');
export const toxinReadId = definitionId('ability', '독 감별');
export const inscribeId = definitionId('ability', '전언 새김');

/** 붉은 장막 — 둥지 전체를 덮는 대능력. 강한 만큼 의념을 태우고, 빛과 간섭으로 관찰된다. */
export const veil: AbilityDefinition = {
  kind: 'Rule',
  id: veilId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '붉은 장막',
  when: ['둥지에 피 냄새를 묻힌 것이 들어온다'],
  then: ['둥지 전체가 붉은 안개에 잠기고 바깥의 시야가 끊긴다'],
  axiomId: axiomId('verifiable-cost'),
  supportIds: [axiomId('observable-trace')],
  strength: 0.9,
  costs: [{ domain: 'psychic', path: 'energy', amount: 120 }],
  traces: [
    { channel: 'light', domain: 'psychic', path: `trace.${veilId}` },
    { channel: 'psychic', domain: 'psychic', path: `interference.${nestId}` },
  ],
};

/** 독 감별 — 약초를 손에 쥐면 독의 세기가 읽힌다. 약한 능력이라 대가가 없다. */
export const toxinRead: AbilityDefinition = {
  kind: 'Rule',
  id: toxinReadId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '독 감별',
  when: ['맨손으로 약초를 쥔다'],
  then: ['그 약초의 독성이 손끝의 저림으로 읽힌다'],
  axiomId: axiomId('observable-trace'),
  supportIds: [],
  strength: 0.3,
  costs: [],
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${toxinReadId}` }],
};

/** 전언 새김 — 남의 입에 말을 심는다. 흔적은 의념이 아니라 소문으로 남는다. */
export const inscribe: AbilityDefinition = {
  kind: 'Rule',
  id: inscribeId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '전언 새김',
  when: ['상대의 눈을 마주 보고 한 문장을 말한다'],
  then: ['그 문장이 상대의 기억에 자기 것으로 새겨진다'],
  axiomId: axiomId('verifiable-cost'),
  supportIds: [axiomId('observable-trace')],
  strength: 0.7,
  costs: [{ domain: 'biological', path: 'vitality', amount: 0.05 }],
  traces: [{ channel: 'report', domain: 'informational', path: `rumorSpread.${healingClaim.id}` }],
};

/** 사냥꾼 — 사람. 굶고, 다치고, 무언가를 믿는다. */
export const hunterSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: definitionId('species', '사냥꾼'),
  definitionKind: 'species',
  domain: 'biological',
  name: '사냥꾼',
  when: ['세계에 사람이 선다'],
  then: ['허기와 체력을 지고, 믿는 것에 따라 신념 압력을 갖는다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'person',
  alive: true,
  slots: [
    { domain: 'biological', path: 'hunger' },
    { domain: 'biological', path: 'vitality' },
    // 번식력 — 대를 잇는 자리다 (D2 가 늙는 종에게 요구한다). 종이 열지 않으면 대도 잇지 못한다.
    { domain: 'biological', path: 'fertility' },
    { domain: 'psychic', path: 'conviction' },
  ],
  originId: null,
};

/** 장막벌레 — 둥지에 붙어 사는 생물. 개체군으로 존재하고 의념을 옮긴다. */
export const veilWorm: SpeciesDefinition = {
  kind: 'Rule',
  id: definitionId('species', '장막벌레'),
  definitionKind: 'species',
  domain: 'biological',
  name: '장막벌레',
  when: ['둥지에 붉은 안개가 고인다'],
  then: ['안개를 먹고 개체군이 늘며, 몸에 의념을 머금는다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'creature',
  alive: true,
  slots: [
    { domain: 'biological', path: 'vitality' },
    { domain: 'ecological', path: 'population' },
    { domain: 'psychic', path: 'energy' },
  ],
  originId: null,
};

/** 붉은 장막의 어미 — 아랫마을이 대를 이어 바친 제물에서 생긴 신. */
export const motherGodSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: definitionId('species', '붉은 장막의 어미'),
  definitionKind: 'species',
  domain: 'transcendent',
  name: '붉은 장막의 어미',
  when: ['아랫마을이 같은 자리에 같은 제물을 계속 바친다'],
  then: ['둥지 위에 신역이 걸리고, 숭배량만큼 어미의 의념이 두터워진다'],
  axiomId: axiomId('emergent-divinity'),
  supportIds: [axiomId('psychic-life')],
  subjectKind: 'god',
  alive: true,
  slots: [
    { domain: 'psychic', path: 'energy' },
    { domain: 'transcendent', path: 'anchor' },
    { domain: 'transcendent', path: 'worship' },
    { domain: 'transcendent', path: `divineDomain.${nestId}` },
  ],
  originId: villagersId,
};

/** 길 위의 이름 없는 신 — 행상단이 고개마다 돌을 쌓아 온 반복에서 생긴 신. */
export const roadGodSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: definitionId('species', '길 위의 이름 없는 신'),
  definitionKind: 'species',
  domain: 'transcendent',
  name: '길 위의 이름 없는 신',
  when: ['행상단이 고개를 넘을 때마다 같은 자리에 돌을 쌓는다'],
  then: ['길 위에 정당성이 서고, 그 길을 어기는 자에게 값이 붙는다'],
  axiomId: axiomId('emergent-divinity'),
  supportIds: [axiomId('psychic-life')],
  subjectKind: 'god',
  alive: true,
  slots: [
    { domain: 'psychic', path: 'conviction' },
    { domain: 'transcendent', path: 'worship' },
    { domain: 'transcendent', path: 'legitimacy' },
  ],
  originId: peddlersId,
};

/** 공리 위에 선 정의 7개 — 능력 셋 + 종 넷. */
export const VEIL_DEFINITIONS: readonly Definition[] = [
  veil,
  toxinRead,
  inscribe,
  hunterSpecies,
  veilWorm,
  motherGodSpecies,
  roadGodSpecies,
];

/** 결함 정의 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenDefinition {
  readonly broke: string;
  readonly expected: AxiomViolationRule;
  readonly value: Definition;
}

/** 결함 정의 14종 — 조항마다 하나씩. 대부분 O1 로서는 온전한 Rule 이다. */
export const BROKEN_DEFINITIONS: readonly BrokenDefinition[] = [
  {
    broke: '어느 공리에서 나왔는지 적지 않았다',
    expected: 'ungrounded-definition',
    value: { ...toxinRead, name: '근거 없는 감별', axiomId: null },
  },
  {
    broke: '공리 집합에 없는 것을 근거로 들었다',
    expected: 'unknown-axiom',
    value: { ...toxinRead, name: '공짜 점심 술', axiomId: deterministicId('axiom', 'free-lunch') },
  },
  {
    broke: '효과 없는 규칙이다 — 정의로서 무너졌다',
    expected: 'bad-definition',
    value: { ...toxinRead, name: '아무 일도 없는 술', then: [] },
  },
  {
    broke: '살아 있는데 의념 자리가 없다',
    expected: 'mindless-life',
    value: {
      ...hunterSpecies,
      name: '넋 없는 사람',
      slots: [{ domain: 'biological', path: 'hunger' }],
    },
  },
  {
    broke: '사람인데 생명이 아니라고 선언했다',
    expected: 'life-denied',
    value: { ...hunterSpecies, name: '숨 없는 사람', alive: false },
  },
  {
    broke: '강도 0.9 인데 아무것도 치르지 않는다',
    expected: 'free-strong-effect',
    value: { ...veil, name: '공짜 장막', costs: [] },
  },
  {
    broke: '치른다고 적었으나 양이 0 이다',
    expected: 'weightless-cost',
    value: {
      ...veil,
      name: '시늉만 하는 장막',
      costs: [{ domain: 'psychic', path: 'energy', amount: 0 }],
    },
  },
  {
    broke: '세계에 없는 자리(psychic.mana)를 깎는다',
    expected: 'unverifiable-cost',
    value: {
      ...veil,
      name: '마나를 태우는 장막',
      costs: [{ domain: 'psychic', path: 'mana', amount: 30 }],
    },
  },
  {
    broke: '흔적을 남기지 않는다',
    expected: 'traceless-ability',
    value: { ...toxinRead, name: '자국 없는 감별', traces: [] },
  },
  {
    broke: '현상 통로 6종 밖으로 관찰된다',
    expected: 'unknown-channel',
    value: {
      ...toxinRead,
      name: '수군거림으로만 아는 감별',
      traces: [
        { channel: 'gossip' as never, domain: 'psychic', path: `trace.${toxinReadId}` },
      ],
    },
  },
  {
    broke: '세계에 적힐 자리 없는 흔적을 남긴다',
    expected: 'unobservable-trace',
    value: {
      ...toxinRead,
      name: '잔광만 남기는 감별',
      traces: [{ channel: 'light', domain: 'psychic', path: 'afterglow' }],
    },
  },
  {
    broke: '어느 집단에서 나왔는지 없는 신이다',
    expected: 'ungrounded-god',
    value: { ...motherGodSpecies, name: '스스로 있는 신', originId: null },
  },
  {
    broke: '초월 영역에 자리가 없는 신이다',
    expected: 'unanchored-god',
    value: {
      ...roadGodSpecies,
      name: '걸리지 않은 신',
      slots: [{ domain: 'psychic', path: 'conviction' }],
    },
  },
  {
    broke: '신이 아닌데 집단의 반복 행동을 유래로 들었다',
    expected: 'origin-without-divinity',
    value: { ...hunterSpecies, name: '마을이 낳은 사냥꾼', originId: villagersId },
  },
];
