import { describe, expect, it } from 'vitest';
import { blockingGates, deriveStatus, evaluateGates, type Measurements } from '../../src/gates.js';

const FULL: Measurements = {
  purpose: '한 문장으로 설명되는 목적이다',
  contract: {
    inputs: ['a'],
    outputs: ['b'],
    ownsState: ['c'],
    invariants: ['d'],
    scenarios: ['scene_one'],
  },
  staticCheck: { passed: true },
  unitTests: { passed: 10, failed: 0 },
  propertyTests: { seeds: 500, invariantViolations: 0 },
  labScenarios: { scene_one: 'passed' },
  replay: { runs: 20, uniqueHashes: 1 },
  integrationSlices: { VS0: 'passed' },
  regression: { failures: 0 },
  hashes: { sourceHash: `sha256:${'a'.repeat(64)}`, contractHash: `sha256:${'b'.repeat(64)}` },
};

const statusOf = (measurements: Measurements): string =>
  deriveStatus(evaluateGates(measurements), measurements.contract.scenarios.length > 0);

describe('게이트 판정', () => {
  it('전부 갖추면 아홉 게이트가 모두 통과한다', () => {
    expect(blockingGates(evaluateGates(FULL))).toEqual([]);
    expect(statusOf(FULL)).toBe('VERIFIED');
  });

  it('G0 — 목적이 두 문장이면 더 쪼갤 수 있다는 뜻이다', () => {
    const gates = evaluateGates({ ...FULL, purpose: '첫 문장이다. 둘째 문장이다.' });
    expect(gates.find((gate) => gate.id === 'G0')?.passed).toBe(false);
  });

  it('G1 — 입력·출력·불변조건이 비면 계약이 서지 않는다', () => {
    expect(statusOf({ ...FULL, contract: { ...FULL.contract, outputs: [] } })).toBe('BLOCKED');
  });

  it('G1 — 상태 소유권은 none 이어도 통과한다', () => {
    const gates = evaluateGates({ ...FULL, contract: { ...FULL.contract, ownsState: [] } });
    expect(gates.find((gate) => gate.id === 'G1')?.passed).toBe(true);
  });

  it('G2 — 단위 테스트가 0건이면 통과가 아니다', () => {
    expect(statusOf({ ...FULL, unitTests: { passed: 0, failed: 0 } })).toBe('IMPLEMENTED');
  });

  it('G3 — 속성 표본이 0이면 통과가 아니다', () => {
    expect(statusOf({ ...FULL, propertyTests: { seeds: 0, invariantViolations: 0 } })).toBe('IMPLEMENTED');
  });

  it('G4 — 계약의 장면과 판정된 장면이 다르면 막힌다', () => {
    const gates = evaluateGates({ ...FULL, labScenarios: { other_scene: 'passed' } });
    const g4 = gates.find((gate) => gate.id === 'G4');
    expect(g4?.passed).toBe(false);
    expect(g4?.detail).toContain('다르다');
  });

  it('G4 — 장면이 하나라도 실패하면 막힌다', () => {
    expect(statusOf({ ...FULL, labScenarios: { scene_one: 'failed' } })).toBe('UNIT_PASS');
  });

  it('G5 — 리플레이 해시가 둘이면 막힌다', () => {
    expect(statusOf({ ...FULL, replay: { runs: 20, uniqueHashes: 2 } })).toBe('SLICE_PASS');
  });

  it('G6 — 통합 슬라이스가 미통과면 VERIFIED 가 나올 수 없다 (원문 「23」)', () => {
    expect(statusOf({ ...FULL, integrationSlices: { VS0: 'pending' } })).toBe('LAB_PASS');
  });

  it('G6 — 슬라이스 기록이 아예 없어도 통과가 아니다', () => {
    expect(statusOf({ ...FULL, integrationSlices: {} })).toBe('LAB_PASS');
  });

  it('G7 — 회귀를 측정하지 않았으면 통과로 치지 않는다', () => {
    const relaxed: Measurements = { ...FULL };
    delete (relaxed as { regression?: unknown }).regression;
    const gates = evaluateGates(relaxed);
    const g7 = gates.find((gate) => gate.id === 'G7');
    expect(g7?.measured).toBe(false);
    expect(g7?.passed).toBe(false);
    expect(statusOf(relaxed)).toBe('SLICE_PASS');
  });

  it('G8 — 해시 형식이 어긋나면 막힌다', () => {
    expect(statusOf({ ...FULL, hashes: { sourceHash: 'nope', contractHash: 'nope' } })).toBe('TEST_READY');
  });

  it('G8 — 정적 검사가 실패하면 IMPLEMENTED 아래에 머문다', () => {
    expect(statusOf({ ...FULL, staticCheck: { passed: false } })).toBe('TEST_READY');
  });

  it('계약에 장면 선언이 없으면 SPECIFIED 를 넘지 못한다', () => {
    expect(statusOf({ ...FULL, contract: { ...FULL.contract, scenarios: [] } })).toBe('SPECIFIED');
  });

  it('게이트 순서는 언제나 G0~G8 이다', () => {
    expect(evaluateGates(FULL).map((gate) => gate.id)).toEqual([
      'G0',
      'G1',
      'G2',
      'G3',
      'G4',
      'G5',
      'G6',
      'G7',
      'G8',
    ]);
  });
});
