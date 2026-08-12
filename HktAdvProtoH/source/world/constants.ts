// 시뮬레이션 상수 — 결정론에 영향을 주므로 헤더 상수로 고정 (CVar 예외 규칙)
// cycles/C002/artifacts/world-design/world_state.yaml 의 constants 대응.

export const INTERACTION_RANGE = 1.8; // 상호작용 허용 거리
export const MOVE_SPEED = 0.085; // 한 tick 최대 이동 거리 (60tps 기준 ≈ 5.1/s)
export const EXTRACT_AMOUNT = 1; // Mine 1회당 추출량
export const MINE_DURATION_TICKS = 45; // CurrentAction=Mine 유지 tick (≈0.75s)
