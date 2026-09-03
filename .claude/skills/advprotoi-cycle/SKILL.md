---
name: advprotoi-cycle
description: HktAdvProtoI 의 Cycle 하나를 한 번의 호출로 끝까지 돌리는 러너 — cycles/<CycleId>/spec.md 의 상태를 보고 다음 단계를 이어 부른다 (없음 → advprotoi-design ③ 범위 · 앞부분만 → advprotoi-plan · 동결 → advprotoi-build · TODO 까지 → 닫힘 보고). 정지는 두 자리뿐 — plan 의 UNRESOLVED 와 build 의 DESIGN/ENGINE GAP. 시작 전에 STATE.md §1 레인 표에서 그 Cycle 의 "기다리는 것"이 비었는지와 브랜치 cycle/C### 을 확인한다. 사용자가 "C### 진행 / 다음 Cycle 진행 / Cycle 돌려 / AdvProtoI 진행" 을 요청하면 사용.
---

# HktAdvProtoI Cycle Runner — 한 번 불러 한 Cycle

**작업 디렉토리: `HktAdvProtoI/`**. 이 스킬은 아무것도 새로 정하지 않는다 — `advprotoi-design` ③ ·
`advprotoi-plan` · `advprotoi-build` 를 **순서대로 이어 부르는 얇은 러너**다. 세 스킬의 규칙과
산출물은 각자의 SKILL.md 가 소유하고, 여기서는 어디까지 왔는지 판정해 다음을 부를 뿐이다.

plan 과 build 를 합치지 않는 이유: 경계는 문서 수가 아니라 게이트다 — plan 은 의미를 정하며
Human 에게 멈춰 돌아가고(UNRESOLVED), build 는 정해진 의미를 자율·병렬로 실현한다. 그 경계가
`spec.md` 동결이다. 이 러너는 그 게이트를 지키면서 **호출만 하나**로 만든다.

## 0. 시작 조건

1. **Cycle 판정** — Human 이 `C###` 을 지정하면 그것. 아니면 STATE.md §1 레인 표에서 "기다리는 것"이
   빈 첫 레인의 Cycle. "기다리는 것"이 남아 있는 Cycle 은 시작하지 않고 그 사실을 보고한다
   (Human 결정 줄에 있는 것은 Human 이 정한 뒤에만).
2. **브랜치** — `cycle/C###` 에 있어야 한다 (없으면 main 에서 만든다). 다른 Cycle 의 브랜치에서
   시작하지 않는다. 브랜치 안에서 만지는 것은 자기 `cycles/C###/` 와 코드뿐 — STATE.md · Play
   체크박스는 main 에 합친 직후에만 (Plan-Skill §4 항목 4).
3. **CycleId** — Play 의 Cycle Breakdown 이 정한 번호 그대로 (`C###-이름`).

## 1. 상태 판정 → 다음 단계

`cycles/<CycleId>/` 를 본다. 판정은 파일이 말한다 — 대화 History 는 보지 않는다.

```text
디렉터리 없음 / spec.md 없음        → advprotoi-design ③ (spec.md 앞부분 = 범위) → 이어서 plan
spec.md 에 ## SPEC 이 없음          → advprotoi-plan (뒷부분 덧붙여 동결)          → 이어서 build
spec.md 동결 (UNRESOLVED = 없음)    → advprotoi-build (코드 · 시나리오 테스트 · 촬영 · TODO.md)
UNRESOLVED 에 항목이 있음           → 정지. 목록을 Human 질의로 올린다 (plan 의 규칙)
TODO.md 가 있고 마감 커밋이 있음     → 닫힘 보고 — "PR 을 올려 합친다" · Human 판정 대기 항목 수
```

각 단계는 그 스킬의 SKILL.md 를 **그대로** 따른다. 러너가 단계의 규칙을 요약해 대신하지 않는다.

## 2. 정지 지점 — 둘뿐

```text
UNRESOLVED > 0   (plan)   Design 에 없는 게임 의미 → Human 질의 목록을 올리고 멈춘다
DESIGN GAP       (build)  spec 으로 의미를 결정할 수 없음 → GAP 블록을 올리고 멈춘다 (plan/Human 반환)
ENGINE GAP       (build)  기존 engine 계약 변경 필요 → 승인 요청을 올리고 그 부분만 멈춘다
```

IMPLEMENTATION GAP 은 정지가 아니다 — build 가 그 자리에서 푼다. 테스트 실패 · 촬영 실패도
정지가 아니라 build 안의 일이다. 그 밖의 이유로 Human 에게 묻지 않는다.

## 3. 마감 보고

build 가 끝나면 한 번에 보고한다 — 이것이 Human 이 보는 유일한 결과다.

```text
그림          cycles/C###/shots/*.png 를 그대로 보여준다 (SendUserFile) — Human 판정은 그림에서 시작한다
한 줄         마감 커밋 메시지의 판정 줄 (시나리오 N/N PASS · 7항 · Human 판정 대기 K)
TODO          cycles/C###/TODO.md 의 항목 수 — Human 판정 대기 · 부채 · 다음 Cycle 로
다음          PR 을 올린다(번호 순 합침) → 합친 뒤 design ④ 가 STATE §1 레인 표를 고친다
```

보고에 공정 설명을 반복하지 않는다. 다음 Cycle 을 이어 시작하지 않는다 — 합침이 먼저다.
