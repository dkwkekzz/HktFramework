// S1-d 기본 의존 — 종이 정하고, 개체가 태어날 때 누구의 자리인지가 채워진다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { axiomId, type SpeciesDefinition } from '../../src/o0/index.ts';
import { checkNeeds, MAX_COLLAPSE_TICKS, type SubjectViolation } from '../../src/s0/index.ts';
import {
  checkNeedTemplates,
  instantiateNeeds,
  needTemplateSummary,
  opensSlot,
  speciesRef,
  templateLabel,
  type BodyPlan,
  type LifeStage,
  type NeedTemplate,
  type SpeciesViolation,
} from '../../src/s1/index.ts';

const nestId = deterministicId('entity', 'veil', '둥지');
const hunterId = deterministicId('subject', 'veil', '사냥꾼 04');
const bodyId = deterministicId('entity', 'veil', '사냥꾼 04의 몸');

const hunterSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: deterministicId('rule', 'species', '사냥꾼'),
  definitionKind: 'species',
  domain: 'biological',
  name: '사냥꾼',
  when: ['세계에 사람이 선다'],
  then: ['허기와 체력을 진다'],
  axiomId: axiomId('psychic-life'),
  supportIds: [],
  subjectKind: 'person',
  alive: true,
  slots: [
    { domain: 'biological', path: 'hunger' },
    { domain: 'biological', path: 'vitality' },
    { domain: 'ecological', path: 'population' },
    { domain: 'psychic', path: 'conviction' },
  ],
  originId: null,
};

const guildSpecies: SpeciesDefinition = {
  ...hunterSpecies,
  id: deterministicId('rule', 'species', '채집 결사'),
  name: '채집 결사',
  subjectKind: 'organization',
  slots: [{ domain: 'ecological', path: 'population' }],
};

const body: BodyPlan = { organs: [{ organ: 'core', count: 1, note: '몸통' }] };

/** 굶주림 — 사냥꾼 자신에게 적히고, 성체 기준 서른 틱이면 무너진다. */
const hunger: NeedTemplate = {
  slot: { domain: 'biological', path: 'hunger' },
  holder: 'self',
  band: { kind: 'range', min: 0, max: 0.6 },
  urgency: 0.8,
  baseTicks: 30,
  note: '허기가 이 위로 오래 머물면 사냥할 힘이 남지 않는다',
};

/** 개체군 — 자기가 아니라 몸(둥지)에 적힌다. */
const population: NeedTemplate = {
  slot: { domain: 'ecological', path: 'population' },
  holder: 'body',
  band: { kind: 'range', min: 20, max: 1000000000 },
  urgency: 0.4,
  baseTicks: 200,
  note: '스무 마리 아래로 내려가면 군집의 의념이 끊긴다',
};

const larva: LifeStage = {
  stage: '유체',
  ticks: 200,
  metabolism: 1.5,
  senseScale: 0.7,
  opens: [],
};

function templateRules(
  templates: readonly NeedTemplate[],
  definition: SpeciesDefinition = hunterSpecies,
  plan: BodyPlan | null = body,
): string[] {
  const out: SpeciesViolation[] = [];
  checkNeedTemplates(speciesRef(definition), templates, definition, plan, out);
  return out.map((violation) => violation.rule);
}

describe('S1-d 기본 의존', () => {
  test('종이 연 자리에 걸린 의존은 그대로 선다', () => {
    assert.deepEqual(templateRules([hunger, population]), []);
    assert.equal(opensSlot(hunterSpecies, hunger.slot), true);
    assert.equal(opensSlot(guildSpecies, hunger.slot), false);
    assert.equal(templateLabel(hunger), 'biological.hunger');
  });

  test('개체가 태어나면 빈칸 둘이 채워진다 — 누구의 자리인가, 몇 틱 뒤인가', () => {
    const needs = instantiateNeeds([hunger, population], { subjectId: hunterId, bodyId });
    assert.equal(needs[0]?.holderId, hunterId); // self → 자기
    assert.equal(needs[1]?.holderId, bodyId); // body → 몸
    assert.equal(needs[0]?.collapseAfterTicks, 30); // 단계 없음 → 기준 그대로
    assert.equal(needs[0]?.note, hunger.note);

    // 유체는 대사가 1.5 라 스무 틱 만에 무너진다
    const young = instantiateNeeds([hunger], { subjectId: hunterId, bodyId }, larva);
    assert.equal(young[0]?.collapseAfterTicks, 20);

    // 몸이 없으면 몸의 자리도 자기에게 떨어진다 (몸 없는 종은 애초에 body 를 못 쓴다)
    const bodiless = instantiateNeeds([population], { subjectId: hunterId, bodyId: null });
    assert.equal(bodiless[0]?.holderId, hunterId);
  });

  test('찍어 낸 의존은 S0 검사를 그대로 지난다 — 종에서 나온 개체가 세계에 선다', () => {
    const needs = instantiateNeeds([hunger, population], { subjectId: hunterId, bodyId });
    const out: SubjectViolation[] = [];
    checkNeeds(
      { id: hunterId, name: '사냥꾼 04', subjectKind: 'person' },
      needs,
      [{ kind: 'body', ofId: bodyId, note: '사냥꾼의 몸' }],
      out,
    );
    assert.deepEqual(out, []);
  });

  test('종이 열지 않은 자리 · 세계에 없는 자리가 각각의 사유로 걸린다', () => {
    assert.deepEqual(templateRules([hunger], guildSpecies, null), ['off-species-slot']);
    assert.deepEqual(
      templateRules([{ ...hunger, slot: { domain: 'biological', path: 'mood' } }]),
      ['phantom-slot'],
    );
    assert.deepEqual(
      templateRules([{ ...hunger, slot: { domain: 'spiritual', path: 'hunger' } }]),
      ['phantom-slot'],
    );
  });

  test('몸 없는 종은 몸의 자리에 걸 수 없고, 주체의 자리를 몸에 적을 수 없다', () => {
    assert.deepEqual(templateRules([population], guildSpecies, null), ['bodiless-body-need']);
    // 허기는 주체의 상태다 — 몸(사물)에 적을 수 없다
    assert.deepEqual(templateRules([{ ...hunger, holder: 'body' }]), ['bad-template']);
  });

  test('벗어날 수 없는 범위 · 급함 · 기준 시한 · 근거 · 중복이 각각의 사유로 걸린다', () => {
    assert.deepEqual(
      templateRules([{ ...hunger, band: { kind: 'range', min: 0, max: 1 } }]),
      ['bad-band'],
    );
    assert.deepEqual(templateRules([{ ...hunger, urgency: 1.5 }]), ['bad-template']);
    assert.deepEqual(templateRules([{ ...hunger, baseTicks: 0 }]), ['bad-template']);
    assert.deepEqual(
      templateRules([{ ...hunger, baseTicks: MAX_COLLAPSE_TICKS + 1 }]),
      ['bad-template'],
    );
    assert.deepEqual(templateRules([{ ...hunger, note: '' }]), ['bad-template']);
    assert.deepEqual(templateRules([hunger, hunger]), ['duplicate-template']);
    assert.deepEqual(templateRules([]), ['needless-species']);
  });

  test('기본 의존을 한 줄로 접으면 어디에 적히는지가 보인다', () => {
    assert.equal(needTemplateSummary([]), '무너질 조건이 없다');
    assert.equal(
      needTemplateSummary([hunger, population]),
      'hunger (자기) 30틱 · population (몸) 200틱',
    );
  });
});
