// V2 실행기 단위 테스트 + 자체 시나리오 3종 실행.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '@hkt/core/v1';

import {
  coverageOf,
  defineScenario,
  digestResult,
  digestSuite,
  divergences,
  expectDeterministic,
  expectDifferent,
  expectRejected,
  expectState,
  expectTrue,
  firstDivergentPath,
  formatResult,
  formatSuite,
  preview,
  runScenario,
  runScenarios,
  type Scenario,
} from '../src/index.ts';
import { v2Scenarios } from '../suites/v2.ts';

describe('firstDivergentPath', () => {
  test('중첩 객체에서 잎 경로를 지목한다', () => {
    assert.equal(
      firstDivergentPath({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }),
      '$.a.b.c',
    );
  });

  test('배열 인덱스를 지목한다', () => {
    assert.equal(firstDivergentPath([1, 2, 3], [1, 9, 3]), '$.1');
  });

  test('길이 차이를 먼저 알린다', () => {
    assert.equal(firstDivergentPath([1], [1, 2]), '$.length');
  });

  test('키 유무도 차이다', () => {
    assert.equal(firstDivergentPath({ a: 1 }, { a: 1, b: 2 }), '$.b');
  });

  test('같으면 null', () => {
    assert.equal(firstDivergentPath({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), null);
  });

  test('여러 차이를 모을 수 있다', () => {
    const found = divergences({ a: 1, b: 2 }, { a: 9, b: 8 });
    assert.deepEqual(
      found.map((entry) => entry.path),
      ['$.a', '$.b'],
    );
  });

  test('직렬화 불가능한 값이 섞여도 죽지 않는다', () => {
    assert.doesNotThrow(() => firstDivergentPath({ fn: () => 1 }, { fn: 2 }));
  });
});

describe('단언 헬퍼', () => {
  test('expectState 는 실패 시 분기 경로를 채운다', () => {
    const assertion = expectState('상태 비교', { x: { y: 1 } }, { x: { y: 2 } });
    assert.equal(assertion.passed, false);
    assert.equal(assertion.firstDivergentPath, '$.x.y');
  });

  test('expectDifferent 는 같으면 실패한다', () => {
    assert.equal(expectDifferent('달라야 한다', { a: 1 }, { a: 1 }).passed, false);
    assert.equal(expectDifferent('달라야 한다', { a: 1 }, { a: 2 }).passed, true);
  });

  test('expectRejected 는 거부를 기대한다', () => {
    const rejected = expectRejected('거부', () => {
      throw new RangeError('빈 범위');
    }, /빈 범위/);
    assert.equal(rejected.passed, true);
    assert.equal(expectRejected('거부', () => 1).passed, false);
  });

  test('expectDeterministic 은 흔들리는 실행을 잡아낸다', () => {
    let counter = 0;
    const drifting = expectDeterministic('흔들림', () => ({ n: counter++ }), 5);
    assert.equal(drifting.passed, false);
    assert.equal(drifting.firstDivergentPath, '$.n');
    assert.equal(expectDeterministic('고정', () => ({ n: 1 }), 5).passed, true);
  });

  test('preview 는 긴 값을 잘라 보여준다', () => {
    assert.equal(preview({ a: 1 }), '{"a":1}');
    assert.ok(preview({ long: 'x'.repeat(500) }).length <= 120);
  });
});

describe('실행기', () => {
  const passing: Scenario<{ n: number }, { n: number }> = defineScenario({
    id: 'x-ok',
    module: 'X',
    kind: 'normal',
    purpose: '통과한다.',
    arrange: () => ({ n: 1 }),
    act: (state) => ({ n: state.n + 1 }),
    assert: (result) => [expectState('증가한다', { n: 2 }, result)],
  });

  test('통과 시나리오는 failure 가 null 이다', () => {
    const result = runScenario(passing);
    assert.equal(result.passed, true);
    assert.equal(result.failure, null);
    assert.match(result.outputHash ?? '', /^[0-9a-f]{16}$/);
  });

  test('실행 순서는 (모듈, 종류, ID) 로 고정된다', () => {
    const make = (id: string, module: string, kind: 'normal' | 'failure' | 'boundary') =>
      defineScenario({
        id,
        module,
        kind,
        purpose: '순서 확인',
        arrange: () => ({}),
        act: () => ({}),
        assert: () => [expectTrue('ok', true)],
      });
    const suite = runScenarios([
      make('b-bound', 'B', 'boundary'),
      make('a-fail', 'A', 'failure'),
      make('b-norm', 'B', 'normal'),
      make('a-norm', 'A', 'normal'),
    ]);
    assert.deepEqual(
      suite.results.map((result) => result.scenarioId),
      // 모듈 오름차순 → 종류(정상 → 실패 → 경계) → ID
      ['a-norm', 'a-fail', 'b-norm', 'b-bound'],
    );
  });

  test('커버리지는 3종이 다 있고 전부 통과해야 complete', () => {
    const partial = coverageOf([
      { module: 'Z', kind: 'normal', passed: true } as never,
      { module: 'Z', kind: 'failure', passed: true } as never,
    ]);
    assert.equal(partial[0]?.complete, false);
  });

  test('실패 보고 텍스트에 5요소가 모두 있다', () => {
    const failing = defineScenario({
      id: 'x-bug',
      module: 'X',
      kind: 'normal',
      purpose: '실패한다.',
      arrange: () => ({ n: 1 }),
      act: (state: { n: number }) => ({ n: state.n + 5 }),
      assert: (result: { n: number }) => [expectState('증가한다', { n: 2 }, result)],
    });
    const text = formatResult(runScenario(failing));
    for (const label of ['초기 상태', '실행된 입력', '기대 결과', '실제 결과', '최초 분기 경로']) {
      assert.ok(text.includes(label), `보고에 "${label}" 이 없다:\n${text}`);
    }
    assert.ok(text.includes('$.n'));
  });
});

describe('결과 요약(digest)', () => {
  test('직렬화 불가능한 상태가 섞여도 요약은 해시된다', () => {
    const dirty = defineScenario({
      id: 'x-dirty',
      module: 'X',
      kind: 'boundary',
      purpose: '상태에 함수가 섞였다.',
      arrange: () => ({ fn: (): number => 1 }),
      act: (state: { fn: () => number }) => ({ n: state.fn() }),
      assert: (result: { n: number }) => [expectState('1이다', { n: 1 }, result)],
    });
    const result = runScenario(dirty);
    assert.throws(() => stateHash(result), /직렬화/);

    const folded = digestResult(result);
    assert.equal(folded.serializableState, false);
    assert.equal(folded.initialStateHash, null);
    assert.match(stateHash(folded), /^[0-9a-f]{16}$/);
  });

  test('스위트 요약은 두 번 접어도 같다', () => {
    const suite = runScenarios(v2Scenarios);
    assert.equal(stateHash(digestSuite(suite)), stateHash(digestSuite(runScenarios(v2Scenarios))));
  });
});

describe('V2 자체 시나리오 3종', () => {
  const suite = runScenarios(v2Scenarios);

  for (const result of suite.results) {
    test(`${result.scenarioId} (${result.kind})`, () => {
      assert.equal(result.passed, true, `\n${formatResult(result)}`);
    });
  }

  test('V2 커버리지가 정상·실패·경계 3종으로 완결된다', () => {
    const coverage = suite.coverage.find((entry) => entry.module === 'V2');
    assert.ok(coverage?.complete, formatSuite(suite));
  });
});
