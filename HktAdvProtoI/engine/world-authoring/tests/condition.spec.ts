// C035 — 조건은 하나의 형이다: 평가기(condition.ts)와 검사 ㊹(check.ts 의 condition-refs).
//
// 이 파일은 **게임을 모른다** — 방도 원천도 경로도 여기서 지어 준다 (`A` · `S1` · `R1` · `season`).
// 평가기가 이름 없이 산수만으로 답하는가, 자리만인 것과 읽을 수 없는 것이 거짓으로 눌리지 않는가,
// qualifier 가 호출자의 입력 없이는 판정하지 않는가 — 그것이 형의 규율이고 그것을 재는 자리가 여기다.
//
// ㊹ 은 어휘를 컨텐츠가 건넨다는 것 자체를 잰다 — 유령 ref · 없는 속성 · 어긋난 qualifier 가 fail 이고
// 계약을 주지 않으면 absent 다 (㊸ 의 어법 그대로).

import { describe, expect, it } from 'vitest';
import {
  checkRegions,
  type CheckCondition,
  type CheckContract,
  type CheckRegion,
} from '../check';
import {
  conditionLeaves,
  DECIDABLE_QUERY_KINDS,
  DECIDABLE_TARGET_KINDS,
  DEFERRED_QUERY_KINDS,
  DEFERRED_TARGET_KINDS,
  evaluateCondition,
  formatConditionLeaf,
  REF_OPTIONAL_TARGET_KINDS,
  SINGLETON_TARGET_KINDS,
  UNREADABLE,
  type Condition,
  type ConditionLeaf,
  type ConditionRead,
  type ConditionValue,
} from '../condition';
import type { RegionDescription } from '../description';
import type { Connector, RegionGraph } from '../graph';

// ── 평가기 ──────────────────────────────────────────────────────────

/** 잎 하나 — 기본은 방 A 의 property 다 */
function leaf(partial: Partial<ConditionLeaf> = {}): ConditionLeaf {
  return {
    target: { kind: 'region', ref: 'A' },
    query: { kind: 'property', path: 'p' },
    operator: '==',
    value: 1,
    ...partial,
  };
}

/** 값 하나를 되돌려 주는 read — 나머지는 주지 않는다 */
function reading(
  value: ConditionValue | undefined | typeof UNREADABLE,
  extra: Partial<ConditionRead> = {},
): ConditionRead {
  return { value: () => value, ...extra };
}

const met = (condition: Condition, read: ConditionRead) => evaluateCondition(condition, read);

