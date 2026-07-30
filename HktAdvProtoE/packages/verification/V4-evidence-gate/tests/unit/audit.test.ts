import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@hkt/v0-module-contract';
import { auditRepository, contractHashOf, impactOf } from '../../src/audit.js';
import { buildBoard } from '../../src/board.js';
import { issueForModule } from '../../src/issue.js';
import { CHAIN, CHAIN_IDS, contractText, fullPassMeasurement, slicePendingMeasurement } from '../../scenarios/fixtures.js';
import type { EvidenceDocument } from '../../src/evidence.js';

function documents(overrides: Record<string, string> = {}): { path: string; text: string }[] {
  return CHAIN.map((spec) => ({
    path: `packages/synthetic/${spec.id}-${spec.name}/MODULE.yaml`,
    text: overrides[spec.id] ?? contractText(spec),
  }));
}

function issueAll(
  contracts: { path: string; text: string }[],
  measurement = fullPassMeasurement,
): EvidenceDocument[] {
  return CHAIN.map((spec) => {
    const record = measurement(spec);
    return issueForModule({
      contracts,
      moduleId: spec.id,
      moduleVersion: '0.1.0',
      dependencyVersions: Object.fromEntries(spec.dependsOn.map((id) => [id, '0.1.0'])),
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
}

describe('저장소 감사', () => {
  const contracts = documents();

  it('전부 통과하면 모두 VERIFIED 다', () => {
    const report = auditRepository({ contracts, evidences: issueAll(contracts) });
    expect(report.modules.map((module) => module.effectiveStatus)).toEqual(CHAIN_IDS.map(() => 'VERIFIED'));
    expect(report.invalidated).toEqual([]);
  });

  it('증거가 없는 모듈은 BLOCKED 다', () => {
    const evidences = issueAll(contracts).filter((evidence) => evidence.moduleId !== 'I3');
    const report = auditRepository({ contracts, evidences });
    const i3 = report.modules.find((module) => module.id === 'I3');
    expect(i3?.effectiveStatus).toBe('BLOCKED');
    expect(i3?.reasons.map((reason) => reason.code)).toContain('E_EVIDENCE_MISSING');
  });

  it('선행이 VERIFIED 가 아니면 후행도 VERIFIED 가 될 수 없다', () => {
    const evidences = issueAll(contracts).map((evidence) =>
      evidence.moduleId === 'K2'
        ? { ...evidence, integrationSlices: { VS0: 'pending' }, status: 'LAB_PASS' as const }
        : evidence,
    );
    const report = auditRepository({ contracts, evidences });
    expect(report.modules.find((module) => module.id === 'K2')?.effectiveStatus).toBe('LAB_PASS');
    expect(report.modules.find((module) => module.id === 'K3')?.effectiveStatus).toBe('SLICE_PASS');
    expect(report.modules.find((module) => module.id === 'K3')?.reasons.map((reason) => reason.code)).toContain(
      'E_DEPENDENCY_NOT_VERIFIED',
    );
  });

  describe('무효화 연쇄 (원문 「2.5」)', () => {
    const evidences = issueAll(contracts);
    const changed = documents({
      K2: contractText({ ...(CHAIN[0] as (typeof CHAIN)[number]), scenarios: ['rule_applies', 'rule_rejects', 'rule_rolls_back'] }),
    });
    const report = auditRepository({ contracts: changed, evidences });

    it('바뀐 모듈 자신이 무효화된다', () => {
      const k2 = report.modules.find((module) => module.id === 'K2');
      expect(k2?.invalidated).toBe(true);
      expect(k2?.reasons.map((reason) => reason.code)).toContain('E_SELF_CONTRACT_CHANGED');
    });

    it('직접 의존하는 모듈은 계약 변경을 이유로 무효화된다', () => {
      expect(report.modules.find((module) => module.id === 'K3')?.reasons.map((reason) => reason.code)).toContain(
        'E_DEPENDENCY_CONTRACT_CHANGED',
      );
    });

    it('간접 의존은 선행 무효를 이유로 무효화된다', () => {
      expect(report.modules.find((module) => module.id === 'N0')?.reasons.map((reason) => reason.code)).toEqual([
        'E_DEPENDENCY_INVALIDATED',
      ]);
    });

    it('하위 폐포 전체가 BLOCKED 가 된다', () => {
      expect(report.invalidated).toEqual([...CHAIN_IDS].sort());
      expect(report.modules.every((module) => module.effectiveStatus === 'BLOCKED')).toBe(true);
    });

    it('증거 파일 자체는 바뀌지 않는다 — 무효화는 감사가 한다', () => {
      expect(report.modules.map((module) => module.declaredStatus)).toEqual(CHAIN_IDS.map(() => 'VERIFIED'));
    });
  });

  it('선행 계약 해시가 기록되지 않은 증거는 믿지 않는다', () => {
    const evidences = issueAll(contracts).map((evidence) =>
      evidence.moduleId === 'K3' ? { ...evidence, dependencyContracts: {} } : evidence,
    );
    const report = auditRepository({ contracts, evidences });
    const k3 = report.modules.find((module) => module.id === 'K3');
    expect(k3?.invalidated).toBe(true);
    expect(k3?.reasons.map((reason) => reason.code)).toContain('E_DEPENDENCY_CONTRACT_UNRECORDED');
  });

  it('같은 입력이면 같은 감사 해시가 나온다', () => {
    const evidences = issueAll(contracts);
    expect(auditRepository({ contracts, evidences }).hash).toBe(
      auditRepository({ contracts: [...contracts].reverse(), evidences: [...evidences].reverse() }).hash,
    );
  });

  it('계약 해시는 원문에서만 나온다', () => {
    expect(contractHashOf('a')).not.toBe(contractHashOf('b'));
    expect(contractHashOf('a')).toBe(contractHashOf('a'));
  });

  it('impactOf 는 계약을 바꾸기 전에 영향 범위를 알려 준다', () => {
    const registry = buildRegistry(contracts).registry;
    expect(impactOf(registry, 'K2')).toEqual(['I3', 'K3', 'N0', 'R3']);
    expect(impactOf(registry, 'N0')).toEqual([]);
  });
});

describe('V 단계 완료 화면', () => {
  const contracts = documents();

  it('여섯 구획이 모두 채워진다 (원문 「8」)', () => {
    const board = buildBoard({ audit: auditRepository({ contracts, evidences: issueAll(contracts) }) });
    expect(board.statuses).toHaveLength(5);
    expect(board.dependencyGraph.edges).toHaveLength(4);
    expect(board.hashes).toHaveLength(5);
    expect(board.replays).toHaveLength(5);
    expect(board.replays.every((row) => row.consistent)).toBe(true);
    expect(board.failedChecks).toEqual([]);
  });

  it('미측정 지표를 0 이 아니라 null 로 남긴다', () => {
    const board = buildBoard({ audit: auditRepository({ contracts, evidences: issueAll(contracts) }) });
    expect(board.completion.globalInvariantViolations).toBeNull();
    expect(board.completion.unexplainedStateChanges).toBeNull();
    expect(board.completion.pending.length).toBeGreaterThan(0);
    expect(board.completion.complete).toBe(false);
  });

  it('슬라이스가 남아 있으면 완성이 아니다', () => {
    const board = buildBoard({
      audit: auditRepository({ contracts, evidences: issueAll(contracts, slicePendingMeasurement) }),
      requiredSlices: ['VS0'],
      regressionFailures: 0,
    });
    expect(board.completion.allVerticalSlicesPassed).toBe(false);
    expect(board.completion.allModulesVerified).toBe(false);
    expect(board.completion.complete).toBe(false);
  });

  it('막힌 게이트를 실패한 검증 목록에 올린다', () => {
    const board = buildBoard({
      audit: auditRepository({ contracts, evidences: issueAll(contracts, slicePendingMeasurement) }),
    });
    expect(board.failedChecks.map((check) => check.source)).toContain('G6 통합 게이트');
  });
});
