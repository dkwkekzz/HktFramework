// S3 검증 장면 — 붉은 장막 세계에 실제로 서는 개체 넷.
//
// S2 장면은 문화 셋을 세웠고, 같은 문화·같은 자리의 둘은 여전히 구별되지 않았다.
// 몰이꾼 A 와 몰이꾼 B 는 같은 것을 보고 같은 것을 원하고 같은 것을 할 수 있었다.
// 여기서 마지막 둘이 붙는다 — **지고 온 것**과 **타고난 기울기**.
//
// 같은 골짜기의 몰이꾼 셋:
//
//   사냥꾼 04  겨울에 마을 창고를 열었다 (빚 40이 지금 남아 있다) · 겁이 많다
//   사냥꾼 11  협곡에서 07 을 잃었다 (원한 0.6이 지금 남아 있다) · 욕심이 많다
//   사냥꾼 23  지고 온 것도 기울기도 없다 — 종과 문화가 준 것 그대로다
//
// 넷째는 다른 문화의 사제다 — 이력·성격이 문화를 가로질러 같은 방식으로 걸리는지 본다.
//
// 셋의 감각은 하나다. 무너질 자리도 하나다. 그런데 허기의 급함도, 빛에 대한 확신도,
// 마을을 향한 힘도 전부 다르다. 그리고 그 다름의 **하나하나가 유래를 댄다.**

import { deterministicId, type Id } from '@hkt/core/v1';
import { axiomId, type Definition } from '@hkt/core/o0';
import { subjectIdOf, type Boundary } from '@hkt/core/s0';
import {
  buildInstance,
  buildTrait,
  type InstanceSpec,
  type PastEvent,
  type SubjectInstance,
  type Trait,
} from '@hkt/core/s3';

import { hunterArchetype, hunterBodyId, villagersId } from './s1-veil-species.ts';
import { veilId } from './o0-veil-definitions.ts';
import {
  beaterRole,
  huntCulture,
  priestRole,
  riteCulture,
  S2_DEFINITIONS,
  VEIL_CULTURES,
} from './s2-veil-cultures.ts';

export { huntCulture, riteCulture, VEIL_CULTURES, beaterRole, priestRole };

/** S3 가 쓰는 정의 전부 — S2 가 쓰던 것 그대로. 개체는 정의를 더하지 않는다. */
export const S3_DEFINITIONS: readonly Definition[] = S2_DEFINITIONS;

/** 이 장면의 지금 — 개체는 이 시각에 세계에 선다. */
export const NOW = 400;

const label = (name: string): Id => subjectIdOf(hunterArchetype.id, name);

export const trackerId = label('사냥꾼 04');
export const greedyId = label('사냥꾼 11');
export const bareId = label('사냥꾼 23');
export const priestId = label('사냥꾼 31');

export const partnerId: Id = subjectIdOf(hunterArchetype.id, '사냥꾼 07');

/** 몸은 개체마다 다르다 — 경계가 겹치면 두 개체가 한 몸을 진다. */
const bodyOf = (name: string): Id => deterministicId('entity', 'body', name);
const boundary = (name: string): readonly Boundary[] => [
  { kind: 'body', ofId: bodyOf(name), note: '이 몸까지가 나다' },
];

// ── 지고 온 것 ────────────────────────────────────────────────────────────────

/** 04 — 겨울에 마을 창고를 열었다. 지금 남은 것은 빚이다. */
export const debtEvent: PastEvent = {
  tick: 120,
  name: '겨울에 마을 창고를 열었다',
  actorId: villagersId,
  causes: [],
  residue: [
    {
      slot: { domain: 'relational', path: `debt.${villagersId}` },
      holderId: trackerId,
      value: 40,
    },
  ],
};

/** 04 — 그 빚 때문에 겨울 사냥을 나갔고, 몸이 상했다. */
export const woundEvent: PastEvent = {
  tick: 180,
  name: '빚을 갚으러 겨울 사냥을 나갔다',
  actorId: trackerId,
  causes: ['겨울에 마을 창고를 열었다'],
  residue: [
    { slot: { domain: 'biological', path: 'vitality' }, holderId: trackerId, value: 0.7 },
  ],
};

/** 11 — 협곡에서 07 을 잃었다. 지금 남은 것은 원한이다. */
export const lossEvent: PastEvent = {
  tick: 260,
  name: '협곡에서 07 을 잃었다',
  actorId: null,
  causes: [],
  residue: [
    {
      slot: { domain: 'relational', path: `grudge.${partnerId}` },
      holderId: greedyId,
      value: 0.6,
    },
    {
      slot: { domain: 'relational', path: `trust.${villagersId}` },
      holderId: greedyId,
      value: -0.2,
    },
  ],
};

