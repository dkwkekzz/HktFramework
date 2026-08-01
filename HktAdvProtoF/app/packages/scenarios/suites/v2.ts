// V2 자체 검증 시나리오 3종 — 실행기가 실행기를 검증한다.
// 검증 대상이 "장면을 자동 실행하고 실패를 고칠 수 있게 보고하는가" 이므로,
// 안쪽 시나리오(장난감)를 만들어 바깥 실행기에 먹이는 형태가 된다.

import {
  defineScenario,
  expectState,
  expectTrue,
  runScenario,
  type AnyScenario,
  type Assertion,
  type Scenario,
  type ScenarioResult,
} from '../src/index.ts';

/** 안쪽 장난감 세계 — 두 주체의 재고. */
interface ToyStock {
  readonly tick: number;
  readonly stock: { readonly a: number; readonly b: number };
}

const arrangeToy = (): ToyStock => ({ tick: 0, stock: { a: 3, b: 5 } });

/** 재고를 소비하는 정직한 처리. */
const consume = (state: ToyStock): ToyStock => ({
  tick: state.tick + 1,
  stock: { a: state.stock.a - 1, b: state.stock.b - 1 },
});

/** b 를 잘못 계산하는 처리 — 실패 보고를 만들기 위한 고의 결함. */
const consumeBuggy = (state: ToyStock): ToyStock => ({
  tick: state.tick + 1,
  stock: { a: state.stock.a - 1, b: state.stock.b - 2 },
});

const expectedAfterConsume: ToyStock = { tick: 1, stock: { a: 2, b: 4 } };

const innerPassing: Scenario<ToyStock, ToyStock> = defineScenario({
  id: 'toy-consume-ok',
  module: 'TOY',
  kind: 'normal',
  purpose: '재고 소비가 기대대로 반영된다.',
  arrange: arrangeToy,
  act: consume,
  assert: (result) => [expectState('소비 후 상태가 기대와 같다', expectedAfterConsume, result)],
});

const innerFailing: Scenario<ToyStock, ToyStock> = defineScenario({
  id: 'toy-consume-bug',
  module: 'TOY',
  kind: 'normal',
  purpose: 'b 재고를 두 배로 깎는 결함을 심어 실패 보고를 만든다.',
  arrange: arrangeToy,
  act: consumeBuggy,
  input: (state) => ({ action: 'consume', target: ['a', 'b'], from: state.stock }),
  assert: (result) => [expectState('소비 후 상태가 기대와 같다', expectedAfterConsume, result)],
});

const innerNoAssertion: Scenario<ToyStock, ToyStock> = defineScenario({
  id: 'toy-no-assertion',
  module: 'TOY',
  kind: 'boundary',
  purpose: '단언이 없는 시나리오.',
  arrange: arrangeToy,
  act: consume,
  assert: () => [],
});

const innerThrowing: Scenario<ToyStock, ToyStock> = defineScenario({
  id: 'toy-act-throws',
  module: 'TOY',
  kind: 'boundary',
  purpose: 'act 가 던지는 시나리오.',
  arrange: arrangeToy,
  act: () => {
    throw new RangeError('재고가 음수가 되었다');
  },
  assert: () => [expectTrue('여기까지 오면 안 된다', false)],
});

const innerArrangeThrows: Scenario<ToyStock, ToyStock> = defineScenario({
  id: 'toy-arrange-throws',
  module: 'TOY',
  kind: 'boundary',
  purpose: 'arrange 가 던지는 시나리오.',
  arrange: () => {
    throw new Error('초기 상태를 만들 수 없다');
  },
  act: consume,
  assert: () => [expectTrue('여기까지 오면 안 된다', false)],
});

const innerUnserializable = defineScenario({
  id: 'toy-unserializable-state',
  module: 'TOY',
  kind: 'boundary',
  purpose: '상태에 함수가 섞인 시나리오 — 상태 원소 규칙 위반.',
  arrange: () => ({ compute: (): number => 1 }),
  act: (state) => ({ value: state.compute() }),
  assert: (result) => [expectState('값이 1이다', { value: 1 }, result)],
});

/**
 * 안쪽 장면 목록.
 * 바깥 시나리오의 arrange 는 "어떤 장면을 실행할지" 라는 **직렬화 가능한 이름**만 만든다 —
 * 시나리오 객체(함수 덩어리)를 초기 상태로 쓰면 원칙 ③(모든 상태 원소는 직렬화 가능)을 깬다.
 */
const INNER = {
  'toy-consume-ok': innerPassing,
  'toy-consume-bug': innerFailing,
  'toy-no-assertion': innerNoAssertion,
  'toy-act-throws': innerThrowing,
  'toy-arrange-throws': innerArrangeThrows,
  'toy-unserializable-state': innerUnserializable,
} as const satisfies Record<string, AnyScenario>;

