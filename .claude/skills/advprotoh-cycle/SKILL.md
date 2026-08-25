---
name: advprotoh-cycle
description: HktAdvProtoH 의 Cycle 단계 하나를 실행한다 — 다음 미완료 Stage 판정 → CLAUDE.md + 해당 Stage Guide + 입력 Artifact 만 로드 → 작업 수행 → 출력 Artifact 작성 → 상태 갱신. Cycle Definition / Intent / World Semantic / GameView Spec / World·View Implementation / Verification 전 단계를 담당. 사용자가 "AdvProtoH 진행 / Cxxx 다음 단계 / Intent 단계 수행 / World Semantic 작성 / Cycle 시작 / cycle 러너" 를 요청하면 사용.
---

# HktAdvProtoH Cycle Stage Runner

**작업 디렉토리: `HktAdvProtoH/`** — `guides/` `design/` `engine/` `tools/` `scripts/` 는
이 폴더 기준. 루트 `design/` 은 공정·기반 문서만이고, 컨텐츠 기획 원본은 팩의
`content/<active>/design/` 에 있다.
**컨텐츠 경로는 활성 팩 루트 기준** — `hkt.pack.json` 의 active 가 가리키는
`content/<active>/` 아래에 `master/` `cycles/` `world/` `view/` `protocol/`(팩 확장) 이 있다.
`engine/` 과 `engine/protocol-core/` 는 기반이다 — **컨텐츠 작업 중에 편집하지 않는다**
(`npm run boundary:check` 가 경계를 강제한다). 기반 변경은 별도 기반 트랙으로만 한다.

이 스킬은 요청된 범위만큼 Stage 를 이어서 실행할 수 있다. 범위 지정이 없으면
다음 미완료 Stage 하나를 실행한다.
각 Stage 는 이전 Stage 의 Artifact 를 입력으로 받고 자기 Artifact 를 남긴다.
대화 History 를 Source of Truth 로 쓰지 않는다.

## 0. 위층 — Master Layer

이 프로젝트는 두 층이다. 이 스킬은 **아래층(Cycle Layer)** 만 담당한다.

```text
MASTER LAYER   Cycle Goal 이 어디서 오는가 — master/ · advprotoh-master 스킬
CYCLE LAYER    선택된 하나의 플레이 결과를 폐쇄한다 — cycles/ · 이 스킬 (8 Stage, 변경 없음)
```

접합점은 둘뿐이다.

```text
아래로   master/frontier/<트랙>.md 의 SELECTED  →  01-cycle.md 의 MASTER TRACE
위로     08-verification.md 의 MASTER FEEDBACK  →  Master 가 overlay · frontier/<트랙>.md ·
         feedback/<CycleId>.md · candidates 에 반영
```

* Cycle Agent 는 `master/` 파일을 **읽을 수는 있어도 편집하지 않는다.**
* 상위 Goal / Possibility / Capability / Constraint 의 의미를 구현 편의로 바꾸지 않는다.
* 어긋나면 지어내지 말고 `MASTER GAP` 으로 Human 에게 반환한다.
* Master Layer 를 쓰지 않는 Cycle 도 정상이다 — 그 경우 두 항목에 `없음` + 사유를 적는다.

## 1. 대상 Stage 판정

**레인 판정이 먼저다** (guides/works.md) — 요청이 `world/` 와 관찰 계약(`protocol/`)을
바꾸지 않는 화면 작업이면 Cycle 을 세우지 않는다 → `advprotoh-view` (VIEW 레인, `works/V-*`).

인자로 Stage 가 지정되면 그것을 쓴다. 지정되지 않으면:

1. 대상 Cycle 디렉터리 `cycles/<CycleId>/` 의 파일 목록을 확인한다.
2. `01` 부터 순서대로 **없는 첫 번째 Artifact** 가 이번 Stage 다.
3. Cycle 디렉터리 자체가 없으면 Stage 1 (Cycle Definition) 이다 — 사용자에게 Cycle Goal 을 받는다.
   Cycle ID 는 `C-<TRACK>-NNN-<이름>` — 트랙은 선택된 Frontier 가 사는 파일이 정하고,
   번호는 자기 트랙 접두사의 최대 +1 이다 (`guides/cycle-definition.md` Do 1).
4. 직전 Artifact 에 `GAP` 또는 `RETURNED` 가 적혀 있으면 **그 반환 대상 Stage** 를 먼저 실행한다.

