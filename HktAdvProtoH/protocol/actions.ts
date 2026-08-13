// Action Request 경계 타입 — Client 는 상태를 바꾸지 않고 Action 을 요청한다.
// interactionId 는 Snapshot.interactions[].id 를 그대로 회신한다 — Cycle 이
// interaction 을 늘려도 이 구조는 바뀌지 않는다.

export interface ActionRequest {
  interactionId: string;
  position?: { x: number; z: number }; // 지형 대상 interaction 용
  targetEntityId?: string; // entity 대상 interaction 용
}

export type ActionResult =
  | { status: 'success'; rule: string }
  | { status: 'failure'; rule: string; reason: string };
