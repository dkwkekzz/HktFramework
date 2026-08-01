// O1-d 단위 테스트 — 요구 3종 (Dependency · Possibility · WorldRequirement).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  classify,
  DEPENDENCY_KINDS,
  isDependency,
  isPossibility,
  isWorldRequirement,
  provenanceGaps,
  REQUIREMENT_KINDS,
  REQUIREMENT_SCOPES,
  STRATEGY_DIRECTIONS,
  type Dependency,
  type Possibility,
  type WorldRequirement,
} from '../../src/o1/index.ts';

const hunterId = deterministicId('subject', 'person', '사냥꾼 04');

/** 사냥꾼은 식량 없이 못 산다. */
const foodNeed: Dependency = {
  kind: 'Dependency',
  id: deterministicId('dependency', hunterId, 'resource', 'food'),
  subjectId: hunterId,
  dependencyKind: 'resource',
  targetId: null, // 아무 식량이든 된다
  desiredCondition: 'biological.hunger 가 0.3 이하로 유지된다',
  strength: 0.9,
  urgency: 0.6,
  substitutability: 0.7,
};

/** 결핍을 다루는 길 — 둥지 근처의 약초를 채집한다. */
const forageWay: Possibility = {
  kind: 'Possibility',
  id: deterministicId('possibility', foodNeed.id, 'fulfill', 'forage'),
  subjectId: hunterId,
  forDependencyId: foodNeed.id,
  direction: 'fulfill',
  atoms: ['find', 'acquire'],
  preconditionIds: [],
};

/** 그 길이 성립하려면 세계가 갖춰야 하는 것. */
const accessPath: WorldRequirement = {
  kind: 'WorldRequirement',
  id: deterministicId('requirement', forageWay.id, 'space'),
  requirementKind: 'space',
  fromPossibilityId: forageWay.id,
  description: '둥지 반경까지 은폐한 채 접근할 수 있는 통로',
  scope: 'local',
  weight: 0.5,
};

function reasons(value: unknown): string[] {
  return classify(value).violations.map((violation) => `${violation.rule} ${violation.path}`);
}

describe('Dependency', () => {
  test('온전한 의존은 Dependency 로 분류된다', () => {
    assert.equal(classify(foodNeed).kind, 'Dependency');
    assert.ok(isDependency(foodNeed));
  });

  test('11종 모두 통과한다', () => {
    assert.equal(DEPENDENCY_KINDS.length, 11);
    for (const dependencyKind of DEPENDENCY_KINDS) {
      assert.equal(classify({ ...foodNeed, dependencyKind }).kind, 'Dependency', dependencyKind);
    }
  });

  test('종류로만 걸린 의존은 대상이 없다 — "아무 식량이든"', () => {
    assert.equal(foodNeed.targetId, null);
    const wellId = deterministicId('entity', 'place', '마을 우물');
    assert.equal(classify({ ...foodNeed, targetId: wellId }).kind, 'Dependency');
    assert.deepEqual(reasons({ ...foodNeed, targetId: '우물' }), ['bad-field $.targetId']);
  });

  test('강도 0 은 의존이 아니다 — 끊겨도 아무 일이 없다', () => {
    assert.deepEqual(reasons({ ...foodNeed, strength: 0 }), ['bad-field $.strength']);
  });

  test('세 수치는 모두 0~1 이다 — 압력 계산이 비교 가능해야 한다 (D4)', () => {
    assert.deepEqual(reasons({ ...foodNeed, urgency: 2 }), ['bad-field $.urgency']);
    assert.deepEqual(reasons({ ...foodNeed, substitutability: -0.1 }), [
      'bad-field $.substitutability',
    ]);
    assert.equal(classify({ ...foodNeed, substitutability: 0 }).kind, 'Dependency');
  });

  test('충족 조건을 적지 않으면 무엇이 결핍인지 판정할 수 없다', () => {
    assert.deepEqual(reasons({ ...foodNeed, desiredCondition: '' }), [
      'bad-field $.desiredCondition',
    ]);
  });
});

