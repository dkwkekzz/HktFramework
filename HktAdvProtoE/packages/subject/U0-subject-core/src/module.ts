import { sha256Tagged } from '@hkt/v0-module-contract';
import type { ModuleContext, ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import {
  ComponentRegistry,
  EntityStore,
  applyOperations,
  type ComponentDefinition,
  type EntityId,
  type StoreOperation,
} from '@hkt/k0-entity-state';
import { RuleBook, type Intent, type RuleSpec } from '@hkt/k2-rule-transaction';
import { WorldRuntime, resimulate, type InvariantReport, type WorldEvent } from '@hkt/k3-event-replay';
import { SpatialIndex, type SpatialLayout } from '@hkt/s0-spatial-affordance';
import { NATURAL_COMPONENT, buildFoodWeb, naturalIntentsFor } from '@hkt/s1-natural-state';
import { SUBJECT_LAWS } from './laws.js';
import { SUBJECT_NEEDS, TEMPERAMENT } from './needs.js';
import { compareSubjects, rankNeeds, traceOf } from './rank.js';
import { bodyIdsOf, readSubject, subjectIds } from './subject.js';
import {
  NEED_CEILING,
  SUBJECT_COMPONENT,
  SUBJECT_VERB,
  type NeedRanking,
  type NeedSpec,
  type SubjectRejection,
  type SubjectSample,
  type SubjectView,
  type TemperamentSpec,
} from './types.js';

export interface U0World {
  components?: ComponentDefinition[];
  operations: StoreOperation[];
}

export interface U0Input {
  world: U0World;
  /** S0 — 몸이 놓인 자리. 자연 법칙을 함께 굴릴 때 먹이 관계가 이것을 본다. */
  layout: SpatialLayout;
  /** 10진 문자열. K3 의 결정적 시드 조합에 그대로 넘어간다. */
  worldSeed: string;
  ticks: number;
  /** 주체 법칙집을 갈아 끼울 수 있게 열어 둔다. 없으면 `SUBJECT_LAWS`. */
  laws?: RuleSpec[];
  /**
   * 함께 굴릴 자연 법칙 (S1). 넣지 않으면 몸은 저절로 변하지 않는다 —
   * 우선순위만 보는 장면에서는 몸이 가만히 있는 편이 대비를 선명하게 한다.
   */
  naturalLaws?: RuleSpec[];
  /** 욕구 책. 없으면 `SUBJECT_NEEDS`. */
  needBook?: NeedSpec[];
  /** 기질. 없으면 `TEMPERAMENT`. */
  temperament?: TemperamentSpec;
}

export interface U0Output {
  finalTick: number;
  /** 0틱(초기 상태)부터 마지막 틱까지의 단면 */
  series: SubjectSample[];
  /** 마지막 틱의 주체 상태 (id 오름차순) */
  subjects: SubjectView[];
  /** 이 세계에서 한 번이라도 적용된 법칙 id (오름차순) */
  appliedLaws: string[];
  /** 주체의 상태를 바꾼 델타의 경로 (오름차순·중복 없음) */
  subjectDeltaPaths: string[];
  /** 그 델타를 일으킨 법칙 id (오름차순·중복 없음) */
  subjectDeltaLaws: string[];
  events: number;
  rejected: number;
  logHash: string;
  /** 일지를 원인부터 다시 굴려 얻은 사건 해시 — `logHash` 와 같아야 한다 (GI-12) */
  resimulatedLogHash: string;
  storeHash: string;
  audit: InvariantReport;
  digest: string;
}

export const U0_VERSION = '0.1.0';

export const U0_PURPOSE =
  '사람·생물·조직·신이 목적을 만들 수 있는 공통 주체 구조를 제공한다 — 같은 몸 상태에서도 가치와 성격이 다르면 무엇을 먼저 돌볼지가 달라진다.';

export function buildWorld(world: U0World): EntityStore {
  const registry = ComponentRegistry.of(world.components ?? []);
  return applyOperations(EntityStore.empty(registry), world.operations).store;
}

/**
 * 이 틱에 주체들이 제출할 의도 — **순서가 곧 하루의 순서**다.
 *
 * 주체 id 오름차순으로 돌고, 한 주체 안에서는 언제나 **몸마다 `sense_hunger` → `sense_harm`**,
 * 그 뒤에 주체 하나에 한 번 `weigh_means` 다. 순서를 바꾸면 같은 세계가 다르게 굴러간다(GI-12).
 *
 * 몸이 여럿이면 몸마다 의도가 하나씩 나간다. 조직의 몸은 구성원이므로, 구성원이 넷이면 조직은
 * 네 번 느낀다 — 그리고 쓰러진 구성원을 통한 감각은 법칙이 막는다(GI-08).
 *
 * 무엇을 느낄지는 여기서 정하지 않는다. **느낀 것이 무엇이 되는지는 법칙이 정한다.**
 */
export function subjectIntentsFor(store: EntityStore, tick: number): Intent[] {
  const intents: Intent[] = [];
  for (const subject of subjectIds(store)) {
    for (const body of bodyIdsOf(store, subject)) {
      if (!store.has(body)) continue;
      const bindings = { body };
      intents.push({
        id: `t${tick}_${subject}_${body}_hunger`,
        actor: subject,
        verb: SUBJECT_VERB.SENSE_HUNGER,
        bindings,
      });
      intents.push({
        id: `t${tick}_${subject}_${body}_harm`,
        actor: subject,
        verb: SUBJECT_VERB.SENSE_HARM,
        bindings,
      });
    }
    // 수단의 저울질에는 몸이 필요 없다 — 손에 쥔 것은 몸 밖에도 있다.
    intents.push({ id: `t${tick}_${subject}_means`, actor: subject, verb: SUBJECT_VERB.WEIGH_MEANS });
  }
  return intents;
}

export function executeU0(input: U0Input): U0Output {
  const initial = buildWorld(input.world);
  const subjectLaws = input.laws ?? SUBJECT_LAWS;
  const naturalLaws = input.naturalLaws ?? [];
  const book = input.needBook ?? SUBJECT_NEEDS;
  const temperament = input.temperament ?? TEMPERAMENT;
  const rules = RuleBook.of([...naturalLaws, ...subjectLaws]);

  const runtime = new WorldRuntime({ store: initial, rules, worldSeed: input.worldSeed });

  const sampleAt = (tick: number, applied: Set<string>, rejections: SubjectRejection[]): SubjectSample => {
    const views: Record<EntityId, SubjectView> = {};
    const rankings: Record<EntityId, NeedRanking> = {};
    for (const id of subjectIds(runtime.store)) {
      const view = readSubject(runtime.store, id);
      views[id] = view;
      rankings[id] = rankNeeds(view, book, temperament);
    }
    return {
      tick,
      rankings,
      views,
      bodies: bodyReadings(runtime.store),
      appliedLaws: [...applied].sort(),
      rejections,
    };
  };

  const series: SubjectSample[] = [sampleAt(0, new Set(), [])];
  const appliedEver = new Set<string>();
  let rejectedTotal = 0;

  for (let step = 1; step <= input.ticks; step += 1) {
    runtime.advance();
    const applied = new Set<string>();
    const rejections: SubjectRejection[] = [];

    // ① 몸이 먼저 하루를 산다 — 굶고, 먹고, 앓는다.
    //
    //    주체가 먼저 느끼게 하면 언제나 **어제의 몸**을 느끼게 된다. 오늘 먹은 개가 오늘도
    //    배고파하는 셈이다. 몸이 먼저 사는 쪽이 인과의 방향과 맞는다.
    for (const intent of naturalIntents(runtime.store, input.layout, naturalLaws, runtime.tick)) {
      const result = runtime.submit(intent);
      if (result.accepted && result.appliedRuleId !== null) applied.add(result.appliedRuleId);
      else if (!result.accepted) rejectedTotal += 1;
    }

    // ② 그 몸을 주체가 느낀다.
    for (const intent of subjectIntentsFor(runtime.store, runtime.tick)) {
      const result = runtime.submit(intent);
      if (result.accepted && result.appliedRuleId !== null) applied.add(result.appliedRuleId);
      else if (!result.accepted) {
        rejectedTotal += 1;
        rejections.push(describeRejection(intent, result.rejection));
      }
    }

    for (const law of applied) appliedEver.add(law);
    series.push(sampleAt(runtime.tick, applied, rejections));
  }

  // 일지를 **원인부터** 다시 굴린다. 사건에 적힌 결과를 되짚는 것(GI-01)과 다른 확인이다 (GI-12).
  const resimulated = resimulate(initial, runtime.journal(), {
    rules,
    worldSeed: input.worldSeed,
    untilTick: runtime.tick,
  });

  const marks = subjectMarks(runtime.log());
  const body = {
    series,
    subjects: subjectIds(runtime.store).map((id) => readSubject(runtime.store, id)),
    appliedLaws: [...appliedEver].sort(),
    subjectDeltaPaths: marks.paths,
    subjectDeltaLaws: marks.laws,
  };

  return {
    ...body,
    finalTick: runtime.tick,
    events: runtime.log().length,
    rejected: rejectedTotal,
    logHash: runtime.logHash(),
    resimulatedLogHash: resimulated.logHash(),
    storeHash: runtime.store.hash(),
    audit: runtime.audit(initial, resimulated),
    digest: sha256Tagged(JSON.stringify(body)),
  };
}

/** 자연 법칙이 없으면 몸은 하루를 살지 않는다 — 그 경우 먹이 관계도 세우지 않는다. */
function naturalIntents(
  store: EntityStore,
  layout: SpatialLayout,
  naturalLaws: readonly RuleSpec[],
  tick: number,
): Intent[] {
  if (naturalLaws.length === 0) return [];
  return naturalIntentsFor(store, buildFoodWeb(store, SpatialIndex.build(store, layout)), tick);
}

function describeRejection(
  intent: Intent,
  rejection: { code: string; path: string; message: string } | null,
): SubjectRejection {
  return {
    intentId: intent.id,
    actor: intent.actor,
    verb: intent.verb,
    code: rejection?.code ?? 'E_UNKNOWN',
    path: rejection?.path ?? '',
    message: rejection?.message ?? '',
  };
}

/** 몸의 자연 상태 단면 — 화면과 검증이 "같은 몸인가"를 눈으로 대조하는 자리. */
function bodyReadings(store: EntityStore): Record<EntityId, Record<string, number>> {
  const fields: [string, string][] = [
    [NATURAL_COMPONENT.HUNGER, 'value'],
    [NATURAL_COMPONENT.POPULATION, 'count'],
    [NATURAL_COMPONENT.DAMAGE, 'wounds'],
    [NATURAL_COMPONENT.DISEASE, 'load'],
    [NATURAL_COMPONENT.MASS, 'kg'],
    [NATURAL_COMPONENT.TEMPERATURE, 'celsius'],
  ];
  const out: Record<EntityId, Record<string, number>> = {};
  for (const id of store.withComponent(NATURAL_COMPONENT.HUNGER).slice().sort()) {
    const reading: Record<string, number> = {};
    for (const [component, field] of fields) {
      const value = store.component(id, component)?.[field];
      if (typeof value === 'number') reading[component] = Math.round(value * 1000) / 1000;
    }
    out[id] = reading;
  }
  return out;
}

/**
 * 사건 로그에서 **주체를 바꾼 자리**만 골라낸다.
 *
 * GI-01 의 확인은 K3 의 감사가 이미 한다. 여기서 뽑는 것은 그 다음 질문의 답이다 —
 * "주체가 바뀌었다면, 그것을 바꾼 법칙의 이름이 무엇인가."
 */
export function subjectMarks(events: readonly WorldEvent[]): { paths: string[]; laws: string[] } {
  const owned = new Set<string>(Object.values(SUBJECT_COMPONENT));
  const paths = new Set<string>();
  const laws = new Set<string>();
  for (const event of events) {
    let touched = false;
    for (const delta of event.stateDelta) {
      const component = delta.path.split('/')[3];
      if (component === undefined || !owned.has(component)) continue;
      paths.add(delta.path);
      touched = true;
    }
    if (touched) for (const rule of event.appliedRuleIds) laws.add(rule);
  }
  return { paths: [...paths].sort(), laws: [...laws].sort() };
}

export function createU0Module(
  scenarios: ModuleDefinition<U0Input, U0Output>['scenarios'],
): ModuleDefinition<U0Input, U0Output> {
  return {
    id: 'U0',
    version: U0_VERSION,
    purpose: U0_PURPOSE,
    dependencies: ['V0', 'K0', 'K1', 'K2', 'K3', 'S0', 'S1'],
    validateInput,
    execute: (input: U0Input, _context: ModuleContext) => executeU0(input),
    validateOutput,
    scenarios,
  };
}

export function validateInput(input: unknown): U0Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('U0 입력은 객체여야 한다.');
  }
  const value = input as Record<string, unknown>;
  const world = value['world'];
  if (world === null || typeof world !== 'object' || Array.isArray(world)) {
    throw new TypeError('`world` 는 객체여야 한다.');
  }
  if (!Array.isArray((world as { operations?: unknown }).operations)) {
    throw new TypeError('`world.operations` 는 배열이어야 한다.');
  }
  if (value['layout'] === null || typeof value['layout'] !== 'object') {
    throw new TypeError('`layout` 은 객체여야 한다 — 몸은 자리를 가진다.');
  }
  if (typeof value['worldSeed'] !== 'string' || !/^\d+$/.test(value['worldSeed'])) {
    throw new TypeError('`worldSeed` 는 10진 문자열이어야 한다.');
  }
  if (!Number.isInteger(value['ticks']) || (value['ticks'] as number) < 0) {
    throw new TypeError('`ticks` 는 0 이상의 정수여야 한다.');
  }
  if (value['needBook'] !== undefined && !Array.isArray(value['needBook'])) {
    throw new TypeError('`needBook` 은 배열이어야 한다.');
  }
  return input as U0Input;
}

