// R0 검증 장면 — D4 가 만든 열 틱을 원장 하나에 담는다.
//
// 장면을 새로 짓지 않는다. D4 는 이미 창고가 비어 가는 열 틱(`TREND_SNAPSHOTS`)을 갖고 있고,
// 그 스냅샷들은 **매번 새로 조립되는 한 컷**이었다 — 누가 갖고 있는 것이 아니었다.
// R0 은 같은 열 틱을 받아 담는다. 그러면 두 가지가 곧바로 눈에 보인다.
//
//   ① **원장은 시간이 아니라 변화를 센다.** 재고가 10 → 8 → 6 → 4 → 2 → 0 으로 내려가는 동안은
//      칸이 쌓이지만, 바닥난 뒤의 넷(틱 421·427·433·442)은 세계가 한 자리도 다르지 않아
//      물린다. 열 틱을 넣으면 여섯이 남는다.
//   ② **그래서 묻는 틱과 답하는 틱이 갈린다.** 틱 430 에는 칸이 없지만 세계는 있다 —
//      틱 415 의 세계가 아직 서 있다.
//
// 담기는 것은 D4 스냅샷의 **State 원소**다(`disassembleWorld`) — 세계를 통째로 베끼지 않고
// O2 조립 관문을 다시 지나게 한다. O2 가 보장한 왕복 성질이 여기서 실제로 쓰인다.

import type { State } from '@hkt/core/o1';
import { disassembleWorld, slotStateId, type StateDomain } from '@hkt/core/o2';
import {
  causedBy,
  commit,
  commitAll,
  genesisCause,
  openStore,
  type CommitAttempt,
  type CommitResult,
  type WorldSlotRef,
  type WorldStateSnapshot,
  type WorldStateStore,
} from '@hkt/core/r0';

import {
  canyonId,
  meatId,
  NOW,
  STOCK_TREND,
  TREND_SNAPSHOTS,
  trackerInstance,
} from './d4-veil-world.ts';

export { canyonId, meatId, NOW, STOCK_TREND, TREND_SNAPSHOTS, trackerInstance };

/** D4 스냅샷 하나를 원장에 담아 달라는 요청으로 — 세계는 State 로 분해되어 관문을 다시 지난다. */
function attemptOf(index: number): CommitAttempt {
  const snapshot = TREND_SNAPSHOTS[index] as (typeof TREND_SNAPSHOTS)[number];
  const stock = STOCK_TREND[index]?.stock ?? 0;
  return {
    tick: snapshot.tick,
    states: disassembleWorld(snapshot.world),
    cause:
      index === 0
        ? genesisCause('붉은 장막의 겨울이 시작된다')
        : causedBy(stock === 0 ? '창고가 바닥났다' : `사흘치를 먹어 재고가 ${String(stock)} 이 됐다`),
  };
}

/** 열 틱 전부를 담아 달라는 요청 — 물릴 것도 함께 낸다 (숨기지 않는다). */
export const TREND_ATTEMPTS: readonly CommitAttempt[] = TREND_SNAPSHOTS.map((_, index) =>
  attemptOf(index),
);

const collected = commitAll(openStore(), TREND_ATTEMPTS);

/** 열 틱을 담은 결과 — 받아들여진 것과 물린 것이 나란히 남는다. */
export const TREND_RESULTS: readonly CommitResult[] = collected.results;

/** 붉은 장막 겨울의 원장. 열 틱을 넣었는데 칸은 여섯이다. */
export const VEIL_LEDGER: WorldStateStore = collected.store;

/** 커밋 시도 한 줄 — 화면·시나리오가 같은 재료를 쓴다. */
export interface CommitLine {
  readonly tick: number;
  readonly stock: number;
  readonly accepted: boolean;
  readonly changed: number;
  readonly rules: readonly string[];
  readonly note: string;
}

export const COMMIT_LINES: readonly CommitLine[] = TREND_RESULTS.map((result, index) => ({
  tick: STOCK_TREND[index]?.tick ?? -1,
  stock: STOCK_TREND[index]?.stock ?? -1,
  accepted: result.accepted,
  changed: result.snapshot?.changes.length ?? 0,
  rules: [...new Set(result.violations.map((violation) => violation.rule))],
  note:
    result.violations[0]?.message ??
    (result.snapshot === null ? '' : `자리 ${String(result.snapshot.slotCount)} 이 섰다`),
}));

/** 이 장면에서 계속 들여다볼 자리 — 몰이꾼의 고기 재고. */
export const STOCK_SLOT: WorldSlotRef = {
  domain: 'economic',
  ofId: trackerInstance.id,
  path: `stock.${meatId}`,
};

