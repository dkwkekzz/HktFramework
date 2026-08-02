// D3 단위 테스트가 함께 쓰는 최소 개체와 변형.
//
// 개체는 손으로 세운다 — D3 는 개체가 **어떻게 세워졌는지**를 묻지 않고 무엇을 가졌는지만 본다.
// (S3 조립을 실제로 지난 개체로 하는 검증은 시나리오 장면이 맡는다.)
import { deterministicId, type Id } from '../../src/v1/index.ts';
import type { AbilityDefinition, Definition } from '../../src/o0/index.ts';
import { axiomId } from '../../src/o0/index.ts';
import type { SubjectInstance } from '../../src/s3/index.ts';
import { buildSpeciesGraph, type SupplySpec } from '../../src/d2/index.ts';
import type { VariationSpec } from '../../src/d3/index.ts';

import { beast, beastBlueprint, berryId, denId } from '../d2/fixture.ts';

export { beast, beastBlueprint, berryId, denId };

export const bodyId: Id = deterministicId('entity', 'body', '굴짐승 01 의 몸');
export const packId: Id = deterministicId('subject', 'creature', '굴짐승 무리');
export const cultureId: Id = deterministicId('rule', 'culture', '굴을 나누는 무리');
export const roleId: Id = deterministicId('rule', 'role', '앞잡이');
export const traitId: Id = deterministicId('rule', 'trait', '겁이 많다');

/** 의념으로 배를 채우는 능력 — 대가는 의념이다. */
export const drawId: Id = deterministicId('rule', 'ability', '의념 흡수');
export const drawAbility: AbilityDefinition = {
  kind: 'Rule',
  id: drawId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '의념 흡수',
  when: ['굴 안에서 숨을 고른다'],
  then: ['의념이 먹은 것의 일부를 대신한다'],
  axiomId: axiomId('verifiable-cost'),
  supportIds: [],
  strength: 0.8,
  costs: [{ domain: 'psychic', path: 'energy', amount: 60 }],
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${drawId}` }],
};

/** 대가 없는 약한 능력 — 이것으로는 아무것도 갈아탈 수 없다. */
export const sniffId: Id = deterministicId('rule', 'ability', '냄새 읽기');
export const sniffAbility: AbilityDefinition = {
  ...drawAbility,
  id: sniffId,
  name: '냄새 읽기',
  strength: 0.2,
  axiomId: axiomId('observable-trace'),
  costs: [],
  traces: [{ channel: 'psychic', domain: 'psychic', path: `trace.${sniffId}` }],
};

export const DEFINITIONS: readonly Definition[] = [drawAbility, sniffAbility, beast];

/** 최소 개체 — D3 가 보는 것만 채운다. */
function instanceOf(patch: Partial<SubjectInstance> & { readonly label: string }): SubjectInstance {
  const id = deterministicId('subject', beast.id, patch.label);
  return {
    kind: 'Subject',
    id,
    subjectKind: 'creature',
    name: patch.label,
    partOfId: null,
    speciesId: beast.id,
    boundaries: [{ kind: 'body', ofId: bodyId, note: '이 몸까지가 나다' }],
    perception: { channels: [] },
    needs: [
      {
        slot: { domain: 'biological', path: 'hunger' },
        holderId: id,
        band: { kind: 'range', min: 0, max: 0.6 },
        urgency: 0.8,
        collapseAfterTicks: 30,
        note: '굶으면 무너진다',
      },
    ],
    values: [],
    capabilities: [],
    memoryStoreId: deterministicId('memory', id),
    beliefGraphId: deterministicId('belief', id),
    dependencyGraphId: deterministicId('dep-graph', id),
    possibilityGraphId: deterministicId('possibility', id),
    cultureId,
    roleId,
    bornAtTick: 100,
    readings: [],
    history: [],
    traits: [],
    residue: [],
    provenance: [],
    ...patch,
  };
}

/** 종이 물려준 그대로인 개체. */
export const plain: SubjectInstance = instanceOf({ label: '굴짐승 01' });

/** 겁이 많아 같은 허기를 더 급하게 느끼는 개체 — 성격은 S3 가 이미 흔들었다. */
export const timid: SubjectInstance = instanceOf({
  label: '굴짐승 02',
  needs: [
    {
      slot: { domain: 'biological', path: 'hunger' },
      holderId: deterministicId('subject', beast.id, '굴짐승 02'),
      band: { kind: 'range', min: 0, max: 0.6 },
      urgency: 1,
      collapseAfterTicks: 20,
      note: '겁이 많으면 배고픔을 더 빨리 위험으로 읽는다',
    },
  ],
  traits: [
    {
      kind: 'Rule',
      id: traitId,
      domain: 'psychic',
      name: '겁이 많다',
      when: ['혼자 굴 밖에 선다'],
      then: ['허기가 더 급해진다'],
      axiomId: axiomId('psychic-life'),
      tunes: [],
    },
  ],
});

/** 의념 흡수를 여는 개체. */
export const drawer: SubjectInstance = instanceOf({
  label: '굴짐승 03',
  capabilities: [drawId],
  history: [{ tick: 50, name: '굴이 무너진 겨울', actorId: null, causes: [], residue: [] }],
});

/** 기본 그래프 — 개체마다 자기 ID 로 선다. */
export function baseGraphOf(instance: SubjectInstance) {
  return buildSpeciesGraph(beast, beastBlueprint, {
    subjectId: instance.id,
    bodyId,
    stage: '성체',
  });
}

/** 의념의 샘 — 그 능력이 치르는 자리(psychic.energy)에 걸린다. */
export const springSupply: SupplySpec = {
  label: '의념의 샘',
  fills: [{ kind: 'root', slot: { domain: 'biological', path: 'hunger' } }],
  kind: 'rule',
  relation: 'requires',
  target: { ontology: 'Rule', id: drawId, name: '의념 흡수', entityKind: null, domain: null },
  condition: {
    kind: 'slot',
    slot: { domain: 'psychic', path: 'energy' },
    holder: { of: 'self' },
    band: { kind: 'range', min: 30, max: 1000000 },
  },
  strength: 0.6,
  substitutability: 0,
  urgency: null,
  baseDelayTicks: null,
  failureEffects: [
    {
      slot: { domain: 'biological', path: 'hunger' },
      holder: { of: 'self' },
      change: { kind: 'delta', by: 0.2 },
      note: '의념이 마르면 허기가 돌아온다',
    },
  ],
  note: '의념이 먹은 것의 절반을 대신한다',
};

/** 능력이 여는 전환 — 식량 의존을 줄이고 의념 의존을 세운다. */
export const drawConversion: VariationSpec = {
  id: 'draw-conversion',
  name: '의념으로 배를 채운다',
  origin: { kind: 'capability', abilityId: drawId },
  edits: [
    { kind: 'weaken', from: '주린 몸', to: '겨울 열매', relation: 'consumes', strength: 0.4 },
    { kind: 'add', supply: springSupply },
  ],
  note: '덜어 낸 만큼 의념에 매인다',
};
