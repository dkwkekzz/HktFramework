// Semantic Identifier — 이 팩의 Runtime 전이 ↔ 설계 역추적용 식별자 (Traceability).
// Engine 소유 식별자(관찰자 인과·Tick·요청 대답)는 protocol-core 에서 다시 내보낸다.
//
// 식별자는 **도메인 파일**이 소유한다 — 트랙이 자기 파일 끝에만 더하므로 병렬 작업이
// 이 파일을 다투지 않는다 (guides/works.md 병렬 규칙):
//
//   semantic-id-core.ts     공통 — 몸·이동·행동·명령·링크
//   semantic-id-combat.ts   전투 — 타격·기력·막기·앎·지목 (COMBAT 트랙)
//   semantic-id-item.ts     아이템 — 채광·소지·자리·적용·사용 (ITEM 트랙)
//   이 파일                 재수출만. 새 식별자를 여기 더하지 않는다
//
// 소비처는 언제나 이 파일 하나만 import 한다 — 도메인 파일을 직접 import 하지 않는다.

export {
  RULE_OBSERVER_JOIN,
  RULE_OBSERVER_LEAVE,
  RULE_OBSERVER_MARK,
  RULE_REQUEST_REPLY,
  RULE_WORLD_TICK,
  type SemanticIdentifier,
} from '../../../engine/protocol-core/semantic-id';

export * from './semantic-id-core';
export * from './semantic-id-combat';
export * from './semantic-id-item';
