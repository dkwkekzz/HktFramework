import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { deriveStatus, evaluateGates, type Measurements } from '../../src/gates.js';
import { issueEvidence, validateEvidenceDocument } from '../../src/evidence.js';
import { statusRank } from '../../src/status.js';
import { auditRepository } from '../../src/audit.js';
import { issueForModule } from '../../src/issue.js';
import { CHAIN, CHAIN_IDS, contractText, fullPassMeasurement } from '../../scenarios/fixtures.js';

/** 속성 테스트 — 시드를 고정한다 (원문 「22」 6단계 · 체크리스트 5절). */
const RUN_OPTIONS = { seed: 20260730, numRuns: 500, verbose: false } as const;

const HASH = (letter: string): string => `sha256:${letter.repeat(64)}`;

const measurementArb: fc.Arbitrary<Measurements> = fc
  .record({
    purposeSentences: fc.integer({ min: 0, max: 2 }),
    inputs: fc.integer({ min: 0, max: 2 }),
    outputs: fc.integer({ min: 0, max: 2 }),
    invariants: fc.integer({ min: 0, max: 2 }),
    scenarios: fc.integer({ min: 0, max: 3 }),
    staticPassed: fc.boolean(),
    unitPassed: fc.integer({ min: 0, max: 20 }),
    unitFailed: fc.integer({ min: 0, max: 3 }),
    seeds: fc.integer({ min: 0, max: 1000 }),
    violations: fc.integer({ min: 0, max: 3 }),
    labFailures: fc.integer({ min: 0, max: 3 }),
    replayRuns: fc.integer({ min: 0, max: 100 }),
    uniqueHashes: fc.integer({ min: 0, max: 3 }),
    slicePassed: fc.boolean(),
    sliceCount: fc.integer({ min: 0, max: 2 }),
    regressionMeasured: fc.boolean(),
    regressionFailures: fc.integer({ min: 0, max: 3 }),
    goodHashes: fc.boolean(),
  })
  .map((draw): Measurements => {
    const scenarios = Array.from({ length: draw.scenarios }, (_unused, index) => `scene_${index}`);
    const labScenarios: Record<string, string> = {};
    scenarios.forEach((scenario, index) => {
      labScenarios[scenario] = index < draw.labFailures ? 'failed' : 'passed';
    });
    const integrationSlices: Record<string, string> = {};
    for (let index = 0; index < draw.sliceCount; index += 1) {
      integrationSlices[`VS${index}`] = draw.slicePassed ? 'passed' : 'pending';
    }
    return {
      purpose: ['', '한 문장이다', '첫 문장이다. 둘째 문장이다.'][draw.purposeSentences] as string,
      contract: {
        inputs: Array.from({ length: draw.inputs }, (_unused, index) => `in_${index}`),
        outputs: Array.from({ length: draw.outputs }, (_unused, index) => `out_${index}`),
        ownsState: [],
        invariants: Array.from({ length: draw.invariants }, (_unused, index) => `inv_${index}`),
        scenarios,
      },
      staticCheck: { passed: draw.staticPassed },
      unitTests: { passed: draw.unitPassed, failed: draw.unitFailed },
      propertyTests: { seeds: draw.seeds, invariantViolations: draw.violations },
      labScenarios,
      replay: { runs: draw.replayRuns, uniqueHashes: draw.uniqueHashes },
      integrationSlices,
      ...(draw.regressionMeasured ? { regression: { failures: draw.regressionFailures } } : {}),
      hashes: draw.goodHashes
        ? { sourceHash: HASH('a'), contractHash: HASH('b') }
        : { sourceHash: 'bad', contractHash: 'bad' },
    };
  });

