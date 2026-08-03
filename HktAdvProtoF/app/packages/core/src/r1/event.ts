// R1-a 사건의 모양과 걸림 — 행동 요청 하나를 세계에 낼 수 있는 사건으로 세운다.
//
// P0-c 는 요청(`ActionProposal`)까지 만들어 두고 한 줄을 남겼다: "상태를 고치지 않는다.
// '이렇게 바꾸겠다' 는 제안일 뿐이고, 세계에 적히는 것은 R1·R2 의 몫이다." 그 자리다.
//
// 사건을 새로 설계하지 않는다 — O1 이 이미 `Event` 를 열어 뒀다(틱 · 일으킨 자 · 바뀐 상태 ·
// 까닭). R1 이 하는 일은 그 자리를 **요청과 세계에서** 채우는 것이고, 채울 수 없으면 사유를 남기는 것이다.
//
//   무엇을 바꿀 수 있는가   P0-b 걸림 (`writes` · `pays`) → P0-c `fitAction` 이 판정한다
//   그 자리가 세계에 있는가  O2 스키마
//   지금 값이 무엇인가       R0 이 담은 세계 (`readSlot`)
//   사건이 온전한가          O1 `classify`
//
// 두 가지를 못박는다.
//
//   ① **세계는 요청한 만큼만 바뀐다.** 효과는 요청이 적은 자리(changes · payments) 안에서만
//      선다 — 요청서 밖의 자리를 슬쩍 끼워 넣으면 `unrequested-effect` 다. 이것이 없으면
//      P0-c 관문이 통째로 무의미해진다(요청은 온전한데 바뀌는 것은 딴 것일 수 있으므로).
//   ② **사건은 자기가 선 세계를 기억한다.** 효과마다 "그때 이 값이었다"(`from`)를 세계에서
//      읽어 함께 적는다. 손으로 적게 하지 않는 이유는 하나다 — 적게 하면 틀리게 적을 수 있고,
//      그러면 사건이 무엇을 전제했는지 아무도 모른다. 그 전제가 **적용 시점의 세계와 다른지**를
//      묻는 것은 R1-b 다(`stale-effect`). 같은 자리를 다투는 둘의 판정 자체는 D5·E0 의 몫이다.
//
// 그리고 하나를 **유예한다**: 자연 발생 사건(`actorId` null). O1 은 그 자리를 열어 뒀지만,
// 무엇이 그것을 일으켰는지 대려면 규칙이 실체화(W2)돼야 한다 — 지금 열면 아무 자리나 바꾸는
// 통로가 하나 더 생긴다. P5-b 가 접근 권한을 유예한 것과 같은 태도다.

