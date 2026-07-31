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
import { buildFoodWeb, consumersOf, populationOf } from './foodWeb.js';
import { NATURAL_LAWS } from './laws.js';
import {
  NATURAL_COMPONENT,
  NATURAL_VERB,
  type DeclineMark,
  type FoodWeb,
  type NaturalSample,
} from './types.js';

export interface S1World {
  components?: ComponentDefinition[];
  operations: StoreOperation[];
}

export interface S1Input {
  world: S1World;
  layout: SpatialLayout;
  /** 10진 문자열. K3 의 결정적 시드 조합에 그대로 넘어간다. */
  worldSeed: string;
  ticks: number;
  /** 법칙집을 갈아 끼울 수 있게 열어 둔다. 없으면 `NATURAL_LAWS`. */
  laws?: RuleSpec[];
}

export interface S1Output {
  finalTick: number;
  /** 0틱(초기 상태)부터 마지막 틱까지의 단면 */
  series: NaturalSample[];
  /** 처음 틱의 먹이 관계 — 세계가 어떻게 이어져 있는지의 지도 */
  initialWeb: FoodWeb;
  /** 마지막 틱의 먹이 관계 — 끊어진 자리가 여기 남는다 */
  finalWeb: FoodWeb;
  /** 개체군이 처음으로 줄어든 시점 (실체 id 오름차순) */
  declines: DeclineMark[];
  events: number;
  rejected: number;
  logHash: string;
  /** 일지를 원인부터 다시 굴려 얻은 사건 해시 — `logHash` 와 같아야 한다 (GI-12) */
  resimulatedLogHash: string;
  storeHash: string;
  audit: InvariantReport;
  digest: string;
}

export const S1_VERSION = '0.1.0';

export const S1_PURPOSE =
  '물리·생물·생태 상태를 공통 규칙으로 표현해, 먹이 관계와 시간만으로 개체군이 늘고 주는 과정을 사건으로 남긴다.';

export function buildWorld(world: S1World): EntityStore {
  const registry = ComponentRegistry.of(world.components ?? []);
  return applyOperations(EntityStore.empty(registry), world.operations).store;
}

/**
 * 이 틱에 제출할 자연의 의도들 — **순서가 곧 하루의 순서**다.
 *
 * 실체 id 오름차순으로 돌고, 한 실체 안에서는 언제나 `fester → settle → hunt|endure` 이다.
 * 순서를 바꾸면 같은 세계가 다르게 굴러가므로(GI-12) 여기서 한 번 못을 박는다.
 *
 * 무엇을 먹을지는 먹이 관계가 정하고, **먹어도 되는지는 법칙이 정한다.** 여기서 하는 일은
 * "먹이가 사정권에 있는가"를 보고 `hunt` 와 `endure` 를 가르는 것까지다.
 */
export function naturalIntentsFor(store: EntityStore, web: FoodWeb, tick: number): Intent[] {
  const prey = new Map(web.links.map((link) => [link.consumer, link.prey]));
  const intents: Intent[] = [];

  for (const organism of livingOrganisms(store)) {
    intents.push({ id: `t${tick}_${organism}_fester`, actor: organism, verb: NATURAL_VERB.FESTER });
    intents.push({ id: `t${tick}_${organism}_settle`, actor: organism, verb: NATURAL_VERB.SETTLE });
    const food = prey.get(organism);
    intents.push(
      food === undefined
        ? { id: `t${tick}_${organism}_endure`, actor: organism, verb: NATURAL_VERB.ENDURE }
        : { id: `t${tick}_${organism}_hunt`, actor: organism, verb: NATURAL_VERB.HUNT, targets: [food] },
    );
  }

  return intents;
}

/**
 * 살아 있는 생물 (id 오름차순).
 *
 * 허기를 가진 것만 하루를 산다 — 풀에게 허기를 주면 풀이 무엇인가를 먹어야 한다.
 * 개체군이 0 이 된 것은 더 이상 하루를 살지 않는다.
 */
export function livingOrganisms(store: EntityStore): EntityId[] {
  return store
    .withComponent(NATURAL_COMPONENT.HUNGER)
    .filter((id) => populationOf(store, id) > 0)
    .slice()
    .sort();
}

