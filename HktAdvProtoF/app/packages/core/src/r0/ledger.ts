// R0-a 원장과 커밋 관문 — 세계에 처음으로 주인이 생긴다.
//
// D4 에서 세계는 처음으로 값을 가졌다(`WorldSnapshot { tick, world }`). 그런데 그 스냅샷은
// 매번 **새로 만들어졌다** — 누가 갖고 있는 것이 아니라, 필요할 때마다 값 선언에서 조립되는
// 한 컷이었다. 그래서 "그때 세계가 어땠는가" 를 물을 곳이 없었고, 지나간 값은 아무 데도 남지
// 않았다. R0 이 여는 자리가 그것이다: **담는 주인, 그리고 지워지지 않는 열.**
//
// 새로 짓는 것은 최소로 한다.
//
//   조립 관문   O2 `assembleWorld` 를 그대로 지난다 — R0 은 어떤 값이 세계에 놓일 수 있는지
//               다시 판정하지 않는다. 어긴 값이 하나라도 있으면 커밋 전체가 물린다
//               (세계는 반쪽으로 담기지 않는다).
//   무엇이 달라졌나  O2 `worldDiff` 가 말한다 — R0 은 변화를 만들지도, 세지도 않는다.
//   시간        V1 TickClock 이 준다 — 앞으로만 가고, 같은 틱에 세계가 둘일 수 없다.
//   해시        V1 `stateHash` 로 스냅샷마다 앞 해시를 품는다 — 지나간 칸을 손대면 그 뒤가
//               전부 어긋난다.
//
// 그리고 한 가지를 **비워 둔다**: 근거(`CommitCause.eventIds`). 세계가 사건 없이 바뀌지 않게
// 하는 것은 R1 의 일이고, R0 은 그 자리만 열어 둔다 — 지금은 사람이 읽는 이름을 요구할 뿐이다.

import { stateHash, type StateHash } from '../v1/hash.ts';
import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import type { State } from '../o1/being.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import {
  assembleWorld,
  countSlots,
  disassembleWorld,
  emptyWorld,
  worldDiff,
  type StateDiffEntry,
  type WorldState,
} from '../o2/world.ts';
import { violateStore, type StoreViolation } from './violation.ts';

/** 세계가 달라진 까닭. 첫 커밋만 genesis 다. */
export const CAUSE_KINDS = ['genesis', 'change'] as const;
export type CauseKind = (typeof CAUSE_KINDS)[number];

/**
 * 커밋의 근거.
 *
 * `eventIds` 는 **비어 있는 채로 선다** — 사건을 만들고 검사하는 것은 R1 이고, R0 은 그 자리를
 * 여는 데까지만 간다. 그래도 이름은 요구한다: 무엇 때문인지 아무도 말하지 못하는 변경은
 * 원장에 오르지 못한다.
 */
export interface CommitCause {
  readonly kind: CauseKind;
  readonly label: string;
  /** R1 이 채울 자리 — 지금은 언제나 빈 열이다 */
  readonly eventIds: readonly Id[];
}

/** 세계가 처음 서는 근거. */
export function genesisCause(label = '세계가 처음 선다'): CommitCause {
  return { kind: 'genesis', label, eventIds: [] };
}

/** 세계가 달라진 근거 — 사건 id 는 R1 이 채운다. */
export function causedBy(label: string, eventIds: readonly Id[] = []): CommitCause {
  return { kind: 'change', label, eventIds };
}

/** 원장에 오른 세계 한 칸 — 그때의 세계와, 그것이 어디에 이어져 있는지. */
export interface WorldStateSnapshot {
  /** 원장에서 몇 번째인가. 0 이 genesis */
  readonly seq: number;
  readonly tick: Tick;
  readonly world: WorldState;
  readonly cause: CommitCause;
  /** 앞 스냅샷과의 차이 (O2 worldDiff) — genesis 면 전부 added */
  readonly changes: readonly StateDiffEntry[];
  readonly slotCount: number;
  /** 앞 스냅샷의 해시 — genesis 면 null */
  readonly prevHash: StateHash | null;
  /** 이 스냅샷의 해시. 앞 해시를 품으므로 과거를 손대면 뒤가 전부 어긋난다 */
  readonly hash: StateHash;
}

/** 세계의 주인 — 지나온 칸들과 그 지문. */
export interface WorldStateStore {
  readonly snapshots: readonly WorldStateSnapshot[];
  /** 마지막 스냅샷의 해시 = 원장 전체의 지문. 빈 원장이면 null */
  readonly ledgerHash: StateHash | null;
  /** 이 원장이 지키는 자리 규칙 (O2) */
  readonly schema: StateSchema;
}

/** 담아 달라는 요청 — 그 틱의 세계를 이루는 값들과 그 까닭. */
export interface CommitAttempt {
  readonly tick: Tick;
  readonly states: readonly State[];
  readonly cause: CommitCause;
}

