// R6-c 의도장·감사와 고리 닫기 — 의도가 사건이 되고, 그 사건이 다시 흔적을 낸다.
//
// R2-c 현상장 · R3-c 지각장 · R4-c 믿음 그래프 · D5-c 충돌장 · R5-c 기억장과 **같은 모양**이다:
// 담고, 지우지 않고, 감사가 무엇이 어긋났고 무엇이 그냥 사실인지를 가른다.
//
// 그런데 여기에는 앞의 다섯에 없던 것이 하나 있다: **고리가 닫힌다.**
//
//   결핍(D4) → 목적(P4) → 계획(P5) → **의도(R6)** → 사건(R1) → 흔적(R2) → 지각(R3)
//   → 믿음(R4) → 기억·사이(R5) → **다시 의도**
//
// 단계 3 이 여기서 한 바퀴를 돈다. 그리고 그 고리는 주장이 아니라 **검사**다 — `closeLoop` 이
// 의도를 R1 에 실제로 먹여 사건을 세우고 그 사건에서 R2 흔적이 나는지를 값으로 낸다. 나지 않으면
// 고리가 끊긴 것이고, 사유가 남는다.
//
// 사실 쪽도 여전히 절반이다:
//   **아무 의도도 내지 못한 주체**   겨눌 상대가 없거나 걸음이 막힌 자다 — 위반이 아니다.
//                                     세계는 아무도 손대지 않는 틱에도 굴러간다.
//   **아무 흔적도 남기지 않은 의도**  앎만 움직인 사건은 조용하다 — R2-c 가 이미 사실로 센 자리다.

import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import type { WorldState } from '../o2/index.ts';
import { atomLabel } from '../p0/index.ts';
import {
  appendLog,
  applyEvent,
  mintEvent,
  type EventLog,
  type WorldEvent,
} from '../r1/index.ts';
import { latest, type WorldStateStore } from '../r0/index.ts';
import { emitPhenomena, type WorldPhenomenon } from '../r2/index.ts';
import { orderIntents, type ActionIntent } from './intent.ts';
import { violateIntent, type IntentViolation } from './violation.ts';

/** 누가 이번 틱에 무엇을 내려 하는가. */
export interface IntentQueue {
  readonly intents: readonly ActionIntent[];
  /** 주체 id → 그가 낸 의도들 */
  readonly bySubject: ReadonlyMap<Id, readonly ActionIntent[]>;
  /** 틱 → 그 틱의 의도들 */
  readonly byTick: ReadonlyMap<Tick, readonly ActionIntent[]>;
}

export function openIntentQueue(): IntentQueue {
  return { intents: [], bySubject: new Map(), byTick: new Map() };
}

function indexOf(intents: readonly ActionIntent[]): IntentQueue {
  const bySubject = new Map<Id, ActionIntent[]>();
  const byTick = new Map<Tick, ActionIntent[]>();
  for (const intent of intents) {
    bySubject.set(intent.providerId, [...(bySubject.get(intent.providerId) ?? []), intent]);
    byTick.set(intent.tick, [...(byTick.get(intent.tick) ?? []), intent]);
  }
  return { intents, bySubject, byTick };
}

/**
 * 의도들을 큐에 담는다 — **같은 id 는 늘어나지 않고 갈아 끼워진다.**
 *
 * 의도의 id 는 내는 자·목적·틱에서 나오므로(R6-a `intentIdOf`), **한 주체가 한 틱에 같은 목적으로
 * 두 번 내는 일은 없다.** 다른 목적으로 두 번 내는 것은 감사가 잡는다(`unqueued-intent`).
 */
export function enqueue(queue: IntentQueue, intents: readonly ActionIntent[]): IntentQueue {
  if (intents.length === 0) return queue;
  const merged = new Map(queue.intents.map((intent) => [intent.id, intent]));
  let changed = false;
  for (const intent of intents) {
    if (merged.get(intent.id) === intent) continue;
    merged.set(intent.id, intent);
    changed = true;
  }
  if (!changed) return queue;
  return indexOf(orderIntents([...merged.values()]));
}

/** 그 주체가 낸 의도들. */
export function intentsFor(queue: IntentQueue, subjectId: Id): readonly ActionIntent[] {
  return queue.bySubject.get(subjectId) ?? [];
}

/** 그 틱의 의도들. */
export function intentsAt(queue: IntentQueue, tick: Tick): readonly ActionIntent[] {
  return queue.byTick.get(tick) ?? [];
}

