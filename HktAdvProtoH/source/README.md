# Source

실제 게임 런타임 소스가 위치할 자리.

- `world/` — Authoritative World (State / Rule / Command 처리 / Observer Projection)
- `gameview/` — GameView 렌더러 (Observable → Rendering State binding)

## 상태

아직 비어 있다. HktAdvProtoH 는 현재 기획 문서 + Agent 실행 환경만 존재하며,
런타임 기술 스택(웹/엔진)은 **첫 실제 Cycle 의 World Implementation 단계에서** 확정한다.

## 경계 (구현 시 강제할 것)

- `world/` 는 `gameview/` 를 import 하지 않는다. 역방향도 금지 —
  GameView 는 Observable Contract 로만 세계를 본다 (Rule 7).
- World State 변경은 Rule 을 통해서만 (Rule 3). Client 는 Command 만 보낸다 (Rule 4).
