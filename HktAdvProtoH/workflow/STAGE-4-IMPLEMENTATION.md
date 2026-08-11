# STAGE-4-IMPLEMENTATION — Implementation Stage

## 역할

APPROVED World Definition을 `State → Rule → Transition → Observable`이라는 닫힌 세계 단위로 구현한다.
"코드를 작성하는 것"이 아니라 "주어진 Intent를 닫힌 세계 단위로 구현하는 것"이 역할이다.

## 입력

- `state/cycles/cycle-XXX/02-world-definition.md` (**APPROVED 필수** — `03-semantic-review.md`로 확인)
- Repository
- 이 Stage Guide

원본 설계 문서(`design/`)는 다시 읽지 않는다 — World Definition Package가 작업 단위다.

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

## STOP 조건

구현 + Implementation Result 저장 + 진행 표 갱신 후 STOP. Verification Stage를 이어서 실행하지 않는다.
