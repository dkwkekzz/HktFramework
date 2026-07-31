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
import { BARRIER_COMPONENT, SpatialIndex, barrierOf, type SpatialLayout } from '@hkt/s0-spatial-affordance';
import { buildFoodWeb, naturalIntentsFor } from '@hkt/s1-natural-state';
import { subjectIntentsFor } from '@hkt/u0-subject-core';
import { CHANNEL_BOOK, PHENOMENON_BOOK } from './channels.js';
import { perceiveAll, receiveTestimonies, reportFor, round } from './perceive.js';
import { phenomenaOf } from './phenomena.js';
import { buildSensorium, type Sensorium } from './sensorium.js';
import {
  U1_CHANNELS,
  type ChannelSpec,
  type PerceivedPhenomenon,
  type PerceiverReport,
  type PerceptionMiss,
  type PerceptionSample,
  type Phenomenon,
  type PhenomenonGap,
  type PhenomenonSpec,
  type StagePlacement,
  type Testimony,
} from './types.js';

export interface U1World {
  components?: ComponentDefinition[];
  operations: StoreOperation[];
}

/** 세계에서 일어나는 일 한 줄 — 장면이 쓰는 대본이다. */
export interface ScriptedIntent {
  tick: number;
  intent: Intent;
}

export interface U1Input {
  world: U1World;
  layout: SpatialLayout;
  /** 10진 문자열. K3 의 결정적 시드 조합에 그대로 넘어간다. */
  worldSeed: string;
  ticks: number;
  /**
   * 세계에서 무슨 일이 일어나는가 — **U1 은 사건을 만들지 않는다.**
   *
   * 장면이 대본을 주고 K2·K3 이 그것을 사건으로 만들며, U1 은 그 사건을 지각으로 바꾼다.
   * 지각 모듈이 스스로 사건을 지어내면 무엇을 지각하는지 검증할 수 없다.
   */
  script?: ScriptedIntent[];
  /** 대본이 쓰는 규칙 (장면이 준다) */
  rules?: RuleSpec[];
  /** 함께 굴릴 자연 법칙 (S1) */
  naturalLaws?: RuleSpec[];
  /** 함께 굴릴 주체 법칙 (U0) */
  subjectLaws?: RuleSpec[];
  channelBook?: ChannelSpec[];
  phenomenonBook?: PhenomenonSpec[];
  /** 사람이 들고 오는 것 (보고·소문) */
  testimonies?: Testimony[];
}

export interface U1Output {
  finalTick: number;
  series: PerceptionSample[];
  /** 세계가 남긴 모든 현상 (id 오름차순) */
  phenomena: Phenomenon[];
  /** 어떤 주체에게든 닿은 것 전부 */
  perceived: PerceivedPhenomenon[];
  /** 닿지 못한 것과 그 이유 */
  misses: PerceptionMiss[];
  /** 현상으로 만들 수 없었던 흔적 */
  gaps: PhenomenonGap[];
  /** 주체별 요약 (id 오름차순) */
  reports: PerceiverReport[];
  /** 무대의 자리 (id 오름차순) — 화면이 세계를 그리기 위한 것이다. 판정에 쓰지 않는다 */
  stage: StagePlacement[];
  events: number;
  /** 흔적을 하나도 남기지 않은 사건 수 — 아무도 모르는 일이 있다는 사실 */
  silentEvents: number;
  logHash: string;
  resimulatedLogHash: string;
  /** 지각 **전**의 세계 해시 */
  storeHash: string;
  /** 지각 **후**의 세계 해시 — 같아야 한다. 지각은 세계를 바꾸지 않는다 */
  storeHashAfterPerceiving: string;
  audit: InvariantReport;
  digest: string;
}

export const U1_VERSION = '0.1.0';

export const U1_PURPOSE =
  '실제 사건을 주체가 감지할 수 있는 현상으로 바꾸고, 감각별로 걸러 각 주체가 무엇을 알게 되는지를 정한다.';

export function buildWorld(world: U1World): EntityStore {
  const registry = ComponentRegistry.of(world.components ?? []);
  return applyOperations(EntityStore.empty(registry), world.operations).store;
}

