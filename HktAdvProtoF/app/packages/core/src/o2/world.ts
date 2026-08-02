// O2-c 세계 트리 — 흩어진 State 원소들을 9영역 서브트리 하나로 세운다.
//
// 같은 사실을 두 모양으로 갖는다:
//
//   원소 목록  State[]                       사건(R1)이 만들고 고치는 단위. 하나씩 근거를 갖는다.
//   세계 트리  WorldState[영역][보유자][경로]  읽는 단위. "이 주체의 지금" 을 한 번에 본다.
//
// 두 모양은 왕복해야 한다 — 조립했다가 분해하면 처음 목록으로 돌아와야 한다. 그렇지 않으면
// 어느 쪽이 진짜 세계인지 알 수 없게 되고, 리플레이가 성립하지 않는다.
//
// 조립은 관문이다. 스키마를 어긴 상태는 트리에 **들어가지 않고** 사유로 남는다 —
// 세계는 조용히 넓어지지 않는다.

import { deterministicId, type Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { State, StateValue } from '../o1/being.ts';
import { STATE_DOMAINS, type StateDomain } from './domain.ts';
import type { SchemaViolation } from './field.ts';
import { checkAgainstSchema, whereOf, STATE_SCHEMA, type StateSchema } from './schema.ts';

/** 한 영역의 서브트리 — 보유자 → 경로 → 값. */
export type DomainTree = Readonly<Record<Id, Readonly<Record<string, StateValue>>>>;

/** 세계 상태 — 9영역 서브트리. 영역 키는 항상 9개 전부 있다 (빈 영역도 빈 채로 선다). */
export type WorldState = Readonly<Record<StateDomain, DomainTree>>;

/** 조립 결과 — 선 세계와, 세우지 못한 것들의 사유. */
export interface AssembleResult {
  readonly world: WorldState;
  /** 트리에 들어간 상태 (입력 순서) */
  readonly accepted: readonly State[];
  /** 들어가지 못한 상태의 사유 */
  readonly violations: readonly SchemaViolation[];
}

/** 상태 하나가 놓이는 자리. */
export interface StateSlot {
  readonly domain: StateDomain;
  readonly ofId: Id;
  readonly path: string;
  readonly value: StateValue;
}

/** 전후 비교 한 줄. */
export interface StateDiffEntry {
  /** 세계 트리 안의 자리 (`biological.subject:ab12.hunger`) */
  readonly where: string;
  readonly domain: StateDomain;
  readonly ofId: Id;
  readonly path: string;
  readonly change: 'added' | 'removed' | 'changed';
  /** 없던 자리면 null */
  readonly before: StateValue | null;
  /** 사라진 자리면 null */
  readonly after: StateValue | null;
}

/** 아무것도 없는 세계 — 영역 9개는 서 있고 안이 비었다. */
export function emptyWorld(): WorldState {
  return Object.fromEntries(STATE_DOMAINS.map((domain) => [domain, {}])) as WorldState;
}

/**
 * 상태 원소들을 9영역 트리로 조립한다.
 * 스키마를 어긴 상태는 트리에 들어가지 않는다 — 세계는 선언된 자리만 갖는다.
 */
export function assembleWorld(
  states: readonly State[],
  schema: StateSchema = STATE_SCHEMA,
): AssembleResult {
  const tree = Object.fromEntries(STATE_DOMAINS.map((domain) => [domain, {}])) as Record<
    StateDomain,
    Record<Id, Record<string, StateValue>>
  >;
  const accepted: State[] = [];
  const violations: SchemaViolation[] = [];

  for (const state of states) {
    const reasons = checkAgainstSchema(schema, state);
    if (reasons.length > 0) {
      violations.push(...reasons);
      continue;
    }

    const holders = tree[state.domain];
    const paths = (holders[state.ofId] ??= {});
    if (Object.hasOwn(paths, state.path)) {
      // 같은 자리에 값이 둘이면 어느 쪽이 세계인지 알 수 없다 — 먼저 온 값을 지키고 뒤를 막는다.
      violations.push({
        rule: 'duplicate-state',
        where: whereOf(state),
        stateId: state.id,
        message: `이미 ${JSON.stringify(paths[state.path])} 가 놓인 자리다 — 상태는 사건(R1)으로만 바뀐다`,
      });
      continue;
    }
    paths[state.path] = state.value;
    accepted.push(state);
  }

  return { world: tree as WorldState, accepted, violations };
}

/** 세계 트리를 자리 목록으로 편다 — 영역·보유자·경로 순으로 고정 (V1 안정 정렬). */
export function worldSlots(world: WorldState): readonly StateSlot[] {
  const slots: StateSlot[] = [];
  for (const domain of STATE_DOMAINS) {
    const holders = world[domain] ?? {};
    for (const ofId of stableSort(Object.keys(holders), compareStrings)) {
      const paths = holders[ofId] ?? {};
      for (const path of stableSort(Object.keys(paths), compareStrings)) {
        slots.push({ domain, ofId, path, value: paths[path] as StateValue });
      }
    }
  }
  return slots;
}

/** 자리 하나의 State ID — 유래(보유자 + 영역.경로)에서 나온다 (V1 결정적 ID). */
export function slotStateId(domain: StateDomain, ofId: Id, path: string): Id {
  return deterministicId('state', ofId, `${domain}.${path}`);
}

/**
 * 세계 트리를 다시 State 원소로 분해한다.
 * ID 는 유래에서 다시 만들어지므로, 같은 세계면 몇 번을 분해하든 같은 원소가 나온다.
 */
export function disassembleWorld(world: WorldState): readonly State[] {
  return worldSlots(world).map((slot) => ({
    kind: 'State' as const,
    id: slotStateId(slot.domain, slot.ofId, slot.path),
    domain: slot.domain,
    ofId: slot.ofId,
    path: slot.path,
    value: slot.value,
  }));
}

/** 한 자리의 값. 없으면 null. */
export function readSlot(
  world: WorldState,
  domain: StateDomain,
  ofId: Id,
  path: string,
): StateValue | null {
  const paths = world[domain]?.[ofId];
  if (paths === undefined || !Object.hasOwn(paths, path)) return null;
  return paths[path] as StateValue;
}

/** 한 보유자의 한 영역 — "이 주체의 생물 상태" 를 통째로 본다. */
export function readHolder(
  world: WorldState,
  domain: StateDomain,
  ofId: Id,
): Readonly<Record<string, StateValue>> {
  return world[domain]?.[ofId] ?? {};
}

/** 세계에 놓인 값의 개수. */
export function countSlots(world: WorldState): number {
  return worldSlots(world).length;
}

/** 세계에 이름이 오른 보유자들 (영역을 가로질러 한 번씩). */
export function worldHolders(world: WorldState): readonly Id[] {
  const seen = new Set<Id>();
  for (const domain of STATE_DOMAINS) {
    for (const ofId of Object.keys(world[domain] ?? {})) seen.add(ofId);
  }
  return stableSort([...seen], compareStrings);
}

/**
 * 두 세계의 차이 — 생긴 자리·사라진 자리·바뀐 값.
 * 순서는 worldSlots 와 같은 고정 순서다 (화면과 해시가 흔들리지 않게).
 */
export function worldDiff(before: WorldState, after: WorldState): readonly StateDiffEntry[] {
  const entries: StateDiffEntry[] = [];
  const seen = new Set<string>();

  for (const slot of worldSlots(before)) {
    const where = `${slot.domain}.${slot.ofId}.${slot.path}`;
    seen.add(where);
    const next = readSlot(after, slot.domain, slot.ofId, slot.path);
    if (next === null) {
      entries.push({ ...slot, where, change: 'removed', before: slot.value, after: null });
    } else if (next !== slot.value) {
      entries.push({ ...slot, where, change: 'changed', before: slot.value, after: next });
    }
  }

  for (const slot of worldSlots(after)) {
    const where = `${slot.domain}.${slot.ofId}.${slot.path}`;
    if (seen.has(where)) continue;
    entries.push({ ...slot, where, change: 'added', before: null, after: slot.value });
  }

  return stableSort(entries, (a, b) => compareStrings(a.where, b.where));
}

/** 차이를 한 줄 문장으로 — 터미널·화면이 같은 문장을 쓴다. */
export function describeDiff(entry: StateDiffEntry): string {
  switch (entry.change) {
    case 'added':
      return `${entry.where} 없음 → ${String(entry.after)}`;
    case 'removed':
      return `${entry.where} ${String(entry.before)} → 없음`;
    case 'changed':
      return `${entry.where} ${String(entry.before)} → ${String(entry.after)}`;
  }
}
