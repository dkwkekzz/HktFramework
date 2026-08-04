// R5-b 지닌 사이 — 기억이 사이를 민다.
//
// 세계에는 이미 사이가 적혀 있다. O2 `relational` 이 신뢰·공포·존경·의존·원한·빚·소속 일곱
// 자리를 열어 두었고 P4-b 는 그것을 읽어 목적을 고른다. 그런데 그것은 **세계의 장부**다 —
// 사건(R1)만 그것을 바꾸고, 그 값은 양쪽이 같은 것을 본다.
//
// R5 가 내는 것은 다른 것이다: **그가 지닌 사이.**
//
//   적힌 사이 — 세계가 아는 것. 사건이 남긴 값.
//   지닌 사이 — 그가 아는 것. **제 기억이 민 값.**
//
// 둘이 갈릴 수 있다는 것이 이 계층의 전부다. 세계의 장부에는 아무 일도 적히지 않았는데 누군가는
// 원한을 품고 있을 수 있고(들은 말이 그를 밀었다), 세계의 장부에는 빚이 적혀 있는데 당사자는
// 그것을 모를 수 있다(그 사건이 그의 자리를 바꾸지 않았다). R4 가 실제와 믿음을 가른 그 자리를
// R5 는 **적힌 사이와 지닌 사이**로 잇는다.
//
// **R5 는 여기서 아무 숫자도 지어내지 않는다.**
//
//   축이 무엇인가       O2 `relational` 이 적어 둔 것 그대로 (여섯 — 소속은 값이 아니다)
//   어느 쪽으로 미는가  P0-b `AtomGrounding` — 그 원자가 그 자리를 **세우는가**(writes) **치르는가**(pays)
//   얼마나 미는가       R4 확신 그대로 (`Memory.confidence`)
//   폭이 얼마인가       O2 `numericRange` — 신뢰는 -1~1, 원한은 0~1
//
// 그리고 이 계층의 문장 하나:
//
//   **지목 없는 기억은 아무도 밀지 못한다.**
//
// 무언가 있었다는 것만 아는 기억은 사이를 만들지 않는다 — 누구를 원망해야 할지 모르기 때문이다.
// 그래서 밖에서 본 자들은 아무리 많이 보아도 사이가 움직이지 않고, 겪은 자 하나만 움직인다.
// 그리고 그 벽이 곧 소문이 값을 갖는 이유다 (R5-c) — 남이 말해 주면 지목이 붙는다.

import type { Id } from '../v1/id.ts';
import { stableSort, compareStrings } from '../v1/stable-sort.ts';
import { STATE_SCHEMA, numericRange, readSlot, type StateSchema, type WorldState } from '../o2/index.ts';
import { ATOM_GROUNDINGS, atomLabel, type ActionAtom, type AtomGrounding } from '../p0/index.ts';
import { violateMemory, type MemoryViolation } from './violation.ts';
import { memoryLine, type Memory } from './memory.ts';

/**
 * 사이의 축 — **O2 가 적어 둔 것 그대로다.** R5 는 축을 만들지 않는다.
 *
 * 일곱 중 여섯만 온다. 소속(`belongsTo`)은 참거짓이라 밀고 당길 값이 아니다 — 조직에 반쯤
 * 속할 수는 없다.
 */
export const RELATION_AXES = ['trust', 'fear', 'respect', 'reliance', 'grudge', 'debt'] as const;
export type RelationAxis = (typeof RELATION_AXES)[number];

const AXIS_LABELS: Readonly<Record<RelationAxis, string>> = {
  trust: '신뢰',
  fear: '공포',
  respect: '존경',
  reliance: '의존',
  grudge: '원한',
  debt: '빚',
};

export function axisLabel(axis: RelationAxis): string {
  return AXIS_LABELS[axis];
}

/** 축 하나의 세계 경로 — `trust.{상대}`. */
export function axisPath(axis: RelationAxis, otherId: Id): string {
  return `${axis}.${otherId}`;
}

