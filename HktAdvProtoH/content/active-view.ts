// Active Pack — View 쪽 (P3 ADDED).
//
// 조립(app/)이 소유하는 유일한 View 팩 선택 지점이다 (boundary 규칙 4).
// world 쪽 포인터(active.ts)와 분리한 이유: 클라이언트 조립 루트는 world/ 를
// import 하지 않는다는 물리적 사실(C003)을 지키기 위해서다 — 한 파일로 합치면
// 클라이언트 모듈 그래프에 세계 시뮬레이션이 딸려 들어온다.
//
// 팩을 바꾸려면 이 파일의 재수출 대상만 바꾼다 — engine/ 은 바뀌지 않는다.

export { resolvePresentation, type PresentationOptions } from './proto-adventure/view/resolve';
export { codeText } from './proto-adventure/view/code-text';
export { commandActionRequest } from './proto-adventure/view/command-request';
export { KEY_BINDINGS } from './proto-adventure/view/bindings';
export { SPRITE_SHEET } from './proto-adventure/view/sprites';
