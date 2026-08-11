# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다. 
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | **현재 핵심 상태 + TODO** (핵심만 — 상세는 progress/) |
| [design/Design-Concept.md](design/Design-Concept.md) | 게임 개념 지도 (세계/주체/법칙/목적·가능성 — 원문, 통독 대상 아님) |
| [design/Design-Workflow.md](design/Design-Workflow.md) | 게임 전체 구현 지도 (설계 철학 진본, 통독 대상 아님) |
| [design/graphs/](design/graphs/README.md) | Goal/Possibility Graph — Human Design 진본, 인간만 수정 |
| [workflow/WORKFLOW-OPS.md](workflow/WORKFLOW-OPS.md) | **Agent Workflow 운영 진본** — Package 구조·상태 기계·읽기 범위 |

## 작업 방식 — 단계별 Skill 로만 진행

설계 문서 전체를 읽고 작업하지 않는다. Design-Workflow.md §28 의 파이프라인을 4개 Skill 로 나눠 실행한다.
작업 단위는 `workflow/packages/<PKG-ID>/` 하나이며, 각 Skill 은 자기 단계 입력 파일만 읽는다.

| 단계 | Skill | 입력 → 출력 |
|---|---|---|
| Intent 추출 | `/advprotoh-intent` | Graph → 10-intent.md (INTENT_READY) |
| World 도출 | `/advprotoh-world-model` | Intent → 20-world.md (WORLD_READY) |
| Semantic Review | (인간) | 30-review.md 승인 (REVIEWED) |
| 구현 | `/advprotoh-implement` | Package → 코드 + 40-implementation.md (IMPLEMENTED) |
| 검증 | `/advprotoh-verify` | Closure 2종 + Runtime 실측 → 50-verification.md (VERIFIED) |

게이트: Review 승인 전 구현 금지, 선행 Status 미충족 시 해당 Skill 은 중단한다. 세부는 WORKFLOW-OPS.md.
