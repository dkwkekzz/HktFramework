---
name: advprotoh-view
description: HktAdvProtoH 의 VIEW 레인 작업(관찰만을 위한 화면 작업 — 세계·관찰 계약 불변)을 실행한다 — 레인 판정 → V-NNN 발급 → view/ 구현 → 눈검증 → works/ 기록 → 발견한 관찰 결손 REPORT. Cycle 이 아니다 — 8 Stage·Cycle 번호·Master Feedback 이 없다. world/ 나 protocol/ 을 바꿔야 성립하는 요청이면 시작하지 않고 Frontier/Cycle 경로로 승격을 보고한다. 사용자가 "AdvProtoH UI 작업 / UX 개선 / 화면 정리 / view 작업 / V 작업 / 관찰 화면 손보기" 를 요청하면 사용.
---

# HktAdvProtoH View Work Runner

**작업 디렉토리: `HktAdvProtoH/`** — `guides/` `design/` `engine/` `tools/` 는 이 폴더 기준.
**컨텐츠 경로는 활성 팩 루트 기준** — `hkt.pack.json` 의 active 가 가리키는 `content/<active>/`
아래에 `view/` `works/` 가 있다.

이 스킬은 **VIEW 레인** 하나를 담당한다. 레인 목록·판정·쓰기 범위의 단일 출처는
`guides/works.md` 다.

```text
VIEW 레인      view/ 와 works/V-* 만 쓴다. 세계(world/)와 관찰 계약(protocol/)은 불변.
               Cycle 이 아니다 — 8 Stage 없음 · Cycle 번호 없음 · Master Feedback 없음
승격           "보여줄 것이 부족하다" = 세계의 관찰 확장이다 — 이 스킬로 하지 않는다.
               멈추고 Frontier/Cycle 경로(advprotoh-master → advprotoh-cycle)를 보고한다
```

## 1. 읽는다

정확히 이것만 읽는다. 더 읽지 마라.

```text
1. CLAUDE.md              공통 원칙·인덱스
2. guides/works.md        레인 판정 — 이 요청이 정말 VIEW 인가
3. guides/view-work.md    작업 방법 · works/ 기록 형식 · 완료 조건
4. 대상 화면의 view/ 코드 (+ 관련 GameView 관찰은 읽기만)
```

## 2. 실행

1. **레인 판정** — `world/` `protocol/` 을 바꿔야 성립하면 여기서 멈추고 승격 사유를 보고한다.
2. `works/` 에서 `V-NNN` 을 딴다 (최대 +1 — VIEW 레인은 동시에 한 세션이므로 안전하다).
3. Guide 의 `DO` 를 순서대로 수행하고 `MUST` / `MUST NOT` 을 위반하지 않는다.
4. 실제 Client 를 띄워 목표 문장을 눈으로 확인한다 (run-client). 같은 화면의 기존
   표면 회귀도 함께 본다.
5. `works/V-NNN-<name>.md` 를 남긴다. 발견한 세계 관찰의 결손은 REPORT 절로 —
   view 계산으로 메우지 않는다.

## 3. 닫기

* 닫기 전 `git diff` 로 `world/` `protocol/` `engine/` `master/` `cycles/` 가
  비어 있음을 확인한다 — 하나라도 있으면 이 작업은 VIEW 가 아니었다. 되돌리고 보고한다.
* Kind 표현을 바꿨으면 `npm run catalog:check`.
* 커밋 메시지 형식: `HktAdvProtoH: V-NNN — <한 줄 요약>`
* 무엇이 끝났고, REPORT 에 무엇을 남겼는지 보고한다.
