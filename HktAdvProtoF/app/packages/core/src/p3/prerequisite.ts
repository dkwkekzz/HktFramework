// P3-a 원자 선행 관계 — "먼저 찾아야 빼앗을 수 있다" 를 손으로 적지 않는다.
//
// O1 은 `Possibility.preconditionIds` 자리를 열어 두었고 P1·P2 는 그 자리를 비운 채 넘겼다.
// 비어 있는 이유는 단순하다 — 원자 사이의 **먼저**를 아무도 계산하지 않았기 때문이다.
// 손으로 표를 적을 수도 있다. 그러면 열여섯 × 열여섯 칸이 누군가의 감각으로 채워지고,
// 원자가 하나 바뀔 때마다 표와 세계가 어긋난다. 그래서 여기서는 표를 적지 않고 **P0 걸림에서
// 계산한다.** 재료는 이미 다 있다 — 각 원자가 무엇을 읽어야 하고(reads·requiresObservation),
// 무엇을 세우며(writes + bearing), 무엇을 치르는지(pays)를 P0-b 가 자리 단위로 못박아 두었다.
//
// 길은 둘뿐이다.
//
//   ① **관측 선행** — 열여섯 중 열다섯은 대상을 먼저 봐야 한다(P0-b). 본다는 것은 결국
//      `informational.knows.{claim}` 자리가 차 있다는 뜻이고, 그 자리를 세우는 원자는
//      계산해 보면 둘뿐이다: 스스로 찾거나(seek) 남이 말해 주거나(persuade). 조사는
//      이미 아는 것의 확신을 올릴 뿐 없던 앎을 세우지 않는다 — 그래서 조사도 관측을 먼저 요구한다.
//   ② **재료 선행** — 치를 것이 없으면 낼 수 없다. 어떤 원자가 치르는 자리는, 그 자리를
//      **채우는**(bearing 'fill') 원자가 먼저 세워야 한다. 깎는 원자(destroy)와 지키는
//      원자(protect)는 세우지 않는다 — 자리를 건드린다고 세우는 것이 아니다.
//
// 요구는 **하나라도 서면 열린다**(any-of). 그래서 선행은 순서가 아니라 물결로 나온다.
// 계산해 보면 첫 물결에 서는 것은 찾다 하나뿐이고, 마지막 물결에 서는 넷은 빼앗다·설득·
// 협박·배신이다 — 넷 다 남과의 사이(`relational.trust`)를 치르는데 그 자리를 세우는 것은
// 주고받기 하나이기 때문이다. **등지는 행동은 쌓인 것이 있어야 치를 수 있다.**
// 우리가 그렇게 적어서가 아니라 P0 걸림이 그렇게 되어 있어서 나온 결과다.
//
// 그리고 아무 원자도 세우지 못하는 자리가 넷 남는다 — 몸·의념·빚·정당성. 넷 다 행동 밖에서
// 온다(회복·성장·약속·남의 인정). 그것은 결함이 아니라 **선언되어야 하는 사실**이고,
// 선언 없이 비면 거부한다 (P0-b 의 `UNFILLABLE_KINDS` 와 같은 태도다).

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import {
  ACTION_ATOMS,
  ATOM_GROUNDINGS,
  atomLabel,
  slotText,
  type ActionAtom,
  type AtomGrounding,
  type SlotRef,
} from '../p0/index.ts';
import { violateExpansion, type PossibilityGraphViolation } from './violation.ts';

/** 선행이 걸리는 길. */
export const PREREQUISITE_ROUTES = [
  'observation', // 관측 선행 — 대상을 먼저 봐야 한다
  'cost', // 재료 선행 — 치를 것을 먼저 가져야 한다
] as const;
export type PrerequisiteRoute = (typeof PREREQUISITE_ROUTES)[number];

/** 길의 한국어 이름 (화면 표기). */
export function routeLabel(route: PrerequisiteRoute): string {
  return route === 'observation' ? '관측 선행' : '재료 선행';
}

/**
 * 관측이 서는 자리. "대상을 봐야 한다" 는 결국 이 자리가 차 있어야 한다는 말이다 —
 * P0-b 가 `requiresObservation` 으로 적은 것의 자리 표현이다.
 */
export const OBSERVATION_SLOT: SlotRef = { domain: 'informational', path: 'knows.{claim}' };

