import { sha256Tagged } from '@hkt/v0-module-contract';
import { EntityStore, type ComponentRegistry } from '@hkt/k0-entity-state';
import { RuleBook, runTransaction, type Intent } from '@hkt/k2-rule-transaction';
import { IdFactory, TickClock, deriveSeed } from '@hkt/v2-determinism';
import { affectedEntities, applyStateDeltas } from './delta.js';
import {
  REPLAY_ISSUE,
  type InvariantReport,
  type JournalEntry,
  type ScheduledEntry,
  type ScheduledEventTemplate,
  type SubmitResult,
  type WorldEvent,
  type WorldSnapshot,
} from './types.js';

export interface RuntimeOptions {
  store: EntityStore;
  rules: RuleBook;
  /** 10진 문자열. V2 의 시드 조합 규칙에 그대로 넘긴다. */
  worldSeed: string;
  templates?: ScheduledEventTemplate[];
  startTick?: number;
  msPerTick?: number;
}

/**
 * 세계 런타임 (원문 「9」 K3 — Event Log · Scheduler · Snapshot · Replay · Invariant Audit).
 *
 * ## 사건이 없으면 변화도 없다 (GI-01)
 *
 * 세계를 바꾸는 문은 `submit` 하나뿐이고, 그 문을 지날 때마다 사건이 로그에 덧붙는다.
 * 거부된 의도는 사건을 남기지 않고 — 바꾼 것이 없으므로 남길 것도 없다.
 *
 * ## 시간은 틱으로만 흐른다 (GI-12)
 *
 * 시각·ID·무작위성은 전부 V2 가 준다. `Date.now()` 를 읽는 곳이 하나라도 있으면 재생이 깨진다.
 * 사건 id 는 `시드 + 종류 + 순번` 의 해시이므로 다시 굴려도 같은 값이 나온다.
 */
export class WorldRuntime {
  readonly worldSeed: string;
  readonly rules: RuleBook;
  readonly #templates: ReadonlyMap<string, ScheduledEventTemplate>;
  readonly #clock: TickClock;
  #ids: IdFactory;
  #store: EntityStore;
  #log: WorldEvent[] = [];
  #pending: ScheduledEntry[] = [];
  #journal: JournalEntry[] = [];

