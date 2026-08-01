// O1-a 단위 테스트 — 존재론 골격과 존재 3종.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, stateHash } from '../../src/v1/index.ts';
import {
  classify,
  countByKind,
  ENTITY_KINDS,
  implementedKinds,
  isEntity,
  isOntic,
  isState,
  isSubject,
  kindOf,
  ONTOLOGY_KINDS,
  STATE_DOMAINS,
  SUBJECT_KINDS,
  assertOntic,
  type Entity,
  type State,
  type Subject,
} from '../../src/o1/index.ts';

const hunterId = deterministicId('subject', 'person', '사냥꾼 04');
const nestId = deterministicId('entity', 'place', '붉은 장막 둥지');

const hunter: Subject = {
  kind: 'Subject',
  id: hunterId,
  subjectKind: 'person',
  name: '사냥꾼 04',
  partOfId: null,
};

const herb: Entity = {
  kind: 'Entity',
  id: deterministicId('entity', 'material', '붉은 장막'),
  entityKind: 'material',
  name: '붉은 장막',
  locationId: nestId,
};

const hunger: State = {
  kind: 'State',
  id: deterministicId('state', hunterId, 'biological.hunger'),
  domain: 'biological',
  ofId: hunterId,
  path: 'hunger',
  value: 0.7,
};

/** 위반 사유만 뽑는다 — 무엇이 왜 걸렸는지 한눈에 단언하려고. */
function reasons(value: unknown): string[] {
  return classify(value).violations.map((violation) => `${violation.rule} ${violation.path}`);
}

describe('존재론 골격', () => {
  test('이름표는 원문 순서 12종이다', () => {
    assert.equal(ONTOLOGY_KINDS.length, 12);
    assert.equal(ONTOLOGY_KINDS[0], 'Subject');
    assert.equal(ONTOLOGY_KINDS[11], 'WorldRequirement');
    assert.equal(new Set(ONTOLOGY_KINDS).size, 12);
  });

  test('아직 필드가 없는 이름표는 미구현으로 드러난다', () => {
    const implemented = implementedKinds();
    assert.deepEqual([...implemented], ['Subject', 'Entity', 'State', 'Rule', 'Phenomenon', 'Event']);
    assert.deepEqual(reasons({ kind: 'Claim', id: deterministicId('claim', 'x') }), [
      'kind-not-implemented $.kind',
    ]);
  });

  test('존재론 원소는 직렬화 가능해야 한다', () => {
    assert.deepEqual(reasons({ kind: 'Subject', id: hunterId, run: (): number => 1 }), [
      'not-serializable $',
    ]);
    const cyclic: Record<string, unknown> = { kind: 'Subject', id: hunterId };
    cyclic['self'] = cyclic;
    assert.deepEqual(reasons(cyclic), ['not-serializable $']);
  });

  test('레코드가 아니거나 kind 가 없으면 그 사실을 돌려준다', () => {
    assert.deepEqual(reasons('사냥꾼'), ['not-a-record $']);
    assert.deepEqual(reasons([hunter]), ['not-a-record $']);
    assert.deepEqual(reasons(null), ['not-a-record $']);
    assert.deepEqual(reasons({ id: hunterId }), ['unknown-kind $.kind']);
    assert.deepEqual(reasons({ kind: 'Monster', id: hunterId }), ['unknown-kind $.kind']);
  });

  test('classify 는 던지지 않는다 — 결함 값도 사유와 함께 돌아온다', () => {
    assert.doesNotThrow(() => classify(undefined));
    assert.equal(classify(undefined).kind, null);
    assert.throws(() => assertOntic({ kind: 'Subject', id: 'hunter' }), /존재론 원소가 아니다/);
    assert.equal(assertOntic(hunter), hunter);
  });

  test('kindOf 와 countByKind 는 검사 없이 분류만 센다', () => {
    assert.equal(kindOf({ kind: 'Rule' }), 'Rule');
    assert.equal(kindOf({ kind: 'Monster' }), null);
    assert.equal(kindOf(3), null);
    const counts = countByKind([hunter, herb, hunger, { kind: 'Rule' }, '잡음']);
    assert.equal(counts.Subject, 1);
    assert.equal(counts.State, 1);
    assert.equal(counts.Rule, 1);
    assert.equal(counts.Commitment, 0);
  });
});

