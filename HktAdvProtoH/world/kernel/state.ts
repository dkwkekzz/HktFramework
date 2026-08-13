// World State 컨테이너 — 커널은 State 의 *내용*을 모른다.
//
// 각 Cycle 모듈이 자기가 도입한 State 조각을 선언 병합(declare module)으로 더한다.
// 그래서 "어떤 State 를 어느 Cycle 이 소유하는가" 가 주석이 아니라 타입 위치로 드러난다.
//
// 불변식: Cycle Scope 는 항상 진행 순서의 **접두사**다. 따라서 이후 Cycle 은 이전 Cycle 의
// State 조각이 반드시 존재한다고 가정해도 되고, 이전 Cycle 은 이후 조각을 읽지 않는다.

export interface WorldState {}

/** createWorld 설정 — 커널 몫만 여기 있고, Cycle 별 설정은 각 모듈이 병합한다 */
export interface WorldSetup {
  /** 어느 Cycle 까지의 게임을 굴릴 것인가 — 미지정이면 최신 Cycle(현재 게임) */
  upToCycle?: string | null;
}
