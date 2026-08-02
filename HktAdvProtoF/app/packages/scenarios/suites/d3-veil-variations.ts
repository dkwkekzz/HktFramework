// D3 검증 장면 — 같은 종·같은 기본 그래프에서 넷이 갈라진다.
//
// S3 장면은 몰이꾼 셋과 사제 하나를 세웠다. 넷은 이력과 성격이 달랐지만 **의존은 똑같았다** —
// D2 가 물려준 종의 그래프 하나뿐이었다. 이 장면이 세우는 것은 그 갈림이다.
//
//   사냥꾼 04  겁이 많고 마을에 빚이 있다 → 허기가 더 급해지고(×1.4) 마을의 신뢰에 매인다
//   사냥꾼 11  욕심이 많다               → 같은 허기가 덜 급하다(×0.7)
//   사냥꾼 23  아무것도 지고 오지 않았다 → 종이 물려준 그대로 (자리의 것 하나만)
//   사냥꾼 31  사제 — 붉은 장막을 연다   → 식량 의존이 절반으로 줄고 의념 의존이 새로 선다
//
// 31 의 갈림이 원문 D3 의 조항이 걸리는 자리다. 그는 굶기를 그만둔 것이 아니다 — 허기를
// 의념으로 **갈아탔을 뿐**이고, 이제 의념이 마르면 허기가 그대로 돌아온다.

import { deterministicId, type Id } from '@hkt/core/v1';
import type { NodeTarget } from '@hkt/core/d1';
import type { SupplySpec } from '@hkt/core/d2';
import type { VariationSpec } from '@hkt/core/d3';

import {
  huntCulture,
  priestRole,
  beaterRole,
  riteCulture,
  partnerId,
  S3_DEFINITIONS,
  trackerInstance,
  greedyInstance,
  bareInstance,
  priestInstance,
  VEIL_INSTANCES,
} from './s3-veil-instances.ts';
import { toxinReadId, veilId, villagersId } from './s1-veil-species.ts';
import { hunterArchetype, hunterBlueprint } from './d2-veil-blueprints.ts';

export {
  hunterArchetype,
  hunterBlueprint,
  S3_DEFINITIONS,
  trackerInstance,
  greedyInstance,
  bareInstance,
  priestInstance,
  VEIL_INSTANCES,
  villagersId,
  veilId,
  toxinReadId,
};

const SELF = { of: 'self' } as const;
const at = (id: Id): { readonly of: 'other'; readonly id: Id } => ({ of: 'other', id });

const state = (holderId: Id, path: string, name: string): NodeTarget => ({
  ontology: 'State',
  id: deterministicId('state', holderId, path),
  name,
  entityKind: null,
  domain: path.split('.')[0] as NodeTarget['domain'],
});

/** 붉은 장막이 세우는 새 의존 — 이 능력이 치르는 대가(psychic.energy)의 자리에 걸린다. */
export const psychicSpring: SupplySpec = {
  label: '의념의 샘',
  fills: [{ kind: 'root', slot: { domain: 'biological', path: 'hunger' } }],
  kind: 'rule',
  relation: 'requires',
  target: { ontology: 'Rule', id: veilId, name: '붉은 장막', entityKind: null, domain: null },
  condition: {
    kind: 'slot',
    slot: { domain: 'psychic', path: 'energy' },
    holder: SELF,
    band: { kind: 'range', min: 40, max: 1000000 },
  },
  strength: 0.6,
  substitutability: 0,
  urgency: null,
  baseDelayTicks: null,
  failureEffects: [
    {
      slot: { domain: 'biological', path: 'hunger' },
      holder: SELF,
      change: { kind: 'delta', by: 0.25 },
      note: '의념이 마르면 허기가 그대로 돌아온다 — 갈아탄 것이지 벗어난 것이 아니다',
    },
  ],
  note: '안개에서 끌어올린 의념이 먹은 것의 절반을 대신한다 — 장막이 서 있는 동안만',
};

/** ① 능력 — 사제만 갖는다. 식량 의존이 절반으로 줄고 의념 의존이 새로 선다. */
export const veilConversion: VariationSpec = {
  id: 'veil-conversion',
  name: '장막으로 배를 채운다',
  origin: { kind: 'capability', abilityId: veilId },
  edits: [
    {
      kind: 'weaken',
      from: '주린 몸',
      to: '겨울 식량',
      relation: 'consumes',
      strength: 0.45,
    },
    { kind: 'add', supply: psychicSpring },
  ],
  note: '붉은 장막은 의념을 태워 허기를 대신한다 — 덜어 낸 만큼 의념에 매인다',
};

