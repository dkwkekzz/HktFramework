// Active Content — 조립이 컨텐츠(content/world/)를 부르는 자리.
//
// 조립(app/·server/)이 소유하는 **유일한** 컨텐츠 진입점이다 (경계 규칙 3).
// 컨텐츠의 구성이 바뀌면 이 파일의 재수출 대상만 바꾼다 — engine/ 은 바뀌지 않는다.
// Engine 은 이 파일을 모른다.

export {
  createWorld,
  restoreWorld,
  type NpcSetup,
  type World,
  type WorldSetup,
} from './world/index';
export {
  TICK_INTERVAL,
  type WorldState,
} from './world/semantic/world-state';
