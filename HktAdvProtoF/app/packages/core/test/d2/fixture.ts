// D2 단위 테스트가 함께 쓰는 최소 종 — 몸 있는 종 하나, 몸 없는 종 하나.
import { deterministicId, type Id } from '../../src/v1/index.ts';
import { axiomId, type SpeciesDefinition } from '../../src/o0/index.ts';
import {
  AGELESS,
  buildArchetype,
  type NeedTemplate,
  type SpeciesArchetype,
} from '../../src/s1/index.ts';
import type { RootSpec, SpeciesBlueprint, SupplySpec } from '../../src/d2/index.ts';

export const berryId: Id = deterministicId('entity', 'material', '겨울 열매');
export const denId: Id = deterministicId('entity', 'place', '겨울 굴');

const beastSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: deterministicId('rule', 'species', '굴짐승'),
  definitionKind: 'species',
  domain: 'biological',
  name: '굴짐승',
  when: ['골짜기에 굴을 파는 짐승이 산다'],
  then: ['열매를 먹고 굴에서 새끼를 친다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'creature',
  alive: true,
  slots: [
    { domain: 'biological', path: 'hunger' },
    { domain: 'biological', path: 'fertility' },
    { domain: 'psychic', path: 'conviction' },
  ],
  originId: null,
};

const guildSpecies: SpeciesDefinition = {
  ...beastSpecies,
  id: deterministicId('rule', 'species', '골짜기 결사'),
  name: '골짜기 결사',
  domain: 'economic',
  subjectKind: 'organization',
  slots: [
    { domain: 'economic', path: 'stock.{entity}' },
    { domain: 'psychic', path: 'conviction' },
  ],
};

export const hunger: NeedTemplate = {
  slot: { domain: 'biological', path: 'hunger' },
  holder: 'self',
  band: { kind: 'range', min: 0, max: 0.6 },
  urgency: 0.8,
  baseTicks: 30,
  note: '허기가 이 위로 서른 틱을 넘기면 무너진다',
};

export const fertility: NeedTemplate = {
  slot: { domain: 'biological', path: 'fertility' },
  holder: 'self',
  band: { kind: 'range', min: 0.2, max: 1 },
  urgency: 0.2,
  baseTicks: 400,
  note: '번식력이 마르면 대가 끊긴다',
};

/** 몸 있는 종 — 늙고, 그래서 대를 이어야 한다. */
export const beast: SpeciesArchetype = buildArchetype({
  definition: beastSpecies,
  body: { organs: [{ organ: 'core', count: 1, note: '몸통' }] },
  senses: [{ channel: 'smell', threshold: 0.2, range: 60, organ: null }],
  lifecycle: {
    stages: [
      { stage: '유체', ticks: 40, metabolism: 2, senseScale: 0.5, opens: [] },
      { stage: '성체', ticks: 200, metabolism: 1, senseScale: 1, opens: [] },
    ],
  },
  baseNeeds: [hunger],
  capabilities: [],
});

/** 몸 없는 종 — 늙지 않고, 그래서 낳지 않는다. */
export const guild: SpeciesArchetype = buildArchetype({
  definition: guildSpecies,
  body: null,
  senses: [{ channel: 'report', threshold: 0.4, range: 1000, organ: null }],
  lifecycle: AGELESS,
  baseNeeds: [
    {
      slot: { domain: 'economic', path: `stock.${berryId}` },
      holder: 'self',
      band: { kind: 'range', min: 10, max: 1000000000 },
      urgency: 0.5,
      baseTicks: 120,
      note: '창고가 비면 흩어진다',
    },
  ],
  capabilities: [],
});

export const hungerRoot: RootSpec = {
  slot: hunger.slot,
  kind: 'body',
  label: '주린 몸',
  targetsOwnState: true,
  note: '허기는 내 몸의 값이다',
};

export const fertilityRoot: RootSpec = {
  slot: fertility.slot,
  kind: 'body',
  label: '대 이을 몸',
  targetsOwnState: true,
  note: '번식력도 내 몸의 값이다',
};

export const berrySupply: SupplySpec = {
  label: '겨울 열매',
  fills: [{ kind: 'root', slot: hunger.slot }],
  kind: 'resource',
  relation: 'consumes',
  target: {
    ontology: 'Entity',
    id: berryId,
    name: '겨울 열매',
    entityKind: 'material',
    domain: null,
  },
  condition: {
    kind: 'slot',
    slot: { domain: 'economic', path: `stock.${berryId}` },
    holder: { of: 'self' },
    band: { kind: 'range', min: 2, max: 1000000000 },
  },
  strength: 0.9,
  substitutability: 0.6,
  urgency: null,
  baseDelayTicks: null,
  failureEffects: [
    {
      slot: { domain: 'biological', path: 'hunger' },
      holder: { of: 'self' },
      change: { kind: 'delta', by: 0.2 },
      note: '먹을 것이 끊기면 허기가 오른다',
    },
  ],
  note: '먹어서 없앤다',
};

export const denSupply: SupplySpec = {
  label: '겨울 굴',
  fills: [{ kind: 'root', slot: fertility.slot }],
  kind: 'space',
  relation: 'protected_by',
  target: { ontology: 'Entity', id: denId, name: '겨울 굴', entityKind: 'place', domain: null },
  condition: {
    kind: 'slot',
    slot: { domain: 'physical', path: 'region' },
    holder: { of: 'self' },
    band: { kind: 'is', value: denId },
  },
  strength: 0.7,
  substitutability: 0.2,
  urgency: null,
  baseDelayTicks: null,
  failureEffects: [
    {
      slot: { domain: 'biological', path: 'fertility' },
      holder: { of: 'self' },
      change: { kind: 'delta', by: -0.3 },
      note: '굴이 없으면 새끼를 치지 못한다',
    },
  ],
  note: '새끼는 굴에서만 자란다',
};

/** 굴짐승의 설계도 — 뿌리 둘, 채움 둘. */
export const beastBlueprint: SpeciesBlueprint = {
  speciesId: beast.id,
  roots: [hungerRoot, fertilityRoot],
  lineage: fertility,
  supplies: [berrySupply, denSupply],
};

/** 결사의 설계도 — 뿌리 하나, 채움 하나, 대 없음. */
export const guildBlueprint: SpeciesBlueprint = {
  speciesId: guild.id,
  roots: [
    {
      slot: { domain: 'economic', path: `stock.${berryId}` },
      kind: 'resource',
      label: '창고의 열매',
      targetsOwnState: false,
      note: '결사는 창고로 유지된다',
    },
  ],
  lineage: null,
  supplies: [
    {
      label: '열매 자생지',
      fills: [{ kind: 'root', slot: { domain: 'economic', path: `stock.${berryId}` } }],
      kind: 'space',
      relation: 'requires',
      target: {
        ontology: 'Entity',
        id: denId,
        name: '겨울 굴',
        entityKind: 'place',
        domain: null,
      },
      condition: {
        kind: 'slot',
        slot: { domain: 'physical', path: 'region' },
        holder: { of: 'self' },
        band: { kind: 'is', value: denId },
      },
      strength: 0.8,
      substitutability: 0.3,
      urgency: null,
      baseDelayTicks: null,
      failureEffects: [
        {
          slot: { domain: 'economic', path: `stock.${berryId}` },
          holder: { of: 'self' },
          change: { kind: 'delta', by: -5 },
          note: '캘 곳이 없으면 재고만 준다',
        },
      ],
      note: '열매는 골짜기 바닥에서만 자란다',
    },
  ],
};
