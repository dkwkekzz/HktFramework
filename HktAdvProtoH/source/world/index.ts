// World 공개 표면 — Integration 은 이 표면만 사용한다.
// GameView 는 이 모듈을 import 할 수 없다 (Rule 7·8 — Observable 로만 소비).
export { AuthoritativeWorld, type WorldConfig } from './authority';
export type { Command, MoveCommand, MineCommand } from './commands';
export {
  projectPlayer,
  projectDesigner,
  type PlayerObservable,
  type DesignerObservable,
} from './projection';
export type { ActorState, DepositState, TransitionRecord } from './types';
export * as WorldConstants from './constants';
