// S0-a 경계와 그래프 자리 — 주체 5종이 각자의 방식으로 세계에 걸리는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  boundaryHolders,
  boundaryLabel,
  BOUNDARY_KINDS,
  BOUNDARY_REQUIREMENTS,
  BOUNDARY_SPECS,
  checkBoundaries,
  checkGraphIds,
  checkSubjectRef,
  requiredBoundaries,
  subjectGraphIds,
  subjectRef,
  SUBJECT_GRAPH_SPECS,
  violationVerdict,
  withinBoundary,
  type Boundary,
  type SubjectRef,
  type SubjectViolation,
} from '../../src/s0/index.ts';
import { SUBJECT_KINDS, type Subject } from '../../src/o1/index.ts';

const hunterId = deterministicId('subject', 'veil', 'hunter');
const bodyId = deterministicId('entity', 'veil', 'hunter-body');
const guildId = deterministicId('subject', 'veil', 'guild');
const nationId = deterministicId('subject', 'veil', 'nation');
const capitalId = deterministicId('entity', 'veil', 'capital');
const godId = deterministicId('subject', 'veil', 'mother-god');
const nestId = deterministicId('entity', 'veil', 'nest');

const hunter: SubjectRef = { id: hunterId, name: '붉은 장막 사냥꾼', subjectKind: 'person' };
const guild: SubjectRef = { id: guildId, name: '채집 길드', subjectKind: 'organization' };
const nation: SubjectRef = { id: nationId, name: '협곡 국가', subjectKind: 'nation' };
const god: SubjectRef = { id: godId, name: '둥지의 어미', subjectKind: 'god' };

const body: Boundary = { kind: 'body', ofId: bodyId, note: '사냥꾼의 몸 — 허기와 독이 여기 적힌다' };
const members: Boundary = { kind: 'membership', ofId: hunterId, note: '길드원 한 명' };
const territory: Boundary = { kind: 'territory', ofId: capitalId, note: '수도가 국가의 영역이다' };
const anchor: Boundary = { kind: 'anchor', ofId: nestId, note: '어미가 걸린 둥지' };

/** 검사 한 벌을 돌리고 사유만 뽑는다. */
function rulesOf(subject: SubjectRef, boundaries: readonly Boundary[]): string[] {
  const out: SubjectViolation[] = [];
  checkBoundaries(subject, boundaries, out);
  return out.map((violation) => violation.rule);
}

describe('경계 카탈로그', () => {
  test('경계 4종이 전부 선언되고 두 번 적히지 않는다', () => {
    assert.deepEqual(
      BOUNDARY_SPECS.map((spec) => spec.kind),
      [...BOUNDARY_KINDS],
    );
    for (const spec of BOUNDARY_SPECS) {
      assert.notEqual(spec.label, '', spec.kind);
      assert.notEqual(spec.holds, '', spec.kind);
    }
  });

  test('주체 5종이 전부 최소 경계와 그 근거를 갖는다', () => {
    assert.deepEqual(
      BOUNDARY_REQUIREMENTS.map((entry) => entry.subjectKind),
      [...SUBJECT_KINDS],
    );
    for (const entry of BOUNDARY_REQUIREMENTS) {
      assert.ok(entry.required.length > 0, `${entry.subjectKind} 에 요구 경계가 없다`);
      assert.notEqual(entry.reason, '', entry.subjectKind);
    }
  });

  test('국가만 경계 둘을 요구한다 — 영역과 구성원 둘 다여야 국가다', () => {
    assert.deepEqual([...requiredBoundaries('nation')], ['membership', 'territory']);
    assert.deepEqual([...requiredBoundaries('organization')], ['membership']);
    assert.deepEqual([...requiredBoundaries('god')], ['anchor']);
  });
});

