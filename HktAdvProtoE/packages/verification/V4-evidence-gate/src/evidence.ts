import { sha256Tagged } from '@hkt/v0-module-contract';
import type { VerificationIssue } from '@hkt/v0-module-contract';
import { canonicalJson, compileSchema } from '@hkt/v1-schema';
import { TickClock } from '@hkt/v2-determinism';
import evidenceSchema from '../schemas/v4-evidence.schema.json';
import { deriveStatus, evaluateGates, type GateResult, type Measurements } from './gates.js';
import { isLadderStatus, statusRank, type EvidenceStatus } from './status.js';

/**
 * 모듈 완료 증거 (원문 「21. 모듈 완료 증거 형식」).
 *
 * 원문의 형식에 이 저장소에서 필요한 네 항목을 더했다 — 모두 「파생」이며, 원문 항목을 바꾸지 않는다.
 *
 * | 추가 항목 | 왜 필요한가 |
 * |---|---|
 * | `contractHash` | 원문 「2.5」의 무효화 연쇄는 "계약이 바뀌었는가"를 물어야 판정할 수 있다 |
 * | `dependencyContracts` | 발급 시점의 **선행 계약** 해시. 이것이 없으면 선행 변경을 감지할 수 없다 |
 * | `gates` | 상태가 어느 게이트에서 정해졌는지 되짚기 위한 판정 기록 (원문 「5」) |
 * | `issuedAtTick` | 발급 시점. 벽시계를 읽지 않는다(원문 「23」) — V2 의 틱을 쓴다 |
 */
export interface EvidenceDocument {
  moduleId: string;
  moduleVersion: string;
  sourceHash: string;
  contractHash: string;
  dependencyVersions: Record<string, string>;
  dependencyContracts: Record<string, string>;
  staticCheck: { passed: boolean; command?: string };
  unitTests: { passed: number; failed: number };
  propertyTests: { seeds: number; invariantViolations: number; passed?: number };
  integrationTests?: { passed: number; failed: number };
  labScenarios: Record<string, string>;
  replay: { runs: number; uniqueHashes: number };
  integrationSlices: Record<string, string>;
  regression?: { failures: number };
  gates: { id: string; name: string; measured: boolean; passed: boolean; detail: string }[];
  status: EvidenceStatus;
  issuedAtTick: number;
  producedBy: string;
}

export const EVIDENCE_SCHEMA = evidenceSchema;
const evidenceValidator = compileSchema(evidenceSchema);

export interface IssueRequest {
  moduleId: string;
  moduleVersion: string;
  measurements: Measurements;
  dependencyVersions: Record<string, string>;
  dependencyContracts: Record<string, string>;
  staticCheckCommand?: string;
  producedBy?: string;
  issuedAtTick?: number;
  /** 실행 자체가 실패했으면 사다리에 올리지 않고 명시적 실패로 적는다 (원문 「22」) */
  explicitFailure?: boolean;
}

/**
 * 증거를 발급한다.
 *
 * `status` 를 인자로 받지 않는다는 점이 핵심이다 — 상태는 게이트 판정에서만 나온다.
 * "테스트가 성공했다"는 자연어 보고는 증거로 인정하지 않는다(원문 「21」).
 */
export function issueEvidence(request: IssueRequest): EvidenceDocument {
  const gates = evaluateGates(request.measurements);
  const scenariosDeclared = request.measurements.contract.scenarios.length > 0;
  const status: EvidenceStatus = request.explicitFailure
    ? 'FAILED'
    : deriveStatus(gates, scenariosDeclared);

  const document: EvidenceDocument = {
    moduleId: request.moduleId,
    moduleVersion: request.moduleVersion,
    sourceHash: request.measurements.hashes.sourceHash,
    contractHash: request.measurements.hashes.contractHash,
    dependencyVersions: sortedRecord(request.dependencyVersions),
    dependencyContracts: sortedRecord(request.dependencyContracts),
    staticCheck: {
      passed: request.measurements.staticCheck.passed,
      ...(request.staticCheckCommand === undefined ? {} : { command: request.staticCheckCommand }),
    },
    unitTests: { ...request.measurements.unitTests },
    propertyTests: { ...request.measurements.propertyTests },
    ...(request.measurements.integrationTests === undefined
      ? {}
      : { integrationTests: { ...request.measurements.integrationTests } }),
    labScenarios: sortedRecord(request.measurements.labScenarios),
    replay: { ...request.measurements.replay },
    integrationSlices: sortedRecord(request.measurements.integrationSlices),
    ...(request.measurements.regression === undefined
      ? {}
      : { regression: { ...request.measurements.regression } }),
    gates: gates.map((gate) => ({ ...gate })),
    status,
    issuedAtTick: request.issuedAtTick ?? 0,
    producedBy: request.producedBy ?? 'V4 evidence-gate',
  };

  return document;
}

