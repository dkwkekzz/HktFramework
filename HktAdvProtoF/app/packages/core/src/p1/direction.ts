// P1-a 대응 방향 7종 확정 — 결핍 하나 앞에 놓일 수 있는 갈래의 종류를 못박는다.
//
// P0 이 벽돌을 세웠다. 방향은 그 벽돌을 고르는 **틀**이다 — 방향은 행동이 아니고, 행동을
// 고르는 기준이다. 그래서 방향마다 "어느 원자를 쓰는가" 가 붙어야 하고, 그 배정은 P0-a 가 이미
// 값으로 남긴 `DIRECTION_RECONCILIATION` 과 **한 글자도 어긋나면 안 된다**. 두 곳에 같은 것을
// 적으면 언젠가 갈라지므로, 여기서는 적지 않고 **묶는다** — P0 에서 읽어 오고, 어긋나면 거부한다.
//
// 원문은 방향 일곱을 나열한 뒤 물 부족 예시로 일곱 갈래를 든다:
//
//   물 부족 ─ 찾는다 · 구매한다 · 훔친다 · 빗물을 저장한다 · 정화 기술을 배운다 ·
//             수분 손실을 줄인다 · 물 없는 대사 구조로 변형한다
//
// 그 일곱 갈래를 방향에 붙여 보면 드러나는 것이 있다: **다섯 방향만 쓰이고 둘이 비어 있다.**
// 비어 있는 둘(위임·경쟁 제거)은 남이 있어야 성립하는 방향이고, 물 부족 예시에는 남이 없다.
// 그것이 이 하위 작업의 한 문장이다 — **다섯은 혼자서도 열리고, 둘은 세계에 남이 있어야 열린다.**

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { STRATEGY_DIRECTIONS, type StrategyDirection } from '../o1/demand.ts';
import {
  ACTION_ATOMS,
  atomLabel,
  atomResolutionOf,
  type ActionAtom,
} from '../p0/atom.ts';
import { violateStrategy, type StrategyViolation } from './violation.ts';

// 방향 7종의 이름표는 O1 이 이미 고정했다 (`Possibility.direction` 이 그 enum 을 쓴다).
// D0 가 O1 의 의존 종 이름표에 근거와 성격을 붙였듯, P1 은 이 이름표에 **원자와 열림 조건**을
// 붙인다 — 이름을 여기서 새로 짓지 않는 것이 요점이다.
export { STRATEGY_DIRECTIONS, type StrategyDirection };

/** 방향이 누구를 건드려야 성립하는가. */
export const DIRECTION_REACHES = [
  'alone', // 혼자서도 선다 — 세계나 자기만 건드린다
  'others', // 세계에 남이 있어야 선다
] as const;
export type DirectionReach = (typeof DIRECTION_REACHES)[number];

/** 확정된 방향 하나. */
export interface StrategyDirectionSpec {
  readonly direction: StrategyDirection;
  /** 한국어 이름 (화면 표기) */
  readonly label: string;
  /** ModulePlan P1 이 쓴 문장 — P0 환원표를 찾는 열쇠이기도 하다 */
  readonly originalName: string;
  /** 이 방향이 하는 일 한 줄 */
  readonly does: string;
  /** 무엇을 바꾸려 하는가 — 결핍 자체인가, 기댐인가, 세계인가 */
  readonly aimsAt: string;
  readonly reach: DirectionReach;
  /** 붉은 장막 세계에서의 예 */
  readonly example: string;
  readonly source: string;
}

