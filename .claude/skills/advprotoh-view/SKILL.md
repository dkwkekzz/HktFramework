---
name: advprotoh-view
description: HktAdvProtoH 의 VIEW 레인 작업(관찰만을 위한 화면 작업 — 세계·관찰 계약 불변)을 실행한다 — 레인 판정 → 할일 확정(works/BACKLOG.md 의 다음 항목 · Human 목표 · UX 기획서 주입=번역) → V-NNN 발급 → view/ 구현 → 눈검증 → works/ 기록·백로그 정리 → 발견한 관찰 결손 REPORT. 할일의 단일 출처는 works/BACKLOG.md 다 — 다른 세션이 그것만 보고 잇는다. Cycle 이 아니다 — 8 Stage·Cycle 번호·Master Feedback 이 없다. world/ 나 protocol/ 을 바꿔야 성립하는 요청이면 시작하지 않고 Frontier/Cycle 경로로 승격을 보고한다. 사용자가 "AdvProtoH UI 작업 / UX 개선 / 화면 정리 / view 작업 / V 작업 / 다음 view 할일 / UX 기획서 반영·주입 / view backlog" 를 요청하면 사용.
---

# HktAdvProtoH View Work Runner

**작업 디렉토리: `HktAdvProtoH/`** — `guides/` `design/` `engine/` `tools/` `scripts/` 는
이 폴더 기준. 루트 `design/` 은 공정·기반 문서만이고, 컨텐츠 기획 원본은 팩의
`content/<active>/design/` 에 있다.
**컨텐츠 경로는 활성 팩 루트 기준** — `hkt.pack.json` 의 active 가 가리키는 `content/<active>/`
아래에 `view/` `works/` 가 있다.

이 스킬은 **VIEW 레인** 하나를 담당한다. 레인 목록·판정·쓰기 범위의 단일 출처는
`guides/works.md` 다.

```text
VIEW 레인      view/ 와 works/ 만 쓴다. 세계(world/)와 관찰 계약(protocol/)은 불변.
               Cycle 이 아니다 — 8 Stage 없음 · Cycle 번호 없음 · Master Feedback 없음
할일           단일 출처는 works/BACKLOG.md 다 — 세션이 아니라 백로그가 할일을 지닌다
승격           "보여줄 것이 부족하다" = 세계의 관찰 확장이다 — 이 스킬로 하지 않는다.
               멈추고 Frontier/Cycle 경로(advprotoh-master → advprotoh-cycle)를 보고한다
```

## 1. 대상 판정

1. 요청이 Human 이 지목한 UX 기획서(팩의 `design/Design-View-*.md`)의 반영이면 → **주입**:
   문서의 화면 요구를 `works/BACKLOG.md` 항목으로 번역한다 (탐색이 아니라 번역 —
   문서에 없는 할일을 지어내지 않는다). 계약·세계를 요구하는 요구사항은 백로그에
   올리지 않고 승격 재료로 분류해 보고한다. 주입만으로 한 바퀴가 끝나도 정상이다.
2. 구체 목표가 지정되면 그것을 한다 — 백로그에 없던 것이면 항목을 먼저 세운다.
3. 지정이 없으면 → `works/BACKLOG.md` 의 **다음 항목** (의존이 풀린 것 중 위에서부터).
   백로그도 비었으면 할 일이 없다고 보고하고 멈춘다 — 지어내지 않는다.

## 2. 읽는다

정확히 이것만 읽는다. 더 읽지 마라.

```text
1. CLAUDE.md              공통 원칙·인덱스
2. guides/works.md        레인 판정 — 이 요청이 정말 VIEW 인가
3. guides/view-work.md    작업 방법 · 백로그·기록 형식 · 완료 조건
4. works/BACKLOG.md       남은 할일 (+ 주입이면 지목된 UX 기획서)
5. 대상 화면의 view/ 코드 (+ 관련 GameView 관찰은 읽기만)
```

## 3. 실행

1. **레인 판정** — `world/` `protocol/` 을 바꿔야 성립하면 여기서 멈추고 승격 사유를 보고한다.
2. `works/` 에서 `V-NNN` 을 딴다 (최대 +1 — VIEW 레인은 동시에 한 세션이므로 안전하다).
   백로그 항목의 상태를 `IN PROGRESS (V-NNN)` 로 바꾼다.
3. Guide 의 `DO` 를 순서대로 수행하고 `MUST` / `MUST NOT` 을 위반하지 않는다.
4. 실제 Client 를 띄워 목표 문장을 눈으로 확인한다 (`scripts/run-client.sh` · `.bat`). 같은 화면의 기존
   표면 회귀도 함께 본다.
5. `works/V-NNN-<name>.md` 를 남기고 **백로그에서 그 항목을 지운다.** 발견한 세계
   관찰의 결손은 REPORT 절로 — view 계산으로 메우지 않는다. 후속 화면 할일은
   백로그에 새 항목으로 남긴다.

## 4. 닫기

* 닫기 전 `git diff` 로 `world/` `protocol/` `engine/` `master/` `cycles/` 가
  비어 있음을 확인한다 — 하나라도 있으면 이 작업은 VIEW 가 아니었다. 되돌리고 보고한다.
* Kind 표현을 바꿨으면 `npm run catalog:check`.
* 커밋 메시지 형식: `HktAdvProtoH: V-NNN — <한 줄 요약>`
* 무엇이 끝났고, REPORT 에 무엇을 남겼는지 보고한다.
