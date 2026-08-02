// D4-a 세계 스냅샷 — 지금의 세계를 처음으로 한자리에 모은다.
//
// 여기까지 온 계층들은 전부 **세계 없이** 검사됐다. O2 는 자리의 모양을, S 계층은 개체의 모양을,
// D0~D3 은 의존의 모양을 확정했지만 "지금 그 자리에 무엇이 들어 있는가" 를 물은 적은 없다.
// D4 가 그것을 처음 묻는다 — 압력은 모양이 아니라 **값**에서 나오기 때문이다.
//
// 새 저장소를 짓지 않는다. O2 가 이미 조립 관문(`assembleWorld`)과 읽기(`readSlot`)를 갖고 있고,
// S3 가 개체마다 "지금 남은 값"(`Residue`)을 갖고 있다. D4-a 는 그 둘을 잇는 얇은 층이다:
//
//   개체의 residue + 세계의 자리 → State[] → O2 조립 관문 → WorldState → 스냅샷(틱 + 세계)
//
// 그리고 조립 관문이 곧 검사다. 스키마를 어긴 값은 세계에 **들어가지 않고** 사유로 남는다 —
// 압력을 재기 전에 세계가 먼저 온전해야 한다.

import type { Id } from '../v1/id.ts';
import { stateHash } from '../v1/hash.ts';
import type { Tick } from '../v1/tick.ts';
import type { State, StateValue } from '../o1/being.ts';
import type { StateDomain } from '../o2/domain.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import {
  assembleWorld,
  countSlots,
  disassembleWorld,
  emptyWorld,
  readSlot,
  slotStateId,
  worldSlots,
  type WorldState,
} from '../o2/world.ts';
import type { Residue } from '../s3/history.ts';
import type { DependencyNode } from '../d1/index.ts';
import { violatePressure, type PressureViolation } from './violation.ts';

/** 지금의 세계 — 몇 틱째의 어떤 값들인가. */
export interface WorldSnapshot {
  readonly tick: Tick;
  readonly world: WorldState;
}

/** 값 하나를 세계의 자리에 놓는 선언 — State 를 손으로 적지 않게 해 준다. */
export interface SlotValue {
  readonly domain: StateDomain;
  readonly path: string;
  readonly holderId: Id;
  readonly value: StateValue;
}

/** 자리 선언 하나를 O1 State 로 — ID 는 유래에서 나온다 (V1 결정적 ID). */
export function stateOf(slot: SlotValue): State {
  return {
    kind: 'State',
    id: slotStateId(slot.domain, slot.holderId, slot.path),
    domain: slot.domain,
    ofId: slot.holderId,
    path: slot.path,
    value: slot.value,
  };
}

/** 개체가 지고 온 값(S3 Residue)을 세계의 자리 선언으로 — 개체는 빈손으로 서지 않는다. */
export function slotsFromResidue(residue: readonly Residue[]): readonly SlotValue[] {
  return residue.map((entry) => ({
    domain: entry.slot.domain,
    path: entry.slot.path,
    holderId: entry.holderId,
    value: entry.value,
  }));
}

/** 스냅샷을 세우는 결과 — 선 세계와, 들어가지 못한 값의 사유. */
export interface SnapshotResult {
  readonly snapshot: WorldSnapshot;
  readonly violations: readonly PressureViolation[];
  /** 세계에 놓인 값의 수 */
  readonly slotCount: number;
}

/**
 * 값 선언들을 지금의 세계로 모은다. 던지지 않는다 — 어긴 값은 세계에 들어가지 않고 사유로 남는다.
 * 같은 자리에 값이 둘이면 거부한다 (O0 `state-exclusion`: 한 자리에는 하나의 값만 선다).
 */