export function executeU1(input: U1Input): U1Output {
  const initial = buildWorld(input.world);
  const naturalLaws = input.naturalLaws ?? [];
  const subjectLaws = input.subjectLaws ?? [];
  const sceneRules = input.rules ?? [];
  const channels = input.channelBook ?? CHANNEL_BOOK;
  const book = input.phenomenonBook ?? PHENOMENON_BOOK;
  const testimonies = input.testimonies ?? [];
  const rules = RuleBook.of([...naturalLaws, ...subjectLaws, ...sceneRules]);

  const runtime = new WorldRuntime({ store: initial, rules, worldSeed: input.worldSeed });
  const script = [...(input.script ?? [])].sort((left, right) =>
    left.tick === right.tick ? (left.intent.id < right.intent.id ? -1 : 1) : left.tick - right.tick,
  );

  const series: PerceptionSample[] = [];
  const allPhenomena: Phenomenon[] = [];
  const allPerceived: PerceivedPhenomenon[] = [];
  const allMisses: PerceptionMiss[] = [];
  const allGaps: PhenomenonGap[] = [];
  /** 지금까지 누가 무엇을 지각했는가 — 전언이 이것을 본다 (어제 본 것을 오늘 전한다) */
  const perceivedEver = new Set<string>();
  let readEvents = 0;

  for (let step = 1; step <= input.ticks; step += 1) {
    runtime.advance();

    // ① 세계가 하루를 산다. 순서는 U0 이 정한 것과 같다 — 자연이 먼저, 주체가 다음, 대본이 끝.
    for (const intent of naturalIntents(runtime.store, input.layout, naturalLaws, runtime.tick)) {
      runtime.submit(intent);
    }
    if (subjectLaws.length > 0) {
      for (const intent of subjectIntentsFor(runtime.store, runtime.tick)) runtime.submit(intent);
    }
    for (const entry of script) {
      if (entry.tick === runtime.tick) runtime.submit(entry.intent);
    }

    // ② 그 하루가 남긴 사건만 골라 현상으로 바꾼다.
    const fresh = runtime.log().slice(readEvents);
    readEvents = runtime.log().length;

    const sensorium = buildSensorium(runtime.store);
    const { phenomena, gaps } = phenomenaOf(fresh, book, sensorium);

    // ③ 감각별로 거른다. **여기서 세계를 만지지 않는다** — 지각은 읽기다.
    const spatial = perceiveAll(sensorium, phenomena, channels);
    for (const entry of spatial.perceived) perceivedEver.add(`${entry.perceiverId}:${entry.phenomenonId}`);

    // ④ 사람이 들고 온 것. 공간을 건너오지 않으므로 지금까지의 모든 현상을 가리킬 수 있다.
    const known = new Map([...allPhenomena, ...phenomena].map((entry) => [entry.id, entry]));
    const spoken = receiveTestimonies(
      sensorium,
      testimonies.filter((entry) => entry.tick === runtime.tick),
      known,
      perceivedEver,
      channels,
    );
    for (const entry of spoken.perceived) perceivedEver.add(`${entry.perceiverId}:${entry.phenomenonId}`);

    const perceived = [...spatial.perceived, ...spoken.perceived];
    const misses = [...spatial.misses, ...spoken.misses];

    allPhenomena.push(...phenomena);
    allPerceived.push(...perceived);
    allMisses.push(...misses);
    allGaps.push(...gaps);

    series.push({
      tick: runtime.tick,
      phenomena,
      perceived: groupByPerceiver(perceived),
      misses,
      events: fresh.length,
    });
  }

  const resimulated = resimulate(initial, runtime.journal(), {
    rules,
    worldSeed: input.worldSeed,
    untilTick: runtime.tick,
  });

  // 지각을 다 하고 난 뒤의 세계. 한 칸도 달라지지 않아야 한다.
  const storeHashAfterPerceiving = runtime.store.hash();
  const finalSensorium = buildSensorium(runtime.store);
  const reports = finalSensorium
    .subjects()
    .map((subject) =>
      reportFor(subject, finalSensorium.kindOf(subject), allPhenomena, allPerceived, allMisses),
    );

  const body = {
    series,
    phenomena: allPhenomena,
    perceived: allPerceived,
    misses: allMisses,
    gaps: allGaps,
    reports,
    stage: stageOf(runtime.store, finalSensorium, allPhenomena),
  };

  return {
    ...body,
    finalTick: runtime.tick,
    events: runtime.log().length,
    silentEvents: runtime.log().filter((event) => event.emittedPhenomena.length === 0).length,
    logHash: runtime.logHash(),
    resimulatedLogHash: resimulated.logHash(),
    storeHash: runtime.store.hash(),
    storeHashAfterPerceiving,
    audit: runtime.audit(initial, resimulated),
    digest: sha256Tagged(JSON.stringify(body)),
  };
}

function naturalIntents(
  store: EntityStore,
  layout: SpatialLayout,
  naturalLaws: readonly RuleSpec[],
  tick: number,
): Intent[] {
  if (naturalLaws.length === 0) return [];
  return naturalIntentsFor(store, buildFoodWeb(store, SpatialIndex.build(store, layout)), tick);
}

/**
 * 무대의 자리를 모은다 — 현상이 난 곳 · 느끼는 몸 · 막는 것.
 *
 * 화면이 세계를 그리기 위한 것이며 판정에는 쓰지 않는다. 세계 전체를 내보내지 않고 **이 장면에
 * 실제로 관여한 것만** 담는다 — 화면이 무대를 그릴 수 있을 만큼이지 그 이상은 아니다.
 */
