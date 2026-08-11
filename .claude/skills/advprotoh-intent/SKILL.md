---
name: advprotoh-intent
description: HktAdvProtoH 의 Intent Agent — Goal/Possibility Graph 에서 Intent Package 를 추출한다 (Graph 절 읽기 → Intent 서술 → 의미 단위 목록 → 추적 ID 연결 → INTENT_READY). 사용자가 "AdvProtoH intent / Intent 추출 / PKG 생성 / intent 진행" 을 요청하면 사용.
---

# HktAdvProtoH Intent Agent

**작업 디렉토리: `HktAdvProtoH/`** — 이하 상대 경로는 이 폴더 기준.

Graph 의 Goal/Possibility 한 쌍에서 Intent 하나를 추출해 Package 를 개시한다.
설계 문서(Design-Concept.md / Design-Workflow.md) **전체를 읽지 않는다** — 필요한 규칙은 이 스킬에 있다.

## 읽는 것 (이것만)

1. [workflow/WORKFLOW-OPS.md](../../HktAdvProtoH/workflow/WORKFLOW-OPS.md) — ID 규칙(§4)·상태 기계(§3)
2. 대상 `design/graphs/<도메인>.md` — 사용자가 지정한 Goal/Possibility 노드와 그 인접 노드만
3. 기존 `workflow/packages/` 목록 — 중복 Intent 방지 (제목만 훑기)

## 입력

* 대상 Goal ID + Possibility ID (미지정 시 사용자에게 묻는다 — Graph 를 대신 골라주지 않는다)
* Graph 파일이 아직 없으면: 인간 작성 대상이므로 `workflow/templates/graph.md` 를 안내하고 중단한다. Agent 가 Graph 를 창작하지 않는다.

## 절차

```text
Graph 에서 대상 노드 확인
→ workflow/packages/PKG-<도메인>-<번호>/ 생성 (템플릿: workflow/templates/PACKAGE.md)
→ 10-intent.md 작성 (템플릿: workflow/templates/10-intent.md)
→ PACKAGE.md Status = INTENT_READY, 단계 로그 기록
```

## Intent 작성 규칙 (Design-Workflow.md §4–5 증류)

1. Intent 는 **세계에서 무엇이 참이어야 하는가**만 서술한다.
   - 잘못: "MiningComponent 클래스를 만든다", "Mine() 함수", "InventoryService 호출"
   - 올바름: "…조건을 만족하는 Actor 가 Deposit 에 Mine 을 수행하면 Actor 가 Resource 를 획득하고 Deposit 의 Resource 가 감소한다"
2. 반드시 Source Goal / Source Possibility ID 를 기입한다 — 추적 사슬의 시작점.
3. **의미 단위 목록**을 빠짐없이 뽑는다 — Intent 문장의 모든 조건/행동/결과. 이 목록이 이후 Semantic Closure 검사의 기준표가 된다.
4. Graph 를 변경하지 않는다 — 노드 추가/삭제/의미 변경 금지. 부족하면 사용자에게 보고만 한다.
5. Possibility 하나당 Intent 하나가 기본. 여러 Possibility 를 하나의 Intent 로 뭉치지 않는다.

## 출력

* `workflow/packages/<PKG-ID>/PACKAGE.md` (Status: INTENT_READY)
* `workflow/packages/<PKG-ID>/10-intent.md`
* 사용자 보고: Intent 서술 전문 + 다음 단계(`/advprotoh-world-model`) 안내

## 중단 조건

* 대상 Goal/Possibility 가 Graph 에 없음 → Graph 는 인간 소관, 중단 후 보고
* 동일 Possibility 의 Package 가 이미 존재 → 중복 생성하지 않고 기존 Package 를 알린다
