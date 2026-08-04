// R5-c 기억장과 감사 — 여럿의 기억을 담고, 위반과 사실을 가른다.
//
// R2-c 현상장 · R3-c 지각장 · R4-c 믿음 그래프 · D5-c 충돌장과 **같은 모양**이다: 담고, 지우지
// 않고, 감사가 무엇이 어긋났고 무엇이 그냥 사실인지를 가른다.
//
// 여기서도 **사실 쪽이 이 계층의 절반**이다.
//
//   **지목 없는 기억**            대부분이 그렇다. 밖에서 본 자는 누가 했는지 모른다 — 위반이 아니라
//                                 R4 가 남긴 자리 그대로다. 이것을 위반으로 세면 모든 목격자가
//                                 곧바로 범인을 아는 세계가 되고 소문이 설 자리가 없다.
//   **틀린 지목**                 들은 지목이 실제와 다를 수 있다. 막으면 R5 는 전언이 아니라
//                                 한 입 늦은 전지가 되고, R4 가 빗나간 믿음을 허용한 이유가 사라진다.
//   **아무도 듣지 못한 말**       세계는 아무도 안 들을 때도 말해진다 (R3-c "아무도 못 본 흔적" 의 짝).
//   **아무도 말하지 않은 기억**   품고만 있는 기억이 대부분이다.
//
// 막는 것은 **근거의 자리**뿐이다: 근거 없이 선 기억 · 아직 서 있는 자국의 기억 · 짐작에서 나온
// 지목 · 손으로 고친 확신 · 듣지 않은 말에서 선 기억 · 거쳐서 진해지거나 넓어진 말.

import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import { orderMemories, checkMemory, type Memory } from './memory.ts';
import { checkHearsay, type RumorField, type Telling } from './rumor.ts';
import { checkRegard, type RegardLedger } from './regard.ts';
import { type MemoryViolation } from './violation.ts';

/** 누가 무엇을 기억하는가. */
export interface MemoryLedger {
  readonly memories: readonly Memory[];
  /** 주체 id → 그가 지닌 기억들 */
  readonly bySubject: ReadonlyMap<Id, readonly Memory[]>;
  /** 뿌리 id → 그것을 기억하는 주체들 */
  readonly byRoot: ReadonlyMap<Id, readonly Id[]>;
}

export function openMemoryLedger(): MemoryLedger {
  return { memories: [], bySubject: new Map(), byRoot: new Map() };
}

function indexOf(memories: readonly Memory[]): MemoryLedger {
  const bySubject = new Map<Id, Memory[]>();
  const byRoot = new Map<Id, Id[]>();
  for (const memory of memories) {
    bySubject.set(memory.holderId, [...(bySubject.get(memory.holderId) ?? []), memory]);
    const holders = byRoot.get(memory.aboutId) ?? [];
    if (!holders.includes(memory.holderId)) byRoot.set(memory.aboutId, [...holders, memory.holderId]);
    else byRoot.set(memory.aboutId, holders);
  }
  return { memories, bySubject, byRoot };
}

/**
 * 기억들을 장부에 담는다 — **같은 id 는 늘어나지 않고 갈아 끼워진다.**
 *
 * 기억의 id 는 지닌 자와 뿌리에서 나오므로(R5-a `memoryIdOf`), 같은 일에 대한 두 번째 기억은
 * 새 기억이 아니다. 겪은 일을 나중에 남에게서 다시 들어도 기억이 둘이 되지는 않는다.
 */
export function recordMemories(ledger: MemoryLedger, memories: readonly Memory[]): MemoryLedger {
  if (memories.length === 0) return ledger;
  const merged = new Map(ledger.memories.map((memory) => [memory.id, memory]));
  let changed = false;
  for (const memory of memories) {
    if (merged.get(memory.id) === memory) continue;
    merged.set(memory.id, memory);
    changed = true;
  }
  if (!changed) return ledger;
  return indexOf(orderMemories([...merged.values()]));
}

/** 그 주체가 지닌 기억들. */
export function memoriesFor(ledger: MemoryLedger, subjectId: Id): readonly Memory[] {
  return ledger.bySubject.get(subjectId) ?? [];
}

/** 그 일을 기억하는 주체들. */
export function rememberersOf(ledger: MemoryLedger, rootId: Id): readonly Id[] {
  return ledger.byRoot.get(rootId) ?? [];
}

/** 지목 없는 기억들 — **위반이 아니라 사실이다.** 대부분이 그렇다. */
export function unattributed(ledger: MemoryLedger): readonly Memory[] {
  return ledger.memories.filter((memory) => memory.attribution === null);
}

/** 아무도 듣지 못한 말들 — **위반이 아니라 사실이다** (R3-c "아무도 못 본 흔적" 의 짝). */
export function unheard(field: RumorField, heardPhenomenonIds: readonly Id[]): readonly Telling[] {
  const heard = new Set(heardPhenomenonIds);
  return field.tellings.filter((telling) => !heard.has(telling.phenomenonId));
}

/** 아무도 말하지 않은 기억들 — 품고만 있는 것이 대부분이다. */
export function unspoken(ledger: MemoryLedger, field: RumorField): readonly Memory[] {
  const spoken = new Set(field.tellings.map((telling) => telling.memoryId));
  return ledger.memories.filter((memory) => !spoken.has(memory.id));
}

