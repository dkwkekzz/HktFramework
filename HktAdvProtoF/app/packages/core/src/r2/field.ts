// R2-c 현상장과 감사 — 난 흔적이 어디에 쌓이고, 언제까지 남고, 무엇이 흔적 없이 지나갔는가.
//
// R2-b 는 사건 하나가 남기는 흔적을 세운다. 그런데 흔적은 나는 순간에만 있는 것이 아니다 —
// **남아 있다가 삭는다.** 어제 부서진 것은 오늘도 부서진 채이고, 어제 스친 냄새는 오늘 없다.
// R3 이 감지하는 것은 "그때 난 것" 이 아니라 "지금 남아 있는 것" 이므로, 그 자리를 여기서 만든다.
//
// 새 저장소의 규칙을 지어내지 않는다 — R1 `EventLog` 와 같은 모양이다(담기만 하고 지우지 않는다).
// 삭는 것은 지워서가 아니라 **묻는 틱에 따라 답이 갈려서**다: `standingAt(field, tick)` 은 아직
// 나지 않은 것과 이미 삭은 것을 빼고 답한다. R0-b 가 "묻는 틱과 답하는 틱은 다르다" 로 세운 태도
// 그대로다 — 원장이 시간을 세지 않고 변화를 세듯, 현상장도 흔적을 지우지 않고 시간을 지나 보낸다.
//
// 그리고 감사가 둘을 갈라 준다.
//
//   ① **위반** — 로그에 없는 사건을 가리키는 흔적, 새지 않는 자리에서 났다는 흔적, 움직이지
//      않은 자리에서 났다는 흔적, 그리고 **새는 자리를 움직였는데 흔적이 하나도 없는 사건**.
//      마지막 것이 "사건은 흔적을 남긴다" 를 주장이 아니라 검사로 만든다 (R1-b `witnessViolations`
//      가 "세계는 사건으로만 바뀐다" 를 검사로 만든 것과 같은 자리다).
//   ② **사실** — 흔적 없이 지나간 사건(`silentEvents`). 이것은 위반이 아니다. 앎만 움직인 사건은
//      세계를 바꾸고도 아무것도 남기지 않으며, **그것이 정보전이 성립하는 조건이다.** 다만 몇
//      건인지는 값으로 드러난다 — 조용한 사건이 조용히 쌓이지 않게.

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { Tick } from '../v1/tick.ts';
import type { WorldState } from '../o2/world.ts';
import { atomLabel } from '../p0/index.ts';
import { movedEffects, effectText, type EventLog, type WorldEvent } from '../r1/index.ts';
import { leakOf, sealedOf } from './channel.ts';
import {
  channelLabel,
  emitPhenomena,
  leakingEffects,
  movementOf,
  orderPhenomena,
  type EmitOptions,
  type WorldPhenomenon,
} from './emit.ts';
import { violatePhenomenon, type PhenomenonViolation } from './violation.ts';

/** 세계에 난 흔적들 — R1 `EventLog` 와 같은 모양이다: 담기만 하고 지우지 않는다. */
export interface PhenomenonField {
  readonly phenomena: readonly WorldPhenomenon[];
  /** 원인 사건 id 로 찾기 위한 색인 */
  readonly byEvent: ReadonlyMap<Id, readonly WorldPhenomenon[]>;
}

/** 빈 현상장. */
export function openField(): PhenomenonField {
  return { phenomena: [], byEvent: new Map() };
}

/** 흔적들을 더한 새 현상장. 같은 id 는 두 번 담기지 않는다 — 같은 사건은 같은 흔적을 낸다. */
export function recordPhenomena(
  field: PhenomenonField,
  phenomena: readonly WorldPhenomenon[],
): PhenomenonField {
  const known = new Set(field.phenomena.map((entry) => entry.id));
  const added = phenomena.filter((entry) => !known.has(entry.id));
  if (added.length === 0) return field;

  const byEvent = new Map(field.byEvent);
  for (const phenomenon of added) {
    byEvent.set(phenomenon.causeEventId, [
      ...(byEvent.get(phenomenon.causeEventId) ?? []),
      phenomenon,
    ]);
  }
  return { phenomena: [...field.phenomena, ...added], byEvent };
}

