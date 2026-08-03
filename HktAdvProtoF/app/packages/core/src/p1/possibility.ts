// P1-c 갈래를 세계 원소로 — 열린 갈래는 O1 `Possibility` 로 서야 한다.
//
// WORKFLOW ③(눈 검증)의 규정: 모듈이 정의하는 모든 개념은 **최소 세계 상태 원소**로 환원되고
// 12타입 중 하나로 분류되어야 한다. 함수·클로저·암묵 상태로만 존재하는 개념은 금지다.
//
// P1 의 개념은 갈래(StrategyOption)이고, O1 은 그것이 설 자리를 이미 비워 두었다:
//
//   Possibility { subjectId, forDependencyId, direction, atoms, preconditionIds }
//
// 그래서 P1 은 새 타입을 만들지 않는다. 열린 갈래를 그 모양으로 접고 O1 관문에 그대로 넣는다 —
// 원자 없는 갈래는 O1 이 "가능성이 아니라 바람이다" 로 거부하고, 그것이 곧 P1-b 의
// `open-without-atom` 과 같은 말이다. 두 관문이 같은 것을 막으므로 어느 한쪽이 뚫려도 드러난다.
//
// 막힌 갈래는 원소가 되지 않는다. 그것이 옳다 — 막힌 길은 세계에 존재하지 않는 길이고,
// 다만 **왜 없는지**가 화면과 보고에 남는다.

import { deterministicId, type Id } from '../v1/id.ts';
import { classify, type Possibility } from '../o1/index.ts';
import type { StrategyOption } from './opening.ts';
import type { StrategyBranch, StrategyTree } from './tree.ts';

/** 갈래 하나의 ID — 같은 주체·같은 결핍·같은 방향이면 항상 같다 (V1 결정적 ID). */
export function possibilityIdOf(
  subjectId: Id,
  nodeId: Id,
  direction: string,
): Id {
  return deterministicId('possibility', subjectId, nodeId, direction);
}

/** 열린 갈래 하나를 O1 원소로 접는다. */
export function possibilityOf(
  subjectId: Id,
  branch: StrategyBranch,
  option: StrategyOption,
): Possibility {
  return {
    kind: 'Possibility',
    id: possibilityIdOf(subjectId, branch.nodeId, option.direction),
    subjectId,
    forDependencyId: branch.nodeId,
    direction: option.direction,
    atoms: [...option.atoms],
    // 선행 조건은 아직 비어 있다 — 무엇이 먼저 서야 하는지는 P3(지연 확장)이 채운다.
    preconditionIds: [],
  };
}

/** 트리 전체에서 열린 갈래들을 원소로 뽑는다. */
export function possibilitiesOf(tree: StrategyTree): readonly Possibility[] {
  return tree.branches.flatMap((branch) =>
    branch.options
      .filter((option) => option.open)
      .map((option) => possibilityOf(tree.subjectId, branch, option)),
  );
}

/** 원소 하나가 O1 관문을 지나지 못한 자리. */
export interface PossibilityRejection {
  readonly possibilityId: Id;
  readonly nodeLabel: string;
  readonly direction: string;
  readonly rule: string;
  readonly path: string;
  readonly message: string;
}

/** 갈래 원소 검사 결과. */
export interface PossibilityReport {
  readonly possibilities: readonly Possibility[];
  /** 12타입 판정 결과 — 전부 Possibility 여야 한다 */
  readonly kinds: readonly string[];
  readonly rejections: readonly PossibilityRejection[];
  readonly complete: boolean;
}

/** 열린 갈래가 전부 O1 원소로 서는가 — 서지 못하면 그 갈래는 세계에 없는 것이다. */
export function checkPossibilities(tree: StrategyTree): PossibilityReport {
  const possibilities = possibilitiesOf(tree);
  const rejections: PossibilityRejection[] = [];
  const kinds: string[] = [];

  for (const possibility of possibilities) {
    const result = classify(possibility);
    kinds.push(result.kind ?? '(분류 실패)');
    const branch = tree.branches.find((entry) => entry.nodeId === possibility.forDependencyId);
    for (const violation of result.violations) {
      rejections.push({
        possibilityId: possibility.id,
        nodeLabel: branch?.label ?? '',
        direction: possibility.direction,
        rule: violation.rule,
        path: violation.path,
        message: violation.message,
      });
    }
  }

  return {
    possibilities,
    kinds,
    rejections,
    complete: rejections.length === 0 && kinds.every((kind) => kind === 'Possibility'),
  };
}

/** 원소 판정을 한 줄로 접는다 — 터미널·배지용. */
export function possibilityVerdict(report: PossibilityReport): string {
  if (report.complete) {
    return `열린 갈래 ${String(report.possibilities.length)}개가 전부 O1 Possibility 로 선다`;
  }
  const first = report.rejections[0];
  return first === undefined
    ? '갈래가 12타입으로 분류되지 않는다'
    : `${first.nodeLabel} 의 ${first.direction} 갈래가 O1 에서 막혔다 — ${first.message}`;
}