function stageOf(
  store: EntityStore,
  sensorium: Sensorium,
  phenomena: readonly Phenomenon[],
): StagePlacement[] {
  const placements = new Map<EntityId, StagePlacement>();
  const put = (id: EntityId, role: StagePlacement['role'], opaque = false): void => {
    if (placements.has(id)) return;
    const at = sensorium.positionOf(id);
    if (!at) return;
    placements.set(id, {
      id,
      at: [at.x, at.y, at.z],
      role,
      // 주인은 역할과 무관하게 적는다. 제 몸이 낸 흔적을 제가 느끼는 일이 흔한데,
      // 그때 이 실체는 근원이면서 동시에 누군가의 몸이다.
      owner: sensorium.ownerOfBody(id),
      opaque,
    });
  };

  for (const phenomenon of phenomena) {
    if (phenomenon.sourceEntityId !== undefined) put(phenomenon.sourceEntityId, 'source');
  }
  for (const subject of sensorium.subjects()) {
    for (const body of sensorium.bodiesOf(subject)) put(body, 'body');
  }
  for (const id of store.withComponent(BARRIER_COMPONENT)) {
    const barrier = barrierOf(store, id);
    put(id, 'blocker', barrier?.opaque === true);
  }

  return [...placements.values()].sort((left, right) => (left.id < right.id ? -1 : 1));
}

function groupByPerceiver(perceived: readonly PerceivedPhenomenon[]): Record<EntityId, PerceivedPhenomenon[]> {
  const out: Record<EntityId, PerceivedPhenomenon[]> = {};
  for (const entry of [...perceived].sort((left, right) => (left.id < right.id ? -1 : 1))) {
    (out[entry.perceiverId] ??= []).push(entry);
  }
  const sorted: Record<EntityId, PerceivedPhenomenon[]> = {};
  for (const key of Object.keys(out).sort()) sorted[key] = out[key] as PerceivedPhenomenon[];
  return sorted;
}

/** 한 주체가 그 현상을 어느 채널로 잡았는가 — 장면과 테스트가 같은 함수로 읽는다. */
export function channelsHeardBy(
  output: U1Output,
  subject: EntityId,
  phenomenonId: string,
): string[] {
  return output.perceived
    .filter((entry) => entry.perceiverId === subject && entry.phenomenonId === phenomenonId)
    .map((entry) => entry.channel)
    .sort();
}

/** 그 주체가 그 현상을 놓친 이유 (코드 오름차순). */
export function missCodesFor(
  output: U1Output,
  subject: EntityId,
  phenomenonId: string,
  channel?: string,
): string[] {
  return [
    ...new Set(
      output.misses
        .filter(
          (entry) =>
            entry.perceiverId === subject &&
            entry.phenomenonId === phenomenonId &&
            (channel === undefined || entry.channel === channel),
        )
        .map((entry) => entry.code),
    ),
  ].sort();
}

/** 이름으로 현상을 찾는다 — 장면은 `bell_toll` 처럼 사람이 읽는 이름으로 묻는다. */
export function phenomenaNamed(output: U1Output, name: string): Phenomenon[] {
  return output.phenomena.filter((entry) => entry.id.includes(`_${name}_`));
}

export function createU1Module(
  scenarios: ModuleDefinition<U1Input, U1Output>['scenarios'],
): ModuleDefinition<U1Input, U1Output> {
  return {
    id: 'U1',
    version: U1_VERSION,
    purpose: U1_PURPOSE,
    dependencies: ['V0', 'K0', 'K2', 'K3', 'S0', 'S1', 'U0'],
    validateInput,
    execute: (input: U1Input, _context: ModuleContext) => executeU1(input),
    validateOutput,
    scenarios,
  };
}

export function validateInput(input: unknown): U1Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('U1 입력은 객체여야 한다.');
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
    throw new TypeError('`layout` 은 객체여야 한다 — 지각은 거리를 잰다.');
  }
  if (typeof value['worldSeed'] !== 'string' || !/^\d+$/.test(value['worldSeed'])) {
    throw new TypeError('`worldSeed` 는 10진 문자열이어야 한다.');
  }
  if (!Number.isInteger(value['ticks']) || (value['ticks'] as number) < 0) {
    throw new TypeError('`ticks` 는 0 이상의 정수여야 한다.');
  }
  if (value['script'] !== undefined && !Array.isArray(value['script'])) {
    throw new TypeError('`script` 는 배열이어야 한다.');
  }
  if (value['testimonies'] !== undefined && !Array.isArray(value['testimonies'])) {
    throw new TypeError('`testimonies` 는 배열이어야 한다.');
  }
  return input as U1Input;
}

