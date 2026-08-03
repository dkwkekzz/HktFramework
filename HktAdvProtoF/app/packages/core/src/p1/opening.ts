// P1-b 열림 판정 — 결핍 하나 앞에서 일곱 방향 중 무엇이 정말 열리는가.
//
// 여기가 P1 의 핵심이다. 일곱을 그대로 복사해 붙이면 그것은 전개가 아니다 — 모든 결핍 앞에
// 일곱 갈래가 다 있다면 주체들은 서로 구별되지 않는다. **무엇을 할 수 없는지가 그 주체를 말한다.**
//
// 그래서 방향마다 열림 조건을 앞 계층의 값에서 읽어 온다. 새로 지어내지 않는다:
//
//   충족   그 종을 채우는 원자가 P0 에 있는가          — 규칙 의존은 아무 원자도 채우지 못한다
//   대체   그 기댐이 갈아탈 수 있는가 (D1 substitutability) — 0 이면 그 대상이어야 하는 기댐이다
//   감소   써서 없애는 기댐인가 (D1 consumes)            — 있어야 하는 것은 덜 있을 수 없다
//   생산   그 종을 만들 수 있는가 (P0 produce 의 kinds)  — 신뢰도 장소도 만들어지지 않는다
//   위임   그 종을 넘겨받을 수 있는가 (D0 transferable)  — 내 허기는 남이 대신 채우지 못한다
//   경쟁   같은 것을 원하는 자를 아는가                  — 그 눈은 아직 없다 (D5 가 갚는다)
//   제거   그 자리가 종의 뿌리인가 (D2·D3)               — 뿌리는 개체가 지우지 못한다
//
// 이 일곱 줄에 P0·D0·D1·D2·D3 이 전부 걸려 있다. 그것이 요점이다 — 열림 판정은 새 규칙이
// 아니라 **앞에서 이미 못박은 성질들의 결과**여야 한다. 새 규칙을 여기서 지어내면 그것은
// 어디에도 근거가 없는 임의의 게임 규칙이 된다.

import type { Id } from '../v1/id.ts';
import { kindGrounding, kindLabel, type DependencyKind } from '../d0/index.ts';
import type { DependencyEdge, DependencyGraph, DependencyNode } from '../d1/index.ts';
import { atomGrounding, atomLabel, atomsFilling, type ActionAtom } from '../p0/index.ts';
import {
  atomsOf,
  directionLabel,
  STRATEGY_DIRECTIONS,
  type StrategyDirection,
} from './direction.ts';
import { violateStrategy, type StrategyViolation } from './violation.ts';

/** 방향이 막히는 사유 — 전부 앞 계층이 이미 못박은 성질에서 나온다. */
export const BLOCK_REASONS = [
  'no-filling-atom', // 그 종을 채우는 원자가 16 중에 없다 (P0)
  'no-target', // 가리킬 대상이 없는 종이다 — 시간 (D0)
  'not-substitutable', // 그 대상이어야 하는 기댐이다 (D1 substitutability 0)
  'nothing-to-reduce', // 써서 없애는 기댐이 아니다 (D1 consumes 아님)
  'unproducible-kind', // 생산 원자가 만들 수 없는 종이다 (P0 produce.kinds)
  'untransferable', // 남에게 넘길 수 없는 종이다 (D0 transferable)
  'no-known-rival', // 같은 것을 원하는 자를 아직 볼 수 없다 (D5 가 갚는다)
  'species-root', // 종이 물려준 뿌리다 — 개체는 지우지 못한다 (D2·D3)
] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

/** 막힘 사유 하나의 뜻과, 지금 볼 수 없어 막히는 것이면 누가 갚는가. */
export interface BlockSpec {
  readonly reason: BlockReason;
  readonly says: string;
  /** 세계를 더 볼 수 있게 되면 열릴 사유인가 — 그렇다면 갚을 모듈. 아니면 null */
  readonly owedTo: string | null;
}

