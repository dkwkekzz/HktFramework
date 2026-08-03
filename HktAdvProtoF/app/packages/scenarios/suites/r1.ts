// R1 검증 시나리오 3종 — 사건으로 바뀌는가, 사건 없이는 못 바뀌는가, 세계가 거부하는가.

import { stateHash } from '@hkt/core/v1';
import { readSlot } from '@hkt/core/o2';
import { latest, type WorldStateSnapshot } from '@hkt/core/r0';
import { eventHash, logVerdict, witnessViolations } from '@hkt/core/r1';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  actorId,
  bystanderId,
  BROKEN_EVENTS,
  EMPTY_LARDER,
  meatId,
  rivalId,
  SILENT_STORE,
  VEIL_APPLIED,
  VEIL_GENESIS,
  VEIL_LOG,
  VEIL_STORE,
  villagersId,
} from './r1-veil-events.ts';

const worldNow = (store: typeof VEIL_STORE): WorldStateSnapshot =>
  latest(store) as WorldStateSnapshot;

/** 정상 — 겨울이 사건으로 다시 서고, 모든 칸이 사건을 가리킨다. */
export const r1EventsMoveTheWorld = defineScenario({
  id: 'r1-events-move-the-world',
  module: 'R1',
  kind: 'normal',
  purpose:
    'R0 의 칸은 사람이 적은 문자열을 근거로 삼았다 — 사건 다섯으로 같은 겨울을 다시 세우면 genesis 를 뺀 모든 칸이 사건 id 를 대고, 세계는 요청한 만큼만 바뀐다.',
  arrange: () => ({ applied: VEIL_APPLIED, store: VEIL_STORE, log: VEIL_LOG }),
  act: ({ applied, store, log }) => {
    const world = worldNow(store).world;
    const before = worldNow(VEIL_GENESIS).world;
    return {
      // ① 다섯 걸음이 전부 섰다
      steps: applied.map((entry) => [entry.scene.label, entry.result?.applied ?? false]),
      atoms: log.events.map((event) => event.atom),

      // ② 모든 칸이 사건을 가리킨다
      snapshots: store.snapshots.length,
      genesisCause: store.snapshots[0]?.cause.kind ?? null,
      witnessed: store.snapshots.slice(1).every((snapshot) => snapshot.cause.eventIds.length === 1),
      audit: witnessViolations(store, log).length,
      verdict: logVerdict(store, log),

      // ③ 세계는 요청한 만큼만 바뀐다 — 04 가 움직여도 사제의 재고는 그대로다
      actorStock: readSlot(world, 'economic', actorId, `stock.${meatId}`),
      actorStockBefore: readSlot(before, 'economic', actorId, `stock.${meatId}`),
      bystanderStock: readSlot(world, 'economic', bystanderId, `stock.${meatId}`),
      bystanderBefore: readSlot(before, 'economic', bystanderId, `stock.${meatId}`),

      // ④ 사건이 실제로 바꾼 자리들
      trust: readSlot(world, 'relational', actorId, `trust.${villagersId}`),
      rivalBody: readSlot(world, 'biological', rivalId, 'vitality'),
      rivalBodyBefore: readSlot(before, 'biological', rivalId, 'vitality'),
      changesPerSnapshot: store.snapshots.slice(1).map((snapshot) => snapshot.changes.length),

      // ⑤ 사건마다 왜 그것이 일어났는지가 칸에 남는다
      labels: store.snapshots.slice(1).map((snapshot) => snapshot.cause.label),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState(
      '다섯 걸음이 전부 세계에 얹힌다',
      [
        ['마비독을 알아본다', true],
        ['협곡에서 고기를 가져온다', true],
        ['마을과 주고받는다', true],
        ['사흘치를 먹는다', true],
        ['상단 11 을 친다', true],
      ],
      result.steps,
    ),
    expectState(
      '원자 넷이 쓰인다 — 찾다·획득·교환·제거',
      ['seek', 'acquire', 'exchange', 'acquire', 'destroy'],
      result.atoms,
    ),
    expectState('원장은 genesis + 다섯 칸이다', 6, result.snapshots),
    expectState('첫 칸만 genesis 다', 'genesis', result.genesisCause),
    expectTrue('나머지 다섯 칸은 전부 사건 하나씩을 댄다', result.witnessed, result.witnessed),
    expectState('사건 없이 담긴 칸은 없다', 0, result.audit),
    expectState(
      '판정 한 줄이 그것을 말한다',
      '사건 5 · 변화한 칸 5 중 사건이 대는 칸 5',
      result.verdict,
    ),
    expectState('04 의 재고는 10 에서 시작해', 10, result.actorStockBefore),
    expectState('가져오고 주고받고 먹고 치른 끝에 8 이 된다', 8, result.actorStock),
    expectState('그동안 사제의 재고는 10 그대로다 — 요청서에 그 자리가 없었다', 10, result.bystanderStock),
    expectState('사제의 재고는 처음에도 10 이었다', 10, result.bystanderBefore),
    expectState('마을과 주고받아 신뢰가 0.8 이 된다', 0.8, result.trust),
    expectState('상단 11 의 몸은 0.8 이었다', 0.8, result.rivalBodyBefore),
    expectState('맞고 나서 0.2 가 된다', 0.2, result.rivalBody),
    expectState('칸마다 달라지는 자리는 사건이 적은 만큼이다', [2, 3, 2, 3, 3], result.changesPerSnapshot),
    expectState(
      '칸의 이름표가 무엇이 일어났는지 말한다',
      [
        '찾다 — 마비독을 알아본다',
        '획득 — 협곡에서 고기를 가져온다',
        '교환 — 마을과 주고받는다',
        '획득 — 사흘치를 먹는다',
        '제거 — 상단 11 을 친다',
      ],
      result.labels,
    ),
    expectDeterministic('같은 사건은 언제나 같은 지문이다', () =>
      stateHash(VEIL_LOG.events.map(eventHash)),
    ),
  ],
});

/** 실패 — 여덟 가지가 각자의 사유로, 각자의 단계에서 걸린다. */
export const r1SilentChangeRejected = defineScenario({
  id: 'r1-silent-change-rejected',
  module: 'R1',
  kind: 'failure',
  purpose:
    '원자가 열지 않은 자리·요청서 밖의 자리·공짜·달라지지 않는 값·일으킨 자 없음은 사건이 서기 전에, 낡은 전제·되돌릴 수 없는 것의 되돌림·사건 없이 담긴 칸은 세계에 얹는 자리에서 걸린다.',
  arrange: () => ({ cases: BROKEN_EVENTS, silent: SILENT_STORE, log: VEIL_LOG }),
  act: ({ cases, silent, log }) => ({
    // ① 사유마다 하나씩, 걸리는 단계까지
    rules: cases.map((entry) => [entry.expected, entry.at, entry.rules.includes(entry.expected)]),
    stages: cases.map((entry) => entry.at),

    // ② 거부는 사유와 함께 남는다
    messages: cases.every((entry) => entry.messages.every((message) => message.length > 0)),

    // ③ 사건 없이 담긴 칸은 원장 감사가 짚는다 — 주장이 아니라 검사다
    silentRules: [...new Set(witnessViolations(silent, log).map((violation) => violation.rule))],
    silentMessage: witnessViolations(silent, log)[0]?.message ?? '',

    // ④ 자연 발생은 두 번 걸린다 — P0-c 도, R1 도 받지 않는다
    naturalRules: cases.find((entry) => entry.expected === 'actorless-event')?.rules ?? [],
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '설 수 없는 여덟이 각자의 사유로 걸린다',
      [
        ['unfit-proposal', 'mint', true],
        ['unrequested-effect', 'mint', true],
        ['unfit-proposal', 'mint', true],
        ['changeless-event', 'mint', true],
        ['actorless-event', 'mint', true],
        ['stale-effect', 'apply', true],
        ['irreversible-undo', 'apply', true],
        ['unwitnessed-commit', 'apply', true],
      ],
      result.rules,
    ),
    expectState(
      '다섯은 사건이 서기 전에, 셋은 세계에 얹는 자리에서 걸린다',
      ['mint', 'mint', 'mint', 'mint', 'mint', 'apply', 'apply', 'apply'],
      result.stages,
    ),
    expectTrue('거부는 사유와 함께 남는다 — 던지지 않는다', result.messages, result.messages),
    expectState('사건 없이 담긴 칸은 감사가 짚는다', ['unwitnessed-commit'], result.silentRules),
    expectTrue(
      '그 사유가 "세계는 사건으로만 바뀐다" 를 말한다',
      result.silentMessage.includes('세계는 사건으로만 바뀐다'),
      result.silentMessage,
    ),
    expectState(
      '일으킨 자 없는 사건은 P0-c 와 R1 둘 다에서 걸린다',
      ['unfit-proposal', 'actorless-event'],
      result.naturalRules,
    ),
  ],
});

/** 경계 — 사건은 섰는데 세계가 받지 않는다. */
export const r1Boundary = defineScenario({
  id: 'r1-boundary',
  module: 'R1',
  kind: 'boundary',
  purpose:
    '바닥난 창고에서 또 먹는 사건은 **세워지되 세계가 거부하고**(O2 범위), 원장과 로그는 그대로 남는다. 사건 하나짜리 로그도 감사를 지난다.',
  arrange: () => ({ larder: EMPTY_LARDER, store: VEIL_STORE, log: VEIL_LOG }),
  act: ({ larder, store, log }) => {
    const drainedWorld = worldNow(larder.store).world;
    return {
      // ① 다 먹는 사건은 선다 — 재고 0 은 세계가 받는 값이다
      drainedStock: readSlot(drainedWorld, 'economic', actorId, `stock.${meatId}`),
      drainedSnapshots: larder.store.snapshots.length,

      // ② 그 뒤에 또 먹는 사건도 **세워진다** — R1 은 값의 범위를 판정하지 않는다
      minted: larder.event !== null,
      mintedAtom: larder.event?.atom ?? null,

      // ③ 그런데 세계가 받지 않는다 — 판정은 O2·R0 의 것이다
      applied: larder.apply?.applied ?? null,
      refusedRules: [...new Set((larder.apply?.violations ?? []).map((v) => v.rule))],
      refusedMessage: larder.apply?.violations[0]?.message ?? '',

      // ④ 물려도 원장과 로그는 그대로다
      storeUnchanged: (larder.apply?.store.snapshots.length ?? 0) === larder.store.snapshots.length,
      logUnchanged: (larder.apply?.log.events.length ?? 0) === log.events.length,

      // ⑤ 사건 하나짜리 원장도 감사를 지난다
      firstOnly: witnessViolations(
        { ...store, snapshots: store.snapshots.slice(0, 2) },
        log,
      ).length,
      genesisOnly: witnessViolations({ ...store, snapshots: store.snapshots.slice(0, 1) }, log)
        .length,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('다 먹으면 재고는 0 이다 — 세계가 받는 값이다', 0, result.drainedStock),
    expectState('그 칸까지 원장은 일곱 칸이다', 7, result.drainedSnapshots),
    expectTrue('바닥난 뒤에도 사건 자체는 세워진다', result.minted, result.minted),
    expectState('그 사건의 원자는 획득이다', 'acquire', result.mintedAtom),
    expectState('그런데 세계가 받지 않는다', false, result.applied),
    expectState('사유는 세계가 거부했다는 것이다', ['world-refused'], result.refusedRules),
    expectTrue(
      '그 사유의 원본은 O2 범위 검사다 — R1 이 다시 판정하지 않는다',
      result.refusedMessage.includes('범위여야 한다'),
      result.refusedMessage,
    ),
    expectTrue('물려도 원장은 그대로다', result.storeUnchanged, result.storeUnchanged),
    expectTrue('로그도 그대로다', result.logUnchanged, result.logUnchanged),
    expectState('사건 하나짜리 원장도 감사를 지난다', 0, result.firstOnly),
    expectState('genesis 하나뿐인 원장도 마찬가지다 — 처음 서는 것은 사건이 아니다', 0, result.genesisOnly),
  ],
});

export const r1Scenarios = [r1EventsMoveTheWorld, r1SilentChangeRejected, r1Boundary];
