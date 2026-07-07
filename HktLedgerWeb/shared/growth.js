// ============================================================================
// 성장 스탯 — 구조 예치(A6-2)를 결정론 흐름 계수로 변환 (A6-3)
//
// 서버·클라 공용 순수 모듈 (Node/DOM API 의존 0 — C++ 이식 대상).
// 핵심: 스탯은 "저장된 숫자" 가 아니라 구조 풀 잔고의 함수다. 레벨업 시 능력을
// 민팅하지 않는다 — 실재하는(원장에 잠긴) 질서의 양을 읽어 이체의 배율·비용을 정한다.
// 결정론 정수 연산만 사용한다.
// ============================================================================

import {
  UPKEEP_AMOUNT, GROWTH_ATK_DIVISOR, GROWTH_META_DIVISOR, GROWTH_UPKEEP_DIVISOR,
  WEAPON_ATK_DIVISOR, CRYSTAL_GATHER_DIVISOR,
} from './constants.js';

// A7-1 구조 분화: 스탯은 조직(organ)별 구조 풀의 함수다. 조직마다 결합하는 흐름 계수가
// 다르므로, 어느 조직을 키우느냐가 곧 빌드다. 아래 함수들은 "그 조직" 의 잔고를 받는다.

// 공격 보너스 — 발산(atk) 조직이 클수록 데미지 출력↑. 데미지는 여전히 피격자 풀로 클램프되므로
// "무에서 에너지 창조" 가 아니라 인출 상한을 높일 뿐이다.
export function attackBonus(atkStruct) {
  return Math.floor(Math.max(0, atkStruct) / GROWTH_ATK_DIVISOR);
}

// 채집 증폭 — 대사(meta) 조직이 클수록 세계에서 끌어오는 양↑. 노드가 제공하므로(Got<Want
// 클램프) 민팅 아님. 결정 아이템 증폭(gatherBonus)과 합산되는 구조적 획득 계수.
export function gatherStructBonus(metaStruct) {
  return Math.floor(Math.max(0, metaStruct) / GROWTH_META_DIVISOR);
}

// 대사 비용 — 총 구조(모든 조직 합)가 클수록 유지 비용↑. 소산 구조의 대가: 큰 몸일수록 더 많은
// 에너지를 지속 갈구해야 질서를 유지한다. 분화는 계수만 가를 뿐 유지비는 총량의 함수다.
export function upkeepFor(totalStruct) {
  return UPKEEP_AMOUNT + Math.floor(Math.max(0, totalStruct) / GROWTH_UPKEEP_DIVISOR);
}

// 스킬 위력 (A6-4) — 스킬 base + 발산(atk) 조직 스케일. 데미지는 여전히 피격자 풀로 클램프된다.
export function skillDamage(skill, atkStruct) {
  return skill.base + Math.floor(Math.max(0, atkStruct) / skill.structDiv);
}

// 아이템 증폭 (A6-5) — 아이템의 현재 잔고를 읽어 스탯을 키운다(민팅 없음).
// 무기: 발산(공격) 증폭 — 마모로 잔고가 줄면 증폭도 준다.
// A9-1 가치 단일화: 위력은 **오직 잔고(에너지)**의 함수다. 재료 종류는 배율에 개입하지 않는다 —
//   금 무기든 돌 무기든 같은 잔고면 같은 위력. "총량이 가치를 결정한다"의 코드 실현(옛 div 제거).
export function weaponBonus(weaponBalance) {
  return Math.floor(Math.max(0, weaponBalance) / WEAPON_ATK_DIVISOR);
}
// 결정: 획득(채집) 증폭 — 소지한 결정의 잔고가 세계에서 끌어오는 양을 키운다. 종류 무관·잔고만.
export function gatherBonus(crystalBalance) {
  return Math.floor(Math.max(0, crystalBalance) / CRYSTAL_GATHER_DIVISOR);
}
