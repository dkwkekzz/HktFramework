// Semantic Identifier — 이 팩의 Runtime 전이 ↔ 설계 역추적용 식별자 (Traceability).
// Engine 소유 식별자(관찰자 인과·Tick·요청 대답)는 protocol-core 에서 다시 내보낸다.
//
// 소비처는 언제나 이 파일 하나만 import 한다.

export {
  RULE_OBSERVER_JOIN,
  RULE_OBSERVER_LEAVE,
  RULE_OBSERVER_MARK,
  RULE_REQUEST_REPLY,
  RULE_WORLD_TICK,
  type SemanticIdentifier,
} from '../../engine/protocol-core/semantic-id';

export * from './semantic-id-core';