/**
 * 아무 의도도 내지 못한 주체들 — **위반이 아니라 사실이다.**
 *
 * 겨눌 상대가 없거나 걸음이 전부 막힌 자다. 세계는 아무도 손대지 않는 틱에도 굴러간다 —
 * R3-c 가 "아무도 못 본 흔적" 을, R5-c 가 "아무도 말하지 않은 기억" 을 사실로 센 것과 같은 자리다.
 */
export function idle(queue: IntentQueue, subjectIds: readonly Id[]): readonly Id[] {
  return subjectIds.filter((id) => intentsFor(queue, id).length === 0);
}

/** 고리 한 바퀴의 결과 — 의도가 사건이 되고 흔적이 났는가. */
export interface LoopStep {
  readonly intent: ActionIntent;
  /** 의도가 세운 사건. 서지 못했으면 null */
  readonly event: WorldEvent | null;
  /** 그 사건이 남긴 흔적들 */
  readonly phenomena: readonly WorldPhenomenon[];
  /** 새 자국을 남기지 않은 자리들 (봉인된 자리) — 빠뜨림이 아니라 결과다 */
  readonly sealedSlots: readonly string[];
  readonly note: string;
  readonly violations: readonly IntentViolation[];
}

export interface LoopSpec {
  readonly store: WorldStateStore;
  readonly log: EventLog;
  readonly intents: readonly ActionIntent[];
  /** 값이 어떻게 바뀌는가 — **호출자가 준다** (효과의 양은 E2·G 가 갚는다는 R1 의 선언 그대로) */
  readonly valuesFor: (intent: ActionIntent, world: WorldState) => readonly {
    readonly kind: 'change' | 'payment';
    readonly domain: WorldEvent['effects'][number]['domain'];
    readonly holderId: Id;
    readonly path: string;
    readonly to: WorldEvent['effects'][number]['to'];
  }[];
}

/** 고리 한 바퀴 — 의도들을 사건으로 세워 세계에 얹고 흔적을 낸다. */
export interface LoopResult {
  readonly steps: readonly LoopStep[];
  readonly store: WorldStateStore;
  readonly log: EventLog;
  readonly phenomena: readonly WorldPhenomenon[];
  readonly violations: readonly IntentViolation[];
}

/**
 * 고리를 닫는다 — **주장이 아니라 검사다.**
 *
 * 의도를 R1 에 실제로 먹여 사건을 세우고(`mintEvent`), 세계에 얹고(`applyEvent`), 그 사건에서
 * R2 흔적이 나는지를 본다(`emitPhenomena`). R6 는 여기서 아무것도 새로 판정하지 않는다 —
 * 요청이 설 수 있는지는 P0-c 가, 사건이 설 수 있는지는 R1 이, 무엇이 새는지는 R2-a 가 정한다.
 *
 * 그래서 이 함수가 하는 일은 **잇는 것**뿐이고, 이어지지 않으면 그 사실이 값으로 남는다.
 */
export function closeLoop(spec: LoopSpec): LoopResult {
  const violations: IntentViolation[] = [];
  const steps: LoopStep[] = [];
  const phenomena: WorldPhenomenon[] = [];
  let store = spec.store;
  let log = spec.log;

  for (const intent of orderIntents(spec.intents)) {
    const current = latest(store);
    if (current === null) {
      violateIntent(
        violations,
        intent.providerId,
        'uncaused-event',
        '$.store',
        '세계가 아직 서지 않았다 — 의도를 얹을 자리가 없다',
      );
      continue;
    }
    const world = current.world;
    const mint = mintEvent({
      proposal: intent.proposal,
      world,
      tick: intent.tick,
      name: `${atomLabel(intent.atom)} — ${intent.note}`,
      values: spec.valuesFor(intent, world),
    });
    if (mint.event === null) {
      const stepViolations: IntentViolation[] = [];
      for (const reason of mint.violations) {
        violateIntent(
          stepViolations,
          intent.providerId,
          'uncaused-event',
          '$.event',
          `R1 관문 — ${reason.message}`,
        );
      }
      violations.push(...stepViolations);
      steps.push({
        intent,
        event: null,
        phenomena: [],
        sealedSlots: [],
        note: '의도는 섰으나 사건이 서지 못했다 — 세계가 거부했다',
        violations: stepViolations,
      });
      continue;
    }

    const applied = applyEvent(store, log, mint.event);
    if (applied.snapshot === null) {
      const stepViolations: IntentViolation[] = [];
      for (const reason of applied.violations) {
        violateIntent(
          stepViolations,
          intent.providerId,
          'uncaused-event',
          '$.apply',
          `R1 얹기 — ${reason.message}`,
        );
      }
      violations.push(...stepViolations);
      steps.push({
        intent,
        event: mint.event,
        phenomena: [],
        sealedSlots: [],
        note: '사건은 섰으나 세계가 받지 않았다',
        violations: stepViolations,
      });
      continue;
    }

    store = applied.store;
    log = applied.log.byId.has(mint.event.id) ? applied.log : appendLog(applied.log, mint.event);
    const emitted = emitPhenomena(mint.event, applied.snapshot.world);
    phenomena.push(...emitted.phenomena);
    steps.push({
      intent,
      event: mint.event,
      phenomena: emitted.phenomena,
      sealedSlots: emitted.sealedSlots,
      note:
        emitted.phenomena.length === 0
          ? '사건은 섰는데 아무 흔적도 나지 않았다 — 새지 않는 자리만 움직였다 (R2-c 가 사실로 세는 자리)'
          : `흔적 ${String(emitted.phenomena.length)} 이 났다 — 다시 읽힐 수 있다`,
      violations: [],
    });
  }

  return { steps, store, log, phenomena, violations };
}

