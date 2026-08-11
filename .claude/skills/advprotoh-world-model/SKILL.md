---
name: advprotoh-world-model
description: HktAdvProtoH 의 World Model Agent — Intent 를 World State / World Rule / Observable Contract / Required Views 로 도출한다 (의미 단위 → State 도출 → Rule 정의 → Observable 동시 설계 → 매핑표 → WORLD_READY). 사용자가 "AdvProtoH world model / World 도출 / PKG-xxx world / world 진행" 을 요청하면 사용.
---

# HktAdvProtoH World Model Agent

**작업 디렉토리: `HktAdvProtoH/`** — 이하 상대 경로는 이 폴더 기준.

INTENT_READY 상태의 Package 하나를 받아 `20-world.md` 를 작성한다.
설계 문서 전체를 읽지 않는다 — 필요한 규칙은 이 스킬에 있다. 코드도 작성하지 않는다.

## 읽는 것 (이것만)

1. 대상 `workflow/packages/<PKG-ID>/PACKAGE.md` — **Status 가 INTENT_READY 가 아니면 중단**
2. 같은 Package 의 `10-intent.md`
3. 기존 다른 Package 들의 `20-world.md` — 이미 정의된 State/Rule 재사용 확인 (같은 속성을 다른 이름으로 재발명 금지)

## 절차

```text
10-intent.md 의미 단위 목록 확인
→ 각 의미 단위마다: "이 문장을 세계에서 사실로 만들려면 어떤 정보가 존재해야 하는가?"
→ Required World State 표 작성 (기존 State 재사용 우선)
→ World Rule 정의 (Input / Preconditions / Transition)
→ Observable Contract 동시 설계
→ Required Views 지정
→ 의미 단위 → State/Rule 매핑표 완성 (전 항목 매핑 확인)
→ 20-world.md 저장 (템플릿: workflow/templates/20-world.md)
→ PACKAGE.md Status = WORLD_READY, Rules/Observable ID 기입, 단계 로그 기록
→ 사용자에게 Human Semantic Review 요청 (30-review.md 는 인간이 작성)
```

## World State 판별 규칙 (§7–8 증류)

상태를 추가할 때마다 묻는다: **이것은 세계의 사실인가, 프로그램 구현의 사실인가?**

- World State ○: `Arin.Position`, `Arin.Knowledge`, `Deposit.ResourceAmount`, `Wolf.Target`
- World State ✗ (Implementation State): `vector.capacity`, `planner.currentNodeIndex`, `cacheEntry`, `hashBucket`
- **Decision Semantic State**: Agent 의 판단에 영향을 주는 상태(Knowledge, Preference, Experience, Skill, CurrentGoal, CurrentPossibility)는 Planner 내부 변수가 아니라 World Semantic State 다 — 반드시 State 로 정의하고 Observable 대상에 포함한다.

## World Rule 작성 규칙 (§9–11 증류)

1. 형태 고정: `Input / Preconditions / Transition` — Rule 은 코드 함수가 아니라 **세계에서 허용되는 상태 전이의 정의**다.
2. 모든 Rule 에 `Implements: INTENT-…` / `Derived From: GOAL-… POSS-…` 추적 기입.
3. Intent 에 없는 의미를 Rule 에 추가하지 않고, Intent 의 의미를 생략하지도 않는다.

## Observable 설계 규칙 (§12–18 증류)

1. **State 구현 후 Debug UI 를 붙이는 것이 아니다** — State/Rule 정의와 동시에 Observable 을 정의한다.
2. 기준 질문: "인간이 이 Intent 의 성립을 확인하려면 무엇을 볼 수 있어야 하는가?"
3. Semantic Lossless Projection — 메모리 전체 복제가 아니라 **설계 판단에 필요한 의미가 사라지지 않는** 투영.
4. Transition 도 Observable: `Before / Input / Rule / After` 형태.
5. Precondition 각각의 평가값과 **실행 불가 사유**(예: "out of interaction range")가 표현 가능해야 한다.
6. View 는 Observable 만 읽는다 — View 계약에 World 내부 접근을 쓰지 않는다.

## 출력

* `workflow/packages/<PKG-ID>/20-world.md`
* PACKAGE.md 갱신 (Status: WORLD_READY)
* 사용자 보고: State/Rule/Observable 요약 + **Review 요청** (30-review.md 승인 전 구현 불가 명시)

## 중단 조건

* 의미 단위 중 State/Rule 로 표현 불가한 것 발견 → 임의 해석하지 말고 해당 항목을 명시해 사용자에게 질의
* Intent 자체의 모호함 발견 → 10-intent.md 를 고치지 말고 반려 사유와 함께 보고
