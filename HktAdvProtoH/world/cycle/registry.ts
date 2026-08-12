// Cycle Registry — 각 Cycle 이 현재 World 에 무엇을 더했는지의 단일 출처.
//
// 현재 world/ 는 모든 Cycle 의 누적 결과다(원칙 9). 이 표는 그 누적물을 Cycle 별로 되돌려
// "C001 시점의 게임" 처럼 특정 Cycle 까지만 굴릴 수 있게 한다 — 과거 Cycle 의 Regression Play 수단.
//
// 새 Cycle 이 Rule 을 추가하면 반드시 여기에 등록한다. 등록되지 않은 Rule 은 어떤 Scope 에서도
// 실행되지 않는다(등록 누락을 조용히 넘기지 않는다).

import { RULE_MINE, RULE_MOVE, RULE_MOVE_PROGRESS } from '../../protocol/semantic-id';

export type CycleId = string;

export interface CycleEntry {
  /** Cycle 식별자 — cycles/<dir> 의 앞 토큰 (예: C001) */
  id: CycleId;
  /** cycles/ 아래 Artifact 디렉터리 이름 */
  dir: string;
  /** Cycle Goal 을 한 줄로 */
  title: string;
  /** 이 Cycle 이 도입한 World Rule 의 Semantic Id */
  rules: readonly string[];
}

/** 진행 순서대로 나열한다 — 배열 순서가 Cycle 순서다. */
export const CYCLE_REGISTRY: readonly CycleEntry[] = [
  {
    id: 'C001',
    dir: 'C001-stone-mining',
    title: 'Stone Mining — 곡괭이로 광맥에서 Stone 채굴',
    rules: [RULE_MOVE, RULE_MOVE_PROGRESS, RULE_MINE],
  },
];
