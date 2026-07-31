import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PredicateSpec } from '@hkt/k1-predicate-query';
import type { EffectSpec, RuleSpec } from '@hkt/k2-rule-transaction';
import { NATURAL_COMPONENT } from '@hkt/s1-natural-state';
import {
  executeU0,
  rankNeeds,
  CAPABILITY_PREFIX,
  SUBJECT_COMPONENT,
  SUBJECT_LAWS,
  SUBJECT_LAW_IDS,
  SUBJECT_NEEDS,
  SUBJECT_VERB,
  TEMPERAMENT,
  type SubjectView,
} from '../../src/index.js';
import { COMPONENT_DEFINITIONS, LAYOUT, TWO_PEOPLE, WORLD_SEED } from '../../scenarios/fixtures.js';

// ---------------------------------------------------------------------------
// 법칙집을 기계적으로 훑는 도구 — 사람이 세면 빠뜨린다.
// ---------------------------------------------------------------------------

function pathsOf(predicate: PredicateSpec | undefined, out: Set<string> = new Set()): Set<string> {
  if (!predicate) return out;
  switch (predicate.op) {
    case 'eq':
    case 'gt':
    case 'lt':
      out.add(predicate.path);
      break;
    case 'has_tag':
      out.add(`${predicate.target}.tags:${predicate.tag}`);
      break;
    case 'within_distance':
      out.add(predicate.a);
      out.add(predicate.b);
      break;
    case 'and':
    case 'or':
      for (const item of predicate.items) pathsOf(item, out);
      break;
    case 'not':
      pathsOf(predicate.item, out);
      break;
  }
  return out;
}

function writtenPathsOf(effects: readonly EffectSpec[], out: Set<string> = new Set()): Set<string> {
  for (const effect of effects) {
    switch (effect.op) {
      case 'add':
      case 'multiply':
      case 'set':
        out.add(effect.path);
        break;
      case 'transfer':
        out.add(effect.from);
        out.add(effect.to);
        break;
      case 'attach_tag':
      case 'remove_tag':
        out.add(`${effect.target}.tags:${effect.tag}`);
        break;
      default:
        break;
    }
  }
  return out;
}

const READ = new Set<string>();
const WRITTEN = new Set<string>();
for (const law of SUBJECT_LAWS) {
  for (const path of pathsOf(law.when)) READ.add(path);
  for (const path of pathsOf(law.requires)) READ.add(path);
  for (const path of writtenPathsOf(law.costs)) WRITTEN.add(path);
  for (const path of writtenPathsOf(law.effects)) WRITTEN.add(path);
}

const touches = (set: Set<string>, prefix: string): boolean =>
  [...set].some((path) => path.startsWith(prefix));

describe('법칙집의 모양', () => {
  it('id 가 유일하고 모두 u0_ 로 시작한다', () => {
    expect(SUBJECT_LAW_IDS.length).toBe(new Set(SUBJECT_LAW_IDS).size);
    expect(SUBJECT_LAW_IDS.every((id) => id.startsWith('u0_'))).toBe(true);
    expect(SUBJECT_LAW_IDS).toEqual([...SUBJECT_LAW_IDS].sort());
  });

  it('느끼는 일은 몸의 법칙(L1)이 허락하는 범위 안의 예외(L2)다', () => {
    const byScope = new Map(SUBJECT_LAWS.map((law) => [law.id, law.scope]));
    expect(byScope.get('u0_the_dead_do_not_feel')).toBe('L1');
    for (const law of SUBJECT_LAWS) {
      if (law.id === 'u0_the_dead_do_not_feel') continue;
      expect(law.scope, law.id).toBe('L2');
    }
  });

  it('세 동사마다 천장에 닿았을 때 고를 법칙이 남아 있다', () => {
    for (const verb of Object.values(SUBJECT_VERB)) {
      const forVerb = SUBJECT_LAWS.filter(
        (law) => JSON.stringify(law.when).includes(`"${verb}"`) && law.scope === 'L2',
      );
      expect(forVerb.length, verb).toBeGreaterThanOrEqual(3);
      // 조건 없이 맞는 법칙이 하나는 있어야 의도가 통째로 거부되지 않는다.
      expect(forVerb.some((law) => law.requires === undefined), verb).toBe(true);
    }
  });

  it('죽은 몸의 법칙은 제약 규칙이다 — 비용도 효과도 흔적도 없다', () => {
    const rule = SUBJECT_LAWS.find((law) => law.id === 'u0_the_dead_do_not_feel') as RuleSpec;
    expect(rule.costs).toEqual([]);
    expect(rule.effects).toEqual([]);
    expect(rule.emits).toEqual([]);
  });

  it('법칙은 데이터 AST 다 — 어디에도 함수가 없다', () => {
    expect(() => JSON.parse(JSON.stringify(SUBJECT_LAWS))).not.toThrow();
    expect(JSON.stringify(SUBJECT_LAWS)).not.toContain('function');
  });
});