describe('evaluateCondition — 잎의 operator', () => {
  it('== · != 는 수 · 문자열 · 참거짓 전부에 걸린다', () => {
    expect(met(leaf({ operator: '==', value: 1 }), reading(1))).toBe('met');
    expect(met(leaf({ operator: '==', value: 1 }), reading(2))).toBe('unmet');
    expect(met(leaf({ operator: '!=', value: 's' }), reading('t'))).toBe('met');
    expect(met(leaf({ operator: '!=', value: 's' }), reading('s'))).toBe('unmet');
    expect(met(leaf({ operator: '==', value: true }), reading(true))).toBe('met');
    expect(met(leaf({ operator: '==', value: false }), reading(true))).toBe('unmet');
  });

  it('> >= < <= 는 수를 견준다', () => {
    expect(met(leaf({ operator: '>', value: 3 }), reading(4))).toBe('met');
    expect(met(leaf({ operator: '>', value: 3 }), reading(3))).toBe('unmet');
    expect(met(leaf({ operator: '>=', value: 3 }), reading(3))).toBe('met');
    expect(met(leaf({ operator: '<', value: 3 }), reading(2))).toBe('met');
    expect(met(leaf({ operator: '<', value: 3 }), reading(3))).toBe('unmet');
    expect(met(leaf({ operator: '<=', value: 3 }), reading(3))).toBe('met');
    expect(met(leaf({ operator: '<=', value: 3 }), reading(4))).toBe('unmet');
  });

  it('문자열 · 참거짓에 크기 비교를 걸면 판정 불가다', () => {
    expect(met(leaf({ operator: '>', value: 'b' }), reading('a'))).toBe('undecidable');
    expect(met(leaf({ operator: '<=', value: true }), reading(false))).toBe('undecidable');
  });

  it('형이 어긋나면 판정 불가다 — 수 대 문자열 · 스칼라 자리에 목록', () => {
    expect(met(leaf({ operator: '==', value: 1 }), reading('1'))).toBe('undecidable');
    expect(met(leaf({ operator: '==', value: [1] }), reading(1))).toBe('undecidable');
    expect(met(leaf({ operator: '>', value: 1 }), reading([2]))).toBe('undecidable');
  });

  it('없는 값(undefined)은 비교의 거짓이다 — 판정 불가가 아니다', () => {
    expect(met(leaf({ operator: '==', value: 1 }), reading(undefined))).toBe('unmet');
    expect(met(leaf({ operator: 'IN', value: [1, 2] }), reading(undefined))).toBe('unmet');
  });

  it('IN 은 목록 value 에 지금 값이 있는가다 — value 가 목록이 아니면 판정 불가다', () => {
    expect(met(leaf({ operator: 'IN', value: ['s1', 's2'] }), reading('s2'))).toBe('met');
    expect(met(leaf({ operator: 'IN', value: ['s1', 's2'] }), reading('s3'))).toBe('unmet');
    expect(met(leaf({ operator: 'IN', value: 's1' }), reading('s1'))).toBe('undecidable');
    expect(met(leaf({ operator: 'IN', value: ['s1'] }), reading(['s1']))).toBe('undecidable');
  });

  it('EXISTS 는 없는 것(undefined)에 거짓이고 읽을 수 없는 것(UNREADABLE)에 판정 불가다', () => {
    const exists = leaf({ operator: 'EXISTS', value: undefined });
    expect(met(exists, reading(0))).toBe('met');
    expect(met(exists, reading(undefined))).toBe('unmet');
    expect(met(exists, reading(UNREADABLE))).toBe('undecidable');
    const absent = leaf({ operator: 'NOT_EXISTS', value: undefined });
    expect(met(absent, reading(undefined))).toBe('met');
    expect(met(absent, reading(0))).toBe('unmet');
    expect(met(absent, reading(UNREADABLE))).toBe('undecidable');
  });

  it('읽을 수 없는 것은 어느 operator 에서도 판정 불가다', () => {
    expect(met(leaf({ operator: '==', value: 1 }), reading(UNREADABLE))).toBe('undecidable');
  });
});

describe('evaluateCondition — 자리만인 것', () => {
  it('자리만인 Target 은 판정 불가다 — 값이 읽혀도', () => {
    for (const kind of ['player', 'faction'] as const) {
      expect(met(leaf({ target: { kind, ref: 'x' } }), reading(1))).toBe('undecidable');
    }
  });

  it('자리만인 Query 는 판정 불가다', () => {
    for (const kind of ['distance', 'contains', 'relation', 'knowledge'] as const) {
      expect(met(leaf({ query: { kind } }), reading(1))).toBe('undecidable');
    }
  });

  it('chance 를 밝히면 판정 불가다 — 0 이어도', () => {
    expect(met(leaf({ chance: 0 }), reading(1))).toBe('undecidable');
    expect(met(leaf({ chance: 0.5 }), reading(1))).toBe('undecidable');
  });

  it('자리만인 것은 read 를 부르지도 않는다', () => {
    let calls = 0;
    const read: ConditionRead = {
      value: () => {
        calls++;
        return 1;
      },
    };
    met(leaf({ target: { kind: 'player', ref: 'x' } }), read);
    expect(calls).toBe(0);
  });
});

// ── 행위자 갈래 ────────────────────────────────────────────────────
//
// actor Target 과 capability Query 가 자리만에서 빠졌다 — 값이 읽히면 판정되고, 읽는 쪽이
// 모르면(UNREADABLE) 판정 불가다. knowledge 는 자리만 그대로다 (read 와 무관하게 판정 불가).

