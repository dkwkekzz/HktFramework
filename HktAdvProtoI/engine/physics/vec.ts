// Sim Lib — 지면 평면(x, z) 벡터 기계장치 (P6 ADDED).
//
// physics 은 **세계관이 아닌 기본 세계의 규칙**을 담는 순수 함수 도구상자다.
// 커널 파이프라인의 단계가 아니다 — 팩의 시스템이 골라서 조합해 부른다.
// 여기에는 게임 명사도 튜닝 수치도 없다. 수치(강성·마찰·충격량)는 그 세계의
// 결정론 상수이므로 팩이 소유하고 인자로 넘긴다.

export interface Vec2 {
  x: number;
  z: number;
}

// 중심이 완전히 일치했을 때의 방향 판정 한계 (결정론 — 0 나눗셈 방지)
export const CENTER_EPSILON = 1e-9;

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** 단위 벡터. 길이가 CENTER_EPSILON 미만이면 방향이 없다 — null */
export function normalized(dx: number, dz: number): Vec2 | null {
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < CENTER_EPSILON) return null;
  return { x: dx / len, z: dz / len };
}

/**
 * 단위 벡터 — 중심 일치 시 +x 고정 방향 (결정론).
 * "겹친 두 몸의 중심이 완전히 같아도 밀리는 방향은 정해져 있다" 를 위한 것이다.
 */
export function normalizedOrFixed(dx: number, dz: number): Vec2 {
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len > CENTER_EPSILON) return { x: dx / len, z: dz / len };
  return { x: 1, z: 0 };
}