/**
 * 원문 「11」 U0 의 「포함」 일곱 항목이 **아무 데도 쓰이지 않는 칸**으로 남지 않는지 센다.
 *
 * S 페이즈 감사(progress/11)가 찾아낸 구멍이 이것이었다 — 컴포넌트로 있기는 한데 아무 법칙도
 * 읽지 않는 상태. 다만 U0 에서는 기준이 조금 다르다. 가치와 성격은 **잘 변하지 않는 것**이고
 * 그것을 바꾸는 일은 R 페이즈(성장)의 몫이므로, 법칙이 쓰지 않는 것이 옳다. 그래서 두 갈래로 센다.
 *
 * | 항목 | 법칙이 읽는가 | 법칙이 쓰는가 | 우선순위를 바꾸는가 |
 * |---|---|---|---|
 * | 욕구 | ✓ | ✓ | ✓ N |
 * | 감정 | ✓ | ✓ | ✓ 온도 |
 * | 능력 | ✓ 태그 | — 성장은 R | ✓ 수단 표시 |
 * | 자원 | ✓ | — 교환은 I | ✓ 수단 표시 |
 * | 신체 연결 | ✓ 모든 감각 | — 몸은 세계의 것 | ✓ 욕구를 통해 |
 * | 가치 | — | — 성장은 R | ✓ V |
 * | 성격 | — | — 성장은 R | ✓ T · 온도 |
 */
describe('원문 「11」 U0 의 포함 일곱 항목', () => {
  it('욕구와 감정은 법칙이 읽고 또 쓴다', () => {
    for (const component of [SUBJECT_COMPONENT.NEEDS, SUBJECT_COMPONENT.EMOTIONS]) {
      expect(touches(READ, `actor.${component}.`), `${component} 읽기`).toBe(true);
      expect(touches(WRITTEN, `actor.${component}.`), `${component} 쓰기`).toBe(true);
    }
  });

  it('능력과 자원은 법칙이 읽는다 — 화면에만 나오는 장식이 아니다', () => {
    expect([...READ].some((path) => path.includes(`tags:${CAPABILITY_PREFIX}`))).toBe(true);
    expect(touches(READ, `actor.${SUBJECT_COMPONENT.RESOURCES}.`)).toBe(true);
  });

  it('신체 연결은 몸의 자연 상태를 읽는 유일한 통로다', () => {
    const bodyPaths = [...READ].filter((path) => path.startsWith('body.'));
    expect(bodyPaths.length).toBeGreaterThan(0);
    for (const path of bodyPaths) {
      const component = path.split('.')[1];
      expect(Object.values(NATURAL_COMPONENT), path).toContain(component);
    }
  });

  it('법칙은 가치도 성격도 쓰지 않는다 — 성장은 R 페이즈의 몫이다', () => {
    expect(touches(WRITTEN, `actor.${SUBJECT_COMPONENT.VALUES}.`)).toBe(false);
    expect(touches(WRITTEN, `actor.${SUBJECT_COMPONENT.TRAITS}.`)).toBe(false);
  });

  it('가치와 성격은 우선순위를 실제로 바꾼다', () => {
    const base: SubjectView = {
      id: 'x',
      kind: 'person',
      needs: { hunger: 5, duty: 5, safety: 5 },
      values: { duty: 0.9, survival: 0.1, temperance: 0.9 },
      traits: { patient: 0.9, impulsive: 0.1, cautious: 0.1 },
      emotions: { fear: 0, despair: 0 },
      capabilities: [],
      resources: {},
      bodyEntityIds: [],
    };
    const flipped: SubjectView = {
      ...base,
      values: { duty: 0.1, survival: 0.9, temperance: 0.1 },
      traits: { patient: 0.1, impulsive: 0.9, cautious: 0.1 },
    };
    const left = rankNeeds(base, SUBJECT_NEEDS, TEMPERAMENT).order;
    const right = rankNeeds(flipped, SUBJECT_NEEDS, TEMPERAMENT).order;
    expect(left).not.toEqual(right);
  });

  it('일곱 항목을 하나씩 흔들면 결과가 달라진다', async () => {
    // 장면 `nothing_in_the_subject_is_decoration` 과 같은 검사를 테스트에서도 돌린다 —
    // 장면은 사람이 보는 자리이고, 여기는 회귀가 걸리는 자리다.
    const { SUBJECT_PARTS } = await import('../../scenarios/index.js');
    const run = (operations: typeof TWO_PEOPLE) =>
      executeU0({
        world: { components: COMPONENT_DEFINITIONS, operations },
        layout: LAYOUT,
        worldSeed: WORLD_SEED,
        ticks: 4,
      }).digest;
    const baseline = run(TWO_PEOPLE);
    expect(SUBJECT_PARTS.length).toBe(7);
    for (const part of SUBJECT_PARTS) {
      expect(run(part.perturb(TWO_PEOPLE)), part.part).not.toBe(baseline);
    }
  });
});

/** 파일이 실제로 들여오는 모듈 이름 — 주석과 문장에 나오는 이름은 세지 않는다. */
function importsOf(file: string): string[] {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  return [...source.matchAll(/^\s*import[\s\S]*?from\s+'([^']+)'/gm)].map((match) => match[1] as string);
}

describe('GI-02 — 주체는 세계를 직접 읽지 않는다', () => {
  it('우선순위 계산 파일은 저장소를 아예 들여오지 않는다', () => {
    // 규약이 아니라 실물로 본다. 들여오지 못하면 훔쳐볼 수도 없다.
    expect(importsOf('../../src/rank.ts')).toEqual(['./types.js']);
  });

  it('주체의 상태를 읽는 자리는 subject.ts 하나다', () => {
    const readers = ['../../src/rank.ts', '../../src/needs.ts', '../../src/laws.ts', '../../src/subject.ts']
      .filter((file) => importsOf(file).includes('@hkt/k0-entity-state'));
    expect(readers).toEqual(['../../src/subject.ts']);
  });
});
