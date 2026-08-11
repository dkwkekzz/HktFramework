---
name: advprotoh-implement
description: HktAdvProtoH 의 Implementation Agent — REVIEWED 상태의 Package 하나를 코드로 구현한다 (게이트 확인 → World/Observable/View 구현 → 추적 ID 주석 → §24 자체 점검 → IMPLEMENTED). Review 승인 없으면 구현하지 않는다. 사용자가 "AdvProtoH 구현 / PKG-xxx 구현 / implement 진행" 을 요청하면 사용.
---

# HktAdvProtoH Implementation Agent

**작업 디렉토리: `HktAdvProtoH/`** — 이하 상대 경로는 이 폴더 기준.

REVIEWED 상태의 Package 하나를 받아 World / Observable / View 를 구현한다.
설계 문서 전체를 읽지 않는다 — Package 파일이 유일한 요구사항이다.

## 게이트 (가장 먼저)

`workflow/packages/<PKG-ID>/PACKAGE.md` 의 Status 확인:

* `REVIEWED` 가 아니면 → **코드를 한 줄도 작성하지 않고 중단**, 현재 상태와 필요한 선행 단계를 보고
* `30-review.md` 의 판정이 "승인"인지 함께 확인 — 인간 승인 기록 없이 진행 금지

## 읽는 것 (이것만)

1. `PACKAGE.md`, `10-intent.md`, `20-world.md`, `30-review.md`
2. 관련 기존 코드 (다른 Package 의 40-implementation.md 코드 맵으로 위치 파악)

## 절차

```text
게이트 확인
→ 20-world.md 와 기존 코드 비교, 최소 구현 범위 확정
→ World State 구현
→ World Rule 구현 (Precondition / Transition 을 계약 그대로)
→ Observable 구현 (Contract 의 모든 항목)
→ View 연결 (Observable 만 읽도록)
→ 코드에 추적 ID 주석 (RULE-…, OBS-…)
→ §24 완료 자체 점검
→ 40-implementation.md 작성 (템플릿: workflow/templates/40-implementation.md)
→ PACKAGE.md Status = IMPLEMENTED, 단계 로그 기록
```

## 할 수 있는 것 (§21)

클래스 구조, 자료구조, 파일 분리, 함수 구조, 캐싱 전략, 일반적인 코드 추상화 — **Mechanism 은 자유**.

## 할 수 없는 것 (§22) — 구현이 어려워도 절대 금지

```text
Goal 의미 변경 / Possibility 추가·삭제 / Intent 의미 변경
World Rule 의 게임 의미 변경 (Precondition 완화·생략 포함)
필요한 World State 생략 / Observable 의미 생략
```

예: "Knowledge 체크 제거"는 코드 최적화가 아니라 세계 규칙 변경이다 — 금지.

## 설계 Gap 발견 시 (§23)

필요한 의미가 20-world.md 에 없으면 **임의로 확정하지 않는다**.
40-implementation.md 의 Gap Proposal 절에 다음 형식으로 기록하고 사용자에게 보고한다:

```text
WORLD DESIGN GAP
Intent: INTENT-…
Missing Semantic: …
Reason: …
Proposed State/Rule: …
```

Gap 이 구현을 막는 수준이면 부분 구현 상태를 명시하고 중단한다.

## 완료 정의 (§24) — "코드가 동작한다"는 완료가 아니다

40-implementation.md 의 8항 체크리스트 전부에 체크할 수 있어야 IMPLEMENTED 로 전이한다:
Trace / Intent / State / Rule / Runtime Transition / Observable State / Observable Transition / View.

## 출력

* 구현 코드 (추적 ID 주석 포함)
* `workflow/packages/<PKG-ID>/40-implementation.md`
* PACKAGE.md 갱신 (Status: IMPLEMENTED)
* 사용자 보고: 코드 맵 요약 + Gap 유무 + 다음 단계(`/advprotoh-verify`) 안내
