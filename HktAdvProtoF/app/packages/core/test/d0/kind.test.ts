// D0-a 단위 테스트 — 원문 두 목록의 의존 대상 대조.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DEPENDENCY_KINDS } from '../../src/o1/index.ts';
import {
  D0_ONLY_KINDS,
  DEPENDENCY_KIND_SPECS,
  isDependencyKind,
  KIND_RECONCILIATION,
  kindLabel,
  kindReconciliationVerdict,
  kindSpec,
  kindViolationVerdict,
  NODE_KIND_NAMES,
  reconcileKinds,
  type DependencyKindSpec,
  type KindResolution,
} from '../../src/d0/index.ts';

describe('확정 11종', () => {
  test('O1 이 이름표로 고정한 11종에 정의가 하나씩 붙는다', () => {
    assert.equal(DEPENDENCY_KIND_SPECS.length, 11);
    assert.deepEqual(
      DEPENDENCY_KIND_SPECS.map((spec) => spec.kind),
      [...DEPENDENCY_KINDS],
    );
  });

  test('모든 종이 이름·담는 것·예·원문 근거를 갖는다', () => {
    for (const spec of DEPENDENCY_KIND_SPECS) {
      assert.notEqual(spec.label, '', spec.kind);
      assert.notEqual(spec.originalName, '', spec.kind);
      assert.notEqual(spec.holds, '', spec.kind);
      assert.notEqual(spec.example, '', spec.kind);
      assert.match(spec.source, /ModulePlan/, spec.kind);
    }
  });

  test('종 정의를 이름으로 찾고, 없는 이름은 null 이다', () => {
    assert.equal(kindSpec('ritual')?.label, '의례');
    assert.equal(kindSpec('nowhere' as never), null);
    assert.equal(kindLabel('time'), '시간');
    assert.equal(kindLabel('nowhere' as never), 'nowhere');
  });

  test('11종만 종으로 인정한다', () => {
    assert.equal(isDependencyKind('resource'), true);
    assert.equal(isDependencyKind('state'), false); // D1 이 쓴 이름은 갈라졌다
    assert.equal(isDependencyKind(3), false);
  });
});

describe('원문 두 목록 대조', () => {
  const report = reconcileKinds();

  test('D1 이 적은 노드 종류 9개가 하나도 빠짐없이 해소된다', () => {
    assert.equal(NODE_KIND_NAMES.length, 9);
    assert.deepEqual(report.unresolved, []);
    assert.deepEqual(report.danglingTargets, []);
    assert.equal(report.violations.length, 0);
    assert.equal(report.complete, true);
  });

  test('state 하나가 환경·신체 둘로 갈린다 — 채우는 방법이 다르기 때문이다', () => {
    const split = KIND_RECONCILIATION.find((entry) => entry.original === 'state');
    assert.equal(split?.resolution, 'split');
    assert.deepEqual(split?.kinds, ['environment', 'body']);
    assert.match(split?.reason ?? '', /누구의 상태/);
  });

  test('갈림은 하나뿐이고 나머지 여덟은 같은 이름 같은 뜻이다', () => {
    const splits = KIND_RECONCILIATION.filter((entry) => entry.resolution === 'split');
    assert.equal(splits.length, 1);
    assert.equal(KIND_RECONCILIATION.length, 9);
  });

  test('시간은 D0 목록에만 있고, 그 사실이 값으로 남는다', () => {
    assert.deepEqual(report.d0Only, [...D0_ONLY_KINDS]);
    assert.deepEqual(report.d0Only, ['time']);
    assert.equal(kindSpec('time')?.nodeKind, null);
    assert.match(kindSpec('time')?.source ?? '', /D1 노드 종류 목록에는 없다/);
  });

  test('두 목록이 겹치는 이름은 사전 순으로 안정하게 나온다', () => {
    assert.deepEqual(report.sharedNames, [
      'information',
      'institution',
      'relationship',
      'resource',
      'ritual',
      'rule',
      'space',
      'subject',
    ]);
  });

  test('판정 한 줄이 해소 결과를 말한다', () => {
    assert.match(kindReconciliationVerdict(report), /11종으로 해소/);
    assert.match(kindReconciliationVerdict(report), /갈림 1/);
  });

  test('대조는 결정적이다 — 같은 입력이면 같은 보고', () => {
    assert.deepEqual(reconcileKinds(), reconcileKinds());
  });
});

