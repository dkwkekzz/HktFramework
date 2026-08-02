// D2 검증 장면 — 붉은 장막 세계의 종 다섯이 각자의 기본 의존을 물려준다.
//
// D1 장면은 몰이꾼 04 한 사람의 겨울 그래프였다. 손으로 적은 그래프였고, 그래서 같은 종의
// 다른 사냥꾼이 전혀 다른 것에 기대도 아무것도 막지 못했다. 이 장면이 세우는 것은 그 앞이다 —
// **종 하나에서 그래프 하나가 나온다.**
//
//   사냥꾼      주린 몸 · 성한 몸 · 대 이을 몸 — 세 갈래로 갈린다
//   장막벌레    군집 하나 — 지금의 생존과 다음 세대가 같은 자리다
//   채집 결사   창고 하나 — 늙지 않으므로 대를 잇지 않는다
//   협곡을 낀 나라 · 붉은 장막의 어미 — 되풀이로만 서는 것들
//
// 그리고 이 파일에는 개체의 이름이 거의 없다. 자리의 주인은 `self`·`body`·`other` 로만 적히고,
// 몰이꾼 04 인지 몰이꾼 07 인지는 그래프를 찍어 낼 때 채워진다.

import { deterministicId, type Id } from '@hkt/core/v1';
import type { NeedTemplate } from '@hkt/core/s1';
import type { NodeTarget } from '@hkt/core/d1';
import type {
  FillRef,
  RootSpec,
  SpeciesBlueprint,
  SupplyEffect,
  SupplyHolder,
  SupplySpec,
} from '@hkt/core/d2';

import {
  canyonId,
  guildArchetype,
  herbId,
  hunterArchetype,
  motherGodArchetype,
  nationArchetype,
  nestId,
  veilWormArchetype,
  villagersId,
} from './s1-veil-species.ts';

export {
  canyonId,
  guildArchetype,
  herbId,
  hunterArchetype,
  motherGodArchetype,
  nationArchetype,
  nestId,
  veilWormArchetype,
  villagersId,
};

/** 이 장면이 새로 세우는 것들 — 종 수준에서 이름을 댈 수 있는 세계의 것. */
export const meatId: Id = deterministicId('entity', 'material', '말린 고기');
export const hamletId: Id = deterministicId('entity', 'place', '아랫마을');
export const passLawId: Id = deterministicId('rule', 'institutional', '고개 통행법');
export const toxinClaimId: Id = deterministicId('claim', 'herb', '붉은 잎은 마비독이다');

const SELF: SupplyHolder = { of: 'self' };
const BODY: SupplyHolder = { of: 'body' };
const at = (id: Id): SupplyHolder => ({ of: 'other', id });

const entity = (id: Id, name: string, entityKind: NodeTarget['entityKind']): NodeTarget => ({
  ontology: 'Entity',
  id,
  name,
  entityKind,
  domain: null,
});
const ruleTarget = (id: Id, name: string): NodeTarget => ({
  ontology: 'Rule',
  id,
  name,
  entityKind: null,
  domain: null,
});

const root = (fills: NeedTemplate['slot']): FillRef => ({ kind: 'root', slot: fills });
const from = (label: string): FillRef => ({ kind: 'supply', label });

/** 끊김의 흔적 하나 — 수치가 움직인다. */
const delta = (
  domain: SupplyEffect['slot']['domain'],
  path: string,
  holder: SupplyHolder,
  by: number,
  note: string,
): SupplyEffect => ({ slot: { domain, path }, holder, change: { kind: 'delta', by }, note });

// ─────────────────────────────────────────────────────────────────────────────
// 사냥꾼 — 굶는 것과 다치는 것과 대가 끊기는 것이 서로 다른 자리다.
// ─────────────────────────────────────────────────────────────────────────────

