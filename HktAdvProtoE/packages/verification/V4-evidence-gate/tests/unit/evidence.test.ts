import { describe, expect, it } from 'vitest';
import {
  EvidenceStore,
  evidenceHash,
  issueEvidence,
  validateEvidenceDocument,
  type EvidenceDocument,
} from '../../src/evidence.js';
import type { Measurements } from '../../src/gates.js';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;

const MEASUREMENTS: Measurements = {
  purpose: '한 문장 목적',
  contract: { inputs: ['a'], outputs: ['b'], ownsState: ['c'], invariants: ['d'], scenarios: ['scene'] },
  staticCheck: { passed: true },
  unitTests: { passed: 3, failed: 0 },
  propertyTests: { seeds: 100, invariantViolations: 0 },
  labScenarios: { scene: 'passed' },
  replay: { runs: 20, uniqueHashes: 1 },
  integrationSlices: { VS0: 'passed' },
  regression: { failures: 0 },
  hashes: { sourceHash: HASH_A, contractHash: HASH_B },
};

const request = {
  moduleId: 'K2',
  moduleVersion: '0.1.0',
  measurements: MEASUREMENTS,
  dependencyVersions: {},
  dependencyContracts: {},
};

describe('증거 발급', () => {
  it('상태는 인자가 아니라 게이트에서 나온다', () => {
    expect(issueEvidence(request).status).toBe('VERIFIED');
    expect(
      issueEvidence({
        ...request,
        measurements: { ...MEASUREMENTS, integrationSlices: { VS0: 'pending' } },
      }).status,
    ).toBe('LAB_PASS');
  });

  it('실행 자체가 실패하면 사다리에 올리지 않고 FAILED 로 적는다 (원문 「22」)', () => {
    expect(issueEvidence({ ...request, explicitFailure: true }).status).toBe('FAILED');
  });

  it('게이트 판정 기록을 함께 남긴다', () => {
    expect(issueEvidence(request).gates).toHaveLength(9);
  });

  it('같은 측정이면 같은 문서가 나온다', () => {
    expect(evidenceHash(issueEvidence(request))).toBe(evidenceHash(issueEvidence(request)));
  });

  it('키 순서가 달라도 같은 해시가 나온다', () => {
    const a = issueEvidence({ ...request, dependencyVersions: { V1: '1', V0: '2' } });
    const b = issueEvidence({ ...request, dependencyVersions: { V0: '2', V1: '1' } });
    expect(evidenceHash(a)).toBe(evidenceHash(b));
  });

  it('벽시계를 읽지 않는다 — 발급 시각은 틱이다', () => {
    expect(issueEvidence(request).issuedAtTick).toBe(0);
    expect(issueEvidence({ ...request, issuedAtTick: 7 }).issuedAtTick).toBe(7);
  });
});

describe('증거 형식 검사', () => {
  const valid = issueEvidence(request);

  it('제대로 된 문서는 통과한다', () => {
    expect(validateEvidenceDocument(valid)).toEqual([]);
  });

  it('필수 항목이 없으면 경로와 함께 거부한다', () => {
    const broken = { ...valid } as Partial<EvidenceDocument>;
    delete broken.dependencyContracts;
    const issues = validateEvidenceDocument(broken, { label: 'K2 증거' });
    expect(issues[0]?.code).toBe('E_REQUIRED');
    expect(issues[0]?.path).toBe('K2 증거/dependencyContracts');
  });

  it('사다리에 없는 상태값을 거부한다', () => {
    const issues = validateEvidenceDocument({ ...valid, status: 'PROBABLY_FINE' });
    expect(issues.map((issue) => issue.code)).toContain('E_ENUM');
  });

  it('게이트보다 높은 상태를 주장하면 잡는다', () => {
    const lower = issueEvidence({
      ...request,
      measurements: { ...MEASUREMENTS, integrationSlices: { VS0: 'pending' } },
    });
    const issues = validateEvidenceDocument({ ...lower, status: 'VERIFIED' });
    expect(issues.map((issue) => issue.code)).toContain('E_STATUS_ABOVE_GATES');
  });

  it('슬라이스가 통과하지 않았는데 VERIFIED 면 잡는다 (원문 「23」)', () => {
    const issues = validateEvidenceDocument({
      ...valid,
      integrationSlices: { VS0: 'pending' },
      status: 'VERIFIED',
    });
    expect(issues.map((issue) => issue.code)).toContain('E_VERIFIED_WITHOUT_SLICE');
  });

  it('슬라이스 기록이 아예 없는 VERIFIED 도 잡는다', () => {
    const issues = validateEvidenceDocument({ ...valid, integrationSlices: {}, status: 'VERIFIED' });
    expect(issues.map((issue) => issue.code)).toContain('E_VERIFIED_WITHOUT_SLICE');
  });
});

describe('증거 저장소', () => {
  it('발급 순서를 틱으로 센다', () => {
    const store = new EvidenceStore();
    expect(store.issue(request).issuedAtTick).toBe(0);
    expect(store.issue({ ...request, moduleId: 'K3' }).issuedAtTick).toBe(1);
  });

  it('모듈 id 오름차순으로 꺼낸다 — 저장 순서와 무관하다', () => {
    const store = new EvidenceStore();
    store.issue({ ...request, moduleId: 'K3' });
    store.issue({ ...request, moduleId: 'K2' });
    expect(store.all().map((document) => document.moduleId)).toEqual(['K2', 'K3']);
  });

  it('같은 내용이면 저장소 해시가 같다', () => {
    const a = new EvidenceStore().put(issueEvidence(request));
    const b = new EvidenceStore().put(issueEvidence(request));
    expect(a.hash()).toBe(b.hash());
  });
});