/** 축 하나가 세계에서 갖는 폭 — O2 가 정한다 (신뢰만 음수로 간다). */
export function axisRange(
  axis: RelationAxis,
  schema: StateSchema = STATE_SCHEMA,
): { readonly min: number; readonly max: number } {
  const spec = schema.fields.find(
    (field) => field.domain === 'relational' && field.path === `${axis}.{subject}`,
  );
  const range = spec === undefined ? null : numericRange(spec.value);
  // 빚은 상한이 사실상 열려 있다(0~10억) — 사이로 읽을 때는 있다·없다로 본다 (P4-a 와 같은 태도)
  if (range === null) return { min: 0, max: 1 };
  if (range.max > 1) return { min: 0, max: 1 };
  return { min: range.min, max: range.max };
}

/**
 * 원자 하나가 축 하나를 어느 쪽으로 미는가 — **P0-b 걸림이 정한 그대로다.**
 *
 * 세우면(`writes`) +1, 치르면(`pays`) −1. 둘 다면 0 — 세우면서 치르는 자리는 방향이 없다.
 * 아무 쪽도 아니면 0. **R5 는 여기서 아무것도 고르지 않는다.**
 *
 * 표를 그대로 읽으면 세 가지가 드러나는데 셋 다 R5 가 정한 것이 아니다.
 *
 *   **원한은 쌓이기만 한다.** 열여섯 중 원한을 치르는 원자는 하나도 없다 — 빼앗기·협박·배신이
 *   세우기만 한다. 그래서 사이는 좋아지는 것보다 나빠지는 것이 쉽다.
 *   **배신은 신뢰에 방향이 없다.** 그 자리를 쓰면서 동시에 치른다(P0-b 가 둘 다 적었다).
 *   **제거는 사이를 만들지 않는다.** 열여섯 중 `relational` 을 하나도 건드리지 않는 쪽이고,
 *   그래서 맞은 자의 원한은 "맞았다" 가 아니라 **그것이 빼앗김이었을 수도 있다**에서 온다.
 */
export function axisPush(
  atom: ActionAtom,
  axis: RelationAxis,
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
): number {
  const grounding = groundings.find((entry) => entry.atom === atom);
  if (grounding === undefined) return 0;
  const hits = (refs: readonly { readonly domain: string; readonly path: string }[]): boolean =>
    refs.some((ref) => ref.domain === 'relational' && ref.path.startsWith(`${axis}.`));
  const builds = hits(grounding.writes);
  const spends = hits(grounding.pays);
  if (builds && spends) return 0;
  if (builds) return 1;
  if (spends) return -1;
  return 0;
}

/**
 * 기억 하나가 축 하나를 미는 값.
 *
 * 좁혀지지 않은 기억은 짚은 원자들의 **평균**으로 민다 — 무엇이었는지 확실하지 않으면 덜 민다.
 * 크기는 확신 그대로다 (R4 가 잰 값을 다시 재지 않는다).
 */
export function memoryPush(
  memory: Memory,
  axis: RelationAxis,
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
): number {
  if (memory.attribution === null) return 0;
  if (memory.suspected.length === 0) return 0;
  const sum = memory.suspected.reduce((acc, atom) => acc + axisPush(atom, axis, groundings), 0);
  return (sum / memory.suspected.length) * memory.confidence;
}

/** 기억 하나가 사이에 남긴 한 자국 — 어느 기억이 얼마나 밀었는가. */
export interface RegardTrace {
  readonly memoryId: Id;
  readonly ground: Memory['ground'];
  readonly push: number;
  readonly line: string;
}

/**
 * 한 주체가 다른 주체에 대해 지닌 사이 하나 — O1 `Claim` 이다.
 *
 * 세계의 `relational` 자리와 같은 축을 쓰되 **주장**이다. 세계는 이것을 모른다.
 */
export interface Relationship {
  readonly kind: 'Claim';
  readonly id: Id;
  readonly holderId: Id;
  readonly aboutId: Id;
  readonly assertion: string;
  readonly confidence: number;
  readonly sourceIds: readonly Id[];
  readonly fromId: Id;
  readonly toId: Id;
  readonly axis: RelationAxis;
  /** 세계가 적어 둔 값 — 출발점 */
  readonly written: number;
  /** 기억이 민 값 */
  readonly carried: number;
  /** 지닌 값 = 적힌 값 + 민 값 (세계가 정한 폭으로 자른다) */
  readonly value: number;
  /** 적힌 것과 지닌 것의 갈림 */
  readonly drift: number;
  readonly traces: readonly RegardTrace[];
}