/** 사냥꾼이 대를 잇는 자리 — 종이 여는 `biological.fertility`. */
export const hunterLineage: NeedTemplate = {
  slot: { domain: 'biological', path: 'fertility' },
  holder: 'self',
  band: { kind: 'range', min: 0.2, max: 1 },
  urgency: 0.2,
  baseTicks: 400,
  note: '번식력이 이 아래로 400틱을 머물면 이 사냥꾼에게서 다음 세대가 나오지 않는다',
};

const hunterRoots: readonly RootSpec[] = [
  {
    slot: { domain: 'biological', path: 'hunger' },
    kind: 'body',
    label: '주린 몸',
    targetsOwnState: true,
    note: '허기는 내 몸의 값이다 — 먹고 자면 스스로 돌아오지만 두면 무너진다 (D0 신체)',
  },
  {
    slot: { domain: 'biological', path: 'vitality' },
    kind: 'body',
    label: '성한 몸',
    targetsOwnState: true,
    note: '체력도 내 몸의 값이다 — 바닥나면 그 자리에서 끝난다',
  },
  {
    slot: { domain: 'biological', path: 'fertility' },
    kind: 'body',
    label: '대 이을 몸',
    targetsOwnState: true,
    note: '번식력은 몸의 값이고, 그것이 마르면 종이 아니라 대가 끊긴다',
  },
];

const hunterSupplies: readonly SupplySpec[] = [
  {
    label: '겨울 식량',
    fills: [root({ domain: 'biological', path: 'hunger' })],
    kind: 'resource',
    relation: 'consumes',
    target: entity(meatId, '말린 고기', 'material'),
    condition: {
      kind: 'slot',
      slot: { domain: 'economic', path: `stock.${meatId}` },
      holder: SELF,
      band: { kind: 'range', min: 3, max: 1000000000 },
    },
    strength: 0.95,
    substitutability: 0.7,
    urgency: null,
    baseDelayTicks: null,
    failureEffects: [
      delta('biological', 'hunger', SELF, 0.15, '먹을 것이 끊긴 채 시한이 지나면 허기가 오른다'),
    ],
    note: '먹어서 없앤다 — 그래서 이 기댐은 끝나지 않고 되풀이된다',
  },
  {
    label: '사냥터',
    fills: [from('겨울 식량')],
    kind: 'space',
    relation: 'requires',
    target: entity(canyonId, '국경 협곡', 'place'),
    condition: {
      kind: 'slot',
      slot: { domain: 'physical', path: 'region' },
      holder: SELF,
      band: { kind: 'is', value: canyonId },
    },
    strength: 0.8,
    substitutability: 0.2,
    urgency: 0.5,
    baseDelayTicks: 6,
    failureEffects: [
      delta('economic', `stock.${meatId}`, SELF, -2, '사냥을 못 나가면 재고가 준다'),
    ],
    note: '장막벌레는 이 협곡에만 산다 — 다른 골짜기로 가면 사냥 자체가 없다',
  },
  {
    label: '고개 통행권',
    fills: [from('사냥터')],
    kind: 'institution',
    relation: 'authorized_by',
    target: ruleTarget(passLawId, '고개 통행법'),
    condition: {
      kind: 'slot',
      slot: { domain: 'institutional', path: `license.${passLawId}` },
      holder: SELF,
      band: { kind: 'is', value: true },
    },
    strength: 0.7,
    substitutability: 0.1,
    urgency: 0.3,
    baseDelayTicks: 10,
    failureEffects: [
      delta('institutional', 'bounty', SELF, 30, '자격 없이 넘다 걸리면 현상금이 걸린다'),
    ],
    note: '고개는 열려 있어도 자격이 없으면 못 넘는다 — 제도가 공간을 허락한다',
  },
  {
    label: '장막이 걷히는 주기',
    fills: [from('사냥터')],
    kind: 'time',
    relation: 'sustained_by',
    target: null,
    condition: { kind: 'clock', everyTicks: 12, withinTicks: 3 },
    strength: 0.6,
    substitutability: 0,
    urgency: 0.4,
    baseDelayTicks: 12,
    failureEffects: [
      delta('physical', 'cover', at(canyonId), 0.5, '장막이 걷히지 않으면 협곡 바닥이 덮인다'),
    ],
    note: '주기를 놓치면 열두 틱을 더 기다린다 — 앞당길 방법이 없다',
  },
  {
    label: '마비독 감별',
    fills: [from('겨울 식량')],
    kind: 'information',
    relation: 'informed_by',
    target: {
      ontology: 'Claim',
      id: toxinClaimId,
      name: '붉은 잎은 마비독이다',
      entityKind: null,
      domain: null,
    },
    condition: {
      kind: 'slot',
      slot: { domain: 'informational', path: `knows.${toxinClaimId}` },
      holder: SELF,
      band: { kind: 'is', value: true },
    },
    strength: 0.5,
    substitutability: 0.4,
    urgency: 0.6,
    baseDelayTicks: 2,
    failureEffects: [
      {
        slot: { domain: 'biological', path: 'toxin' },
        holder: SELF,
        change: { kind: 'set', value: '마비독' },
        note: '모르고 붉은 잎을 씹으면 몸에 마비독이 든다',
      },
      delta('biological', 'toxicity', SELF, 0.4, '그 세기가 쌓인다 — 종류와 세기는 따로 적힌다'),
    ],
    note: '무엇이 먹을 것인지 아는 것이 먹을 것 자체만큼 필요하다',
  },
  {
    label: '겨울 움막',
    // 하나가 둘을 떠받친다 — 몸을 지키고 대를 지킨다. 시한은 각각의 무너짐이 정한다.
    fills: [
      root({ domain: 'biological', path: 'vitality' }),
      root({ domain: 'biological', path: 'fertility' }),
    ],
    kind: 'space',
    relation: 'protected_by',
    target: entity(hamletId, '아랫마을', 'place'),
    condition: {
      kind: 'slot',
      slot: { domain: 'physical', path: 'region' },
      holder: SELF,
      band: { kind: 'is', value: hamletId },
    },
    strength: 0.6,
    substitutability: 0.3,
    urgency: null,
    baseDelayTicks: null,
    failureEffects: [
      delta('biological', 'vitality', SELF, -0.2, '겨울에 들 곳이 없으면 몸이 상한다'),
    ],
    note: '들 곳이 없으면 겨울을 나지 못하고, 겨울을 나지 못하면 대도 잇지 못한다',
  },
];

