import { describe, expect, it } from 'vitest';
import { parseModuleContract } from '../../src/parse.js';
import { ISSUE } from '../../src/types.js';
import { contract, makeContractYaml } from '../../scenarios/fixtures.js';

const codes = (issues: { code: string }[]): string[] => [...new Set(issues.map((i) => i.code))].sort();

describe('parseModuleContract — 정상', () => {
  it('규약을 지킨 문서는 계약으로 정규화된다', () => {
    const result = parseModuleContract(
      contract('I1', 'social-strategy', 'interaction', {
        purpose: '주체가 요청·거래·협박·기만 중 하나를 선택하게 한다.',
        depends_on: ['U0', 'U2', 'G3'],
        owns_state: ['none'],
      }),
    );
    expect(result.issues).toEqual([]);
    expect(result.contract).not.toBeNull();
    expect(result.contract?.id).toBe('I1');
    expect(result.contract?.dependsOn).toEqual(['U0', 'U2', 'G3']);
    // `none` 은 빈 배열로 정규화한다
    expect(result.contract?.ownsState).toEqual([]);
    expect(result.contract?.commands.verify).toBe('pnpm verify fixture');
  });

  it('purpose 의 블록 스칼라는 공백이 정리된다', () => {
    const result = parseModuleContract(contract('V0', 'module-contract', 'verification'));
    expect(result.contract?.purpose).toBe('검증용 계약 문서다.');
  });
});

describe('parseModuleContract — 결손·형식 오류', () => {
  it('purpose 누락은 등록 실패이며 경로를 지목한다', () => {
    const result = parseModuleContract(
      contract('V0', 'module-contract', 'verification', { purpose: undefined }),
    );
    expect(result.contract).toBeNull();
    expect(codes(result.issues)).toEqual([ISSUE.MISSING_FIELD]);
    expect(result.issues[0]?.path).toBe(
      'packages/verification/V0-module-contract/MODULE.yaml#/purpose',
    );
  });

  it('purpose 가 공백뿐이면 실패', () => {
    const result = parseModuleContract({
      path: 'packages/verification/V0-module-contract/MODULE.yaml',
      text: makeContractYaml({
        id: 'V0',
        name: 'module-contract',
        purpose: '   ',
        depends_on: ['none'],
        owns_state: ['none'],
        inputs: ['a'],
        outputs: ['b'],
        invariants: ['c'],
        scenarios: ['d'],
        commands: { test: 't', lab: 'l', verify: 'v' },
      }),
    });
    expect(codes(result.issues)).toEqual([ISSUE.EMPTY_PURPOSE]);
  });

  const requiredFields = [
    'depends_on',
    'owns_state',
    'inputs',
    'outputs',
    'invariants',
    'scenarios',
    'commands',
  ] as const;

  it.each(requiredFields)('%s 누락은 등록 실패', (field) => {
    const result = parseModuleContract(
      contract('V0', 'module-contract', 'verification', { [field]: undefined }),
    );
    expect(result.contract).toBeNull();
    expect(codes(result.issues)).toContain(ISSUE.MISSING_FIELD);
    expect(result.issues.some((i) => i.path.endsWith(`#/${field}`))).toBe(true);
  });

  it('id 형식 오류는 실패', () => {
    const result = parseModuleContract({
      path: 'packages/verification/v0-module-contract/MODULE.yaml',
      text: 'id: v0\nname: module-contract\n',
    });
    expect(codes(result.issues)).toContain(ISSUE.ID_FORMAT);
  });

  it('name 이 kebab-case 가 아니면 실패', () => {
    const broken = parseModuleContract({
      path: 'packages/verification/V0-ModuleContract/MODULE.yaml',
      text: makeContractYaml({
        id: 'V0',
        name: 'ModuleContract',
        purpose: '목적',
        depends_on: ['none'],
        owns_state: ['none'],
        inputs: ['a'],
        outputs: ['b'],
        invariants: ['c'],
        scenarios: ['d'],
        commands: { test: 't', lab: 'l', verify: 'v' },
      }),
    });
    expect(codes(broken.issues)).toContain(ISSUE.NAME_FORMAT);
  });

  it('none 을 다른 값과 섞으면 실패', () => {
    const result = parseModuleContract(
      contract('V1', 'schema', 'verification', { depends_on: ['none', 'V0'] }),
    );
    expect(codes(result.issues)).toContain(ISSUE.NONE_MIXED);
  });

  it('빈 목록은 실패', () => {
    const result = parseModuleContract({
      path: 'packages/verification/V0-module-contract/MODULE.yaml',
      text: 'id: V0\nname: module-contract\npurpose: 목적\ndepends_on: []\nowns_state:\n  - none\ninputs:\n  - a\noutputs:\n  - b\ninvariants:\n  - c\nscenarios:\n  - d\ncommands:\n  test: t\n  lab: l\n  verify: v\n',
    });
    expect(codes(result.issues)).toContain(ISSUE.LIST_TYPE);
  });

  it('YAML 이 깨지면 파싱 실패로 보고한다', () => {
    const result = parseModuleContract({
      path: 'packages/verification/V0-module-contract/MODULE.yaml',
      text: 'id: V0\n  bad indent: [',
    });
    expect(codes(result.issues)).toEqual([ISSUE.YAML_PARSE]);
    expect(result.contract).toBeNull();
  });

  it('최상위가 매핑이 아니면 실패', () => {
    const result = parseModuleContract({
      path: 'packages/verification/V0-module-contract/MODULE.yaml',
      text: '- just\n- a\n- list\n',
    });
    expect(codes(result.issues)).toEqual([ISSUE.NOT_A_MAP]);
  });

  it('디렉터리 이름과 id 가 어긋나면 실패', () => {
    const doc = contract('V1', 'schema', 'verification');
    const moved = { path: 'packages/verification/V2-schema/MODULE.yaml', text: doc.text };
    expect(codes(parseModuleContract(moved).issues)).toContain(ISSUE.PATH_ID_MISMATCH);
  });

  it('commands 하위 키가 비면 실패', () => {
    const result = parseModuleContract({
      path: 'packages/verification/V0-module-contract/MODULE.yaml',
      text: 'id: V0\nname: module-contract\npurpose: 목적\ndepends_on:\n  - none\nowns_state:\n  - none\ninputs:\n  - a\noutputs:\n  - b\ninvariants:\n  - c\nscenarios:\n  - d\ncommands:\n  test: t\n  lab: ""\n',
    });
    expect(codes(result.issues)).toContain(ISSUE.COMMAND_TYPE);
    expect(result.issues.filter((i) => i.code === ISSUE.COMMAND_TYPE).map((i) => i.path)).toEqual([
      'packages/verification/V0-module-contract/MODULE.yaml#/commands/lab',
      'packages/verification/V0-module-contract/MODULE.yaml#/commands/verify',
    ]);
  });
});