export function snapshotOf(
  slots: readonly SlotValue[],
  tick: Tick,
  schema: StateSchema = STATE_SCHEMA,
): SnapshotResult {
  const violations: PressureViolation[] = [];

  if (!Number.isInteger(tick) || tick < 0) {
    violatePressure(
      violations,
      '',
      '지금',
      'bad-tick',
      '$.tick',
      `지금은 0 이상의 정수 틱이어야 한다 — ${String(tick)}`,
    );
    return { snapshot: { tick: 0, world: emptyWorld() }, violations, slotCount: 0 };
  }

  const seen = new Map<string, number>();
  const kept: SlotValue[] = [];
  for (const [index, slot] of slots.entries()) {
    const key = `${slot.domain}.${slot.holderId}.${slot.path}`;
    const first = seen.get(key);
    if (first !== undefined) {
      violatePressure(
        violations,
        slot.holderId,
        key,
        'duplicate-state',
        `$.slots[${String(index)}]`,
        `같은 자리에 값이 둘이다 (앞의 것은 ${String(first)}번) — 세계는 한 자리에 하나의 값만 갖는다 (O0 state-exclusion). 값을 바꾸려면 사건(R1)을 거쳐야 한다`,
      );
      continue;
    }
    seen.set(key, index);
    kept.push(slot);
  }

  const assembled = assembleWorld(kept.map(stateOf), schema);
  for (const violation of assembled.violations) {
    violatePressure(
      violations,
      violation.stateId ?? '',
      violation.where,
      'bad-state',
      `$.slots (${violation.where})`,
      `세계에 들어갈 수 없는 값이다 (${violation.rule}) — ${violation.message}`,
    );
  }

  const snapshot: WorldSnapshot = { tick, world: assembled.world };
  return { snapshot, violations, slotCount: countSlots(assembled.world) };
}

/** 한 자리의 지금 값. 아무도 적지 않았으면 null. */
export function valueAt(
  snapshot: WorldSnapshot,
  domain: StateDomain,
  holderId: Id,
  path: string,
): StateValue | null {
  return readSlot(snapshot.world, domain, holderId, path);
}

/** 노드의 조건이 가리키는 자리의 지금 값. 시계 조건이면 null. */
export function valueForNode(
  snapshot: WorldSnapshot,
  node: DependencyNode,
): StateValue | null {
  if (node.condition.kind !== 'slot') return null;
  return valueAt(
    snapshot,
    node.condition.slot.domain,
    node.condition.holderId,
    node.condition.slot.path,
  );
}

/** 값 하나를 바꾼 새 스냅샷 — 시나리오가 세계를 흔들 때 쓴다 (원본은 그대로 둔다). */
export function withSlot(
  snapshot: WorldSnapshot,
  slot: SlotValue,
  tick: Tick = snapshot.tick,
  schema: StateSchema = STATE_SCHEMA,
): SnapshotResult {
  const rest = disassembleWorld(snapshot.world)
    .filter(
      (state) =>
        !(
          state.domain === slot.domain &&
          state.ofId === slot.holderId &&
          state.path === slot.path
        ),
    )
    .map((state) => ({
      domain: state.domain,
      path: state.path,
      holderId: state.ofId,
      value: state.value,
    }));
  return snapshotOf([...rest, slot], tick, schema);
}

/** 몇 틱 뒤의 같은 세계 — 시간만 흐른다 (값을 바꾸는 것은 R1 사건의 몫이다). */
export function atTick(snapshot: WorldSnapshot, tick: Tick): WorldSnapshot {
  return { tick, world: snapshot.world };
}

/** 스냅샷의 해시 — 같은 틱·같은 값이면 같다 (V1 결정성 검사가 이 값에 기댄다). */
export function snapshotHash(snapshot: WorldSnapshot): string {
  return stateHash({
    tick: snapshot.tick,
    slots: worldSlots(snapshot.world).map(
      (slot) => `${slot.domain}.${slot.ofId}.${slot.path}=${String(slot.value)}`,
    ),
  });
}

/** 스냅샷을 한 줄로 접는다 — 화면·터미널용. */
export function snapshotSummary(snapshot: WorldSnapshot): string {
  return `${String(snapshot.tick)}틱 · 자리 ${String(countSlots(snapshot.world))}개 (${snapshotHash(snapshot).slice(0, 8)})`;
}
