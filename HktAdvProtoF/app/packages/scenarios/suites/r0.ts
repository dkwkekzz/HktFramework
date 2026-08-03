// R0 검증 시나리오 3종 — 담기는가, 물리는가, 시간을 가로질러 읽히는가.

import { stateHash } from '@hkt/core/v1';
import {
  chainViolations,
  commit,
  currentSnapshot,
  diffBetween,
  historyOf,
  openStore,
  readAt,
  replayStore,
  snapshotAt,
  storeVerdict,
  type WorldStateSnapshot,
} from '@hkt/core/r0';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  ASKED_TICKS,
  BROKEN_RESULTS,
  COMMIT_LINES,
  EMPTY_GENESIS,
  NOW,
  REGION_SLOT,
  STOCK_SLOT,
  TAMPERED_LEDGER,
  TREND_ATTEMPTS,
  VEIL_LEDGER,
} from './r0-veil-ledger.ts';

/** 정상 — 열 틱을 담으면 여섯이 남고, 그 여섯을 시간으로 가로질러 읽는다. */
export const r0KeepsTheLedger = defineScenario({
  id: 'r0-keeps-the-ledger',
  module: 'R0',
  kind: 'normal',
  purpose:
    '원장은 시간이 아니라 변화를 센다 — 열 틱을 넣으면 여섯이 남고, 칸이 없는 틱을 물으면 그때까지 유효했던 세계가 답하며, 자리의 역사에는 값이 바뀐 칸만 선다. 같은 재료면 다시 세워도 같은 지문이다.',
  arrange: () => ({ store: VEIL_LEDGER, attempts: TREND_ATTEMPTS, lines: COMMIT_LINES }),
  act: ({ store, attempts, lines }) => ({
    // ① 원장은 변화를 센다
    offered: attempts.length,
    kept: store.snapshots.length,
    refused: lines.filter((line) => !line.accepted).map((line) => [line.tick, line.rules[0]]),

    // ② 46 자리가 서 있는데 틱마다 달라지는 것은 넷뿐이다
    slotCounts: [...new Set(store.snapshots.map((snapshot) => snapshot.slotCount))],
    changeCounts: store.snapshots.slice(1).map((snapshot) => snapshot.changes.length),
    genesisChanges: store.snapshots[0]?.changes.length ?? 0,

    // ③ 묻는 틱과 답하는 틱은 다르다
    asked: ASKED_TICKS.map((tick) => {
      const query = snapshotAt(store, tick);
      return [tick, query.snapshot?.tick ?? null, readAt(store, tick, STOCK_SLOT).value];
    }),
    lateNote: snapshotAt(store, NOW + 30).note.includes('달라진 것이 없다'),

    // ④ 자리의 역사는 값이 바뀐 칸만 남는다
    stockHistory: historyOf(store, STOCK_SLOT).map((entry) => [entry.tick, entry.after]),
    regionHistory: historyOf(store, REGION_SLOT).length,

    // ⑤ 두 틱 사이는 O2 가 센다
    span: diffBetween(store, NOW, NOW + 15).entries.length,
    spanSteps: diffBetween(store, NOW, NOW + 15).steps,

    // ⑥ 사슬은 온전하고, 다시 세워도 같은 지문이다
    chain: chainViolations(store).length,
    replayed: replayStore(store).ledgerHash === store.ledgerHash,
    current: currentSnapshot(store)?.tick ?? null,
    verdict: storeVerdict(store).startsWith('칸 6 · 틱 400~415'),
  }),
  assert: (result): readonly Assertion[] => [
    expectState('열 틱을 담아 달라고 냈다', 10, result.offered),
    expectState('남은 칸은 여섯이다 — 원장은 시간이 아니라 변화를 센다', 6, result.kept),
    expectState(
      '물린 넷은 전부 창고가 바닥난 뒤다 — 세계가 그대로면 칸이 늘지 않는다',
      [
        [421, 'empty-commit'],
        [427, 'empty-commit'],
        [433, 'empty-commit'],
        [442, 'empty-commit'],
      ],
      result.refused,
    ),
    expectState('세계에는 늘 46 자리가 서 있다', [46], result.slotCounts),
    expectState('첫 칸에서는 46 자리가 전부 새로 생긴다', 46, result.genesisChanges),
    expectState('그 뒤로 달라지는 것은 사냥꾼 넷의 재고뿐이다', [4, 4, 4, 4, 4], result.changeCounts),
    expectState(
      '칸이 없는 틱을 물으면 그때까지 유효했던 세계가 답한다',
      [
        [400, 400, 10],
        [405, 403, 8],
        [415, 415, 0],
        [430, 415, 0],
        [1399, 415, 0],
      ],
      result.asked,
    ),
    expectTrue('답이 어느 틱에서 왔는지가 문장으로 남는다', result.lateNote, result.lateNote),
    expectState(
      '재고 자리의 역사는 값이 바뀐 여섯 칸이다',
      [
        [400, 10],
        [403, 8],
        [406, 6],
        [409, 4],
        [412, 2],
        [415, 0],
      ],
      result.stockHistory,
    ),
    expectState('한 번도 바뀌지 않은 자리는 처음 선 한 줄뿐이다', 1, result.regionHistory),
    expectState('처음과 끝 사이에 달라진 자리는 넷이다', 4, result.span),
    expectState('그 사이에 원장은 다섯 칸 늘었다', 5, result.spanSteps),
    expectState('사슬은 끊긴 데가 없다', 0, result.chain),
    expectTrue('분해했다 다시 세워도 같은 지문이다', result.replayed, result.replayed),
    expectState('지금의 세계는 마지막 칸이다', 415, result.current),
    expectTrue('판정 한 줄이 사람에게 읽힌다', result.verdict, result.verdict),
    expectDeterministic('같은 원장은 언제나 같은 해시다', () => stateHash(VEIL_LEDGER)),
  ],
});

