// P5-b 원문 사슬 대조 — 원문이 일곱 줄로 적은 사슬이 이 계층에서 도출되는가.
//
// 원문 P5 는 계획을 예시 하나로만 보인다.
//
//   치료 재료 확보 → 재료 위치 조사 → 접근 권한 확보 → 이동 → 획득 → 운반 → 치료제 제작
//
// 일곱 줄이다. 그런데 이 세계의 행동은 열여섯뿐이고(P0), 그 사이의 먼저는 이미 계산돼 있다(P3-a).
// 그러면 물을 것은 하나다 — **저 일곱이 열여섯을 지나 우리 사슬에서 나오는가.**
//
// 나오지 않는다면 둘 중 하나가 틀린 것이다: 원자 열여섯이 최소 집합이 아니거나, 예시가
// 이 세계의 것이 아니거나. P2-c 가 원문 P2 다섯 줄을 격자에 대조한 것과 같은 태도다.
//
// 그리고 실제로 **하나가 나오지 않는다.** 접근 권한 확보 — 통행권·자격을 세우는 원자가 열여섯에
// 없기 때문이다. P0-b 가 `institutional.law` 를 자리로만 갖고 권한으로는 갖지 않아서인데,
// 그것은 이 계층이 고칠 자리가 아니라 W2(제도)가 갚을 자리다. 그래서 **유예로 선언하고**,
// 선언 없이 못 닿는 단계는 위반으로 걸린다 — P3-a 가 세울 수 없는 자리를 선언으로 다룬 것과 같다.

import {
  atomLabel,
  atomResolutionOf,
  reconcileAtoms,
  type ActionAtom,
  type AtomResolution,
  type OriginalAction,
} from '../p0/index.ts';
import type { ActionPlan } from './chain.ts';
import { violatePlan, type PlanViolation } from './violation.ts';

/** ModulePlan P5 가 예시로 든 계획 일곱 단계. */
export const P5_CHAIN: readonly OriginalAction[] = [
  { name: '치료 재료 확보', source: 'ModulePlan P5' },
  { name: '재료 위치 조사', source: 'ModulePlan P5' },
  { name: '접근 권한 확보', source: 'ModulePlan P5' },
  { name: '이동', source: 'ModulePlan P5' },
  { name: '획득', source: 'ModulePlan P5' },
  { name: '운반', source: 'ModulePlan P5' },
  { name: '치료제 제작', source: 'ModulePlan P5' },
];

/** 원문 일곱이 16원자로 접히는 방식. */
export const CHAIN_RECONCILIATION: readonly AtomResolution[] = [
  {
    original: '치료 재료 확보',
    resolution: 'direction',
    atoms: ['acquire', 'exchange', 'seize', 'produce'],
    reason:
      '행동이 아니라 목적이다 — 무엇으로 확보할지는 정해지지 않았다. P1 이 방향으로 펴고 P4 가 하나를 고른다',
  },
  {
    original: '재료 위치 조사',
    resolution: 'same',
    atoms: ['seek'],
    reason:
      '어디 있는지를 세우는 일이다 — 조사(investigate)가 아니다. 조사는 없던 앎을 세우지 않는다(P3-a)',
  },
  {
    original: '이동',
    resolution: 'same',
    atoms: ['acquire'],
    reason: 'P0 환원표가 이미 이동을 획득 한 칸에 세웠다 — 여기서 다시 정하지 않는다',
  },
  {
    original: '획득',
    resolution: 'same',
    atoms: ['acquire'],
    reason: '자리를 옮겨 내 것으로 만드는 일 그대로다',
  },
  {
    original: '운반',
    resolution: 'same',
    atoms: ['acquire'],
    reason:
      'P0 환원표가 운송을 획득에 세운 것과 같은 자리다 — 이동·획득·운반 셋이 한 칸에 접힌다',
  },
  {
    original: '치료제 제작',
    resolution: 'same',
    atoms: ['produce'],
    reason: '가진 것을 써서 없던 것을 만든다 — 재고를 치르고 재고를 세운다',
  },
];