/** ② 이력 — 04 만 갖는다. 빚을 진 자는 마을의 신뢰에 매인다. */
export const debtBinding: VariationSpec = {
  id: 'debt-binding',
  name: '빚진 자의 겨울',
  origin: { kind: 'history', eventName: '겨울에 마을 창고를 열었다' },
  edits: [
    {
      kind: 'add',
      supply: {
        label: '마을의 참을성',
        fills: [{ kind: 'supply', label: '겨울 식량' }],
        kind: 'relationship',
        relation: 'produced_by',
        target: state(villagersId, 'relational.trust', '아랫마을이 04 에게 두는 신뢰'),
        condition: {
          kind: 'slot',
          slot: { domain: 'relational', path: `trust.${villagersId}` },
          holder: SELF,
          band: { kind: 'range', min: 0, max: 1 },
        },
        strength: 0.5,
        substitutability: 0,
        urgency: 0.5,
        baseDelayTicks: 8,
        failureEffects: [
          {
            slot: { domain: 'relational', path: `debt.${villagersId}` },
            holder: SELF,
            change: { kind: 'delta', by: 12 },
            note: '외상이 끊기면 남은 빚만 불어난다',
          },
        ],
        note: '창고를 연 겨울 이후로 이 사람의 식량 절반은 마을이 대준다',
      },
    },
  ],
  note: '지고 온 빚이 새 의존을 만든다 — 이력은 값을 남기고, 남은 값은 기댐이 된다',
};

/** ③ 자리 — 몰이꾼 셋이 갖는다. 몰이는 혼자 하지 않는다. */
export const beaterPair: VariationSpec = {
  id: 'beater-pair',
  name: '등을 맡길 짝',
  origin: { kind: 'role', roleId: beaterRole.id },
  edits: [
    {
      kind: 'add',
      supply: {
        label: '등을 맡길 짝',
        fills: [{ kind: 'supply', label: '사냥터' }],
        kind: 'subject',
        relation: 'protected_by',
        target: {
          ontology: 'Subject',
          id: partnerId,
          name: '사냥꾼 07',
          entityKind: null,
          domain: null,
        },
        condition: {
          kind: 'slot',
          slot: { domain: 'biological', path: 'vitality' },
          holder: at(partnerId),
          band: { kind: 'range', min: 0.2, max: 1 },
        },
        strength: 0.5,
        substitutability: 0,
        urgency: 0.4,
        baseDelayTicks: 5,
        failureEffects: [
          {
            slot: { domain: 'biological', path: 'vitality' },
            holder: SELF,
            change: { kind: 'delta', by: -0.15 },
            note: '혼자 협곡에 들면 몸이 상한 채로 돌아온다',
          },
        ],
        note: '장막이 걷힌 협곡 바닥에는 등을 맡길 사람이 있어야 든다',
      },
    },
  ],
  note: '자리가 붙인 기댐 — 몰이꾼은 짝 없이 협곡에 들지 않는다',
};

/** ④ 문화 — 어미를 섬기는 자들만. 사냥터가 제사로 떠받쳐진다. */
export const riteUpkeep: VariationSpec = {
  id: 'rite-upkeep',
  name: '어미께 올리는 제사',
  origin: { kind: 'culture', cultureId: riteCulture.id },
  edits: [
    {
      kind: 'add',
      supply: {
        label: '어미께 올리는 제사',
        fills: [{ kind: 'supply', label: '사냥터' }],
        kind: 'ritual',
        relation: 'sustained_by',
        target: null,
        condition: {
          kind: 'slot',
          slot: { domain: 'transcendent', path: 'worship' },
          holder: SELF,
          band: { kind: 'range', min: 1, max: 1000000000000 },
        },
        strength: 0.4,
        substitutability: 0.3,
        urgency: 0.3,
        baseDelayTicks: 20,
        failureEffects: [
          {
            slot: { domain: 'psychic', path: 'conviction' },
            holder: SELF,
            change: { kind: 'delta', by: -0.3 },
            note: '제사가 끊기면 협곡에 드는 믿음부터 식는다',
          },
        ],
        note: '어미를 섬기는 자에게 협곡은 사냥터이기 전에 제단이다',
      },
    },
  ],
  note: '문화가 붙인 기댐 — 같은 협곡을 다른 것으로 떠받친다',
};

/** 붉은 장막 세계에 선언된 변형 넷. 개체는 자기가 유래를 가진 것만 받는다. */
export const VEIL_VARIATIONS: readonly VariationSpec[] = [
  veilConversion,
  debtBinding,
  beaterPair,
  riteUpkeep,
];

export { huntCulture, riteCulture, beaterRole, priestRole, partnerId };

