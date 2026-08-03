// R1-b 세계에 적용 — 사건이 R0 의 비워 둔 근거 자리를 채운다.
//
// R0 은 커밋마다 근거를 요구하되 그 근거를 검사하지 못했다. `CommitCause.eventIds` 는 빈 열로
// 서 있었고, 무엇 때문에 세계가 달라졌는지는 사람이 적은 문자열 한 줄이었다. R1-b 가 그 자리를
// 채운다 — 그리고 그 순간 **세계를 바꾸는 길이 하나**가 된다.
//
// 새 저장소를 짓지 않는다. 적용은 R0 커밋 그대로다:
//
//   사건의 효과 → 지금 세계의 자리에 얹는다 → State 목록 → R0 `commit`(근거=사건 id)
//
// 그래서 R0 이 이미 지키던 것들이 전부 그대로 지켜진다 — 시간은 앞으로만, 한 틱에 세계는 하나,
// 스키마를 어긴 값은 들어가지 않고(재고를 0 아래로 내리는 사건은 세계가 거부한다), 칸마다 앞
// 해시를 품는다. R1-b 가 더하는 것은 셋이다.
//
//   ① **낡은 전제 위에 쓰지 않는다.** 사건은 자기가 선 세계를 기억한다(R1-a `from`). 적용하려는
//      세계의 그 자리가 그때와 다르면 `stale-effect` 다 — 사건이 만들어진 뒤 세계가 움직였다면
//      그 사건은 이미 다른 세계의 것이다.
//   ② **되돌릴 수 없는 것은 되돌리지 못한다.** P0-b 가 원자마다 `reversible` 을 적어 뒀다.
//      되돌릴 수 없는 원자가 바꾼 자리를 예전 값으로 되돌리는 사건은 서지 못한다 —
//      죽은 것을 살리는 통로가 열리면 세계의 모든 손실이 협상 가능해진다.
//   ③ **사건 없이 담긴 칸을 찾아낸다.** 원장을 훑어 genesis 가 아닌데 근거가 비었거나, 로그에
//      없는 사건을 가리키는 칸을 짚는다(`unwitnessed-commit` · `dangling-cause`). 이것이
//      "사건 없는 변경 금지" 를 **주장이 아니라 검사**로 만든다.

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { State } from '../o1/being.ts';
import { disassembleWorld, readSlot, slotStateId, type WorldState } from '../o2/world.ts';
import { atomGrounding, atomLabel } from '../p0/index.ts';
import {
  causedBy,
  commit,
  latest,
  type CommitResult,
  type WorldStateSnapshot,
  type WorldStateStore,
} from '../r0/index.ts';
import { effectText, movedEffects, type EventEffect, type WorldEvent } from './event.ts';
import { violateEvent, type EventViolation } from './violation.ts';

/** 일어난 사건들 — 원장의 칸이 가리키는 곳. */
export interface EventLog {
  readonly events: readonly WorldEvent[];
  /** id 로 찾기 위한 색인 (같은 사건을 두 번 담지 않는다) */
  readonly byId: ReadonlyMap<Id, WorldEvent>;
}

/** 빈 로그. */
export function openLog(): EventLog {
  return { events: [], byId: new Map() };
}

/** 로그에 사건 하나를 더한 새 로그. */
export function appendLog(log: EventLog, event: WorldEvent): EventLog {
  const byId = new Map(log.byId);
  byId.set(event.id, event);
  return { events: [...log.events, event], byId };
}

/** 사건을 세계에 얹은 결과. 던지지 않는다 — 서지 못하면 원장도 로그도 그대로다. */
export interface ApplyResult {
  readonly store: WorldStateStore;
  readonly log: EventLog;
  readonly snapshot: WorldStateSnapshot | null;
  readonly commit: CommitResult | null;
  readonly violations: readonly EventViolation[];
  readonly applied: boolean;
}

/** 사건의 효과를 지금 세계에 얹은 State 목록 — 세계를 통째로 다시 적지 않는다. */
export function statesAfter(world: WorldState, event: WorldEvent): readonly State[] {
  const changed = new Map<string, State>();
  for (const effect of event.effects) {
    changed.set(effectText(effect), {
      kind: 'State',
      id: slotStateId(effect.domain, effect.holderId, effect.path),
      domain: effect.domain,
      ofId: effect.holderId,
      path: effect.path,
      value: effect.to,
    });
  }

  const kept = disassembleWorld(world).filter(
    (state) => !changed.has(`${state.domain}.${state.ofId}.${state.path}`),
  );
  const added = stableSort([...changed.values()], (left, right) =>
    compareStrings(
      `${left.domain}.${left.ofId}.${left.path}`,
      `${right.domain}.${right.ofId}.${right.path}`,
    ),
  );
  return [...kept, ...added];
}

/** 그 자리가 지금 사건이 기억하는 값 그대로인가. */
function isStale(world: WorldState, effect: EventEffect): boolean {
  return readSlot(world, effect.domain, effect.holderId, effect.path) !== effect.from;
}

/**
 * 되돌리는 사건인가 — 앞선 사건이 바꾼 자리를 그 이전 값으로 되돌리는가.
 * 되돌릴 수 없는 원자(P0-b `reversible: false`)가 바꾼 자리만 본다.
 */
export function undoneSlots(log: EventLog, event: WorldEvent): readonly string[] {
  const sealed = new Map<string, WorldEvent>();
  for (const past of log.events) {
    if (atomGrounding(past.atom)?.reversible !== false) continue;
    for (const effect of movedEffects(past)) sealed.set(effectText(effect), past);
  }

  const undone: string[] = [];
  for (const effect of movedEffects(event)) {
    const where = effectText(effect);
    const past = sealed.get(where);
    if (past === undefined) continue;
    const before = past.effects.find((entry) => effectText(entry) === where)?.from ?? null;
    if (effect.to === before) undone.push(where);
  }
  return undone;
}

