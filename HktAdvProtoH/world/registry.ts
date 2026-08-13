// Cycle Registry — 진행 순서대로 나열한 Cycle 모듈. 배열 순서가 곧 Cycle 순서다.
//
// 새 Cycle 은 여기에 **뒤에 추가**한다. 기존 항목의 순서를 바꾸거나 과거 Cycle 모듈을
// 고치지 않는다 — 과거 Cycle 의 게임을 그대로 재현할 수 있는 근거가 이 append-only 규칙이다.
// 기존 Rule 을 바꿔야 하면 이번 Cycle 모듈에서 같은 actionType / lawId 로 다시 등록한다(CHANGED).

import { C001_STONE_MINING } from './cycles/C001-stone-mining/index';
import type { CycleModule } from './kernel/module';

export const CYCLE_REGISTRY: readonly CycleModule[] = [C001_STONE_MINING];