/** 실패 — 담을 수 없는 커밋 일곱이 각자의 사유로 물린다. */
export const r0BrokenCommitRejected = defineScenario({
  id: 'r0-broken-commit-rejected',
  module: 'R0',
  kind: 'failure',
  purpose:
    '되돌아가는 틱·같은 틱·근거 없는 변경·세계에 없는 자리·달라지지 않은 세계·두 번째 genesis·손댄 과거가 각자의 사유로 거부되고, 물린 커밋은 원장을 늘리지 않는다.',
  arrange: () => ({ cases: BROKEN_RESULTS, sound: VEIL_LEDGER, tampered: TAMPERED_LEDGER }),
  act: ({ cases, sound, tampered }) => ({
    // ① 사유마다 하나씩
    rules: cases.map((entry) => [
      entry.expected,
      [...new Set(entry.result.violations.map((violation) => violation.rule))],
    ]),

    // ② 물려도 던지지 않는다 — 원장은 그대로이고 사유가 값으로 남는다
    kept: [...new Set(cases.map((entry) => entry.result.store.snapshots.length))],
    accepted: cases.filter((entry) => entry.result.accepted).length,
    messages: cases.every((entry) => entry.result.violations.every((v) => v.message.length > 0)),

    // ③ 지나간 칸을 손대면 사슬이 그 자리를 짚는다
    tamperedRules: [...new Set(chainViolations(tampered).map((violation) => violation.rule))],
    tamperedPath: chainViolations(tampered)[0]?.path ?? null,
    soundChain: chainViolations(sound).length,

    // ④ 손댄 뒤로는 뒤 칸이 전부 어긋난다 — 한 칸만 걸리는 것이 아니다
    tamperedCount: chainViolations(tampered).length,
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '설 수 없는 커밋 일곱이 각자의 사유로 걸린다',
      [
        ['backward-tick', ['backward-tick']],
        ['duplicate-tick', ['duplicate-tick']],
        ['causeless-commit', ['causeless-commit']],
        ['rejected-state', ['rejected-state']],
        ['empty-commit', ['empty-commit']],
        ['genesis-required', ['genesis-required']],
        ['broken-chain', ['broken-chain']],
      ],
      result.rules,
    ),
    expectState('물린 커밋은 원장을 늘리지 않는다', [6], result.kept),
    expectState('받아들여진 것은 하나도 없다', 0, result.accepted),
    expectTrue('거부는 사유와 함께 남는다 — 던지지 않는다', result.messages, result.messages),
    expectState('손댄 원장은 사슬이 잡는다', ['broken-chain'], result.tamperedRules),
    expectState('손댄 자리가 이름으로 짚힌다', '$.snapshots[2].hash', result.tamperedPath),
    expectState('멀쩡한 원장에는 사슬 문제가 없다', 0, result.soundChain),
    expectState(
      '한 칸을 손대면 그 뒤가 전부 어긋난다 — 손댄 칸 · 뒤 칸 셋 · 원장의 지문',
      8,
      result.tamperedCount,
    ),
  ],
});

