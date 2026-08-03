// R2 검증 장면 — 붉은 장막의 겨울이 **남긴 것**.
//
// R1 은 같은 겨울을 사건 다섯으로 세웠다. 세계는 움직였다 — 재고가 오갔고, 신뢰가 섰고,
// 상단 11 의 몸이 깎였다. 그런데 **아무도 그것을 보지 못했다.** 사건은 세계를 바꿀 뿐 흔적을
// 남기지 않았고, 그래서 R3 은 감지할 것이 없고 R4 는 오해할 것이 없었다.
//
// 여기서는 같은 다섯 사건을 흔적으로 다시 읽는다. 그러면 넷이 눈에 보인다.
//
//   ① **앎은 새지 않는다.** 04 가 마비독을 알아낸 일에서 밖으로 나온 것은 그것을 알아내느라
//      닳은 몸뿐이다. 그 자국은 열여섯 중 열둘이 남길 수 있어(애매함 0.73) 누군가 무언가
//      했다는 것 말고는 말해 주지 않는다.
//   ② **흔적은 지닌 자가 선 곳에서 난다.** 다섯 사건 전부가 협곡에서 났지만, 흔적이 걸리는
//      자리는 그 자리를 지닌 자를 따라간다.
//   ③ **어떤 흔적은 사라지지 않는다.** 되돌릴 수 없는 원자(제거)가 **바꾼** 자리의 자국은
//      영영 남고, 그 일을 하느라 닳은 제 몸의 자국은 며칠이면 삭는다.
//   ④ **세계가 기억하는 것과 세계에 남은 것은 다르다.** 원장은 여섯 칸을 전부 갖고 있지만,
//      한참 뒤의 세계에 서 있는 흔적은 둘뿐이다.
//
// 세계도 사건도 새로 짓지 않는다 — R1 장면(`r1-veil-events.ts`)을 그대로 읽는다.

import { readSlot } from '@hkt/core/o2';
import { latest, type WorldStateSnapshot, type WorldStateStore } from '@hkt/core/r0';
import {
  appendLog,
  mintEvent,
  openLog,
  type EventLog,
  type EventValue,
  type WorldEvent,
} from '@hkt/core/r1';
import {
  LEAK_CHANNELS,
  SEALED_SLOTS,
  auditField,
  checkLeakChannels,
  emitPhenomena,
  openField,
  recordPhenomena,
  silentEvents,
  standingAt,
  witnessEvent,
  type FieldAudit,
  type LeakReport,
  type PhenomenonField,
  type WorldPhenomenon,
} from '@hkt/core/r2';

import {
  actorId,
  meatId,
  NOW,
  rivalId,
  toxinClaimId,
  VEIL_APPLIED,
  VEIL_GENESIS,
  VEIL_LOG,
  VEIL_STORE,
} from './r1-veil-events.ts';

export { actorId, meatId, NOW, rivalId, toxinClaimId, VEIL_LOG, VEIL_STORE };

const worldOf = (store: WorldStateStore): (WorldStateSnapshot)['world'] =>
  (latest(store) as WorldStateSnapshot).world;

/** 사건 하나가 그 세계에 남긴 것 — 화면과 시나리오가 같은 재료를 본다. */
export interface WitnessedScene {
  readonly label: string;
  readonly event: WorldEvent;
  readonly phenomena: readonly WorldPhenomenon[];
  /** 움직였지만 새지 않은 자리들 */
  readonly sealedSlots: readonly string[];
}

/**
 * 다섯 사건을 순서대로 흔적으로 옮긴다.
 *
 * 사건이 선 세계(적용 **전**)에서 흔적을 읽는다 — 사건의 `from` 이 그 세계를 전제하기 때문이다.
 */
function witnessScenes(): {
  readonly field: PhenomenonField;
  readonly scenes: readonly WitnessedScene[];
} {
  let store = VEIL_GENESIS;
  let field = openField();
  const scenes: WitnessedScene[] = [];

  for (const applied of VEIL_APPLIED) {
    const event = applied.event;
    if (event === null) continue;

    const world = worldOf(store);
    const emitted = emitPhenomena(event, world);
    field = witnessEvent(field, event, world).field;
    scenes.push({
      label: applied.scene.label,
      event,
      phenomena: emitted.phenomena,
      sealedSlots: emitted.sealedSlots,
    });

    if (applied.result?.applied === true) store = applied.result.store;
  }

  return { field, scenes };
}

const run = witnessScenes();

