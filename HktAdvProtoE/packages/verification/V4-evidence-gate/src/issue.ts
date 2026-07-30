import { buildRegistry, type ModuleContract, type ModuleContractDocument } from '@hkt/v0-module-contract';
import { contractHashOf } from './audit.js';
import { issueEvidence, type EvidenceDocument } from './evidence.js';
import type { Measurements } from './gates.js';

/**
 * 저장소의 실제 측정 결과로 증거를 발급한다 — `tools/verify.mjs` 가 부르는 입구다.
 *
 * 계약 해시와 선행 계약 해시를 여기서 계산하는 이유는, 그 값을 손으로 넣을 수 있게 두면
 * 무효화 연쇄(원문 「2.5」)를 무력화할 수 있기 때문이다. 발급기는 넘겨받은 계약 원문에서만 읽는다.
 */
export interface IssueForModuleInput {
  /** 저장소의 모든 MODULE.yaml — 선행의 계약 해시를 여기서 얻는다 */
  contracts: readonly ModuleContractDocument[];
  moduleId: string;
  moduleVersion: string;
  /** 선행 모듈의 package.json 버전 */
  dependencyVersions: Record<string, string>;
  sourceHash: string;
  staticCheck: { passed: boolean; command?: string };
  unitTests: { passed: number; failed: number };
  propertyTests: { seeds: number; invariantViolations: number; passed?: number };
  integrationTests?: { passed: number; failed: number };
  labScenarios: Record<string, string>;
  replay: { runs: number; uniqueHashes: number };
  integrationSlices: Record<string, string>;
  /** 저장소 전체 회귀 — 측정했을 때만 넘긴다 (없으면 G7 은 미측정) */
  regression?: { failures: number };
  issuedAtTick?: number;
  producedBy?: string;
  /** 실행 자체가 실패했으면 사다리에 올리지 않는다 (원문 「22」 markExplicitFailure) */
  explicitFailure?: boolean;
}

export class IssueError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'IssueError';
    this.code = code;
  }
}

export function issueForModule(input: IssueForModuleInput): EvidenceDocument {
  const registration = buildRegistry(input.contracts);
  const contract = registration.registry.modules.find((module) => module.id === input.moduleId);
  if (!contract) {
    throw new IssueError(
      'E_CONTRACT_NOT_REGISTERED',
      `${input.moduleId} 의 계약이 등록되지 않았다 — 증거를 발급할 수 없다. 거부 ${registration.rejected.length}건.`,
    );
  }

  const textById = new Map<string, string>();
  for (const document of input.contracts) {
    const id = /^\s*id:\s*(\S+)/m.exec(document.text)?.[1];
    if (id) textById.set(id, document.text);
  }
  const selfText = textById.get(input.moduleId);
  if (selfText === undefined) {
    throw new IssueError('E_CONTRACT_TEXT_MISSING', `${input.moduleId} 의 MODULE.yaml 원문이 없다.`);
  }

  const dependencyContracts: Record<string, string> = {};
  for (const dependency of contract.dependsOn) {
    const text = textById.get(dependency);
    if (text === undefined) {
      throw new IssueError(
        'E_DEPENDENCY_CONTRACT_MISSING',
        `선행 ${dependency} 의 MODULE.yaml 원문이 없다 — 선행 변경을 감지할 수 없는 증거는 발급하지 않는다.`,
      );
    }
    dependencyContracts[dependency] = contractHashOf(text);
  }

  const measurements: Measurements = {
    purpose: contract.purpose,
    contract: contractFieldsOf(contract),
    staticCheck: { passed: input.staticCheck.passed },
    unitTests: input.unitTests,
    propertyTests: input.propertyTests,
    ...(input.integrationTests === undefined ? {} : { integrationTests: input.integrationTests }),
    labScenarios: input.labScenarios,
    replay: input.replay,
    integrationSlices: input.integrationSlices,
    ...(input.regression === undefined ? {} : { regression: input.regression }),
    hashes: { sourceHash: input.sourceHash, contractHash: contractHashOf(selfText) },
  };

  return issueEvidence({
    moduleId: input.moduleId,
    moduleVersion: input.moduleVersion,
    measurements,
    dependencyVersions: input.dependencyVersions,
    dependencyContracts,
    ...(input.staticCheck.command === undefined ? {} : { staticCheckCommand: input.staticCheck.command }),
    ...(input.issuedAtTick === undefined ? {} : { issuedAtTick: input.issuedAtTick }),
    ...(input.producedBy === undefined ? {} : { producedBy: input.producedBy }),
    ...(input.explicitFailure === undefined ? {} : { explicitFailure: input.explicitFailure }),
  });
}

function contractFieldsOf(contract: ModuleContract): Measurements['contract'] {
  return {
    inputs: contract.inputs,
    outputs: contract.outputs,
    ownsState: contract.ownsState,
    invariants: contract.invariants,
    scenarios: contract.scenarios,
  };
}