describe('evaluateCondition — 행위자 갈래', () => {
  /** 「문 앞의 몸에게 성질 하나를 묻는다」 — ref 없이 서는 잎 */
  const asking: ConditionLeaf = {
    target: { kind: 'actor' },
    query: { kind: 'capability', path: 'x' },
    operator: 'EXISTS',
  };

  it('actor 의 capability 는 read 가 값을 주면 판정된다', () => {
    expect(met(asking, reading(true))).toBe('met');
    expect(met(asking, reading(undefined))).toBe('unmet');
  });

  it('actor 의 capability 는 read 가 모르면 판정 불가다 — 거짓이 아니다', () => {
    expect(met(asking, reading(UNREADABLE))).toBe('undecidable');
  });

  it('actor 의 state · property 도 같은 길로 흐른다', () => {
    const state: ConditionLeaf = {
      target: { kind: 'actor', ref: 'a1' },
      query: { kind: 'state', path: 's' },
      operator: '==',
      value: 'up',
    };
    expect(met(state, reading('up'))).toBe('met');
    expect(met(state, reading('down'))).toBe('unmet');
    expect(met(state, reading(UNREADABLE))).toBe('undecidable');
  });

  it('knowledge 는 read 가 값을 주어도 판정 불가다 — 자리만 그대로', () => {
    const knowing: ConditionLeaf = {
      target: { kind: 'actor' },
      query: { kind: 'knowledge', path: 'k' },
      operator: 'EXISTS',
    };
    expect(met(knowing, reading(true))).toBe('undecidable');
    expect(met(knowing, reading(UNREADABLE))).toBe('undecidable');
  });

  it('actor 는 판정 가능한 갈래이고 ref 없이 설 수 있는 갈래이기도 하다 — 둘은 다른 목록이다', () => {
    expect(DECIDABLE_TARGET_KINDS).toContain('actor');
    expect(DEFERRED_TARGET_KINDS).not.toContain('actor');
    expect(REF_OPTIONAL_TARGET_KINDS).toContain('actor');
    expect(SINGLETON_TARGET_KINDS).not.toContain('actor');
    expect(DECIDABLE_QUERY_KINDS).toContain('capability');
    expect(DEFERRED_QUERY_KINDS).toContain('knowledge');
  });
});

describe('evaluateCondition — 집합', () => {
  const T = leaf({ value: 1 });
  const F = leaf({ value: 2 });
  const U = leaf({ chance: 1 });
  const one = reading(1);

  it('all — 거짓이 하나라도 있으면 거짓, 아니면 판정 불가가 있으면 판정 불가, 아니면 참', () => {
    expect(met({ all: [T, T] }, one)).toBe('met');
    expect(met({ all: [T, F] }, one)).toBe('unmet');
    expect(met({ all: [T, U] }, one)).toBe('undecidable');
    expect(met({ all: [U, F] }, one)).toBe('unmet');
  });

  it('any — 참이 하나라도 있으면 참, 아니면 판정 불가가 있으면 판정 불가, 아니면 거짓', () => {
    expect(met({ any: [F, F] }, one)).toBe('unmet');
    expect(met({ any: [F, T] }, one)).toBe('met');
    expect(met({ any: [F, U] }, one)).toBe('undecidable');
    expect(met({ any: [U, T] }, one)).toBe('met');
  });

  it('빈 all 은 참이고 빈 any 는 거짓이다', () => {
    expect(met({ all: [] }, one)).toBe('met');
    expect(met({ any: [] }, one)).toBe('unmet');
  });

  it('겹친 집합에서도 판정 불가는 위로 오른다', () => {
    expect(met({ all: [T, { any: [F, U] }] }, one)).toBe('undecidable');
    expect(met({ any: [F, { all: [T, U] }] }, one)).toBe('undecidable');
    expect(met({ all: [T, { any: [F, { all: [T] }] }] }, one)).toBe('met');
  });
});