/** 들은 지목이 실제와 어긋난 기억 하나 — **감사만 본다.** */
export interface BlameCheck {
  readonly memoryId: Id;
  readonly holderId: Id;
  readonly label: string;
  readonly blames: Id;
  readonly actual: Id;
  readonly verdict: 'right' | 'wrong';
  readonly hops: number;
  readonly note: string;
}

/**
 * 지목을 실제와 대조한다 — **검사대에 세우는 것이지 주체가 아는 것이 아니다.**
 *
 * 틀린 지목(`wrong`)은 여기서 세어질 뿐 아무것도 막지 않는다. 막으면 R5 는 전언이 아니라 한 입
 * 늦은 전지가 된다 — R4 가 빗나간 믿음을 허용한 것과 정확히 같은 자리다.
 */
export function compareBlame(
  ledger: MemoryLedger,
  actualActorByRoot: ReadonlyMap<Id, Id>,
  labels: ReadonlyMap<Id, string> = new Map(),
): readonly BlameCheck[] {
  const checks: BlameCheck[] = [];
  for (const memory of ledger.memories) {
    const attribution = memory.attribution;
    if (attribution === null) continue;
    const actual = actualActorByRoot.get(memory.aboutId);
    if (actual === undefined) continue;
    const right = attribution.subjectId === actual;
    checks.push({
      memoryId: memory.id,
      holderId: memory.holderId,
      label: labels.get(memory.holderId) ?? memory.holderId,
      blames: attribution.subjectId,
      actual,
      verdict: right ? 'right' : 'wrong',
      hops: memory.hops,
      note: right
        ? memory.hops === 0
          ? '겪은 자다 — 제 자리가 바뀌었으므로 안다'
          : `입 ${String(memory.hops)} 을 거쳤는데 지목은 맞다 — 지목은 좁혀지지 않기 때문이다`
        : '빗나간 지목이다 — 위반이 아니다. 막으면 R5 는 한 입 늦은 전지가 된다',
    });
  }
  return checks;
}

/** 기억장 감사 — 무엇이 어긋났고 무엇이 그냥 사실인가. */
export interface MemoryAudit {
  readonly recorded: number;
  /** 겪음·봄·들음이 각각 몇인가 */
  readonly byGround: Readonly<Record<Memory['ground'], number>>;
  /** 지목이 붙은 기억 수 */
  readonly attributed: number;
  /** 지목 없는 기억 수 (사실) */
  readonly unattributed: number;
  /** 아무도 듣지 못한 말 (사실) */
  readonly unheard: number;
  /** 아무도 말하지 않은 기억 (사실) */
  readonly unspoken: number;
  /** 가장 멀리 간 말이 몇 입을 거쳤나 */
  readonly maxHops: number;
  readonly violations: readonly MemoryViolation[];
}

export interface AuditSpec {
  readonly ledger: MemoryLedger;
  readonly rumors: RumorField;
  readonly heardPhenomenonIds: readonly Id[];
  readonly tick: Tick;
  readonly regard?: RegardLedger;
}

/** 기억장을 감사한다 — 위반과 사실을 가른다. */
export function auditMemories(spec: AuditSpec): MemoryAudit {
  const { ledger, rumors, heardPhenomenonIds, tick } = spec;
  const violations: MemoryViolation[] = [];
  const tellingByMemory = new Map<Id, Telling>();
  for (const telling of rumors.tellings) tellingByMemory.set(telling.phenomenonId, telling);

  for (const memory of ledger.memories) {
    checkMemory(memory, violations, { tick });
    if (memory.ground !== 'told') continue;
    const telling = rumors.tellings.find((entry) =>
      memory.sourceIds.includes(entry.id),
    );
    if (telling === undefined) {
      violations.push({
        rule: 'unheard-telling',
        subject: memory.holderId,
        path: `$.memories[${memory.id}].sourceIds`,
        message: '들었다는데 소문장에 그 말이 없다',
      });
      continue;
    }
    checkHearsay(memory, telling, violations);
  }

  if (spec.regard !== undefined) {
    for (const relationship of spec.regard.relationships) {
      checkRegard(relationship, ledger.memories, violations);
    }
  }

  const byGround = { lived: 0, seen: 0, told: 0 };
  for (const memory of ledger.memories) byGround[memory.ground] += 1;

  return {
    recorded: ledger.memories.length,
    byGround,
    attributed: ledger.memories.filter((memory) => memory.attribution !== null).length,
    unattributed: unattributed(ledger).length,
    unheard: unheard(rumors, heardPhenomenonIds).length,
    unspoken: unspoken(ledger, rumors).length,
    maxHops: ledger.memories.reduce((max, memory) => Math.max(max, memory.hops), 0),
    violations,
  };
}

/** 감사를 한 줄로 접는다 — 터미널·배지용. */
export function memoryLedgerVerdict(audit: MemoryAudit): string {
  const facts = `기억 ${String(audit.recorded)}(겪음 ${String(audit.byGround.lived)} · 봄 ${String(audit.byGround.seen)} · 들음 ${String(audit.byGround.told)}) · 지목 ${String(audit.attributed)} · 지목 없음 ${String(audit.unattributed)} · 못 들은 말 ${String(audit.unheard)}`;
  if (audit.violations.length === 0) return `기억장이 성립한다 — ${facts}`;
  const rules = [...new Set(audit.violations.map((violation) => violation.rule))];
  return `기억장이 어긋난다 — ${rules.join(', ')} (${facts})`;
}
