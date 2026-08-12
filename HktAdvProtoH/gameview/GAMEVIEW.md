# GAMEVIEW.md — GameView 트랙 척추

GameView 트랙의 규칙 권위 문서. 설계 원문은 [../design/Design-GameView.md](../design/Design-GameView.md) 이며, 이 문서는 그 설계를 **운영 규칙**으로 고정한 것이다. 충돌 시 Design-GameView.md 가 우선한다.

## 1. 트랙 정의

GameView 는 Observable World State 를 사람이 게임 형태로 관찰할 수 있게 하는 **범용 Visual Language Runtime** 이다.

- Cycle 트랙(세계 구현)과 **완전히 직교**한다. Cycle 이 하나 완성될 때 GameView 가 변하는 것이 아니다.
- GameView 는 자체 로드맵(v0 Vocabulary)과 승인된 Capability Proposal 만으로 성장한다.
- Cycle 트랙과의 유일한 인터페이스는 **3개의 경계 산출물**이다:

```text
gameview → cycle : VOCABULARY.md   (공개된 시각 어휘 — 읽기 전용 계약)
cycle → gameview : proposals/      (Capability Proposal — 유일한 요청 채널)
cycle 내부       : cycles/<id>/VIEW.md (View Definition — 어휘에 Observable 을 binding)
```

## 2. 기술 스택 (초기 고정)

```text
Web (브라우저)
three.js + Vite
3D Terrain (Mesh)
2D Sprite Billboard (Camera facing)
Primitive Shapes / Text / Line
```

Rendering Backend 는 gameview 내부에 은닉한다. 소비자(Cycle 의 Playable Assembly)는 backend 를 모르고 Vocabulary 로 선언된 API 만 사용한다.

## 3. Layer 구조와 소유권

```text
View Definition        ← Cycle 트랙 소유 (cycles/<id>/VIEW.md + binding 코드)
──────────────────────  ← 트랙 경계 (VOCABULARY.md 가 계약)
Visual Library         ← GameView 트랙 소유
Visual Primitive API   ← GameView 트랙 소유
Rendering Backend      ← GameView 트랙 소유
```

변화 속도: Backend 거의 불변 · Primitive 매우 느림 · Library 는 Proposal 승인에 따라 성장 · View Definition 은 Cycle 마다 생성.

## 4. Author 금지선 (GameView 가 하지 않는 것)

1. **World Semantic 이름 금지** — `HPBar`·`MiningProgress`·`WolfRenderer` 불가. `ValueBar`·`ProgressIndicator` 처럼 일반화한다.
2. **World Rule 판단 금지** — 거리·조건 판정으로 시각 효과를 스스로 결정하지 않는다. 이미 발생한 Transition 통지를 받아 표현만 한다.
3. **World 코드 읽기 금지** — `world/`·`cycles/`(proposals 제외)·세계 설계 문서를 읽지 않는다. 인터페이스는 VOCABULARY.md 와 Proposal 뿐이다.
4. **Asset 경로를 의미로 취급 금지** — sprite 선택은 Visual Catalog key 로만 받는다. World 의미 → asset 매핑은 View Definition 책임.

## 5. 성장 규칙

새 표현 요구는 반드시 다음 사다리를 따른다 (Design-GameView §19).

```text
① 기존 Visual Component 로 가능한가
② 기존 Primitive 조합으로 가능한가
③ 재사용 가능한 새 Visual Component (Local Composition 반복 시 승격 — §24)
④ Generic Primitive / Capability 확장 (Proposal 승인 필요)
⑤ Renderer Plugin (Proposal 승인 필요, 역시 범용 capability 만)
```

①②는 Cycle 트랙이 View Definition 안에서 스스로 해결한다 — GameView 작업이 아니다.
③④⑤만 Proposal 을 통해 GameView 트랙으로 넘어온다.

## 6. Proposal 처리

- 수신함: [proposals/](proposals/) — Cycle 트랙이 `GVP-NNN-<slug>.md` 로 생성 (템플릿: [../templates/capability-proposal.md](../templates/capability-proposal.md)).
- 상태: `PROPOSED → APPROVED(인간 승인) → DONE` 또는 `REJECTED`. GameView 트랙은 **APPROVED 만 구현**한다.
- 구현 완료 시: 어휘를 VOCABULARY.md 에 ✅ 로 공개하고 Proposal 을 DONE 으로 갱신한다.

## 7. 검증 — 합성 데이터만

GameView 는 World 없이 검증 가능해야 한다.

1. **데모 하니스**: `gameview/demo/` 에 합성(가짜) 데이터만으로 모든 공개 어휘를 시연하는 데모 씬을 유지한다. 새 어휘 = 데모 갱신.
2. **알리바이**: 커밋 전 `git status` diff 가 `gameview/` (+ 자기 Skill) 안에만 있어야 한다. `world/`·`cycles/`·`app/` diff 는 0.
3. **눈 검증**: 데모 페이지를 브라우저로 확인 (자동 스모크가 생기면 병행).
4. **어휘 공개 게이트**: VOCABULARY.md 에 ✅ 로 표시된 항목만 Cycle 이 binding 할 수 있다. 데모에서 확인되지 않은 항목을 ✅ 로 올리지 않는다.

## 8. 상태 관리

- [VOCABULARY.md](VOCABULARY.md) — 공개 계약 (소비자가 읽는 유일한 문서)
- [STATE.md](STATE.md) — 트랙 내부 상태 (NOW / NEXT / INDEX)
