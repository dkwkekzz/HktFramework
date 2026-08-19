// World Semantic — Observer (C004 ADDED)
//
// 세계가 아는 관찰자. 관찰자는 세계 밖의 구경꾼이 아니라 세계가 알고 있는 존재다
// (INTENT-OBSERVER-JOIN-001).
//
//   Id        관찰자가 밝힌 자기 식별. 세계는 참인지 따지지 않고 받아 적는다.
//             한 번 받아 적은 뒤에는 세계의 것이다 — 관찰자가 바꿔 말할 수 없다.
//   ActorId   그 관찰자의 몸. 세계가 정한다 — 관찰자가 고를 수 없다.
//   Present   지금 이 관찰자가 세계를 보고 있는가.
//             거짓이어도 몸은 세계에 남는다 (INTENT-OBSERVER-LEAVE-001).
//
// C005 ADDED
//   AcknowledgedMark  이 관찰자에게서 받아들인 마지막 표식 (INTENT-OBSERVER-MARK-001).
//                     관찰자가 매기지만 무엇을 받아들였는지는 세계가 정한다.
//                     게임 상태가 아니다 — 세계의 물건도 몸도 시간도 이것 때문에
//                     달라지지 않는다. 말하는 것은 하나뿐이다: "너에게서 여기까지 받았다".

export interface ObserverState {
  id: string;
  actorId: string;
  present: boolean;
  acknowledgedMark: number;
}

// Observer.Id 의 한계 길이 — 세계가 받아 적을 수 있는 크기.
// 결정론에 영향을 주지 않지만 세계의 수용 한계이므로 헤더 상수로 고정한다.
export const MAX_OBSERVER_ID_LENGTH = 64;