describe('evaluateCondition — 시간 qualifier', () => {
  /** 값이 시각 100 인 EXISTS 잎 */
  const at = (mode: 'FOR' | 'SINCE' | 'WITHIN' | 'BEFORE' | 'AFTER', seconds: number) =>
    leaf({ operator: 'EXISTS', value: undefined, qualifier: { kind: 'time', mode, seconds } });

  it('WITHIN s — 지금 - 값 <= s', () => {
    expect(met(at('WITHIN', 240), reading(100, { now: 300 }))).toBe('met');
    expect(met(at('WITHIN', 240), reading(100, { now: 340 }))).toBe('met');
    expect(met(at('WITHIN', 240), reading(100, { now: 341 }))).toBe('unmet');
  });

  it('AFTER s — 지금 - 값 > s', () => {
    expect(met(at('AFTER', 240), reading(100, { now: 341 }))).toBe('met');
    expect(met(at('AFTER', 240), reading(100, { now: 340 }))).toBe('unmet');
  });

  it('SINCE t · BEFORE t — 값을 절대 시각과 견준다 (now 가 없어도 된다)', () => {
    expect(met(at('SINCE', 100), reading(100))).toBe('met');
    expect(met(at('SINCE', 101), reading(100))).toBe('unmet');
    expect(met(at('BEFORE', 101), reading(100))).toBe('met');
    expect(met(at('BEFORE', 100), reading(100))).toBe('unmet');
  });

  it('FOR s — 지금 - heldSince >= s', () => {
    expect(met(at('FOR', 50), reading(100, { now: 300, heldSince: () => 250 }))).toBe('met');
    expect(met(at('FOR', 50), reading(100, { now: 300, heldSince: () => 251 }))).toBe('unmet');
  });

  it('now 가 없으면 WITHIN · AFTER · FOR 는 판정 불가다', () => {
    expect(met(at('WITHIN', 240), reading(100))).toBe('undecidable');
    expect(met(at('AFTER', 240), reading(100))).toBe('undecidable');
    expect(met(at('FOR', 50), reading(100, { heldSince: () => 250 }))).toBe('undecidable');
  });

  it('heldSince 가 없으면 FOR 는 판정 불가다', () => {
    expect(met(at('FOR', 50), reading(100, { now: 300 }))).toBe('undecidable');
    expect(met(at('FOR', 50), reading(100, { now: 300, heldSince: () => undefined }))).toBe(
      'undecidable',
    );
  });

  it('읽힌 값이 수가 아니면 어느 시간 qualifier 도 판정 불가다', () => {
    expect(met(at('SINCE', 0), reading('100'))).toBe('undecidable');
    expect(met(at('WITHIN', 1), reading(true, { now: 1 }))).toBe('undecidable');
  });

  it('operator 가 거짓이면 qualifier 를 묻지 않고 거짓이다 — now 가 없어도', () => {
    expect(met(at('WITHIN', 240), reading(undefined))).toBe('unmet');
    const gt = leaf({ operator: '>', value: 200, qualifier: { kind: 'time', mode: 'WITHIN', seconds: 1 } });
    expect(met(gt, reading(100))).toBe('unmet');
  });

  it('operator 와 qualifier 가 둘 다 서야 참이다', () => {
    const gt = leaf({ operator: '>', value: 50, qualifier: { kind: 'time', mode: 'WITHIN', seconds: 10 } });
    expect(met(gt, reading(100, { now: 105 }))).toBe('met');
    expect(met(gt, reading(100, { now: 200 }))).toBe('unmet');
  });
});