/**
 * 사건 하나를 그 세계에서 흔적으로 옮겨 현상장에 담는다.
 *
 * R1 `applyEvent` 와 짝을 이룬다 — 사건이 세계를 바꾸고(R1), 그 사건이 흔적을 남긴다(R2).
 * 흔적이 서지 못하면 현상장은 그대로다: 반쯤 난 흔적을 남기지 않는다.
 */
export function witnessEvent(
  field: PhenomenonField,
  event: WorldEvent,
  world: WorldState,
  options: EmitOptions = {},
): { readonly field: PhenomenonField; readonly emitted: readonly WorldPhenomenon[]; readonly violations: readonly PhenomenonViolation[] } {
  const result = emitPhenomena(event, world, options);
  if (result.violations.length > 0) {
    return { field, emitted: [], violations: result.violations };
  }
  return {
    field: recordPhenomena(field, result.phenomena),
    emitted: result.phenomena,
    violations: [],
  };
}

/**
 * 그 틱에 아직 세계에 남아 있는 흔적들.
 *
 * 아직 나지 않은 것(`atTick` 이 뒤)과 이미 삭은 것(`decaysAtTick` 이 앞)을 뺀다. 사라지지 않는
 * 흔적(`decaysAtTick` null)은 언제 물어도 남아 있다 — 되돌릴 수 없는 원자가 한 일이다.
 */
export function standingAt(
  field: PhenomenonField,
  tick: Tick,
): readonly WorldPhenomenon[] {
  return orderPhenomena(
    field.phenomena.filter(
      (phenomenon) =>
        phenomenon.atTick <= tick &&
        (phenomenon.decaysAtTick === null || phenomenon.decaysAtTick >= tick),
    ),
  );
}

/** 그 자리에 지금 남아 있는 흔적들 — R3 이 거리로 거르기 전에 장소로 먼저 좁힌다. */
export function standingIn(
  field: PhenomenonField,
  tick: Tick,
  placeId: Id,
): readonly WorldPhenomenon[] {
  return standingAt(field, tick).filter((phenomenon) => phenomenon.placeId === placeId);
}

/** 사라지지 않는 흔적들 — 세계가 영영 기억하는 것. */
export function permanentPhenomena(field: PhenomenonField): readonly WorldPhenomenon[] {
  return orderPhenomena(
    field.phenomena.filter((phenomenon) => phenomenon.decaysAtTick === null),
  );
}

/**
 * 흔적 없이 지나간 사건들 — **위반이 아니라 사실이다.**
 *
 * 움직인 자리가 전부 새지 않는 자리였던 사건이다. 앎만 바꾼 사건이 여기 선다: 세계는 바뀌었는데
 * 아무도 그것을 보지 못했다. 이것이 막히면 남의 앎을 흔적으로 읽을 수 있게 되고, 그러면 R4 의
 * 거짓 믿음도 R3 의 선택 감지도 설 자리가 없다.
 */
export function silentEvents(
  log: EventLog,
  options: EmitOptions = {},
): readonly WorldEvent[] {
  return log.events.filter(
    (event) => movedEffects(event).length > 0 && leakingEffects(event, options).length === 0,
  );
}

/** 현상장 감사 결과. */
export interface FieldAudit {
  /** 담긴 흔적 수 */
  readonly recorded: number;
  /** 흔적을 남긴 사건 수 */
  readonly witnessed: number;
  /** 흔적 없이 지나간 사건 (사실) */
  readonly silent: readonly string[];
  /** 사라지지 않는 흔적 수 */
  readonly permanent: number;
  readonly violations: readonly PhenomenonViolation[];
  readonly complete: boolean;
}

/**
 * 현상장을 감사한다 — 흔적이 사건에서 왔는가, 그리고 사건은 흔적을 남겼는가.
 *
 * 던지지 않는다. R1-b `witnessViolations` 의 짝이다: 저쪽은 "사건 없이 담긴 칸" 을 짚고,
 * 이쪽은 "사건 없는 흔적" 과 "흔적 없이 새 나간 변화" 를 짚는다.
 */
