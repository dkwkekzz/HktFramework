---
name: advprotog-cycle-integrator
description: HktAdvProtoG 의 Step 들이 개별 통과한 뒤 Cycle 전체를 MMORPG 로 통합 검증하고 VERIFIED 여부를 판정한다 — Loop 연결·Situation 발생·경제 순환·성장 전후·무개입 진행·다중 플레이어·영속·이전 Cycle 회귀. 사용자가 "Cxx 통합 / Cycle 통합 검증 / VERIFIED 판정 / AdvProtoG 통합" 을 요청하면 사용.
---

# HktAdvProtoG Cycle 통합·VERIFIED 판정

**작업 디렉토리: `HktAdvProtoG/`** — 이하 상대 경로는 이 폴더 기준.

핵심 질문은 하나다.

> 개별 시스템이 존재하는가가 아니라,
> 플레이어가 반복할 수 있는 MMORPG 활동으로 연결되어 있는가?

## 작업 시작 시 읽는다

1. 대상 Cycle 의 `cycles/<cycle-id>/CYCLE.md`, `ACCEPTANCE.md`
2. 전체 Step 완료 증거 (`cycles/<cycle-id>/evidence/`)
3. 판정 기준 — [references/integration-gates.md](references/integration-gates.md)
4. [docs/Design-ModulePlan-CycleWorkflow.md](../../HktAdvProtoG/docs/Design-ModulePlan-CycleWorkflow.md)
   Phase 12(Acceptance Gate)·Phase 13(플레이 테스트)·Phase 14(동결) 섹션

## 검증 책임

* Gameplay Loop 연결 확인 (Loop 간 상태가 실제로 흐르는가)
* Situation 의 실제 발생 확인 (계산된 압력에서 발생하는가, 스크립트인가)
* 경제 순환 검증 (생산·소비·재고·교환 가치가 닫힌 순환인가)
* 성장 전후 검증 (성장이 가능한 행동을 실제로 바꾸는가)
* 플레이어 무개입 진행 검증 (세계가 혼자 움직이는가)
* 다중 플레이어 개입 검증 (협력·경쟁·거래가 공유 상태를 바꾸는가)
* 영속 상태 검증 (저장·재접속 후 결과 유지)
* 이전 Cycle 회귀 검증 (모든 이전 VERIFIED Cycle 의 대표 리플레이)
* Cycle VERIFIED 판정

## 판정 규칙

* Gate 하나라도 완전히 실패하면 VERIFIED 가 아니다 — 가장 약한 Loop·시스템과
  수정해야 할 Step 을 보고하고, 수정은 `advprotog-step-implementer` 로 넘긴다.
* 플레이 테스트 문제는 기능 요청으로 바로 변환하지 않는다 —
  `관찰된 문제 → 약한 Loop → 미발생 Situation → 부족한 모듈 출력 → 수정 Step 또는 다음 Cycle 후보` 로 역추적한다.
* 모든 Gate 통과 시 Phase 14 의 동결 산출물을 생성하고 VERIFIED 로 기록한다.
* 검증되지 않은 Cycle 을 다음 Cycle 의 기준선으로 사용하지 않는다.
