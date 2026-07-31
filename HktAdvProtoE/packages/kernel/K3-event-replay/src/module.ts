import { sha256Tagged } from '@hkt/v0-module-contract';
import type { ModuleContext, ModuleDefinition, VerificationIssue } from '@hkt/v0-module-contract';
import {
  ComponentRegistry,
  EntityStore,
  applyOperations,
  type ComponentDefinition,
  type StoreOperation,
} from '@hkt/k0-entity-state';
import { RuleBook, type Intent, type RuleSpec } from '@hkt/k2-rule-transaction';
import { Rng, deriveSeed } from '@hkt/v2-determinism';
import { WorldRuntime, resimulate } from './runtime.js';
import type {
  InvariantReport,
  JournalEntry,
  ScheduledEventTemplate,
  WorldEvent,
  WorldSnapshot,
} from './types.js';

export interface K3World {
  components?: ComponentDefinition[];
  operations: StoreOperation[];
}

/**
 * 틱마다 어떤 의도가 제출되는지를 **데이터로** 적는다.
 *
 * 함수를 받으면 스냅샷도 재생도 불가능하다. 후보 목록에서 결정적 난수로 고르는 방식만 둔다 —
 * 무작위성도 V2 가 주므로 같은 시드면 같은 열이 나온다.
 */
export interface IntentDriver {
  /** 이 후보들 중에서 매 틱 하나를 고른다 */
  candidates: { actor: string; verb: string; targets?: string[] }[];
  /** 몇 틱을 굴리는가 */
  ticks: number;
  /** 한 틱에 제출하는 의도 수 (기본 1) */
  perTick?: number;
}

export interface K3Input {
  world: K3World;
  rules: RuleSpec[];
  worldSeed: string;
  templates?: ScheduledEventTemplate[];
  /** 손으로 적은 의도 열 */
  intents?: { tick: number; intent: Intent }[];
  /** 또는 결정적으로 뽑아 굴리는 열 */
  driver?: IntentDriver;
  msPerTick?: number;
}

export interface K3Output {
  finalTick: number;
  events: WorldEvent[];
  accepted: number;
  rejected: number;
  logHash: string;
  storeHash: string;
  /** 사건 로그만으로 되짚은 최종 상태의 해시 (GI-01) */
  replayedStoreHash: string;
  /** 일지를 다시 굴려 얻은 사건 해시 (GI-12) */
  resimulatedLogHash: string;
  resimulatedStoreHash: string;
  snapshotHash: string;
  restoredSnapshotHash: string;
  pending: WorldSnapshot['pending'];
  audit: InvariantReport;
  digest: string;
}

export const K3_VERSION = '0.1.0';

export const K3_PURPOSE =
  '모든 상태 변화를 원인 사건으로 기록하고 같은 시드·같은 입력이면 언제나 같은 사건 순서와 같은 최종 상태로 재생한다.';

export function buildWorld(world: K3World): EntityStore {
  const registry = ComponentRegistry.of(world.components ?? []);
  return applyOperations(EntityStore.empty(registry), world.operations).store;
}

/** 입력이 정한 대로 세계를 굴린다. 손으로 적은 의도와 결정적 뽑기를 모두 받는다. */
export function driveWorld(input: K3Input): { runtime: WorldRuntime; initial: EntityStore } {
  const initial = buildWorld(input.world);
  const runtime = new WorldRuntime({
    store: initial,
    rules: RuleBook.of(input.rules),
    worldSeed: input.worldSeed,
    ...(input.templates === undefined ? {} : { templates: input.templates }),
    ...(input.msPerTick === undefined ? {} : { msPerTick: input.msPerTick }),
  });

  for (const entry of input.intents ?? []) {
    while (runtime.tick < entry.tick) runtime.advance();
    runtime.submit(entry.intent);
  }

  if (input.driver) driveTicks(runtime, input.worldSeed, input.driver, input.driver.ticks);

  return { runtime, initial };
}