export function executeS1(input: S1Input): S1Output {
  const initial = buildWorld(input.world);
  const laws = input.laws ?? NATURAL_LAWS;
  const runtime = new WorldRuntime({
    store: initial,
    rules: RuleBook.of(laws),
    worldSeed: input.worldSeed,
  });

  const sampleAt = (tick: number, web: FoodWeb, applied: string[], rejected: number): NaturalSample => ({
    tick,
    population: reading(runtime.store, NATURAL_COMPONENT.POPULATION, 'count'),
    hunger: reading(runtime.store, NATURAL_COMPONENT.HUNGER, 'value'),
    mass: reading(runtime.store, NATURAL_COMPONENT.MASS, 'kg'),
    disease: reading(runtime.store, NATURAL_COMPONENT.DISEASE, 'load'),
    temperature: reading(runtime.store, NATURAL_COMPONENT.TEMPERATURE, 'celsius'),
    links: web.links,
    appliedLaws: applied,
    rejected,
  });

  const initialWeb = buildFoodWeb(initial, SpatialIndex.build(initial, input.layout));
  const series: NaturalSample[] = [sampleAt(0, initialWeb, [], 0)];
  let rejectedTotal = 0;

  for (let step = 1; step <= input.ticks; step += 1) {
    runtime.advance();
    const web = buildFoodWeb(runtime.store, SpatialIndex.build(runtime.store, input.layout));
    const applied = new Set<string>();
    let rejected = 0;

    for (const intent of naturalIntentsFor(runtime.store, web, runtime.tick)) {
      const result = runtime.submit(intent);
      if (result.accepted && result.appliedRuleId !== null) applied.add(result.appliedRuleId);
      else if (!result.accepted) rejected += 1;
    }

    rejectedTotal += rejected;
    series.push(sampleAt(runtime.tick, web, [...applied].sort(), rejected));
  }

  // 일지를 **원인부터** 다시 굴린다. 사건에 적힌 결과를 되짚는 것(GI-01)과 다른 확인이다 (GI-12).
  const resimulated = resimulate(initial, runtime.journal(), {
    rules: RuleBook.of(laws),
    worldSeed: input.worldSeed,
    untilTick: runtime.tick,
  });

  const finalWeb = buildFoodWeb(runtime.store, SpatialIndex.build(runtime.store, input.layout));
  const body = {
    series,
    initialWeb,
    finalWeb,
    declines: declinesOf(series),
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

/**
 * 시계열에서 각 실체의 **돌아오지 못한 감소**가 시작된 틱을 뽑는다.
 *
 * 첫 감소로 재면 안 된다 — 살아 있는 개체군은 잡아먹히고 새끼를 치며 오르내리므로 첫 감소는
 * 그날의 물결일 뿐이다. 정점을 마지막으로 찍은 다음 틱부터가 돌아오지 못하는 감소다.
 */
export function declinesOf(series: readonly NaturalSample[]): DeclineMark[] {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) return [];

  return Object.keys(first.population)
    .sort()
    .map((entity) => {
      const counts = series.map((sample) => sample.population[entity] ?? 0);
      const peak = counts.reduce((best, count) => (count > best ? count : best), counts[0] as number);
      const peakIndex = counts.lastIndexOf(peak);
      const end = counts[counts.length - 1] as number;
      const after = series[peakIndex + 1];
      return {
        entity,
        start: first.population[entity] ?? 0,
        peak,
        end,
        peakTick: (series[peakIndex] as NaturalSample).tick,
        declineTick: end < peak && after ? after.tick : null,
      };
    });
}

/** 사건 로그에서 특정 법칙이 적용된 사건들 — 화면과 테스트가 같은 함수로 읽는다. */
export function eventsByLaw(events: readonly WorldEvent[], lawId: string): WorldEvent[] {
  return events.filter((event) => event.appliedRuleIds.includes(lawId));
}

function reading(store: EntityStore, component: string, field: string): Record<EntityId, number> {
  const out: Record<EntityId, number> = {};
  for (const id of store.withComponent(component).slice().sort()) {
    const value = store.component(id, component)?.[field];
    if (typeof value === 'number') out[id] = Math.round(value * 1000) / 1000;
  }
  return out;
}

export function createS1Module(
  scenarios: ModuleDefinition<S1Input, S1Output>['scenarios'],
): ModuleDefinition<S1Input, S1Output> {
  return {
    id: 'S1',
    version: S1_VERSION,
    purpose: S1_PURPOSE,
    dependencies: ['V0', 'K0', 'K1', 'K2', 'K3', 'S0'],
    validateInput,
    execute: (input: S1Input, _context: ModuleContext) => executeS1(input),
    validateOutput,
    scenarios,
  };
}

export function validateInput(input: unknown): S1Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('S1 입력은 객체여야 한다.');
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
    throw new TypeError('`layout` 은 객체여야 한다 — 먹이 관계는 거리를 본다.');
  }
  if (typeof value['worldSeed'] !== 'string' || !/^\d+$/.test(value['worldSeed'])) {
    throw new TypeError('`worldSeed` 는 10진 문자열이어야 한다.');
  }
  if (!Number.isInteger(value['ticks']) || (value['ticks'] as number) < 0) {
    throw new TypeError('`ticks` 는 0 이상의 정수여야 한다.');
  }
  return input as S1Input;
}