describe('evaluateCondition — 변화 qualifier', () => {
  const change = (mode: 'BECAME' | 'CROSSED' | 'INCREASED' | 'DECREASED', partial: Partial<ConditionLeaf> = {}) =>
    leaf({ operator: '>=', value: 5, qualifier: { kind: 'change', mode }, ...partial });

  it('previous 를 주지 않으면 판정 불가다 — 평가기는 저장하지 않는다', () => {
    expect(met(change('BECAME'), reading(7))).toBe('undecidable');
    expect(met(change('CROSSED'), reading(7))).toBe('undecidable');
    expect(met(change('INCREASED'), reading(7))).toBe('undecidable');
    expect(met(change('DECREASED'), reading(7))).toBe('undecidable');
  });

  it('previous 가 UNREADABLE 이면 판정 불가다', () => {
    expect(met(change('BECAME'), reading(7, { previous: () => UNREADABLE }))).toBe('undecidable');
  });

  it('BECAME — 직전에는 거짓이고 지금은 참', () => {
    expect(met(change('BECAME'), reading(7, { previous: () => 3 }))).toBe('met');
    expect(met(change('BECAME'), reading(7, { previous: () => 6 }))).toBe('unmet');
    expect(met(change('BECAME'), reading(3, { previous: () => 1 }))).toBe('unmet');
  });

  it('BECAME 은 EXISTS 에도 걸린다 — 없다가 생긴 것', () => {
    const appeared = change('BECAME', { operator: 'EXISTS', value: undefined });
    expect(met(appeared, reading(1, { previous: () => undefined }))).toBe('met');
    expect(met(appeared, reading(1, { previous: () => 0 }))).toBe('unmet');
  });

  it('BECAME 의 직전 판정이 형이 어긋나 판정 불가면 판정 불가다', () => {
    expect(met(change('BECAME'), reading(7, { previous: () => 'x' }))).toBe('undecidable');
  });

  it('CROSSED — 직전 값과 지금 값 사이에 value 가 있다', () => {
    expect(met(change('CROSSED'), reading(7, { previous: () => 3 }))).toBe('met');
    expect(met(change('CROSSED'), reading(7, { previous: () => 5 }))).toBe('unmet');
    const below = change('CROSSED', { operator: '<', value: 5 });
    expect(met(below, reading(3, { previous: () => 5 }))).toBe('met');
    expect(met(below, reading(3, { previous: () => 4 }))).toBe('unmet');
  });

  it('INCREASED · DECREASED — 지금 값과 직전 값의 크기', () => {
    expect(met(change('INCREASED'), reading(7, { previous: () => 6 }))).toBe('met');
    expect(met(change('INCREASED'), reading(7, { previous: () => 7 }))).toBe('unmet');
    const down = change('DECREASED', { operator: '<=', value: 9 });
    expect(met(down, reading(7, { previous: () => 8 }))).toBe('met');
    expect(met(down, reading(7, { previous: () => 7 }))).toBe('unmet');
  });

  it('CROSSED · INCREASED · DECREASED 는 수가 아니면 판정 불가다', () => {
    expect(met(change('INCREASED'), reading(7, { previous: () => undefined }))).toBe('undecidable');
    expect(met(change('INCREASED'), reading(7, { previous: () => 's' }))).toBe('undecidable');
    const text = change('CROSSED', { operator: '==', value: 's' });
    expect(met(text, reading('s', { previous: () => 't' }))).toBe('undecidable');
  });

  it('operator 가 거짓이면 previous 없이도 거짓이다', () => {
    expect(met(change('INCREASED'), reading(3))).toBe('unmet');
  });
});

describe('conditionLeaves · formatConditionLeaf', () => {
  it('잎을 적힌 차례 그대로 편다 — 겹친 집합도', () => {
    const a = leaf({ value: 1 });
    const b = leaf({ value: 2 });
    const c = leaf({ value: 3 });
    const d = leaf({ value: 4 });
    expect(conditionLeaves(a)).toEqual([a]);
    expect(conditionLeaves({ all: [a, { any: [b, { all: [c] }] }, d] })).toEqual([a, b, c, d]);
    expect(conditionLeaves({ any: [] })).toEqual([]);
  });

  it('한 줄 표기 — Target(ref).Query(path) OP value [qualifier]', () => {
    expect(
      formatConditionLeaf({
        target: { kind: 'clock' },
        query: { kind: 'property', path: 'season' },
        operator: 'IN',
        value: ['s1', 's2'],
      }),
    ).toBe('clock.property(season) IN [s1,s2]');
    expect(
      formatConditionLeaf({
        target: { kind: 'history', ref: 'A' },
        query: { kind: 'history', path: 'passages.R1' },
        operator: 'EXISTS',
      }),
    ).toBe('history(A).history(passages.R1) EXISTS');
    expect(
      formatConditionLeaf({
        target: { kind: 'history', ref: 'A' },
        query: { kind: 'history', path: 'passages.R1.lastAt' },
        operator: 'EXISTS',
        qualifier: { kind: 'time', mode: 'WITHIN', seconds: 240 },
      }),
    ).toBe('history(A).history(passages.R1.lastAt) EXISTS WITHIN 240');
    expect(
      formatConditionLeaf({
        target: { kind: 'region', ref: 'A' },
        query: { kind: 'count', path: 'population' },
        operator: '>=',
        value: 3,
        qualifier: { kind: 'change', mode: 'BECAME' },
      }),
    ).toBe('region(A).count(population) >= 3 BECAME');
    expect(
      formatConditionLeaf({ target: { kind: 'source', ref: 'S1' }, query: { kind: 'exists' }, operator: 'EXISTS' }),
    ).toBe('source(S1).exists EXISTS');
  });
});