/** 설 수 없는 변형 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenVariation {
  readonly broke: string;
  readonly expected: string;
  readonly instance: typeof priestInstance;
  readonly variations: readonly VariationSpec[];
}

const spring = (patch: Partial<SupplySpec>): SupplySpec => ({ ...psychicSpring, ...patch });

/** 설 수 없는 변형 열 — 사유마다 하나씩. */
export const BROKEN_VARIATIONS: readonly BrokenVariation[] = [
  {
    broke: '식량 의존을 줄이면서 아무것도 세우지 않았다 — 공짜로 벗어났다',
    expected: 'free-conversion',
    instance: priestInstance,
    variations: [{ ...veilConversion, edits: [veilConversion.edits[0] as never] }],
  },
  {
    broke: '덜어 낸 0.5 보다 가벼운 0.2 를 세웠다',
    expected: 'light-conversion',
    instance: priestInstance,
    variations: [
      {
        ...veilConversion,
        edits: [
          veilConversion.edits[0] as never,
          { kind: 'add', supply: spring({ strength: 0.2 }) },
        ],
      },
    ],
  },
  {
    broke: '대가를 치르지 않는 능력(독 감별)이 의존을 덜어 냈다',
    expected: 'costless-conversion',
    instance: trackerInstance,
    variations: [
      {
        ...veilConversion,
        id: 'toxin-conversion',
        name: '독을 알면 덜 먹는다',
        origin: { kind: 'capability', abilityId: toxinReadId },
        edits: [
          veilConversion.edits[0] as never,
          { kind: 'add', supply: spring({ strength: 0.6 }) },
        ],
      },
    ],
  },
  {
    broke: '새 의존이 그 능력이 치르는 자리(의념)에 걸리지 않는다',
    expected: 'costless-conversion',
    instance: priestInstance,
    variations: [
      {
        ...veilConversion,
        edits: [
          veilConversion.edits[0] as never,
          {
            kind: 'add',
            supply: spring({
              label: '창고의 여분',
              kind: 'resource',
              target: {
                ontology: 'Entity',
                id: deterministicId('entity', 'material', '말린 고기'),
                name: '말린 고기',
                entityKind: 'material',
                domain: null,
              },
              relation: 'requires',
              condition: {
                kind: 'slot',
                slot: {
                  domain: 'economic',
                  path: `stock.${deterministicId('entity', 'material', '말린 고기')}`,
                },
                holder: SELF,
                band: { kind: 'range', min: 1, max: 1000000000 },
              },
              substitutability: 0.4,
            }),
          },
        ],
      },
    ],
  },
  {
    broke: '갖지 않은 능력을 유래로 든다 — 23 은 장막을 열지 못한다',
    expected: 'orphan-variation',
    instance: bareInstance,
    variations: [veilConversion],
  },
  {
    broke: '그래프에 없는 기댐을 약화한다',
    expected: 'phantom-edit',
    instance: priestInstance,
    variations: [
      {
        ...veilConversion,
        edits: [
          { kind: 'weaken', from: '주린 몸', to: '여름 식량', relation: 'consumes', strength: 0.4 },
        ],
      },
    ],
  },
  {
    broke: '약화인데 강도가 줄지 않는다',
    expected: 'bad-variation',
    instance: priestInstance,
    variations: [
      {
        ...veilConversion,
        edits: [
          { kind: 'weaken', from: '주린 몸', to: '겨울 식량', relation: 'consumes', strength: 0.99 },
          { kind: 'add', supply: psychicSpring },
        ],
      },
    ],
  },
  {
    broke: '아무것도 바꾸지 않는 변형',
    expected: 'bad-variation',
    instance: priestInstance,
    variations: [{ ...veilConversion, edits: [] }],
  },
  {
    broke: '식량을 끊고 다른 뿌리를 채웠다 — 무게는 맞지만 주린 몸이 빈다',
    expected: 'severed-need',
    instance: trackerInstance,
    variations: [
      {
        ...debtBinding,
        id: 'starving-swap',
        name: '굶으면서 몸만 챙긴다',
        edits: [
          { kind: 'drop', from: '주린 몸', to: '겨울 식량', relation: 'consumes' },
          {
            kind: 'add',
            supply: {
              ...psychicSpring,
              label: '두꺼운 외투',
              kind: 'resource',
              relation: 'requires',
              target: {
                ontology: 'Entity',
                id: deterministicId('entity', 'material', '두꺼운 외투'),
                name: '두꺼운 외투',
                entityKind: 'material',
                domain: null,
              },
              fills: [{ kind: 'root', slot: { domain: 'biological', path: 'vitality' } }],
              condition: {
                kind: 'slot',
                slot: {
                  domain: 'economic',
                  path: `stock.${deterministicId('entity', 'material', '두꺼운 외투')}`,
                },
                holder: SELF,
                band: { kind: 'range', min: 1, max: 1000000000 },
              },
              strength: 1,
              substitutability: 0.5,
            },
          },
        ],
      },
    ],
  },
  {
    broke: '새 채움이 그 종이 읽지 않는 자리를 조건으로 건다 — 관계를 의념으로 읽는다',
    expected: 'broken-graph',
    instance: trackerInstance,
    variations: [
      {
        ...debtBinding,
        edits: [
          {
            kind: 'add',
            supply: {
              ...((debtBinding.edits[0] as { readonly supply: SupplySpec }).supply),
              condition: {
                kind: 'slot',
                slot: { domain: 'psychic', path: 'energy' },
                holder: SELF,
                band: { kind: 'range', min: 10, max: 1000000 },
              },
            },
          },
        ],
      },
    ],
  },
];
