// R0-b 시간을 가로지르는 조회 — 원장 위에서 임의의 틱·자리·구간을 읽는다.
//
// R0-a 로 세계는 열이 됐다. 그런데 열은 **읽을 수 있어야** 열이다 — 담기만 하고 물을 수 없으면
// 그것은 원장이 아니라 쓰레기통이다. 여기서 여는 물음은 셋이다.
//
//   그때의 세계는?   `snapshotAt(store, tick)` — 그 틱에 유효한 칸을 준다.
//   그때 그 자리는?  `readAt(...)` — 값 하나와, 그 값이 언제부터 그랬는지.
//   그 자리의 역사는? `historyOf(...)` — 값이 실제로 **바뀐** 틱만 남는다.
//   그 사이에 무엇이? `diffBetween(...)` — 두 칸의 차이 (O2 worldDiff 그대로).
//
// 두 가지를 못박는다.
//
//   ① **묻는 틱과 답하는 틱은 다르다.** 원장은 변화를 세므로 틱 430 에 칸이 없을 수 있다.
//      그러면 "없다" 가 아니라 **그때까지 유효했던 칸**(≤430 중 마지막)이 답이다 — 세계는
//      다음 변화가 올 때까지 그 상태로 있기 때문이다. 답이 어느 틱에서 왔는지를 함께 준다.
//   ② **던지지 않는다.** 첫 칸보다 이른 틱을 물으면 null 과 사유가 온다 (앞 계층과 같은 태도).
//      세계가 서기 전에는 값이 없는 것이 아니라 **물을 자리가 없는 것**이고, 그 구분이 남는다.

import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import type { StateValue } from '../o1/being.ts';
import type { StateDomain } from '../o2/domain.ts';
import { readSlot, worldDiff, type StateDiffEntry } from '../o2/world.ts';
import { latest, type WorldStateSnapshot, type WorldStateStore } from './ledger.ts';

/**
 * 세계 안의 한 자리 — 어느 영역의 **누구의** 어느 경로인가.
 * O0 `SlotRef`(영역.경로)와 이름이 다른 이유가 여기 있다: 원장은 값을 실제로 가진 자를 함께 짚어야 한다.
 */
export interface WorldSlotRef {
  readonly domain: StateDomain;
  readonly ofId: Id;
  readonly path: string;
}

/** 자리 하나를 사람이 읽는 한 줄로 (O2 `whereOf` 와 같은 모양). */
export function worldSlotText(ref: WorldSlotRef): string {
  return `${ref.domain}.${ref.ofId}.${ref.path}`;
}

/** 물음에 답할 수 없는 까닭. */
export const QUERY_REASONS = [
  'found', // 그때 유효했던 칸이 있다
  'before-genesis', // 세계가 서기 전을 물었다
  'empty-store', // 아직 아무 세계도 담기지 않았다
] as const;
export type QueryReason = (typeof QUERY_REASONS)[number];

/** "그때의 세계는?" 의 답. */
export interface SnapshotQuery {
  /** 물은 틱 */
  readonly askedTick: Tick;
  readonly snapshot: WorldStateSnapshot | null;
  readonly reason: QueryReason;
  readonly note: string;
}

/** "그때 그 자리는?" 의 답. */
export interface SlotReading {
  readonly askedTick: Tick;
  readonly ref: WorldSlotRef;
  /** 그때의 값. 자리가 비어 있었으면 null */
  readonly value: StateValue | null;
  /** 그 값이 온 칸의 틱 — 물은 틱과 다를 수 있다 */
  readonly asOfTick: Tick | null;
  readonly reason: QueryReason;
  readonly note: string;
}

/** 자리 하나가 지나온 한 걸음 — 값이 실제로 달라진 자리에만 선다. */
export interface SlotHistoryEntry {
  readonly seq: number;
  readonly tick: Tick;
  readonly change: StateDiffEntry['change'];
  readonly before: StateValue | null;
  readonly after: StateValue | null;
  /** 그 변화를 담은 커밋의 까닭 */
  readonly cause: string;
}

/** 두 틱 사이에 세계가 무엇을 겪었는가. */
export interface LedgerDiff {
  readonly from: WorldStateSnapshot | null;
  readonly to: WorldStateSnapshot | null;
  readonly entries: readonly StateDiffEntry[];
  /** 그 사이에 원장이 늘어난 칸 수 */
  readonly steps: number;
  readonly note: string;
}

/**
 * 그 틱에 유효했던 칸.
 * 원장은 변화를 세므로 물은 틱에 칸이 없을 수 있다 — 그러면 그때까지 유효했던 마지막 칸이 답이다.
 */
