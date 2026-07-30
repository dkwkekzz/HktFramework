import { sha256Tagged } from '@hkt/v0-module-contract';
import { canonicalJson, compileSchema, type Validator } from '@hkt/v1-schema';
import { IdFactory, Rng, TickClock, deriveSeed, seedLabel, type SeedComponents } from '@hkt/v2-determinism';
import { checkCondition, evaluateCondition } from './conditions.js';
import { FixtureLoader } from './fixture.js';
import { deepClone, deepFreeze, diffStates } from './json.js';
import { BUILTIN_STEPS } from './steps.js';
import {
  StepRejection,
  type JsonObject,
  type RunIssue,
  type ScenarioReport,
  type ScenarioSpec,
  type StepCall,
  type StepContext,
  type StepDefinition,
  type Transition,
} from './types.js';

const DEFAULT_WORLD_SEED = '20260730';

/**
 * Scenario Runner (원문 「8」 V3 의 산출물).
 *
 * Given-When-Then 을 데이터로 받아 결정적으로 실행한다. 설계상 두 가지를 특히 붙잡는다.
 *
 * - **실행 전 거부** — 모르는 픽스처·모르는 단계·잘못된 params·잘못된 조건은 한 단계도 굴리기 전에
 *   경로와 함께 거부한다. 절반쯤 굴러간 상태에서 나온 판정은 아무것도 증명하지 못한다.
 * - **전후 보존** — 단계마다 before/after 를 그대로 남긴다. 조건이 실패했을 때 화면에 필요한 것은
 *   "실패했다"가 아니라 그 값이 어디서 어떻게 달라졌는가다.
 */
export class ScenarioRunner {
  readonly fixtures: FixtureLoader;
  #steps = new Map<string, StepDefinition>();
  #paramValidators = new Map<string, Validator>();

  constructor(options: { fixtures?: FixtureLoader; steps?: readonly StepDefinition[] } = {}) {
    this.fixtures = options.fixtures ?? new FixtureLoader();
    for (const step of options.steps ?? BUILTIN_STEPS) this.register(step);
  }

  register(step: StepDefinition): this {
    if (!/^[a-z][a-z0-9_]*$/.test(step.id)) {
      throw new TypeError(`단계 id 는 소문자 snake_case 여야 한다: ${JSON.stringify(step.id)}`);
    }
    const existing = this.#steps.get(step.id);
    if (existing && existing !== step) {
      throw new TypeError(`단계 \`${step.id}\` 가 이미 다른 구현으로 등록되어 있다.`);
    }
    this.#steps.set(step.id, step);
    if (step.paramsSchema) this.#paramValidators.set(step.id, compileSchema(step.paramsSchema));
    return this;
  }

