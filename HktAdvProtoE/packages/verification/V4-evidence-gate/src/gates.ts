import { STATUS_LADDER, type VerificationStatus } from './status.js';

/**
 * 공통 완료 게이트 (원문 「5. 공통 완료 게이트」).
 *
 * 각 게이트는 **측정값 하나**만 본다. 게이트가 무엇을 보는지 여기서 다 드러나야, 상태가 어떻게
 * 정해졌는지를 나중에 되짚을 수 있다.
 */

export const GATE_IDS = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'] as const;
export type GateId = (typeof GATE_IDS)[number];

export const GATE_NAMES: Readonly<Record<GateId, string>> = {
  G0: '목적 게이트',
  G1: '계약 게이트',
  G2: '단위 게이트',
  G3: '속성 게이트',
  G4: '직관 게이트',
  G5: '결정성 게이트',
  G6: '통합 게이트',
  G7: '회귀 게이트',
  G8: '증거 게이트',
};

/** 게이트가 보는 측정값. 자연어 보고는 여기 들어올 수 없다 (원문 「21」). */
export interface Measurements {
  /** MODULE.yaml 의 purpose */
  purpose: string;
  /** MODULE.yaml 이 선언한 것들 */
  contract: {
    inputs: readonly string[];
    outputs: readonly string[];
    ownsState: readonly string[];
    invariants: readonly string[];
    scenarios: readonly string[];
  };
  staticCheck: { passed: boolean };
  unitTests: { passed: number; failed: number };
  propertyTests: { seeds: number; invariantViolations: number };
  integrationTests?: { passed: number; failed: number };
  /** 계약이 선언한 장면별 판정 */
  labScenarios: Readonly<Record<string, string>>;
  replay: { runs: number; uniqueHashes: number };
  integrationSlices: Readonly<Record<string, string>>;
  /** 저장소 전체 회귀 — 측정하지 않았으면 생략한다 */
  regression?: { failures: number };
  hashes: { sourceHash: string; contractHash: string };
}

export interface GateResult {
  id: GateId;
  name: string;
  /** 이 게이트를 판정할 측정값이 있었는가. 없으면 통과로 치지 않는다. */
  measured: boolean;
  passed: boolean;
  detail: string;
}

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** 원문 「5」의 아홉 게이트를 순서대로 판정한다. */
export function evaluateGates(measurements: Measurements): GateResult[] {
  const gate = (id: GateId, measured: boolean, passed: boolean, detail: string): GateResult => ({
    id,
    name: GATE_NAMES[id],
    measured,
    passed: measured && passed,
    detail,
  });

  const { contract } = measurements;
  const purpose = measurements.purpose.trim();
  // "목적을 한 문장으로 설명할 수 있음" — 문장이 둘 이상이면 아직 더 쪼갤 수 있다는 뜻이다 (원문 「2.1」).
  const sentences = purpose.split(/[.。]\s+/).filter((part) => part.trim() !== '').length;

  const declaredScenarios = Object.keys(measurements.labScenarios).sort();
  const contractScenarios = [...contract.scenarios].sort();
  const scenariosMatch =
    contractScenarios.length > 0 && JSON.stringify(declaredScenarios) === JSON.stringify(contractScenarios);
  const failedScenarios = Object.entries(measurements.labScenarios)
    .filter(([, verdict]) => verdict !== 'passed')
    .map(([id, verdict]) => `${id}=${verdict}`);

  const slices = Object.entries(measurements.integrationSlices);
  const unpassedSlices = slices.filter(([, verdict]) => verdict !== 'passed').map(([id]) => id);

  return [
    gate('G0', purpose !== '', purpose !== '' && sentences <= 1, `목적 ${sentences}문장`),
    // 상태 소유권은 `none` 도 정당한 선언이므로 개수를 세지 않는다 —
    // 필드 자체의 존재는 V0 이 등록 시점에 이미 강제한다(결손이면 등록 거부).
    gate(
      'G1',
      true,
      contract.inputs.length > 0 && contract.outputs.length > 0 && contract.invariants.length > 0,
      `입력 ${contract.inputs.length} · 출력 ${contract.outputs.length} · 소유 상태 ${contract.ownsState.length > 0 ? contract.ownsState.join(', ') : 'none'} · 불변조건 ${contract.invariants.length}`,
    ),
    gate(
      'G2',
      true,
      measurements.unitTests.passed > 0 && measurements.unitTests.failed === 0,
      `단위 ${measurements.unitTests.passed}통과/${measurements.unitTests.failed}실패`,
    ),
    gate(
      'G3',
      true,
      measurements.propertyTests.seeds > 0 && measurements.propertyTests.invariantViolations === 0,
      `표본 ${measurements.propertyTests.seeds} · 위반 ${measurements.propertyTests.invariantViolations}`,
    ),
    gate(
      'G4',
      declaredScenarios.length > 0,
      scenariosMatch && failedScenarios.length === 0,
      scenariosMatch
        ? `장면 ${declaredScenarios.length}개${failedScenarios.length > 0 ? ` · 실패 ${failedScenarios.join(', ')}` : ''}`
        : `계약의 장면 [${contractScenarios.join(', ')}] 과 판정된 장면 [${declaredScenarios.join(', ')}] 이 다르다`,
    ),
    gate(
      'G5',
      measurements.replay.runs > 0,
      measurements.replay.uniqueHashes === 1,
      `${measurements.replay.runs}회 재실행 · 해시 ${measurements.replay.uniqueHashes}종`,
    ),
    gate(
      'G6',
      slices.length > 0,
      unpassedSlices.length === 0,
      slices.length === 0
        ? '지정된 수직 통합 시나리오 기록이 없다'
        : `슬라이스 ${slices.length}개${unpassedSlices.length > 0 ? ` · 미통과 ${unpassedSlices.join(', ')}` : ''}`,
    ),
    gate(
      'G7',
      measurements.regression !== undefined,
      (measurements.regression?.failures ?? 1) === 0,
      measurements.regression === undefined
        ? '회귀 측정 없음'
        : `기존 시나리오 실패 ${measurements.regression.failures}건`,
    ),
    gate(
      'G8',
      true,
      measurements.staticCheck.passed &&
        HASH_PATTERN.test(measurements.hashes.sourceHash) &&
        HASH_PATTERN.test(measurements.hashes.contractHash),
      `정적 검사 ${measurements.staticCheck.passed ? '통과' : '실패'} · 코드 해시 ${measurements.hashes.sourceHash.slice(0, 14)}…`,
    ),
  ];
}

