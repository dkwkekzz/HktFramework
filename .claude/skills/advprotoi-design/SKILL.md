---
name: advprotoi-design
description: HktAdvProtoI 의 기획(Design Authoring) 단계를 실행한다 — Human 이 방향 한 줄·기획서(기반 층의 축) 또는 미지 하나(컨텐츠 층의 행 — 지역·생물·자원·구조)를 주입하면 그것을 Play Design(content/roadmap/play/<name>.md)으로 구체화하고, 승인 1회 후 첫 Cycle 의 00-cycle.md 를 생성한다. 플레이 층(Breath·사건·World Cause)은 AI 가 제안하고, 게임 의미의 결정(수치·원리·세계관 사실)은 지어내지 않고 Human 질문 목록으로 모은다. 코드는 수정하지 않는다 — 이후는 advprotoi-plan 이 이어받는다. 사용자가 "AdvProtoI 기획 / 기획 주입 / 이 방향으로 만들어줘 / Play Design 작성 / 00-cycle 작성 / design 진행" 을 요청하면 사용.
---

# HktAdvProtoI Design — 주입 → Play Design → 00-cycle

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-DesignAuthoringWorkflow.md](../../../HktAdvProtoI/design/Design-DesignAuthoringWorkflow.md)
(특히 §8.5 주입 경로) — 이 스킬과 어긋나면 원본이 이긴다.

이 스킬의 사용법은 하나다: **Human 이 방향/기획을 주입하면 Cycle 이 나온다.**
단계는 셋, Human 승인은 한 번이다. 코드·`content/` 의 코드·`engine/`·`cycles/*/01~05` 를
수정하지 않는다 — `content/roadmap/` 의 문서만 쓴다.

## ① 주입 받기

주입은 두 종류다 — 로드맵의 두 층에 대응한다
([content/roadmap/README.md](../../../HktAdvProtoI/content/roadmap/README.md) §1).
먼저 어느 층의 주입인지 판정한다.

```text
기반 층 주입    축 하나 — 방향 한 줄 · 기획서 · design/ 문서 지목
              → README §2 표에서 열린 층("다음") 하나만 받는다
컨텐츠 층 주입  미지 하나 — 지역 · 생물 · 자원 · 구조 (이름 + 종류 + 세계관 사실)
              → README §3 표에 행을 올린다. 요구 축이 전부 확정이어야 받는다
```

공통 규칙:

- 입력은 어떤 형태든 좋다 — 채팅의 한 줄, 기획서 전문, `design/` 문서 지목.
- 채팅으로 온 주입물은 `content/roadmap/` 에 그 행의 결과물로 보존한다 (그것이
  Source 다). 기반 층이면 `L<N>-<이름>.md` (0층이 `L0-Game.md`), 컨텐츠 층이면
  `M<N>-<이름>.md`. 로드맵·결과물·Play 는 전부 이 폴더에 있다 — `design/` 은 재료다.
- 기존 `design/` 에서 직접 관련된 문서만 참조한다 — `content/roadmap/L0-Game.md` 와
  로드맵의 그 행이 지목한 문서. **시스템 문서는 있으면 참조하고, 없어도 막지 않는다** —
  주입물 자체가 그 자리의 근거다. 전 문서 스캔·사전 정리 단계를 만들지 않는다.
- **행을 건너뛰는 Play 는 만들지 않는다.** 확정되지 않은 축의 의미가 Play 에 필요해지면
  Required 에 올리지 않고 Human 질문으로만 남긴다.

기반 층 주입:

- 주입물은 열린 층의 것이어야 하고, Play 는 그 층의 축 하나만 증명한다. 다른 층의
  것이면 그 사실을 보고하고 Human 판단을 받는다.
- 그 층의 증명 Play 는 축을 세우면서 **미지를 하나 놓는다** (2층: 이름 있는 지역 하나 ·
  3층: 무엇을 원하는지 아는 생물 하나 · 4층: 어디서 나는지 정해진 자원 하나). 그 미지의
  이름·존재는 Human 이 준다 — 주입물에 없으면 Human 질문으로 올린다. 승인되면
  README §3 에 행으로 올린다.
- 층이 Play 없이 닫히는 경우(0·1층: 문서 확정만)는 ②·③ 없이 로드맵의 상태 열을
  갱신하고 끝낸다.

컨텐츠 층 주입:

