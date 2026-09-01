---
name: advprotoi-design
description: HktAdvProtoI 의 기획(Design Authoring) 단계를 실행한다 — Game Direction·System Design 을 근거로 Play Design(design/play/<name>.md, Play Goal → Experience Intent → Breath → Play Structure → World Cause → Required Capability → Cycle Breakdown)을 작성하고, 선택된 Cycle 의 00-cycle.md 를 만든다. Play Goal·Intent·Breath·Cycle 범위는 Human 승인 게이트다. 코드는 수정하지 않는다 — 이후는 advprotoi-plan 이 이어받는다. 사용자가 "AdvProtoI 기획 / Play Design 작성 / 플레이 설계 / Cycle Breakdown / 00-cycle 작성 / design 진행" 을 요청하면 사용.
---

# HktAdvProtoI Design — Play Design → Cycle 생성

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-DesignAuthoringWorkflow.md](../../../HktAdvProtoI/design/Design-DesignAuthoringWorkflow.md) —
이 스킬과 어긋나면 원본이 이긴다.

이 스킬은 **사람의 아이디어에서 `00-cycle.md` 까지**만 담당한다. 코드·`content/`·
`engine/`·`cycles/*/01~05` 를 수정하지 않는다. 산출물은
`design/play/<PlayName>.md` 와 `cycles/<CycleId>/00-cycle.md` 다.

## 공통 원칙

- 큰 시스템을 기능 목록으로 직접 분해하지 않는다 — 항상 실제 Play 를 먼저 만든다.
- 모든 중요한 감정 변화에는 World Cause 가 있어야 한다 ("공포를 느끼게 한다" ✗ →
  "강한 생물의 사체 발견 → 더 강한 존재를 추론 → 적은 아직 보이지 않음" ○).
- Cycle 은 기능 단위가 아니라 **최소 Playable Experience 단위**다.
- `Game.md`·시스템 문서는 Human 원본 — 수정·재해석하지 않는다. 없는 의미가 필요하면
  지어내지 않고 Human 에게 묻는다 (CLAUDE.md `GAP` 형식).
- Master/Intent/Capability Graph 류 관리 artifact 를 만들지 않는다 — Breath·
  Capability·Cycle 후보는 전부 play 문서 안에서 관리한다.

## 1. 입력 확인

1. `design/Game.md` 가 있으면 읽는다. 없으면 Human 과의 대화로 Core Experience +
   Core Breath 초안을 제안하고 **승인 후** 생성한다 (승인 전 진행 금지).
2. 이번 Play 와 관련된 시스템 기획 문서(`design/` 의 해당 갈래 — README.md 의 표)
   를 식별해 읽는다. 관련 영역의 시스템 문서가 아예 없으면 그 원리를 지어내지 않고
   Human 에게 반환한다.

## 2. Play Design 작성 → `design/play/<PlayName>.md`

7단계 순서 고정 (원본 §5). 골격:

```text
# <PlayName>
## 1. References         Game.md + 근거 시스템 문서 (약칭 인용)
## 2. Play Goal          한 문장, 완료를 직접 확인 가능해야 함
## 3. Experience Intent  Start / End
## 4. Breath             감정 전이 사슬 — 강도 숫자 금지, "어떤 경험 이후 변하는가"만
## 5. Play Structure     Breath 단계별 실제 게임 사건 + 각 사건의 World Cause
                         (존재/상태/행동 조건/관찰/추론/세계의 반응 6문)
## 6. Required Capability  Existing / Required 목록
## 7. Cycle Breakdown    [ ] C### — 한 줄 목표 …
```

**Human 게이트**: Play Goal · Experience Intent · Breath · Cycle Breakdown 은
Human 승인 대상이다. 초안 작성 후 승인 질의로 정지한다 — 승인 전에 00-cycle 로
넘어가지 않는다. Play Structure·World Cause·Capability 분석은 AI 의 수행 영역이다.

Cycle Breakdown 의 각 항목은 6조건(작다 / 플레이 가능 / World 변화 분명 / 관찰 가능 /
검증 가능 / 재사용 가능)을 만족해야 하고, 순서는 구현 의존성 + **Breath 의 점진 완성**
으로 정한다. CycleId 채번은 plan 과 같은 규칙(`C###-이름`, 전 이름공간 최대 +1).
Existing Capability 판정은 `CLAUDE.md` 의 "컨텐츠에 지금 있는 것" + 기존
`cycles/*/02-world.md` 의 ADDED 목록으로 한다.

## 3. Cycle 생성 → `cycles/<CycleId>/00-cycle.md`

승인된 Play Design 에서 다음 미완료 Cycle(또는 Human 지정)을 선택해 작성한다.
Play 전체를 재설명하지 않는다 — 이번 구현에 필요한 것만.

```text
# C### — <이름>
## Source            design/play/<PlayName>.md (+ 근거 시스템 문서)
## Playable Goal
## Experience Intent
## World Change
## Observable Result
## Reuse             Existing / Added
## Out of Scope
```

## 4. 종료 보고

- `00-cycle.md` 완성 → "plan 가능" 보고. Human 이 승인하면 `advprotoi-plan` 이
  이를 입력으로 01-spec.md 를 작성한다.
- 진행 중 시스템 원리 부재·모순을 만나면 CLAUDE.md `GAP` 형식으로 Human 반환.
- Cycle 완료 후 play 문서 체크박스 갱신은 build 의 마감 작업이다 — 이 스킬은
  승인된 play 문서를 다시 고치지 않는다.