/** 아무 원자도 세우지 못하는 자리 — 선언된 예외. */
export interface UnsourcedSlot {
  readonly slot: SlotRef;
  readonly reason: string;
  /** 누가 이 자리를 세우는가 — 행동이 아니면 무엇인가 */
  readonly owedTo: string;
}

/**
 * 행동으로 세울 수 없는 자리 넷. 넷 다 "치르기만 하고 벌지 못하는" 자리이며,
 * 넷 다 행동 밖에서 온다 — 그것이 이 세계에서 행동이 공짜가 아닌 이유다.
 */
export const UNSOURCED_SLOTS: readonly UnsourcedSlot[] = [
  {
    slot: { domain: 'biological', path: 'vitality' },
    reason:
      '열여섯 중 열둘이 몸으로 치르는데 몸을 세우는 원자는 하나도 없다 — 먹는 것(획득)은 굶주림을 지울 뿐 체력을 만들지 않는다. 모든 길의 값은 결국 몸이 치른다',
    owedTo: 'R 계층 회복 · V1 틱 — 행동이 아니라 시간이 채운다',
  },
  {
    slot: { domain: 'psychic', path: 'energy' },
    reason:
      '벗어나는 셋(적응·대체·탈피)이 의념으로 치르는데 의념을 세우는 원자가 없다 — 능력의 대가를 몸에서 의념으로 옮겨도 그 의념은 어디선가 와야 한다',
    owedTo: 'G 계층 성장 · C 계층 능력 — 숙련이 오를 때 함께 오른다',
  },
  {
    slot: { domain: 'relational', path: 'debt.{subject}' },
    reason:
      '빚은 남이 세워 주는 것이 아니라 약속하는 순간 스스로 진다 — 동맹이 제 손으로 만들어 제가 치르는 유일한 자리다',
    owedTo: 'E2 계약 상태 전이 — 약속이 굴러가면서 갚히거나 부러진다',
  },
  {
    slot: { domain: 'transcendent', path: 'legitimacy' },
    reason:
      '정당성은 제 손으로 세우지 못한다 — 배신이 그것을 치르지만 아무 행동도 그것을 벌지 않는다. 남이 인정해야만 선다',
    owedTo: 'W 계층 제도 · C 계층 신앙 — 세계가 준다',
  },
];

/** 원자 하나에 걸린 선행 요구 하나. */
export interface AtomPrerequisite {
  readonly atom: ActionAtom;
  readonly route: PrerequisiteRoute;
  /** 무엇 때문에 먼저가 필요한가 — 관측이면 앎의 자리, 재료면 치를 자리 */
  readonly slot: SlotRef;
  /** 이 중 **하나라도** 먼저 서면 요구가 풀린다. 자기 자신은 세지 않는다 */
  readonly satisfiedBy: readonly ActionAtom[];
  /** 세우는 원자가 없고 예외로 선언됐다 — 행동 밖에서 오는 자리다 */
  readonly waived: boolean;
  readonly note: string;
}

/** 선행 관계 검사 결과. */
export interface PrerequisiteReport {
  readonly prerequisites: readonly AtomPrerequisite[];
  /** 아무 선행도 남지 않은 원자 — 첫 걸음이 되는 것들 */
  readonly roots: readonly ActionAtom[];
  /** 몇 번째 물결에 서는가 — 물결 0 이 뿌리다 */
  readonly waves: readonly (readonly ActionAtom[])[];
  readonly waveOf: Readonly<Record<string, number>>;
  /** 뿌리에서 닿지 않는 원자 */
  readonly unreachable: readonly ActionAtom[];
  /** 예외로 선언되어 요구에서 빠진 자리 */
  readonly waivedSlots: readonly string[];
  readonly violations: readonly PossibilityGraphViolation[];
  readonly complete: boolean;
}

function sameSlot(a: SlotRef, b: SlotRef): boolean {
  return a.domain === b.domain && a.path === b.path;
}

/**
 * 그 자리를 **세우는** 원자들 — 채우는 원자(bearing 'fill')가 그 자리를 쓸 때만 센다.
 * 깎는 원자(clear)와 지키는 원자(guard)는 자리를 건드리지만 세우지 않는다.
 */
export function slotFillers(
  ref: SlotRef,
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
): readonly ActionAtom[] {
  return groundings
    .filter((entry) => entry.bearing === 'fill' && entry.writes.some((write) => sameSlot(write, ref)))
    .map((entry) => entry.atom);
}

