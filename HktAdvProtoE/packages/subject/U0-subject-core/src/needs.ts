import type { NeedSpec, TemperamentSpec } from './types.js';

/**
 * 욕구 책 — U0 이 소유하는 **콘텐츠 데이터**.
 *
 * ## 왜 코드가 아니라 데이터인가
 *
 * "배고픔은 생존을 중히 여기는 자에게 더 크게 들린다"는 세계의 성질이지 계산기의 성질이 아니다.
 * 이것을 `if (values.survival > 0.5) score += 2` 로 적으면 세계마다 코드를 고쳐야 하고, AI 가
 * 새 욕구를 제안할 수도 없다(원문 「23」 — 임의 실행 코드를 콘텐츠 데이터에 삽입 금지).
 *
 * 자리로 보면 이것은 세계 설계 원본 10장 `PossibilityNode.activationWeights` 다. U0 에는 아직
 * 가능성 노드가 없으므로(G 페이즈) **욕구 자체가 그 무게를 든다**. G1 이 노드를 세우면 이 무게는
 * 노드로 옮겨 가고, U0 은 N(욕구 긴급도)만 내주는 자리로 얇아진다.
 *
 * ## 아래 세 욕구는 예시다
 *
 * 원문 「11」 U0 은 어떤 욕구가 있어야 하는지 정하지 않는다. 정하는 것은 콘텐츠이고, U0 이
 * 보장하는 것은 **어떤 욕구든 같은 방식으로 재어진다**는 것뿐이다. `U0Input.needBook` 으로
 * 통째로 갈아 끼울 수 있다.
 */
export const SUBJECT_NEEDS: NeedSpec[] = [
  {
    id: 'hunger',
    title: '끼니',
    valueWeights: {
      // 살아남는 것을 중히 여기면 배고픔이 크게 들린다.
      survival: 2,
      // 맡은 자리를 중히 여기면 배고픔은 뒤로 밀린다.
      duty: -0.5,
      // 절제는 배고픔을 참게 한다.
      temperance: -1.5,
    },
    traitWeights: { impulsive: 1.5, patient: -1.5 },
    capabilityIds: ['forage'],
    resourceIds: ['provision'],
  },
  {
    id: 'duty',
    title: '맡은 자리',
    valueWeights: { duty: 3, survival: -0.5 },
    traitWeights: { patient: 1, impulsive: -1 },
    capabilityIds: ['stand_watch'],
    resourceIds: [],
  },
  {
    id: 'safety',
    title: '몸 지키기',
    valueWeights: { survival: 2, duty: -1 },
    traitWeights: { cautious: 2, impulsive: -1 },
    capabilityIds: ['fight'],
    resourceIds: ['salve'],
  },
];

/**
 * 기질 — 선택의 온도 (세계 설계 원본 9장).
 *
 * ```text
 * 충동적인 주체는 Temperature 가 높다.
 * 엄격하고 일관적인 주체는 낮다.
 * 공포나 혼란은 일시적으로 높일 수 있다.
 * ```
 *
 * 온도는 순위를 바꾸지 않는다. 순위 사이의 **간격을 얼마나 크게 느끼는가**를 바꾼다.
 * 그래서 이 값이 결정하는 것은 "무엇이 1위인가"가 아니라 "1위가 얼마나 확고한가"다.
 * 실제로 뽑는 일은 G3 의 몫이므로 U0 은 확률을 내보이기만 한다.
 */
export const TEMPERAMENT: TemperamentSpec = {
  base: 1,
  traitWeights: { impulsive: 2, patient: -0.5 },
  emotionWeights: { fear: 1.5, despair: 1.5 },
  // 0 이면 나눗셈이 무너진다. 아무리 엄격해도 완전한 확신은 없다.
  floor: 0.25,
};

/** 욕구 id 오름차순 — 계약과 화면이 같은 목록을 본다. */
export const SUBJECT_NEED_IDS: string[] = SUBJECT_NEEDS.map((need) => need.id).sort();
