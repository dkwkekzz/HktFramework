// V2 시나리오 계약 — 모듈의 대표 장면을 arrange / act / assert 셋으로만 쓴다.
// 원문 V2 인터페이스를 그대로 따르되, 실패 보고에 필요한 정보를 시나리오가 스스로 선언하게 한다.

/** 시나리오 종류 — 모든 모듈은 정상·실패·경계 최소 1개씩을 갖는다 (WORKFLOW §5.1). */
export type ScenarioKind = 'normal' | 'failure' | 'boundary';

/** 단언 하나의 결과. 실패 시 기대·실제·최초 분기 경로를 함께 지고 다닌다. */
export interface Assertion {
  /** 무엇을 확인했는지 (한 문장) */
  readonly label: string;
  readonly passed: boolean;
  readonly expected: unknown;
  readonly actual: unknown;
  /** 기대와 실제가 최초로 갈라진 상태 경로 (`$.stock.subject-a`). 동일하거나 비교 불가면 null. */
  readonly firstDivergentPath: string | null;
}

/**
 * 모듈의 대표 장면.
 * @typeParam TState  arrange 가 만드는 초기 상태
 * @typeParam TResult act 가 내는 결과
 */
export interface Scenario<TState = unknown, TResult = unknown> {
  /** 시나리오 ID — `<모듈ID 소문자>-<장면>` (예: `v1-same-seed-100`) */
  readonly id: string;
  /** 이 시나리오가 검증하는 모듈 ID (예: `V1`) */
  readonly module: string;
  readonly kind: ScenarioKind;
  /** 이 장면이 무엇을 보이려는지 (한 문장) */
  readonly purpose: string;
  /** 초기 상태를 만든다. 순수해야 하며 같은 값을 반복 생성한다. */
  arrange(): TState;
  /** 초기 상태에 입력을 가해 결과를 낸다. */
  act(state: TState): TResult;
  /** 결과를 단언한다. 빈 배열을 돌려주면 시나리오는 실패로 판정된다. */
  assert(result: TResult, state: TState): readonly Assertion[];
  /** 실행된 입력 — 실패 보고에 그대로 출력된다. 없으면 arrange 결과가 곧 입력이다. */
  input?(state: TState): unknown;
}

/**
 * 상태 타입이 서로 다른 시나리오를 한 목록에 담기 위한 소거 타입.
 * Scenario 의 arrange/act/assert 는 메서드 문법이라 양변성을 가지므로 그대로 담긴다.
 */
export type AnyScenario = Scenario<unknown, unknown>;

/** 시나리오 정의 헬퍼 — 타입 추론만 돕는다. */
export function defineScenario<TState, TResult>(
  scenario: Scenario<TState, TResult>,
): Scenario<TState, TResult> {
  return scenario;
}
