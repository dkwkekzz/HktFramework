import { buildRegistry, type ModuleContract } from '@hkt/v0-module-contract';
import { StepRejection, readPath, writePath } from '@hkt/v3-scenario-runner';
import type { JsonObject, JsonValue, StepDefinition } from '@hkt/v3-scenario-runner';
import { auditRepository, contractHashOf, measurementsFrom } from './audit.js';
import { issueEvidence, type EvidenceDocument } from './evidence.js';

/**
 * V4 를 굴리기 위한 V3 단계 목록.
 *
 * V4 의 대표 장면은 그 자체가 Given-When-Then 이다 —
 * *"이미 검증된 모듈이 있다 / 선행의 계약을 바꾼다 / 하위 모듈이 BLOCKED 가 된다."*
 * 그래서 자기 검증에 V3(scenario-runner)을 그대로 쓴다. 실행기와 판정기를 각각 따로 만들면
 * 둘 중 무엇이 틀렸는지 알 수 없게 된다.
 *
 * 상태 형태:
 *
 * ```json
 * {
 *   "contracts":    { "K2": "<MODULE.yaml 원문>", … },
 *   "measurements": { "K2": { …게이트가 보는 측정값… }, … },
 *   "evidences":    { "K2": { …증거 문서… }, … },
 *   "audit":        null
 * }
 * ```
 */

const MODULE_ID_SCHEMA = { type: 'string', pattern: '^[A-Z][0-9]+$' } as const;

/** 상태에 담긴 계약 문서들을 V0 이 읽는 형태로 옮긴다. */
function contractDocuments(state: JsonObject): { path: string; text: string }[] {
  const contracts = (state['contracts'] ?? {}) as Record<string, string>;
  return Object.keys(contracts)
    .sort()
    .map((id) => ({ path: `packages/synthetic/${id}-${nameOf(contracts[id] as string, id)}/MODULE.yaml`, text: contracts[id] as string }));
}

function nameOf(text: string, fallback: string): string {
  return /^\s*name:\s*(\S+)/m.exec(text)?.[1] ?? fallback.toLowerCase();
}

/** 증거를 발급해 `/evidences/<id>` 에 넣는다. 상태는 게이트가 정하므로 인자로 받지 않는다. */
export const issueEvidenceStep: StepDefinition = {
  id: 'issue_evidence',
  title: '증거를 발급한다 (상태는 게이트가 정한다)',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v4-step-issue-evidence.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['moduleId'],
    properties: { moduleId: MODULE_ID_SCHEMA },
  },
  apply: (state, params, context) => {
    const moduleId = params['moduleId'] as string;
    const documents = contractDocuments(state);
    const registration = buildRegistry(documents);
    const contract = registration.registry.modules.find((module) => module.id === moduleId);
    if (!contract) {
      throw new StepRejection(
        'E_UNKNOWN_MODULE',
        `/contracts/${moduleId}`,
        `${moduleId} 의 계약이 등록되지 않았다 (거부 ${registration.rejected.length}건).`,
      );
    }

    const measurement = readPath(state, `/measurements/${moduleId}`);
    if (measurement === undefined || measurement === null || typeof measurement !== 'object') {
      throw new StepRejection(
        'E_NO_MEASUREMENT',
        `/measurements/${moduleId}`,
        `${moduleId} 의 측정값이 없다 — 측정 없이 증거를 발급할 수 없다 (원문 「21」).`,
      );
    }

    const contracts = (state['contracts'] ?? {}) as Record<string, string>;
    const dependencyContracts: Record<string, string> = {};
    const dependencyVersions: Record<string, string> = {};
    for (const dependency of contract.dependsOn) {
      const text = contracts[dependency];
      if (text !== undefined) dependencyContracts[dependency] = contractHashOf(text);
      dependencyVersions[dependency] = '0.1.0';
    }

    const record = measurement as unknown as EvidenceMeasurementRecord;
    const evidence = issueEvidence({
      moduleId,
      moduleVersion: record.moduleVersion ?? '0.1.0',
      measurements: measurementsFrom(contract as ModuleContract, {
        ...emptyEvidence(moduleId),
        ...record,
        contractHash: contractHashOf(contracts[moduleId] as string),
      } as EvidenceDocument),
      dependencyVersions,
      dependencyContracts,
      issuedAtTick: context.tick,
      producedBy: 'V4 대표 장면',
    });

    return writePath(state, `/evidences/${moduleId}`, evidence as unknown as JsonValue);
  },
};

/**
 * 계약의 한 절에 항목을 더한다 — 원문 「2.5」가 말하는 "계약 변경"이다.
 *
 * 주석을 붙여 해시만 흔드는 것이 아니라 실제 선언을 바꾼다. 그래야 무효화가 *형식적인* 것이 아니라
 * "이 증거는 지금 계약의 증거가 아니다"라는 뜻이 된다.
 */
