import {
  buildRegistry,
  dependentClosure,
  sha256Tagged,
  type ModuleContract,
  type ModuleContractDocument,
  type ModuleRegistry,
  type VerificationIssue,
} from '@hkt/v0-module-contract';
import { canonicalJson } from '@hkt/v1-schema';
import { validateEvidenceDocument, type EvidenceDocument } from './evidence.js';
import { deriveStatus, evaluateGates, type GateResult, type Measurements } from './gates.js';
import { isLadderStatus, lowerOf, statusRank, type VerificationStatus } from './status.js';

/**
 * 검증 상태 감사 (원문 「2.5」 · 「4」 · 「23」).
 *
 * 이 파일이 답하는 질문은 하나다 — **지금 이 모듈의 검증을 믿어도 되는가.**
 * 증거에 적힌 상태를 그대로 믿지 않고, 계약이 그 뒤로 바뀌었는지·선행이 무효화되었는지를 다시 본다.
 */

export interface ModuleAudit {
  id: string;
  name: string;
  version: string;
  purpose: string;
  dependsOn: readonly string[];
  dependents: readonly string[];
  /** 증거 문서에 적힌 상태 */
  declaredStatus: string;
  /** 감사 뒤의 상태. 이것이 화면과 판단의 근거다 */
  effectiveStatus: VerificationStatus;
  /** 계약 변경으로 검증이 무효화되었는가 (원문 「2.5」) */
  invalidated: boolean;
  gates: GateResult[];
  reasons: VerificationIssue[];
  sourceHash: string | null;
  contractHash: string;
  replay: { runs: number; uniqueHashes: number } | null;
  integrationSlices: Record<string, string>;
}

export interface AuditReport {
  modules: ModuleAudit[];
  /** 계약 변경으로 무효화된 모듈 (id 오름차순) */
  invalidated: string[];
  /** 등록 자체가 거부된 계약 문서 */
  rejected: { path: string; id: string | null; codes: string[] }[];
  issues: VerificationIssue[];
  registryHash: string;
  hash: string;
}

export interface AuditInput {
  contracts: readonly ModuleContractDocument[];
  evidences: readonly EvidenceDocument[];
}

/** MODULE.yaml 원문의 해시 — 증거의 `contractHash` 와 같은 방식으로 계산한다. */
export function contractHashOf(text: string): string {
  return sha256Tagged(text);
}

/**
 * 저장소 전체를 감사한다.
 *
 * 위상 순서로 훑기 때문에 선행의 판정이 먼저 정해진다 — 무효화가 한 번의 순회로 전체 하위 폐포에
 * 전파된다(원문 「2.5」의 `K2 → K3 → I3 → R3 → N0` 연쇄).
 */