export function snapshotAt(store: WorldStateStore, tick: Tick): SnapshotQuery {
  if (store.snapshots.length === 0) {
    return {
      askedTick: tick,
      snapshot: null,
      reason: 'empty-store',
      note: '빈 원장이다 — 아직 세계가 서지 않았다',
    };
  }

  const first = store.snapshots[0] as WorldStateSnapshot;
  if (tick < first.tick) {
    return {
      askedTick: tick,
      snapshot: null,
      reason: 'before-genesis',
      note: `세계는 틱 ${String(first.tick)} 에 섰다 — 그전에는 값이 없는 것이 아니라 물을 자리가 없다`,
    };
  }

  // 원장은 틱이 오름차순이다 (R0-a 관문이 그것을 지킨다) — 뒤에서부터 처음 닿는 칸이 답이다.
  let found = first;
  for (const snapshot of store.snapshots) {
    if (snapshot.tick > tick) break;
    found = snapshot;
  }

  return {
    askedTick: tick,
    snapshot: found,
    reason: 'found',
    note:
      found.tick === tick
        ? `틱 ${String(tick)} 의 세계다`
        : `틱 ${String(found.tick)} 이후로 달라진 것이 없다 — 그때의 세계가 아직 서 있다`,
  };
}

/** 원장의 지금 — 마지막 칸. */
export function currentSnapshot(store: WorldStateStore): WorldStateSnapshot | null {
  return latest(store);
}

/** 그때 그 자리의 값. 던지지 않는다 — 물을 자리가 없으면 사유가 온다. */
export function readAt(store: WorldStateStore, tick: Tick, ref: WorldSlotRef): SlotReading {
  const query = snapshotAt(store, tick);
  if (query.snapshot === null) {
    return {
      askedTick: tick,
      ref,
      value: null,
      asOfTick: null,
      reason: query.reason,
      note: query.note,
    };
  }

  const value = readSlot(query.snapshot.world, ref.domain, ref.ofId, ref.path);
  return {
    askedTick: tick,
    ref,
    value,
    asOfTick: query.snapshot.tick,
    reason: 'found',
    note:
      value === null
        ? `${worldSlotText(ref)} 는 틱 ${String(query.snapshot.tick)} 의 세계에 없는 자리다`
        : query.note,
  };
}

/**
 * 자리 하나의 역사 — 값이 **바뀐 칸만** 남는다.
 *
 * 재료를 새로 만들지 않는다: 각 칸이 이미 품고 있는 `changes`(O2 worldDiff)를 자리로 거를 뿐이다.
 * 그래서 "열 틱을 담았는데 이 자리의 역사는 세 줄" 같은 일이 자연스럽다 — 세계가 달라지지
 * 않은 시간은 역사에 남지 않는다.
 */
export function historyOf(store: WorldStateStore, ref: WorldSlotRef): readonly SlotHistoryEntry[] {
  const where = worldSlotText(ref);
  const entries: SlotHistoryEntry[] = [];

  for (const snapshot of store.snapshots) {
    for (const change of snapshot.changes) {
      if (change.where !== where) continue;
      entries.push({
        seq: snapshot.seq,
        tick: snapshot.tick,
        change: change.change,
        before: change.before,
        after: change.after,
        cause: snapshot.cause.label,
      });
    }
  }

  return entries;
}

/** 두 틱 사이에 세계가 겪은 것 — 차이는 O2 가 세고 R0 은 어느 칸과 어느 칸인지만 고른다. */
export function diffBetween(store: WorldStateStore, fromTick: Tick, toTick: Tick): LedgerDiff {
  const from = snapshotAt(store, fromTick);
  const to = snapshotAt(store, toTick);

  if (from.snapshot === null || to.snapshot === null) {
    return {
      from: from.snapshot,
      to: to.snapshot,
      entries: [],
      steps: 0,
      note: from.snapshot === null ? from.note : to.note,
    };
  }

  const entries = worldDiff(from.snapshot.world, to.snapshot.world);
  const steps = to.snapshot.seq - from.snapshot.seq;
  return {
    from: from.snapshot,
    to: to.snapshot,
    entries,
    steps,
    note:
      steps === 0
        ? `틱 ${String(fromTick)} 과 ${String(toTick)} 사이에 원장이 늘지 않았다 — 같은 칸이다`
        : `칸 ${String(steps)}개를 지나며 자리 ${String(entries.length)}곳이 달라졌다`,
  };
}

/** 그 틱에 이름이 오른 보유자 수 — 화면 요약용. */
export function slotCountAt(store: WorldStateStore, tick: Tick): number {
  return snapshotAt(store, tick).snapshot?.slotCount ?? 0;
}

/** 역사 한 줄을 사람이 읽는 문장으로 — 터미널·화면이 같은 문장을 쓴다. */
export function historyLine(entry: SlotHistoryEntry): string {
  const before = entry.before === null ? '없음' : String(entry.before);
  const after = entry.after === null ? '없음' : String(entry.after);
  return `틱 ${String(entry.tick)} · ${before} → ${after} (${entry.cause})`;
}