  /** 등록된 단계 id (오름차순). */
  stepIds(): string[] {
    return [...this.#steps.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  /**
   * 실행 전 검사 — 한 단계도 굴리기 전에 명세 전체를 본다.
   * 돌아온 목록이 비어 있지 않으면 시나리오는 실행되지 않는다.
   */
  preflight(spec: ScenarioSpec): RunIssue[] {
    const issues: RunIssue[] = [];

    if (typeof spec.id !== 'string' || spec.id.trim() === '') {
      issues.push({ code: 'E_SCENARIO_ID', path: '/id', message: '시나리오에는 id 가 있어야 한다.' });
    }
    if (!Array.isArray(spec.when)) {
      issues.push({ code: 'E_WHEN_TYPE', path: '/when', message: 'when 은 단계 배열이어야 한다.' });
      return issues;
    }
    if (!Array.isArray(spec.then) || spec.then.length === 0) {
      issues.push({
        code: 'E_THEN_EMPTY',
        path: '/then',
        message: '조건이 없는 시나리오는 무엇도 검증하지 않는다.',
      });
    }

    // Given
    if ('fixture' in spec.given) {
      if (!this.fixtures.has(spec.given.fixture)) {
        issues.push({
          code: 'E_UNKNOWN_FIXTURE',
          path: '/given/fixture',
          message: `\`${spec.given.fixture}\` 는 등록된 픽스처가 아니다. 등록된 것: ${this.fixtures.ids().join(', ') || '없음'}`,
        });
      }
    } else if (
      spec.given.state === null ||
      typeof spec.given.state !== 'object' ||
      Array.isArray(spec.given.state)
    ) {
      issues.push({ code: 'E_GIVEN_STATE_TYPE', path: '/given/state', message: 'given 상태는 객체여야 한다.' });
    }

    // When
    spec.when.forEach((call, index) => {
      const step = this.#steps.get(call.step);
      if (!step) {
        issues.push({
          code: 'E_UNKNOWN_STEP',
          path: `/when/${index}/step`,
          message: `\`${call.step}\` 는 등록된 단계가 아니다. 등록된 것: ${this.stepIds().join(', ') || '없음'}`,
        });
        return;
      }
      const validator = this.#paramValidators.get(call.step);
      if (!validator) return;
      const result = validator.validate(call.params ?? {});
      for (const issue of result.issues) {
        issues.push({
          code: issue.code,
          path: `/when/${index}/params${issue.instancePath}`,
          message: `${issue.message} (단계 \`${call.step}\` 의 params 스키마 ${issue.schemaPath})`,
        });
      }
    });

    // Then
    const seenIds = new Set<string>();
    (Array.isArray(spec.then) ? spec.then : []).forEach((condition, index) => {
      issues.push(...checkCondition(condition, index, spec.when.length));
      if (seenIds.has(condition.id)) {
        issues.push({
          code: 'E_DUPLICATE_CONDITION_ID',
          path: `/then/${index}/id`,
          message: `조건 id 가 중복이다: ${condition.id}`,
        });
      }
      seenIds.add(condition.id);
    });

    return issues.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  /** 시나리오 하나를 실행한다. 같은 명세·같은 시드면 언제나 같은 보고가 나온다. */
  run(spec: ScenarioSpec): ScenarioReport {
    const components: SeedComponents = {
      worldSeed: BigInt(spec.seed?.worldSeed ?? DEFAULT_WORLD_SEED),
      ...(spec.seed?.tick === undefined ? {} : { tick: spec.seed.tick }),
      ...(spec.seed?.subjectId === undefined ? {} : { subjectId: spec.seed.subjectId }),
      ...(spec.seed?.decisionCounter === undefined ? {} : { decisionCounter: spec.seed.decisionCounter }),
      situationId: spec.id,
    };
    const seed = deriveSeed(components);

    const issues = this.preflight(spec);
    const given: JsonObject =
      issues.length > 0
        ? {}
        : 'fixture' in spec.given
          ? this.fixtures.load(spec.given.fixture)
          : deepFreeze(deepClone(spec.given.state));

    if (issues.length > 0) {
      return finish({
        spec,
        seed,
        seedLabel: seedLabel(components),
        given,
        transitions: [],
        issues,
        stoppedAt: null,
        conditions: [],
      });
    }

    const rootRng = new Rng(seed);
    const idFactory = new IdFactory(seed);
    const clock = new TickClock({ msPerTick: spec.msPerTick ?? 100 });

    const transitions: Transition[] = [];
    const occurrences = new Map<string, number>();
    let current = given;
    let stoppedAt: number | null = null;

    for (let index = 0; index < spec.when.length; index += 1) {
      const call = spec.when[index] as StepCall;
      const step = this.#steps.get(call.step) as StepDefinition;
      const params = deepFreeze(deepClone(call.params ?? {}));

      // 단계별 하위 난수 스트림 — 같은 단계가 몇 번째로 불렸는지로 이름표를 만든다.
      // 뒤에 단계를 덧붙여도 앞 단계의 난수열이 밀리지 않는다 (V2 fork 규칙).
      const occurrence = occurrences.get(call.step) ?? 0;
      occurrences.set(call.step, occurrence + 1);
      const stepRng = rootRng.fork(`${call.step}#${occurrence}`);
      const tick = index === 0 ? clock.tick : clock.advance(1);

      const context: StepContext = {
        scenarioId: spec.id,
        stepId: call.step,
        index,
        tick,
        timeMs: clock.timeAt(tick),
        random: () => stepRng.nextFloat(),
        randomInt: (min, max) => stepRng.nextInt(min, max),
        nextId: (kind) => idFactory.next(kind),
      };

      const before = current;
      let after = current;
      let rejection: RunIssue | null = null;
      let error: RunIssue | null = null;

      try {
        after = deepFreeze(deepClone(step.apply(before, params, context)));
      } catch (thrown) {
        if (thrown instanceof StepRejection) {
          // 규칙이 막았다 — 상태는 전혀 바뀌지 않는다.
          rejection = { code: thrown.code, path: thrown.path, message: thrown.message };
          after = before;
        } else {
          error = {
            code: 'E_STEP_FAILED',
            path: `/when/${index}`,
            message: `단계 \`${call.step}\` 이 터졌다: ${(thrown as Error).message}`,
          };
          after = before;
        }
      }

      transitions.push({
        index,
        step: call.step,
        title: step.title,
        params,
        note: call.note ?? '',
        tick,
        timeMs: context.timeMs,
        before,
        after,
        changes: diffStates(before, after),
        rejection,
        error,
      });
      current = after;

      if (error) {
        stoppedAt = index;
        break;
      }
    }

    const conditions = spec.then.map((condition) => evaluateCondition(condition, given, transitions));

    return finish({
      spec,
      seed,
      seedLabel: seedLabel(components),
      given,
      transitions,
      issues: [],
      stoppedAt,
      conditions,
    });
  }

  /** 여러 시나리오를 선언 순서대로 실행한다. */
  runAll(specs: readonly ScenarioSpec[]): ScenarioReport[] {
    return specs.map((spec) => this.run(spec));
  }
}

function finish(parts: {
  spec: ScenarioSpec;
  seed: bigint;
  seedLabel: string;
  given: JsonObject;
  transitions: Transition[];
  issues: RunIssue[];
  stoppedAt: number | null;
  conditions: ScenarioReport['conditions'];
}): ScenarioReport {
  const last = parts.transitions[parts.transitions.length - 1];
  const final = last ? last.after : parts.given;
  const passed =
    parts.issues.length === 0 &&
    parts.stoppedAt === null &&
    parts.conditions.length > 0 &&
    parts.conditions.every((condition) => condition.passed);

  // 해시에는 "무엇이 일어났는가"만 넣는다 — 제목·설명이 바뀌었다고 리플레이가 깨졌다고 보면 안 된다.
  const body = {
    scenarioId: parts.spec.id,
    seed: parts.seed.toString(16),
    given: parts.given,
    transitions: parts.transitions.map((transition) => ({
      index: transition.index,
      step: transition.step,
      params: transition.params,
      tick: transition.tick,
      changes: transition.changes,
      rejection: transition.rejection,
      error: transition.error,
    })),
    final,
    conditions: parts.conditions.map((condition) => ({
      id: condition.id,
      passed: condition.passed,
      actual: condition.actual,
    })),
    issues: parts.issues,
  };

  return {
    scenarioId: parts.spec.id,
    title: parts.spec.title,
    seed: parts.seed.toString(16),
    seedLabel: parts.seedLabel,
    given: parts.given,
    transitions: parts.transitions,
    final,
    conditions: parts.conditions,
    issues: parts.issues,
    stoppedAt: parts.stoppedAt,
    passed,
    digest: sha256Tagged(canonicalJson(body)),
  };
}