export const editContractStep: StepDefinition = {
  id: 'edit_contract',
  title: '계약에 항목을 더한다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v4-step-edit-contract.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['moduleId', 'section', 'entry'],
    properties: {
      moduleId: MODULE_ID_SCHEMA,
      section: { enum: ['inputs', 'outputs', 'invariants'] },
      entry: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
    },
  },
  apply: (state, params) => {
    const moduleId = params['moduleId'] as string;
    const text = readPath(state, `/contracts/${moduleId}`);
    if (typeof text !== 'string') {
      throw new StepRejection('E_UNKNOWN_MODULE', `/contracts/${moduleId}`, `${moduleId} 의 계약이 없다.`);
    }
    const section = params['section'] as string;
    const header = `${section}:`;
    const lines = text.split('\n');
    const index = lines.findIndex((line) => line.trim() === header);
    if (index < 0) {
      throw new StepRejection(
        'E_UNKNOWN_SECTION',
        `/contracts/${moduleId}`,
        `${moduleId} 의 계약에 \`${header}\` 절이 없다.`,
      );
    }
    lines.splice(index + 1, 0, `  - ${params['entry'] as string}`);
    return writePath(state, `/contracts/${moduleId}`, lines.join('\n'));
  },
};

/** 측정값 하나를 바꾼다 — 게이트가 상태를 어떻게 끌어내리는지 보이기 위한 단계다. */
export const setMeasurementStep: StepDefinition = {
  id: 'set_measurement',
  title: '측정값을 바꾼다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v4-step-set-measurement.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['moduleId', 'path', 'value'],
    properties: { moduleId: MODULE_ID_SCHEMA, path: { type: 'string' }, value: true },
  },
  apply: (state, params) => {
    const moduleId = params['moduleId'] as string;
    if (readPath(state, `/measurements/${moduleId}`) === undefined) {
      throw new StepRejection('E_NO_MEASUREMENT', `/measurements/${moduleId}`, `${moduleId} 의 측정값이 없다.`);
    }
    return writePath(
      state,
      `/measurements/${moduleId}${params['path'] as string}`,
      params['value'] as JsonValue,
    );
  },
};

/** 증거의 상태값을 손으로 올려 본다 — 감사가 그것을 잡아내는지 확인하기 위한 단계다. */
export const forgeStatusStep: StepDefinition = {
  id: 'forge_status',
  title: '증거의 상태를 손으로 올린다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v4-step-forge-status.schema.json',
    type: 'object',
    additionalProperties: false,
    required: ['moduleId', 'status'],
    properties: { moduleId: MODULE_ID_SCHEMA, status: { type: 'string', minLength: 1 } },
  },
  apply: (state, params) => {
    const moduleId = params['moduleId'] as string;
    if (readPath(state, `/evidences/${moduleId}`) === undefined) {
      throw new StepRejection('E_NO_EVIDENCE', `/evidences/${moduleId}`, `${moduleId} 의 증거가 없다.`);
    }
    return writePath(state, `/evidences/${moduleId}/status`, params['status'] as string);
  },
};

/** 감사를 돌려 `/audit` 에 결과를 쓴다. */
export const runAuditStep: StepDefinition = {
  id: 'run_audit',
  title: '검증 상태를 감사한다',
  paramsSchema: {
    $id: 'https://hkt.local/schemas/v4-step-run-audit.schema.json',
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
  apply: (state) => {
    const evidences = Object.values((state['evidences'] ?? {}) as Record<string, unknown>) as EvidenceDocument[];
    const report = auditRepository({ contracts: contractDocuments(state), evidences });

    const status: JsonObject = {};
    const reasons: JsonObject = {};
    for (const module of report.modules) {
      status[module.id] = module.effectiveStatus;
      reasons[module.id] = module.reasons.map((reason) => reason.code);
    }

    return writePath(state, '/audit', {
      status,
      reasons,
      invalidated: report.invalidated,
      issueCount: report.issues.length,
      hash: report.hash,
    } as JsonValue);
  },
};

export const V4_STEPS: readonly StepDefinition[] = [
  editContractStep,
  forgeStatusStep,
  issueEvidenceStep,
  runAuditStep,
  setMeasurementStep,
];

/** 장면 상태에 담기는 측정 기록 — 증거 문서에서 게이트가 보는 부분만 담는다. */
export interface EvidenceMeasurementRecord {
  moduleVersion?: string;
  sourceHash: string;
  staticCheck: { passed: boolean };
  unitTests: { passed: number; failed: number };
  propertyTests: { seeds: number; invariantViolations: number };
  labScenarios: Record<string, string>;
  replay: { runs: number; uniqueHashes: number };
  integrationSlices: Record<string, string>;
  regression?: { failures: number };
}

function emptyEvidence(moduleId: string): EvidenceDocument {
  return {
    moduleId,
    moduleVersion: '0.1.0',
    sourceHash: '',
    contractHash: '',
    dependencyVersions: {},
    dependencyContracts: {},
    staticCheck: { passed: false },
    unitTests: { passed: 0, failed: 0 },
    propertyTests: { seeds: 0, invariantViolations: 0 },
    labScenarios: {},
    replay: { runs: 0, uniqueHashes: 0 },
    integrationSlices: {},
    gates: [],
    status: 'BLOCKED',
    issuedAtTick: 0,
    producedBy: '',
  };
}
