// D4 검증 장면 — 붉은 장막 세계의 지금, 그리고 창고가 비어 가는 열두 틱.
//
// 여기서 세계가 처음으로 **값을 갖는다.** 지금까지의 장면은 전부 모양이었다 — 무엇에 기대는가,
// 무엇이 채우는가, 누가 어떻게 갈라지는가. 이 장면은 그 위에 값을 얹는다: 창고에 고기가 열 개
// 있고, 몰이꾼은 협곡에 있고, 사제의 의념은 이백이다.
//
// 그리고 시간이 흐른다. 사흘마다 재고가 둘씩 줄고, 셋 아래로 떨어지는 순간부터 압력이 오르기
// 시작한다 — 원문 D4 의 두 조건이 이 줄에서 확인된다:
//
//   식량이 충분하면 압력이 0 이다 (목적이 생기지 않는다)
//   식량이 줄면 압력이 점진적으로 오른다 (충족 → 불안정 → 결핍 → 위기 → 붕괴)

import { deterministicId, type Id } from '@hkt/core/v1';
import type { DependencyGraph } from '@hkt/core/d1';
import { buildSpeciesGraph } from '@hkt/core/d2';
import { graphBirthOf, personalizeFromWorld } from '@hkt/core/d3';
import {
  slotsFromResidue,
  snapshotOf,
  type SlotValue,
  type WorldSnapshot,
} from '@hkt/core/d4';

import {
  bareInstance,
  greedyInstance,
  hunterArchetype,
  hunterBlueprint,
  priestInstance,
  S3_DEFINITIONS,
  trackerInstance,
  VEIL_INSTANCES,
  VEIL_VARIATIONS,
  villagersId,
} from './d3-veil-variations.ts';
import { canyonId, hamletId, meatId, passLawId, toxinClaimId } from './d2-veil-blueprints.ts';
import { partnerId } from './s3-veil-instances.ts';

export {
  bareInstance,
  greedyInstance,
  priestInstance,
  trackerInstance,
  VEIL_INSTANCES,
  VEIL_VARIATIONS,
  S3_DEFINITIONS,
  hunterArchetype,
  hunterBlueprint,
  canyonId,
  hamletId,
  meatId,
  villagersId,
};

/** 이 장면의 지금 — 개체들이 선 시각(S3 NOW)에서 시작한다. */
export const NOW = 400;

const options = { definitions: S3_DEFINITIONS };

/** 개체의 개인 그래프 — D2 가 찍어 내고 D3 이 갈라 놓은 것. */
export function personalGraphOf(instance: typeof trackerInstance): DependencyGraph {
  const base = buildSpeciesGraph(hunterArchetype, hunterBlueprint, graphBirthOf(instance, '성체'));
  return personalizeFromWorld(base, instance, VEIL_VARIATIONS, options).graph;
}

export const trackerGraph = personalGraphOf(trackerInstance);
export const greedyGraph = personalGraphOf(greedyInstance);
export const bareGraph = personalGraphOf(bareInstance);
export const priestGraph = personalGraphOf(priestInstance);

const slot = (
  domain: SlotValue['domain'],
  holderId: Id,
  path: string,
  value: SlotValue['value'],
): SlotValue => ({ domain, holderId, path, value });

/** 사냥꾼 한 사람의 지금 — 협곡에 서 있고, 자격이 있고, 독을 알고, 몸은 성하다. */
function hunterSlots(subjectId: Id, stock: number): readonly SlotValue[] {
  return [
    slot('biological', subjectId, 'hunger', 0.3),
    slot('biological', subjectId, 'vitality', 0.8),
    slot('biological', subjectId, 'fertility', 0.5),
    // 협곡에 있다 — 그래서 사냥터는 채워지고 겨울 움막(아랫마을)은 비어 있다.
    // 한 몸이 두 곳에 있을 수 없다는 다툼은 D5 가 볼 일이다 (D2 가 남긴 자리).
    slot('physical', subjectId, 'region', canyonId),
    slot('economic', subjectId, `stock.${meatId}`, stock),
    slot('institutional', subjectId, `license.${passLawId}`, true),
    slot('informational', subjectId, `knows.${toxinClaimId}`, true),
    slot('relational', subjectId, `trust.${villagersId}`, 0.6),
    slot('transcendent', subjectId, 'worship', 12),
    slot('psychic', subjectId, 'energy', 200),
  ];
}

/** 세계에 함께 서 있는 것들 — 짝의 몸과 마을의 믿음. */
const WORLD_SLOTS: readonly SlotValue[] = [
  slot('biological', partnerId, 'vitality', 0.7),
  slot('psychic', villagersId, 'conviction', 0.5),
  slot('physical', canyonId, 'cover', 0.4),
];

/**
 * 그 틱의 세계 — 사냥꾼 넷과 그들이 지고 온 것, 그리고 창고의 재고.
 * 개체가 지고 온 값(S3 residue)이 세계의 첫 값이 된다 — 개체는 빈손으로 서지 않는다.
 */
