// O1-e 단위 테스트 — 개념 카탈로그와 커버리지 검사기.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import {
  checkCoverage,
  CONCEPT_CATALOG,
  coverageReport,
  coverageVerdict,
  implementedKinds,
  ONTOLOGY_KINDS,
  type ConceptEntry,
} from '../../src/o1/index.ts';

const ALL = implementedKinds();

/** 온전한 카탈로그 한 줄 — 시나리오마다 어긴 항목만 바꿔 넣는다. */
function entry(overrides: Partial<ConceptEntry> & { id: string }): ConceptEntry {
  return {
    concept: `${overrides.id} 개념`,
    source: 'MasterPlan §0',
    kinds: ['State'],
    note: '상태로 환원된다',
    ...overrides,
  };
}

describe('원문 개념 카탈로그', () => {
  test('원문의 모든 개념이 하나 이상의 타입으로 표현된다 — O1 의 검증 조항', () => {
    const report = coverageReport();
    assert.equal(report.total, CONCEPT_CATALOG.length);
    assert.deepEqual([...report.unmapped], []);
    assert.deepEqual([...report.unknownKinds], []);
    assert.deepEqual([...report.duplicateIds], []);
    assert.ok(report.complete, coverageVerdict(report));
  });

  test('12타입 모두 최소 1개 개념을 덮는다 — 남아도는 타입이 없다', () => {
    const report = coverageReport();
    assert.deepEqual([...report.unusedKinds], []);
    for (const kind of ONTOLOGY_KINDS) {
      assert.ok(report.byKind[kind].length > 0, `${kind} 를 쓰는 개념이 없다`);
    }
  });

  test('모든 개념이 원문 위치를 지목한다 — 되짚을 수 있어야 한다', () => {
    for (const item of CONCEPT_CATALOG) {
      assert.match(item.source, /§/, item.id);
      assert.notEqual(item.note, '');
      assert.match(item.id, /^[a-z][a-z0-9-]*$/);
    }
  });

  test('카탈로그는 직렬화 가능하고 결정적이다', () => {
    assert.equal(stateHash(CONCEPT_CATALOG), stateHash(CONCEPT_CATALOG.map((item) => ({ ...item }))));
    assert.equal(stateHash(coverageReport()), stateHash(coverageReport()));
  });
});

describe('커버리지 검사기', () => {
  test('타입 없는 개념은 미분류로 지목된다', () => {
    const report = checkCoverage(
      [...CONCEPT_CATALOG, entry({ id: 'unnameable', kinds: [] })],
      ALL,
    );
    assert.deepEqual([...report.unmapped], ['unnameable']);
    assert.ok(!report.complete);
    assert.match(coverageVerdict(report), /미분류 개념 unnameable/);
    assert.equal(report.covered, report.total - 1);
  });

  test('12타입 밖의 이름은 개념과 함께 지목된다', () => {
    const report = checkCoverage(
      [entry({ id: 'ghost', kinds: ['Spirit' as 'State'] })],
      ALL,
    );
    assert.deepEqual([...report.unknownKinds], ['ghost:Spirit']);
    assert.deepEqual([...report.unmapped], ['ghost']); // 남은 타입이 없으니 미분류이기도 하다
    assert.ok(!report.complete);
  });

  test('아무 개념도 쓰지 않는 타입은 과잉으로 지목된다', () => {
    const report = checkCoverage([entry({ id: 'only-state' })], ALL);
    assert.equal(report.unusedKinds.length, 11);
    assert.ok(!report.unusedKinds.includes('State'));
    assert.match(coverageVerdict(report), /쓰이지 않는 타입/);
  });

  test('필드 없는 타입이 있으면 완결이 아니다', () => {
    const partial = checkCoverage(CONCEPT_CATALOG, ['Subject']);
    assert.equal(partial.notImplementedKinds.length, 11);
    assert.ok(!partial.complete);
    assert.match(coverageVerdict(partial), /필드 없는 타입/);
  });

  test('같은 id 를 두 번 등록하면 중복으로 걸린다', () => {
    const report = checkCoverage([entry({ id: 'twice' }), entry({ id: 'twice' })], ALL);
    assert.deepEqual([...report.duplicateIds], ['twice']);
    assert.ok(!report.complete);
  });

  test('빈 카탈로그는 완결이 아니다 — 아무것도 확인하지 않은 것이다', () => {
    const report = checkCoverage([], ALL);
    assert.equal(report.total, 0);
    assert.equal(report.unusedKinds.length, 12);
    assert.ok(!report.complete);
    assert.match(coverageVerdict(report), /카탈로그가 비었다/);
  });

  test('타입별 개념 목록은 등록 순서와 무관하게 같다', () => {
    const forward = checkCoverage(CONCEPT_CATALOG, ALL);
    const backward = checkCoverage([...CONCEPT_CATALOG].reverse(), ALL);
    assert.deepEqual(forward.byKind, backward.byKind);
  });

  test('한 개념이 여러 타입을 덮으면 모든 타입에 실린다', () => {
    const report = checkCoverage([entry({ id: 'fact', kinds: ['Entity', 'State', 'Claim'] })], ALL);
    assert.deepEqual([...report.byKind.Entity], ['fact']);
    assert.deepEqual([...report.byKind.State], ['fact']);
    assert.deepEqual([...report.byKind.Claim], ['fact']);
    assert.equal(report.covered, 1);
  });
});