export const BLOCK_SPECS: readonly BlockSpec[] = [
  {
    reason: 'no-filling-atom',
    says: '이 종의 의존을 채우는 원자가 열여섯 중에 없다 — 압력은 올라도 채울 길이 없다',
    owedTo: 'W2 규칙 실체화 — 규칙이 세계 상태가 되면 그때 채울 길이 생긴다',
  },
  {
    reason: 'no-target',
    says: '가리킬 대상이 없는 종이다 — 기다리는 것은 행동이 아니다',
    owedTo: null,
  },
  {
    reason: 'not-substitutable',
    says: '그 대상이어야 하는 기댐이다 — 갈아탈 여지가 0 이다',
    owedTo: null,
  },
  {
    reason: 'nothing-to-reduce',
    says: '써서 없애는 기댐이 아니다 — 있어야 하는 것은 덜 있을 수 없다',
    owedTo: null,
  },
  {
    reason: 'unproducible-kind',
    says: '만들어지지 않는 종이다 — 신뢰도 장소도 사람이 세우는 것이 아니다',
    owedTo: null,
  },
  {
    reason: 'untransferable',
    says: '남에게 넘길 수 없는 종이다 — 내 몸의 자리는 남이 대신 채우지 못한다',
    owedTo: null,
  },
  {
    reason: 'no-known-rival',
    says: '같은 것을 원하는 자를 아직 볼 수 없다 — 겨루는 눈이 세계에 없다',
    owedTo: 'D5 의존 충돌 탐지 (단계 3) — 그때 경쟁자가 값으로 들어온다',
  },
  {
    reason: 'species-root',
    says: '종이 물려준 뿌리다 — 개체는 무엇에 기댈지를 고칠 수 있어도 뿌리를 지우지는 못한다',
    owedTo: 'G3 성장 — 종의 자리 자체를 바꾸는 탈피는 그쪽이 승인한다',
  },
];

/** 막힘 사유의 설명을 찾는다. */
export function blockSpec(reason: BlockReason): BlockSpec | null {
  return BLOCK_SPECS.find((entry) => entry.reason === reason) ?? null;
}

/** 결핍 하나 앞에 놓인 갈래 하나. */
export interface StrategyOption {
  readonly direction: StrategyDirection;
  /** 열렸는가 */
  readonly open: boolean;
  /** 열렸다면 실제로 쓸 수 있는 원자들 — 방향이 주는 원자 중 이 종에 닿는 것만 남는다 */
  readonly atoms: readonly ActionAtom[];
  /** 막혔다면 왜 */
  readonly blockedBy: BlockReason | null;
  /** 막혔는데 뒤에서 갚을 수 있는 것이면 누가 */
  readonly owedTo: string | null;
  /** 왜 이렇게 판정됐는가 한 줄 — 화면이 그대로 싣는다 */
  readonly why: string;
}

/** 열림 판정에 필요한, 그래프 밖에서 오는 것들. */
export interface OpeningContext {
  /** 같은 것을 원한다고 알려진 다른 주체들 — D5 가 서기 전에는 호출자가 준다 */
  readonly rivals?: readonly Id[];
}

/** 노드로 들어오는 기댐(간선) 중 가장 무거운 것 — 방향 판정은 이 기댐을 본다. */
export function leadingEdge(
  graph: DependencyGraph,
  nodeId: Id,
): DependencyEdge | null {
  const incoming = graph.edges.filter((edge) => edge.to === nodeId);
  if (incoming.length === 0) return null;
  return incoming.reduce((worst, edge) => (edge.strength > worst.strength ? edge : worst));
}

/** 그 종을 생산할 수 있는가 — P0 생산 원자가 닿는 종인지 그대로 읽는다. */
function producible(kind: DependencyKind): boolean {
  return atomGrounding('produce')?.kinds.includes(kind) === true;
}

