// P2-c 문법 적용과 원문 대조 — 갈래가 한 번 더 좁아지고, 원문의 다섯 줄이 계산되어 나온다.
//
// 두 가지 일을 한다.
//
// ① **좁히기.** P1 이 세운 갈래는 아직 누가 서 있는지를 모른다 — 자원이 비면 누구에게나 여섯이
//    열렸다. 문법을 씌우면 방향마다의 원자가 걸러지고, 남는 원자가 없는 방향은 닫힌다.
//    문법은 **닫기만 한다** — P1 이 닫은 것을 다시 열지 못하고, 없던 원자를 만들지도 못한다.
//    그것을 검사기가 본다(`widened-branch`): 좁히기가 넓히면 그것은 좁히기가 아니다.
//
// ② **원문 대조.** 원문 P2 는 다섯 유형의 행동을 예시로 들었다:
//
//      사냥꾼 추적·사냥·해체 / 상인 구매·운송·독점 / 국가 징수·통제·법제화 /
//      마물 이동·섭식·영역 침범 / 신 의례 요구·금기 부여·영역 변형
//
//    이 열다섯 이름은 P0-a 가 이미 원자로 환원해 두었다. 그러니 물어볼 수 있다 —
//    **그 원자들이 그 유형의 문법 안에 있는가?** 있으면 원문의 다섯 줄은 우리가 지은 격자에서
//    도출된 것이고, 없으면 격자가 틀렸거나 예시가 틀렸다. 어느 쪽이든 값으로 드러나야 한다.

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { SubjectKind } from '../o1/being.ts';
import { atomLabel, atomResolutionOf, type ActionAtom } from '../p0/index.ts';
import {
  directionLabel,
  type StrategyBranch,
  type StrategyDirection,
  type StrategyOption,
  type StrategyTree,
} from '../p1/index.ts';
import { atomsFor } from './access.ts';
import { allows, entryOf, type PossibilityGrammar } from './grammar.ts';
import { violateGrammar, type GrammarViolation } from './violation.ts';

/** 문법을 씌운 갈래 하나. */
export interface NarrowedOption {
  readonly direction: StrategyDirection;
  /** P1 이 열었는가 */
  readonly openBefore: boolean;
  /** 문법을 씌우고도 열려 있는가 */
  readonly open: boolean;
  /** 남은 원자 */
  readonly atoms: readonly ActionAtom[];
  /** 문법이 걷어 낸 원자 */
  readonly removed: readonly ActionAtom[];
  /** 왜 닫혔는가 — P1 사유이거나 문법 사유다 */
  readonly closedBy: string | null;
}

/** 문법을 씌운 결핍 하나. */
export interface NarrowedBranch {
  readonly nodeId: string;
  readonly label: string;
  readonly kind: string;
  readonly pressure: number;
  readonly level: string;
  readonly options: readonly NarrowedOption[];
  readonly open: readonly StrategyDirection[];
  /** 문법 때문에 닫힌 방향 */
  readonly closedByGrammar: readonly StrategyDirection[];
}

/** 문법을 씌운 트리. */
export interface NarrowedTree {
  readonly subjectId: string;
  readonly tick: number;
  readonly branches: readonly NarrowedBranch[];
  /** P1 이 연 갈래 수 → 문법이 남긴 갈래 수 */
  readonly openBefore: number;
  readonly openAfter: number;
  readonly violations: readonly GrammarViolation[];
}

/** 갈래에 문법을 씌운다 — 닫기만 하고 열지 않는다. */
export function narrowTree(
  tree: StrategyTree,
  grammar: PossibilityGrammar,
): NarrowedTree {
  const violations: GrammarViolation[] = [];
  let openBefore = 0;
  let openAfter = 0;

  const branches = tree.branches.map((branch, index) =>
    narrowBranch(branch, grammar, `$.branches[${String(index)}]`, violations),
  );
  for (const branch of tree.branches) openBefore += branch.open.length;
  for (const branch of branches) openAfter += branch.open.length;

  if (openAfter > openBefore) {
    violateGrammar(
      violations,
      grammar.speciesId,
      'widened-branch',
      '$.branches',
      `좁히기가 갈래를 ${String(openBefore)} → ${String(openAfter)} 로 넓혔다 — 문법은 닫기만 한다`,
    );
  }

  return {
    subjectId: tree.subjectId,
    tick: tree.tick,
    branches,
    openBefore,
    openAfter,
    violations,
  };
}