/**
 * 게이트 판정에서 상태를 정한다 (원문 「4」의 사다리).
 *
 * 아래에서 위로 올라가다 막히는 곳에서 멈춘다. 어느 단계도 건너뛰지 않는다 —
 * 예컨대 통합 슬라이스(G6)를 통과하지 않으면 어떤 이유로도 `VERIFIED` 가 나오지 않는다(원문 「23」).
 */
export function deriveStatus(gates: readonly GateResult[], scenariosDeclared: boolean): VerificationStatus {
  const passed = (id: GateId): boolean => gates.find((gate) => gate.id === id)?.passed === true;

  if (!passed('G0') || !passed('G1')) return 'BLOCKED';
  if (!scenariosDeclared) return 'SPECIFIED';
  if (!passed('G8')) return 'TEST_READY';
  if (!passed('G2') || !passed('G3')) return 'IMPLEMENTED';
  if (!passed('G4')) return 'UNIT_PASS';
  if (!passed('G6')) return 'LAB_PASS';
  if (!passed('G5') || !passed('G7')) return 'SLICE_PASS';
  return 'VERIFIED';
}

/** 어느 게이트가 상태를 막고 있는지 — 화면과 보고에 그대로 쓴다. */
export function blockingGates(gates: readonly GateResult[]): GateResult[] {
  return gates.filter((gate) => !gate.passed);
}

/** 사다리 설명 — Lab 에서 상태가 왜 그 값인지 보여 줄 때 쓴다. */
export const LADDER_EXPLANATION: readonly { status: VerificationStatus; requires: string }[] =
  STATUS_LADDER.map((status) => {
    switch (status) {
      case 'BLOCKED':
        return { status, requires: '계약(G0·G1)이 서지 않았거나 선행이 무효화되었다' };
      case 'SPECIFIED':
        return { status, requires: 'G0 목적 · G1 계약' };
      case 'TEST_READY':
        return { status, requires: '+ 계약에 대표 장면 선언' };
      case 'IMPLEMENTED':
        return { status, requires: '+ G8 정적 검사·해시' };
      case 'UNIT_PASS':
        return { status, requires: '+ G2 단위 · G3 속성' };
      case 'LAB_PASS':
        return { status, requires: '+ G4 직관 (브라우저 대표 장면)' };
      case 'SLICE_PASS':
        return { status, requires: '+ G6 통합 (수직 슬라이스 전부 통과)' };
      case 'VERIFIED':
        return { status, requires: '+ G5 결정성 · G7 회귀' };
      default:
        return { status, requires: '후속 모듈이 의존 중인 안정 계약 — 사람이 정한다' };
    }
  });
