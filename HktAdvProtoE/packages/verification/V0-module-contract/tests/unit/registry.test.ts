import { describe, expect, it } from 'vitest';
import {
  buildRegistry,
  dependencyClosure,
  dependentClosure,
  topologicalOrder,
} from '../../src/registry.js';
import { validateInput, validateOutput } from '../../src/module.js';
import { ISSUE } from '../../src/types.js';
import { contract, healthySet } from '../../scenarios/fixtures.js';

const codesOf = (report: ReturnType<typeof buildRegistry>, pathFragment: string): string[] => {
  const rejection = report.rejected.find((r) => r.path.includes(pathFragment));
  return rejection ? [...new Set(rejection.issues.map((i) => i.code))].sort() : [];
};

describe('buildRegistry — 정상 등록', () => {
  it('선행이 앞에 오는 위상 순서로 등록된다', () => {
    const report = buildRegistry(healthySet());
    expect(report.registered).toEqual(['V0', 'V1', 'V2', 'V3']);
    expect(report.registry.order).toEqual(['V0', 'V1', 'V2', 'V3']);
    expect(report.rejected).toEqual([]);
    expect(report.issues).toEqual([]);
    expect(validateOutput(report)).toEqual([]);
  });

  it('dependents 는 역방향 간선을 id 오름차순으로 담는다', () => {
    const { registry } = buildRegistry(healthySet());
    expect(registry.dependents).toEqual({ V0: ['V1', 'V2'], V1: ['V3'], V2: ['V3'], V3: [] });
  });

  it('선행·후행 폐쇄를 계산한다 (계약 변경 시 무효화 대상)', () => {
    const { registry } = buildRegistry(healthySet());
    expect(dependencyClosure(registry, 'V3')).toEqual(['V0', 'V1', 'V2']);
    expect(dependentClosure(registry, 'V0')).toEqual(['V1', 'V2', 'V3']);
    expect(dependentClosure(registry, 'V3')).toEqual([]);
  });

  it('빈 입력은 빈 레지스트리를 만든다', () => {
    const report = buildRegistry([]);
    expect(report.registered).toEqual([]);
    expect(report.registry.order).toEqual([]);
    expect(report.registry.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('buildRegistry — 거부', () => {
  it('목적 없는 모듈은 거부되고 후행은 연쇄로 막힌다', () => {
    const documents = healthySet().map((doc) =>
      doc.path.includes('V1-schema')
        ? contract('V1', 'schema', 'verification', { depends_on: ['V0'], purpose: undefined })
        : doc,
    );
    const report = buildRegistry(documents);
    expect(report.registered).toEqual(['V0', 'V2']);
    expect(codesOf(report, 'V1-schema')).toEqual([ISSUE.MISSING_FIELD]);
    expect(codesOf(report, 'V3-scenario-runner')).toEqual([ISSUE.DEPENDENCY_REJECTED]);
  });

  it('미등록 선행 참조는 UNKNOWN_DEPENDENCY', () => {
    const report = buildRegistry([
      ...healthySet(),
      contract('V4', 'evidence-gate', 'verification', { depends_on: ['V9'] }),
    ]);
    expect(report.registered).toEqual(['V0', 'V1', 'V2', 'V3']);
    expect(codesOf(report, 'V4-evidence-gate')).toEqual([ISSUE.UNKNOWN_DEPENDENCY]);
  });

  it('id 중복은 양쪽 모두 거부한다', () => {
    const report = buildRegistry([
      contract('V0', 'module-contract', 'verification'),
      { ...contract('V0', 'module-contract', 'kernel') },
    ]);
    expect(report.registered).toEqual([]);
    expect(report.rejected).toHaveLength(2);
    expect(report.rejected.every((r) => r.issues.some((i) => i.code === ISSUE.DUPLICATE_ID))).toBe(
      true,
    );
  });

  it('자기 참조는 거부한다', () => {
    const report = buildRegistry([
      contract('V0', 'module-contract', 'verification', { depends_on: ['V0'] }),
    ]);
    expect(report.registered).toEqual([]);
    expect(codesOf(report, 'V0-module-contract')).toEqual([ISSUE.SELF_DEPENDENCY]);
  });

  it('순환은 참여 모듈 전부를 거부하고 경로를 보고한다', () => {
    const report = buildRegistry([
      contract('V0', 'module-contract', 'verification'),
      contract('K1', 'predicate-query', 'kernel', { depends_on: ['V0', 'K2'] }),
      contract('K2', 'rule-transaction', 'kernel', { depends_on: ['K1'] }),
    ]);
    expect(report.registered).toEqual(['V0']);
    expect(codesOf(report, 'K1-predicate-query')).toEqual([ISSUE.DEPENDENCY_CYCLE]);
    expect(codesOf(report, 'K2-rule-transaction')).toEqual([ISSUE.DEPENDENCY_CYCLE]);
    expect(
      report.issues.filter((i) => i.code === ISSUE.DEPENDENCY_CYCLE).map((i) => i.message),
    ).toEqual([
      expect.stringContaining('K1 → K2 → K1'),
      expect.stringContaining('K2 → K1 → K2'),
    ]);
    expect(validateOutput(report)).toEqual([]);
  });

  it('순환 바깥에서 순환을 참조하는 모듈도 막힌다', () => {
    const report = buildRegistry([
      contract('K1', 'predicate-query', 'kernel', { depends_on: ['K2'] }),
      contract('K2', 'rule-transaction', 'kernel', { depends_on: ['K1'] }),
      contract('K3', 'event-replay', 'kernel', { depends_on: ['K2'] }),
    ]);
    expect(report.registered).toEqual([]);
    expect(codesOf(report, 'K3-event-replay')).toEqual([ISSUE.DEPENDENCY_REJECTED]);
  });

  it('거부된 문서는 레지스트리 해시에 영향을 주지 않는다', () => {
    const healthy = buildRegistry(healthySet());
    const withBroken = buildRegistry([
      ...healthySet(),
      contract('K0', 'entity-state', 'kernel', { purpose: undefined }),
    ]);
    expect(withBroken.registry.hash).toBe(healthy.registry.hash);
  });
});

describe('buildRegistry — 결정성', () => {
  it('문서 순서를 뒤집어도 결과가 같다', () => {
    const forward = buildRegistry(healthySet());
    const backward = buildRegistry([...healthySet()].reverse());
    expect(backward.registry.hash).toBe(forward.registry.hash);
    expect(backward.registry.order).toEqual(forward.registry.order);
    expect(backward.registered).toEqual(forward.registered);
  });

  it('같은 입력 100회 실행에서 해시가 하나다', () => {
    const hashes = new Set(
      Array.from({ length: 100 }, () => buildRegistry(healthySet()).registry.hash),
    );
    expect(hashes.size).toBe(1);
  });

  it('내용이 한 글자만 달라도 해시가 달라진다', () => {
    const base = buildRegistry(healthySet()).registry.hash;
    const changed = buildRegistry(
      healthySet().map((doc) =>
        doc.path.includes('V2-determinism')
          ? contract('V2', 'determinism', 'verification', {
              depends_on: ['V0'],
              purpose: '시간·ID·무작위성을 결정적으로 만든다!',
            })
          : doc,
      ),
    ).registry.hash;
    expect(changed).not.toBe(base);
  });
});

describe('topologicalOrder', () => {
  it('동순위는 id 오름차순으로 깬다', () => {
    const modules = new Map(
      buildRegistry([
        contract('K0', 'entity-state', 'kernel'),
        contract('V0', 'module-contract', 'verification'),
        contract('S0', 'spatial-affordance', 'world-state'),
      ]).registry.modules.map((m) => [m.id, m]),
    );
    expect(topologicalOrder(modules).order).toEqual(['K0', 'S0', 'V0']);
  });
});

describe('validateInput', () => {
  it('올바른 입력은 통과한다', () => {
    expect(validateInput({ documents: healthySet() }).documents).toHaveLength(4);
  });

  const badInputs: [label: string, input: unknown][] = [
    ['객체가 아님', null],
    ['배열', []],
    ['documents 없음', {}],
    ['documents 가 배열 아님', { documents: {} }],
    ['빈 path', { documents: [{ path: '', text: 'x' }] }],
    ['text 가 문자열 아님', { documents: [{ path: 'a', text: 1 }] }],
  ];

  it.each(badInputs)('잘못된 입력은 거부한다 (%s)', (_label, input) => {
    expect(() => validateInput(input)).toThrow(TypeError);
  });
});
