// V1 원시요소 단위 테스트 — tick / random / id / stableSort / hash.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  advance,
  canonicalize,
  childId,
  compareBy,
  compareChain,
  compareNumbers,
  compareStrings,
  createClock,
  createRandom,
  descending,
  deterministicId,
  elapsed,
  hashString,
  idKind,
  nextFloat,
  nextInt,
  nextUint32,
  pick,
  rewind,
  sameState,
  shuffle,
  split,
  stableSort,
  stateHash,
} from '../../src/v1/index.ts';

describe('TickClock', () => {
  test('틱은 단조 증가한다', () => {
    let clock = createClock(0);
    assert.equal(clock.tick, 0);
    clock = advance(clock);
    clock = advance(clock, 5);
    assert.equal(clock.tick, 6);
    assert.equal(elapsed(clock), 6);
  });

  test('되감기는 시작 틱으로만 간다', () => {
    const clock = advance(createClock(100), 3);
    assert.equal(rewind(clock).tick, 100);
  });

  test('음수·0·소수 전진은 거부된다', () => {
    const clock = createClock(0);
    assert.throws(() => advance(clock, 0), RangeError);
    assert.throws(() => advance(clock, -1), RangeError);
    assert.throws(() => advance(clock, 1.5), RangeError);
    assert.throws(() => createClock(-1), RangeError);
  });
});

describe('SeededRandom', () => {
  test('같은 시드는 같은 수열을 준다', () => {
    const draw = (): number[] => {
      let state = createRandom('배고픈 인간');
      const out: number[] = [];
      for (let i = 0; i < 50; i += 1) {
        const [next, value] = nextUint32(state);
        state = next;
        out.push(value);
      }
      return out;
    };
    assert.deepEqual(draw(), draw());
  });

  test('다른 시드는 다른 수열을 준다', () => {
    const first = nextUint32(createRandom('seed-a'))[1];
    const second = nextUint32(createRandom('seed-b'))[1];
    assert.notEqual(first, second);
  });

  test('상태는 직렬화·복원 가능하다', () => {
    let state = createRandom(7);
    for (let i = 0; i < 10; i += 1) state = nextUint32(state)[0];
    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    assert.equal(nextUint32(state)[1], nextUint32(restored)[1]);
  });

  test('nextFloat 는 [0,1) 안에 있다', () => {
    let state = createRandom('float');
    for (let i = 0; i < 1000; i += 1) {
      const [next, value] = nextFloat(state);
      state = next;
      assert.ok(value >= 0 && value < 1, `범위 밖: ${String(value)}`);
    }
  });

  test('nextInt 는 경계를 지키고 빈 범위를 거부한다', () => {
    let state = createRandom('int');
    for (let i = 0; i < 500; i += 1) {
      const [next, value] = nextInt(state, -2, 3);
      state = next;
      assert.ok(value >= -2 && value < 3, `범위 밖: ${String(value)}`);
      assert.ok(Number.isInteger(value));
    }
    assert.throws(() => nextInt(state, 5, 5), RangeError);
    assert.throws(() => nextInt(state, 5, 1), RangeError);
    assert.throws(() => nextInt(state, 0.5, 3), RangeError);
  });

  test('pick 은 빈 배열을 거부한다', () => {
    assert.throws(() => pick(createRandom(0), []), RangeError);
  });

  test('shuffle 은 원본을 보존하고 순열을 준다', () => {
    const items = [1, 2, 3, 4, 5];
    const [, shuffled] = shuffle(createRandom('shuffle'), items);
    assert.deepEqual(items, [1, 2, 3, 4, 5]);
    assert.deepEqual([...shuffled].sort(compareNumbers), items);
  });

  test('split 은 라벨별로 독립적이고 재현 가능한 스트림을 만든다', () => {
    const root = createRandom('root');
    const a1 = nextUint32(split(root, 'subject-a'))[1];
    const a2 = nextUint32(split(root, 'subject-a'))[1];
    const b1 = nextUint32(split(root, 'subject-b'))[1];
    assert.equal(a1, a2, '같은 라벨은 같은 스트림');
    assert.notEqual(a1, b1, '다른 라벨은 다른 스트림');
  });
});

describe('DeterministicId', () => {
  test('같은 유래는 같은 ID', () => {
    assert.equal(
      deterministicId('subject', 'human', 3),
      deterministicId('subject', 'human', 3),
    );
  });

  test('다른 유래는 다른 ID', () => {
    assert.notEqual(
      deterministicId('subject', 'human', 3),
      deterministicId('subject', 'human', 4),
    );
    assert.notEqual(
      deterministicId('subject', 'human', 3),
      deterministicId('entity', 'human', 3),
    );
  });

  test('인접 인자 경계가 뭉개지지 않는다', () => {
    assert.notEqual(deterministicId('x', 'ab', 'c'), deterministicId('x', 'a', 'bc'));
  });

  test('종류 접두사를 읽을 수 있고, 잘못된 종류는 거부된다', () => {
    const id = childId(deterministicId('subject', 1), 'need', 'hunger');
    assert.equal(idKind(id), 'need');
    assert.equal(idKind('그냥문자열'), null);
    assert.throws(() => deterministicId('Subject', 1), RangeError);
    assert.throws(() => deterministicId('', 1), RangeError);
  });
});