import { stateHash } from '../v1/hash.ts';
import { deterministicId, type Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { Tick } from '../v1/tick.ts';
import type { StateValue } from '../o1/being.ts';
import type { Event } from '../o1/operation.ts';
import { classify } from '../o1/index.ts';
import type { StateDomain } from '../o2/domain.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { readSlot, slotStateId, type WorldState } from '../o2/world.ts';
import {
  atomLabel,
  changeText,
  fitAction,
  type ActionAtom,
  type ActionProposal,
  type ChangeRef,
} from '../p0/index.ts';
import { violateEvent, type EventViolation } from './violation.ts';

/** 효과가 요청의 어느 쪽에서 왔는가 — P0-c 가 이미 갈라 놓은 축을 그대로 쓴다. */
export const EFFECT_KINDS = ['change', 'payment'] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

/** 사건이 세계의 한 자리에 하는 일. */
export interface EventEffect {
  readonly kind: EffectKind;
  readonly domain: StateDomain;
  readonly holderId: Id;
  readonly path: string;
  /** 이 사건이 전제하는 지금 값 (없던 자리면 null) */
  readonly from: StateValue | null;
  /** 사건 뒤의 값 */
  readonly to: StateValue;
}

/** 자리 하나를 사람이 읽는 한 줄로 — P0-c `changeText` 와 같은 모양이다. */
export function effectText(effect: EventEffect): string {
  return `${effect.domain}.${effect.holderId}.${effect.path}`;
}

/**
 * 실제로 일어난 일 — O1 `Event` 를 그대로 쓰고 R1 이 쓰는 자리 셋을 더한다.
 * 더한 셋은 전부 요청에서 온다: 어느 원자였나 · 누구를 겨눴나 · 무엇을 어떻게 바꿨나.
 */
export interface WorldEvent extends Event {
  readonly atom: ActionAtom;
  readonly targetIds: readonly Id[];
  readonly effects: readonly EventEffect[];
}

/** 사건 하나를 내겠다는 요청 — 요청서(P0-c)와 지금 세계와 바꾸려는 값. */
export interface EventSpec {
  readonly proposal: ActionProposal;
  readonly world: WorldState;
  readonly tick: Tick;
  readonly name: string;
  /** 자리마다 사건 뒤의 값. 요청서에 적힌 자리만 올 수 있다 */
  readonly values: readonly EventValue[];
  /** 무엇 때문에 일어났는가 — 앞선 사건의 id. 최초 사건이면 비운다 */
  readonly causeIds?: readonly Id[];
  readonly schema?: StateSchema;
}

/** 자리 하나에 넣을 값. `from` 은 적지 않는다 — 세계에서 읽는다. */
export interface EventValue {
  readonly kind: EffectKind;
  readonly domain: StateDomain;
  readonly holderId: Id;
  readonly path: string;
  readonly to: StateValue;
}

/** 사건을 세우려 한 결과. 던지지 않는다 — 서지 못하면 사유가 남는다. */
export interface EventMint {
  readonly event: WorldEvent | null;
  readonly violations: readonly EventViolation[];
}

const refText = (ref: { domain: StateDomain; holderId: Id; path: string }): string =>
  `${ref.domain}.${ref.holderId}.${ref.path}`;

/** 요청서가 이 자리를 적었는가 — 적은 쪽(바꾼다/치른다)까지 같아야 한다. */
function requestedIn(refs: readonly ChangeRef[], value: EventValue): boolean {
  return refs.some(
    (ref) =>
      ref.domain === value.domain && ref.holderId === value.holderId && ref.path === value.path,
  );
}

/**
 * 사건 하나를 세운다.
 *
 * 관문 순서에 뜻이 있다: 먼저 **요청이 설 수 있는지**(P0-c)를 묻고, 그다음 일으킨 자를 묻고,
 * 마지막에 효과를 하나씩 세계와 맞댄다. 앞이 무너지면 뒤는 묻지 않는다 — 설 수 없는 요청의
 * 효과를 세계와 맞대 봐야 사유만 늘어난다.
 */
export function mintEvent(spec: EventSpec): EventMint {
  const violations: EventViolation[] = [];
  const { proposal, world, tick, name } = spec;
  const schema = spec.schema ?? STATE_SCHEMA;

  // ① 요청이 설 수 있는가 — P0-c 가 이미 묻는 넷(대상·비용·자리·관측)을 다시 묻지 않는다.
  const fit = fitAction(proposal, '$.proposal', schema);
  for (const reason of fit.violations) {
    violateEvent(
      violations,
      name,
      'unfit-proposal',
      reason.path,
      `${reason.rule} — ${reason.message}`,
    );
  }

  // ② 일으킨 자가 있는가 — 자연 발생은 유예다 (W2 규칙이 서야 근거를 댈 수 있다).
  if (proposal.actorId === '') {
    violateEvent(
      violations,
      name,
      'actorless-event',
      '$.proposal.actorId',
      '일으킨 자가 없는 사건은 아직 낼 수 없다 — 자연 발생의 근거는 규칙(W2)이 서야 댈 수 있다',
    );
  }

  if (violations.length > 0 || fit.atom === null) {
    return { event: null, violations };
  }
  const atom = fit.atom;

  // ③ 효과를 하나씩 세계와 맞댄다.
  const effects: EventEffect[] = [];
  for (const [index, value] of spec.values.entries()) {
    const at = `$.values[${String(index)}]`;
    const refs = value.kind === 'change' ? proposal.changes : proposal.payments;

    if (!requestedIn(refs, value)) {
      violateEvent(
        violations,
        name,
        'unrequested-effect',
        at,
        `요청서에 없는 자리 ${refText(value)} 를 ${value.kind === 'change' ? '바꾸려' : '치르려'} 한다 — 세계는 요청한 만큼만 바뀐다`,
      );
      continue;
    }

    if (lookupField(schema, value.domain, value.path) === null) {
      violateEvent(
        violations,
        name,
        'off-world-effect',
        at,
        `세계에 없는 자리 ${refText(value)} 다`,
      );
      continue;
    }

    const now = readSlot(world, value.domain, value.holderId, value.path);
    effects.push({
      kind: value.kind,
      domain: value.domain,
      holderId: value.holderId,
      path: value.path,
      from: now,
      to: value.to,
    });
  }

  // ④ 아무것도 달라지지 않으면 사건이 아니다 (O1 checkEvent 와 같은 자리).
  const moved = effects.filter((effect) => effect.from !== effect.to);
  if (violations.length === 0 && moved.length === 0) {
    violateEvent(
      violations,
      name,
      'changeless-event',
      '$.values',
      effects.length === 0
        ? '바꾸겠다는 자리가 하나도 없다 — 세계가 그대로면 사건이 아니다'
        : '적은 값이 지금 값과 전부 같다 — 세계가 그대로면 사건이 아니다',
    );
  }

  if (violations.length > 0) return { event: null, violations };

  const ordered = stableSort(effects, (left, right) =>
    compareStrings(effectText(left), effectText(right)),
  );
  const event: WorldEvent = {
    kind: 'Event',
    id: eventIdOf(proposal.actorId, atom, tick, name),
    tick,
    name,
    actorId: proposal.actorId,
    atom,
    targetIds: [...proposal.targetIds],
    effects: ordered,
    changedStateIds: ordered.map((effect) =>
      slotStateId(effect.domain, effect.holderId, effect.path),
    ),
    causeIds: [...(spec.causeIds ?? [])],
  };

  // ⑤ O1 관문 — 사건도 다른 원소처럼 존재론을 지난다.
  const classified = classify(event);
  if (classified.kind !== 'Event') {
    for (const reason of classified.violations) {
      violateEvent(violations, name, 'malformed-event', reason.path, reason.message);
    }
    return { event: null, violations };
  }

  return { event, violations: [] };
}

/** 사건의 id — 유래(일으킨 자 · 원자 · 틱 · 이름)에서 나온다 (V1 결정적 ID). */
export function eventIdOf(actorId: Id, atom: ActionAtom, tick: Tick, name: string): Id {
  return deterministicId('event', actorId, atom, String(tick), name);
}

/** 사건이 실제로 움직인 자리 — 값이 같은 자리는 세지 않는다. */
export function movedEffects(event: WorldEvent): readonly EventEffect[] {
  return event.effects.filter((effect) => effect.from !== effect.to);
}

/** 사건 하나를 한 줄로 — 터미널·화면이 같은 문장을 쓴다. */
export function eventLine(event: WorldEvent): string {
  return `틱 ${String(event.tick)} · ${atomLabel(event.atom)} · ${event.name} (자리 ${String(event.effects.length)})`;
}

/** 효과 하나를 한 줄로. */
export function effectLine(effect: EventEffect): string {
  const before = effect.from === null ? '없음' : String(effect.from);
  return `${effectText(effect)} ${before} → ${String(effect.to)}`;
}

/** 사건의 지문 — 같은 사건이면 같은 해시다. */
export function eventHash(event: WorldEvent): string {
  return stateHash(event);
}

/** 요청서의 자리 하나를 값 선언으로 — 손으로 다시 적지 않게 (`changeText` 와 짝). */
export function valueFor(ref: ChangeRef, kind: EffectKind, to: StateValue): EventValue {
  return { kind, domain: ref.domain, holderId: ref.holderId, path: ref.path, to };
}

/** 요청서의 자리 목록을 사람이 읽는 한 줄로 — 화면·사유가 같은 문자열을 쓴다. */
export function requestText(refs: readonly ChangeRef[]): string {
  return refs.map(changeText).join(' · ');
}