/** 같은 증거 문서면 같은 해시. 키 순서에 의존하지 않는다. */
export function evidenceHash(document: EvidenceDocument): string {
  return sha256Tagged(canonicalJson(document));
}

/**
 * 증거 문서의 형식·정합 검사.
 *
 * 형식은 스키마가, "상태가 게이트보다 높다" 같은 정합은 여기서 본다.
 */
export function validateEvidenceDocument(
  document: unknown,
  options: { label?: string } = {},
): VerificationIssue[] {
  const label = options.label ?? 'evidence';
  const issues: VerificationIssue[] = [];

  const result = evidenceValidator.validate(document);
  for (const issue of result.issues) {
    issues.push({
      code: issue.code,
      path: `${label}${issue.instancePath}`,
      message: `${issue.message} (스키마 ${issue.schemaPath})`,
    });
  }
  if (!result.valid) return issues;

  const evidence = document as EvidenceDocument;

  // 게이트 기록이 있으면 상태와 어긋날 수 없다 — 손으로 올린 상태를 여기서 잡는다.
  if (evidence.status !== 'FAILED' && evidence.gates.length > 0) {
    const derived = deriveStatus(
      evidence.gates.map((gate) => ({ ...gate, id: gate.id as GateResult['id'] })),
      Object.keys(evidence.labScenarios).length > 0,
    );
    if (isLadderStatus(evidence.status) && statusRank(evidence.status) > statusRank(derived)) {
      issues.push({
        code: 'E_STATUS_ABOVE_GATES',
        path: `${label}/status`,
        message: `게이트 판정은 ${derived} 인데 증거는 ${evidence.status} 를 주장한다.`,
      });
    }
  }

  // 원문 「23」: 증거 없이 VERIFIED 표시 금지 — 슬라이스가 하나라도 통과하지 않았으면 위반이다.
  if (evidence.status === 'VERIFIED' || evidence.status === 'FROZEN') {
    const slices = Object.entries(evidence.integrationSlices);
    if (slices.length === 0) {
      issues.push({
        code: 'E_VERIFIED_WITHOUT_SLICE',
        path: `${label}/integrationSlices`,
        message: `${evidence.status} 인데 통합 슬라이스 기록이 없다.`,
      });
    }
    for (const [slice, verdict] of slices) {
      if (verdict === 'passed') continue;
      issues.push({
        code: 'E_VERIFIED_WITHOUT_SLICE',
        path: `${label}/integrationSlices/${slice}`,
        message: `${slice} 가 통과하지 않았는데 ${evidence.status} 다: ${verdict}`,
      });
    }
  }

  return issues;
}

/**
 * 증거 저장소 — V4 가 소유하는 상태(`evidence_store`).
 *
 * 발급 시각은 벽시계가 아니라 V2 의 틱으로 센다. 같은 측정을 같은 순서로 넣으면 언제 돌려도
 * 같은 문서가 나온다 — 증거 자체가 리플레이 가능해야 증거를 대조할 수 있다.
 */
export class EvidenceStore {
  readonly clock: TickClock;
  #documents = new Map<string, EvidenceDocument>();

  constructor(options: { startTick?: number } = {}) {
    this.clock = new TickClock(options.startTick === undefined ? {} : { startTick: options.startTick });
  }

  /** 발급하고 저장한다. 저장 순서가 아니라 모듈 id 로 꺼낸다. */
  issue(request: Omit<IssueRequest, 'issuedAtTick'>): EvidenceDocument {
    const tick = this.#documents.size === 0 ? this.clock.tick : this.clock.advance(1);
    const document = issueEvidence({ ...request, issuedAtTick: tick });
    this.#documents.set(document.moduleId, document);
    return document;
  }

  put(document: EvidenceDocument): this {
    this.#documents.set(document.moduleId, document);
    return this;
  }

  get(moduleId: string): EvidenceDocument | null {
    return this.#documents.get(moduleId) ?? null;
  }

  /** 모듈 id 오름차순 — 저장 순서와 무관하다. */
  all(): EvidenceDocument[] {
    return [...this.#documents.values()].sort((a, b) => (a.moduleId < b.moduleId ? -1 : 1));
  }

  hash(): string {
    return sha256Tagged(canonicalJson(this.all()));
  }
}

function sortedRecord<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(record).sort()) out[key] = record[key] as T;
  return out;
}