describe('설 수 없는 분류는 사유와 함께 거부된다', () => {
  const specs = [...DEPENDENCY_KIND_SPECS];

  test('원문 이름을 해소하지 않으면 그 이름을 지목한다', () => {
    const report = reconcileKinds(
      specs,
      NODE_KIND_NAMES,
      KIND_RECONCILIATION.filter((entry) => entry.original !== 'ritual'),
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.unresolved, ['ritual']);
    assert.equal(report.violations[0]?.rule, 'unresolved-original');
    assert.match(kindReconciliationVerdict(report), /해소되지 않은 원문 이름 ritual/);
  });

  test('없는 종으로 보내면 어느 이름이 어디로 갔는지 나온다', () => {
    const broken: KindResolution = {
      original: 'rule',
      resolution: 'same',
      kinds: ['law' as never],
      reason: '',
    };
    const report = reconcileKinds(
      specs,
      NODE_KIND_NAMES,
      KIND_RECONCILIATION.map((entry) => (entry.original === 'rule' ? broken : entry)),
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.danglingTargets, ['rule→law']);
    assert.equal(report.violations[0]?.rule, 'dangling-resolution');
  });

  test('아무 종으로도 보내지 않은 해소는 삭제로 걸린다', () => {
    const erased: KindResolution = {
      original: 'space',
      resolution: 'same',
      kinds: [],
      reason: '',
    };
    const report = reconcileKinds(
      specs,
      NODE_KIND_NAMES,
      KIND_RECONCILIATION.map((entry) => (entry.original === 'space' ? erased : entry)),
    );
    assert.deepEqual(report.danglingTargets, ['space→(없음)']);
    assert.match(report.violations[0]?.message ?? '', /해소가 아니라 삭제/);
  });

  test('이름표만 있고 정의가 없는 종은 이름과 함께 걸린다', () => {
    const report = reconcileKinds(specs.filter((spec) => spec.kind !== 'time'));
    assert.equal(report.complete, false);
    assert.deepEqual(report.undefinedKinds, ['time']);
    assert.equal(report.violations[0]?.rule, 'undefined-kind');
    assert.match(kindReconciliationVerdict(report), /이름만 있는 종 time/);
  });

  test('같은 종을 두 번 적으면 걸린다', () => {
    const twice = [...specs, specs[0] as DependencyKindSpec];
    const report = reconcileKinds(twice);
    assert.deepEqual(report.duplicateKinds, ['resource']);
    assert.equal(report.violations[0]?.rule, 'duplicate-kind');
  });

  test('근거·담는 것·예를 대지 못하는 종은 지어낸 것으로 거부된다', () => {
    const madeUp: DependencyKindSpec = {
      kind: 'ritual',
      label: '의례',
      originalName: '의례 의존',
      nodeKind: 'ritual',
      holds: '',
      example: '',
      source: '',
    };
    const report = reconcileKinds(
      specs.map((spec) => (spec.kind === 'ritual' ? madeUp : spec)),
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.unsourced, ['ritual']);
    assert.equal(report.violations[0]?.rule, 'unsourced-kind');
    assert.match(report.violations[0]?.message ?? '', /source·holds·example/);
  });

  test('원문 D1 목록에 없는 이름을 근거로 들면 걸린다', () => {
    const wrong: DependencyKindSpec = {
      ...(specs[0] as DependencyKindSpec),
      nodeKind: 'supply',
    };
    const report = reconcileKinds(specs.map((spec, index) => (index === 0 ? wrong : spec)));
    assert.equal(report.complete, false);
    assert.deepEqual(report.phantomNodeKinds, ['resource→supply']);
    assert.match(kindReconciliationVerdict(report), /원문에 없는 이름/);
  });

  test('빈 분류는 종이 없다고 말한다', () => {
    const report = reconcileKinds([], [], []);
    assert.equal(report.complete, false);
    assert.match(kindReconciliationVerdict(report), /확정 종이 없다/);
  });

  test('종 하나를 지우면 그 종을 가리키던 원문 해소도 함께 무너진다', () => {
    assert.equal(kindViolationVerdict([]), '분류가 온전하다');
    const report = reconcileKinds(specs.filter((spec) => spec.kind !== 'body'));
    // 신체를 지우면 D1 의 state 가 갈 곳을 절반 잃는다 — 대조표가 그 사실을 함께 말한다.
    assert.deepEqual(report.danglingTargets, ['state→body']);
    assert.deepEqual(report.undefinedKinds, ['body']);
    assert.match(
      kindViolationVerdict(report.violations),
      /종 body 가 막혔다 — dangling-resolution, undefined-kind/,
    );
  });
});
