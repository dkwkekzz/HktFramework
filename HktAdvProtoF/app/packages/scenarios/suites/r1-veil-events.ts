// R1 검증 장면 — 붉은 장막의 겨울을 **사건으로** 다시 세운다.
//
// R0 은 같은 겨울을 여섯 칸으로 담았다. 그런데 그 칸들의 근거는 사람이 적은 문자열 한 줄이었다
// ("사흘치를 먹었다"). 세계는 재고가 왜 줄었는지 몰랐고, 무엇이 그것을 줄일 수 있는지도 몰랐다.
//
// 여기서는 같은 겨울을 **몰이꾼 04 가 낸 사건 다섯**으로 다시 세운다. 그러면 세 가지가 눈에 보인다.
//
//   ① **모든 칸이 사건을 가리킨다.** genesis 를 뺀 다섯 칸이 각각 사건 id 를 대고, 감사가
//      "사건 없이 담긴 칸 0" 을 값으로 낸다.
//   ② **세계는 요청한 만큼만 바뀐다.** 04 가 먹어도 나머지 셋의 재고는 그대로다 — 04 의
//      요청서에 그들의 자리가 없기 때문이다.
//   ③ **어떤 자리는 돌아오지 않는다.** 제거(P0-b `reversible: false`)가 깎은 짐승의 수는
//      되돌리는 사건으로 복구되지 않는다. 획득이 옮긴 재고는 돌아간다.
//
// 세계는 D4·R0 이 쓰던 그 세계다 (`TREND_SNAPSHOTS[0]`) — 장면을 새로 짓지 않는다.

import { disassembleWorld, readSlot } from '@hkt/core/o2';
import type { ActionProposal } from '@hkt/core/p0';
import {
  commit,
  genesisCause,
  latest,
  openStore,
  type WorldStateSnapshot,
  type WorldStateStore,
} from '@hkt/core/r0';
import {
  applyEvent,
  mintEvent,
  openLog,
  witnessViolations,
  type ApplyResult,
  type EventLog,
  type EventValue,
  type WorldEvent,
} from '@hkt/core/r1';

import {
  canyonId,
  greedyInstance,
  meatId,
  NOW,
  priestInstance,
  TREND_SNAPSHOTS,
  trackerInstance,
} from './d4-veil-world.ts';
import { toxinClaimId, villagersId } from './d2-veil-blueprints.ts';

export { canyonId, meatId, NOW, toxinClaimId, trackerInstance, villagersId };

/** 상단 11 — 04 가 손대는 상대. 감춰 둔 몫이 있는 그 사냥꾼이다 (D3 장면 그대로). */
export const rivalId = greedyInstance.id;
/** 사제 — 아무도 손대지 않는 자리. "세계는 요청한 만큼만 바뀐다" 의 대조군이다. */
export const bystanderId = priestInstance.id;

/** 몰이꾼 04 — 이 장면의 손. */
export const actorId = trackerInstance.id;

/** 세계가 처음 서는 칸 — D4 장면의 첫 틱 그대로다. */
const genesisWorld = (TREND_SNAPSHOTS[0] as (typeof TREND_SNAPSHOTS)[number]).world;

export const VEIL_GENESIS: WorldStateStore = commit(openStore(), {
  tick: NOW,
  states: disassembleWorld(genesisWorld),
  cause: genesisCause('붉은 장막의 겨울이 시작된다'),
}).store;

const worldOf = (store: WorldStateStore): (typeof genesisWorld) =>
  (latest(store) as WorldStateSnapshot).world;

/** 사건 하나를 내겠다는 장면 — 요청서와 값, 그리고 사람이 읽는 한 줄. */
export interface EventScene {
  readonly label: string;
  readonly tells: string;
  readonly tick: number;
  readonly proposal: ActionProposal;
  /** 세계를 보고 값을 정한다 — 앞 사건의 결과 위에서 다음 값이 정해진다 */
  readonly values: (store: WorldStateStore) => readonly EventValue[];
}

const ref = (domain: EventValue['domain'], holderId: string, path: string) => ({
  domain,
  holderId,
  path,
});

const stockRefOf = ref('economic', actorId, `stock.${meatId}`);
const hungerRef = ref('biological', actorId, 'hunger');
const vitalityRef = ref('biological', actorId, 'vitality');
const trustRef = ref('relational', actorId, `trust.${villagersId}`);
const certaintyRef = ref('informational', actorId, `certainty.${toxinClaimId}`);
const rivalBodyRef = ref('biological', greedyInstance.id, 'vitality');