/** 방향 하나가 이 결핍 앞에 열리는가. */
export function openOption(
  direction: StrategyDirection,
  node: DependencyNode,
  edge: DependencyEdge | null,
  isRoot: boolean,
  context: OpeningContext = {},
): StrategyOption {
  const kind = node.kind;
  const ground = kindGrounding(kind);
  const atoms = atomsOf(direction);
  const rivals = context.rivals ?? [];

  const blocked = (reason: BlockReason, why: string): StrategyOption => ({
    direction,
    open: false,
    atoms: [],
    blockedBy: reason,
    owedTo: blockSpec(reason)?.owedTo ?? null,
    why,
  });

  const opened = (usable: readonly ActionAtom[], why: string): StrategyOption => ({
    direction,
    open: true,
    atoms: usable,
    blockedBy: null,
    owedTo: null,
    why,
  });

  switch (direction) {
    case 'fulfill': {
      if (ground?.targeting === 'none') {
        return blocked('no-target', `${kindLabel(kind)} 은 가리킬 대상이 없다 — 흐르기를 기다릴 뿐이다`);
      }
      const filling = atomsFilling(kind);
      const usable = atoms.filter((atom) => filling.includes(atom));
      if (usable.length === 0) {
        return blocked(
          'no-filling-atom',
          `${kindLabel(kind)} 의존을 채우는 원자가 열여섯 중에 없다 — 압력만 오른다`,
        );
      }
      return opened(usable, `${usable.map(atomLabel).join(' · ')} 로 채울 수 있다`);
    }

    case 'substitute': {
      if (edge === null || edge.substitutability === 0) {
        return blocked(
          'not-substitutable',
          edge === null
            ? '이 자리로 들어오는 기댐이 없어 갈아탈 대상이 없다'
            : `${node.label} 은 그 대상이어야 하는 기댐이다 (갈아탐 0)`,
        );
      }
      return opened(atoms, `갈아탐 ${edge.substitutability.toFixed(2)} — 다른 것으로 옮길 여지가 있다`);
    }

    case 'reduce': {
      if (edge === null || edge.relation !== 'consumes') {
        return blocked(
          'nothing-to-reduce',
          edge === null
            ? '이 자리로 들어오는 기댐이 없어 줄일 것이 없다'
            : `${node.label} 은 써서 없애는 기댐이 아니라 ${edge.relation} 다 — 있어야 하는 것은 덜 있을 수 없다`,
        );
      }
      return opened(atoms, '써서 없애는 기댐이므로 덜 쓸 수 있다');
    }

    case 'produce': {
      if (!producible(kind)) {
        return blocked('unproducible-kind', `${kindLabel(kind)} 은 생산 원자가 만들 수 있는 종이 아니다`);
      }
      return opened(atoms, `${kindLabel(kind)} 은 없던 것을 세울 수 있는 종이다`);
    }

    case 'delegate': {
      if (ground?.transferable !== true) {
        return blocked('untransferable', `${kindLabel(kind)} 은 남이 대신 채워 줄 수 없다`);
      }
      return opened(atoms, `${kindLabel(kind)} 은 넘겨받을 수 있으므로 남에게 맡길 수 있다`);
    }

    case 'removeRival': {
      if (rivals.length === 0) {
        return blocked('no-known-rival', '같은 것을 원한다고 알려진 자가 없다 — 겨루는 눈이 아직 세계에 없다');
      }
      return opened(atoms, `같은 것을 원하는 자 ${String(rivals.length)}명이 알려져 있다`);
    }

    case 'removeDependency': {
      if (isRoot) {
        return blocked(
          'species-root',
          `${node.label} 은 종이 물려준 뿌리다 — 무엇으로 채울지는 바꿔도 굶는다는 사실은 버리지 못한다`,
        );
      }
      return opened(atoms, '사슬 안쪽의 기댐이므로 통째로 버릴 수 있다');
    }
  }
}

/** 결핍 하나 앞의 일곱 갈래 전부. */
export function openOptions(
  graph: DependencyGraph,
  node: DependencyNode,
  context: OpeningContext = {},
): readonly StrategyOption[] {
  const edge = leadingEdge(graph, node.id);
  const isRoot = graph.rootIds.includes(node.id);
  return STRATEGY_DIRECTIONS.map((direction) => openOption(direction, node, edge, isRoot, context));
}

/** 갈래 판정 검사 — 열렸다면 원자가 있고, 막혔다면 사유가 있는가. */
export function checkOptions(
  options: readonly StrategyOption[],
  path = '$.options',
): readonly StrategyViolation[] {
  const violations: StrategyViolation[] = [];
  for (const [index, option] of options.entries()) {
    const at = `${path}[${String(index)}]`;
    if (option.open) {
      if (option.atoms.length === 0) {
        violateStrategy(
          violations,
          option.direction,
          'open-without-atom',
          at,
          `${directionLabel(option.direction)} 이 열렸다면서 쓸 원자가 하나도 없다 — 그것은 열린 것이 아니다`,
        );
      }
      if (option.blockedBy !== null) {
        violateStrategy(
          violations,
          option.direction,
          'unreasoned-block',
          at,
          `${directionLabel(option.direction)} 이 열렸는데 막힌 사유도 달려 있다`,
        );
      }
      continue;
    }
    if (option.blockedBy === null) {
      violateStrategy(
        violations,
        option.direction,
        'unreasoned-block',
        at,
        `${directionLabel(option.direction)} 이 막혔는데 사유가 없다 — 사유 없는 차단은 임의의 규칙이다`,
      );
      continue;
    }
    const spec = blockSpec(option.blockedBy);
    if (spec === null) {
      violateStrategy(
        violations,
        option.direction,
        'unknown-block',
        at,
        `선언되지 않은 사유 ${JSON.stringify(option.blockedBy)} 로 막았다`,
      );
      continue;
    }
    if (spec.owedTo !== null && option.owedTo === null) {
      violateStrategy(
        violations,
        option.direction,
        'unowed-block',
        at,
        `${option.blockedBy} 는 뒤에서 갚을 수 있는 사유인데 누가 갚는지를 적지 않았다`,
      );
    }
  }
  return violations;
}

/** 갈래 하나를 한 줄로 — 화면·터미널이 같은 문장을 쓴다. */
export function optionText(option: StrategyOption): string {
  return option.open
    ? `${directionLabel(option.direction)} — ${option.atoms.map(atomLabel).join(' · ')}`
    : `${directionLabel(option.direction)} — 막힘 (${option.blockedBy ?? ''})`;
}
