// ============================================================================
// 성장 스탯 — 구조 예치(A6-2)를 결정론 흐름 계수로 변환 (A6-3)
//
// 서버·클라 공용 순수 모듈 (Node/DOM API 의존 0 — C++ 이식 대상).
// 핵심: 스탯은 "저장된 숫자" 가 아니라 구조 풀 잔고의 함수다. 레벨업 시 능력을
// 민팅하지 않는다 — 실재하는(원장에 잠긴) 질서의 양을 읽어 이체의 배율·비용을 정한다.
// 결정론 정수 연산만 사용한다.
// ============================================================================

import { UPKEEP_AMOUNT, GROWTH_ATK_DIVISOR, GROWTH_UPKEEP_DIVISOR } from './constants.js';

// 공격 보너스 — 구조가 클수록 데미지 출력↑. 데미지는 여전히 피격자 풀로 클램프되므로
// "무에서 에너지 창조" 가 아니라 인출 상한을 높일 뿐이다.
export function attackBonus(struct) {
  return Math.floor(Math.max(0, struct) / GROWTH_ATK_DIVISOR);
}

// 대사 비용 — 구조(질서)가 클수록 유지 비용↑. 소산 구조의 대가: 큰 몸일수록 더 많은
// 에너지를 지속 갈구해야 질서를 유지한다. 성장은 공짜가 아니다.
export function upkeepFor(struct) {
  return UPKEEP_AMOUNT + Math.floor(Math.max(0, struct) / GROWTH_UPKEEP_DIVISOR);
}

// 스킬 위력 (A6-4) — 스킬 base + 구조 스케일. 데미지는 여전히 피격자 풀로 클램프된다.
export function skillDamage(skill, struct) {
  return skill.base + Math.floor(Math.max(0, struct) / skill.structDiv);
}