// ── 검사 ㊹ ─────────────────────────────────────────────────────────

/** 이 시험이 쓰는 명사 — 기반은 이 이름들을 모른다. 계약으로 건넨다 */
const CONTRACT: CheckContract = {
  anchorLayer: 'door',
  resourceLayer: 'ore',
  hazardLayer: 'danger',
  phenomenonLayer: 'weather',
  settlementLayer: 'living',
  settlementTags: ['camp'],
  conditionPrefix: 'because:',
  traceLayer: 'hint',
  startRegion: 'A',
};

function space(id: string, ops: RegionDescription['ops'] = []): RegionDescription {
  return { id, extent: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, seed: 1, ops };
}

const door = (tag: string) =>
  ({ id: tag, kind: 'point', layer: 'door', tag, position: { x: 0, z: 0 } }) as const;

const link: Connector = {
  id: 'AB',
  from: { region: 'A', anchor: 'A_TO_B' },
  to: { region: 'B', anchor: 'B_TO_A' },
  direction: 'bidirectional',
  transition: 'walk',
};

const GRAPH: RegionGraph = {
  regions: ['A', 'B'],
  containment: [],
  connectors: [link],
  frontiers: [],
};

const REGIONS: CheckRegion[] = [
  { id: 'A', depth: 'near', coreRules: 0, space: space('A', [door('A_TO_B')]) },
  { id: 'B', depth: 'far', coreRules: 0, space: space('B', [door('B_TO_A')]) },
];

/** 아무 데도 걸리지 않는 조건 계약 — 자리 셋 · 잎 넷 */
function sound(): CheckCondition {
  return {
    sites: [
      {
        where: 'lock:AB',
        condition: {
          all: [
            { target: { kind: 'clock' }, query: { kind: 'property', path: 'season' }, operator: 'IN', value: ['s1'] },
            { target: { kind: 'region', ref: 'B' }, query: { kind: 'state', path: 'pattern' }, operator: 'IN', value: ['p1'] },
          ],
        },
      },
      {
        where: 'source:S1',
        condition: {
          target: { kind: 'history', ref: 'A' },
          query: { kind: 'history', path: 'passages.R1' },
          operator: 'EXISTS',
          qualifier: { kind: 'time', mode: 'WITHIN', seconds: 240 },
        },
      },
      {
        where: 'life:A',
        condition: { target: { kind: 'source', ref: 'S1' }, query: { kind: 'exists' }, operator: 'EXISTS' },
      },
    ],
    vocabulary: {
      targets: { clock: [], region: ['A', 'B'], source: ['S1'], history: ['A', 'B'] },
      queries: [
        { target: 'clock', query: 'property', paths: ['season', 'rain'] },
        { target: 'region', query: 'state', paths: ['pattern'] },
        { target: 'region', query: 'count', paths: ['population'] },
        { target: 'source', query: 'exists' },
        { target: 'history', query: 'history', paths: ['passages.R1'] },
      ],
    },
  };
}

const run = (condition?: CheckCondition) =>
  checkRegions({ regions: REGIONS, graph: GRAPH, contract: CONTRACT, condition });

const itemOf = (condition?: CheckCondition) =>
  run(condition).items.find((item) => item.id === 'condition-refs')!;

/** 성한 계약에 잎 하나를 자리 하나로 더 얹는다 */
function withLeaf(partial: Partial<ConditionLeaf>): CheckCondition {
  const world = sound();
  return {
    ...world,
    sites: [
      ...world.sites,
      {
        where: 'extra',
        condition: {
          target: { kind: 'region', ref: 'A' },
          query: { kind: 'state', path: 'pattern' },
          operator: '==',
          value: 'p1',
          ...partial,
        },
      },
    ],
  };
}