describe('게이트와 상태의 불변조건', () => {
  it('통합 슬라이스가 모두 통과하지 않으면 절대 VERIFIED 가 나오지 않는다 (원문 「23」)', () => {
    fc.assert(
      fc.property(measurementArb, (measurements) => {
        const slices = Object.values(measurements.integrationSlices);
        if (slices.length > 0 && slices.every((verdict) => verdict === 'passed')) return;
        const status = deriveStatus(evaluateGates(measurements), measurements.contract.scenarios.length > 0);
        expect(statusRank(status)).toBeLessThan(statusRank('VERIFIED'));
      }),
      RUN_OPTIONS,
    );
  });

  it('막힌 게이트가 있으면 그 게이트가 요구하는 칸 위로 올라가지 않는다', () => {
    fc.assert(
      fc.property(measurementArb, (measurements) => {
        const gates = evaluateGates(measurements);
        const status = deriveStatus(gates, measurements.contract.scenarios.length > 0);
        const failed = new Set(gates.filter((gate) => !gate.passed).map((gate) => gate.id));
        if (failed.has('G0') || failed.has('G1')) expect(status).toBe('BLOCKED');
        if (failed.has('G4')) expect(statusRank(status)).toBeLessThan(statusRank('LAB_PASS'));
        if (failed.has('G6')) expect(statusRank(status)).toBeLessThan(statusRank('SLICE_PASS'));
        if (failed.has('G5')) expect(statusRank(status)).toBeLessThan(statusRank('VERIFIED'));
      }),
      RUN_OPTIONS,
    );
  });

  it('발급된 증거는 언제나 자기 형식 검사를 통과한다', () => {
    fc.assert(
      fc.property(measurementArb, (measurements) => {
        const evidence = issueEvidence({
          moduleId: 'K2',
          moduleVersion: '0.1.0',
          measurements,
          dependencyVersions: {},
          dependencyContracts: {},
        });
        const issues = validateEvidenceDocument(evidence);
        // 해시 형식이 어긋난 측정은 스키마가 잡는 것이 맞다 — 그 경우만 예외로 둔다.
        const onlyHashIssues = issues.every((issue) => issue.path.includes('Hash'));
        expect(onlyHashIssues, JSON.stringify(issues)).toBe(true);
      }),
      RUN_OPTIONS,
    );
  });

  it('발급은 같은 측정에서 언제나 같은 상태를 낸다', () => {
    fc.assert(
      fc.property(measurementArb, (measurements) => {
        const once = deriveStatus(evaluateGates(measurements), measurements.contract.scenarios.length > 0);
        const twice = deriveStatus(evaluateGates(measurements), measurements.contract.scenarios.length > 0);
        expect(once).toBe(twice);
      }),
      RUN_OPTIONS,
    );
  });
});

describe('무효화의 불변조건', () => {
  const baseContracts = CHAIN.map((spec) => ({
    path: `packages/synthetic/${spec.id}-${spec.name}/MODULE.yaml`,
    text: contractText(spec),
  }));
  const evidences = CHAIN.map((spec) => {
    const record = fullPassMeasurement(spec);
    return issueForModule({
      contracts: baseContracts,
      moduleId: spec.id,
      moduleVersion: '0.1.0',
      dependencyVersions: {},
      sourceHash: record.sourceHash,
      staticCheck: record.staticCheck,
      unitTests: record.unitTests,
      propertyTests: record.propertyTests,
      labScenarios: record.labScenarios,
      replay: record.replay,
      integrationSlices: record.integrationSlices,
      ...(record.regression === undefined ? {} : { regression: record.regression }),
    });
  });

  it('어느 모듈의 계약을 바꾸든 그 하위 폐포 전체가 무효화된다', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CHAIN_IDS), fc.string({ minLength: 1, maxLength: 6 }), (target, suffix) => {
        const contracts = baseContracts.map((document, index) =>
          (CHAIN[index] as (typeof CHAIN)[number]).id === target
            ? { ...document, text: `${document.text}# ${suffix.replace(/\n/g, ' ')}\n` }
            : document,
        );
        const report = auditRepository({ contracts, evidences });
        const position = CHAIN_IDS.indexOf(target);
        const expected = CHAIN_IDS.slice(position).sort();
        expect(report.invalidated).toEqual(expected);
        for (const id of expected) {
          expect(report.modules.find((module) => module.id === id)?.effectiveStatus).toBe('BLOCKED');
        }
      }),
      { seed: 20260730, numRuns: 500 },
    );
  });
});