/** MODULE.yaml 의 invariants 중 **출력만 보고** 판정할 수 있는 것들. */
export function validateOutput(output: U1Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `U1 출력/${path}`, message });
  };

  if (output.storeHash !== output.storeHashAfterPerceiving) {
    at(
      'storeHash',
      'E_INVARIANT_perception_must_not_change_the_world',
      `지각이 세계를 바꿨다: ${output.storeHash} ≠ ${output.storeHashAfterPerceiving}`,
    );
  }
  if (!output.audit.everyChangeHasAnEvent) {
    at(
      'audit',
      'E_INVARIANT_perception_must_not_change_the_world',
      `사건 로그로 되짚은 상태와 실제 상태가 다르다 (GI-01): ${output.audit.replayedStoreHash} ≠ ${output.audit.storeHash}`,
    );
  }
  if (!output.audit.replayIsIdentical || output.resimulatedLogHash !== output.logHash) {
    at(
      'audit',
      'E_INVARIANT_identical_world_and_seed_must_produce_identical_perception',
      `일지를 다시 굴린 사건 해시가 다르다 (GI-12): ${output.resimulatedLogHash} ≠ ${output.logHash}`,
    );
  }

  const known = new Map(output.phenomena.map((entry) => [entry.id, entry]));

  for (const entry of output.perceived) {
    const phenomenon = known.get(entry.phenomenonId);
    if (!phenomenon) {
      at(
        `perceived/${entry.id}`,
        'E_INVARIANT_a_subject_must_perceive_only_what_reached_its_senses',
        `세계에 없는 현상을 지각했다: ${entry.phenomenonId}`,
      );
      continue;
    }
    if (!U1_CHANNELS.includes(entry.channel)) {
      at(
        `perceived/${entry.id}`,
        'E_INVARIANT_every_perception_must_name_its_channel',
        `원문 「11」 U1 의 일곱 채널 밖이다: ${entry.channel}`,
      );
    }
    if (entry.strength < entry.threshold) {
      at(
        `perceived/${entry.id}`,
        'E_INVARIANT_a_subject_must_perceive_only_what_reached_its_senses',
        `문턱을 넘지 못한 것이 닿았다: 세기 ${entry.strength} < 문턱 ${entry.threshold}`,
      );
    }
    // 시선은 줄어드는 것이 아니라 끊긴다 — 막는 것을 지나온 시각 지각은 있을 수 없다.
    if (entry.channel === 'visual' && entry.dampedBy.length > 0) {
      at(
        `perceived/${entry.id}`,
        'E_INVARIANT_sight_must_be_cut_by_what_blocks_it_not_merely_dimmed',
        `막는 것을 지나온 시각 지각이다: ${entry.dampedBy.join(' · ')}`,
      );
    }
    // 공간을 건너온 것에는 자리와 거리가 있고, 사람이 들고 온 것에는 전한 이가 있다.
    const carried = entry.via !== null;
    if (carried && entry.distance !== null) {
      at(
        `perceived/${entry.id}`,
        'E_INVARIANT_every_perception_must_name_its_channel',
        '전언인데 거리가 붙어 있다',
      );
    }
    if (!carried && entry.distance === null) {
      at(
        `perceived/${entry.id}`,
        'E_INVARIANT_every_perception_must_name_its_channel',
        '공간을 건너왔는데 거리가 없다',
      );
    }
  }

  for (const miss of output.misses) {
    if (miss.message === '') {
      at(
        `misses/${miss.perceiverId}/${miss.phenomenonId}`,
        'E_INVARIANT_every_miss_must_name_the_reason_it_missed',
        '못 본 이유가 비어 있다',
      );
    }
    if (miss.code === 'E_SIGHT_BLOCKED' && miss.blockedBy.length === 0) {
      at(
        `misses/${miss.perceiverId}/${miss.phenomenonId}`,
        'E_INVARIANT_every_miss_must_name_the_reason_it_missed',
        '막혔다면서 막은 것을 지목하지 않는다',
      );
    }
  }

  for (const gap of output.gaps) {
    if (gap.message === '') {
      at(`gaps/${gap.phenomenonId}`, 'E_INVARIANT_every_miss_must_name_the_reason_it_missed', '이유가 비어 있다');
    }
  }

  output.series.forEach((sample, index) => {
    if (sample.tick !== index + 1) {
      at(
        `series/${index}`,
        'E_INVARIANT_identical_world_and_seed_must_produce_identical_perception',
        `틱이 건너뛰었다: ${sample.tick}`,
      );
    }
  });

  return issues;
}

export { CHANNEL_BOOK, PHENOMENON_BOOK, buildSensorium, perceiveAll, phenomenaOf, receiveTestimonies, reportFor, round };
export type { Sensorium };
