import { sha256Tagged } from '@hkt/v0-module-contract';
import type { JsonObject, JsonValue } from '@hkt/v3-scenario-runner';
import type { EvidenceMeasurementRecord } from '../src/steps.js';

/**
 * 대표 장면이 쓰는 합성 저장소.
 *
 * 실제 저장소(V0~V4)의 증거는 `pnpm verify` 가 돌 때마다 코드 해시가 바뀌므로 장면의 고정 입력이 될 수 없다.
 * 그래서 원문 「2.5」가 예로 든 무효화 연쇄 `K2 → K3 → I3 → R3 → N0` 를 합성 계약으로 세워 쓴다.
 * 실제 저장소를 대상으로 한 감사는 `tests/integration/` 이 따로 돌린다.
 */

export interface ContractSpec {
  id: string;
  name: string;
  purpose: string;
  dependsOn: readonly string[];
  scenarios: readonly string[];
}

/** V0 이 읽는 형태의 MODULE.yaml 원문을 만든다. */
export function contractText(spec: ContractSpec): string {
  const list = (items: readonly string[]): string =>
    (items.length > 0 ? items : ['none']).map((item) => `  - ${item}`).join('\n');

  return [
    `id: ${spec.id}`,
    `name: ${spec.name}`,
    `purpose: >`,
    `  ${spec.purpose}`,
    ``,
    `depends_on:`,
    list(spec.dependsOn),
    ``,
    `owns_state:`,
    `  - ${spec.name.replace(/-/g, '_')}_state`,
    ``,
    `inputs:`,
    `  - upstream_state`,
    ``,
    `outputs:`,
    `  - downstream_state`,
    ``,
    `invariants:`,
    `  - identical_input_must_produce_identical_output`,
    ``,
    `scenarios:`,
    list(spec.scenarios),
    ``,
    `commands:`,
    `  test: pnpm test ${spec.id}-${spec.name}`,
    `  lab: pnpm lab`,
    `  verify: pnpm verify ${spec.id}`,
    ``,
  ].join('\n');
}

/** 원문 「2.5」의 연쇄. K2 하나를 바꾸면 나머지 넷이 따라 무효화되어야 한다. */
export const CHAIN: readonly ContractSpec[] = [
  {
    id: 'K2',
    name: 'rule-transaction',
    purpose: '세계 규칙을 트랜잭션으로 적용한다',
    dependsOn: [],
    scenarios: ['rule_applies', 'rule_rejects'],
  },
  {
    id: 'K3',
    name: 'event-replay',
    purpose: '사건 로그를 그대로 재생한다',
    dependsOn: ['K2'],
    scenarios: ['replay_matches'],
  },
  {
    id: 'I3',
    name: 'conflict-resolver',
    purpose: '주체들의 충돌을 사건으로 정리한다',
    dependsOn: ['K3'],
    scenarios: ['conflict_resolves'],
  },
  {
    id: 'R3',
    name: 'ability-runtime',
    purpose: '능력의 비용과 효과를 사건으로 처리한다',
    dependsOn: ['I3'],
    scenarios: ['ability_costs'],
  },
  {
    id: 'N0',
    name: 'authoritative-server',
    purpose: '권위 서버가 세계 상태를 확정한다',
    dependsOn: ['R3'],
    scenarios: ['server_confirms'],
  },
];

export const CHAIN_IDS = CHAIN.map((spec) => spec.id);

/** 모든 게이트를 통과하는 측정값. 여기서 하나씩 낮춰 가며 상태가 내려오는 것을 본다. */
export function fullPassMeasurement(spec: ContractSpec): EvidenceMeasurementRecord {
  return {
    moduleVersion: '0.1.0',
    sourceHash: sha256Tagged(`source:${spec.id}`),
    staticCheck: { passed: true },
    unitTests: { passed: 12, failed: 0 },
    propertyTests: { seeds: 1000, invariantViolations: 0 },
    labScenarios: Object.fromEntries(spec.scenarios.map((scenario) => [scenario, 'passed'])),
    replay: { runs: 100, uniqueHashes: 1 },
    integrationSlices: { VS0: 'passed' },
    regression: { failures: 0 },
  };
}

/** 실제 저장소의 지금 형편 — 통합 슬라이스가 아직 남아 있는 상태. */
export function slicePendingMeasurement(spec: ContractSpec): EvidenceMeasurementRecord {
  return { ...fullPassMeasurement(spec), integrationSlices: { VS0: 'pending' } };
}

export function chainState(
  measurement: (spec: ContractSpec) => EvidenceMeasurementRecord,
  specs: readonly ContractSpec[] = CHAIN,
): JsonObject {
  const contracts: JsonObject = {};
  const measurements: JsonObject = {};
  for (const spec of specs) {
    contracts[spec.id] = contractText(spec);
    measurements[spec.id] = measurement(spec) as unknown as JsonValue;
  }
  return { contracts, measurements, evidences: {}, audit: null };
}

/** `issue_evidence` 를 위상 순서대로 부르는 단계 목록. */
export function issueAll(specs: readonly ContractSpec[] = CHAIN): { step: string; params: JsonObject }[] {
  return specs.map((spec) => ({ step: 'issue_evidence', params: { moduleId: spec.id } }));
}