  constructor(options: RuntimeOptions) {
    this.worldSeed = options.worldSeed;
    this.rules = options.rules;
    this.#templates = new Map((options.templates ?? []).map((template) => [template.id, template]));
    this.#store = options.store;
    this.#clock = new TickClock({
      ...(options.startTick === undefined ? {} : { startTick: options.startTick }),
      ...(options.msPerTick === undefined ? {} : { msPerTick: options.msPerTick }),
    });
    this.#ids = new IdFactory(deriveSeed({ worldSeed: BigInt(options.worldSeed) }));
  }

  get tick(): number {
    return this.#clock.tick;
  }

  get timeMs(): number {
    return this.#clock.timeMs;
  }

  get store(): EntityStore {
    return this.#store;
  }

  log(): readonly WorldEvent[] {
    return this.#log;
  }

  pending(): readonly ScheduledEntry[] {
    return this.#pending;
  }

  journal(): readonly JournalEntry[] {
    return this.#journal;
  }

  /** 사건 로그 전체의 해시 — 원문 「9」 K3 의 "사건 해시". */
  logHash(): string {
    return sha256Tagged(JSON.stringify(this.#log));
  }

  /**
   * 의도 하나를 처리한다.
   *
   * K2 가 규칙을 보고 델타를 만들면, 여기서 **그 델타에 사건 하나를 붙여** 로그에 덧붙인다.
   * 거부되었고 실패 효과도 없었다면 아무 일도 없었던 것이므로 사건도 없다.
   */
  submit(intent: Intent, causeEventIds: string[] = []): SubmitResult {
    this.#journal.push({ tick: this.tick, intent });
    const { store, outcome } = runTransaction(this.#store, this.rules, intent);
    this.#store = store;

    if (outcome.delta.length === 0) {
      return {
        accepted: outcome.ok,
        event: null,
        rejection: outcome.rejection,
        appliedRuleId: outcome.appliedRuleId,
      };
    }

    const event: WorldEvent = {
      id: this.#ids.next('event'),
      tick: this.tick,
      causeEventIds,
      intentIds: [intent.id],
      appliedRuleIds: outcome.appliedRuleId === null ? [] : [outcome.appliedRuleId],
      participantSubjectIds: [intent.actor, ...(intent.targets ?? [])],
      affectedEntityIds: affectedEntities(outcome.delta),
      stateDelta: outcome.delta,
      emittedPhenomena: outcome.emitted,
    };
    this.#log.push(event);

    for (const scheduled of outcome.scheduled) {
      this.#pending.push({
        id: this.#ids.next('schedule'),
        fireAtTick: this.tick + scheduled.delayTicks,
        eventTemplateId: scheduled.eventTemplateId,
        actor: intent.actor,
        targets: [...(intent.targets ?? [])],
        causeEventId: event.id,
      });
      // 예약은 언제나 같은 순서로 놓여야 한다 — 같은 틱의 예약은 id 로 갈라 결정적으로 만든다.
      this.#pending.sort((a, b) => (a.fireAtTick - b.fireAtTick) || (a.id < b.id ? -1 : 1));
    }

    return {
      accepted: outcome.ok,
      event,
      rejection: outcome.rejection,
      appliedRuleId: outcome.appliedRuleId,
    };
  }

  /**
   * 틱을 하나 진행하고, 그 틱에 예약된 사건을 일으킨다.
   *
   * 원본 29장의 `simulationStep` 이 `processScheduledEvents` 를 틱 앞머리에 두는 것과 같은 자리다.
   */
  advance(): SubmitResult[] {
    this.#clock.advance(1);
    const fired: SubmitResult[] = [];
    while (this.#pending.length > 0 && (this.#pending[0] as ScheduledEntry).fireAtTick <= this.tick) {
      const entry = this.#pending.shift() as ScheduledEntry;
      const template = this.#templates.get(entry.eventTemplateId);
      if (!template) {
        throw new Error(`${REPLAY_ISSUE.UNKNOWN_TEMPLATE}: 모르는 예약 사건 본체다: ${entry.eventTemplateId}`);
      }
      fired.push(
        this.submit(
          { id: entry.id, actor: entry.actor, verb: template.verb, targets: entry.targets },
          [entry.causeEventId],
        ),
      );
    }
    return fired;
  }

  snapshot(): WorldSnapshot {
    const body = {
      worldSeed: this.worldSeed,
      tick: this.tick,
      store: this.#store.snapshot(),
      log: this.#log,
      pending: this.#pending,
      journal: this.#journal,
      ids: this.#ids.snapshot(),
      clock: this.#clock.snapshot(),
    };
    return { ...body, hash: sha256Tagged(JSON.stringify(body)) };
  }

  /** 스냅샷에서 세계를 되살린다. 되살린 세계의 스냅샷 해시는 원본과 같아야 한다. */
  static restore(
    snapshot: WorldSnapshot,
    rules: RuleBook,
    registry: ComponentRegistry,
    templates: ScheduledEventTemplate[] = [],
  ): WorldRuntime {
    const runtime = new WorldRuntime({
      store: EntityStore.restore(snapshot.store, registry),
      rules,
      worldSeed: snapshot.worldSeed,
      templates,
      startTick: snapshot.clock.startTick,
      msPerTick: snapshot.clock.msPerTick,
    });
    runtime.#log = snapshot.log.map((event) => ({ ...event }));
    runtime.#pending = snapshot.pending.map((entry) => ({ ...entry }));
    runtime.#journal = snapshot.journal.map((entry) => ({ ...entry }));
    runtime.#ids = IdFactory.restore(snapshot.ids);
    if (snapshot.clock.tick > snapshot.clock.startTick) {
      runtime.#clock.advance(snapshot.clock.tick - snapshot.clock.startTick);
    }
    return runtime;
  }

  /**
   * 사건 로그만으로 최종 상태를 다시 만든다.
   *
   * 규칙을 다시 돌리지 않고 **사건에 적힌 결과만** 넣는다. 이렇게 만든 상태가 현재 상태와 같다면,
   * 세계의 모든 변화에 원인 사건이 있다는 뜻이다 (GI-01).
   */
  replayFromLog(initial: EntityStore): EntityStore {
    return this.#log.reduce((store, event) => applyStateDeltas(store, event.stateDelta), initial);
  }

  /** 원문 「9」 K3 의 Invariant Audit. */
  audit(initial: EntityStore, resimulated?: WorldRuntime): InvariantReport {
    const violations: InvariantReport['violations'] = [];
    const add = (code: string, path: string, message: string): void => {
      violations.push({ code, path, message });
    };

    let replayedStoreHash = '';
    try {
      replayedStoreHash = this.replayFromLog(initial).hash();
    } catch (error) {
      add(REPLAY_ISSUE.BAD_DELTA, 'log', `사건을 되짚을 수 없다: ${(error as Error).message}`);
    }
    const storeHash = this.#store.hash();
    const everyChangeHasAnEvent = replayedStoreHash === storeHash;
    if (!everyChangeHasAnEvent) {
      add(
        REPLAY_ISSUE.UNEXPLAINED_STATE,
        'store',
        `사건 로그로 되짚은 상태 ${replayedStoreHash} 와 실제 상태 ${storeHash} 가 다르다 (GI-01).`,
      );
    }

    // 로그는 덧붙이기만 된다 — 틱은 뒤로 가지 않고 id 는 겹치지 않는다.
    let logIsAppendOnly = true;
    const seen = new Set<string>();
    for (const [index, event] of this.#log.entries()) {
      if (seen.has(event.id)) {
        logIsAppendOnly = false;
        add(REPLAY_ISSUE.DUPLICATE_EVENT_ID, `log/${index}`, `사건 id 가 겹친다: ${event.id}`);
      }
      seen.add(event.id);
      const previous = this.#log[index - 1];
      if (previous && previous.tick > event.tick) {
        logIsAppendOnly = false;
        add(
          REPLAY_ISSUE.LOG_NOT_APPEND_ONLY,
          `log/${index}`,
          `틱이 뒤로 갔다: ${previous.tick} → ${event.tick}`,
        );
      }
    }

    let replayIsIdentical = true;
    if (resimulated) {
      replayIsIdentical =
        resimulated.logHash() === this.logHash() && resimulated.store.hash() === storeHash;
      if (!replayIsIdentical) {
        add(
          REPLAY_ISSUE.REPLAY_MISMATCH,
          'log',
          `재시뮬레이션의 사건 해시 ${resimulated.logHash()} · 상태 ${resimulated.store.hash()} 가 원본과 다르다 (GI-12).`,
        );
      }
    }

    const storeIssues = this.#store.audit();

    return {
      everyChangeHasAnEvent,
      replayIsIdentical,
      logIsAppendOnly,
      storeIssues,
      violations,
      logHash: this.logHash(),
      replayedStoreHash,
      storeHash,
    };
  }
}