describe('Subject', () => {
  test('온전한 주체는 Subject 로 분류된다', () => {
    assert.equal(classify(hunter).kind, 'Subject');
    assert.ok(isOntic(hunter));
    assert.ok(isSubject(hunter));
    assert.ok(!isEntity(hunter));
  });

  test('다섯 종류 모두 통과한다 — 사람도 신도 같은 인터페이스다', () => {
    for (const subjectKind of SUBJECT_KINDS) {
      const subject = { ...hunter, subjectKind };
      assert.equal(classify(subject).kind, 'Subject', subjectKind);
    }
  });

  test('종류·이름·소속을 어기면 경로와 함께 거부된다', () => {
    assert.deepEqual(reasons({ ...hunter, subjectKind: 'monster' }), ['bad-field $.subjectKind']);
    assert.deepEqual(reasons({ ...hunter, name: '' }), ['bad-field $.name']);
    assert.deepEqual(reasons({ ...hunter, partOfId: '길드' }), ['bad-field $.partOfId']);
    assert.deepEqual(reasons({ kind: 'Subject', id: hunterId }), [
      'missing-field $.subjectKind',
      'missing-field $.name',
      'missing-field $.partOfId',
    ]);
  });

  test('식별자는 유래에서 나온다 — 손으로 지은 이름은 거부된다', () => {
    assert.deepEqual(reasons({ ...hunter, id: 'hunter_04' }), ['bad-field $.id']);
    assert.equal(deterministicId('subject', 'person', '사냥꾼 04'), hunterId);
  });

  test('상위 주체를 적으면 조직·국가로 이어진다', () => {
    const guildId = deterministicId('subject', 'organization', '수렵 길드');
    assert.equal(classify({ ...hunter, partOfId: guildId }).kind, 'Subject');
  });

  test('나중 계층이 필드를 더해도 여전히 Subject 다', () => {
    // S0 이 기억·믿음 그래프 id 를 더한다 — 확장은 막지 않는다.
    assert.equal(classify({ ...hunter, memoryStoreId: 'memory:abc' }).kind, 'Subject');
  });
});

describe('Entity', () => {
  test('온전한 사물은 Entity 로 분류된다', () => {
    assert.equal(classify(herb).kind, 'Entity');
    assert.ok(isEntity(herb));
  });

  test('여섯 종류 모두 통과한다', () => {
    for (const entityKind of ENTITY_KINDS) {
      assert.equal(classify({ ...herb, entityKind }).kind, 'Entity', entityKind);
    }
  });

  test('장소는 자기 위치를 비울 수 있다', () => {
    const place = { ...herb, id: nestId, entityKind: 'place', name: '붉은 장막 둥지', locationId: null };
    assert.equal(classify(place).kind, 'Entity');
  });

  test('종류를 어기거나 위치가 ID 가 아니면 거부된다', () => {
    assert.deepEqual(reasons({ ...herb, entityKind: 'creature' }), ['bad-field $.entityKind']);
    assert.deepEqual(reasons({ ...herb, locationId: '둥지' }), ['bad-field $.locationId']);
  });
});

describe('State', () => {
  test('온전한 상태는 State 로 분류된다', () => {
    assert.equal(classify(hunger).kind, 'State');
    assert.ok(isState(hunger));
  });

  test('9영역 모두 통과한다', () => {
    assert.equal(STATE_DOMAINS.length, 9);
    for (const domain of STATE_DOMAINS) {
      assert.equal(classify({ ...hunger, domain }).kind, 'State', domain);
    }
  });

  test('값은 수·문자열·참거짓만 — 구조는 State 여러 개로 쪼갠다', () => {
    assert.equal(classify({ ...hunger, value: '독성' }).kind, 'State');
    assert.equal(classify({ ...hunger, value: true }).kind, 'State');
    assert.deepEqual(reasons({ ...hunger, value: { level: 3 } }), ['bad-field $.value']);
    assert.deepEqual(reasons({ ...hunger, value: [1, 2] }), ['bad-field $.value']);
    assert.deepEqual(reasons({ ...hunger, value: undefined }), ['missing-field $.value']);
  });

  test('무한수는 상태 값이 될 수 없다 — 해시가 성립하지 않는다', () => {
    // canonicalize 가 먼저 걸러 낸다 (상태 원소 규칙).
    assert.deepEqual(reasons({ ...hunger, value: Infinity }), ['not-serializable $']);
    assert.deepEqual(reasons({ ...hunger, value: NaN }), ['not-serializable $']);
  });

  test('영역·대상·경로를 어기면 경로와 함께 거부된다', () => {
    assert.deepEqual(reasons({ ...hunger, domain: 'magical' }), ['bad-field $.domain']);
    assert.deepEqual(reasons({ ...hunger, ofId: '사냥꾼' }), ['bad-field $.ofId']);
    assert.deepEqual(reasons({ ...hunger, path: '' }), ['bad-field $.path']);
  });

  test('같은 상태면 같은 해시다 — 존재론 원소는 그대로 V1 위에 얹힌다', () => {
    assert.equal(stateHash(hunger), stateHash({ ...hunger }));
    assert.notEqual(stateHash(hunger), stateHash({ ...hunger, value: 0.8 }));
  });
});
