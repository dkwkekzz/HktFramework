// Action Request 경계 타입 — Client 는 상태를 바꾸지 않고 Action 을 요청한다.

export type ActionRequest =
  | { type: 'move'; target: { x: number; z: number } }
  | { type: 'mine'; depositId: string };

export type ActionResult =
  | { status: 'success'; rule: string }
  | { status: 'failure'; rule: string; reason: string };