/** 담긴 결과. 던지지 않는다 — 물리면 원장이 그대로이고 사유가 남는다. */
export interface CommitResult {
  /** 받아들여졌으면 늘어난 원장, 물렸으면 들어올 때 그대로 */
  readonly store: WorldStateStore;
  readonly snapshot: WorldStateSnapshot | null;
  readonly violations: readonly StoreViolation[];
  readonly accepted: boolean;
}

/** 빈 원장 — 아직 아무 세계도 담기지 않았다. */
export function openStore(schema: StateSchema = STATE_SCHEMA): WorldStateStore {
  return { snapshots: [], ledgerHash: null, schema };
}

/** 원장의 마지막 칸. 비었으면 null. */
export function latest(store: WorldStateStore): WorldStateSnapshot | null {
  return store.snapshots.at(-1) ?? null;
}

/**
 * 스냅샷 하나의 해시 — 앞 해시·틱·세계·근거에서 나온다.
 *
 * 앞 해시를 재료에 넣는 것이 핵심이다. 이러면 지나간 칸의 값 하나만 고쳐도 그 칸의 해시가
 * 달라지고, 그 뒤 칸들이 품고 있는 `prevHash` 와 전부 어긋난다 — 소급 수정이 조용히 지나가지
 * 못한다.
 */
export function snapshotHashOf(
  prevHash: StateHash | null,
  tick: Tick,
  world: WorldState,
  cause: CommitCause,
): StateHash {
  return stateHash({ prevHash, tick, world, cause });
}

/**
 * 원장 자신이 온전한가 — 각 칸의 해시를 앞 칸에서 다시 계산해 대조한다.
 * 손댄 자리를 찾으면 그 자리부터 사유가 쌓인다.
 */
export function chainViolations(store: WorldStateStore): readonly StoreViolation[] {
  const violations: StoreViolation[] = [];
  // 다시 센 해시를 다음 칸의 기대값으로 넘긴다 — 그래서 한 칸을 손대면 **그 뒤가 전부** 어긋난다.
  // 적힌 해시를 그대로 넘기면 손댄 칸 하나만 걸리고 뒤는 멀쩡해 보인다 (그것이 소급 수정의 수법이다).
  let expectedPrev: StateHash | null = null;

  store.snapshots.forEach((snapshot, index) => {
    // 다시 셀 때 **기대되는 앞 해시**를 쓴다 — 적힌 앞 해시를 쓰면 손댄 칸의 다음 칸에서 사슬이
    // 다시 이어져 버려, 그 뒤 칸들이 멀쩡해 보인다.
    const recomputed = snapshotHashOf(
      expectedPrev,
      snapshot.tick,
      snapshot.world,
      snapshot.cause,
    );

    if (snapshot.prevHash !== expectedPrev) {
      violateStore(
        violations,
        snapshot.tick,
        'broken-chain',
        `$.snapshots[${String(index)}].prevHash`,
        `앞 칸의 해시는 ${expectedPrev ?? '(없음)'} 인데 ${snapshot.prevHash ?? '(없음)'} 를 가리킨다 — 지나간 칸이 바뀌었다`,
      );
    }

    if (snapshot.hash !== recomputed) {
      violateStore(
        violations,
        snapshot.tick,
        'broken-chain',
        `$.snapshots[${String(index)}].hash`,
        `적힌 해시는 ${snapshot.hash} 인데 지금 세계에서 다시 세면 ${recomputed} 다 — 담긴 뒤에 손댔다`,
      );
    }
    expectedPrev = recomputed;
  });

  if (store.snapshots.length > 0 && store.ledgerHash !== expectedPrev) {
    violateStore(
      violations,
      latest(store)?.tick ?? -1,
      'broken-chain',
      '$.ledgerHash',
      `원장의 지문이 마지막 칸의 해시(${expectedPrev ?? '(없음)'})와 다르다`,
    );
  }

  return violations;
}

/**
 * 세계 한 칸을 원장에 담는다.
 *
 * 관문 순서에 뜻이 있다: 먼저 **원장 자신이 온전한지** 묻고(손댄 원장 위에 쌓지 않는다),
 * 그다음 근거와 시간을 묻고, 마지막에 세계를 조립한다. 조립은 O2 의 일이므로 R0 은 그 사유를
 * 옮겨 적기만 한다.
 */