/** 열여섯으로 환원되지 않는 단계와, 누가 그것을 갚는가. */
export interface DeferredStep {
  readonly original: string;
  /** 누가 이 자리를 세우는가 — 이 계층이 아니면 어디인가 */
  readonly owedTo: string;
  readonly reason: string;
}

/** 선언된 유예 — 환원할 원자가 열여섯에 없는 단계. */
export const DEFERRED_STEPS: readonly DeferredStep[] = [
  {
    original: '접근 권한 확보',
    owedTo: 'W2 제도 계층 — 권한을 세우는 자리는 거기서 정해진다',
    reason:
      '통행권·자격(`institutional.passage` · `institutional.license`)을 세우는 원자가 열여섯에 없다. P0-b 는 `institutional.law` 를 **자리로만** 갖고 권한으로는 갖지 않으므로, 여기서 원자를 하나 더 만들면 그것은 P0 최소 집합을 깨는 일이 된다',
  },
];

/** 원문 단계 하나가 어디까지 왔는가. */
export interface ChainResolution {
  readonly original: string;
  /** 어느 원자(들)로 접히는가. 유예면 빈 목록 */
  readonly atoms: readonly ActionAtom[];
  /** 행동인가 방향인가 — 방향은 계획의 걸음이 되지 않는다 */
  readonly kind: AtomResolution['resolution'] | 'deferred';
  /** 실제 계획에서 그 걸음이 섰는가 */
  readonly reached: boolean;
  readonly note: string;
}

/** 원문 사슬 대조 결과. */
export interface ChainReport {
  readonly resolutions: readonly ChainResolution[];
  /** 계획이 실제로 낸 원자 순서열 */
  readonly planned: readonly ActionAtom[];
  /** 환원되지 않고 유예 선언도 없는 단계 */
  readonly unresolved: readonly string[];
  /** 환원은 됐는데 계획 어디에도 서지 못한 단계 */
  readonly unreached: readonly string[];
  /** 유예로 선언된 단계 */
  readonly deferred: readonly string[];
  /** 원문 일곱이 실제로는 몇 걸음인가 */
  readonly foldedTo: number;
  readonly violations: readonly PlanViolation[];
  readonly complete: boolean;
}

/**
 * 원문 일곱을 계획 하나에 대조한다. 던지지 않는다 — 못 닿은 단계는 값으로 남는다.
 *
 * 도달 판정의 재료는 **실제로 조립된 계획**이다. 표만 맞추면 "적어 놓았으니 된다" 가 되므로,
 * P5-a 가 세운 사슬에 그 원자가 실제로 서 있는지를 본다.
 */