export const hunterBlueprint: SpeciesBlueprint = {
  speciesId: hunterArchetype.id,
  roots: hunterRoots,
  lineage: hunterLineage,
  supplies: hunterSupplies,
};

// ─────────────────────────────────────────────────────────────────────────────
// 장막벌레 — 군집 하나가 지금의 생존이자 다음 세대다.
// ─────────────────────────────────────────────────────────────────────────────

const wormPopulation: NeedTemplate = veilWormArchetype.baseNeeds[0] as NeedTemplate;

export const veilWormBlueprint: SpeciesBlueprint = {
  speciesId: veilWormArchetype.id,
  roots: [
    {
      slot: wormPopulation.slot,
      kind: 'environment',
      label: '스러지지 않는 군집',
      targetsOwnState: true,
      note: '개체군은 둥지가 지닌 값이다 — 누구의 것도 아닌 밖의 상태로 읽는다 (D0 환경)',
    },
  ],
  // 대 잇는 자리가 무너지는 자리와 같다 — 뿌리 하나가 둘을 떠받친다.
  lineage: wormPopulation,
  supplies: [
    {
      label: '협곡 바닥의 온기',
      fills: [root(wormPopulation.slot)],
      kind: 'environment',
      relation: 'requires',
      target: null,
      condition: {
        kind: 'slot',
        slot: { domain: 'physical', path: 'temperature' },
        holder: at(nestId),
        band: { kind: 'range', min: 4, max: 60 },
      },
      strength: 0.85,
      substitutability: 0.1,
      urgency: null,
      baseDelayTicks: null,
      failureEffects: [
        delta('ecological', 'population', at(nestId), -5, '바닥이 식으면 굳어 죽는다'),
      ],
      note: '온기는 옮겨 가거나 막을 뿐 채울 수 없다 — 밖의 상태다',
    },
    {
      label: '붉은 안개',
      fills: [root(wormPopulation.slot)],
      kind: 'resource',
      relation: 'consumes',
      target: entity(herbId, '붉은 장막', 'material'),
      condition: {
        kind: 'slot',
        slot: { domain: 'ecological', path: 'depletion' },
        holder: at(nestId),
        band: { kind: 'range', min: 0, max: 0.6 },
      },
      strength: 0.9,
      substitutability: 0.2,
      urgency: null,
      baseDelayTicks: null,
      failureEffects: [
        delta('ecological', 'population', at(nestId), -8, '먹을 안개가 마르면 군집이 준다'),
      ],
      note: '안개를 먹는다 — 먹으면 줄고, 줄면 다시 고여야 한다',
    },
    {
      label: '둥지',
      fills: [from('붉은 안개'), from('협곡 바닥의 온기')],
      kind: 'space',
      relation: 'protected_by',
      target: entity(nestId, '붉은 장막 둥지', 'place'),
      condition: {
        kind: 'slot',
        slot: { domain: 'physical', path: 'region' },
        holder: BODY,
        band: { kind: 'is', value: nestId },
      },
      strength: 0.7,
      substitutability: 0,
      urgency: 0.3,
      baseDelayTicks: 30,
      failureEffects: [
        delta('physical', 'cover', at(nestId), -0.4, '둥지를 잃으면 안개가 고이지 않는다'),
      ],
      note: '안개도 온기도 이 둥지 안에서만 고인다 — 벌레와 둥지는 갈라지지 않는다',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 몸 없는 셋 — 늙지 않고, 낳지 않고, 되풀이로만 선다.
// ─────────────────────────────────────────────────────────────────────────────

export const guildBlueprint: SpeciesBlueprint = {
  speciesId: guildArchetype.id,
  roots: [
    {
      slot: { domain: 'economic', path: `stock.${herbId}` },
      kind: 'resource',
      label: '창고의 약초',
      targetsOwnState: false,
      note: '결사는 창고로 유지된다 — 재고가 바닥나면 흩어진다',
    },
  ],
  lineage: null,
  supplies: [
    {
      label: '약초 자생지',
      fills: [root({ domain: 'economic', path: `stock.${herbId}` })],
      kind: 'space',
      relation: 'requires',
      target: entity(canyonId, '국경 협곡', 'place'),
      condition: {
        kind: 'slot',
        slot: { domain: 'physical', path: 'region' },
        holder: SELF,
        band: { kind: 'is', value: canyonId },
      },
      strength: 0.8,
      substitutability: 0.3,
      urgency: null,
      baseDelayTicks: null,
      failureEffects: [
        delta('economic', `stock.${herbId}`, SELF, -10, '캘 곳이 없으면 재고만 줄어든다'),
      ],
      note: '붉은 장막은 협곡 바닥에서만 자란다',
    },
    {
      label: '채집권',
      fills: [from('약초 자생지')],
      kind: 'institution',
      relation: 'authorized_by',
      target: ruleTarget(passLawId, '고개 통행법'),
      condition: {
        kind: 'slot',
        slot: { domain: 'institutional', path: `license.${passLawId}` },
        holder: SELF,
        band: { kind: 'is', value: true },
      },
      strength: 0.6,
      substitutability: 0.2,
      urgency: 0.3,
      baseDelayTicks: 20,
      failureEffects: [
        delta('institutional', 'bounty', SELF, 10, '자격 없이 캐면 결사에 현상금이 걸린다'),
      ],
      note: '나라가 채집을 허락해야 협곡 바닥에 들어갈 수 있다',
    },
  ],
};

export const nationBlueprint: SpeciesBlueprint = {
  speciesId: nationArchetype.id,
  roots: [
    {
      slot: { domain: 'transcendent', path: 'legitimacy' },
      kind: 'ritual',
      label: '되풀이된 정당성',
      targetsOwnState: false,
      note: '정당성은 되풀이가 남긴 값이다 — 한 번 세워 두는 것이 아니라 계속 치러야 남는다',
    },
  ],
  lineage: null,
  supplies: [
    {
      label: '법의 집행',
      fills: [root({ domain: 'transcendent', path: 'legitimacy' })],
      kind: 'institution',
      relation: 'authorized_by',
      target: ruleTarget(passLawId, '고개 통행법'),
      condition: {
        kind: 'slot',
        slot: { domain: 'institutional', path: `law.${passLawId}` },
        holder: SELF,
        band: { kind: 'is', value: true },
      },
      strength: 0.8,
      substitutability: 0.2,
      urgency: null,
      baseDelayTicks: null,
      failureEffects: [
        delta('transcendent', 'legitimacy', SELF, -0.1, '법이 서지 않으면 정당성이 마른다'),
      ],
      note: '지켜지지 않는 법은 나라를 세우지 못한다',
    },
    {
      label: '백성의 신뢰',
      fills: [root({ domain: 'transcendent', path: 'legitimacy' })],
      kind: 'relationship',
      relation: 'sustained_by',
      target: {
        ontology: 'State',
        id: deterministicId('state', villagersId, 'relational.trust'),
        name: '아랫마을이 나라에 두는 신뢰',
        entityKind: null,
        domain: 'relational',
      },
      condition: {
        kind: 'slot',
        slot: { domain: 'relational', path: `trust.${villagersId}` },
        holder: SELF,
        band: { kind: 'range', min: 0.2, max: 1 },
      },
      strength: 0.7,
      substitutability: 0,
      urgency: null,
      baseDelayTicks: null,
      failureEffects: [
        delta('transcendent', 'legitimacy', SELF, -0.2, '아랫마을이 등을 돌리면 정당성이 꺾인다'),
      ],
      note: '아랫마을이 나라를 나라로 여기는 동안만 나라다',
    },
  ],
};

export const motherGodBlueprint: SpeciesBlueprint = {
  speciesId: motherGodArchetype.id,
  roots: [
    {
      slot: { domain: 'transcendent', path: 'worship' },
      kind: 'ritual',
      label: '끊이지 않는 기원',
      targetsOwnState: false,
      note: '숭배량은 되풀이가 남긴 값이다 — 아무도 빌지 않으면 어미는 흩어진다',
    },
  ],
  lineage: null,
  supplies: [
    {
      label: '아랫마을의 신념',
      fills: [root({ domain: 'transcendent', path: 'worship' })],
      kind: 'ritual',
      relation: 'sustained_by',
      target: null,
      condition: {
        kind: 'slot',
        slot: { domain: 'psychic', path: 'conviction' },
        holder: at(villagersId),
        band: { kind: 'range', min: 0.3, max: 1 },
      },
      strength: 0.9,
      substitutability: 0.3,
      urgency: null,
      baseDelayTicks: null,
      failureEffects: [
        delta('transcendent', 'worship', SELF, -50, '믿음이 식으면 기원이 끊긴다'),
      ],
      note: '남이 대신 치를 수 있다 — 그래서 사제가 생긴다 (D0 의례)',
    },
    {
      label: '앵커가 걸린 둥지',
      fills: [from('아랫마을의 신념')],
      kind: 'space',
      relation: 'protected_by',
      target: entity(nestId, '붉은 장막 둥지', 'place'),
      condition: {
        kind: 'slot',
        slot: { domain: 'physical', path: 'region' },
        holder: SELF,
        band: { kind: 'is', value: nestId },
      },
      strength: 0.6,
      substitutability: 0,
      urgency: 0.2,
      baseDelayTicks: 50,
      failureEffects: [
        delta('psychic', 'conviction', at(villagersId), -0.2, '빌 자리가 없어지면 믿음이 식는다'),
      ],
      note: '신은 걸린 자리가 있어야 빌 수 있다 — 앵커가 풀리면 마을의 믿음부터 식는다',
    },
  ],
};

/** 붉은 장막 세계의 설계도 다섯 — 종 원형과 짝지어 둔다. */
export const VEIL_BLUEPRINTS: readonly {
  readonly archetype: typeof hunterArchetype;
  readonly blueprint: SpeciesBlueprint;
}[] = [
  { archetype: hunterArchetype, blueprint: hunterBlueprint },
  { archetype: veilWormArchetype, blueprint: veilWormBlueprint },
  { archetype: guildArchetype, blueprint: guildBlueprint },
  { archetype: nationArchetype, blueprint: nationBlueprint },
  { archetype: motherGodArchetype, blueprint: motherGodBlueprint },
];

/** 설 수 없는 설계도 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenBlueprint {
  readonly broke: string;
  readonly expected: string;
  readonly archetype: typeof hunterArchetype;
  readonly blueprint: SpeciesBlueprint;
}

const withHunter = (patch: Partial<SpeciesBlueprint>): SpeciesBlueprint => ({
  ...hunterBlueprint,
  ...patch,
});

/** 설 수 없는 설계도 열다섯 — 사유마다 하나씩. */
export const BROKEN_BLUEPRINTS: readonly BrokenBlueprint[] = [
  {
    broke: '굶는다고 말해 놓고 먹을 것이 없다 — 생존 경로가 끊겼다',
    expected: 'unsupplied-need',
    archetype: hunterArchetype,
    blueprint: withHunter({
      // 식량 갈래 전체를 걷어 낸다 — 남은 것은 몸을 지키는 움막뿐이고, 주린 몸은 아무것도 받지 못한다.
      supplies: hunterSupplies.filter((supply) => supply.label === '겨울 움막'),
    }),
  },
  {
    broke: '늙는 종이 대를 잇는 자리를 밝히지 않았다 — 한 세대로 끝난다',
    expected: 'lineage-missing',
    archetype: hunterArchetype,
    blueprint: withHunter({
      lineage: null,
      roots: hunterRoots.filter((entry) => entry.slot.path !== 'fertility'),
      supplies: hunterSupplies.map((supply) =>
        supply.label === '겨울 움막'
          ? { ...supply, fills: [root({ domain: 'biological', path: 'vitality' })] }
          : supply,
      ),
    }),
  },
  {
    broke: '대는 밝혔는데 이을 것이 없다 — 대가 끊기는데 그래프가 답하지 못한다',
    expected: 'unsupplied-lineage',
    archetype: hunterArchetype,
    blueprint: withHunter({
      supplies: hunterSupplies.map((supply) =>
        supply.label === '겨울 움막'
          ? { ...supply, fills: [root({ domain: 'biological', path: 'vitality' })] }
          : supply,
      ),
    }),
  },
  {
    broke: '늙지 않는 결사가 대를 잇는다고 적었다 — 조직은 낳지 않는다',
    expected: 'ageless-lineage',
    archetype: guildArchetype,
    blueprint: { ...guildBlueprint, lineage: hunterLineage },
  },
  {
    broke: '종이 열지 않은 자리로 대를 잇는다 — 사냥꾼은 개체군을 갖지 않는다',
    expected: 'off-species-lineage',
    archetype: hunterArchetype,
    blueprint: withHunter({
      lineage: { ...hunterLineage, slot: { domain: 'ecological', path: 'population' } },
    }),
  },
  {
    broke: '종이 말하지 않은 자리에 뿌리를 세웠다',
    expected: 'phantom-root',
    archetype: hunterArchetype,
    blueprint: withHunter({
      roots: [
        ...hunterRoots,
        {
          slot: { domain: 'psychic', path: 'conviction' },
          kind: 'ritual',
          label: '흔들리지 않는 믿음',
          targetsOwnState: false,
          note: '사냥꾼은 믿음으로 무너진다',
        },
      ],
    }),
  },
  {
    broke: '무너지는 자리에 뿌리가 없다 — 무너지는데 그래프가 그것을 모른다',
    expected: 'unrooted-need',
    archetype: hunterArchetype,
    blueprint: withHunter({
      roots: hunterRoots.filter((entry) => entry.slot.path !== 'vitality'),
    }),
  },
  {
    broke: '같은 자리에 뿌리가 둘이다',
    expected: 'duplicate-root',
    archetype: hunterArchetype,
    blueprint: withHunter({
      roots: [
        ...hunterRoots,
        {
          slot: { domain: 'biological', path: 'hunger' },
          kind: 'resource',
          label: '또 다른 주림',
          targetsOwnState: false,
          note: '같은 허기를 두 번 센다',
        },
      ],
    }),
  },
  {
    broke: '설계도에 없는 것을 채운다고 적었다',
    expected: 'dangling-fill',
    archetype: hunterArchetype,
    blueprint: withHunter({
      supplies: hunterSupplies.map((supply) =>
        supply.label === '사냥터' ? { ...supply, fills: [from('여름 식량')] } : supply,
      ),
    }),
  },
  {
    broke: '아무것도 채우지 않는 채움 — 무엇 때문에 있는지 말하지 못한다',
    expected: 'fillless-supply',
    archetype: hunterArchetype,
    blueprint: withHunter({
      supplies: hunterSupplies.map((supply) =>
        supply.label === '마비독 감별' ? { ...supply, fills: [] } : supply,
      ),
    }),
  },
  {
    broke: '같은 이름의 채움이 둘이다',
    expected: 'duplicate-supply',
    archetype: hunterArchetype,
    blueprint: withHunter({
      supplies: [...hunterSupplies, hunterSupplies[0] as SupplySpec],
    }),
  },
  {
    broke: '뿌리를 채우면서 급함·시한을 따로 적었다 — 종이 이미 말했다',
    expected: 'overridden-need-timing',
    archetype: hunterArchetype,
    blueprint: withHunter({
      supplies: hunterSupplies.map((supply) =>
        supply.label === '겨울 식량'
          ? { ...supply, urgency: 0.1, baseDelayTicks: 900 }
          : supply,
      ),
    }),
  },
  {
    broke: '뿌리 밖의 채움이 급함·시한을 적지 않았다',
    expected: 'bare-supply-timing',
    archetype: hunterArchetype,
    blueprint: withHunter({
      supplies: hunterSupplies.map((supply) =>
        supply.label === '사냥터' ? { ...supply, urgency: null, baseDelayTicks: null } : supply,
      ),
    }),
  },
  {
    broke: '뿌리의 종이 그 자리를 읽지 않는다 — 허기를 자원으로 세웠다',
    expected: 'broken-graph',
    archetype: hunterArchetype,
    blueprint: withHunter({
      roots: hunterRoots.map((entry) =>
        entry.slot.path === 'hunger'
          ? { ...entry, kind: 'resource' as const, targetsOwnState: false }
          : entry,
      ),
    }),
  },
  {
    broke: '채움이 맴돈다 — 사냥터가 다시 겨울 식량에 기댄다',
    expected: 'broken-graph',
    archetype: hunterArchetype,
    blueprint: withHunter({
      supplies: hunterSupplies.map((supply) =>
        supply.label === '겨울 식량'
          ? {
              ...supply,
              fills: [root({ domain: 'biological', path: 'hunger' }), from('사냥터')],
              urgency: 0.5,
              baseDelayTicks: 3,
            }
          : supply,
      ),
    }),
  },
];
