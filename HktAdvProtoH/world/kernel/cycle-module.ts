// Cycle Module — 한 Cycle 이 공유 World 에 더하는 Delta 의 선언 단위.
//
// 각 Cycle 은 별도의 World 를 만들지 않는다 — 하나의 공유 WorldState 위에
// 자신의 초기 세팅·Action 핸들러·시간 법칙·Projection 기여분을 등록한다.
// 커널이 등록 순서대로 모듈을 조립하므로, 앞에서 자르면
// "특정 Cycle 까지의 게임"을 그대로 재생할 수 있다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import type { WorldState } from '../semantic/world-state';

// 테스트·재현용 초기 상태 오버라이드 (각 모듈이 자기 몫만 해석한다)
export interface WorldSetupOptions {
  actorPosition?: { x: number; z: number };
  actorItems?: Partial<Record<'stone' | 'pickaxe', number>>;
  depositPosition?: { x: number; z: number };
  depositAmount?: number;
}

export interface CycleModule {
  id: string; // Cycle ID (예: 'C001-stone-mining')

  /** 이 Cycle 이 세계에 더하는 초기 내용 (Actor 장비·Deposit 배치 등) */
  setup(state: WorldState, options: WorldSetupOptions): void;

  /** interactionId → World Rule 위임 (뒤 Cycle 이 같은 id 를 등록하면 override) */
  actions: Record<string, (state: WorldState, action: ActionRequest) => ActionResult>;

  /** 시간 진행 법칙 (RULE-*-PROGRESS 류) */
  laws: Array<(state: WorldState, dt: number) => void>;

  /** 이 Cycle 의 Observable 을 Snapshot 에 더한다 (semantic 만 — 표현 결정 금지) */
  project(state: WorldState, snapshot: GameViewSnapshot): void;
}
