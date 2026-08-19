// Active Pack — 어느 컨텐츠 팩을 띄우는가.
//
// 조립(app/·server/)이 소유하는 **유일한** 선택 지점이다 (boundary 규칙 4).
// 팩을 바꾸려면 이 파일의 재수출 대상만 바꾼다 — engine/ 은 바뀌지 않는다.
// Engine 은 이 파일을 모르고, 팩들은 서로를 모른다.

export {
  createWorld,
  type NpcSetup,
  type World,
  type WorldSetup,
} from './proto-adventure/world/index';
export { TICK_INTERVAL } from './proto-adventure/world/base/world-state';