/**
 * 세계를 틱 단위로 굴린다.
 *
 * 뽑기 시드를 **소비량이 아니라 틱에서** 파생한다. 그래서 중간 스냅샷에서 이어 굴려도 같은 후보가
 * 나오고, 통째로 굴린 세계와 같은 곳에 도착한다. 굴리는 규칙이 한 곳에만 있어야 대표 장면이
 * "이어 굴리기"를 정직하게 확인할 수 있다 — 두 곳에 적으면 둘이 갈라진다.
 */
export function driveTicks(
  runtime: WorldRuntime,
  worldSeed: string,
  driver: IntentDriver,
  ticks: number,
): WorldRuntime {
  const perTick = driver.perTick ?? 1;
  for (let step = 0; step < ticks; step += 1) {
    runtime.advance();
    const rng = new Rng(deriveSeed({ worldSeed: BigInt(worldSeed), tick: runtime.tick }));
    for (let index = 0; index < perTick; index += 1) {
      const candidate = rng.pick(driver.candidates);
      runtime.submit({
        id: `driven_${runtime.tick}_${index}`,
        actor: candidate.actor,
        verb: candidate.verb,
        ...(candidate.targets === undefined ? {} : { targets: candidate.targets }),
      });
    }
  }
  return runtime;
}

export function executeK3(input: K3Input): K3Output {
  const { runtime, initial } = driveWorld(input);

  const journal: readonly JournalEntry[] = runtime.journal();
  const again = resimulate(initial, journal, {
    rules: runtime.rules,
    worldSeed: input.worldSeed,
    ...(input.templates === undefined ? {} : { templates: input.templates }),
    ...(input.msPerTick === undefined ? {} : { msPerTick: input.msPerTick }),
    untilTick: runtime.tick,
  });

  const snapshot = runtime.snapshot();
  const restored = WorldRuntime.restore(
    snapshot,
    runtime.rules,
    ComponentRegistry.of(input.world.components ?? []),
    input.templates ?? [],
  );

  const audit = runtime.audit(initial, again);
  const events = [...runtime.log()];
  const accepted = events.length;

  const body = {
    finalTick: runtime.tick,
    events,
    accepted,
    rejected: journal.length - accepted,
    logHash: runtime.logHash(),
    storeHash: runtime.store.hash(),
    replayedStoreHash: audit.replayedStoreHash,
    resimulatedLogHash: again.logHash(),
    resimulatedStoreHash: again.store.hash(),
    snapshotHash: snapshot.hash,
    restoredSnapshotHash: restored.snapshot().hash,
    pending: [...runtime.pending()],
    audit,
  };

  return { ...body, digest: sha256Tagged(JSON.stringify(body)) };
}

export function createK3Module(
  scenarios: ModuleDefinition<K3Input, K3Output>['scenarios'],
): ModuleDefinition<K3Input, K3Output> {
  return {
    id: 'K3',
    version: K3_VERSION,
    purpose: K3_PURPOSE,
    dependencies: ['V0', 'V2', 'K0', 'K1', 'K2'],
    validateInput,
    execute: (input: K3Input, _context: ModuleContext) => executeK3(input),
    validateOutput,
    scenarios,
  };
}

