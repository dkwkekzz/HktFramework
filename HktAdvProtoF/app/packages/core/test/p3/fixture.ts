// P3 단위 테스트가 함께 쓰는 최소 세계와 문법.
//
// 굴짐승 하나가 굴에 서 있고, 창고에 열매가 있고, 이웃 하나와 사이가 적혀 있다.
// P3 는 이 세계가 **어떻게 세워졌는지**를 묻지 않고, 이 주체가 무엇을 딛고 서는지만 본다.
import { deterministicId, type Id } from '../../src/v1/index.ts';
import type { State } from '../../src/o1/index.ts';
import { assembleWorld, type WorldState } from '../../src/o2/index.ts';
import { buildGrammar, type AbilityGrant, type AtomBan } from '../../src/p2/index.ts';

import { beast, berryId, denId } from '../d2/fixture.ts';
import { drawId, plain } from '../d3/fixture.ts';

export { beast, berryId, denId, drawId, plain };

/** 이웃 — 사이가 적힌 상대. */
export const neighborId: Id = deterministicId('subject', 'creature', '굴짐승 07');
/** 아무도 보지 못한 골짜기의 열매 — 세계에는 있지만 근거에는 없다. */
export const hiddenBerryId: Id = deterministicId('entity', 'resource', '골짜기 열매');

const state = (
  domain: State['domain'],
  ofId: Id,
  path: string,
  value: State['value'],
): State => ({
  kind: 'State',
  id: deterministicId('state', ofId, `${domain}.${path}`),
  domain,
  ofId,
  path,
  value,
});

/** 굴짐승 01 의 지금. 창고 재고를 바꿔 가며 세운다. */
export function worldAt(stock: number): WorldState {
  return assembleWorld([
    state('biological', plain.id, 'hunger', 0.6),
    state('biological', plain.id, 'vitality', 0.7),
    state('physical', plain.id, 'region', denId),
    state('economic', plain.id, `stock.${berryId}`, stock),
    state('economic', plain.id, `stock.${hiddenBerryId}`, 0),
    // 대상들도 세계에 제 자리를 갖는다 — 그래야 "본다" 가 가리킬 자리가 있다.
    state('physical', berryId, 'integrity', 0.8),
    state('physical', denId, 'cover', 0.6),
    state('physical', hiddenBerryId, 'integrity', 0.9),
    // 사이는 손으로 주지 않는다 — 세계에 적힌 이 자리들이 곧 관계다.
    state('relational', plain.id, `trust.${neighborId}`, 0.4),
    state('relational', plain.id, `debt.${neighborId}`, 12),
    state('biological', neighborId, 'hunger', 0.2),
  ]).world;
}

export const grants: readonly AbilityGrant[] = [
  { abilityId: drawId, atoms: ['protect', 'conceal'], note: '의념 흡수는 굴을 덮는 데 쓰인다' },
];

/** 능력 없는 맨몸 문법. */
export const bareGrammar = buildGrammar({ archetype: beast, capabilities: [] });

/** 능력이 실린 문법 — 지키기·은폐를 의념으로 낸다. */
export const keeperGrammar = buildGrammar({
  archetype: beast,
  capabilities: [drawId],
  grants,
});

/** 능력이 유형에 막혀 아무것도 못 싣는 배정 — 짐승은 합의로 서는 원자를 못 낸다. */
export const voidGrants: readonly AbilityGrant[] = [
  { abilityId: drawId, atoms: ['ally', 'exchange'], note: '짐승에게는 열리지 않는 자리다' },
];

export const noBans: readonly AtomBan[] = [];
