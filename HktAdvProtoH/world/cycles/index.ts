// Cycle Module 등록부 — 등록 순서가 곧 게임의 역사다.
// 새 Cycle 은 모듈을 만들어 이 배열 끝에 추가한다.
// createWorld({ upToCycle }) 은 이 순서의 앞부분만 조립해 그 시점의 게임을 재생한다.

import type { CycleModule } from '../kernel/cycle-module';
import { c001StoneMining } from './c001-stone-mining';

export const CYCLE_MODULES: CycleModule[] = [c001StoneMining];

export const CYCLE_IDS = CYCLE_MODULES.map((m) => m.id);
