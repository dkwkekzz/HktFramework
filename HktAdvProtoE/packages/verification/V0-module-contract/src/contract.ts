/**
 * 공통 TypeScript 계약.
 *
 * 설계 원문 「3.2 공통 TypeScript 계약」의 인터페이스를 그대로 옮긴 것이다.
 * 원문에 이름만 등장하고 형태가 규정되지 않은 보조 타입
 * (ModuleContext · VerificationIssue · LabViewModel)은 이 파일에서 최소 형태로 정의한다.
 * ModuleContext 의 시드·틱은 V2(determinism)가 실제 RNG·Clock 으로 대체한다.
 */

/** 원문 「3.2」 */
export interface ModuleDefinition<Input, Output> {
  id: string;
  version: string;
  purpose: string;
  dependencies: string[];
  validateInput(input: unknown): Input;
  execute(input: Input, context: ModuleContext): Output;
  validateOutput(output: Output): VerificationIssue[];
  scenarios: VerificationScenario<Input, Output>[];
}

/** 원문 「3.2」 */
export interface VerificationScenario<Input, Output> {
  id: string;
  title: string;
  seed: bigint;
  arrange(): Input;
  act(input: Input, context: ModuleContext): Output;
  assert(input: Input, output: Output, context: ModuleContext): AssertionResult[];
  toLabView(input: Input, output: Output, context: ModuleContext): LabViewModel;
}

/** 원문 「3.2」 */
export interface AssertionResult {
  id: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  reason?: string;
}

/** 모듈 실행 문맥 — 원문은 이름만 규정한다. V2 가 seed/tick 을 결정적 자원으로 확장한다. */
export interface ModuleContext {
  moduleId: string;
  seed: bigint;
  tick: number;
}

/** 계약 위반 보고 단위 — 원문은 이름만 규정한다. path 는 문서 내 위치를 가리킨다. */
export interface VerificationIssue {
  code: string;
  path: string;
  message: string;
}

/** 원문 「24. 브라우저 Lab의 공통 화면」의 8개 구획에 1:1 대응한다. */
export interface LabViewModel {
  /** 모듈 목적 */
  purpose: string;
  /** 입력 상태 */
  input: LabRow[];
  /** 후보 */
  candidates: LabRow[];
  /** 선택 결과 */
  result: string;
  /** 이유 */
  reasons: string[];
  /** 상태 전후 */
  before: string;
  after: string;
  /** 검증 */
  checks: LabCheck[];
}

export interface LabRow {
  label: string;
  value: string;
}

export interface LabCheck {
  label: string;
  passed: boolean;
}

/** 시나리오 한 건의 실행 결과 — Lab 과 verify CLI 가 공유한다. */
export interface ScenarioRun {
  scenarioId: string;
  title: string;
  seed: string;
  assertions: AssertionResult[];
  passed: boolean;
  view: LabViewModel;
}

/** 시나리오를 실행해 결과를 모은다. 실행 순서는 선언 순서로 고정한다(결정적). */
export function runScenario<Input, Output>(
  scenario: VerificationScenario<Input, Output>,
  moduleId: string,
  seedOverride?: bigint,
): ScenarioRun {
  const seed = seedOverride ?? scenario.seed;
  const context: ModuleContext = { moduleId, seed, tick: 0 };
  const input = scenario.arrange();
  const output = scenario.act(input, context);
  const assertions = scenario.assert(input, output, context);
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    seed: seed.toString(),
    assertions,
    passed: assertions.every((a) => a.passed),
    view: scenario.toLabView(input, output, context),
  };
}
