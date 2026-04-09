*** HktRuntime 리펙토링: Rule, Component, Actor ***
아키텍처 구조
- 룰에서는 인터페이스를 이용한 흐름에 집중한다. 
- 컴포넌트는 인터페이스 구현에 집중한다. 
- 액터는 이벤트 발행에 집중한다.( 인터페이스를 액터가 직접 구현하면 안됨. )

아키텍처 원칙 적용
계층   역할   적용
Rule   인터페이스를 이용한 흐름    IHktServerRule / IHktClientRule가 모든 로직 결정
Component     인터페이스 구현      각 컴포넌트가 Rule에서 요구하는 인터페이스를 구현
Actor  이벤트 발행만        GameMode/PlayerController는 이벤트를 Rule에 위임만 함

서버 (AHktGameMode → IHktServerRule)
InitGame()   → Rule->BindContext(Frame, Graph, DB, Builder)  [item 2: 컨텍스트 바인딩]
Tick()       → Rule->OnEvent_GameModeTick(DeltaTime) → FHktEventGameModeTickResult
PostLogin()  → Rule->OnEvent_GameModePostLogin(WorldPlayer)
Logout()     → Rule->OnEvent_GameModeLogout(WorldPlayer)
PushIntent() → Rule->OnReceived_FireIntentEvent(Event, WorldPlayer)

클라이언트 (AHktInGamePlayerController → IHktClientRule)
OnSubjectAction → Rule->OnUserEvent_SubjectInputAction(Policy, Builder)
OnSlotAction    → Rule->OnUserEvent_CommandInputAction(Container, Slot, Builder)
OnTargetAction  → Rule