export function validateInput(input: unknown): K3Input {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('K3 입력은 객체여야 한다.');
  }
  const value = input as Record<string, unknown>;
  const world = value['world'];
  if (world === null || typeof world !== 'object' || Array.isArray(world)) {
    throw new TypeError('`world` 는 객체여야 한다.');
  }
  if (!Array.isArray((world as { operations?: unknown }).operations)) {
    throw new TypeError('`world.operations` 는 배열이어야 한다.');
  }
  if (!Array.isArray(value['rules'])) throw new TypeError('`rules` 는 배열이어야 한다.');
  if (typeof value['worldSeed'] !== 'string' || !/^-?\d+$/.test(value['worldSeed'])) {
    throw new TypeError('`worldSeed` 는 10진 정수 문자열이어야 한다.');
  }
  if (value['intents'] === undefined && value['driver'] === undefined) {
    throw new TypeError('`intents` 나 `driver` 중 하나는 있어야 한다 — 굴릴 것이 없으면 재생할 것도 없다.');
  }
  const driver = value['driver'];
  if (driver !== undefined) {
    const record = driver as Record<string, unknown>;
    if (!Array.isArray(record['candidates']) || record['candidates'].length === 0) {
      throw new TypeError('`driver.candidates` 는 비어 있지 않은 배열이어야 한다.');
    }
    if (!Number.isInteger(record['ticks']) || (record['ticks'] as number) < 1) {
      throw new TypeError('`driver.ticks` 는 1 이상의 정수여야 한다.');
    }
  }
  return input as K3Input;
}

/** MODULE.yaml 의 invariants 중 출력만 보고 판정할 수 있는 것들. */
export function validateOutput(output: K3Output): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const at = (path: string, code: string, message: string): void => {
    issues.push({ code, path: `K3 출력/${path}`, message });
  };

  if (output.replayedStoreHash !== output.storeHash) {
    at(
      'replayedStoreHash',
      'E_INVARIANT_every_state_change_must_have_a_causing_event',
      `사건 로그로 되짚은 상태 ${output.replayedStoreHash} 가 실제 상태 ${output.storeHash} 와 다르다 (GI-01).`,
    );
  }
  if (output.resimulatedLogHash !== output.logHash) {
    at(
      'resimulatedLogHash',
      'E_INVARIANT_resimulation_must_reproduce_identical_events',
      `재시뮬레이션의 사건 해시가 다르다: ${output.resimulatedLogHash} ≠ ${output.logHash} (GI-12).`,
    );
  }
  if (output.resimulatedStoreHash !== output.storeHash) {
    at(
      'resimulatedStoreHash',
      'E_INVARIANT_resimulation_must_reproduce_identical_events',
      `재시뮬레이션의 최종 상태가 다르다: ${output.resimulatedStoreHash} ≠ ${output.storeHash} (GI-12).`,
    );
  }
  if (output.restoredSnapshotHash !== output.snapshotHash) {
    at(
      'restoredSnapshotHash',
      'E_INVARIANT_snapshot_restore_must_equal_the_original',
      `스냅샷을 되살렸더니 해시가 달라졌다: ${output.restoredSnapshotHash} ≠ ${output.snapshotHash}`,
    );
  }

  const seen = new Set<string>();
  output.events.forEach((event, index) => {
    if (seen.has(event.id)) {
      at(`events/${index}`, 'E_INVARIANT_event_id_must_be_deterministic', `사건 id 가 겹친다: ${event.id}`);
    }
    seen.add(event.id);
    if (!/^event_[0-9a-f]{12}$/.test(event.id)) {
      at(`events/${index}`, 'E_INVARIANT_event_id_must_be_deterministic', `사건 id 형식이 아니다: ${event.id}`);
    }
    const previous = output.events[index - 1];
    if (previous && previous.tick > event.tick) {
      at(
        `events/${index}`,
        'E_INVARIANT_event_log_must_be_append_only',
        `틱이 뒤로 갔다: ${previous.tick} → ${event.tick}`,
      );
    }
    if (event.stateDelta.length === 0) {
      at(
        `events/${index}`,
        'E_INVARIANT_every_state_change_must_have_a_causing_event',
        '변화가 없는 사건이 로그에 있다 — 사건은 변화의 원인이지 기록의 장식이 아니다.',
      );
    }
  });

  for (const violation of output.audit.violations) {
    at('audit', `E_INVARIANT_${violation.code}`, `${violation.path} — ${violation.message}`);
  }
  for (const issue of output.audit.storeIssues) {
    at('audit/store', issue.code, `${issue.path} — ${issue.message}`);
  }

  return issues;
}