export function commit(store: WorldStateStore, attempt: CommitAttempt): CommitResult {
  const violations: StoreViolation[] = [];
  const previous = latest(store);
  const { tick, cause } = attempt;

  // ① 손댄 원장 위에는 쌓지 않는다.
  violations.push(...chainViolations(store));

  // ② 첫 칸만 genesis 다 — 세계가 두 번 처음 설 수는 없다.
  if (previous === null && cause.kind !== 'genesis') {
    violateStore(
      violations,
      tick,
      'genesis-required',
      '$.cause.kind',
      '빈 원장의 첫 칸은 genesis 여야 한다 — 앞이 없는데 무엇이 달라졌다고 말할 수 없다',
    );
  }
  if (previous !== null && cause.kind === 'genesis') {
    violateStore(
      violations,
      tick,
      'genesis-required',
      '$.cause.kind',
      `세계는 이미 틱 ${String(previous.tick)} 에 섰다 — 두 번째 genesis 는 없다`,
    );
  }

  // ③ 근거 없는 변경은 없다 (R1 이 사건 id 로 채울 자리).
  if (cause.kind === 'change' && cause.label.trim() === '') {
    violateStore(
      violations,
      tick,
      'causeless-commit',
      '$.cause.label',
      '무엇 때문에 달라졌는지가 비었다 — 사건 없는 변경은 세계에 오르지 않는다 (R1)',
    );
  }

  // ④ 시간은 앞으로만 간다.
  if (previous !== null && tick < previous.tick) {
    violateStore(
      violations,
      tick,
      'backward-tick',
      '$.tick',
      `원장은 이미 틱 ${String(previous.tick)} 까지 왔다 — 시간은 되돌릴 수 없다 (V1)`,
    );
  }
  if (previous !== null && tick === previous.tick) {
    violateStore(
      violations,
      tick,
      'duplicate-tick',
      '$.tick',
      `틱 ${String(tick)} 의 세계는 이미 담겼다 — 한 틱에 세계가 둘일 수 없다`,
    );
  }

  // ⑤ 세계는 O2 관문을 지난 것만 담긴다 — 반쪽으로 담지 않는다.
  const assembled = assembleWorld(attempt.states, store.schema);
  for (const reason of assembled.violations) {
    violateStore(
      violations,
      tick,
      'rejected-state',
      `$.states[${reason.where}]`,
      `${reason.rule} — ${reason.message}`,
    );
  }

  // ⑥ 원장은 시간이 아니라 변화를 센다.
  const before = previous?.world ?? emptyWorld();
  const changes = worldDiff(before, assembled.world);
  if (previous !== null && changes.length === 0) {
    violateStore(
      violations,
      tick,
      'empty-commit',
      '$.states',
      `틱 ${String(previous.tick)} 의 세계와 한 자리도 다르지 않다 — 그대로인 세계는 칸을 늘리지 않는다`,
    );
  }

  if (violations.length > 0) {
    return { store, snapshot: null, violations, accepted: false };
  }

  const prevHash = previous?.hash ?? null;
  const snapshot: WorldStateSnapshot = {
    seq: store.snapshots.length,
    tick,
    world: assembled.world,
    cause,
    changes,
    slotCount: countSlots(assembled.world),
    prevHash,
    hash: snapshotHashOf(prevHash, tick, assembled.world, cause),
  };

  return {
    store: {
      ...store,
      snapshots: [...store.snapshots, snapshot],
      ledgerHash: snapshot.hash,
    },
    snapshot,
    violations: [],
    accepted: true,
  };
}

/** 담아 달라는 요청 여럿을 순서대로 — 물린 것은 원장을 늘리지 않고 사유만 남는다. */
export function commitAll(
  store: WorldStateStore,
  attempts: readonly CommitAttempt[],
): { readonly store: WorldStateStore; readonly results: readonly CommitResult[] } {
  const results: CommitResult[] = [];
  let current = store;
  for (const attempt of attempts) {
    const result = commit(current, attempt);
    results.push(result);
    current = result.store;
  }
  return { store: current, results };
}

/**
 * 원장을 앞에서부터 다시 세운다 — 같은 재료면 같은 지문이 나와야 한다.
 * (스냅샷을 그대로 베끼지 않고 State 로 분해했다가 다시 조립한다 — O2 왕복 성질을 실제로 쓴다.)
 */
export function replayStore(
  store: WorldStateStore,
  upToTick: Tick = Number.POSITIVE_INFINITY,
): WorldStateStore {
  const attempts = store.snapshots
    .filter((snapshot) => snapshot.tick <= upToTick)
    .map((snapshot) => ({
      tick: snapshot.tick,
      states: disassembleWorld(snapshot.world),
      cause: snapshot.cause,
    }));
  return commitAll(openStore(store.schema), attempts).store;
}

/** 스냅샷을 다시 State 원소로 — 원장에 담긴 것도 여전히 O1 State 다. */
export function snapshotStates(snapshot: WorldStateSnapshot): readonly State[] {
  return disassembleWorld(snapshot.world);
}

/** 원장 한 줄 요약 — 터미널·화면이 같은 문장을 쓴다. */
export function snapshotLine(snapshot: WorldStateSnapshot): string {
  return `#${String(snapshot.seq)} 틱 ${String(snapshot.tick)} · 자리 ${String(snapshot.slotCount)} · 바뀐 자리 ${String(snapshot.changes.length)} · ${snapshot.cause.label}`;
}

/** 원장 전체 판정 한 줄. */
export function storeVerdict(store: WorldStateStore): string {
  if (store.snapshots.length === 0) return '빈 원장 — 아직 세계가 서지 않았다';
  const first = store.snapshots[0] as WorldStateSnapshot;
  const last = latest(store) as WorldStateSnapshot;
  const broken = chainViolations(store).length;
  return `칸 ${String(store.snapshots.length)} · 틱 ${String(first.tick)}~${String(last.tick)} · 지문 ${store.ledgerHash ?? '(없음)'}${
    broken === 0 ? '' : ` · 사슬 끊김 ${String(broken)}`
  }`;
}