describe('stableSort', () => {
  test('동률은 입력 순서를 유지한다', () => {
    const items = [
      { key: 1, tag: 'a' },
      { key: 0, tag: 'b' },
      { key: 1, tag: 'c' },
      { key: 0, tag: 'd' },
      { key: 1, tag: 'e' },
    ];
    const sorted = stableSort(items, compareBy((item) => item.key));
    assert.deepEqual(
      sorted.map((item) => item.tag),
      ['b', 'd', 'a', 'c', 'e'],
    );
  });

  test('원본을 바꾸지 않는다', () => {
    const items = [3, 1, 2];
    stableSort(items, compareNumbers);
    assert.deepEqual(items, [3, 1, 2]);
  });

  test('연쇄·역순 비교자', () => {
    const items = [
      { a: 1, b: 'z' },
      { a: 1, b: 'a' },
      { a: 0, b: 'm' },
    ];
    const sorted = stableSort(
      items,
      compareChain(
        compareBy((item: { a: number; b: string }) => item.a),
        descending((left: { b: string }, right: { b: string }) =>
          compareStrings(left.b, right.b),
        ),
      ),
    );
    assert.deepEqual(
      sorted.map((item) => item.b),
      ['m', 'z', 'a'],
    );
  });

  test('비교 불가능한 값은 조용히 통과하지 않는다', () => {
    assert.throws(() => stableSort([1, Number.NaN], compareNumbers), RangeError);
    assert.throws(
      () => stableSort([1, 2], () => Number.POSITIVE_INFINITY),
      RangeError,
    );
  });

  test('문자열 비교는 로케일이 아니라 코드포인트 순이다', () => {
    assert.deepEqual(stableSort(['b', 'A', 'a'], compareStrings), ['A', 'a', 'b']);
  });
});

describe('stateHash', () => {
  test('키 순서가 달라도 같은 상태다', () => {
    assert.ok(sameState({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }));
  });

  test('배열 순서가 다르면 다른 상태다', () => {
    assert.ok(!sameState([1, 2], [2, 1]));
  });

  test('-0 과 0, undefined 와 키 부재는 같은 상태다', () => {
    assert.ok(sameState({ x: -0 }, { x: 0 }));
    assert.ok(sameState({ x: 1, y: undefined }, { x: 1 }));
  });

  test('타입이 다르면 다른 상태다', () => {
    assert.ok(!sameState({ x: 1 }, { x: '1' }));
    assert.ok(!sameState(null, 0));
  });

  test('직렬화 불가능한 값은 경로와 함께 거부된다', () => {
    assert.throws(() => stateHash({ world: { run: () => 1 } }), /\$\.world\.run/);
    assert.throws(() => stateHash({ n: Number.NaN }), /\$\.n/);
    assert.throws(() => stateHash({ t: new Date(0) }), /\$\.t/);
    assert.throws(() => stateHash({ m: new Map() }), /\$\.m/);
  });

  test('순환 참조는 거부된다', () => {
    const node: Record<string, unknown> = { name: 'a' };
    node['self'] = node;
    assert.throws(() => stateHash(node), /순환 참조/);
  });

  test('해시는 16자리 hex 이고 재실행에 불변이다', () => {
    const hash = stateHash({ tick: 3, stock: { a: 1 } });
    assert.match(hash, /^[0-9a-f]{16}$/);
    assert.equal(hash, stateHash({ stock: { a: 1 }, tick: 3 }));
  });

  test('canonicalize 는 눈으로 비교 가능한 정규형을 준다', () => {
    assert.equal(canonicalize({ b: 1, a: [2, 'x'] }), '{"a":[2,"x"],"b":1}');
  });

  test('한 글자 차이가 해시 전체에 퍼진다 (눈사태)', () => {
    const bits = (hex: string): string =>
      [...hex].map((c) => Number.parseInt(c, 16).toString(2).padStart(4, '0')).join('');
    const left = bits(stateHash({ i: 0 }));
    const right = bits(stateHash({ i: 1 }));
    let differing = 0;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differing += 1;
    }
    // 이상적 눈사태는 64bit 중 32bit — 관용 범위를 넓게 잡아도 20bit 미만이면 확산 실패다.
    assert.ok(differing >= 20, `퍼진 비트 ${String(differing)}/64 — 확산 부족`);
  });

  test('연속된 유래 1000개가 12자리 접두사에서 충돌하지 않는다', () => {
    const ids = new Set<string>();
    for (let index = 0; index < 1000; index += 1) {
      ids.add(deterministicId('toy-subject', 'collision-probe', index));
    }
    assert.equal(ids.size, 1000);
  });

  test('hashString 은 uint32 이고 안정적이다', () => {
    const hash = hashString('배고픈 인간');
    assert.equal(hash, hashString('배고픈 인간'));
    assert.ok(Number.isInteger(hash) && hash >= 0 && hash <= 0xffff_ffff);
    assert.notEqual(hash, hashString('배부른 인간'));
  });
});