export function worldAt(tick: number, stock: number): WorldSnapshot {
  const residues = VEIL_INSTANCES.flatMap((instance) => slotsFromResidue(instance.residue));
  const own = VEIL_INSTANCES.flatMap((instance) => hunterSlots(instance.id, stock));
  // 개체가 지고 온 값이 이깁니다 — 뒤에 온 같은 자리는 조립 관문이 막으므로 앞세운다.
  const seen = new Set(residues.map((entry) => `${entry.domain}.${entry.holderId}.${entry.path}`));
  const rest = [...own, ...WORLD_SLOTS].filter(
    (entry) => !seen.has(`${entry.domain}.${entry.holderId}.${entry.path}`),
  );
  return snapshotOf([...residues, ...rest], tick).snapshot;
}

/** 창고가 비어 가는 줄 — 사흘마다 둘씩 줄고, 바닥난 뒤로는 시간만 흐른다. */
export const STOCK_TREND: readonly { readonly tick: number; readonly stock: number }[] = [
  { tick: NOW, stock: 10 },
  { tick: NOW + 3, stock: 8 },
  { tick: NOW + 6, stock: 6 },
  { tick: NOW + 9, stock: 4 },
  { tick: NOW + 12, stock: 2 },
  { tick: NOW + 15, stock: 0 },
  { tick: NOW + 21, stock: 0 },
  { tick: NOW + 27, stock: 0 },
  { tick: NOW + 33, stock: 0 },
  { tick: NOW + 42, stock: 0 },
];

/** 재고가 조건(사흘치) 아래로 처음 떨어진 시각 — 결핍은 여기서 시작된다. */
export const HUNGER_SINCE = NOW + 12;

/** 겨울 식량 노드 — 결핍이 언제부터인지를 적을 자리. */
export function foodNodeId(graph: DependencyGraph): Id {
  return graph.nodes.find((node) => node.label === '겨울 식량')?.id ?? '';
}

/** 그 줄의 스냅샷들. */
export const TREND_SNAPSHOTS: readonly WorldSnapshot[] = STOCK_TREND.map((entry) =>
  worldAt(entry.tick, entry.stock),
);

/** 결핍이 시작된 시각 — 재고가 셋 아래로 떨어진 그때부터. */
export function sinceFor(graph: DependencyGraph): ReadonlyMap<Id, number> {
  return new Map([[foodNodeId(graph), HUNGER_SINCE]]);
}

/** 설 수 없는 읽기 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenReading {
  readonly broke: string;
  readonly expected: string;
  readonly graph: DependencyGraph;
  readonly slots: readonly SlotValue[];
  readonly tick: number;
  readonly since?: ReadonlyMap<Id, number>;
}

const baseSlots = (stock: number): readonly SlotValue[] => [
  ...slotsFromResidue(trackerInstance.residue),
  ...hunterSlots(trackerInstance.id, stock).filter(
    (entry) =>
      !trackerInstance.residue.some(
        (residue) =>
          residue.slot.domain === entry.domain &&
          residue.holderId === entry.holderId &&
          residue.slot.path === entry.path,
      ),
  ),
];

/** 조건 자리가 세계에 없는 그래프 — D1 관문을 지나지 않은 그래프를 손으로 지어 넣는다. */
const phantomGraph: DependencyGraph = {
  ...trackerGraph,
  nodes: trackerGraph.nodes.map((node) =>
    node.label === '겨울 식량' && node.condition.kind === 'slot'
      ? {
          ...node,
          condition: {
            ...node.condition,
            slot: { domain: 'biological' as const, path: 'despair' },
          },
        }
      : node,
  ),
};

/** 설 수 없는 읽기 일곱 — 사유마다 하나씩. */
export const BROKEN_READINGS: readonly BrokenReading[] = [
  {
    broke: '세계에 없는 자리에 값을 놓았다',
    expected: 'bad-state',
    graph: trackerGraph,
    slots: [...baseSlots(10), slot('biological', trackerInstance.id, 'despair', 0.9)],
    tick: NOW,
  },
  {
    broke: '자리가 받는 범위를 벗어난 값을 놓았다',
    expected: 'bad-state',
    graph: trackerGraph,
    slots: baseSlots(10).map((entry) =>
      entry.path === 'hunger' ? { ...entry, value: 5 } : entry,
    ),
    tick: NOW,
  },
  {
    broke: '같은 자리에 값이 둘이다 — 세계는 한 자리에 하나만 갖는다',
    expected: 'duplicate-state',
    graph: trackerGraph,
    slots: [...baseSlots(10), slot('biological', trackerInstance.id, 'hunger', 0.9)],
    tick: NOW,
  },
  {
    broke: '지금이 틱이 아니다',
    expected: 'bad-tick',
    graph: trackerGraph,
    slots: baseSlots(10),
    tick: -1,
  },
  {
    broke: '결핍이 아직 오지 않은 시각에 시작됐다고 적혔다',
    expected: 'future-since',
    graph: trackerGraph,
    slots: baseSlots(0),
    tick: NOW,
    since: new Map([[foodNodeId(trackerGraph), NOW + 10]]),
  },
  {
    broke: '그래프에 없는 노드의 결핍 시작을 적었다',
    expected: 'unknown-node',
    graph: trackerGraph,
    slots: baseSlots(0),
    tick: NOW,
    since: new Map([[deterministicId('dep-node', '없는 노드'), NOW - 10]]),
  },
  {
    broke: '노드의 조건이 세계에 없는 자리를 가리킨다',
    expected: 'unreadable-condition',
    graph: phantomGraph,
    slots: baseSlots(10),
    tick: NOW,
  },
];
