// V0-b 계약 스키마 — 파싱된 YAML 을 ModuleContract 로 좁히고, 서식 위반을 사유로 돌려준다.
// 여기서 던지지 않는다. 결함 계약도 "왜 거부됐는가" 와 함께 레지스트리에 남아야 눈으로 보인다.

import type { YamlValue } from './yaml.ts';

/** 모듈 구현·검증 상태. */
export const MODULE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED'] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

/** 상태 원소 하나의 선언. */
export interface ContractElement {
  readonly name: string;
  /** O1 존재론 12타입 중 하나 (O1 구현 전까지는 문자열로 둔다) */
  readonly ontology: string;
  /** 공용 렌더러 5종 */
  readonly renderer: RendererKind;
}

export const RENDERER_KINDS = ['graph', 'gauge', 'timeline', 'diff', 'scene3d'] as const;
export type RendererKind = (typeof RENDERER_KINDS)[number];

/** 하위 작업 — 부모 모듈은 모든 하위 작업이 닫혀야 완료된다 (WORKFLOW §3). */
export interface ContractSubtask {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly status: 'PLANNED' | 'IN_PROGRESS' | 'DONE';
}

/** 모듈 계약 — MODULE-TEMPLATE.yaml 의 타입판. */
export interface ModuleContract {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly writes: readonly string[];
  readonly depends: readonly string[];
  readonly scenarios: readonly string[];
  readonly elements: readonly ContractElement[];
  readonly subtasks: readonly ContractSubtask[];
  readonly lab: string | null;
  readonly status: ModuleStatus;
  readonly evidence: string | null;
}

/** 계약이 거부된 이유 하나. */
export interface ContractViolation {
  /** 어느 계약인지 — id 를 못 읽었으면 파일명 */
  readonly module: string;
  /** 위반한 규칙 */
  readonly rule: ViolationRule;
  readonly message: string;
}

export type ViolationRule =
  | 'not-a-mapping' // 계약이 매핑이 아니다
  | 'missing-field' // 필수 필드 없음
  | 'bad-type' // 타입이 서식과 다르다
  | 'no-purpose' // 목적 없는 모듈 등록 불가
  | 'no-io' // 입출력 없는 처리 모듈 등록 불가
  | 'no-scenario' // 시나리오 없는 모듈 완료 불가
  | 'no-evidence' // 증거 없는 VERIFIED 불가
  | 'unknown-dependency' // 존재하지 않는 모듈에 의존
  | 'dependency-cycle' // 순환 의존 등록 불가
  | 'dependency-not-verified' // 미검증 모듈에 의존한 채 완료
  | 'open-subtask' // 하위 작업이 열려 있는데 완료
  | 'duplicate-id'; // 같은 ID 의 계약이 둘

interface Reader {
  readonly violations: ContractViolation[];
  readonly module: string;
}

function isMap(value: YamlValue): value is Record<string, YamlValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(
  reader: Reader,
  source: Record<string, YamlValue>,
  key: string,
  fallback = '',
): string {
  const value = source[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') {
    reader.violations.push({
      module: reader.module,
      rule: 'bad-type',
      message: `${key} 는 문자열이어야 한다 — ${JSON.stringify(value)}`,
    });
    return fallback;
  }
  return value;
}

function readStringList(
  reader: Reader,
  source: Record<string, YamlValue>,
  key: string,
): string[] {
  const value = source[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    reader.violations.push({
      module: reader.module,
      rule: 'bad-type',
      message: `${key} 는 목록이어야 한다 — ${JSON.stringify(value)}`,
    });
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      reader.violations.push({
        module: reader.module,
        rule: 'bad-type',
        message: `${key} 의 항목은 문자열이어야 한다 — ${JSON.stringify(item)}`,
      });
      continue;
    }
    out.push(item);
  }
  return out;
}

