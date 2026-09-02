// Active Content — View 쪽.
//
// 조립(app/)이 소유하는 유일한 View 진입점이다 (경계 규칙 3).
// world 쪽 진입점(active.ts)과 분리한 이유: 클라이언트 조립 루트는 world/ 를
// import 하지 않는다는 물리적 사실을 지키기 위해서다 — 한 파일로 합치면
// 클라이언트 모듈 그래프에 세계 시뮬레이션이 딸려 들어온다.
//
// 컨텐츠의 구성이 바뀌면 이 파일의 재수출 대상만 바꾼다 — engine/ 은 바뀌지 않는다.

export { resolvePresentation, type PresentationOptions } from './view/resolve';
export { codeText } from './view/code-text';
export { commandActionRequest } from './view/command-request';
export { KEY_BINDINGS } from './view/bindings';
export { SPRITE_SHEET } from './view/sprites';
