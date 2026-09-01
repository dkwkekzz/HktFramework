---
name: advprotoi-design
description: HktAdvProtoI 의 기획(Design Authoring) 단계를 실행한다 — Human 이 방향 한 줄이나 기획서를 주입하면 그것을 Play Design(design/play/<name>.md)으로 번역하고, 승인 1회 후 첫 Cycle 의 00-cycle.md 를 생성한다. 없는 의미는 지어내지 않고 Human 질문 목록으로 모은다. 코드는 수정하지 않는다 — 이후는 advprotoi-plan 이 이어받는다. 사용자가 "AdvProtoI 기획 / 기획 주입 / 이 방향으로 만들어줘 / Play Design 작성 / 00-cycle 작성 / design 진행" 을 요청하면 사용.
---

# HktAdvProtoI Design — 주입 → Play Design → 00-cycle

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-DesignAuthoringWorkflow.md](../../../HktAdvProtoI/design/Design-DesignAuthoringWorkflow.md)
(특히 §8.5 주입 경로) — 이 스킬과 어긋나면 원본이 이긴다.

이 스킬의 사용법은 하나다: **Human 이 방향/기획을 주입하면 Cycle 이 나온다.**
단계는 셋, Human 승인은 한 번이다. 코드·`content/`·`engine/`·`cycles/*/01~05` 를
수정하지 않는다.

## ① 주입 받기

- 입력은 어떤 형태든 좋다 — 채팅의 방향 한 줄, 기획서 전문, `design/` 문서 지목.
- 채팅으로 온 주입물은 `design/` 에 파일로 보존한다 (그것이 Source 다).
- 기존 `design/` 에서 직접 관련된 문서만 참조한다. **Game.md·시스템 문서는 있으면
  참조하고, 없어도 막지 않는다** — 주입물 자체가 그 자리의 근거다. 전 문서 스캔·
  사전 정리 단계를 만들지 않는다.

## ② 번역 → `design/play/<PlayName>.md` (승인 1회)

주입물을 Play Design 1문서로 **번역**한다 — 탐색이 아니다: 주입물과 기존 design/
에 있는 의미만 옮긴다. 골격 (7단계, 원본 §5):

```text
# <PlayName>
## 1. References         주입물 + 참조한 design/ 문서
## 2. Play Goal          한 문장, 완료를 직접 확인 가능
## 3. Experience Intent  Start / End
## 4. Breath             감정 전이 사슬 (강도 숫자 금지)
## 5. Play Structure     Breath 단계별 게임 사건 + World Cause
                         (존재/상태/조건/관찰/추론/반응)
## 6. Required Capability  Existing / Required
## 7. Cycle Breakdown    [ ] C### — 한 줄 목표 …
## Human 질문            주입물·design/ 로 결정할 수 없던 의미 (없으면 "없음")
```

- 없는 의미는 지어내지 않고 **문서 끝 "Human 질문" 목록**에 모은다 — 단계마다
  정지하지 않는다.
- Cycle Breakdown 각 항목은 6조건(작다/플레이 가능/World 변화 분명/관찰 가능/
  검증 가능/재사용 가능), 순서는 의존성 + Breath 점진 완성. CycleId 는 전
  이름공간(cycles/ + 코드 주석) 최대 번호 +1. Existing 판정은 CLAUDE.md 의
  "지금 있는 것" + 기존 `cycles/*/02-world.md` 의 ADDED.
- 주입물이 커서 Play 하나에 안 담기면 여러 Play 로 나눠 제안한다 — 승인은
  여전히 문서당 1회다.

**승인 게이트 (유일한 정지 지점)**: 문서 전체 + Human 질문 목록을 한 번에 올린다.
Goal·Intent·Breath·Breakdown 개별 게이트를 두지 않는다. 답과 수정 지시를 반영해
승인되면 ③ 으로.

## ③ 생성 → `cycles/<CycleId>/00-cycle.md`

승인 즉시 첫 미완료 Cycle(또는 Human 지정)의 00-cycle 을 만든다. Play 를
재설명하지 않는다 — 이번 것만:

```text
# C### — <이름>
## Source            design/play/<PlayName>.md
## Playable Goal
## Experience Intent
## World Change
## Observable Result
## Reuse             Existing / Added
## Out of Scope
```

종료 보고: "plan 가능". 이어서 `advprotoi-plan` 이 00-cycle 을 입력으로 01-spec 을
쓴다. 이후 Cycle 부터는 주입 없이 이 스킬을 다시 부르면 ③ 만 수행한다 (Play 의
다음 미완료 항목). Cycle 완료 체크박스 갱신은 build 의 마감 작업이다.
