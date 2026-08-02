// S3-a 과거 사건 — 원문 S3 조립식의 넷째 줄, "+ 과거 사건".
//
// 개체에게 과거를 주는 방법은 둘뿐이다. 지나온 일을 이야기로 적어 두거나, **그 일이 지금
// 남긴 값**을 적거나. 앞의 것은 세계가 읽지 못한다 — 굶주려 본 적이 있다는 문장은 어떤 규칙도
// 건드리지 못하고, 어떤 주체도 그것을 감지하지 못한다. 그래서 여기서는 뒤의 것만 받는다.
//
//   **흔적 없는 과거는 과거가 아니다.**
//
// 이것은 O1 이 이미 그어 둔 선을 개체에게 적용한 것이다: "아무 상태도 바꾸지 않으면 사건이
// 아니다"(checkEvent). 그리고 O2 가 `historical` 을 영역으로 두지 않은 이유이기도 하다 —
// 원한은 지나간 사건이 **지금** 남긴 값이지 따로 보관된 기록이 아니다.
//
// 그래서 원문 조립식의 "+ 관계" 도 여기로 들어온다. 마을에 진 빚도 협곡에서 잃은 동료도
// 결국 `relational.debt.{subject}` · `relational.grudge.{subject}` 라는 지금의 자리에 적힌다.
// 관계는 따로 있는 것이 아니라 과거가 남긴 값의 한 갈래다.