/**
 * 사건을 세계에 얹는다.
 *
 * 관문 순서: 낡은 전제 → 되돌림 → (R0 커밋). 앞 둘이 R1 의 몫이고, 그 뒤는 전부 R0 이 이미
 * 지키던 것이다 — 여기서 다시 판정하지 않고 거부 사유를 옮겨 적는다.
 */
export function applyEvent(
  store: WorldStateStore,
  log: EventLog,
  event: WorldEvent,
): ApplyResult {
  const violations: EventViolation[] = [];
  const current = latest(store);
  const world = current?.world ?? null;

  if (world === null) {
    violateEvent(
      violations,
      event.name,
      'unwitnessed-commit',
      '$.store',
      '빈 원장에는 사건을 얹을 수 없다 — 세계가 먼저 서야 한다 (R0 genesis)',
    );
    return { store, log, snapshot: null, commit: null, violations, applied: false };
  }

  // ① 낡은 전제 위에 쓰지 않는다.
  for (const [index, effect] of event.effects.entries()) {
    if (!isStale(world, effect)) continue;
    const now = readSlot(world, effect.domain, effect.holderId, effect.path);
    violateEvent(
      violations,
      event.name,
      'stale-effect',
      `$.effects[${String(index)}].from`,
      `${effectText(effect)} 는 ${String(effect.from)} 였다고 적혔는데 지금은 ${now === null ? '없음' : String(now)} 이다 — 이 사건은 이미 다른 세계의 것이다`,
    );
  }

  // ② 되돌릴 수 없는 것은 되돌리지 못한다.
  for (const where of undoneSlots(log, event)) {
    violateEvent(
      violations,
      event.name,
      'irreversible-undo',
      '$.effects',
      `${where} 를 예전 값으로 되돌리려 한다 — 그 자리를 바꾼 원자는 되돌릴 수 없다 (P0-b reversible)`,
    );
  }

  // ③ 까닭으로 지목한 사건은 로그에 있어야 한다.
  for (const [index, causeId] of event.causeIds.entries()) {
    if (log.byId.has(causeId)) continue;
    violateEvent(
      violations,
      event.name,
      'dangling-cause',
      `$.causeIds[${String(index)}]`,
      `까닭으로 지목한 사건 ${causeId} 가 로그에 없다 — 없는 것 때문에 일어날 수는 없다`,
    );
  }

  if (violations.length > 0) {
    return { store, log, snapshot: null, commit: null, violations, applied: false };
  }

  // ④ 담기는 규칙은 R0 이 정한 그대로다 — 여기서 근거 자리가 처음으로 사건 id 로 찬다.
  const result = commit(store, {
    tick: event.tick,
    states: statesAfter(world, event),
    cause: causedBy(`${atomLabel(event.atom)} — ${event.name}`, [event.id]),
  });

  if (!result.accepted) {
    for (const reason of result.violations) {
      violateEvent(
        violations,
        event.name,
        'unwitnessed-commit',
        reason.path,
        `${reason.rule} — ${reason.message}`,
      );
    }
    return { store, log, snapshot: null, commit: result, violations, applied: false };
  }

  return {
    store: result.store,
    log: appendLog(log, event),
    snapshot: result.snapshot,
    commit: result,
    violations: [],
    applied: true,
  };
}

/**
 * 원장 감사 — 사건 없이 담긴 칸이 있는가.
 *
 * "세계는 사건으로만 바뀐다" 를 주장이 아니라 **검사**로 만드는 자리다. genesis 는 예외다
 * (세계가 처음 서는 것은 사건이 아니다 — 그 앞에는 아무것도 없다).
 */
export function witnessViolations(
  store: WorldStateStore,
  log: EventLog,
): readonly EventViolation[] {
  const violations: EventViolation[] = [];

  store.snapshots.forEach((snapshot, index) => {
    if (snapshot.cause.kind === 'genesis') return;

    if (snapshot.cause.eventIds.length === 0) {
      violateEvent(
        violations,
        snapshot.cause.label,
        'unwitnessed-commit',
        `$.snapshots[${String(index)}].cause.eventIds`,
        `틱 ${String(snapshot.tick)} 의 세계는 사건 없이 담겼다 — 세계는 사건으로만 바뀐다`,
      );
      return;
    }

    for (const eventId of snapshot.cause.eventIds) {
      const event = log.byId.get(eventId);
      if (event === undefined) {
        violateEvent(
          violations,
          snapshot.cause.label,
          'dangling-cause',
          `$.snapshots[${String(index)}].cause.eventIds`,
          `틱 ${String(snapshot.tick)} 의 칸이 가리키는 사건 ${eventId} 가 로그에 없다`,
        );
        continue;
      }
      if (event.tick !== snapshot.tick) {
        violateEvent(
          violations,
          event.name,
          'dangling-cause',
          `$.snapshots[${String(index)}].tick`,
          `칸은 틱 ${String(snapshot.tick)} 인데 그 사건은 틱 ${String(event.tick)} 에 일어났다`,
        );
      }
    }
  });

  return violations;
}

/** 로그 한 줄 요약 — 터미널·화면이 같은 문장을 쓴다. */
export function logVerdict(store: WorldStateStore, log: EventLog): string {
  const witnessed = store.snapshots.filter(
    (snapshot) => snapshot.cause.eventIds.length > 0,
  ).length;
  const changes = store.snapshots.length - 1; // genesis 는 변화가 아니다
  return `사건 ${String(log.events.length)} · 변화한 칸 ${String(changes)} 중 사건이 대는 칸 ${String(witnessed)}`;
}