| Stage | Guide | 입력 | 출력 |
|---|---|---|---|
| 1 Cycle Definition | `guides/cycle-definition.md` | 선택된 Frontier / Human Cycle Goal | `01-cycle.md` |
| 2 Intent | `guides/intent.md` | `01-cycle.md` | `02-intent.md` |
| 3 World Semantic | `guides/world-semantic.md` | `02-intent.md` | `03-world-semantic.md` |
| 4 GameView Spec | `guides/gameview-spec.md` | `03-world-semantic.md` | `04-gameview.spec.yaml` |
| 5 Human Review | — | 01~04 | `05-review.md` (**Human 전용 — Agent 가 작성하지 않는다**) |
| 6 World Impl | `guides/world-implementation.md` | `03-world-semantic.md` | `world/` + `06-world-implementation.md` |
| 7 View Impl | `guides/view-implementation.md` | `04-gameview.spec.yaml` | `view/` + `07-view-implementation.md` |
| 8 Verification | `guides/verification.md` | 01~07 + 현재 구현 | `08-verification.md` |

Stage 5 가 다음 차례면 **작업을 멈추고** 사용자에게 Semantic Review 를 요청한다.
`05-review.md` 가 `APPROVED` 가 아니면 Stage 6 으로 넘어가지 않는다.

## 2. 읽는다

정확히 이것만 읽는다. 더 읽지 마라.

```text
1. CLAUDE.md                          공통 원칙·인덱스
2. guides/<이번 Stage>.md              작업 방법·완료 조건
3. 위 표의 입력 Artifact
4. references/common-rules.md          공통 불변 규칙 상세 (이 스킬)
```

추가로 필요할 때만:

* **관련 있는** 기존 Cycle 의 Artifact (전부 읽지 마라 — 이번 Cycle 이 건드리는 Capability 만)
* Stage 6/7/8 이면 해당하는 `world/` `view/` `protocol/` 실제 코드
* Guide 로 판단할 수 없는 경계 사례에 한해 `design/` 원본의 **해당 섹션만**

`design/` 3종 전체를 로드하는 것은 이 워크플로우의 실패다.

## 3. 실행

1. Guide 의 `DO` 를 순서대로 수행한다.
2. Guide 의 `MUST` / `MUST NOT` 을 위반하지 않는다.
3. 출력 Artifact 를 Guide 의 `OUTPUT` 형식으로 작성한다 — 형식은
   [references/artifact-format.md](references/artifact-format.md) 참조.
4. Guide 의 `DONE WHEN` 을 항목별로 자가 점검한다. 미달이면 채우거나 Gap 으로 반환한다.
5. `01-cycle.md` 상단 상태 블록의 해당 줄을 `[PASS]` 로 갱신한다.

### 막히면 — 지어내지 않는다

현재 입력으로 올바른 결과를 만들 수 없으면 **작업을 멈추고** 출력 Artifact 에 Gap 을 기록한 뒤
책임 Stage 로 반환한다. 없는 의미를 만들어 채우는 것은 금지다.

```text
GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  Intent | World Semantic | GameView Specification
```

반환 방향은 정해져 있다.

```text
View 정보 부족        → GameView Specification (World 내부를 직접 읽지 않는다)
Spec 정보 부족        → World Semantic
Semantic 정보 부족    → Intent
Intent 가 Goal 과 불일치 → Cycle Definition (Human)
Cycle Goal 이 상위 Possibility / Constraint 와 어긋남 → MASTER (Human)
```

```text
MASTER GAP
Frontier     <Frontier ID>
Conflict     무엇이 상위 의미와 어긋나는가
Affected     MG-* / MP-* / MC-* / DC-*
Options      가능한 Trade-off
Decision By  Human
```

## 4. 닫기

* 출력 Artifact 커밋. 메시지 형식: `HktAdvProtoH: <CycleId> <Stage> — <한 줄 요약>`
* Stage 6/7 은 구현 코드와 Artifact 를 함께 커밋한다.
* Stage 8 이 전 항목 통과면 `08-verification.md` 의 STATUS 를 `COMPLETE` 로,
  `01-cycle.md` 의 STATUS 도 `COMPLETE` 로 갱신한다.
  단 **Human Play 확인 이전에는 COMPLETE 로 바꾸지 않는다** — 사용자에게 플레이 확인을 요청한다.
* 요청된 범위의 마지막 Stage 까지 실행했으면 멈춘다. 무엇이 끝났고 다음이 무엇인지 보고한다.

## 절대 규칙

```text
과거 Cycle 의 Artifact 를 수정하지 않는다 — History 다.
world/ view/ 는 모든 Cycle 이 공유한다 — Capability 별 World 를 만들지 않는다.
Client 는 상태를 바꾸지 않는다 — Action 을 요청하고 World Rule 이 결정한다.
코드가 도는 것은 완료가 아니다 — 실제 Cycle Goal 의 플레이 가능성이 완료다.
master/ 를 편집하지 않는다 — 위층으로는 MASTER FEEDBACK 으로 보고만 한다.
```
