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
// 겹침 표면의 열림 상태 (기반 capability 의 Escape·✕ 가 조립을 거쳐 닫기를 부른다).
// 무엇이 열려 있는가는 결정 Layer 가 쥔다 — 기반은 그리는 능력만 가진다 (반전 ⑤).
export { closeSurface, surfaceIsOpen, toggleSurface } from './proto-adventure/view/surface-state';
export { SPRITE_SHEET } from './proto-adventure/view/sprites';
// 이펙트 (F1) — 어떤 이펙트를 화면에 올릴지(예산)와, 사건을 읽기 위해 기억해 둘 것.
export {
  EFFECT_SET,
  EMPTY_EFFECT_MEMORY,
  rememberForEffects,
  type EffectMemory,
} from './proto-adventure/view/effect-presentation';