export function checkChain(
  plan: ActionPlan,
  originals: readonly OriginalAction[] = P5_CHAIN,
  resolutions: readonly AtomResolution[] = CHAIN_RECONCILIATION,
  deferred: readonly DeferredStep[] = DEFERRED_STEPS,
): ChainReport {
  const violations: PlanViolation[] = [];
  const planned = plan.atoms;
  const standing = new Set<string>(planned);
  const deferredBy = new Map(deferred.map((entry) => [entry.original, entry]));
  const resolvedBy = new Map(resolutions.map((entry) => [entry.original, entry]));

  const items: ChainResolution[] = [];
  const unresolved: string[] = [];
  const unreached: string[] = [];

  for (const original of originals) {
    const excused = deferredBy.get(original.name);
    const resolved = resolvedBy.get(original.name);

    if (resolved === undefined) {
      if (excused === undefined) {
        unresolved.push(original.name);
        violatePlan(
          violations,
          original.name,
          'unresolved-step',
          '$.resolutions',
          `원문이 적은 단계 ${JSON.stringify(original.name)} 가 16원자 어디로도 환원되지 않았고 유예 선언도 없다 — 환원되지 않는 걸음이 있다면 열여섯은 최소 집합이 아니다`,
        );
        items.push({
          original: original.name,
          atoms: [],
          kind: 'deferred',
          reached: false,
          note: '환원되지 않았다',
        });
        continue;
      }
      items.push({
        original: original.name,
        atoms: [],
        kind: 'deferred',
        reached: false,
        note: `${excused.owedTo} — ${excused.reason}`,
      });
      continue;
    }

    // 유예로 적어 놓고 실제로는 환원되는 단계 — 선언이 낡았다.
    if (excused !== undefined) {
      violatePlan(
        violations,
        original.name,
        'stale-deferral',
        '$.deferred',
        `${original.name} 를 유예로 적어 놓았는데 ${resolved.atoms.map(atomLabel).join('·')} 로 환원된다 — 갚을 곳이 없는 유예다`,
      );
    }

    // P0 이 이미 같은 이름을 환원했으면 그것과 어긋날 수 없다 — 두 곳에 다르게 적지 않는다.
    const byP0 = atomResolutionOf(original.name);
    if (byP0 !== null && byP0.atoms.join(',') !== resolved.atoms.join(',')) {
      violatePlan(
        violations,
        original.name,
        'unresolved-step',
        '$.resolutions',
        `${original.name} 를 P0 은 ${byP0.atoms.map(atomLabel).join('·')} 로, P5 는 ${resolved.atoms.map(atomLabel).join('·')} 로 적었다 — 같은 이름이 두 곳에서 갈린다`,
      );
    }

    // 방향은 걸음이 되지 않는다 — 무엇으로 할지가 아직 정해지지 않았기 때문이다.
    const reached =
      resolved.resolution === 'direction'
        ? resolved.atoms.some((atom) => standing.has(atom))
        : resolved.atoms.every((atom) => standing.has(atom));
    if (!reached) {
      unreached.push(original.name);
      violatePlan(
        violations,
        original.name,
        'unreached-step',
        '$.planned',
        `${original.name} 는 ${resolved.atoms.map(atomLabel).join('·')} 로 환원되는데 이 계획 어디에도 서지 않았다 — 격자가 틀렸거나 예시가 틀렸다`,
      );
    }
    items.push({
      original: original.name,
      atoms: resolved.atoms,
      kind: resolved.resolution,
      reached,
      note: resolved.reason,
    });
  }

  return {
    resolutions: items,
    planned,
    unresolved,
    unreached,
    deferred: [...deferredBy.keys()],
    foldedTo: planned.length,
    violations,
    complete: violations.length === 0,
  };
}

/** 원문 일곱이 16원자 안에서 성립하는가 — 계획을 보지 않고 표만 검사한다. */
export function reconcileChain(
  originals: readonly OriginalAction[] = P5_CHAIN,
  resolutions: readonly AtomResolution[] = CHAIN_RECONCILIATION,
  deferred: readonly DeferredStep[] = DEFERRED_STEPS,
): ReturnType<typeof reconcileAtoms> {
  // 유예된 단계는 환원 대상에서 빼고 P0 의 환원 검사기를 그대로 쓴다 — 검사기를 두 벌 만들지 않는다.
  const excused = new Set(deferred.map((entry) => entry.original));
  return reconcileAtoms(
    undefined,
    originals.filter((entry) => !excused.has(entry.name)),
    resolutions,
  );
}

/** 대조 결과를 한 줄로 접는다 — 터미널·배지용. */
export function chainVerdict(report: ChainReport): string {
  if (!report.complete) {
    const rules = [...new Set(report.violations.map((violation) => violation.rule))];
    return `원문 사슬이 도출되지 않는다 — ${rules.join(', ')}`;
  }
  return `원문 ${String(report.resolutions.length)} 단계가 ${String(report.foldedTo)} 걸음으로 선다 (유예 ${String(report.deferred.length)})`;
}

/** 화면·터미널이 함께 쓰는 요약 줄. */
export function chainSummary(report: ChainReport): readonly string[] {
  return report.resolutions.map(
    (entry) =>
      `${entry.reached ? '●' : '○'} ${entry.original} → ${
        entry.atoms.length === 0 ? '(유예)' : entry.atoms.map(atomLabel).join('·')
      }`,
  );
}