import { deterministicId, type Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import type { Event } from '../o1/operation.ts';
import type { State, StateValue } from '../o1/being.ts';
import type { SlotRef } from '../o0/definition.ts';
import { isStateDomain, type StateDomain } from '../o2/domain.ts';
import { checkHolder, checkValue } from '../o2/field.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { slotStateId } from '../o2/world.ts';
import { violateInstance, type InstanceRef, type InstanceViolation } from './violation.ts';

/** 과거가 지금 남긴 값 하나 — O2 의 실재하는 자리에 적힌다. */
export interface Residue {
  /** O2 영역 + 경로 (`grudge.subject:…`) */
  readonly slot: SlotRef;
  /** 누구에게 적히는가 — 개체 자신이거나 그 몸이거나 바깥의 누군가 */
  readonly holderId: Id;
  readonly value: StateValue;
}

/** 개체가 지나온 일 하나 — O1 Event 에 "지금 남은 것" 을 더한 것. */
export interface PastEvent {
  /** 언제 (tick). 태어난 시각보다 앞서야 한다 — 아직 오지 않은 일은 이력이 아니다 */
  readonly tick: Tick;
  readonly name: string;
  /** 누가 일으켰나. 자연 발생이면 null */
  readonly actorId: Id | null;
  /** 앞선 일 — 이 이력 안의 다른 사건 이름. 최초면 빈 목록 */
  readonly causes: readonly string[];
  /** 지금 남은 것. 비어 있으면 사건이 아니다 */
  readonly residue: readonly Residue[];
}

/** 이력 하나의 ID — 같은 개체·같은 시각·같은 이름이면 언제나 같은 사건이다. */
export function pastEventId(subjectId: Id, event: PastEvent): Id {
  return deterministicId('event', subjectId, String(event.tick), event.name);
}

/** 남긴 값 하나를 O1 State 로 편다 — 세계에 적힐 실제 모양. */
export function residueState(residue: Residue): State {
  return {
    kind: 'State',
    id: slotStateId(residue.slot.domain as StateDomain, residue.holderId, residue.slot.path),
    domain: residue.slot.domain as StateDomain,
    ofId: residue.holderId,
    path: residue.slot.path,
    value: residue.value,
  };
}

/** 이력 하나를 O1 Event 로 편다 — 개체의 과거도 세계의 사건과 같은 모양이어야 한다. */
export function pastEventOf(subjectId: Id, event: PastEvent, history: readonly PastEvent[]): Event {
  return {
    kind: 'Event',
    id: pastEventId(subjectId, event),
    tick: event.tick,
    name: event.name,
    actorId: event.actorId,
    changedStateIds: event.residue.map((residue) => residueState(residue).id),
    causeIds: event.causes
      .map((name) => history.find((entry) => entry.name === name))
      .filter((entry): entry is PastEvent => entry !== undefined)
      .map((entry) => pastEventId(subjectId, entry)),
  };
}

/** 이력 전부가 지금 남긴 값 — 뒤의 사건이 앞의 값을 덮는다 (시간 순서 그대로). */
export function historyResidue(history: readonly PastEvent[]): readonly Residue[] {
  const bySlot = new Map<string, Residue>();
  for (const event of history) {
    for (const residue of event.residue) {
      bySlot.set(residueKey(residue), residue);
    }
  }
  return [...bySlot.values()];
}

/** 남긴 값 하나의 자리 열쇠 — 누구의 어느 자리인가. */
export function residueKey(residue: Residue): string {
  return `${residue.slot.domain}.${residue.holderId}.${residue.slot.path}`;
}

/** 이력이 온전한가 — 흔적을 남기는가, 그 흔적이 세계의 자리인가, 시간이 앞뒤로 서는가. */
export function checkHistory(
  subject: InstanceRef,
  history: readonly PastEvent[],
  bornAtTick: Tick,
  out: InstanceViolation[],
  schema: StateSchema = STATE_SCHEMA,
  base = '$.history',
): void {
  const seenSlots = new Map<string, string>();
  let previousTick: Tick | null = null;

  for (const [index, event] of history.entries()) {
    const path = `${base}[${String(index)}]`;

    if (event.name === '') {
      violateInstance(
        out,
        subject,
        'bad-past-event',
        `${path}.name`,
        '이름 없는 사건은 다른 사건이 원인으로 가리킬 수 없다',
      );
    }
    if (!Number.isInteger(event.tick) || event.tick < 0) {
      violateInstance(
        out,
        subject,
        'bad-past-event',
        `${path}.tick`,
        `사건의 시각은 0 이상의 정수여야 한다 — ${String(event.tick)}`,
      );
      continue;
    }
    // 개체가 서는 지금(bornAtTick)보다 앞이어야 한다 — 이력은 이미 일어난 것이다.
    if (event.tick > bornAtTick) {
      violateInstance(
        out,
        subject,
        'future-past',
        `${path}.tick`,
        `${String(bornAtTick)}틱에 서는 개체가 ${String(event.tick)}틱의 일을 지고 있다 — 아직 오지 않은 일은 이력이 아니다`,
      );
    }
    if (previousTick !== null && event.tick < previousTick) {
      violateInstance(
        out,
        subject,
        'unordered-history',
        `${path}.tick`,
        `앞의 사건(${String(previousTick)}틱)보다 이르다 — 이력은 시간 순으로 적힌다`,
      );
    }
    previousTick = event.tick;

    for (const [order, cause] of event.causes.entries()) {
      if (cause === event.name) {
        violateInstance(
          out,
          subject,
          'self-caused-past',
          `${path}.causes[${String(order)}]`,
          `${event.name} 이 자기 자신을 원인으로 삼는다 — 원인은 앞에 있어야 한다`,
        );
        continue;
      }
      const earlier = history
        .slice(0, index)
        .some((entry) => entry.name === cause);
      if (!earlier) {
        violateInstance(
          out,
          subject,
          'bad-past-event',
          `${path}.causes[${String(order)}]`,
          `앞선 사건 중에 「${cause}」 가 없다 — 원인은 이 이력 안에서 이미 일어난 일이어야 한다`,
        );
      }
    }

    if (event.residue.length === 0) {
      violateInstance(
        out,
        subject,
        'traceless-past',
        `${path}.residue`,
        `「${event.name}」 이 지금 아무것도 남기지 않았다 — 흔적 없는 과거는 세계의 어떤 규칙도 건드리지 못한다`,
      );
      continue;
    }

    for (const [order, residue] of event.residue.entries()) {
      const residuePath = `${path}.residue[${String(order)}]`;

      if (!isStateDomain(residue.slot.domain)) {
        violateInstance(
          out,
          subject,
          'phantom-slot',
          `${residuePath}.slot`,
          `9영역에 없는 영역이다 — ${JSON.stringify(residue.slot.domain)}`,
        );
        continue;
      }
      const match = lookupField(schema, residue.slot.domain, residue.slot.path);
      if (match === null) {
        violateInstance(
          out,
          subject,
          'phantom-slot',
          `${residuePath}.slot`,
          `세계에 ${residue.slot.domain}.${residue.slot.path} 자리가 없다 — 없는 자리에는 과거도 남지 않는다`,
        );
        continue;
      }

      const holderReason = checkHolder(match.spec.holder, residue.holderId);
      if (holderReason !== null) {
        violateInstance(out, subject, 'foreign-residue', `${residuePath}.holderId`, holderReason);
        continue;
      }

      const valueReason = checkValue(match.spec.value, residue.value);
      if (valueReason !== null) {
        violateInstance(
          out,
          subject,
          'bad-residue',
          `${residuePath}.value`,
          `${match.spec.label} — ${valueReason.message}`,
        );
        continue;
      }

      // 같은 자리에 두 과거가 다른 값을 남기면 어느 것이 지금인지 알 수 없다.
      // (같은 값이면 뒤의 것이 앞의 것을 그대로 덮으므로 다툼이 아니다.)
      const key = residueKey(residue);
      const previous = seenSlots.get(key);
      const current = JSON.stringify(residue.value);
      if (previous !== undefined && previous !== current) {
        violateInstance(
          out,
          subject,
          'duplicate-residue',
          `${residuePath}.value`,
          `${match.spec.label} 자리에 두 과거가 다른 값을 남긴다 (${previous} ↔ ${current}) — 뒤의 것이 이기려면 앞의 것을 덮는 사건이어야 한다`,
        );
      }
      seenSlots.set(key, current);
    }
  }
}

/** 이력을 한 줄로 접는다 — 개체 카드용. */
export function historySummary(history: readonly PastEvent[]): string {
  if (history.length === 0) return '지고 온 것이 없다';
  return history
    .map((event) => `${String(event.tick)}틱 ${event.name} (${String(event.residue.length)}자리)`)
    .join(' → ');
}

/** 남긴 값을 한 줄로 접는다. */
export function residueSummary(residue: readonly Residue[]): string {
  if (residue.length === 0) return '남은 것이 없다';
  return residue
    .map((entry) => `${entry.slot.path} = ${JSON.stringify(entry.value)}`)
    .join(' · ');
}