/** 한 번도 바뀌지 않는 자리 — 몰이꾼이 선 곳. */
export const REGION_SLOT: WorldSlotRef = {
  domain: 'physical',
  ofId: trackerInstance.id,
  path: 'region',
};

/** 물어볼 틱들 — 칸이 있는 틱과 없는 틱을 섞는다. */
export const ASKED_TICKS: readonly number[] = [NOW, NOW + 5, NOW + 15, NOW + 30, NOW + 999];

/** 설 수 없는 커밋 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenCommit {
  readonly broke: string;
  readonly expected: string;
  readonly attempt: CommitAttempt;
  /** 손댄 원장 위에 쌓는 장면이면 그 원장을 따로 준다 */
  readonly store?: WorldStateStore;
}

const slot = (domain: StateDomain, ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

const lastAccepted = VEIL_LEDGER.snapshots.at(-1) as WorldStateSnapshot;
const statesAt = (index: number): readonly State[] =>
  disassembleWorld((TREND_SNAPSHOTS[index] as (typeof TREND_SNAPSHOTS)[number]).world);

/** 지나간 칸의 값 하나를 손댄 원장 — 사슬이 그것을 잡는다. */
export const TAMPERED_LEDGER: WorldStateStore = {
  ...VEIL_LEDGER,
  snapshots: VEIL_LEDGER.snapshots.map((snapshot, index) =>
    index !== 2
      ? snapshot
      : {
          ...snapshot,
          world: {
            ...snapshot.world,
            economic: {
              ...snapshot.world.economic,
              [trackerInstance.id]: {
                ...snapshot.world.economic[trackerInstance.id],
                [`stock.${meatId}`]: 99,
              },
            },
          },
        },
  ),
};

/** 설 수 없는 커밋 여섯 — 사유마다 하나씩. */
export const BROKEN_COMMITS: readonly BrokenCommit[] = [
  {
    broke: '이미 지나간 틱에 세계를 담으려 한다',
    expected: 'backward-tick',
    attempt: { tick: NOW + 3, states: statesAt(1), cause: causedBy('되감기') },
  },
  {
    broke: '이미 담긴 틱에 세계를 하나 더 담으려 한다',
    expected: 'duplicate-tick',
    attempt: { tick: lastAccepted.tick, states: statesAt(0), cause: causedBy('같은 틱에 둘') },
  },
  {
    broke: '무엇 때문에 달라졌는지 없이 세계가 달라진다',
    expected: 'causeless-commit',
    attempt: { tick: NOW + 48, states: statesAt(0), cause: causedBy('   ') },
  },
  {
    broke: '세계에 없는 자리를 담으려 한다',
    expected: 'rejected-state',
    attempt: {
      tick: NOW + 48,
      // 재고가 다시 둘인 세계 — 어긴 값 하나만 걸리게 세계 자체는 달라진 것을 쓴다
      states: [...statesAt(4), slot('biological', trackerInstance.id, 'despair', 0.9)],
      cause: causedBy('없는 자리를 적었다'),
    },
  },
  {
    broke: '한 자리도 다르지 않은 세계로 칸을 늘리려 한다',
    expected: 'empty-commit',
    attempt: { tick: NOW + 48, states: statesAt(5), cause: causedBy('아무 일도 없었다') },
  },
  {
    broke: '세계가 두 번 처음 선다',
    expected: 'genesis-required',
    attempt: { tick: NOW + 48, states: statesAt(0), cause: genesisCause('다시 처음부터') },
  },
  {
    broke: '지나간 칸을 손댄 원장 위에 새 칸을 쌓으려 한다',
    expected: 'broken-chain',
    attempt: { tick: NOW + 48, states: statesAt(0), cause: causedBy('손댄 뒤에 이어 쓴다') },
    store: TAMPERED_LEDGER,
  },
];

/** 거부 결과 — 화면과 시나리오가 같은 재료를 본다. */
export const BROKEN_RESULTS: readonly (BrokenCommit & { readonly result: CommitResult })[] =
  BROKEN_COMMITS.map((entry) => ({
    ...entry,
    result: commit(entry.store ?? VEIL_LEDGER, entry.attempt),
  }));

/** 아무것도 없는 세계의 첫 칸 — 자리 0 으로도 세계는 설 수 있다 (경계). */
export const EMPTY_GENESIS: CommitResult = commit(openStore(), {
  tick: 0,
  states: [],
  cause: genesisCause('아무것도 없는 세계가 선다'),
});