function narrowBranch(
  branch: StrategyBranch,
  grammar: PossibilityGrammar,
  path: string,
  violations: GrammarViolation[],
): NarrowedBranch {
  const options = branch.options.map((option) => narrowOption(option, grammar));
  for (const [index, option] of options.entries()) {
    if (!option.openBefore && option.open) {
      violateGrammar(
        violations,
        grammar.speciesId,
        'widened-branch',
        `${path}.options[${String(index)}]`,
        `${directionLabel(option.direction)} 은 P1 이 닫았는데 문법이 다시 열었다`,
      );
    }
  }
  return {
    nodeId: branch.nodeId,
    label: branch.label,
    kind: branch.kind,
    pressure: branch.pressure,
    level: branch.level,
    options,
    open: options.filter((option) => option.open).map((option) => option.direction),
    closedByGrammar: options
      .filter((option) => option.openBefore && !option.open)
      .map((option) => option.direction),
  };
}

function narrowOption(option: StrategyOption, grammar: PossibilityGrammar): NarrowedOption {
  if (!option.open) {
    return {
      direction: option.direction,
      openBefore: false,
      open: false,
      atoms: [],
      removed: [],
      closedBy: option.blockedBy,
    };
  }
  const kept = option.atoms.filter((atom) => allows(grammar, atom));
  const removed = option.atoms.filter((atom) => !allows(grammar, atom));
  if (kept.length > 0) {
    return {
      direction: option.direction,
      openBefore: true,
      open: true,
      atoms: kept,
      removed,
      closedBy: null,
    };
  }
  // 남은 원자가 없다 — 무엇이 지웠는지(유형인가 금기인가)를 말한다.
  const first = removed[0];
  const entry = first === undefined ? null : entryOf(grammar, first);
  return {
    direction: option.direction,
    openBefore: true,
    open: false,
    atoms: [],
    removed,
    closedBy:
      entry === null
        ? 'grammar'
        : entry.closedBy === 'taboo'
          ? 'taboo'
          : 'kind',
  };
}

/** 원문 P2 가 유형별로 든 예시 한 줄. */
export interface ExampleLine {
  readonly subjectKind: SubjectKind;
  /** 원문이 쓴 이름 (`추적`) — P0 환원표의 열쇠다 */
  readonly names: readonly string[];
  readonly source: string;
}

/** ModulePlan P2 의 다섯 줄 — 우리가 지은 격자에서 도출되어야 한다. */
export const EXAMPLE_LINES: readonly ExampleLine[] = [
  { subjectKind: 'person', names: ['추적', '사냥', '해체'], source: 'ModulePlan P2 사냥꾼' },
  { subjectKind: 'organization', names: ['구매', '운송', '독점'], source: 'ModulePlan P2 상인' },
  { subjectKind: 'nation', names: ['징수', '통제', '법제화'], source: 'ModulePlan P2 국가' },
  { subjectKind: 'creature', names: ['이동', '섭식', '영역 침범'], source: 'ModulePlan P2 마물' },
  { subjectKind: 'god', names: ['의례 요구', '금기 부여', '영역 변형'], source: 'ModulePlan P2 신' },
];

/** 예시 한 줄의 도달 여부. */
export interface ExampleCheck {
  readonly subjectKind: SubjectKind;
  readonly name: string;
  /** P0 환원표가 준 원자들 */
  readonly atoms: readonly ActionAtom[];
  /** 그 유형이 낼 수 없는 원자 */
  readonly missing: readonly ActionAtom[];
  readonly reachable: boolean;
}

/** 원문 대조 결과. */
export interface ExampleReport {
  readonly checks: readonly ExampleCheck[];
  readonly unreachable: readonly string[];
  /** 유형이 낼 수 있는데 원문이 예로 들지 않은 원자 */
  readonly unusedByOriginal: Readonly<Record<string, readonly ActionAtom[]>>;
  readonly violations: readonly GrammarViolation[];
  readonly complete: boolean;
}