/** 31 — 이름을 받았다. 지금 남은 것은 신념이다. */
export const nameEvent: PastEvent = {
  tick: 300,
  name: '어미의 이름을 받았다',
  actorId: null,
  causes: [],
  residue: [
    { slot: { domain: 'psychic', path: 'conviction' }, holderId: priestId, value: 0.9 },
  ],
};

// ── 타고난 기울기 ─────────────────────────────────────────────────────────────

/** 겁이 많다 — 허기를 더 급하게 느끼고 빛을 덜 확신한다. */
export const timidTrait: Trait = buildTrait({
  id: deterministicId('rule', 'trait', '겁이 많다'),
  name: '겁이 많다',
  domain: 'psychic',
  when: ['혼자 어스름의 협곡에 선다'],
  then: ['허기는 더 급해지고, 빛에 대한 확신은 옅어진다'],
  axiomId: axiomId('psychic-life'),
  tunes: [
    {
      target: 'need-urgency',
      key: 'hunger',
      scale: 1.4,
      note: '겁이 많으면 배고픔을 더 빨리 위험으로 읽는다',
    },
    {
      target: 'reading-confidence',
      key: 'light:붉은 장막의 빛',
      scale: 0.6,
      note: '확신하지 못하고 한 번 더 본다',
    },
  ],
});

/** 욕심이 많다 — 마을을 향한 힘이 커지고 허기는 덜 급하다. */
export const greedyTrait: Trait = buildTrait({
  id: deterministicId('rule', 'trait', '욕심이 많다'),
  name: '욕심이 많다',
  domain: 'economic',
  when: ['남이 가진 것을 본다'],
  then: ['마을의 신뢰를 더 세게 밀고, 배고픔쯤은 뒤로 미룬다'],
  axiomId: axiomId('psychic-life'),
  tunes: [
    {
      target: 'value-weight',
      key: `trust.${villagersId}`,
      scale: 1.3,
      note: '얻는 쪽으로 더 세게 기운다',
    },
    {
      target: 'need-urgency',
      key: 'hunger',
      scale: 0.7,
      note: '얻을 것이 앞에 있으면 배고픔은 뒤로 밀린다',
    },
  ],
});

/** 확신에 차 있다 — 사제의 기울기. */
export const zealousTrait: Trait = buildTrait({
  id: deterministicId('rule', 'trait', '확신에 차 있다'),
  name: '확신에 차 있다',
  domain: 'transcendent',
  when: ['어미의 이름을 입에 담는다'],
  then: ['빛에 대한 확신이 끝까지 올라간다'],
  axiomId: axiomId('psychic-life'),
  tunes: [
    {
      target: 'reading-confidence',
      key: 'light:붉은 장막의 빛',
      scale: 2,
      note: '이름을 받은 자는 흔들리지 않는다',
    },
  ],
});

// ── 개체 넷 ──────────────────────────────────────────────────────────────────

function beaterSpec(
  name: string,
  history: readonly PastEvent[],
  traits: readonly Trait[],
): InstanceSpec {
  return {
    species: hunterArchetype,
    culture: huntCulture,
    role: beaterRole,
    label: name,
    name,
    partOfId: null,
    bodyId: bodyOf(name),
    stage: '성체',
    bornAtTick: NOW,
    boundaries: boundary(name),
    history,
    traits,
  };
}

export const INSTANCE_SPECS: readonly InstanceSpec[] = [
  beaterSpec('사냥꾼 04', [debtEvent, woundEvent], [timidTrait]),
  beaterSpec('사냥꾼 11', [lossEvent], [greedyTrait]),
  beaterSpec('사냥꾼 23', [], []),
  {
    species: hunterArchetype,
    culture: riteCulture,
    role: priestRole,
    label: '사냥꾼 31',
    name: '사냥꾼 31',
    partOfId: null,
    bodyId: bodyOf('사냥꾼 31'),
    stage: '성체',
    bornAtTick: NOW,
    boundaries: boundary('사냥꾼 31'),
    history: [nameEvent],
    traits: [zealousTrait],
  },
];

/** 붉은 장막 세계에 선 개체 넷 — 몰이꾼 셋 + 사제 하나. */
export const VEIL_INSTANCES: readonly SubjectInstance[] = INSTANCE_SPECS.map(buildInstance);

export const [trackerInstance, greedyInstance, bareInstance, priestInstance] =
  VEIL_INSTANCES as readonly [
    SubjectInstance,
    SubjectInstance,
    SubjectInstance,
    SubjectInstance,
  ];

/** 개체의 몸 — 장면 밖에서도 가리킬 수 있게 편다 (S1 장면의 몸과는 다른 몸이다). */
export { hunterBodyId };