/** 경계 — 자리 0 짜리 세계, 세계가 서기 전, 아직 담기지 않은 원장. */
export const r0Boundary = defineScenario({
  id: 'r0-boundary',
  module: 'R0',
  kind: 'boundary',
  purpose:
    '자리 하나 없는 세계도 genesis 로 설 수 있고, 세계가 서기 전과 빈 원장은 값이 없는 것이 아니라 물을 자리가 없는 것으로 갈리며, 같은 칸을 두 번 물으면 차이가 없다.',
  arrange: () => ({ empty: EMPTY_GENESIS, store: VEIL_LEDGER }),
  act: ({ empty, store }) => {
    const emptyStore = openStore();
    const first = store.snapshots[0] as WorldStateSnapshot;
    return {
      // ① 자리 0 짜리 세계도 선다 — 빈 것과 없는 것은 다르다
      emptyAccepted: empty.accepted,
      emptySlots: empty.snapshot?.slotCount ?? -1,
      emptyChanges: empty.snapshot?.changes.length ?? -1,
      emptyPrev: empty.snapshot === null ? '(칸이 없다)' : empty.snapshot.prevHash,

      // ② 그래도 두 번째 genesis 는 없다
      secondGenesis: commit(empty.store, {
        tick: 1,
        // 세계가 실제로 달라지는 재료를 낸다 — 걸리는 것이 genesis 하나임을 보이려고
        states: TREND_ATTEMPTS[0]?.states ?? [],
        cause: { kind: 'genesis' as const, label: '또 처음', eventIds: [] },
      }).violations.map((violation) => violation.rule),

      // ③ 세계가 서기 전 · 빈 원장은 사유가 다르다
      beforeGenesis: snapshotAt(store, first.tick - 1).reason,
      beforeValue: readAt(store, first.tick - 1, STOCK_SLOT).value,
      beforeAsOf: readAt(store, first.tick - 1, STOCK_SLOT).asOfTick,
      emptyStoreReason: snapshotAt(emptyStore, 400).reason,
      emptyStoreVerdict: storeVerdict(emptyStore),
      emptyStoreCurrent: currentSnapshot(emptyStore),

      // ④ 세계에 있지만 그 자리가 없는 것과, 세계가 없는 것은 다르다
      missingSlot: readAt(store, NOW, { domain: 'psychic', ofId: 'subject:없는이', path: 'energy' }),

      // ⑤ 같은 칸을 두 번 물으면 차이가 없다
      sameCell: diffBetween(store, NOW + 4, NOW + 5).steps,
      sameCellEntries: diffBetween(store, NOW + 4, NOW + 5).entries.length,

      // ⑥ 첫 칸은 앞을 가리키지 않는다
      genesisPrev: first.prevHash,
      genesisSeq: first.seq,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectTrue('자리 하나 없는 세계도 담긴다', result.emptyAccepted, result.emptyAccepted),
    expectState('그 세계의 자리는 0 이다', 0, result.emptySlots),
    expectState('달라진 자리도 0 이다 — 그래도 genesis 는 선다', 0, result.emptyChanges),
    expectState('첫 칸은 앞을 가리키지 않는다', null, result.emptyPrev),
    expectState('세계가 두 번 처음 서지는 않는다', ['genesis-required'], result.secondGenesis),
    expectState('세계가 서기 전은 물을 자리가 없다', 'before-genesis', result.beforeGenesis),
    expectState('그때의 값은 null 이다', null, result.beforeValue),
    expectState('어느 칸에서 왔는지도 없다', null, result.beforeAsOf),
    expectState('빈 원장은 빈 원장이라고 답한다', 'empty-store', result.emptyStoreReason),
    expectState(
      '빈 원장의 판정도 한 줄이다',
      '빈 원장 — 아직 세계가 서지 않았다',
      result.emptyStoreVerdict,
    ),
    expectState('빈 원장에는 지금도 없다', null, result.emptyStoreCurrent),
    expectState('세계는 있는데 그 자리가 없으면 사유가 found 다', 'found', result.missingSlot.reason),
    expectState('그때도 값은 null 이다 — 자리가 없는 것과 세계가 없는 것은 다르다', null, result.missingSlot.value),
    expectState('같은 칸을 두 번 물으면 원장은 늘지 않았다', 0, result.sameCell),
    expectState('그래서 차이도 없다', 0, result.sameCellEntries),
    expectState('원장의 첫 칸은 언제나 0 번이다', 0, result.genesisSeq),
    expectState('그 칸은 앞을 가리키지 않는다', null, result.genesisPrev),
  ],
});

export const r0Scenarios = [r0KeepsTheLedger, r0BrokenCommitRejected, r0Boundary];