/** 자리 하나의 요구를 만든다 — 자기 자신은 자기를 세워 주지 못한다. */
function requirementFor(
  grounding: AtomGrounding,
  route: PrerequisiteRoute,
  ref: SlotRef,
  groundings: readonly AtomGrounding[],
  declared: ReadonlyMap<string, UnsourcedSlot>,
): AtomPrerequisite {
  const fillers = slotFillers(ref, groundings);
  const satisfiedBy = fillers.filter((atom) => atom !== grounding.atom);
  const exception = declared.get(slotText(ref));
  const waived = satisfiedBy.length === 0 && exception !== undefined;
  const note =
    satisfiedBy.length > 0
      ? route === 'observation'
        ? `${atomLabel(grounding.atom)} 는 대상을 먼저 봐야 한다 — 앎을 세우는 것은 ${satisfiedBy.map(atomLabel).join('·')}`
        : `${atomLabel(grounding.atom)} 는 ${slotText(ref)} 를 치른다 — 그 자리를 세우는 것은 ${satisfiedBy.map(atomLabel).join('·')}`
      : (exception?.reason ?? `${slotText(ref)} 를 세우는 원자가 없다`);
  return { atom: grounding.atom, route, slot: ref, satisfiedBy, waived, note };
}

/** 원자 하나에 걸린 선행 요구 전부. */
export function prerequisitesOf(
  atom: ActionAtom,
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
  exceptions: readonly UnsourcedSlot[] = UNSOURCED_SLOTS,
): readonly AtomPrerequisite[] {
  const grounding = groundings.find((entry) => entry.atom === atom);
  if (grounding === undefined) return [];
  const declared = new Map(exceptions.map((entry) => [slotText(entry.slot), entry]));
  const out: AtomPrerequisite[] = [];

  // ① 관측 선행 — 보지 않고 되는 원자는 여기서 빠진다.
  if (grounding.requiresObservation) {
    out.push(requirementFor(grounding, 'observation', OBSERVATION_SLOT, groundings, declared));
  }

  // ② 재료 선행 — 치르는 자리마다 하나씩. 같은 자리를 두 번 적었으면 한 번만 센다.
  const seen = new Set<string>();
  for (const ref of grounding.pays) {
    const key = slotText(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(requirementFor(grounding, 'cost', ref, groundings, declared));
  }
  return out;
}

/** 선행 관계를 계산하고 검사한다. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function checkPrerequisites(
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
  exceptions: readonly UnsourcedSlot[] = UNSOURCED_SLOTS,
): PrerequisiteReport {
  const violations: PossibilityGraphViolation[] = [];
  const declared = new Map(exceptions.map((entry) => [slotText(entry.slot), entry]));
  const atoms = groundings.map((entry) => entry.atom);

  const byAtom = new Map<ActionAtom, readonly AtomPrerequisite[]>();
  const prerequisites: AtomPrerequisite[] = [];
  for (const atom of atoms) {
    const list = prerequisitesOf(atom, groundings, exceptions);
    byAtom.set(atom, list);
    prerequisites.push(...list);
  }

  // 세울 수 없는 자리 — 선언되지 않았으면 거부한다.
  const sourcedSlots = new Set<string>();
  for (const [index, requirement] of prerequisites.entries()) {
    const key = slotText(requirement.slot);
    const at = `$.prerequisites[${String(index)}].satisfiedBy`;
    if (requirement.satisfiedBy.length > 0) {
      sourcedSlots.add(key);
      continue;
    }
    if (declared.has(key)) continue;
    const fillers = slotFillers(requirement.slot, groundings);
    if (fillers.length === 0) {
      violateExpansion(
        violations,
        requirement.atom,
        'unsourced-cost',
        at,
        `${atomLabel(requirement.atom)} 가 ${key} 를 ${requirement.route === 'observation' ? '읽어야 하는데' : '치르는데'} 그 자리를 세우는 원자가 하나도 없다 — 정말 행동 밖에서 온다면 예외로 선언하고 누가 세우는지를 적어라`,
      );
      continue;
    }
    violateExpansion(
      violations,
      requirement.atom,
      'self-only-source',
      at,
      `${key} 를 세우는 것이 ${atomLabel(requirement.atom)} 자신뿐이다 — 스스로를 딛고 설 수는 없다`,
    );
  }

  // 낡은 예외 — 세울 수 없다고 적어 놓고 실제로는 세우는 원자가 있다.
  for (const [index, exception] of exceptions.entries()) {
    const key = slotText(exception.slot);
    if (!sourcedSlots.has(key)) continue;
    violateExpansion(
      violations,
      '',
      'stale-cost-exception',
      `$.exceptions[${String(index)}]`,
      `${key} 를 세울 수 없다고 적어 놓고 ${slotFillers(exception.slot, groundings).join(', ')} 가 세운다 — 예외가 낡았다`,
    );
  }

  // 물결 — 요구는 any-of 이므로 순서가 아니라 물결로 선다.
  const waves: ActionAtom[][] = [];
  const waveOf: Record<string, number> = {};
  const placed = new Set<ActionAtom>();
  const remaining = new Set<ActionAtom>(atoms);
  while (remaining.size > 0) {
    const wave = atoms.filter(
      (atom) =>
        remaining.has(atom) &&
        (byAtom.get(atom) ?? []).every(
          (requirement) =>
            requirement.waived ||
            requirement.satisfiedBy.some((source) => placed.has(source)),
        ),
    );
    if (wave.length === 0) break;
    for (const atom of wave) {
      placed.add(atom);
      remaining.delete(atom);
      waveOf[atom] = waves.length;
    }
    waves.push(wave);
  }

  const roots = waves[0] ?? [];
  if (roots.length === 0) {
    violateExpansion(
      violations,
      '',
      'rootless-atoms',
      '$.roots',
      '아무 원자도 첫 걸음이 되지 못한다 — 전부가 다른 무엇을 먼저 요구하면 세계는 시작하지 못한다',
    );
  }

  const unreachable = atoms.filter((atom) => remaining.has(atom));
  for (const atom of unreachable) {
    const blocking = (byAtom.get(atom) ?? []).filter(
      (requirement) =>
        !requirement.waived && !requirement.satisfiedBy.some((source) => placed.has(source)),
    );
    violateExpansion(
      violations,
      atom,
      'unreachable-atom',
      '$.waves',
      `${atomLabel(atom)} 가 뿌리에서 닿지 않는다 — ${blocking
        .map((requirement) => `${routeLabel(requirement.route)}(${slotText(requirement.slot)})`)
        .join(' · ')} 가 끝내 서지 않는다`,
    );
  }

  const waivedSlots = stableSort(
    [...new Set(prerequisites.filter((entry) => entry.waived).map((entry) => slotText(entry.slot)))],
    compareStrings,
  );

  return {
    prerequisites,
    roots,
    waves,
    waveOf,
    unreachable,
    waivedSlots,
    violations,
    complete: prerequisites.length > 0 && violations.length === 0,
  };
}

/** 그 원자보다 먼저 서야 하는 원자들 — 요구마다 하나씩 고르면 되는 후보 전부. */
export function sourcesBefore(
  atom: ActionAtom,
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
  exceptions: readonly UnsourcedSlot[] = UNSOURCED_SLOTS,
): readonly ActionAtom[] {
  const sources = new Set<ActionAtom>();
  for (const requirement of prerequisitesOf(atom, groundings, exceptions)) {
    for (const source of requirement.satisfiedBy) sources.add(source);
  }
  return ACTION_ATOMS.filter((candidate) => sources.has(candidate));
}

/** 선행 관계를 한 줄 판정으로 접는다 — 터미널·배지용. */
export function prerequisiteVerdict(report: PrerequisiteReport): string {
  if (report.complete) {
    return `뿌리 ${report.roots.join(', ')} 에서 물결 ${String(report.waves.length)}개로 열여섯이 전부 선다 (행동 밖에서 오는 자리 ${String(report.waivedSlots.length)} — 전부 선언된 예외)`;
  }
  const rules = [...new Set(report.violations.map((violation) => violation.rule))];
  return `선행 관계가 막혔다 — ${rules.join(', ')}`;
}

/** 화면·터미널이 함께 쓰는 요약 줄. */
export function prerequisiteSummary(report: PrerequisiteReport): readonly string[] {
  return [
    `뿌리: ${report.roots.length === 0 ? '(없다)' : report.roots.map(atomLabel).join(' · ')}`,
    ...report.waves.map(
      (wave, index) => `물결 ${String(index)}: ${wave.map(atomLabel).join(' · ')}`,
    ),
    `닿지 않는 원자: ${report.unreachable.length === 0 ? '(없다)' : report.unreachable.map(atomLabel).join(' · ')}`,
    `행동 밖에서 오는 자리: ${report.waivedSlots.join(' · ')}`,
  ];
}