/** 확정 7방향의 정의. 원자는 여기 적지 않는다 — P0 환원표에서 읽어 온다. */
export const STRATEGY_DIRECTION_SPECS: readonly StrategyDirectionSpec[] = [
  {
    direction: 'fulfill',
    label: '충족',
    originalName: '의존성을 충족한다',
    does: '비어 있는 자리를 지금 있는 것으로 채운다 — 가장 짧고 가장 자주 고르는 길이다',
    aimsAt: '결핍 자체 — 조건이 요구하는 값을 세운다',
    reach: 'alone',
    example: '몰이꾼이 협곡으로 걸어 들어가 사체에서 고기를 떼어 온다',
    source: 'ModulePlan P1 의존성을 충족한다',
  },
  {
    direction: 'substitute',
    label: '대체',
    originalName: '의존 대상을 대체한다',
    does: '같은 자리를 다른 것으로 채우게 기댐을 옮긴다 — 무게는 사라지지 않고 옮겨 간다',
    aimsAt: '기댐 — 무엇에 기대는가를 바꾼다 (D3 전환 장부가 무게를 잰다)',
    reach: 'alone',
    example: '사제가 식량에 기대던 무게의 절반을 의념의 샘으로 옮긴다',
    source: 'ModulePlan P1 의존 대상을 대체한다',
  },
  {
    direction: 'reduce',
    label: '감소',
    originalName: '소비량을 감소시킨다',
    does: '같은 것을 덜 쓰도록 자기를 바꾼다 — 채우지 않고 버티는 시간을 늘린다',
    aimsAt: '기댐의 무게 — 써서 없애는 기댐만 덜 쓸 수 있다',
    reach: 'alone',
    example: '오래 굶은 몰이꾼의 대사가 느려져 같은 고기로 더 오래 버틴다',
    source: 'ModulePlan P1 소비량을 감소시킨다',
  },
  {
    direction: 'produce',
    label: '생산',
    originalName: '의존 대상을 생산한다',
    does: '세계에 없던 것을 세워 채운다 — 찾을 것이 없을 때 남는 길이다',
    aimsAt: '세계 — 대상 자체를 만든다',
    reach: 'alone',
    example: '상단이 고개 어귀에 불을 피워 얼어붙는 밤을 견딜 온기를 만든다',
    source: 'ModulePlan P1 의존 대상을 생산한다',
  },
  {
    direction: 'delegate',
    label: '위임',
    originalName: '다른 주체에게 맡긴다',
    does: '남이 대신 채우게 한다 — 내 자리는 그대로 두고 채우는 손만 바꾼다',
    aimsAt: '남 — 그 사람이 움직이게 만든다',
    reach: 'others',
    example: '몰이꾼 둘이 등을 맡기기로 하고 잡은 것을 나누기로 한다',
    source: 'ModulePlan P1 다른 주체에게 맡긴다',
  },
  {
    direction: 'removeRival',
    label: '경쟁 제거',
    originalName: '경쟁자를 제거한다',
    does: '같은 것을 원하는 자를 지운다 — 채우는 것이 아니라 겨루는 자를 줄인다',
    aimsAt: '남 — 그 사람이 못 가지게 만든다',
    reach: 'others',
    example: '먼저 둥지를 찾은 자가 그 자리를 마을에 말하지 않는다 (은폐가 가장 싼 제거다)',
    source: 'ModulePlan P1 경쟁자를 제거한다',
  },
  {
    direction: 'removeDependency',
    label: '의존 제거',
    originalName: '의존성 자체를 제거한다',
    does: '그 자리를 아예 갖지 않는 존재가 된다 — 가장 비싸고 되돌릴 수 없다',
    aimsAt: '자기 — 기대는 구조 자체를 버린다',
    reach: 'alone',
    example: '장막벌레의 군집이 껍질을 벗고 물 없이 겨울을 나는 몸으로 바뀐다',
    source: 'ModulePlan P1 의존성 자체를 제거한다',
  },
];

/** 원문이 물 부족 예시로 든 갈래 하나. */
export interface OriginalBranch {
  readonly name: string;
  readonly source: string;
}

/** ModulePlan P1 물 부족 예시의 일곱 갈래 — 하나도 빠짐없이 방향에 붙어야 한다. */
export const WATER_BRANCHES: readonly OriginalBranch[] = [
  { name: '물을 찾는다', source: 'ModulePlan P1 예시' },
  { name: '물을 구매한다', source: 'ModulePlan P1 예시' },
  { name: '물을 훔친다', source: 'ModulePlan P1 예시' },
  { name: '빗물을 저장한다', source: 'ModulePlan P1 예시' },
  { name: '정화 기술을 배운다', source: 'ModulePlan P1 예시' },
  { name: '수분 손실을 줄인다', source: 'ModulePlan P1 예시' },
  { name: '물 없는 대사 구조로 변형한다', source: 'ModulePlan P1 예시' },
];

/** 원문 갈래 하나가 어느 방향·어느 원자로 붙는가. */
export interface DirectionResolution {
  readonly original: string;
  readonly direction: StrategyDirection;
  /** 그 갈래가 실제로 쓰는 원자 — 방향이 주는 원자 중 하나여야 한다 */
  readonly atom: ActionAtom;
  readonly reason: string;
}

