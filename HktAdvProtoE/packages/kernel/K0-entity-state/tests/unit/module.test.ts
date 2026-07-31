import { describe, expect, it } from 'vitest';
import { compileSchema } from '@hkt/v1-schema';
import { executeK0, validateInput, validateOutput } from '../../src/index.js';
import { createK0Module } from '../../src/module.js';
import { k0Scenarios } from '../../scenarios/index.js';
import { BORDER_CANYON, COMPONENT_DEFINITIONS } from '../../scenarios/fixtures.js';
import inputSchema from '../../schemas/k0-input.schema.json';
import snapshotSchema from '../../schemas/k0-component-snapshot.schema.json';
import entitySchema from '../../schemas/k0-entity-state.schema.json';

const base = { components: COMPONENT_DEFINITIONS, operations: BORDER_CANYON };

describe('executeK0', () => {
  it('연산을 차례로 적용하고 스냅샷을 낸다', () => {
    const output = executeK0(base);
    expect(output.applied).toBe(3);
    expect(output.rejected).toBe(0);
    expect(output.snapshot.entities.map((entity) => entity.id)).toEqual([
      'hunter_a',
      'hunter_b',
      'relic_organ',
    ]);
    expect(output.audit).toEqual([]);
  });

  it('거부는 그 연산에만 머문다', () => {
    const output = executeK0({
      ...base,
      operations: [...BORDER_CANYON, { op: 'despawn', id: 'ghost' }, { op: 'attach_tag', id: 'hunter_a', tag: 'wounded' }],
    });
    expect(output.applied).toBe(4);
    expect(output.rejected).toBe(1);
    expect(output.snapshot.entities.find((entity) => entity.id === 'hunter_a')?.tags).toContain('wounded');
  });

  it('같은 입력이면 같은 해시가 나온다', () => {
    expect(executeK0(base).snapshot.hash).toBe(executeK0(base).snapshot.hash);
  });

  it('reads 는 요청한 순서대로 돌아온다', () => {
    const output = executeK0({ ...base, operations: BORDER_CANYON, reads: ['relic_organ', 'ghost', 'hunter_a'] });
    expect(output.reads.map((entry) => entry.id)).toEqual(['relic_organ', 'ghost', 'hunter_a']);
    expect(output.reads[1]?.state).toBeNull();
  });
});

describe('validateInput', () => {
  it('객체가 아니면 거부한다', () => {
    expect(() => validateInput(null)).toThrow(TypeError);
    expect(() => validateInput([])).toThrow(TypeError);
  });

  it('operations 는 배열이어야 한다', () => {
    expect(() => validateInput({ operations: 'spawn' })).toThrow(/operations/);
    expect(() => validateInput({ operations: [null] })).toThrow(/객체/);
    expect(() => validateInput({ operations: [{}] })).toThrow(/op/);
  });

  it('reads 는 비어 있지 않은 문자열 배열이어야 한다', () => {
    expect(() => validateInput({ operations: [], reads: [''] })).toThrow(/reads/);
    expect(validateInput({ operations: [] })).toEqual({ operations: [] });
  });

  it('components 는 배열이어야 한다', () => {
    expect(() => validateInput({ operations: [], components: {} })).toThrow(/components/);
  });
});

describe('validateOutput', () => {
  it('정상 출력에는 위반이 없다', () => {
    expect(validateOutput(executeK0(base))).toEqual([]);
  });

  it('해시를 손으로 고치면 잡힌다', () => {
    const output = executeK0(base);
    const forged = { ...output, snapshot: { ...output.snapshot, hash: `sha256:${'0'.repeat(64)}` } };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_identical_store_must_produce_identical_hash',
    );
  });

  it('적용 여부와 거부 기록이 어긋나면 잡힌다', () => {
    const output = executeK0(base);
    const forged = {
      ...output,
      log: [{ index: 0, operation: BORDER_CANYON[0]!, applied: true, rejection: { code: 'X', path: 'y', message: 'z' } }],
    };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_rejected_operation_must_not_change_store',
    );
  });

  it('감사 결과를 그대로 물고 나온다', () => {
    const output = executeK0({
      ...base,
      operations: [...BORDER_CANYON, { op: 'set_component', id: 'relic_organ', type: 'ownership', data: { ownerId: 'nobody' } }],
    });
    expect(validateOutput(output).map((issue) => issue.code)).toContain(
      'E_INVARIANT_owned_entity_must_have_single_owner',
    );
  });
});

describe('모듈 정의', () => {
  const module = createK0Module(k0Scenarios);

  it('원문 「3.2」의 ModuleDefinition 형태를 갖춘다', () => {
    expect(module.id).toBe('K0');
    expect(module.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(module.dependencies).toEqual(['V0', 'V1']);
    expect(module.purpose.split(/[.。]\s+/).filter((part) => part.trim() !== '').length).toBe(1);
  });

  it('execute 가 executeK0 과 같은 결과를 낸다', () => {
    const context = { moduleId: 'K0', seed: 1n, tick: 0 };
    expect(module.execute(base, context).snapshot.hash).toBe(executeK0(base).snapshot.hash);
  });
});

describe('스키마 문서', () => {
  it('입력 스키마가 대표 입력을 통과시킨다', () => {
    const validator = compileSchema(inputSchema);
    const result = validator.validate(JSON.parse(JSON.stringify(base)));
    expect(result.issues).toEqual([]);
  });

  it('스냅샷 스키마가 실제 스냅샷을 통과시킨다', () => {
    const validator = compileSchema(snapshotSchema);
    const result = validator.validate(JSON.parse(JSON.stringify(executeK0(base).snapshot)));
    expect(result.issues).toEqual([]);
  });

  it('실체 스키마가 실제 실체를 통과시킨다', () => {
    const validator = compileSchema(entitySchema);
    const entity = executeK0(base).snapshot.entities[0];
    expect(validator.validate(JSON.parse(JSON.stringify(entity))).issues).toEqual([]);
  });

  it('실체 스키마가 대문자 id 를 거부한다', () => {
    const validator = compileSchema(entitySchema);
    const result = validator.validate({ id: 'HunterA', kind: 'person', tags: [], components: {} });
    expect(result.valid).toBe(false);
  });
});
