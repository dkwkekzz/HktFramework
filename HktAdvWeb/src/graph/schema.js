// =====================================================================
// 그래프 스키마 — GoalNode(§4.4)/Stage(§4.5) 필드 규칙 (step B1)
// ---------------------------------------------------------------------
// 필수/선택 규칙과 17 동사·발견 상태 어휘의 정본. loader.js 가 이 표로 검사한다.
// (Design-StepPlan §4 B1)
// =====================================================================

// §4.3 — 네 가족, 열일곱 동사.
export const VERBS = new Set([
  // 인식
  '탐색', '관찰', '비교', '실험', '검증',
  // 수급
  '채취', '포획', '운반', '보존',
  // 변환
  '분해', '정제', '변환', '결합', '조율',
  // 세력
  '전투', '보호', '협상',
]);

// §2.5 — 발견 상태 4값.
export const EPISTEMIC_STATES = new Set(['미발견', '추정', '확인', '반증']);

// 모든 노드가 갖춰야 하는 필수 필드 (스텁도 완전한 스키마 — §9.1).
export const GOAL_REQUIRED = ['id', 'title', 'desired', 'current', 'done_when', 'epistemic'];

// 노드의 선택 필드 (알 수 없는 필드는 경고 대상).
export const GOAL_OPTIONAL = [
  'serves', 'demand', 'obstacles', 'verb', 'alternatives', 'evidence',
  'aftermath', 'stages', 'tags',
];

export const STAGE_REQUIRED = ['id', 'source', 'supplies'];
export const STAGE_OPTIONAL = ['obstacles', 'interactions', 'choices', 'outcomes', 'discovered'];

export function isKnownGoalField(name) {
  return GOAL_REQUIRED.includes(name) || GOAL_OPTIONAL.includes(name);
}

export function isKnownStageField(name) {
  return STAGE_REQUIRED.includes(name) || STAGE_OPTIONAL.includes(name);
}