/**
 * 원문 다섯 줄이 격자에서 도출되는가.
 * 여기서 쓰는 문법은 **유형 격자만**이다 — 문화·금기는 세계마다 다르지만 유형은 세계 밖의 사실이고,
 * 원문이 든 예시도 "사냥꾼은" 이 아니라 "사람 유형은" 의 이야기이기 때문이다.
 */
export function checkExamples(
  lines: readonly ExampleLine[] = EXAMPLE_LINES,
): ExampleReport {
  const violations: GrammarViolation[] = [];
  const checks: ExampleCheck[] = [];
  const unreachable: string[] = [];
  const used = new Map<SubjectKind, Set<ActionAtom>>();

  for (const [lineIndex, line] of lines.entries()) {
    const allowed = atomsFor(line.subjectKind);
    const seen = used.get(line.subjectKind) ?? new Set<ActionAtom>();
    for (const [nameIndex, name] of line.names.entries()) {
      const at = `$.examples[${String(lineIndex)}].names[${String(nameIndex)}]`;
      const resolution = atomResolutionOf(name);
      if (resolution === null) {
        violateGrammar(
          violations,
          line.subjectKind,
          'unresolved-example',
          at,
          `원문이 든 ${JSON.stringify(name)} 가 P0 환원표에 없다 — 원자로 환원되지 않은 이름은 대조할 수 없다`,
        );
        checks.push({
          subjectKind: line.subjectKind,
          name,
          atoms: [],
          missing: [],
          reachable: false,
        });
        unreachable.push(`${line.subjectKind}/${name}`);
        continue;
      }
      const atoms = resolution.atoms;
      const missing = atoms.filter((atom) => !allowed.includes(atom));
      for (const atom of atoms) seen.add(atom);
      if (missing.length > 0) {
        unreachable.push(`${line.subjectKind}/${name}`);
        violateGrammar(
          violations,
          line.subjectKind,
          'unreachable-example',
          at,
          `원문은 ${JSON.stringify(name)} 를 이 유형의 행동으로 들었는데 ${missing.map(atomLabel).join('·')} 를 낼 수 없다 — 격자가 틀렸거나 예시가 틀렸다`,
        );
      }
      checks.push({
        subjectKind: line.subjectKind,
        name,
        atoms,
        missing,
        reachable: missing.length === 0,
      });
    }
    used.set(line.subjectKind, seen);
  }

  const unusedByOriginal: Record<string, readonly ActionAtom[]> = {};
  for (const line of lines) {
    const seen = used.get(line.subjectKind) ?? new Set<ActionAtom>();
    unusedByOriginal[line.subjectKind] = atomsFor(line.subjectKind).filter(
      (atom) => !seen.has(atom),
    );
  }

  return {
    checks,
    unreachable: stableSort(unreachable, compareStrings),
    unusedByOriginal,
    violations,
    complete: violations.length === 0,
  };
}

/** 대조를 한 줄 판정으로 접는다. */
export function exampleVerdict(report: ExampleReport): string {
  if (report.complete) {
    const total = report.checks.length;
    return `원문 다섯 줄 ${String(total)}개 행동이 전부 유형 격자에서 도출된다`;
  }
  return `원문 예시가 도달되지 않는다 — ${report.unreachable.join(', ')}`;
}

/** 좁히기를 한 줄 판정으로 접는다. */
export function narrowVerdict(narrowed: NarrowedTree): string {
  if (narrowed.violations.length > 0) {
    const rules = [...new Set(narrowed.violations.map((violation) => violation.rule))];
    return `좁히기가 막혔다 — ${rules.join(', ')}`;
  }
  const closed = narrowed.branches.flatMap((branch) => branch.closedByGrammar);
  return `갈래 ${String(narrowed.openBefore)} → ${String(narrowed.openAfter)}${
    closed.length === 0 ? ' (문법이 닫은 것 없음)' : ` · 문법이 닫은 방향 ${closed.map(directionLabel).join(' · ')}`
  }`;
}
