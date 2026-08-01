// 등록된 전 모듈 시나리오를 실행기 하나로 돌린다 — 모듈이 늘어도 이 파일은 그대로다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { formatResult, formatSuite, runScenarios } from '../src/index.ts';
import { allScenarios } from '../suites/index.ts';

const suite = runScenarios(allScenarios);

describe('전 모듈 시나리오', () => {
  for (const result of suite.results) {
    test(`${result.module} · ${result.scenarioId} (${result.kind})`, () => {
      assert.equal(result.passed, true, `\n${formatResult(result)}`);
    });
  }

  test('등록된 모든 모듈이 정상·실패·경계 3종을 갖춘다', () => {
    const incomplete = suite.coverage.filter((entry) => !entry.complete);
    assert.deepEqual(incomplete, [], `\n${formatSuite(suite)}`);
  });

  test('시나리오 ID 는 중복되지 않는다', () => {
    const ids = suite.results.map((result) => result.scenarioId);
    assert.equal(new Set(ids).size, ids.length);
  });
});