/** 사이 하나의 id — 유래(누가 · 누구에 대해 · 어느 축)에서 나온다. */
export function relationshipIdOf(fromId: Id, toId: Id, axis: RelationAxis): Id {
  return `claim:regard:${fromId}:${toId}:${axis}`;
}

/** 세계가 적어 둔 사이 — 없으면 0 이다 (D3 "적히지 않은 사이는 없는 사이"). */
export function writtenRegard(
  world: WorldState,
  fromId: Id,
  toId: Id,
  axis: RelationAxis,
): number {
  const value = readSlot(world, 'relational', fromId, axisPath(axis, toId));
  return typeof value === 'number' ? value : 0;
}

export interface RegardOptions {
  readonly schema?: StateSchema;
  readonly groundings?: readonly AtomGrounding[];
}

/**
 * 한 주체가 다른 주체에 대해 지닌 사이를 여섯 축으로 센다.
 *
 * **지목이 그 상대를 가리키는 기억만** 재료가 된다 — 무언가 있었다는 것만 아는 기억은
 * 누구도 밀지 못한다.
 */
export function regardOf(
  memories: readonly Memory[],
  world: WorldState,
  fromId: Id,
  toId: Id,
  options: RegardOptions = {},
): readonly Relationship[] {
  const groundings = options.groundings ?? ATOM_GROUNDINGS;
  const mine = stableSort(
    memories.filter(
      (memory) => memory.holderId === fromId && memory.attribution?.subjectId === toId,
    ),
    (left, right) => compareStrings(`${left.atTick}/${left.id}`, `${right.atTick}/${right.id}`),
  );

  return RELATION_AXES.map((axis) => {
    const traces = mine
      .map((memory) => ({
        memoryId: memory.id,
        ground: memory.ground,
        push: memoryPush(memory, axis, groundings),
        line: memoryLine(memory),
      }))
      .filter((trace) => trace.push !== 0);
    const carried = traces.reduce((sum, trace) => sum + trace.push, 0);
    const written = writtenRegard(world, fromId, toId, axis);
    const range = axisRange(axis, options.schema ?? STATE_SCHEMA);
    const value = Math.min(range.max, Math.max(range.min, written + carried));
    return {
      kind: 'Claim' as const,
      id: relationshipIdOf(fromId, toId, axis),
      holderId: fromId,
      aboutId: toId,
      assertion: `${axisLabel(axis)} ${value.toFixed(2)} (적힌 것 ${written.toFixed(2)})`,
      confidence: traces.length === 0 ? 0 : Math.min(1, Math.abs(carried)),
      sourceIds: traces.map((trace) => trace.memoryId),
      fromId,
      toId,
      axis,
      written,
      carried,
      value,
      drift: value - written,
      traces,
    };
  });
}

/** 여럿이 여럿에 대해 지닌 사이 전부 — 관계망의 재료다. */
export interface RegardLedger {
  readonly relationships: readonly Relationship[];
  /** 갈린 것만 (적힌 것과 다른 것) — 관계망에서 굵게 서는 선들 */
  readonly drifted: readonly Relationship[];
  /** 아무 기억도 밀지 못한 짝 (사실이지 위반이 아니다) */
  readonly untouched: readonly (readonly [Id, Id])[];
}

/** 주체들 사이의 사이를 전부 센다 — 자기 자신은 세지 않는다. */
export function regardLedger(
  memories: readonly Memory[],
  world: WorldState,
  subjectIds: readonly Id[],
  options: RegardOptions = {},
): RegardLedger {
  const relationships: Relationship[] = [];
  const untouched: (readonly [Id, Id])[] = [];
  for (const fromId of subjectIds) {
    for (const toId of subjectIds) {
      if (fromId === toId) continue;
      const pairs = regardOf(memories, world, fromId, toId, options);
      const moved = pairs.filter((entry) => entry.carried !== 0);
      if (moved.length === 0) {
        untouched.push([fromId, toId]);
        continue;
      }
      relationships.push(...moved);
    }
  }
  return {
    relationships,
    drifted: relationships.filter((entry) => Math.abs(entry.drift) > 1e-9),
    untouched,
  };
}

