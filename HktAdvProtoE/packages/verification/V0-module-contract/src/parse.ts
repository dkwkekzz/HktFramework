import { parse as parseYaml } from 'yaml';
import type { VerificationIssue } from './contract.js';
import { ISSUE, type ModuleContract, type ModuleContractDocument } from './types.js';

/** 문서 하나의 파싱 결과. 계약은 오류가 하나라도 있으면 만들지 않는다. */
export interface ParseResult {
  contract: ModuleContract | null;
  /** 오류가 있어도 id 를 읽을 수 있으면 보고에 쓴다. */
  id: string | null;
  issues: VerificationIssue[];
}

const ID_PATTERN = /^[A-Z][0-9]+$/;
const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const REQUIRED_LIST_FIELDS = [
  'depends_on',
  'owns_state',
  'inputs',
  'outputs',
  'invariants',
  'scenarios',
] as const;

/**
 * MODULE.yaml 한 건을 파싱하고 구조를 검증한다.
 *
 * 여기서 막는 것은 문서 자체의 결함뿐이다. 다른 모듈과의 관계(중복 id·미등록 선행·순환)는
 * buildRegistry 가 판정한다.
 */
export function parseModuleContract(doc: ModuleContractDocument): ParseResult {
  const issues: VerificationIssue[] = [];
  const at = (pointer: string): string => `${doc.path}#${pointer}`;

  let raw: unknown;
  try {
    raw = parseYaml(doc.text);
  } catch (error) {
    issues.push({
      code: ISSUE.YAML_PARSE,
      path: at('/'),
      message: `YAML 파싱 실패: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { contract: null, id: null, issues };
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push({
      code: ISSUE.NOT_A_MAP,
      path: at('/'),
      message: 'MODULE.yaml 최상위는 매핑이어야 한다.',
    });
    return { contract: null, id: null, issues };
  }

  const map = raw as Record<string, unknown>;

  // id
  let id: string | null = null;
  if (!('id' in map)) {
    issues.push({ code: ISSUE.MISSING_FIELD, path: at('/id'), message: '`id` 필드가 없다.' });
  } else if (typeof map['id'] !== 'string' || !ID_PATTERN.test(map['id'])) {
    issues.push({
      code: ISSUE.ID_FORMAT,
      path: at('/id'),
      message: `\`id\` 는 대문자 페이즈 + 숫자 형식이어야 한다 (예: V0). 실제: ${JSON.stringify(map['id'])}`,
    });
    if (typeof map['id'] === 'string') id = map['id'];
  } else {
    id = map['id'];
  }

  // name
  let name = '';
  if (!('name' in map)) {
    issues.push({ code: ISSUE.MISSING_FIELD, path: at('/name'), message: '`name` 필드가 없다.' });
  } else if (typeof map['name'] !== 'string' || !NAME_PATTERN.test(map['name'])) {
    issues.push({
      code: ISSUE.NAME_FORMAT,
      path: at('/name'),
      message: `\`name\` 은 kebab-case 여야 한다. 실제: ${JSON.stringify(map['name'])}`,
    });
  } else {
    name = map['name'];
  }

  // purpose — 원문 V0 의 대표 검증: 목적이 없는 모듈은 등록 실패
  let purpose = '';
  if (!('purpose' in map)) {
    issues.push({
      code: ISSUE.MISSING_FIELD,
      path: at('/purpose'),
      message: '`purpose` 필드가 없다. 목적 없는 모듈은 등록할 수 없다.',
    });
  } else if (typeof map['purpose'] !== 'string' || map['purpose'].trim() === '') {
    issues.push({
      code: ISSUE.EMPTY_PURPOSE,
      path: at('/purpose'),
      message: '`purpose` 는 비어 있을 수 없다.',
    });
  } else {
    purpose = map['purpose'].trim();
  }

  // 목록 필드 — 원문 V0 의 대표 검증: 선행 모듈 선언이 없는 모듈은 등록 실패
  const lists = new Map<string, string[]>();
  for (const field of REQUIRED_LIST_FIELDS) {
    const value = map[field];
    if (!(field in map)) {
      issues.push({
        code: ISSUE.MISSING_FIELD,
        path: at(`/${field}`),
        message:
          field === 'depends_on'
            ? '`depends_on` 필드가 없다. 선행이 없으면 `- none` 을 명시해야 한다.'
            : `\`${field}\` 필드가 없다.`,
      });
      continue;
    }
    if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === 'string')) {
      issues.push({
        code: ISSUE.LIST_TYPE,
        path: at(`/${field}`),
        message: `\`${field}\` 는 비어 있지 않은 문자열 목록이어야 한다.`,
      });
      continue;
    }
    const items = (value as string[]).map((v) => v.trim());
    if (items.includes('none') && items.length > 1) {
      issues.push({
        code: ISSUE.NONE_MIXED,
        path: at(`/${field}`),
        message: `\`${field}\` 에서 \`none\` 은 단독으로만 쓸 수 있다.`,
      });
      continue;
    }
    lists.set(field, items.includes('none') ? [] : items);
  }

  // commands
  const commands = { test: '', lab: '', verify: '' };
  if (!('commands' in map)) {
    issues.push({
      code: ISSUE.MISSING_FIELD,
      path: at('/commands'),
      message: '`commands` 필드가 없다.',
    });
  } else if (
    map['commands'] === null ||
    typeof map['commands'] !== 'object' ||
    Array.isArray(map['commands'])
  ) {
    issues.push({
      code: ISSUE.COMMAND_TYPE,
      path: at('/commands'),
      message: '`commands` 는 매핑이어야 한다.',
    });
  } else {
    const cmdMap = map['commands'] as Record<string, unknown>;
    for (const key of ['test', 'lab', 'verify'] as const) {
      const value = cmdMap[key];
      if (typeof value !== 'string' || value.trim() === '') {
        issues.push({
          code: ISSUE.COMMAND_TYPE,
          path: at(`/commands/${key}`),
          message: `\`commands.${key}\` 는 비어 있지 않은 문자열이어야 한다.`,
        });
        continue;
      }
      commands[key] = value.trim();
    }
  }

  // 경로와 id 의 정합 — packages/<group>/<ID>-<name>/MODULE.yaml 규약
  if (id !== null) {
    const dir = doc.path.split('/').at(-2) ?? '';
    if (dir !== '' && !dir.startsWith(`${id}-`)) {
      issues.push({
        code: ISSUE.PATH_ID_MISMATCH,
        path: at('/id'),
        message: `디렉터리 \`${dir}\` 가 id \`${id}\` 로 시작하지 않는다.`,
      });
    }
  }

  if (issues.length > 0 || id === null) {
    return { contract: null, id, issues };
  }

  return {
    contract: {
      id,
      name,
      purpose,
      dependsOn: lists.get('depends_on') ?? [],
      ownsState: lists.get('owns_state') ?? [],
      inputs: lists.get('inputs') ?? [],
      outputs: lists.get('outputs') ?? [],
      invariants: lists.get('invariants') ?? [],
      scenarios: lists.get('scenarios') ?? [],
      commands,
      sourcePath: doc.path,
    },
    id,
    issues,
  };
}