/** 결함 개체 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenInstance {
  readonly broke: string;
  readonly expected: string;
  readonly value: SubjectInstance;
}

const firstResidue = debtEvent.residue[0];
const timidTune = timidTrait.tunes[0];

/** 결함 개체 13종 — 사유마다 하나씩. */
export const BROKEN_INSTANCES: readonly BrokenInstance[] = [
  {
    broke: '이름표가 없다 — 같은 종의 다른 개체와 구별되지 않는다',
    expected: 'unnamed-instance',
    value: { ...trackerInstance, name: '' },
  },
  {
    broke: '경계가 없다 — 사람은 몸으로 세계에 걸린다',
    expected: 'bad-instance',
    value: buildInstance({ ...beaterSpec('사냥꾼 04', [], []), boundaries: [] }),
  },
  {
    broke: '흔적 없는 과거 — 이야기로만 적힌 일',
    expected: 'traceless-past',
    value: buildInstance(
      beaterSpec('사냥꾼 04', [{ ...debtEvent, residue: [] }], []),
    ),
  },
  {
    broke: '아직 오지 않은 일을 지고 있다',
    expected: 'future-past',
    value: buildInstance(beaterSpec('사냥꾼 04', [{ ...debtEvent, tick: NOW + 50 }], [])),
  },
  {
    broke: '이력이 시간 순이 아니다',
    expected: 'unordered-history',
    value: buildInstance(
      beaterSpec(
        '사냥꾼 04',
        [{ ...woundEvent, causes: [] }, { ...debtEvent, causes: [] }],
        [],
      ),
    ),
  },
  {
    broke: '원인이 앞에 없다',
    expected: 'bad-past-event',
    value: buildInstance(
      beaterSpec('사냥꾼 04', [{ ...debtEvent, causes: ['없던 일'] }], []),
    ),
  },
  {
    broke: '세계에 없는 자리에 과거를 남긴다',
    expected: 'phantom-slot',
    value: buildInstance(
      beaterSpec(
        '사냥꾼 04',
        [
          {
            ...debtEvent,
            residue: [
              {
                ...(firstResidue as NonNullable<typeof firstResidue>),
                slot: { domain: 'relational', path: 'nostalgia.someone' },
              },
            ],
          },
        ],
        [],
      ),
    ),
  },
  {
    broke: '남긴 값이 그 자리의 값 모양과 다르다',
    expected: 'bad-residue',
    value: buildInstance(
      beaterSpec(
        '사냥꾼 04',
        [
          {
            ...debtEvent,
            residue: [
              { ...(firstResidue as NonNullable<typeof firstResidue>), value: -5 },
            ],
          },
        ],
        [],
      ),
    ),
  },
  {
    broke: '두 과거가 같은 자리에 다른 값을 남긴다',
    expected: 'duplicate-residue',
    value: buildInstance(
      beaterSpec(
        '사냥꾼 04',
        [
          debtEvent,
          {
            ...woundEvent,
            causes: [],
            residue: [
              { ...(firstResidue as NonNullable<typeof firstResidue>), value: 90 },
            ],
          },
        ],
        [],
      ),
    ),
  },
  {
    broke: '아무 값도 흔들지 않는 성격',
    expected: 'idle-trait',
    value: buildInstance(
      beaterSpec('사냥꾼 04', [], [buildTrait({ ...timidTrait, tunes: [] })]),
    ),
  },
  {
    broke: '이 개체에게 없는 자리를 흔든다 — 성격은 새 자리를 만들지 못한다',
    expected: 'phantom-tune',
    value: buildInstance(
      beaterSpec(
        '사냥꾼 04',
        [],
        [
          buildTrait({
            ...timidTrait,
            tunes: [
              {
                ...(timidTune as NonNullable<typeof timidTune>),
                key: 'wanderlust',
                note: '떠돌고 싶다',
              },
            ],
          }),
        ],
      ),
    ),
  },
  {
    broke: '두 성격이 같은 자리를 흔든다',
    expected: 'conflicting-trait',
    value: buildInstance(
      beaterSpec('사냥꾼 04', [], [
        timidTrait,
        buildTrait({
          ...greedyTrait,
          tunes: [
            {
              ...(timidTune as NonNullable<typeof timidTune>),
              scale: 0.7,
              note: '배고픔쯤은 견딘다',
            },
          ],
        }),
      ]),
    ),
  },
  {
    broke: '유래를 댈 수 없는 값 — 개체는 지어내지 않는다',
    expected: 'orphan-value',
    // 세계에 실재하고 공리도 지난 능력이다 — S0 는 통과시킨다. 막는 것은 유래가 없다는 사실뿐이다.
    value: { ...trackerInstance, capabilities: [...trackerInstance.capabilities, veilId] },
  },
];