const stockNow = (store: WorldStateStore): number =>
  Number(readSlot(worldOf(store), 'economic', actorId, `stock.${meatId}`) ?? 0);
const vitalityNow = (store: WorldStateStore): number =>
  Number(readSlot(worldOf(store), 'biological', actorId, 'vitality') ?? 0);

/** 다섯 걸음 — 알아보고, 가져오고, 주고받고, 먹고, 친다. */
export const EVENT_SCENES: readonly EventScene[] = [
  {
    label: '마비독을 알아본다',
    tells: '찾다 — 앎을 세우는 원자다. 치르는 것은 몸이다',
    tick: NOW + 3,
    proposal: {
      atom: 'seek',
      actorId,
      targetIds: [toxinClaimId],
      changes: [certaintyRef],
      payments: [vitalityRef],
      observedIds: [toxinClaimId],
    },
    values: (store) => [
      { kind: 'change', ...certaintyRef, to: 0.8 },
      { kind: 'payment', ...vitalityRef, to: Number((vitalityNow(store) - 0.05).toFixed(2)) },
    ],
  },
  {
    label: '협곡에서 고기를 가져온다',
    tells: '획득 — 재고를 세우고 굶주림을 던다',
    tick: NOW + 6,
    proposal: {
      atom: 'acquire',
      actorId,
      targetIds: [meatId],
      changes: [stockRefOf, hungerRef],
      payments: [vitalityRef],
      observedIds: [meatId],
    },
    values: (store) => [
      { kind: 'change', ...stockRefOf, to: stockNow(store) + 4 },
      { kind: 'change', ...hungerRef, to: 0.2 },
      { kind: 'payment', ...vitalityRef, to: Number((vitalityNow(store) - 0.1).toFixed(2)) },
    ],
  },
  {
    label: '마을과 주고받는다',
    tells: '교환 — 재고를 치르고 신뢰를 세운다 (P3-a 가 신뢰를 세우는 유일한 원자로 짚은 것)',
    tick: NOW + 9,
    proposal: {
      atom: 'exchange',
      actorId,
      targetIds: [villagersId],
      changes: [trustRef],
      payments: [stockRefOf],
      observedIds: [villagersId],
    },
    values: (store) => [
      { kind: 'change', ...trustRef, to: 0.8 },
      { kind: 'payment', ...stockRefOf, to: stockNow(store) - 3 },
    ],
  },
  {
    label: '사흘치를 먹는다',
    tells: '획득 — 섭식은 P0-a 환문에서 획득 한 칸에 선다',
    tick: NOW + 12,
    proposal: {
      atom: 'acquire',
      actorId,
      targetIds: [meatId],
      changes: [stockRefOf, hungerRef],
      payments: [vitalityRef],
      observedIds: [meatId],
    },
    values: (store) => [
      { kind: 'change', ...stockRefOf, to: stockNow(store) - 2 },
      { kind: 'change', ...hungerRef, to: 0.05 },
      { kind: 'payment', ...vitalityRef, to: Number((vitalityNow(store) - 0.05).toFixed(2)) },
    ],
  },
  {
    label: '상단 11 을 친다',
    tells: '제거 — 되돌릴 수 없는 원자다 (P0-b reversible: false). 한 일은 봉인되고 대가는 채워진다',
    tick: NOW + 15,
    proposal: {
      atom: 'destroy',
      actorId,
      targetIds: [greedyInstance.id],
      changes: [rivalBodyRef],
      payments: [vitalityRef, stockRefOf],
      observedIds: [greedyInstance.id],
    },
    values: (store) => [
      { kind: 'change', ...rivalBodyRef, to: 0.2 },
      { kind: 'payment', ...vitalityRef, to: Number((vitalityNow(store) - 0.1).toFixed(2)) },
      { kind: 'payment', ...stockRefOf, to: stockNow(store) - 1 },
    ],
  },
];

/** 장면 하나를 사건으로 세워 세계에 얹은 결과. */
export interface AppliedScene {
  readonly scene: EventScene;
  readonly event: WorldEvent | null;
  readonly result: ApplyResult | null;
  readonly mintViolations: readonly { readonly rule: string; readonly message: string }[];
}