describe('경계 검사', () => {
  test('주체 5종이 각자의 경계로 세계에 걸린다', () => {
    assert.deepEqual(rulesOf(hunter, [body]), []);
    assert.deepEqual(rulesOf({ ...hunter, subjectKind: 'creature' }, [body]), []);
    assert.deepEqual(rulesOf(guild, [members]), []);
    assert.deepEqual(rulesOf(nation, [members, territory]), []);
    assert.deepEqual(rulesOf(god, [anchor]), []);
  });

  test('요구 경계가 빠지면 무엇이 왜 필요한지와 함께 걸린다', () => {
    const out: SubjectViolation[] = [];
    checkBoundaries(nation, [members], out);
    assert.deepEqual(
      out.map((violation) => violation.rule),
      ['unbounded-subject'],
    );
    assert.equal(out[0]?.path, '$.boundaries');
    assert.ok(out[0]?.message.includes('영역'), out[0]?.message);
    assert.ok(out[0]?.message.includes('국가는 영역과 구성원'), out[0]?.message);
  });

  test('몸 없는 사람 · 앵커 없는 신 · 구성원 없는 조직은 서지 못한다', () => {
    assert.deepEqual(rulesOf(hunter, []), ['unbounded-subject']);
    assert.deepEqual(rulesOf(god, []), ['unbounded-subject']);
    assert.deepEqual(rulesOf(guild, [territory]), ['unbounded-subject']);
  });

  test('경계 대상의 존재 종류가 다르면 걸린다 — 구성원은 주체, 몸은 사물이다', () => {
    assert.deepEqual(rulesOf(guild, [{ ...members, ofId: capitalId }]), [
      'foreign-boundary',
      'unbounded-subject',
    ]);
    assert.deepEqual(rulesOf(hunter, [{ ...body, ofId: guildId }]), [
      'foreign-boundary',
      'unbounded-subject',
    ]);
  });

  test('근거 없는 경계 · 손으로 지은 대상 · 자기 참조는 각각의 사유로 걸린다', () => {
    // 결함 있는 경계는 경계로 세지 않는다 — 그래서 요구 경계도 함께 빈다.
    assert.deepEqual(rulesOf(hunter, [{ ...body, note: '' }]), [
      'bad-boundary',
      'unbounded-subject',
    ]);
    assert.deepEqual(rulesOf(hunter, [{ ...body, ofId: '사냥꾼의 몸' }]), [
      'bad-boundary',
      'unbounded-subject',
    ]);
    assert.deepEqual(rulesOf(guild, [{ ...members, ofId: guildId }]), [
      'bad-boundary',
      'unbounded-subject',
    ]);
    assert.deepEqual(rulesOf(hunter, [{ ...body, kind: 'flesh' as never }]), [
      'bad-boundary',
      'unbounded-subject',
    ]);
  });

  test('거부 사유는 고칠 자리를 그대로 가리킨다', () => {
    const out: SubjectViolation[] = [];
    checkBoundaries(hunter, [{ ...body, note: '' }], out);
    assert.equal(out[0]?.path, '$.boundaries[0].note');
    assert.equal(out[0]?.subjectName, '붉은 장막 사냥꾼');
    assert.ok(violationVerdict(out).includes('붉은 장막 사냥꾼'), violationVerdict(out));
    assert.equal(violationVerdict([]), '주체가 온전하다');
  });
});

describe('경계 안', () => {
  test('주체 자신은 언제나 자기 경계 안이다 — 관계·정보 상태가 거기 적힌다', () => {
    assert.equal(withinBoundary(hunter, [body], hunterId), true);
    assert.equal(withinBoundary(hunter, [], hunterId), true);
  });

  test('경계 밖의 보유자는 이 주체의 자리가 아니다', () => {
    assert.equal(withinBoundary(hunter, [body], bodyId), true);
    assert.equal(withinBoundary(hunter, [body], nestId), false);
  });

  test('보유자 목록은 자기가 먼저, 그 뒤는 선언 순서 — 중복은 한 번만', () => {
    assert.deepEqual(
      [...boundaryHolders(nation, [members, territory, { ...territory }])],
      [nationId, hunterId, capitalId],
    );
  });

  test('경계 한 줄에 한국어 이름이 실린다', () => {
    assert.equal(boundaryLabel(body), `신체=${bodyId}`);
  });
});

