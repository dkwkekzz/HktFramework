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
  // C009 ADDED — Request.Mark. 이 요청에 관찰자가 붙인 표식.
  // 세계는 이것을 해석하지도 저장하지도 않고 대답에 그대로 되돌린다
  // (INTENT-REPLY-CORRESPONDENCE-001). 연달아 건 요청의 대답을 짚는 수단이다.
  mark?: number;
}

export type ActionResult =
  | { status: 'success'; rule: string }
  | { status: 'failure'; rule: string; reason: string };