/** MODULE.yaml 의 invariants 중 **출력만 보고** 판정할 수 있는 것들. */
export function validateOutput(output: S1Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `S1 출력/${path}`, message });
  };

  if (!output.audit.everyChangeHasAnEvent) {
    at(
      'audit',
      'E_INVARIANT_every_natural_change_must_have_a_causing_event',
      `사건 로그로 되짚은 상태와 실제 상태가 다르다 (GI-01): ${output.audit.replayedStoreHash} ≠ ${output.audit.storeHash}`,
    );
  }
  if (!output.audit.replayIsIdentical || output.resimulatedLogHash !== output.logHash) {
    at(
      'audit',
      'E_INVARIANT_identical_world_and_seed_must_produce_identical_series',
      `일지를 다시 굴린 사건 해시가 다르다 (GI-12): ${output.resimulatedLogHash} ≠ ${output.logHash}`,
    );
  }
  if (!output.audit.logIsAppendOnly) {
    at('audit', 'E_INVARIANT_law_order_must_be_deterministic', '사건 로그가 덧붙이기만 되지 않았다');
  }

  output.series.forEach((sample, index) => {
    if (sample.tick !== index) {
      at(`series/${index}`, 'E_INVARIANT_law_order_must_be_deterministic', `틱이 건너뛰었다: ${sample.tick}`);
    }
    for (const [entity, count] of Object.entries(sample.population)) {
      if (count < 0) {
        at(
          `series/${index}/population/${entity}`,
          'E_INVARIANT_population_must_not_fall_below_zero',
          `개체군이 음수다: ${count}`,
        );
      }
    }
    for (const link of sample.links) {
      if (link.available <= 0) {
        at(
          `series/${index}/links/${link.consumer}`,
          'E_INVARIANT_food_must_be_within_the_habitat_to_be_eaten',
          `${link.prey} 는 바닥났는데 먹이로 이어져 있다`,
        );
      }
    }
  });

  for (const gap of [...output.initialWeb.gaps, ...output.finalWeb.gaps]) {
    if (gap.message === '') {
      at(`web/${gap.consumer}`, 'E_INVARIANT_food_must_be_within_the_habitat_to_be_eaten', '먹이가 없는 이유가 없다');
    }
  }

  return issues;
}

/** 먹이 사슬의 위·아래를 골라 "누가 먼저 줄었는가"를 판정한다 (대표 검증). */
export function declineOrder(output: S1Output, lower: EntityId, upper: EntityId): {
  lowerTick: number | null;
  upperTick: number | null;
  delay: number | null;
  ordered: boolean;
} {
  const find = (id: EntityId): number | null =>
    output.declines.find((mark) => mark.entity === id)?.declineTick ?? null;
  const lowerTick = find(lower);
  const upperTick = find(upper);
  const delay = lowerTick !== null && upperTick !== null ? upperTick - lowerTick : null;
  return { lowerTick, upperTick, delay, ordered: delay !== null && delay > 0 };
}

export { buildFoodWeb, consumersOf, populationOf };