/** 겨울이 남긴 흔적들. */
export const VEIL_FIELD: PhenomenonField = run.field;
/** 사건별 흔적. */
export const VEIL_SCENES: readonly WitnessedScene[] = run.scenes;
/** 현상장 감사 — 흔적이 사건에서 왔는가, 사건은 흔적을 남겼는가. */
export const VEIL_AUDIT: FieldAudit = auditField(VEIL_FIELD, VEIL_LOG);
/** 세계의 표면 — R2-a 통로 표가 온전한가. */
export const LEAK_REPORT: LeakReport = checkLeakChannels();

/** 시간이 지나면 무엇이 남는가 — 붕괴를 값으로 본다. */
export interface StandingAt {
  readonly tick: number;
  readonly note: string;
  readonly standing: readonly WorldPhenomenon[];
}

export const DECAY_WALK: readonly StandingAt[] = [
  { tick: NOW + 3, note: '첫 사건이 난 직후', standing: standingAt(VEIL_FIELD, NOW + 3) },
  { tick: NOW + 9, note: '주고받은 직후', standing: standingAt(VEIL_FIELD, NOW + 9) },
  { tick: NOW + 15, note: '상단 11 을 친 직후', standing: standingAt(VEIL_FIELD, NOW + 15) },
  { tick: NOW + 25, note: '열흘 뒤', standing: standingAt(VEIL_FIELD, NOW + 25) },
  { tick: NOW + 500, note: '한참 뒤', standing: standingAt(VEIL_FIELD, NOW + 500) },
];

/**
 * 완전한 침묵 — 앎만 움직이는 사건 (경계).
 *
 * R1 장면의 찾다는 몸을 치렀으므로 자국이 남았다. 대가로 낼 것을 그대로 두면(치르는 자리의 값이
 * 움직이지 않으면) **세계는 바뀌는데 아무 흔적도 나지 않는다** — 그리고 그것은 위반이 아니다.
 */
export const SILENT_SEEK = (() => {
  const world = worldOf(VEIL_GENESIS);
  const certaintyRef = {
    domain: 'informational' as const,
    holderId: actorId,
    path: `certainty.${toxinClaimId}`,
  };
  const vitalityRef = { domain: 'biological' as const, holderId: actorId, path: 'vitality' };
  const vitalityNow = Number(readSlot(world, 'biological', actorId, 'vitality') ?? 0);

  const values: readonly EventValue[] = [
    { kind: 'change', ...certaintyRef, to: 0.95 },
    { kind: 'payment', ...vitalityRef, to: vitalityNow }, // 몸은 닳지 않는다
  ];
  const event = mintEvent({
    proposal: {
      atom: 'seek',
      actorId,
      targetIds: [toxinClaimId],
      changes: [certaintyRef],
      payments: [vitalityRef],
      observedIds: [toxinClaimId],
    },
    world,
    tick: NOW + 1,
    name: '아무도 모르게 알아본다',
    values,
  }).event as WorldEvent;

  const emitted = emitPhenomena(event, world);
  const log = appendLog(openLog(), event);
  return {
    event,
    emitted,
    log,
    audit: auditField(openField(), log),
    silent: silentEvents(log),
  };
})();

/** 설 수 없는 흔적 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenPhenomenon {
  readonly broke: string;
  readonly expected: string;
  /** 흔적이 나기 전에 걸리는가(emit), 현상장을 감사할 때 걸리는가(audit) */
  readonly at: 'emit' | 'audit';
  readonly rules: readonly string[];
  readonly messages: readonly string[];
}

const anyPhenomenon = VEIL_FIELD.phenomena[0] as WorldPhenomenon;
const strikeEvent = (VEIL_LOG.events.at(-1) as WorldEvent);
const genesisWorld = worldOf(VEIL_GENESIS);