/** 의도장 감사 — 무엇이 어긋났고 무엇이 그냥 사실인가. */
export interface IntentAudit {
  readonly queued: number;
  /** 상대를 겨눈 의도 수 */
  readonly aimed: number;
  /** 아무 의도도 내지 못한 주체 (사실) */
  readonly idle: readonly Id[];
  /** 사건이 된 의도 수 */
  readonly enacted: number;
  /** 흔적을 낸 사건 수 */
  readonly witnessed: number;
  /** 사건이 되고도 아무 흔적을 안 낸 수 (사실) */
  readonly silent: number;
  readonly violations: readonly IntentViolation[];
}

export interface IntentAuditSpec {
  readonly queue: IntentQueue;
  readonly subjectIds: readonly Id[];
  readonly loop?: LoopResult;
}

/** 의도장을 감사한다 — 위반과 사실을 가른다. */
export function auditIntents(spec: IntentAuditSpec): IntentAudit {
  const violations: IntentViolation[] = [];
  const { queue } = spec;

  // 한 주체가 한 틱에 둘을 내면 어느 것이 실제로 나가는지가 정해지지 않는다.
  for (const [tick, intents] of [...queue.byTick.entries()].sort((a, b) => a[0] - b[0])) {
    const seen = new Set<Id>();
    for (const intent of intents) {
      if (seen.has(intent.providerId)) {
        violateIntent(
          violations,
          intent.providerId,
          'unqueued-intent',
          `$.queue[${String(tick)}]`,
          `한 틱에 둘을 낸다 — 어느 것이 나가는지 정해지지 않는다 (틱 ${String(tick)})`,
        );
      }
      seen.add(intent.providerId);
    }
  }

  for (const intent of queue.intents) {
    if (intent.goalId === '') {
      violateIntent(
        violations,
        intent.providerId,
        'unrooted-intent',
        `$.intents[${intent.id}].goalId`,
        '어느 목적에서 나왔는지 대지 못하는 의도다',
      );
    }
  }

  const steps = spec.loop?.steps ?? [];
  return {
    queued: queue.intents.length,
    aimed: queue.intents.filter((intent) => intent.aim !== null).length,
    idle: idle(queue, spec.subjectIds),
    enacted: steps.filter((step) => step.event !== null).length,
    witnessed: steps.filter((step) => step.phenomena.length > 0).length,
    silent: steps.filter((step) => step.event !== null && step.phenomena.length === 0).length,
    violations: [...violations, ...(spec.loop?.violations ?? [])],
  };
}

/** 감사를 한 줄로 접는다 — 터미널·배지용. */
export function intentQueueVerdict(audit: IntentAudit): string {
  const facts = `의도 ${String(audit.queued)}(겨눔 ${String(audit.aimed)}) · 사건 ${String(audit.enacted)} · 흔적 낸 사건 ${String(audit.witnessed)} · 아무것도 못 낸 주체 ${String(audit.idle.length)}`;
  if (audit.violations.length === 0) return `의도장이 성립한다 — ${facts}`;
  const rules = [...new Set(audit.violations.map((violation) => violation.rule))];
  return `의도장이 어긋난다 — ${rules.join(', ')} (${facts})`;
}