export function auditField(
  field: PhenomenonField,
  log: EventLog,
  options: EmitOptions = {},
): FieldAudit {
  const violations: PhenomenonViolation[] = [];

  // ① 흔적마다 — 원인이 로그에 있는가, 그 자리가 실제로 새고 실제로 움직였는가.
  for (const [index, phenomenon] of field.phenomena.entries()) {
    const at = `$.phenomena[${String(index)}]`;
    const where = `${phenomenon.domain}.${phenomenon.holderId}.${phenomenon.path}`;

    if (phenomenon.causeEventId === '') {
      violatePhenomenon(
        violations,
        where,
        'causeless-phenomenon',
        `${at}.causeEventId`,
        '원인 사건을 가리키지 않는 흔적이다 — 원인 없는 지속적 결과는 존재할 수 없다 (O0 caused-persistence)',
      );
      continue;
    }

    const event = log.byId.get(phenomenon.causeEventId);
    if (event === undefined) {
      violatePhenomenon(
        violations,
        where,
        'unlogged-cause',
        `${at}.causeEventId`,
        `원인으로 지목한 사건 ${phenomenon.causeEventId} 가 로그에 없다 — 없던 일이 흔적을 남길 수는 없다`,
      );
      continue;
    }

    if (sealedOf(phenomenon.domain, phenomenon.path, options.sealed) !== null) {
      violatePhenomenon(
        violations,
        where,
        'sealed-leak',
        `${at}.channel`,
        `${where} 는 새지 않는 자리인데 ${channelLabel(phenomenon.channel)} 로 났다고 적혔다 — 봉인된 자리가 새면 아무도 아무것도 숨길 수 없다`,
      );
      continue;
    }

    if (leakOf(phenomenon.domain, phenomenon.path, options.channels) === null) {
      violatePhenomenon(
        violations,
        where,
        'unchanneled-slot',
        `${at}.channel`,
        `${where} 가 어느 통로로 새는지 적혀 있지 않은데 흔적이 났다고 적혔다 (R2-a)`,
      );
      continue;
    }

    const effect = event.effects.find((entry) => effectText(entry) === where);
    if (effect === undefined || movementOf(effect, options.schema).intensity === 0) {
      violatePhenomenon(
        violations,
        where,
        'still-phenomenon',
        at,
        `${event.name} 은 ${where} 를 움직이지 않았는데 그 자리에서 흔적이 났다고 적혔다 — 세계가 그대로면 흔적도 없다`,
      );
    }
  }

  // ② 사건마다 — 새는 자리를 움직였으면 흔적이 있어야 한다.
  const silent: string[] = [];
  let witnessed = 0;
  for (const [index, event] of log.events.entries()) {
    const traces = field.byEvent.get(event.id) ?? [];
    const leaking = leakingEffects(event, options);

    if (traces.length > 0) {
      witnessed += 1;
      continue;
    }
    if (leaking.length === 0) {
      silent.push(`${atomLabel(event.atom)} — ${event.name}`);
      continue;
    }
    violatePhenomenon(
      violations,
      event.name,
      'missing-trace',
      `$.log.events[${String(index)}]`,
      `${event.name} 이 새는 자리 ${leaking.map(effectText).join(', ')} 를 움직였는데 흔적이 하나도 나지 않았다 — 세계가 소리 없이 바뀌었다`,
    );
  }

  return {
    recorded: field.phenomena.length,
    witnessed,
    silent: stableSort(silent, compareStrings),
    permanent: permanentPhenomena(field).length,
    violations,
    complete: violations.length === 0,
  };
}

/** 감사를 한 줄로 접는다 — 터미널·배지용. */
export function fieldVerdict(audit: FieldAudit): string {
  if (!audit.complete) {
    return `현상장이 어긋났다 — ${[...new Set(audit.violations.map((violation) => violation.rule))].join(', ')}`;
  }
  return `흔적 ${String(audit.recorded)} · 흔적을 남긴 사건 ${String(audit.witnessed)} · 흔적 없이 지나간 사건 ${String(audit.silent.length)} · 사라지지 않는 흔적 ${String(audit.permanent)}`;
}

/** 흔적장이 그 자리를 아직 기억하는가 — R3 이 오기 전의 최소 조회. */
export function remembersSlot(
  field: PhenomenonField,
  tick: Tick,
  domain: WorldPhenomenon['domain'],
  holderId: Id,
  path: string,
): boolean {
  return standingAt(field, tick).some(
    (phenomenon) =>
      phenomenon.domain === domain &&
      phenomenon.holderId === holderId &&
      phenomenon.path === path,
  );
}