/** 사이 하나를 검사한다 — 다시 세면 같은 값이어야 하고, 지목 없는 기억은 밀 수 없다. */
export function checkRegard(
  relationship: Relationship,
  memories: readonly Memory[],
  out: MemoryViolation[],
  options: RegardOptions = {},
): void {
  const where = `$.relationships[${relationship.id}]`;
  if (!RELATION_AXES.includes(relationship.axis)) {
    violateMemory(
      out,
      relationship.fromId,
      'unknown-axis',
      `${where}.axis`,
      `O2 relational 이 적어 두지 않은 축이다 — ${String(relationship.axis)}`,
    );
    return;
  }
  if (relationship.fromId === relationship.toId) {
    violateMemory(
      out,
      relationship.fromId,
      'self-regard',
      `${where}.toId`,
      '자기 자신에 대한 사이는 서지 않는다',
    );
  }

  const groundings = options.groundings ?? ATOM_GROUNDINGS;
  const byId = new Map(memories.map((memory) => [memory.id, memory]));
  for (const trace of relationship.traces) {
    const memory = byId.get(trace.memoryId);
    if (memory === undefined) continue;
    if (memory.attribution === null) {
      violateMemory(
        out,
        relationship.fromId,
        'unattributed-regard',
        `${where}.traces`,
        '지목 없는 기억이 사이를 밀었다 — 누구인지 모르면 아무도 밀지 못한다',
      );
      continue;
    }
    const expected = memoryPush(memory, relationship.axis, groundings);
    if (Math.abs(expected - trace.push) > 1e-9) {
      violateMemory(
        out,
        relationship.fromId,
        'regard-drift',
        `${where}.traces`,
        `기억에서 다시 세면 ${expected.toFixed(3)} 인데 ${trace.push.toFixed(3)} 이 적혀 있다`,
      );
    }
  }

  const carried = relationship.traces.reduce((sum, trace) => sum + trace.push, 0);
  if (Math.abs(carried - relationship.carried) > 1e-9) {
    violateMemory(
      out,
      relationship.fromId,
      'regard-drift',
      `${where}.carried`,
      `자국들을 더하면 ${carried.toFixed(3)} 인데 ${relationship.carried.toFixed(3)} 이 적혀 있다`,
    );
  }

  const range = axisRange(relationship.axis, options.schema ?? STATE_SCHEMA);
  if (relationship.value < range.min - 1e-9 || relationship.value > range.max + 1e-9) {
    violateMemory(
      out,
      relationship.fromId,
      'regard-out-of-range',
      `${where}.value`,
      `세계가 적어 둔 폭(${String(range.min)}~${String(range.max)}) 밖이다 — ${relationship.value.toFixed(3)}`,
    );
  }
}

/** 사람이 읽는 한 줄 — 어느 원자가 어느 축을 어느 쪽으로 미는가 (Lab 표의 재료). */
export interface PushRow {
  readonly atom: ActionAtom;
  readonly label: string;
  readonly pushes: Readonly<Record<RelationAxis, number>>;
  readonly touches: number;
}

/** 원자 열여섯이 사이 여섯 축을 어떻게 미는가 — **전부 P0-b 에서 읽어 온 표다.** */
export function pushTable(
  atoms: readonly ActionAtom[],
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
): readonly PushRow[] {
  return atoms.map((atom) => {
    const pushes = Object.fromEntries(
      RELATION_AXES.map((axis) => [axis, axisPush(atom, axis, groundings)]),
    ) as Record<RelationAxis, number>;
    return {
      atom,
      label: atomLabel(atom),
      pushes,
      touches: RELATION_AXES.filter((axis) => pushes[axis] !== 0).length,
    };
  });
}
