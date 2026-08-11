# STAGE-4-IMPLEMENTATION — Implementation Stage

## 역할

APPROVED World Definition을 `State → Rule → Transition → Observable`이라는 닫힌 세계 단위로 구현한다.
"코드를 작성하는 것"이 아니라 "주어진 Intent를 닫힌 세계 단위로 구현하는 것"이 역할이다.

## 입력

- `state/cycles/cycle-XXX/02-world-definition.md` (**APPROVED 필수** — `03-semantic-review.md`로 확인)
- Repository
- 이 Stage Guide

원본 설계 문서(`design/`)는 다시 읽지 않는다 — World Definition Package가 작업 단위다.
**예외**: View 구현 시에는 [../design/Design-GameView.md](../design/Design-GameView.md)(GameView Architecture)를 구현 가이드로 참조한다 — 세계 설계 원문이 아니라 View 계약·확장 규칙 문서다.

## 출력

- 코드 (Repository)
- `state/cycles/cycle-XXX/04-implementation-result.md` — [../templates/IMPLEMENTATION-RESULT.md](../templates/IMPLEMENTATION-RESULT.md) 형식

## 결정할 수 있는 것 (Implementation Mechanism)

```text
클래스 구조 / 자료구조 / 파일 구조 / 함수 구조 / 캐싱 / 코드 추상화
```

## 변경할 수 없는 것

```text
Goal 의미 / Possibility 의미 / Intent 의미 / World Rule 의미
Required World State / Observable Contract
```

구현하기 어렵다는 이유로 Precondition 체크 제거, State 생략, Observable 생략은 불가 — 그것은 세계 규칙 변경이다.

## 구현 원칙

1. **의미 있는 상태 변화는 Rule을 통해서만** — Rule 밖에서 World State를 직접 변경하지 않는다.
2. **View는 Observable World State만 읽는다** — World 내부 직접 접근 금지.
3. **Transition 기록** — `Before / Input / Rule / After`가 Runtime에서 관찰 가능해야 한다.
4. **Trace 유지** — Rule 구현에 `Implements: INTENT-XXX` trace를 남긴다.
5. **과도한 미래 추상화 금지** (RULE 8) — `UniversalResourceProviderFactory` 류 금지. 지금 필요한 만큼만.
6. **Design Gap** — 필요한 Semantic이 World Definition에 없으면 추측하지 않고 [../templates/DESIGN-GAP.md](../templates/DESIGN-GAP.md)를 생성하고 STOP (RULE 5). 설계 변경 후보를 제출할 뿐, 설계를 직접 변경하지 않는다.
7. **View Definition 산출** — Visual Requirement의 각 항목을 GameView의 기존 Visual Vocabulary에 연결하는 View Definition을 작성한다. Semantic → Visual 연결은 View Definition만 담당하며, GameView Core(Backend/Primitive/Library)에는 World 의미를 넣지 않는다.
8. **Capability Resolution 순서** — 필요한 시각 표현은 반드시 `① 기존 Visual Component → ② 기존 Primitive 조합 → ③ 재사용 가능한 새 Component → ④ Capability 확장 제안` 순서로 해결한다. ④에 도달하면 추측·직접 확장하지 않고 [../templates/GAMEVIEW-CAPABILITY-GAP.md](../templates/GAMEVIEW-CAPABILITY-GAP.md)를 생성하고 해당 표현 작업을 중단한다 — GameView Core 확장은 Cycle의 부수 작업으로 몰래 수행하지 않는다.

## GameView 구현 규약 (Cycle을 초월하는 불변 — 재량 아님)

이 외의 모든 GameView 구현 세부(폴더 구조, 빌보드 방식, sync 전략, 구축 순서 등)는 이 Stage의 재량이며, 결정은 Implementation Result에 기록한다.

- **스택**: three.js + Vite (Web).
- **World 코어 무의존**: `world/`·`observable/`은 DOM·렌더 라이브러리에 의존하지 않는 순수 ES Module — Verification Stage가 브라우저 없이 Node에서 같은 코드를 헤드리스 실행할 수 있어야 한다.
- **Import 방향**: `View Definition → Visual Library → Primitive → Backend` 단방향. `three` import는 Backend/Primitive 층에만 허용. View 쪽 어디서도 `world/`를 import하지 않는다 — Observable 스냅샷·Transition Log를 직렬화 가능한 데이터로만 전달받는다.
- **View Definition 형식**: Architecture §14의 선언 구조를 그대로 담은 JS 모듈로 작성한다 — 별도 DSL·파서를 선행 구축하지 않는다 (RULE 8).
- **GameView Core의 소속**: Core(Backend/Primitive/Library) 구축을 위한 별도 트랙·Stage는 없다 — 그것을 요구하는 Cycle의 Implementation 안에서 필요한 최소 범위로 세우고, 이후 확장은 GAMEVIEW-CAPABILITY-GAP 승인으로만 수행한다.

## STOP 조건

구현 + Implementation Result 저장 + 진행 표 갱신 후 STOP. Verification Stage를 이어서 실행하지 않는다.