function runScenes(scenes: readonly EventScene[]): {
  readonly store: WorldStateStore;
  readonly log: EventLog;
  readonly applied: readonly AppliedScene[];
} {
  let store = VEIL_GENESIS;
  let log = openLog();
  const applied: AppliedScene[] = [];

  for (const scene of scenes) {
    const mint = mintEvent({
      proposal: scene.proposal,
      world: worldOf(store),
      tick: scene.tick,
      name: scene.label,
      values: scene.values(store),
    });
    if (mint.event === null) {
      applied.push({ scene, event: null, result: null, mintViolations: mint.violations });
      continue;
    }
    const result = applyEvent(store, log, mint.event);
    applied.push({ scene, event: mint.event, result, mintViolations: [] });
    if (result.applied) {
      store = result.store;
      log = result.log;
    }
  }

  return { store, log, applied };
}

const run = runScenes(EVENT_SCENES);

/** 사건으로 자란 겨울의 원장. */
export const VEIL_STORE: WorldStateStore = run.store;
/** 그 사건들. */
export const VEIL_LOG: EventLog = run.log;
/** 장면별 결과 — 화면과 시나리오가 같은 재료를 본다. */
export const VEIL_APPLIED: readonly AppliedScene[] = run.applied;

/** 설 수 없는 사건 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenEvent {
  readonly broke: string;
  readonly expected: string;
  /** 사건을 세우는 단계에서 걸리는가(mint), 세계에 얹는 단계에서 걸리는가(apply) */
  readonly at: 'mint' | 'apply';
  readonly rules: readonly string[];
  readonly messages: readonly string[];
}

const lastWorld = worldOf(VEIL_STORE);
const lastStock = Number(readSlot(lastWorld, 'economic', actorId, `stock.${meatId}`) ?? 0);
const lastVitality = Number(readSlot(lastWorld, 'biological', actorId, 'vitality') ?? 0);

const mintOf = (
  proposal: ActionProposal,
  values: readonly EventValue[],
  name: string,
  tick = NOW + 18,
  world = lastWorld,
): ReturnType<typeof mintEvent> => mintEvent({ proposal, world, tick, name, values });

const eatProposal: ActionProposal = {
  atom: 'acquire',
  actorId,
  targetIds: [meatId],
  changes: [stockRefOf, hungerRef],
  payments: [vitalityRef],
  observedIds: [meatId],
};

const eatValues = (stock: number): readonly EventValue[] => [
  { kind: 'change', ...stockRefOf, to: stock },
  { kind: 'change', ...hungerRef, to: 0.02 },
  { kind: 'payment', ...vitalityRef, to: Number((lastVitality - 0.05).toFixed(2)) },
];

/** ① 원자가 열지 않은 자리 — P0-c 가 잡는다. */
const offAtom = mintOf(
  { ...eatProposal, changes: [ref('institutional', actorId, `law.${toxinClaimId}`)] },
  [{ kind: 'change', ...ref('institutional', actorId, `law.${toxinClaimId}`), to: true }],
  '획득으로 법을 바꾼다',
);

/** ② 요청서에 없는 자리를 슬쩍 끼운다 — R1 이 잡는다. */
const sneaky = mintOf(
  eatProposal,
  [...eatValues(lastStock - 1), { kind: 'change', ...trustRef, to: 1 }],
  '몰래 신뢰까지 올린다',
);

/** ③ 낡은 전제 — 사건이 선 뒤 세계가 움직였다. */
const staleEvent = mintOf(eatProposal, eatValues(lastStock - 1), '낡은 세계에서 먹는다').event;
const movedStore = (() => {
  const ahead = mintOf(eatProposal, eatValues(lastStock - 2), '먼저 먹는다', NOW + 18).event;
  return ahead === null ? VEIL_STORE : applyEvent(VEIL_STORE, VEIL_LOG, ahead).store;
})();
const staleApply =
  staleEvent === null ? null : applyEvent(movedStore, VEIL_LOG, { ...staleEvent, tick: NOW + 21 });

/** ④ 되돌릴 수 없는 것을 되돌린다 — 친 상대의 몸이 원래대로 돌아온다. */
const undoEvent = mintOf(
  {
    atom: 'destroy',
    actorId,
    targetIds: [greedyInstance.id],
    changes: [rivalBodyRef],
    payments: [vitalityRef, stockRefOf],
    observedIds: [greedyInstance.id],
  },
  [
    { kind: 'change', ...rivalBodyRef, to: 0.8 },
    { kind: 'payment', ...vitalityRef, to: Number((lastVitality - 0.05).toFixed(2)) },
    { kind: 'payment', ...stockRefOf, to: lastStock - 1 },
  ],
  '없던 일로 한다',
).event;
const undoApply = undoEvent === null ? null : applyEvent(VEIL_STORE, VEIL_LOG, undoEvent);