- 미지의 이름·종류·세계관 사실은 Human 만이 짓는다 — 주입물에 없는 것은 지어내지
  않는다. 요구 축을 판정해 README §3 행에 적는다. 요구 축 중 미확정이 있으면 받지
  않고 보고한다.
- 미지가 **새 축을 요구하면** 컨텐츠 행이 아니다 — 기반 층의 새 행이 필요하다고
  보고하고 Human 판단을 받는다.
- 이 미지 하나만 만나는 Play 를 만든다. 이미 선 축을 하나 이상 재사용한다.

## ② 구체화 → `content/roadmap/play/<PlayName>.md` (승인 1회)

주입물을 Play Design 1문서로 **구체화**한다. 무엇을 AI 가 정하고 무엇을 Human 이
정하는지의 경계는 하나다 (원본 §9):

```text
AI 가 제안한다     플레이 층 — Play Structure 구체화, Breath 의 각 단계를 실제 게임
                  사건으로 놓기, Experience → World Cause 변환, Capability 분석,
                  Cycle 분할. 방향 한 줄만 주입돼도 이 층은 AI 가 지어 올린다.
                  (승인으로 확정되므로 창작이되 독단이 아니다)
Human 이 정한다    게임 의미 — 수치·확률·시간·범위, 시스템 원리의 확정,
                  세계관 사실(무엇이 존재하는가·이름). 이것은 제안하지 않고
                  "Human 질문" 목록에 올린다.
```

판단이 서지 않으면 Human 질문으로 올린다 — 플레이 층이라도 주입물의 의도를
크게 벌리는 선택(예: 목표 자체를 바꾸는 갈래)은 질문에 함께 적는다.

**컨텐츠 층 주입이면 골격을 쓰기 전에 열 질문을 먼저 통과시킨다** (README §4).
①~③ 이 World Cause, ④~⑥ 이 Play Goal 과 Required, ⑦~⑩ 이 이 게임의 것인지 판정이다.
답이 주입물·`design/` 에 없으면 지어내지 않고 Human 질문에 올린다.

```text
세계 인과 (BW §33)   ① 어디에서 발생했는가  ② 왜 그 Property 가 필요한가
                    ③ 무엇이 세계압을 고정했는가  ④ 인간에게 왜 가치 있는가
                    ⑤ 어떤 Gameplay 가 발생하는가  ⑥ 어떤 Capability 를 여는가
게임 방향 (L0-Game.md §4) ⑦ 어떤 위험을 주는가  ⑧ 극복할 재료를 어디에 두는가
                    ⑨ 요정이 무엇으로 자라는가  ⑩ Core Breath 의 어느 전이인가
```

골격 (7단계, 원본 §5):

```text
# <PlayName>
## 0. Row                기반 층 L<N> 또는 컨텐츠 층 M<N> — 이 Play 가 증명하는 행 하나
                         (기반 층이면 놓는 미지 M<N> 도 함께)
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

- **게임 의미**(위 표의 Human 몫)는 지어내지 않고 **문서 끝 "Human 질문" 목록**에
  모은다 — 단계마다 정지하지 않는다. 플레이 층은 제안으로 채워 문서를 완성한다.
- Cycle Breakdown 각 항목은 6조건(작다/플레이 가능/World 변화 분명/관찰 가능/
  검증 가능/재사용 가능), 순서는 의존성 + Breath 점진 완성. CycleId 는 전
  이름공간(cycles/ + 코드 주석) 최대 번호 +1. Existing 판정은 CLAUDE.md 의
  "지금 있는 것" + 기존 `cycles/*/02-world.md` 의 ADDED.
- 주입물이 커서 Play 하나에 안 담기면 여러 Play 로 나눠 제안한다 — 승인은
  여전히 문서당 1회다.

**승인 게이트 (유일한 정지 지점)**: 문서 전체 + Human 질문 목록을 한 번에 올린다.
Goal·Intent·Breath·Breakdown 개별 게이트를 두지 않는다. 답과 수정 지시를 반영해
승인되면 README 의 해당 행(§2 또는 §3)에 Play 를 적고 ③ 으로. 기반 층 Play 가 놓는
미지는 이때 §3 에 행으로 올린다.

## ③ 생성 → `cycles/<CycleId>/00-cycle.md`

승인 즉시 첫 미완료 Cycle(또는 Human 지정)의 00-cycle 을 만든다. Play 를
재설명하지 않는다 — 이번 것만:

```text
# C### — <이름>
## Source            content/roadmap/play/<PlayName>.md
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
