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
// 땅 — 관찰자가 자기 Description 을 컴파일해 그린다 (C005). 봉투로 오지 않는다.
export { TERRAIN_PALETTE, regionTerrain } from './view/terrain-presentation';
// 방이 지금 말하는 한 마디 (C008) — 장면(SceneState)에는 잠깐 뜨는 문구를 담을 자리가 없어
// 조립이 기반의 notice 로 띄운다. **무엇을 언제 말할지는 여기(컨텐츠)가 정한다** — 조립은
// 값이 있으면 띄우고 없으면 아무 일도 하지 않는다 (조립은 컨텐츠의 속을 알지 못한다).
export { regionNotice } from './view/region-presentation';
// 방에 들어선 순간 한 번 지나가는 제목 (C026 R4) — 지면에서 걷어낸 이름표가 간 자리다.
// regionNotice 와 같은 어법이다: 무엇을 언제 말할지는 컨텐츠가 정하고 조립은 띄우기만 한다.
export { regionEntryTitle } from './view/region-presentation';
// 클릭 하나가 무슨 뜻인가 (C026 R3) — 기반은 집기(pick)까지만 하고 스스로 요청을 만들지 않는다.
// 조립이 이 정책을 기반에 주입한다 (SPEC-007 경계).
export { pointerRules, type Designation, type PointerOutcome } from './view/pointer-rules';
// 세계가 나에게 한 말을 모아 두는 그릇 (C028) — **모으는 것은 조립**이고, 몇 줄까지
// 남기는지도 무슨 말을 남기는지도 컨텐츠가 정한다. 판에 어떻게 서는지는 resolve 가 읽는다.
export { ANSWER_LOG_LIMIT, type KeptAnswer } from './view/answer-log';
