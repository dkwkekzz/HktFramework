// Cycle Module — 한 Cycle 이 World 에 더하는 것 전부를 담는 합성 단위.
//
// Cycle 개발은 "코드를 짜고 나중에 Cycle 별로 나누는" 일이 아니다. 처음부터 이 모듈 하나를
// 만드는 일이다. World 는 Scope 안의 모듈을 합성한 결과이지 그 자체로 존재하지 않는다.
//
// 기존 Rule 을 바꿔야 하면(CHANGED) 과거 Cycle 파일을 고치지 않고, 이번 Cycle 모듈에서
// 같은 actionType / lawId 로 다시 등록한다 — 뒤 Cycle 의 등록이 앞 Cycle 을 덮는다.
// 이것이 "C001 까지" 실행이 시간이 지나도 C001 의 게임으로 남는 이유다.

import type { ActionRequest, ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import type { WorldSetup, WorldState } from './state';

/** Projection 조립 중간 형태 — 각 Cycle 이 자기 몫의 필드만 채운다 */
export type GameViewDraft = {
  [K in keyof GameViewSnapshot]?: GameViewSnapshot[K];
};

/** Action 종류별 Rule — actionType 과 run 의 Action 타입이 어긋나면 컴파일되지 않는다 */
export type CycleActionRule = {
  [T in ActionRequest['type']]: {
    /** 이 Rule 이 처리하는 Action 종류 — 뒤 Cycle 이 같은 종류를 등록하면 덮어쓴다(CHANGED) */
    actionType: T;
    /** Rule 의 Semantic Id (Traceability) */
    ruleId: string;
    run(state: WorldState, action: Extract<ActionRequest, { type: T }>): ActionResult;
  };
}[ActionRequest['type']];

export interface CycleSimulationLaw {
  /** 시간 진행 법칙 식별자 — 뒤 Cycle 이 같은 id 로 등록하면 덮어쓴다(CHANGED) */
  lawId: string;
  run(state: WorldState, dt: number): void;
}

export interface CycleModule {
  /** Cycle 식별자 — cycles/<dir> 의 앞 토큰 (예: C001) */
  id: string;
  /** cycles/ · world/cycles/ 아래 디렉터리 이름 */
  dir: string;
  /** Cycle Goal 을 한 줄로 */
  title: string;
  /** 이 Cycle 이 World 에 심는 내용물 — 없으면 이 Cycle 은 세계에 아무것도 두지 않는다 */
  seed?(state: WorldState, setup: WorldSetup): void;
  /** 이 Cycle 이 도입/변경한 Action Rule */
  rules?: readonly CycleActionRule[];
  /** 이 Cycle 이 도입/변경한 시간 진행 법칙 */
  laws?: readonly CycleSimulationLaw[];
  /** 이 Cycle 이 Observer Projection 에 더하는 몫 */
  project?(state: WorldState, draft: GameViewDraft): void;
}