type InnerId = keyof typeof INNER;

const runInner = (id: InnerId): ScenarioResult => runScenario<unknown, unknown>(INNER[id]);

/** 정상 — 통과하는 장면은 통과로 보고된다. */
export const v2PassingReport = defineScenario({
  id: 'v2-passing-report',
  module: 'V2',
  kind: 'normal',
  purpose: '통과하는 장면을 실행하면 단언 목록과 함께 통과로 보고된다.',
  arrange: (): { readonly inner: InnerId } => ({ inner: 'toy-consume-ok' }),
  act: (state) => runInner(state.inner),
  assert: (result): Assertion[] => [
    expectTrue('통과로 판정된다', result.passed),
    expectState('실패 요약은 비어 있다', null, result.failure),
    expectTrue('단언이 기록된다', result.assertions.length === 1, result.assertions.length),
    expectTrue('단언이 통과로 기록된다', result.assertions[0]?.passed === true),
    expectState('초기 상태가 보존된다', arrangeToy(), result.initialState),
    expectState('결과 상태가 보존된다', expectedAfterConsume, result.output),
    expectTrue('상태 해시가 기록된다', typeof result.outputHash === 'string'),
  ],
});

/** 실패 — 실패 보고에 원문 V2 요구 5요소가 전부 담긴다. */
export const v2FailureReport = defineScenario({
  id: 'v2-failure-report',
  module: 'V2',
  kind: 'failure',
  purpose:
    '일부러 실패하는 장면에서 초기 상태·입력·기대·실제·최초 분기 경로가 모두 출력된다.',
  arrange: (): { readonly inner: InnerId } => ({ inner: 'toy-consume-bug' }),
  act: (state) => runInner(state.inner),
  assert: (result): Assertion[] => [
    expectTrue('실패로 판정된다', !result.passed),
    expectTrue('사유가 단언 실패다', result.failure?.reason === 'assertion', result.failure?.reason),
    expectState('① 초기 상태가 보고된다', arrangeToy(), result.initialState),
    expectState(
      '② 실행된 입력이 보고된다',
      { action: 'consume', target: ['a', 'b'], from: { a: 3, b: 5 } },
      result.input,
    ),
    expectState('③ 기대 결과가 보고된다', expectedAfterConsume, result.failure?.expected),
    expectState('④ 실제 결과가 보고된다', { tick: 1, stock: { a: 2, b: 3 } }, result.failure?.actual),
    expectState('⑤ 최초 분기 경로가 결함 지점을 지목한다', '$.stock.b', result.failure?.firstDivergentPath),
  ],
});

/** 경계 — 단언 0개·act throw·arrange throw 에서도 실행기가 죽지 않고 사유를 남긴다. */
export const v2Boundary = defineScenario({
  id: 'v2-boundary',
  module: 'V2',
  kind: 'boundary',
  purpose: '단언 없음·arrange 예외·act 예외를 실행기가 죽지 않고 사유로 환원한다.',
  arrange: (): readonly InnerId[] => [
    'toy-no-assertion',
    'toy-act-throws',
    'toy-arrange-throws',
    'toy-unserializable-state',
  ],
  act: (inners): readonly ScenarioResult[] => inners.map((id) => runInner(id)),
  assert: (results): Assertion[] => {
    const [noAssertion, actThrows, arrangeThrows, unserializable] = results;
    return [
      expectTrue('단언 0개는 통과가 아니다', noAssertion?.passed === false),
      expectState('사유가 no-assertion 이다', 'no-assertion', noAssertion?.failure?.reason),
      expectTrue('act 예외는 실패다', actThrows?.passed === false),
      expectState('사유가 threw 다', 'threw', actThrows?.failure?.reason),
      expectTrue(
        'act 예외 메시지가 보존된다',
        String(actThrows?.failure?.actual).includes('재고가 음수가 되었다'),
        actThrows?.failure?.actual,
      ),
      expectTrue('arrange 예외도 실패로 환원된다', arrangeThrows?.passed === false),
      expectState('arrange 예외 시 초기 상태는 null 이다', null, arrangeThrows?.initialState),
      // 상태에 함수가 섞인 장면: 실행기는 죽지 않되, 해시를 null 로 남겨 위반을 드러낸다.
      expectState(
        '직렬화 불가능한 상태는 해시가 null 로 남는다 — 상태 원소 규칙 위반의 표식',
        null,
        unserializable?.initialStateHash,
      ),
      expectTrue(
        '그래도 실행기는 장면을 끝까지 돌린다',
        unserializable?.assertions.length === 1,
        unserializable?.assertions.length,
      ),
    ];
  },
});

export const v2Scenarios = [v2PassingReport, v2FailureReport, v2Boundary] as const;