describe('㊹ 조건이 가리키는 것', () => {
  it('㊹ 이 ㊼ 뒤에 선다 — 번호가 아니라 계약이 는 차례다', () => {
    const items = run(sound()).items;
    // ㊺ ㊻(C036 · 기회)이 그 뒤에 섰다 — ㊹ 은 끝에서 셋째다
    expect(items[items.length - 3]!).toMatchObject({ mark: '㊹', id: 'condition-refs' });
    expect(items[items.length - 4]!.mark).toBe('㊼');
  });

  it('조건 쪽 계약을 주지 않으면 absent 다 — 통과로 적지 않는다', () => {
    const item = itemOf(undefined);
    expect(item.status).toBe('absent');
    expect(item.answer).toBe('조건 쪽 계약이 주어지지 않았다');
    expect(item.refs).toEqual([]);
  });

  it('어휘 안의 조건뿐이면 통과이고 수가 적힌다', () => {
    const item = itemOf(sound());
    expect(item.status).toBe('pass');
    expect(item.answer).toBe('자리 3 · 잎 4 · 걸린 것 0');
    expect(item.refs).toEqual([]);
  });

  it('두 번 돌리면 글자까지 같다 — 읽기 전용 관찰이다', () => {
    expect(JSON.stringify(run(sound()))).toBe(JSON.stringify(run(sound())));
  });

  it('① 유령 ref 가 잡힌다', () => {
    const item = itemOf(withLeaf({ target: { kind: 'region', ref: 'Z' } }));
    expect(item.status).toBe('fail');
    expect(item.answer).toBe('자리 4 · 잎 5 · 걸린 것 1');
    expect(item.refs).toEqual([
      { where: 'extra', detail: 'region(Z).state(pattern) == p1 — ref Z 은 아는 region 이 아니다' },
    ]);
  });

  it('① ref 가 필요한 갈래에 ref 가 없으면 잡힌다 — clock 은 없어도 된다', () => {
    const item = itemOf(withLeaf({ target: { kind: 'region' } }));
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'extra', detail: 'region.state(pattern) == p1 — Target region 에 ref 가 없다' },
    ]);
    expect(itemOf(sound()).refs).toEqual([]);
  });

  it('① ref 없이 설 수 있는 갈래(actor)는 어휘에 있으면 ref 없이 서고 · ref 를 밝혔으면 어휘의 id 이어야 한다', () => {
    const world = sound();
    const vocabulary: CheckCondition['vocabulary'] = {
      targets: { ...world.vocabulary.targets, actor: [] },
      queries: [...world.vocabulary.queries, { target: 'actor', query: 'capability' }],
    };
    const noRef = withLeaf({ target: { kind: 'actor' }, query: { kind: 'capability', path: 'c1' }, operator: 'EXISTS', value: undefined });
    expect(itemOf({ ...noRef, vocabulary }).refs).toEqual([]);
    const ghost = withLeaf({ target: { kind: 'actor', ref: 'x' }, query: { kind: 'capability', path: 'c1' }, operator: 'EXISTS', value: undefined });
    expect(itemOf({ ...ghost, vocabulary }).refs).toEqual([
      { where: 'extra', detail: 'actor(x).capability(c1) EXISTS — ref x 은 아는 actor 이 아니다' },
    ]);
  });

  it('① 어휘에 없는 갈래는 잡히고 그 query 는 재지 않는다 (ref 없이 설 수 있는 갈래도)', () => {
    const item = itemOf(withLeaf({ target: { kind: 'actor', ref: 'x' } }));
    expect(item.refs).toEqual([
      { where: 'extra', detail: 'actor(x).state(pattern) == p1 — Target 갈래 actor 은 어휘에 없다' },
    ]);
  });

  it('② 그 갈래에 허용되지 않은 query 가 잡힌다', () => {
    const item = itemOf(withLeaf({ query: { kind: 'history', path: 'passages.R1' } }));
    expect(item.refs).toEqual([
      {
        where: 'extra',
        detail: 'region(A).history(passages.R1) == p1 — Query history 은 region 에 허용되지 않는다',
      },
    ]);
  });

  it('② paths 를 밝힌 query 에 없는 path 가 잡힌다 — path 를 빠뜨려도', () => {
    expect(itemOf(withLeaf({ query: { kind: 'state', path: 'mood' } })).refs).toEqual([
      { where: 'extra', detail: 'region(A).state(mood) == p1 — path mood 은 region.state 의 경로에 없다' },
    ]);
    expect(itemOf(withLeaf({ query: { kind: 'state' } })).refs).toEqual([
      { where: 'extra', detail: 'region(A).state == p1 — region.state 은 path 를 요구한다' },
    ]);
  });

  it('② paths 를 밝히지 않은 query 는 path 를 재지 않는다', () => {
    const item = itemOf(
      withLeaf({
        target: { kind: 'source', ref: 'S1' },
        query: { kind: 'exists', path: 'anything' },
        operator: 'EXISTS',
        value: undefined,
      }),
    );
    expect(item.status).toBe('pass');
  });

  it('③ EXISTS 에 value 가 있으면 잡힌다 · value 가 있어야 하는 operator 에 없으면 잡힌다', () => {
    expect(itemOf(withLeaf({ operator: 'EXISTS', value: 'p1' })).refs).toEqual([
      { where: 'extra', detail: 'region(A).state(pattern) EXISTS p1 — EXISTS 은 value 를 받지 않는다' },
    ]);
    expect(itemOf(withLeaf({ operator: '==', value: undefined })).refs).toEqual([
      { where: 'extra', detail: 'region(A).state(pattern) == — == 은 value 를 요구한다' },
    ]);
  });

  it('③ IN 에 스칼라 · IN 밖에 목록이 잡힌다', () => {
    expect(itemOf(withLeaf({ operator: 'IN', value: 'p1' })).refs).toEqual([
      { where: 'extra', detail: 'region(A).state(pattern) IN p1 — IN 의 value 는 목록이어야 한다' },
    ]);
    expect(itemOf(withLeaf({ operator: '==', value: ['p1'] })).refs).toEqual([
      { where: 'extra', detail: 'region(A).state(pattern) == [p1] — == 의 value 는 목록일 수 없다' },
    ]);
  });

  it('④ 어긋난 qualifier 가 잡힌다 — seconds · 모르는 mode', () => {
    for (const seconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const item = itemOf(withLeaf({ qualifier: { kind: 'time', mode: 'WITHIN', seconds } }));
      expect(item.status).toBe('fail');
      expect(item.refs[0]!.detail.endsWith(`seconds ${String(seconds)} 은 유한한 0 이상의 수가 아니다`)).toBe(true);
    }
    const badTime = withLeaf({
      qualifier: { kind: 'time', mode: 'SOON' as 'WITHIN', seconds: 1 },
    });
    expect(itemOf(badTime).refs[0]!.detail.endsWith('time qualifier 의 mode SOON 은 다섯 밖이다')).toBe(true);
    const badChange = withLeaf({ qualifier: { kind: 'change', mode: 'JUMPED' as 'BECAME' } });
    expect(itemOf(badChange).refs[0]!.detail.endsWith('change qualifier 의 mode JUMPED 은 넷 밖이다')).toBe(true);
    // 0 은 유효하다
    expect(itemOf(withLeaf({ qualifier: { kind: 'time', mode: 'AFTER', seconds: 0 } })).status).toBe('pass');
  });

  it('잎 하나에 까닭이 여럿이면 줄도 여럿이다 — ①~④ 의 차례로', () => {
    const item = itemOf(
      withLeaf({
        target: { kind: 'region', ref: 'Z' },
        query: { kind: 'count', path: 'mood' },
        operator: 'IN',
        value: 'p1',
        qualifier: { kind: 'change', mode: 'JUMPED' as 'BECAME' },
      }),
    );
    expect(item.answer).toBe('자리 4 · 잎 5 · 걸린 것 4');
    expect(item.refs.map((ref) => ref.detail.split(' — ')[1])).toEqual([
      'ref Z 은 아는 region 이 아니다',
      'path mood 은 region.count 의 경로에 없다',
      'IN 의 value 는 목록이어야 한다',
      'change qualifier 의 mode JUMPED 은 넷 밖이다',
    ]);
  });

  it('㊹ 를 더해도 다른 검사의 답은 그대로다 — 계약의 유무가 ㊹ 하나만 바꾼다', () => {
    const withIt = run(sound()).items;
    const without = run(undefined).items;
    expect(withIt.length).toBe(without.length);
    // 뒤에 선 ㊺ ㊻(C036)은 기회 쪽 계약을 주지 않았으므로 양쪽 다 같은 absent 다
    for (let i = 0; i < withIt.length; i++) {
      if (withIt[i]!.id === 'condition-refs') continue;
      expect(withIt[i]).toEqual(without[i]);
    }
  });
});