/** MODULE.yaml 의 invariants 중 **출력만 보고** 판정할 수 있는 것들. */
export function validateOutput(output: U0Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `U0 출력/${path}`, message });
  };

  if (!output.audit.everyChangeHasAnEvent) {
    at(
      'audit',
      'E_INVARIANT_every_subject_change_must_have_a_causing_event',
      `사건 로그로 되짚은 상태와 실제 상태가 다르다 (GI-01): ${output.audit.replayedStoreHash} ≠ ${output.audit.storeHash}`,
    );
  }
  if (!output.audit.replayIsIdentical || output.resimulatedLogHash !== output.logHash) {
    at(
      'audit',
      'E_INVARIANT_identical_subject_and_seed_must_produce_identical_ranking',
      `일지를 다시 굴린 사건 해시가 다르다 (GI-12): ${output.resimulatedLogHash} ≠ ${output.logHash}`,
    );
  }
  if (!output.audit.logIsAppendOnly) {
    at('audit', 'E_INVARIANT_ranking_must_be_total_and_deterministic', '사건 로그가 덧붙이기만 되지 않았다');
  }
  for (const law of output.subjectDeltaLaws) {
    if (law.startsWith('u0_')) continue;
    at(
      'subjectDeltaLaws',
      'E_INVARIANT_need_urgency_must_come_from_the_body_through_a_law',
      `주체의 상태를 U0 의 법칙이 아닌 것이 바꿨다: ${law}`,
    );
  }

  output.series.forEach((sample, index) => {
    if (sample.tick !== index) {
      at(
        `series/${index}`,
        'E_INVARIANT_ranking_must_be_total_and_deterministic',
        `틱이 건너뛰었다: ${sample.tick}`,
      );
    }
    for (const [id, view] of Object.entries(sample.views)) {
      checkBounds(at, `series/${index}/views/${id}`, view);
    }
    for (const [id, ranking] of Object.entries(sample.rankings)) {
      checkRanking(at, `series/${index}/rankings/${id}`, ranking, sample.views[id]);
    }
  });

  return issues;
}

