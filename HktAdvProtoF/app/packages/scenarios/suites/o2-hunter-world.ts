// O2 검증 장면 — O1 의 "붉은 장막 사냥꾼" 한 컷을 9영역 세계 트리로 세운다.
//
// O1 장면은 그 컷에 무엇이 **있는지**(12타입) 를 적었다. 여기서는 그 존재들이 지금
// 어떤 값에 있는지를 9영역 전부에 걸쳐 적는다 — 사냥꾼은 배고프고(생물) 둥지에 있으며(물리),
// 행상을 못 믿고 빚이 있고(관계), 통행권이 없고(제도), 약초 재고가 둘이며(경제),
// 약초가 치유된다고 잘못 알고 있고(정보), 의념 에너지가 남아 있고(의념),
// 이 둥지에는 "붉은 장막의 어미" 라는 신의 신역이 걸려 있다(초월). 둥지 자체는
// 개체군과 고갈도를 갖는다(생태).
//
// O1 이 만든 상태 원소(hunger·toxin)를 **그대로** 가져다 쓴다 — 두 모듈이 어긋나지
// 않았다는 것을 장면 자체가 증명해야 하기 때문이다.

import { deterministicId, type Id } from '@hkt/core/v1';
import type { State } from '@hkt/core/o1';
import { slotStateId, type StateDomain } from '@hkt/core/o2';

import {
  healingClaim,
  herbId,
  hunger,
  hunterId,
  merchantId,
  nestId,
  toxin,
  toxinRule,
} from './o1-hunter-scene.ts';

export { healingClaim, herbId, hunger, hunterId, merchantId, nestId, toxin, toxinRule };

/** 장면에 새로 드는 존재 둘 — 신과 아랫마을. */
export const motherGodId: Id = deterministicId('subject', 'god', '붉은 장막의 어미');
export const villageId: Id = deterministicId('entity', 'place', '아랫마을');

/** 자리 하나를 State 원소로 — ID 는 O2-c 가 정한 유래 규칙을 따른다. */
function slot(domain: StateDomain, ofId: Id, path: string, value: State['value']): State {
  return { kind: 'State', id: slotStateId(domain, ofId, path), domain, ofId, path, value };
}

/** 9영역을 모두 채운 세계 — O1 장면의 상태 둘(hunger·toxin)을 그대로 품는다. */
export const HUNTER_WORLD: readonly State[] = [
  // 물리 — 어디에 있고 어떤 모양인가 (spatial 흡수분: 장소 간 거리)
  slot('physical', hunterId, 'region', nestId),
  slot('physical', hunterId, 'speed', 3),
  slot('physical', nestId, 'cover', 0.9),
  slot('physical', nestId, `distance.${villageId}`, 4200),

  // 생물 — O1 장면이 이미 적어 둔 두 값을 그대로 쓴다
  hunger,
  toxin,
  slot('biological', hunterId, 'vitality', 0.55),
  slot('biological', herbId, 'toxicity', 0.8),
  slot('biological', herbId, 'growthStage', '성체'),

  // 생태 — 둥지가 몇 마리를 먹여 살리는가
  slot('ecological', nestId, 'population', 40),
  slot('ecological', nestId, 'carryingCapacity', 60),
  slot('ecological', nestId, 'depletion', 0.35),

  // 관계 — 행상을 못 믿지만 빚이 있다
  slot('relational', hunterId, `trust.${merchantId}`, -0.4),
  slot('relational', hunterId, `debt.${merchantId}`, 12),
  slot('relational', hunterId, `fear.${motherGodId}`, 0.65),

  // 제도 — 둥지에 들어갈 권리가 없다
  slot('institutional', hunterId, `passage.${nestId}`, false),
  slot('institutional', hunterId, `contraband.${herbId}`, true),
  slot('institutional', hunterId, 'bounty', 0),

  // 경제 — 약초 둘, 아랫마을 시세 여섯
  slot('economic', hunterId, `stock.${herbId}`, 2),
  slot('economic', villageId, `price.${herbId}`, 6),
  slot('economic', villageId, `demand.${herbId}`, 0.7),

  // 정보 — 잘못 알고 있다. 세계는 그 주장이 거짓임을 안다
  slot('informational', hunterId, `knows.${healingClaim.id}`, true),
  slot('informational', hunterId, `certainty.${healingClaim.id}`, 0.9),
  slot('informational', hunterId, `sourceOf.${healingClaim.id}`, merchantId),
  slot('informational', villageId, `falsehood.${healingClaim.id}`, true),
  slot('informational', villageId, `rumorSpread.${healingClaim.id}`, 0.2),

  // 의념 — 능력은 흔적을 남긴다 (O0 공리)
  slot('psychic', hunterId, 'energy', 120),
  slot('psychic', hunterId, 'conviction', 0.6),
  slot('psychic', nestId, `trace.${toxinRule.id}`, 0.2),

  // 초월 — 둥지에 어미의 신역이 걸려 있다
  slot('transcendent', motherGodId, 'anchor', nestId),
  slot('transcendent', motherGodId, `divineDomain.${nestId}`, 0.8),
  slot('transcendent', motherGodId, 'legitimacy', 0.5),
];