describe('그래프 자리', () => {
  test('그래프 4종이 전부 질문과 채울 모듈을 갖는다', () => {
    assert.equal(SUBJECT_GRAPH_SPECS.length, 4);
    for (const spec of SUBJECT_GRAPH_SPECS) {
      assert.notEqual(spec.question, '', spec.kind);
      assert.notEqual(spec.owner, '', spec.kind);
    }
  });

  test('같은 주체면 언제나 같은 네 ID — 리플레이가 성립한다', () => {
    assert.deepEqual(subjectGraphIds(hunterId), subjectGraphIds(hunterId));
    assert.notEqual(subjectGraphIds(hunterId).memoryStoreId, subjectGraphIds(guildId).memoryStoreId);
  });

  test('네 자리는 서로 다른 종류의 ID 다', () => {
    const ids = subjectGraphIds(hunterId);
    assert.deepEqual(
      SUBJECT_GRAPH_SPECS.map((spec) => ids[spec.field].split(':')[0]),
      ['memory', 'belief', 'dependency', 'possibility'],
    );
    assert.equal(new Set(Object.values(ids)).size, 4);
  });

  test('유래에서 나온 ID 는 통과한다', () => {
    const out: SubjectViolation[] = [];
    checkGraphIds(hunter, subjectGraphIds(hunterId), out);
    assert.deepEqual(out, []);
  });

  test('손으로 지은 그래프 ID 는 무엇이 와야 하는지와 함께 거부된다', () => {
    const out: SubjectViolation[] = [];
    checkGraphIds(hunter, { ...subjectGraphIds(hunterId), memoryStoreId: 'memory:사냥꾼기억' }, out);
    assert.deepEqual(
      out.map((violation) => violation.rule),
      ['manufactured-graph'],
    );
    assert.equal(out[0]?.path, '$.memoryStoreId');
    assert.ok(out[0]?.message.includes(subjectGraphIds(hunterId).memoryStoreId), out[0]?.message);
  });

  test('남의 그래프를 가리켜도 거부된다 — 형식이 맞아도 유래가 다르다', () => {
    const out: SubjectViolation[] = [];
    checkGraphIds(hunter, subjectGraphIds(guildId), out);
    assert.equal(out.length, 4);
  });
});

describe('주체 신원', () => {
  test('O1 Subject 가 그대로 S0 신원이 된다', () => {
    const o1Subject: Subject = {
      kind: 'Subject',
      id: hunterId,
      subjectKind: 'person',
      name: '붉은 장막 사냥꾼',
      partOfId: null,
    };
    assert.deepEqual(subjectRef(o1Subject), hunter);
  });

  test('손으로 지은 ID · 이름 없음 · 없는 종류는 각각의 사유로 걸린다', () => {
    const out: SubjectViolation[] = [];
    assert.equal(checkSubjectRef(hunter, out), true);
    assert.equal(checkSubjectRef({ ...hunter, id: '사냥꾼' }, out), false);
    assert.equal(checkSubjectRef({ ...hunter, name: '' }, out), false);
    assert.equal(checkSubjectRef({ ...hunter, subjectKind: 'ghost' as never }, out), false);
    assert.deepEqual(
      out.map((violation) => violation.path),
      ['$.id', '$.name', '$.subjectKind'],
    );
    assert.deepEqual(new Set(out.map((violation) => violation.rule)), new Set(['bad-subject']));
  });

  test('사물 ID 를 주체로 세울 수 없다', () => {
    const out: SubjectViolation[] = [];
    assert.equal(checkSubjectRef({ ...hunter, id: bodyId }, out), false);
  });
});
