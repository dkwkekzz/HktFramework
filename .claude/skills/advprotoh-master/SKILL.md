---
name: advprotoh-master
description: HktAdvProtoH 의 Master 층(Cycle 이전) 작업을 실행한다 — Master Intent Graph 확장(M1) · Capability Overlay 와 Frontier 후보 생성(M2). 세계 원인 · Actor 동기 · 믿음 · Goal · 대안 Possibility · 재사용 Capability 를 하나의 Typed Graph 로 넓히고, 현재 구현과 겹쳐 Human 이 다음 Cycle Goal 을 고를 목록을 만든다. 사용자가 "AdvProtoH Master 진행 / Master Graph 확장 / Region 확장 / Frontier 뽑아줘 / 다음 Cycle 후보 / Capability Overlay 갱신" 를 요청하면 사용. Cycle 8단계 실행은 advprotoh-cycle 이 담당한다.
---

# HktAdvProtoH Master Layer Runner

**작업 디렉토리: `HktAdvProtoH/`** — 이하 상대 경로는 이 폴더 기준.

이 스킬은 **Cycle 이전** 을 담당한다. 무엇을 만들지 정하는 층이다.
Cycle Goal 이 확정된 뒤의 8단계는 `advprotoh-cycle` 스킬의 몫이며, 이 스킬은 그 경계를 넘지 않는다.

```text
MASTER 층 (이 스킬)   M1 Graph 확장 → M2 Overlay·Frontier → M3 Human 선택
──────────────────────── CYCLE BOUNDARY ────────────────────────
CYCLE 층              Stage 1~8  (advprotoh-cycle)
```

## 1. 대상 Step 판정

인자로 Step 이 지정되면 그것을 쓴다. 지정되지 않으면:

1. 요청이 **아이디어·이야기·대안·세계 확장** 이면 M1.
2. 요청이 **다음에 뭘 만들까 · 지금 뭐가 되나 · 후보** 면 M2.
3. `master/graph/` 자체가 없으면 M1 이며 Human 에게 Root Goal / Region 주제를 받는다.
4. `master/frontier.md` 가 마지막 Cycle 완료보다 오래됐으면 M2 를 먼저 권한다.

| Step | Guide | 입력 | 출력 |
|---|---|---|---|
| M1 Graph Expansion | `guides/master-expand.md` | Root · 확장 대상 Region | `master/graph/*.yaml` |
| M2 Overlay & Frontier | `guides/master-frontier.md` | `master/graph/` + 현재 `world/` `view/` | `master/frontier.md` |
| M3 Human Selection | — | `master/frontier.md` | Cycle Goal (**Human 전용**) |

M3 이 다음 차례면 **작업을 멈추고** 사용자에게 후보 중 선택을 요청한다.
Agent 가 다음 Cycle 을 스스로 고르지 않는다.

## 2. 읽는다

정확히 이것만 읽는다. 더 읽지 마라.

```text
1. HktAdvProtoH/CLAUDE.md              공통 원칙·인덱스
2. guides/<이번 Step>.md                작업 방법·완료 조건
3. master/graph/ 중 이번에 건드리는 파일 + capabilities.yaml (항상)
4. references/graph-format.md          파일 규격 (이 스킬)
```

추가로 필요할 때만:

* M2 이면 판정 대상 Capability 의 실제 코드 (`world/` `view/`) 와 관련 Cycle 의 `01-cycle.md`
* 경계 사례에 한해 `design/Master-Intent-Graph-Policy.md` 의 **해당 절만**
* 세계 개념 판단이 필요하면 `design/Design-Concept.md` 의 **해당 절만**

`design/` 전체를 로드하는 것은 이 워크플로우의 실패다.
`cycles/` 를 전부 읽지 마라 — 이번에 근거로 인용할 Cycle 만 본다.

## 3. 실행

1. Guide 의 `DO` 를 순서대로 수행한다.
2. Guide 의 `MUST` / `MUST NOT` 을 위반하지 않는다.
3. 출력 파일을 `references/graph-format.md` 형식으로 쓴다.
4. `npm run master:check` 를 돌린다. 위반이 있으면 닫힌 것이 아니다.
5. Guide 의 `DONE WHEN` 을 항목별로 자가 점검한다.

### 막히면 — 지어내지 않는다

```text
MASTER GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  Human (Root Goal · Design Constraint) | M1 | M2
```

Root Goal 과 Design Constraint 는 Human 소유다. Agent 는 잠정안을 `provisional: true` 로 표시하고
Human 확정을 요청한다.

## 4. 닫기

* 변경한 그래프 파일과 `frontier.md` 를 커밋한다.
  메시지 형식: `HktAdvProtoH: Master <M1|M2> — <한 줄 요약>`
* M2 를 마쳤으면 **후보 목록을 사용자에게 제시하고 선택을 요청한다.** 스스로 고르지 않는다.
* 사용자가 후보를 고르면 그 문장을 Cycle Goal 로 `advprotoh-cycle` 에 넘긴다 —
  이 스킬은 Stage 1 을 대신 수행하지 않는다.

## 5. Cycle 이 끝난 뒤 (역방향 연결)

Cycle 이 `08-verification.md` STATUS `COMPLETE` (Human Play 확인 이후)가 되면
`master/graph/capabilities.yaml` 의 해당 Capability 를 갱신한다.

```text
status   MISSING → PARTIAL | IMPLEMENTED
cycles   + <CycleId>
where    + 실제 구현 위치
note     PARTIAL 이면 무엇이 아직 아닌지
```

그 뒤 `npm run master:check` → M2 를 다시 돌려 `frontier.md` 를 갱신한다.
건드린 Capability 가 없으면 갱신할 것도 없다 — 그것도 정상이다.

## 절대 규칙

```text
Cycle 층의 Stage 1~8 을 이 스킬이 대신하지 않는다.
다음 Cycle Goal 은 Human 이 고른다 — Agent 는 후보만 만든다.
Capability 는 master/graph/capabilities.yaml 한 곳에만 정의한다.
IMPLEMENTED 는 주장이 아니라 근거다 — Cycle ID + 구현 위치를 인용한다.
cycles/ 는 History 다 — 과거 Artifact 를 수정하지 않는다.
Narrative 를 별도 Graph 나 별도 노드 type 으로 만들지 않는다.
```