/**
 * 세 틱 뒤 — 굶주림이 오르고, 체력이 떨어지고, 약초를 하나 먹었고,
 * 행상에게 진 빚이 사라졌고, 새 자리(둥지 온도)가 생겼다.
 * 전후 비교 화면이 이 두 세계를 나란히 놓는다.
 */
export const HUNTER_WORLD_LATER: readonly State[] = [
  ...HUNTER_WORLD.filter(
    (state) =>
      !(state.domain === 'biological' && state.ofId === hunterId) &&
      !(state.domain === 'economic' && state.ofId === hunterId) &&
      !(state.domain === 'relational' && state.path === `debt.${merchantId}`),
  ),
  slot('biological', hunterId, 'hunger', 0.45),
  slot('biological', hunterId, 'vitality', 0.5),
  slot('economic', hunterId, `stock.${herbId}`, 1),
  slot('physical', nestId, 'temperature', 11.5),
];

/** 스키마를 어긴 상태 하나와, 걸려야 할 사유. */
export interface OffSchemaState {
  /** 무엇을 어겼는가 */
  readonly broke: string;
  /** 걸려야 할 사유 */
  readonly expected: string;
  readonly value: State;
}

/**
 * 결함 상태 9종 — O2 가 거부하는 사유를 하나씩 짚는다.
 * 전부 **O1 로서는 온전한 State** 다. O1 이 통과시킨 값이 O2 에서 걸린다는 것이 요점이다.
 */
export const OFF_SCHEMA_STATES: readonly OffSchemaState[] = [
  {
    broke: '9영역에 없는 영역 (spatial)',
    expected: 'unknown-domain',
    value: slot('spatial' as StateDomain, hunterId, 'position.x', 12),
  },
  {
    broke: '선언되지 않은 자리 (hungry)',
    expected: 'unknown-path',
    value: slot('biological', hunterId, 'hungry', 0.7),
  },
  {
    broke: '매개 자리에 사물을 넣었다 (사물을 신뢰)',
    expected: 'bad-parameter',
    value: slot('relational', hunterId, `trust.${herbId}`, 0.5),
  },
  {
    broke: '매개 자리에 손으로 지은 이름',
    expected: 'bad-parameter',
    value: slot('economic', hunterId, 'stock.붉은장막', 2),
  },
  {
    broke: '사물이 배고파한다',
    expected: 'bad-holder',
    value: slot('biological', herbId, 'hunger', 0.3),
  },
  {
    broke: '비율 자리에 문자열',
    expected: 'bad-value-type',
    value: slot('biological', hunterId, 'vitality', '튼튼함'),
  },
  {
    broke: '비율이 1 을 넘는다',
    expected: 'out-of-range',
    value: slot('psychic', hunterId, 'conviction', 1.2),
  },
  {
    broke: '선택지에 없는 독',
    expected: 'not-an-option',
    value: slot('biological', herbId, 'toxin', '용암독'),
  },
  {
    broke: '장소 자리에 사람을 가리켰다',
    expected: 'bad-reference',
    value: slot('physical', hunterId, 'region', merchantId),
  },
];
