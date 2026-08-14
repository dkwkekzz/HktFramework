// Action Request 경계 타입 — Client 는 상태를 바꾸지 않고 Action 을 요청한다.
// interactionId 는 Snapshot.interactions[].id 를 그대로 회신한다 — Cycle 이
// interaction 을 늘려도 이 구조는 바뀌지 않는다.

export interface ActionRequest {
  interactionId: string;
  position?: { x: number; z: number }; // 지형 대상 interaction 용
  targetEntityId?: string; // entity 대상 interaction 용
  mode?: 'walk' | 'run'; // C007 — 이동 모드 전환. 토글이 아니라 명시값이다
  // C007 R2 — 속성 변경 (디버그 조작의 기반). 무엇을 어떤 값으로 바꿀지가 실린다.
  // 요청일 뿐이다 — 받아들일지는 World Rule 이 정한다 (RULE-ATTRIBUTE-SET-001).
  attribute?: { id: string; value: number | string };
}

export type ActionResult =
  | { status: 'success'; rule: string }
  | { status: 'failure'; rule: string; reason: string };