type Report = (path: string, code: string, message: string) => void;

function checkBounds(at: Report, path: string, view: SubjectView): void {
  for (const [need, level] of Object.entries(view.needs)) {
    if (level < 0 || level > NEED_CEILING) {
      at(
        `${path}/needs/${need}`,
        'E_INVARIANT_state_must_stay_inside_its_declared_bounds',
        `욕구가 0~${NEED_CEILING} 밖이다: ${level}`,
      );
    }
  }
  for (const [label, record] of [
    ['values', view.values],
    ['traits', view.traits],
    ['emotions', view.emotions],
  ] as const) {
    for (const [key, level] of Object.entries(record)) {
      if (level < 0 || level > 1) {
        at(
          `${path}/${label}/${key}`,
          'E_INVARIANT_state_must_stay_inside_its_declared_bounds',
          `${label} 는 0~1 이어야 한다: ${level}`,
        );
      }
    }
  }
}

function checkRanking(at: Report, path: string, ranking: NeedRanking, view: SubjectView | undefined): void {
  if (ranking.order.length !== new Set(ranking.order).size) {
    at(`${path}/order`, 'E_INVARIANT_ranking_must_be_total_and_deterministic', '같은 욕구가 두 번 들어 있다');
  }
  if (ranking.temperature <= 0) {
    at(`${path}/temperature`, 'E_INVARIANT_state_must_stay_inside_its_declared_bounds', '온도가 0 이하다');
  }

  const sum = ranking.scores.reduce((total, score) => total + score.probability, 0);
  if (ranking.scores.length > 0 && Math.abs(sum - 1) > 1e-6) {
    at(`${path}/probability`, 'E_INVARIANT_ranking_must_be_total_and_deterministic', `확률의 합이 1 이 아니다: ${sum}`);
  }

  ranking.scores.forEach((score, index) => {
    const previous = ranking.scores[index - 1];
    if (previous) {
      const outOfOrder =
        previous.activation < score.activation ||
        (previous.activation === score.activation && previous.needId > score.needId);
      if (outOfOrder) {
        at(
          `${path}/scores/${index}`,
          'E_INVARIANT_ranking_must_be_total_and_deterministic',
          `순서가 활성도 내림차순·id 오름차순이 아니다: ${previous.needId} → ${score.needId}`,
        );
      }
    }
    if (score.rank !== index + 1) {
      at(`${path}/scores/${index}/rank`, 'E_INVARIANT_ranking_must_be_total_and_deterministic', '순위가 어긋났다');
    }

    // 점수는 반드시 자기가 무엇으로 만들어졌는지 말해야 한다.
    const named = score.terms.map((term) => term.id).join('');
    if (named !== 'NVT') {
      at(
        `${path}/scores/${index}/terms`,
        'E_INVARIANT_every_score_must_name_the_terms_it_is_made_of',
        `항이 N·V·T 셋이 아니다: ${named || '없음'}`,
      );
    }
    const rebuilt = score.terms.reduce((total, term) => total + term.value, 0);
    if (Math.abs(rebuilt - score.activation) > 1e-6) {
      at(
        `${path}/scores/${index}/activation`,
        'E_INVARIANT_every_score_must_name_the_terms_it_is_made_of',
        `항의 합이 활성도와 다르다: ${rebuilt} ≠ ${score.activation}`,
      );
    }

    // 주체가 갖지 않은 것을 근거로 삼지 않았는가 (GI-02).
    if (!view) return;
    for (const term of score.terms) {
      if (term.id === 'N') continue;
      const owned = term.id === 'V' ? view.values : view.traits;
      for (const contribution of term.contributions) {
        if (contribution.level !== 0 && !(contribution.source in owned)) {
          at(
            `${path}/scores/${index}/terms/${term.id}/${contribution.source}`,
            'E_INVARIANT_subject_must_judge_from_its_own_state_not_from_the_world',
            `주체가 갖지 않은 값을 근거로 삼았다: ${contribution.source}`,
          );
        }
      }
    }
  });
}

export { compareSubjects, rankNeeds, readSubject, subjectIds, traceOf };