/** ⑤ 사건 없이 담긴 칸 — 원장 감사가 잡는다. */
export const SILENT_STORE: WorldStateStore = commit(VEIL_STORE, {
  tick: NOW + 18,
  states: disassembleWorld(lastWorld).map((state) =>
    state.domain === 'economic' && state.ofId === actorId
      ? { ...state, value: 99 }
      : state,
  ),
  cause: { kind: 'change' as const, label: '누군가 창고를 채웠다', eventIds: [] },
}).store;

/** ⑥ 공짜 사건 — 대가 없이 세계를 바꾼다. */
const free = mintOf(
  { ...eatProposal, payments: [] },
  [
    { kind: 'change', ...stockRefOf, to: lastStock - 1 },
    { kind: 'change', ...hungerRef, to: 0.02 },
  ],
  '공짜로 먹는다',
);

/** ⑦ 세계가 그대로다 — 적은 값이 지금 값과 전부 같다. */
const still = mintOf(
  eatProposal,
  [
    { kind: 'change', ...stockRefOf, to: lastStock },
    {
      kind: 'change',
      ...hungerRef,
      to: readSlot(lastWorld, 'biological', actorId, 'hunger') as number,
    },
    { kind: 'payment', ...vitalityRef, to: lastVitality },
  ],
  '아무것도 달라지지 않는다',
);

/** ⑧ 일으킨 자가 없다 — 자연 발생은 유예다. */
const natural = mintOf({ ...eatProposal, actorId: '' }, eatValues(lastStock - 1), '저절로 줄어든다');

const ruleList = (violations: readonly { readonly rule: string }[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];
const messageList = (
  violations: readonly { readonly message: string }[],
): readonly string[] => violations.map((violation) => violation.message);

/** 설 수 없는 사건 여덟 — 사유마다 하나씩, 걸리는 단계까지 함께 적는다. */
export const BROKEN_EVENTS: readonly BrokenEvent[] = [
  {
    broke: '획득으로 법을 바꾸려 한다 (P0-b 가 열지 않은 자리)',
    expected: 'unfit-proposal',
    at: 'mint',
    rules: ruleList(offAtom.violations),
    messages: messageList(offAtom.violations),
  },
  {
    broke: '요청서에 없는 신뢰를 슬쩍 끼운다',
    expected: 'unrequested-effect',
    at: 'mint',
    rules: ruleList(sneaky.violations),
    messages: messageList(sneaky.violations),
  },
  {
    broke: '대가 없이 세계를 바꾸려 한다',
    expected: 'unfit-proposal',
    at: 'mint',
    rules: ruleList(free.violations),
    messages: messageList(free.violations),
  },
  {
    broke: '적은 값이 지금 값과 전부 같다',
    expected: 'changeless-event',
    at: 'mint',
    rules: ruleList(still.violations),
    messages: messageList(still.violations),
  },
  {
    broke: '일으킨 자가 없다 (자연 발생 — W2 로 유예)',
    expected: 'actorless-event',
    at: 'mint',
    rules: ruleList(natural.violations),
    messages: messageList(natural.violations),
  },
  {
    broke: '사건이 선 뒤 세계가 움직였다',
    expected: 'stale-effect',
    at: 'apply',
    rules: ruleList(staleApply?.violations ?? []),
    messages: messageList(staleApply?.violations ?? []),
  },
  {
    broke: '친 상대의 몸을 원래대로 되돌리려 한다',
    expected: 'irreversible-undo',
    at: 'apply',
    rules: ruleList(undoApply?.violations ?? []),
    messages: messageList(undoApply?.violations ?? []),
  },
  {
    broke: '사건 없이 창고를 채운다 (원장 감사가 잡는다)',
    expected: 'unwitnessed-commit',
    at: 'apply',
    rules: ruleList(witnessViolations(SILENT_STORE, VEIL_LOG)),
    messages: messageList(witnessViolations(SILENT_STORE, VEIL_LOG)),
  },
];

/** 바닥난 창고에서 또 먹으려는 사건 — 세계(O2)가 거부한다 (경계). */
export const EMPTY_LARDER = (() => {
  const drained = mintOf(eatProposal, eatValues(0), '남은 것을 다 먹는다', NOW + 18);
  const store = drained.event === null ? VEIL_STORE : applyEvent(VEIL_STORE, VEIL_LOG, drained.event).store;
  const again = mintOf(eatProposal, eatValues(-2), '없는 고기를 먹는다', NOW + 21, worldOf(store));
  return {
    store,
    event: again.event,
    apply: again.event === null ? null : applyEvent(store, VEIL_LOG, again.event),
  };
})();
