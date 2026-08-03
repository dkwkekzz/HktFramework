// V4 증거 수집 순서 단위 테스트 — 기록은 검증 전량이 끝난 뒤에만 일어난다 (#662).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEvidence,
  collectEvidence,
  formatTrace,
  recordingOrderViolations,
  type Evidence,
  type EvidenceJob,
  type EvidenceStep,
} from '../src/index.ts';

function evidenceOf(id: string): Evidence {
  return buildEvidence({
    module: `${id}-example`,
    sourceHash: `hash-${id}`,
    unitTests: { result: 'passed', total: 3, passed: 3 },
    propertyTests: 'passed',
    labScenarios: 'manual',
    scenarios: {
      total: 3,
      passed: 3,
      failed: 0,
      coverageComplete: true,
      byId: { normal: 'passed', failure: 'passed', boundary: 'passed' },
    },
    replayHash: `replay-${id}`,
  });
}

describe('수집 순서', () => {
  test('모든 검증이 첫 기록보다 앞선다', () => {
    const calls: string[] = [];
    const jobs: readonly EvidenceJob[] = ['A', 'B', 'C'].map((id) => ({
      id,
      verify: () => {
        calls.push(`verify:${id}`);
        return evidenceOf(id);
      },
    }));

    const { trace } = collectEvidence(jobs, (record) => calls.push(`record:${record.id}`));

    assert.deepEqual(calls, [
      'verify:A',
      'verify:B',
      'verify:C',
      'record:A',
      'record:B',
      'record:C',
    ]);
    assert.deepEqual(recordingOrderViolations(trace), []);
  });

  test('작업마다 정확히 한 번씩 기록되고, 순서와 증거가 작업 순서 그대로다', () => {
    const written: string[] = [];
    const { records } = collectEvidence(
      ['A', 'B', 'C'].map((id) => ({ id, verify: () => evidenceOf(id) })),
      (record) => written.push(record.id),
    );

    assert.deepEqual(written, ['A', 'B', 'C']);
    assert.deepEqual(
      records.map((record) => record.evidence.sourceHash),
      ['hash-A', 'hash-B', 'hash-C'],
    );
  });

  test('검증이 던지면 아무것도 기록되지 않는다 — 반쯤 쓴 증거를 남기지 않는다', () => {
    const written: string[] = [];
    assert.throws(
      () =>
        collectEvidence(
          [
            { id: 'A', verify: () => evidenceOf('A') },
            {
              id: 'B',
              verify: (): Evidence => {
                throw new Error('B 검증이 터졌다');
              },
            },
          ],
          (record) => written.push(record.id),
        ),
      /B 검증이 터졌다/,
    );
    assert.deepEqual(written, []);
  });
});

describe('순서 위반 검출', () => {
  const eager: readonly EvidenceStep[] = [
    { phase: 'verify', module: 'A' },
    { phase: 'record', module: 'A' },
    { phase: 'verify', module: 'B' },
    { phase: 'record', module: 'B' },
    { phase: 'verify', module: 'C' },
    { phase: 'record', module: 'C' },
  ];

  test('즉시 기록은 어느 검증이 어느 기록보다 뒤였는지 짚는다', () => {
    const violations = recordingOrderViolations(eager);
    // B 는 A 기록 뒤, C 는 A·B 기록 뒤 — 셋.
    assert.equal(violations.length, 3);
    assert.ok(violations[0]?.includes('B 검증이 A 기록보다 뒤다'), violations[0]);
    assert.ok(
      violations.some((reason) => reason.includes('C 검증이 B 기록보다 뒤다')),
      violations.join(' / '),
    );
  });

  test('한 마당씩 나뉜 추적은 위반이 없다', () => {
    const batch: readonly EvidenceStep[] = [
      { phase: 'verify', module: 'A' },
      { phase: 'verify', module: 'B' },
      { phase: 'record', module: 'A' },
      { phase: 'record', module: 'B' },
    ];
    assert.deepEqual(recordingOrderViolations(batch), []);
  });

  test('경계 — 작업 0개와 1개는 순서 문제가 생길 수 없다', () => {
    const empty = collectEvidence([], () => assert.fail('기록할 것이 없다'));
    assert.deepEqual(empty.records, []);
    assert.deepEqual(empty.trace, []);
    assert.deepEqual(recordingOrderViolations(empty.trace), []);

    const single = collectEvidence([{ id: 'A', verify: () => evidenceOf('A') }], () => {});
    assert.deepEqual(recordingOrderViolations(single.trace), []);
    assert.equal(single.trace.length, 2);
  });

  test('요약 문장이 마당 수와 위반 수를 그대로 센다', () => {
    const { trace } = collectEvidence(
      ['A', 'B'].map((id) => ({ id, verify: () => evidenceOf(id) })),
      () => {},
    );
    assert.equal(formatTrace(trace), '검증 2줄 → 기록 2줄 · 순서 위반 0건');
    assert.equal(formatTrace(eager), '검증 3줄 → 기록 3줄 · 순서 위반 3건');
  });
});