/**
 * 일지를 다시 굴려 세계를 재시뮬레이션한다 (원문 「9」 K3 의 Replay).
 *
 * `replayFromLog` 가 **적힌 결과**를 되짚는다면, 이쪽은 **원인부터** 다시 굴린다.
 * 둘 다 같은 곳에 도착해야 세계가 결정적이다 (GI-12).
 */
export function resimulate(
  initial: EntityStore,
  journal: readonly JournalEntry[],
  options: Omit<RuntimeOptions, 'store'> & { untilTick?: number },
): WorldRuntime {
  const runtime = new WorldRuntime({ ...options, store: initial });
  for (const entry of journal) {
    // 예약 사건은 틱이 흐르면 스스로 다시 태어나므로 일지에서 건너뛴다 —
    // 다시 제출하면 같은 예약이 두 번 일어나 사건이 늘어난다.
    if (entry.intent.id.startsWith('schedule_')) continue;
    while (runtime.tick < entry.tick) runtime.advance();
    runtime.submit(entry.intent);
  }
  // 마지막 의도 뒤에도 틱이 흘렀다면 그만큼 더 굴린다 — 그 사이에 예약이 일어났을 수 있다.
  while (options.untilTick !== undefined && runtime.tick < options.untilTick) runtime.advance();
  return runtime;
}