describe('Possibility', () => {
  test('온전한 가능성은 Possibility 로 분류된다', () => {
    assert.equal(classify(forageWay).kind, 'Possibility');
    assert.ok(isPossibility(forageWay));
  });

  test('대응 방향 7종 모두 통과한다', () => {
    assert.equal(STRATEGY_DIRECTIONS.length, 7);
    for (const direction of STRATEGY_DIRECTIONS) {
      assert.equal(classify({ ...forageWay, direction }).kind, 'Possibility', direction);
    }
  });

  test('결핍 없는 가능성은 없다 — 어느 의존 때문인지 비울 수 없다', () => {
    assert.deepEqual(reasons({ ...forageWay, forDependencyId: null }), [
      'bad-field $.forDependencyId',
    ]);
  });

  test('행동 원자가 없으면 가능성이 아니라 바람이다', () => {
    assert.deepEqual(reasons({ ...forageWay, atoms: [] }), ['bad-field $.atoms']);
  });

  test('선행 조건은 비어 있을 수 있다 — 지금 바로 되는 길도 있다', () => {
    assert.equal(classify(forageWay).kind, 'Possibility');
    assert.deepEqual(reasons({ ...forageWay, preconditionIds: ['통로'] }), [
      'bad-field $.preconditionIds[0]',
    ]);
  });
});

describe('WorldRequirement', () => {
  test('온전한 요구는 WorldRequirement 로 분류된다', () => {
    assert.equal(classify(accessPath).kind, 'WorldRequirement');
    assert.ok(isWorldRequirement(accessPath));
  });

  test('요구 8종 · 범위 4종 모두 통과한다', () => {
    assert.equal(REQUIREMENT_KINDS.length, 8);
    assert.equal(REQUIREMENT_SCOPES.length, 4);
    for (const requirementKind of REQUIREMENT_KINDS) {
      assert.equal(
        classify({ ...accessPath, requirementKind }).kind,
        'WorldRequirement',
        requirementKind,
      );
    }
    for (const scope of REQUIREMENT_SCOPES) {
      assert.equal(classify({ ...accessPath, scope }).kind, 'WorldRequirement', scope);
    }
  });

  test('근거 없는 요구는 세계를 만들 수 없다 — 청구한 가능성을 비울 수 없다', () => {
    assert.deepEqual(reasons({ ...accessPath, fromPossibilityId: null }), [
      'bad-field $.fromPossibilityId',
    ]);
  });

  test('범위를 어기면 거부된다 — 개인 요구로 대륙을 만들지 못하게 (Q2)', () => {
    assert.deepEqual(reasons({ ...accessPath, scope: 'continental' }), ['bad-field $.scope']);
    assert.deepEqual(reasons({ ...accessPath, weight: 1.5 }), ['bad-field $.weight']);
  });
});

describe('의존 → 가능성 → 요구 사슬', () => {
  test('셋이 id 로 이어져 요구의 근거를 되짚을 수 있다', () => {
    for (const node of [foodNeed, forageWay, accessPath] as const) {
      assert.equal(classify(node).kind, node.kind);
    }
    assert.deepEqual(provenanceGaps(accessPath, [forageWay], [foodNeed]), []);
  });

  test('가운데 고리가 없으면 끊긴 지점을 지목한다', () => {
    assert.deepEqual(provenanceGaps(accessPath, [], [foodNeed]), [forageWay.id]);
    assert.deepEqual(provenanceGaps(accessPath, [forageWay], []), [foodNeed.id]);
  });

  test('세계는 주체의 결핍에서 청구된다 — 반대 방향의 사슬은 없다', () => {
    // 요구는 가능성을, 가능성은 의존을 가리킨다. 의존은 아무것도 가리키지 않는다.
    assert.equal(accessPath.fromPossibilityId, forageWay.id);
    assert.equal(forageWay.forDependencyId, foodNeed.id);
    assert.equal(foodNeed.subjectId, hunterId);
  });
});