/** 물 부족 일곱 갈래의 방향 배정. */
export const BRANCH_RECONCILIATION: readonly DirectionResolution[] = [
  {
    original: '물을 찾는다',
    direction: 'fulfill',
    atom: 'seek',
    reason: '어디 있는지를 알아내 채운다 — 채움의 첫 갈래이고, 아무것도 못 본 채로 낼 수 있는 유일한 요청이다.',
  },
  {
    original: '물을 구매한다',
    direction: 'fulfill',
    atom: 'exchange',
    reason: '값을 치르고 받는다 — 같은 충족인데 치르는 자리가 재고다.',
  },
  {
    original: '물을 훔친다',
    direction: 'fulfill',
    atom: 'seize',
    reason: '동의 없이 가져온다 — 구매와 같은 자리를 바꾸고 동의 하나만 다르다 (P0 짝).',
  },
  {
    original: '빗물을 저장한다',
    direction: 'produce',
    atom: 'produce',
    reason: '세계에 없던 저장분을 세운다 — 찾을 물이 없을 때 남는 길이다.',
  },
  {
    original: '정화 기술을 배운다',
    direction: 'substitute',
    atom: 'substitute',
    reason:
      '깨끗한 물에 기대던 것을 아무 물에 기대는 것으로 옮긴다 — 대상을 바꾸는 것이지 채우는 것이 아니다. 배우는 일 자체(정보 충족)는 그 앞에 놓이는 다른 결핍이다.',
  },
  {
    original: '수분 손실을 줄인다',
    direction: 'reduce',
    atom: 'adapt',
    reason: '기대는 자리는 그대로고 쓰는 양만 준다 — 채우지 않고 버티는 시간을 늘린다.',
  },
  {
    original: '물 없는 대사 구조로 변형한다',
    direction: 'removeDependency',
    atom: 'shed',
    reason: '그 자리를 아예 갖지 않는 몸이 된다 — 일곱 갈래 중 유일하게 되돌릴 수 없다.',
  },
];

/**
 * 방향이 쓰는 원자 — P0-a 환원표에서 읽어 온다.
 * 여기서 다시 적지 않는 것이 요점이다: 두 곳에 적으면 언젠가 갈라진다.
 */
export function atomsOf(direction: StrategyDirection): readonly ActionAtom[] {
  const spec = directionSpec(direction);
  if (spec === null) return [];
  return atomResolutionOf(spec.originalName)?.atoms ?? [];
}

/** 방향 정의 하나를 찾는다. */
export function directionSpec(direction: StrategyDirection): StrategyDirectionSpec | null {
  return STRATEGY_DIRECTION_SPECS.find((spec) => spec.direction === direction) ?? null;
}

/** 문자열이 확정 7방향 중 하나인가. */
export function isStrategyDirection(value: unknown): value is StrategyDirection {
  return typeof value === 'string' && (STRATEGY_DIRECTIONS as readonly string[]).includes(value);
}

/** 방향의 한국어 이름 — 화면·사유 문장용. */
export function directionLabel(direction: StrategyDirection): string {
  return directionSpec(direction)?.label ?? direction;
}

/** 원문 갈래 하나가 어느 방향으로 붙는가. */
export function branchResolutionOf(
  original: string,
  resolutions: readonly DirectionResolution[] = BRANCH_RECONCILIATION,
): DirectionResolution | null {
  return resolutions.find((entry) => entry.original === original) ?? null;
}

/** 방향 확정 결과. */
export interface DirectionReport {
  readonly directions: readonly StrategyDirection[];
  /** 방향별 원자 (P0 에서 읽어 온 것) */
  readonly byDirection: Readonly<Record<string, readonly ActionAtom[]>>;
  /** 원문 예시가 붙지 않은 갈래 */
  readonly unresolved: readonly string[];
  /** 원문 물 예시가 한 번도 쓰지 않은 방향 — 왜 안 쓰였는지가 의미다 */
  readonly unusedDirections: readonly StrategyDirection[];
  /** 남이 있어야 열리는 방향 */
  readonly needOthers: readonly StrategyDirection[];
  readonly violations: readonly StrategyViolation[];
  readonly complete: boolean;
}