const rulesOf = (violations: readonly { readonly rule: string }[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];
const messagesOf = (violations: readonly { readonly message: string }[]): readonly string[] =>
  violations.map((violation) => violation.message);

const auditOne = (phenomenon: WorldPhenomenon, log: EventLog = VEIL_LOG): FieldAudit =>
  auditField(recordPhenomena(openField(), [phenomenon]), log);

/** ① 일으킨 자 없는 사건 — R1 이 유예한 자리가 그대로 옮겨 온다. */
const natural = emitPhenomena({ ...strikeEvent, actorId: null }, genesisWorld);

/** ② 원인 사건 id 가 없다. */
const anonymous = emitPhenomena({ ...strikeEvent, id: '' }, genesisWorld);

/** ③ 표면에 구멍 — 통로가 적히지 않은 자리를 움직인다. */
const holed = emitPhenomena(strikeEvent, genesisWorld, {
  channels: LEAK_CHANNELS.filter((entry) => entry.slot.path !== 'vitality'),
});

/** ④ 어디서 났는지 못 댄다 — 선 곳이 없는 세계. */
const placeless = emitPhenomena(VEIL_LOG.events[0] as WorldEvent, {
  ...genesisWorld,
  physical: {},
});

/** ⑤ 로그에 없는 사건을 원인으로 댄다. */
const dangling = auditOne({ ...anyPhenomenon, causeEventId: 'event:000000000000' });

/** ⑥ 새지 않는 자리에서 났다고 주장한다 — 봉인이 뚫리면 아무것도 숨길 수 없다. */
const sealedLeak = auditOne({
  ...anyPhenomenon,
  causeEventId: (VEIL_LOG.events[0] as WorldEvent).id,
  domain: 'informational',
  holderId: actorId,
  path: `certainty.${toxinClaimId}`,
});

/** ⑦ 움직이지 않은 자리에서 났다고 주장한다. */
const stillClaim = auditOne({
  ...anyPhenomenon,
  causeEventId: strikeEvent.id,
  domain: 'physical',
  holderId: actorId,
  path: 'region',
});

/** ⑧ 새는 자리를 움직였는데 흔적이 하나도 없다 — 세계가 소리 없이 바뀌었다. */
const missing = auditField(openField(), VEIL_LOG);

/** ⑨ 원인을 아예 가리키지 않는 흔적. */
const causeless = auditOne({ ...anyPhenomenon, causeEventId: '' });

export const BROKEN_PHENOMENA: readonly BrokenPhenomenon[] = [
  {
    broke: '일으킨 자 없는 사건의 흔적 (자연 발생 — R1 이 유예했다)',
    expected: 'causeless-phenomenon',
    at: 'emit',
    rules: rulesOf(natural.violations),
    messages: messagesOf(natural.violations),
  },
  {
    broke: '원인 사건 id 가 없다',
    expected: 'causeless-phenomenon',
    at: 'emit',
    rules: rulesOf(anonymous.violations),
    messages: messagesOf(anonymous.violations),
  },
  {
    broke: '통로가 적히지 않은 자리를 움직인다 (표면의 구멍)',
    expected: 'unchanneled-slot',
    at: 'emit',
    rules: rulesOf(holed.violations),
    messages: messagesOf(holed.violations),
  },
  {
    broke: '어디서 났는지 댈 수 없다',
    expected: 'placeless-phenomenon',
    at: 'emit',
    rules: rulesOf(placeless.violations),
    messages: messagesOf(placeless.violations),
  },
  {
    broke: '원인을 아예 가리키지 않는 흔적',
    expected: 'causeless-phenomenon',
    at: 'audit',
    rules: rulesOf(causeless.violations),
    messages: messagesOf(causeless.violations),
  },
  {
    broke: '로그에 없는 사건을 원인으로 댄다',
    expected: 'unlogged-cause',
    at: 'audit',
    rules: rulesOf(dangling.violations),
    messages: messagesOf(dangling.violations),
  },
  {
    broke: '새지 않는 자리(앎)에서 났다고 주장한다',
    expected: 'sealed-leak',
    at: 'audit',
    rules: rulesOf(sealedLeak.violations),
    messages: messagesOf(sealedLeak.violations),
  },
  {
    broke: '움직이지 않은 자리에서 났다고 주장한다',
    expected: 'still-phenomenon',
    at: 'audit',
    rules: rulesOf(stillClaim.violations),
    messages: messagesOf(stillClaim.violations),
  },
  {
    broke: '새는 자리를 움직였는데 흔적이 하나도 없다',
    expected: 'missing-trace',
    at: 'audit',
    rules: rulesOf(missing.violations),
    messages: messagesOf(missing.violations),
  },
];

/** 봉인을 걷으면 어떤 세계가 되는가 — 무엇을 지키고 있는지 보이는 대조군. */
export const UNSEALED_WORLD = (() => {
  const unsealed = SEALED_SLOTS.filter((entry) => entry.slot.domain !== 'informational');
  const channels = [
    ...LEAK_CHANNELS,
    {
      slot: { domain: 'informational' as const, path: 'certainty.{claim}' },
      channels: ['light' as const],
      note: '대조군 — 이렇게 적으면 남의 확신이 그대로 읽히는 세계가 된다',
    },
  ];
  const first = VEIL_LOG.events[0] as WorldEvent;
  return {
    sealed: emitPhenomena(first, genesisWorld),
    leaking: emitPhenomena(first, genesisWorld, { sealed: unsealed, channels }),
  };
})();
