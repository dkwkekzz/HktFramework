import type { VerificationIssue } from './contract.js';

/** MODULE.yaml 문서 하나 — 파일 시스템 접근 없이 넘기기 위해 경로와 본문만 담는다. */
export interface ModuleContractDocument {
  /** 저장소 기준 상대 경로. 오류 보고의 앞머리로 쓴다. */
  path: string;
  /** MODULE.yaml 원문 */
  text: string;
}

/** 파싱·검증을 통과한 모듈 계약. */
export interface ModuleContract {
  id: string;
  name: string;
  purpose: string;
  /** `none` 선언은 빈 배열로 정규화한다. */
  dependsOn: readonly string[];
  ownsState: readonly string[];
  inputs: readonly string[];
  outputs: readonly string[];
  invariants: readonly string[];
  scenarios: readonly string[];
  commands: ModuleCommands;
  sourcePath: string;
}

export interface ModuleCommands {
  test: string;
  lab: string;
  verify: string;
}

/** 모듈 레지스트리 — V0 이 소유하는 유일한 상태. */
export interface ModuleRegistry {
  /** id 오름차순으로 고정한 등록 모듈 목록. */
  readonly modules: readonly ModuleContract[];
  /** 위상 정렬 순서. 동순위는 id 오름차순으로 깨서 결정적으로 만든다. */
  readonly order: readonly string[];
  /** id → 그 모듈을 선행으로 삼는 모듈들(id 오름차순). 계약 변경 시 무효화 연쇄의 입력이다. */
  readonly dependents: Readonly<Record<string, readonly string[]>>;
  /** 정규화 JSON 의 sha256. 같은 문서 집합이면 순서와 무관하게 같다. */
  readonly hash: string;
}

/** 등록 보고 — 원문 V0 의 출력 `registration_report`. */
export interface RegistrationReport {
  registry: ModuleRegistry;
  /** 등록된 모듈 id (오름차순) */
  registered: readonly string[];
  /** 거부된 문서 (경로 오름차순) */
  rejected: readonly RejectedDocument[];
  issues: readonly VerificationIssue[];
}

export interface RejectedDocument {
  path: string;
  /** 파싱 단계에서 id 를 못 읽었으면 null */
  id: string | null;
  issues: readonly VerificationIssue[];
}

export const ISSUE = {
  YAML_PARSE: 'E_YAML_PARSE',
  NOT_A_MAP: 'E_NOT_A_MAP',
  MISSING_FIELD: 'E_MISSING_FIELD',
  EMPTY_PURPOSE: 'E_EMPTY_PURPOSE',
  ID_FORMAT: 'E_ID_FORMAT',
  NAME_FORMAT: 'E_NAME_FORMAT',
  LIST_TYPE: 'E_LIST_TYPE',
  NONE_MIXED: 'E_NONE_MIXED',
  COMMAND_TYPE: 'E_COMMAND_TYPE',
  PATH_ID_MISMATCH: 'E_PATH_ID_MISMATCH',
  DUPLICATE_ID: 'E_DUPLICATE_ID',
  SELF_DEPENDENCY: 'E_SELF_DEPENDENCY',
  UNKNOWN_DEPENDENCY: 'E_UNKNOWN_DEPENDENCY',
  DEPENDENCY_CYCLE: 'E_DEPENDENCY_CYCLE',
  DEPENDENCY_REJECTED: 'E_DEPENDENCY_REJECTED',
} as const;

export type IssueCode = (typeof ISSUE)[keyof typeof ISSUE];
