// S1-c 생애 — 단계는 O2 자리의 선택지이고, 대사가 붕괴 시한을 정한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  AGELESS,
  ages,
  capabilitiesAt,
  checkLifecycle,
  collapseTicksAt,
  growthStages,
  lifecycleSummary,
  lifespanTicks,
  MAX_LIFESPAN_TICKS,
  metabolismRange,
  stageAt,
  stageOf,
  type BodyPlan,
  type Lifecycle,
  type LifeStage,
  type SpeciesRef,
  type SpeciesViolation,
} from '../../src/s1/index.ts';

const hunter: SpeciesRef = {
  id: deterministicId('rule', 'species', '사냥꾼'),
  name: '사냥꾼',
  subjectKind: 'person',
};
const nation: SpeciesRef = {
  id: deterministicId('rule', 'species', '협곡을 낀 나라'),
  name: '협곡을 낀 나라',
  subjectKind: 'nation',
};

const body: BodyPlan = { organs: [{ organ: 'core', count: 1, note: '몸통' }] };

const trackId = deterministicId('rule', 'ability', '자국 읽기');
const inscribeId = deterministicId('rule', 'ability', '전언 새김');

/** 사냥꾼의 생애 — 유체는 빨리 태우고 덜 보고, 노체는 느려지고 더 못 본다. */
const hunterLife: Lifecycle = {
  stages: [
    { stage: '유체', ticks: 200, metabolism: 1.5, senseScale: 0.7, opens: [trackId] },
    { stage: '성체', ticks: 600, metabolism: 1, senseScale: 1, opens: [inscribeId] },
    { stage: '노체', ticks: 200, metabolism: 0.75, senseScale: 0.6, opens: [] },
  ],
};

function lifeRules(
  lifecycle: Lifecycle,
  plan: BodyPlan | null = body,
  species: SpeciesRef = hunter,
): string[] {
  const out: SpeciesViolation[] = [];
  checkLifecycle(species, lifecycle, plan, out);
  return out.map((violation) => violation.rule);
}

describe('S1-c 생애', () => {
  test('단계 이름은 O2 growthStage 의 선택지에서만 나온다', () => {
    assert.deepEqual(growthStages(), ['씨', '유체', '성체', '노체']);
    assert.deepEqual(metabolismRange(), { min: 0, max: 10 });
    assert.deepEqual(lifeRules(hunterLife), []);
  });

  test('몸이 있으면 늙고, 몸이 없으면 늙지 않는다', () => {
    assert.deepEqual(lifeRules(AGELESS, null, nation), []);
    assert.deepEqual(lifeRules(AGELESS), ['ageless-body']);
    assert.deepEqual(lifeRules(hunterLife, null, nation), ['aging-abstraction']);
    assert.equal(ages(hunterLife), true);
    assert.equal(ages(AGELESS), false);
  });

  test('대사가 붕괴 시한을 정한다 — 같은 허기라도 유체가 먼저 무너진다', () => {
    const larva = stageOf(hunterLife, '유체') as LifeStage;
    const adult = stageOf(hunterLife, '성체') as LifeStage;
    const elder = stageOf(hunterLife, '노체') as LifeStage;
    assert.equal(collapseTicksAt(30, adult), 30);
    assert.equal(collapseTicksAt(30, larva), 20);
    assert.equal(collapseTicksAt(30, elder), 40);
    // 늙지 않는 종은 기준 시한 그대로
    assert.equal(collapseTicksAt(120, null), 120);
    // 아무리 빨리 태워도 즉사보다 짧아지지는 않는다
    assert.equal(collapseTicksAt(1, { ...larva, metabolism: 10 }), 1);
  });

  test('생애는 시간 위에 놓인다 — 몇 틱을 살았는가로 단계가 나온다', () => {
    assert.equal(lifespanTicks(hunterLife), 1000);
    assert.equal(lifespanTicks(AGELESS), 0);
    assert.equal(stageAt(hunterLife, 0)?.stage, '유체');
    assert.equal(stageAt(hunterLife, 199)?.stage, '유체');
    assert.equal(stageAt(hunterLife, 200)?.stage, '성체');
    assert.equal(stageAt(hunterLife, 999)?.stage, '노체');
    assert.equal(stageAt(hunterLife, 1000), null); // 수명을 넘겼다
    assert.equal(stageAt(AGELESS, 0), null);
  });

  test('능력은 단계와 함께 열리고 누적된다 — 유체는 아직 전언을 새기지 못한다', () => {
    assert.deepEqual(capabilitiesAt(hunterLife, '유체'), [trackId]);
    assert.deepEqual(capabilitiesAt(hunterLife, '성체'), [trackId, inscribeId]);
    assert.deepEqual(capabilitiesAt(hunterLife, '노체'), [trackId, inscribeId]);
    assert.deepEqual(capabilitiesAt(AGELESS, null), []);
  });

  test('없는 단계 · 되돌아가는 생애 · 두 번 지나는 단계가 각각의 사유로 걸린다', () => {
    assert.deepEqual(
      lifeRules({ stages: [{ ...(hunterLife.stages[1] as LifeStage), stage: '번데기' }] }),
      ['unknown-stage'],
    );
    assert.deepEqual(
      lifeRules({
        stages: [hunterLife.stages[2] as LifeStage, hunterLife.stages[1] as LifeStage],
      }),
      ['unordered-stage'],
    );
    assert.deepEqual(
      lifeRules({
        stages: [hunterLife.stages[1] as LifeStage, hunterLife.stages[1] as LifeStage],
      }),
      ['duplicate-stage'],
    );
  });

  test('대사 0 · 감각 배수 0 · 지속 틱 0 · 끝없는 수명이 각각의 사유로 걸린다', () => {
    const adult = hunterLife.stages[1] as LifeStage;
    assert.deepEqual(lifeRules({ stages: [{ ...adult, metabolism: 0 }] }), ['bad-stage']);
    assert.deepEqual(lifeRules({ stages: [{ ...adult, metabolism: 11 }] }), ['bad-stage']);
    assert.deepEqual(lifeRules({ stages: [{ ...adult, senseScale: 0 }] }), ['bad-stage']);
    assert.deepEqual(lifeRules({ stages: [{ ...adult, ticks: 0 }] }), ['bad-stage']);
    assert.deepEqual(
      lifeRules({
        stages: [
          { ...adult, stage: '유체', ticks: MAX_LIFESPAN_TICKS },
          { ...adult, ticks: MAX_LIFESPAN_TICKS },
        ],
      }),
      ['unending-life'],
    );
  });

  test('생애를 한 줄로 접으면 수명이 함께 보인다', () => {
    assert.equal(lifecycleSummary(AGELESS), '늙지 않는다');
    assert.equal(
      lifecycleSummary(hunterLife),
      '유체 200틱 (대사 1.5) → 성체 600틱 (대사 1) → 노체 200틱 (대사 0.75) · 수명 1000틱',
    );
  });
});