/** 방향 7종이 온전히 서는가 — 원자 배정이 P0 과 어긋나지 않는가. */
export function checkDirections(
  specs: readonly StrategyDirectionSpec[] = STRATEGY_DIRECTION_SPECS,
  originals: readonly OriginalBranch[] = WATER_BRANCHES,
  resolutions: readonly DirectionResolution[] = BRANCH_RECONCILIATION,
): DirectionReport {
  const violations: StrategyViolation[] = [];
  const defined = specs.map((spec) => spec.direction);

  const duplicates = stableSort(
    defined.filter((direction, index) => defined.indexOf(direction) !== index),
    compareStrings,
  );
  for (const direction of duplicates) {
    violateStrategy(violations, direction, 'duplicate-direction', '$.specs', `${direction} 이 두 번 적혔다`);
  }

  for (const direction of STRATEGY_DIRECTIONS) {
    if (defined.includes(direction)) continue;
    violateStrategy(
      violations,
      direction,
      'unsourced-direction',
      '$.specs',
      `원문 P1 이 든 ${direction} 에 정의가 없다 — 이름만 있는 방향은 아무 갈래도 만들지 못한다`,
    );
  }

  const byDirection: Record<string, readonly ActionAtom[]> = {};
  for (const [index, spec] of specs.entries()) {
    const at = `$.specs[${String(index)}]`;
    const blanks = [
      spec.source === '' ? 'source' : '',
      spec.does === '' ? 'does' : '',
      spec.example === '' ? 'example' : '',
      spec.aimsAt === '' ? 'aimsAt' : '',
      spec.originalName === '' ? 'originalName' : '',
    ].filter((field) => field !== '');
    if (blanks.length > 0) {
      violateStrategy(
        violations,
        spec.direction,
        'unsourced-direction',
        `${at}.${blanks[0] ?? ''}`,
        `${spec.direction} 이 ${blanks.join('·')} 를 대지 못한다 — 근거 없는 방향은 지어낸 것이다`,
      );
    }

    // 원자는 P0 환원표에서 읽어 온다. 읽히지 않으면 그 방향은 계획이 되지 못한다.
    const resolution = atomResolutionOf(spec.originalName);
    const atoms = resolution?.atoms ?? [];
    byDirection[spec.direction] = atoms;

    if (resolution === null) {
      violateStrategy(
        violations,
        spec.direction,
        'direction-atom-drift',
        `${at}.originalName`,
        `P0 환원표에 ${JSON.stringify(spec.originalName)} 가 없다 — 방향의 문장이 원문과 어긋나면 원자를 찾지 못한다`,
      );
      continue;
    }
    if (resolution.resolution !== 'direction') {
      violateStrategy(
        violations,
        spec.direction,
        'direction-atom-drift',
        `${at}.originalName`,
        `P0 이 ${JSON.stringify(spec.originalName)} 를 방향이 아니라 ${resolution.resolution} 으로 환원했다`,
      );
    }
    if (atoms.length === 0) {
      violateStrategy(
        violations,
        spec.direction,
        'atomless-direction',
        `${at}`,
        `${spec.direction} 을 이루는 원자가 없다 — 원자 없는 방향은 P5 가 계획으로 분해하지 못한다`,
      );
    }
    for (const atom of atoms) {
      if ((ACTION_ATOMS as readonly string[]).includes(atom)) continue;
      violateStrategy(
        violations,
        spec.direction,
        'phantom-atom',
        `${at}`,
        `16원자 밖의 이름 ${JSON.stringify(atom)} 이 방향에 들어 있다`,
      );
    }
  }

  // 원문 예시의 일곱 갈래가 하나도 빠짐없이 방향에 붙는가.
  const resolvedNames = new Set(resolutions.map((entry) => entry.original));
  const unresolved = originals
    .map((entry) => entry.name)
    .filter((name) => !resolvedNames.has(name));
  for (const name of unresolved) {
    violateStrategy(
      violations,
      '',
      'unresolved-example',
      '$.reconciliation',
      `원문이 든 갈래 ${JSON.stringify(name)} 가 일곱 방향 어디로도 붙지 않았다 — 붙지 않는 갈래가 있으면 7 은 완결이 아니다`,
    );
  }
  for (const [index, entry] of resolutions.entries()) {
    const at = `$.reconciliation[${String(index)}]`;
    if (!defined.includes(entry.direction)) {
      violateStrategy(
        violations,
        entry.direction,
        'dangling-example',
        at,
        `${entry.original} 를 7종에 없는 방향 ${JSON.stringify(entry.direction)} 로 보냈다`,
      );
      continue;
    }
    const atoms = byDirection[entry.direction] ?? [];
    if (!atoms.includes(entry.atom)) {
      violateStrategy(
        violations,
        entry.direction,
        'direction-atom-drift',
        `${at}.atom`,
        `${entry.original} 가 ${atomLabel(entry.atom)} 를 쓴다는데 ${directionLabel(entry.direction)} 방향은 ${atoms.map(atomLabel).join('·')} 만 준다`,
      );
    }
  }

  const used = new Set(resolutions.map((entry) => entry.direction));
  const unusedDirections = defined.filter((direction) => !used.has(direction));
  const needOthers = specs.filter((spec) => spec.reach === 'others').map((spec) => spec.direction);

  return {
    directions: defined,
    byDirection,
    unresolved,
    unusedDirections,
    needOthers,
    violations,
    complete: specs.length > 0 && violations.length === 0,
  };
}

/** 방향 확정을 한 줄 판정으로 접는다 — 터미널·배지용. */
export function directionVerdict(report: DirectionReport): string {
  if (report.complete) {
    return `방향 ${String(report.directions.length)}종이 P0 원자에 묶였다 (원문 예시가 쓰는 방향 ${String(report.directions.length - report.unusedDirections.length)} · 남이 있어야 열리는 방향 ${String(report.needOthers.length)})`;
  }
  const reasons: string[] = [];
  if (report.directions.length === 0) reasons.push('확정 방향이 없다');
  if (report.unresolved.length > 0) reasons.push(`붙지 않은 원문 갈래 ${report.unresolved.join(', ')}`);
  const rules = [...new Set(report.violations.map((violation) => violation.rule))];
  if (reasons.length === 0) return `방향이 막혔다 — ${rules.join(', ')}`;
  return reasons.join(' · ');
}