function readElements(
  reader: Reader,
  source: Record<string, YamlValue>,
): ContractElement[] {
  const value = source['elements'];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    reader.violations.push({
      module: reader.module,
      rule: 'bad-type',
      message: 'elements 는 목록이어야 한다',
    });
    return [];
  }
  const out: ContractElement[] = [];
  for (const item of value) {
    if (!isMap(item)) {
      reader.violations.push({
        module: reader.module,
        rule: 'bad-type',
        message: `elements 항목은 매핑이어야 한다 — ${JSON.stringify(item)}`,
      });
      continue;
    }
    const name = readString(reader, item, 'name');
    const ontology = readString(reader, item, 'ontology');
    const renderer = readString(reader, item, 'renderer');
    if (name === '') {
      reader.violations.push({
        module: reader.module,
        rule: 'missing-field',
        message: 'elements 항목에 name 이 없다',
      });
      continue;
    }
    if (!(RENDERER_KINDS as readonly string[]).includes(renderer)) {
      // 모든 상태 원소는 공용 렌더러 5종 중 하나로 보여야 한다 (WORKFLOW §6-2).
      reader.violations.push({
        module: reader.module,
        rule: 'bad-type',
        message: `${name} 의 renderer 가 공용 렌더러 5종이 아니다 — ${renderer || '(없음)'}`,
      });
      continue;
    }
    out.push({ name, ontology, renderer: renderer as RendererKind });
  }
  return out;
}

function readSubtasks(
  reader: Reader,
  source: Record<string, YamlValue>,
): ContractSubtask[] {
  const value = source['subtasks'];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    reader.violations.push({
      module: reader.module,
      rule: 'bad-type',
      message: 'subtasks 는 목록이어야 한다',
    });
    return [];
  }
  const out: ContractSubtask[] = [];
  for (const item of value) {
    if (!isMap(item)) {
      reader.violations.push({
        module: reader.module,
        rule: 'bad-type',
        message: `subtasks 항목은 매핑이어야 한다 — ${JSON.stringify(item)}`,
      });
      continue;
    }
    const status = readString(reader, item, 'status', 'PLANNED');
    if (status !== 'PLANNED' && status !== 'IN_PROGRESS' && status !== 'DONE') {
      reader.violations.push({
        module: reader.module,
        rule: 'bad-type',
        message: `하위 작업 status 는 PLANNED|IN_PROGRESS|DONE 이어야 한다 — ${status}`,
      });
      continue;
    }
    out.push({
      id: readString(reader, item, 'id'),
      name: readString(reader, item, 'name'),
      purpose: readString(reader, item, 'purpose'),
      status,
    });
  }
  return out;
}

/** 파싱된 값을 계약으로 좁힌다. 실패하면 contract 는 null 이고 사유가 담긴다. */
export function readContract(
  parsed: YamlValue,
  sourceName: string,
): { readonly contract: ModuleContract | null; readonly violations: readonly ContractViolation[] } {
  const violations: ContractViolation[] = [];
  if (!isMap(parsed)) {
    return {
      contract: null,
      violations: [
        { module: sourceName, rule: 'not-a-mapping', message: '계약은 매핑이어야 한다' },
      ],
    };
  }

  const id = typeof parsed['id'] === 'string' ? parsed['id'] : '';
  const reader: Reader = { violations, module: id === '' ? sourceName : id };

  if (id === '') {
    violations.push({
      module: sourceName,
      rule: 'missing-field',
      message: 'id 가 없다 — 계약을 식별할 수 없다',
    });
    return { contract: null, violations };
  }

  const status = readString(reader, parsed, 'status', 'PLANNED');
  if (!(MODULE_STATUSES as readonly string[]).includes(status)) {
    violations.push({
      module: id,
      rule: 'bad-type',
      message: `status 는 ${MODULE_STATUSES.join('|')} 중 하나여야 한다 — ${status}`,
    });
    return { contract: null, violations };
  }

  const contract: ModuleContract = {
    id,
    name: readString(reader, parsed, 'name'),
    purpose: readString(reader, parsed, 'purpose').trim(),
    inputs: readStringList(reader, parsed, 'inputs'),
    outputs: readStringList(reader, parsed, 'outputs'),
    writes: readStringList(reader, parsed, 'writes'),
    depends: readStringList(reader, parsed, 'depends'),
    scenarios: readStringList(reader, parsed, 'scenarios'),
    elements: readElements(reader, parsed),
    subtasks: readSubtasks(reader, parsed),
    lab: parsed['lab'] === undefined || parsed['lab'] === null ? null : readString(reader, parsed, 'lab'),
    status: status as ModuleStatus,
    evidence:
      parsed['evidence'] === undefined || parsed['evidence'] === null
        ? null
        : readString(reader, parsed, 'evidence'),
  };

  return { contract, violations };
}
