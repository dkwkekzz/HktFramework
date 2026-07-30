import { describe, expect, it } from 'vitest';
import { createK2Module, executeK2, validateInput, validateOutput } from '../../src/module.js';
import { k2Scenarios } from '../../scenarios/index.js';
import { CANYON, COMPONENT_DEFINITIONS, RULES } from '../../scenarios/fixtures.js';
import ruleSchema from '../../schemas/k2-rule.schema.json';
import effectSchema from '../../schemas/k2-effect.schema.json';

const input = {
  world: { components: COMPONENT_DEFINITIONS, operations: CANYON },
  rules: RULES,
  intents: [
    { id: 'a', actor: 'hunter_a', verb: 'strike', targets: ['beast_ka'] },
    { id: 'b', actor: 'hunter_a', verb: 'dance' },
  ],
};

describe('executeK2', () => {
  it('의도를 차례로 처리하고 세계 해시를 따라 적는다', () => {
    const output = executeK2(input);
    expect(output.outcomes.map((outcome) => outcome.ok)).toEqual([true, false]);
    expect(output.hashes.map((hash) => hash.changed)).toEqual([true, false]);
    expect(output.worldHashBefore).not.toBe(output.worldHashAfter);
  });

  it('같은 입력이면 같은 digest 다', () => {
    expect(executeK2(input).digest).toBe(executeK2(input).digest);
  });

  it('의도가 없으면 세계가 그대로다', () => {
    const output = executeK2({ ...input, intents: [] });
    expect(output.worldHashBefore).toBe(output.worldHashAfter);
  });
});

describe('validateInput', () => {
  it('world·rules·intents 를 요구한다', () => {
    expect(() => validateInput({})).toThrow(/world/);
    expect(() => validateInput({ world: { operations: [] } })).toThrow(/rules/);
    expect(() => validateInput({ world: { operations: [] }, rules: [] })).toThrow(/intents/);
  });

  it('의도는 id·actor·verb 를 가져야 한다', () => {
    expect(() => validateInput({ world: { operations: [] }, rules: [], intents: [{ id: 'a' }] })).toThrow(
      /actor/,
    );
  });
});

describe('validateOutput', () => {
  it('정상 출력에는 위반이 없다', () => {
    expect(validateOutput(executeK2(input))).toEqual([]);
  });

  it('실패인데 비용이 적용되었으면 잡는다', () => {
    const output = executeK2(input);
    const failed = output.outcomes[1] as (typeof output.outcomes)[number];
    const forged: typeof output = {
      ...output,
      outcomes: [
        output.outcomes[0] as (typeof output.outcomes)[number],
        { ...failed, costDelta: [{ path: 'entity/x/components/energy/current', op: 'add', before: 1, after: 0 }] },
      ],
    };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_rejected_intent_must_not_apply_costs_or_effects',
    );
  });

  it('델타가 비었는데 세계가 바뀌면 잡는다 (GI-01)', () => {
    const output = executeK2(input);
    const forged: typeof output = {
      ...output,
      hashes: output.hashes.map((hash, index) => (index === 1 ? { ...hash, changed: true } : hash)),
    };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_failure_effect_must_be_declared_by_the_matched_rule',
    );
  });

  it('규칙 검토 순서가 권위 순서가 아니면 잡는다', () => {
    const output = executeK2(input);
    const first = output.outcomes[0] as (typeof output.outcomes)[number];
    const forged: typeof output = {
      ...output,
      outcomes: [{ ...first, matches: [...first.matches].reverse() }, output.outcomes[1] as (typeof output.outcomes)[number]],
    };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_rule_matching_must_be_deterministic',
    );
  });

  it('델타가 비용+효과와 다르면 잡는다', () => {
    const output = executeK2(input);
    const first = output.outcomes[0] as (typeof output.outcomes)[number];
    const forged: typeof output = {
      ...output,
      outcomes: [{ ...first, delta: [] }, output.outcomes[1] as (typeof output.outcomes)[number]],
    };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_every_state_change_must_be_listed_in_the_delta',
    );
  });
});

describe('모듈 정의', () => {
  const module = createK2Module(k2Scenarios);

  it('원문 「3.2」의 형태를 갖춘다', () => {
    expect(module.id).toBe('K2');
    expect(module.dependencies).toEqual(['V0', 'K0', 'K1']);
    expect(module.purpose.split(/[.。]\s+/).filter((part) => part.trim() !== '').length).toBe(1);
  });
});

describe('스키마 문서', () => {
  /**
   * V1 로 실제 컴파일하는 일은 저장소 규약 검사가 모든 모듈에 대해 한다. K2 는 V1 을 선행으로
   * 두지 않으므로(원문 「9」), 여기서는 **스키마와 구현이 같은 연산자 집합을 말하는지**만 본다.
   */
  it('효과 스키마의 연산자 목록이 원본 15.3 과 같다', () => {
    expect((effectSchema.properties.op.enum as string[]).slice().sort()).toEqual([
      'add',
      'attach_tag',
      'breach_commitment',
      'create_commitment',
      'multiply',
      'remove_tag',
      'schedule_event',
      'set',
      'transfer',
    ]);
  });

  it('규칙 스키마가 L0~L6 만 허용한다', () => {
    expect(ruleSchema.properties.scope.enum).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
  });

  it('규칙 스키마의 필수 항목이 원본 15.3 의 RuleSpec 과 같다', () => {
    expect(ruleSchema.required).toEqual(['id', 'scope', 'priority', 'when', 'costs', 'effects', 'emits', 'tags']);
  });

  it('무대의 모든 규칙이 스키마가 아는 필드만 쓴다', () => {
    const known = Object.keys(ruleSchema.properties);
    for (const rule of RULES) {
      expect(Object.keys(rule).every((key) => known.includes(key)), rule.id).toBe(true);
    }
  });
});