export function auditRepository(input: AuditInput): AuditReport {
  const registration = buildRegistry(input.contracts);
  const registry = registration.registry;

  const contractHashes = new Map<string, string>();
  for (const document of input.contracts) {
    const id = /^\s*id:\s*(\S+)/m.exec(document.text)?.[1];
    if (id) contractHashes.set(id, contractHashOf(document.text));
  }

  const evidenceById = new Map(input.evidences.map((evidence) => [evidence.moduleId, evidence]));
  const audits = new Map<string, ModuleAudit>();
  const issues: VerificationIssue[] = [...registration.issues];

  for (const id of registry.order) {
    const contract = registry.modules.find((module) => module.id === id) as ModuleContract;
    const currentContractHash = contractHashes.get(id) ?? contractHashOf(contract.sourcePath);
    const evidence = evidenceById.get(id) ?? null;
    const reasons: VerificationIssue[] = [];
    const at = (code: string, message: string, path = `${id}`): void => {
      reasons.push({ code, path, message });
    };

    let gates: GateResult[] = [];
    let status: VerificationStatus = 'BLOCKED';
    let invalidated = false;

    if (!evidence) {
      at('E_EVIDENCE_MISSING', '증거 문서가 없다 — 발급 전에는 어떤 상태도 주장할 수 없다.');
    } else {
      for (const issue of validateEvidenceDocument(evidence, { label: `${id} 증거` })) {
        reasons.push(issue);
      }

      gates = evaluateGates(measurementsFrom(contract, normalizeEvidence(evidence)));
      status = deriveStatus(gates, contract.scenarios.length > 0);

      if (isLadderStatus(evidence.status) && statusRank(evidence.status) > statusRank(status)) {
        at(
          'E_STATUS_ABOVE_GATES',
          `증거는 ${evidence.status} 를 주장하지만 게이트 판정은 ${status} 다.`,
          `${id} 증거/status`,
        );
      }

      // 자기 계약이 발급 이후 바뀌었다 — 그 증거는 지금 계약의 증거가 아니다.
      if (evidence.contractHash !== currentContractHash) {
        invalidated = true;
        at(
          'E_SELF_CONTRACT_CHANGED',
          `발급 시점 계약 ${short(evidence.contractHash)} 과 지금 계약 ${short(currentContractHash)} 이 다르다.`,
          `${id} 증거/contractHash`,
        );
      }

      // 선행의 계약이 바뀌었다 — 원문 「8」이 V4 에 요구한 대표 검증이 이 줄이다.
      // 형식이 깨진 증거도 여기까지 올 수 있으므로 항목이 없을 수 있다고 보고 읽는다.
      const recordedContracts = evidence.dependencyContracts ?? {};
      for (const dependency of contract.dependsOn) {
        const issued = recordedContracts[dependency];
        const current = contractHashes.get(dependency);
        if (issued === undefined) {
          invalidated = true;
          at(
            'E_DEPENDENCY_CONTRACT_UNRECORDED',
            `선행 ${dependency} 의 계약 해시가 증거에 없다 — 선행이 바뀌었는지 증명할 수 없다.`,
            `${id} 증거/dependencyContracts/${dependency}`,
          );
          continue;
        }
        if (current !== undefined && issued !== current) {
          invalidated = true;
          at(
            'E_DEPENDENCY_CONTRACT_CHANGED',
            `선행 ${dependency} 의 계약이 ${short(issued)} 에서 ${short(current)} 로 바뀌었다.`,
            `${id} 증거/dependencyContracts/${dependency}`,
          );
        }
      }
    }

    // 선행이 무효화되었으면 그것을 쓰는 모듈도 무효다 (원문 「2.5」의 연쇄).
    for (const dependency of contract.dependsOn) {
      const upstream = audits.get(dependency);
      if (!upstream) continue;
      if (upstream.invalidated) {
        invalidated = true;
        at('E_DEPENDENCY_INVALIDATED', `선행 ${dependency} 의 검증이 무효화되었다.`);
      }
    }

    if (invalidated) {
      status = 'BLOCKED';
    } else {
      // 원문 「4」: BLOCKED 는 "선행 모듈이 검증되지 않음"이다. 여기서는 그 취지를 천장으로 적용한다 —
      // 선행이 아직 VERIFIED 가 아니면 이 모듈도 VERIFIED 가 될 수 없다.
      for (const dependency of contract.dependsOn) {
        const upstream = audits.get(dependency);
        if (!upstream || upstream.effectiveStatus === 'VERIFIED' || upstream.effectiveStatus === 'FROZEN') {
          continue;
        }
        if (statusRank(status) >= statusRank('VERIFIED')) {
          at(
            'E_DEPENDENCY_NOT_VERIFIED',
            `선행 ${dependency} 이 ${upstream.effectiveStatus} 라 VERIFIED 로 올릴 수 없다.`,
          );
        }
        status = lowerOf(status, 'SLICE_PASS');
      }
    }

    audits.set(id, {
      id,
      name: contract.name,
      version: evidence?.moduleVersion ?? 'unknown',
      purpose: contract.purpose,
      dependsOn: contract.dependsOn,
      dependents: registry.dependents[id] ?? [],
      declaredStatus: evidence?.status ?? 'BLOCKED',
      effectiveStatus: status,
      invalidated,
      gates,
      reasons,
      sourceHash: evidence?.sourceHash ?? null,
      contractHash: currentContractHash,
      replay: evidence ? { ...evidence.replay } : null,
      integrationSlices: evidence ? { ...evidence.integrationSlices } : {},
    });
    issues.push(...reasons);
  }

  const modules = [...audits.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  const report: Omit<AuditReport, 'hash'> = {
    modules,
    invalidated: modules.filter((module) => module.invalidated).map((module) => module.id),
    rejected: registration.rejected.map((document) => ({
      path: document.path,
      id: document.id,
      codes: document.issues.map((issue) => issue.code),
    })),
    issues,
    registryHash: registry.hash,
  };
  return { ...report, hash: sha256Tagged(canonicalJson(report)) };
}

/**
 * 어떤 모듈의 계약을 바꾸면 무엇이 무효화되는가 (원문 「2.5」).
 * Change Request 를 내기 전에 영향 범위를 먼저 보는 용도다 (원문 「23」).
 */
export function impactOf(registry: ModuleRegistry, moduleId: string): string[] {
  return dependentClosure(registry, moduleId);
}

/** 계약과 증거를 게이트가 보는 측정값으로 옮긴다. */
export function measurementsFrom(contract: ModuleContract, evidence: EvidenceDocument): Measurements {
  return {
    purpose: contract.purpose,
    contract: {
      inputs: contract.inputs,
      outputs: contract.outputs,
      ownsState: contract.ownsState,
      invariants: contract.invariants,
      scenarios: contract.scenarios,
    },
    staticCheck: { passed: evidence.staticCheck.passed },
    unitTests: evidence.unitTests,
    propertyTests: evidence.propertyTests,
    ...(evidence.integrationTests === undefined ? {} : { integrationTests: evidence.integrationTests }),
    labScenarios: evidence.labScenarios,
    replay: evidence.replay,
    integrationSlices: evidence.integrationSlices,
    ...(evidence.regression === undefined ? {} : { regression: evidence.regression }),
    hashes: { sourceHash: evidence.sourceHash, contractHash: evidence.contractHash },
  };
}

/**
 * 형식이 깨진 증거도 게이트 판정까지는 가야 한다 — "왜 낮은 상태인가"를 게이트로 설명하기 위해서다.
 * 빠진 항목은 **통과가 아니라 미측정**으로 채운다. 없는 값을 좋은 값으로 채우면 게이트가 무의미해진다.
 */
function normalizeEvidence(evidence: EvidenceDocument): EvidenceDocument {
  return {
    ...evidence,
    dependencyContracts: evidence.dependencyContracts ?? {},
    dependencyVersions: evidence.dependencyVersions ?? {},
    staticCheck: evidence.staticCheck ?? { passed: false },
    unitTests: evidence.unitTests ?? { passed: 0, failed: 0 },
    propertyTests: evidence.propertyTests ?? { seeds: 0, invariantViolations: 0 },
    labScenarios: evidence.labScenarios ?? {},
    replay: evidence.replay ?? { runs: 0, uniqueHashes: 0 },
    integrationSlices: evidence.integrationSlices ?? {},
    gates: evidence.gates ?? [],
    sourceHash: evidence.sourceHash ?? '',
    contractHash: evidence.contractHash ?? '',
  };
}

function short(hash: string): string {
  return hash.replace('sha256:', '').slice(0, 10);
}
