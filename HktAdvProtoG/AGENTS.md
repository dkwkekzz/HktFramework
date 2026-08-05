# HktAdvProtoG Agent Bootstrap

이 프로젝트의 설계 및 구현 기준은
[docs/Design-ModulePlan-CycleWorkflow.md](docs/Design-ModulePlan-CycleWorkflow.md) 다.

작업을 시작하기 전에 요청 유형을 분류하고 해당 작업용 Skill **하나**를 우선 적용한다.

| 요청 유형 | Skill |
|---|---|
| 새 Cycle 설계 | `advprotog-cycle-planner` |
| Module Step 구현 | `advprotog-step-implementer` |
| Scenario 와 완료 증거 검증 | `advprotog-scenario-verifier` |
| Cycle 전체 통합과 회귀 검증 | `advprotog-cycle-integrator` |
| Workflow 또는 Skill 구조 변경 | `advprotog-workflow-maintainer` |

한 세션 = 한 작업 모드 = 하나의 주 Skill.
예외적으로 step-implementer 가 작업 완료 후 제한된 Scenario 를 실행하는 것은
허용하지만, Cycle 전체 판정은 cycle-integrator 의 별도 작업이어야 한다.

## 공통 불변 규칙

1. 검증되지 않은 Cycle 을 다음 Cycle 의 기준선으로 사용하지 않는다.
2. World State 는 사건 없이 변경하지 않는다.
3. 클라이언트가 권위 상태를 직접 확정하지 않는다.
4. 모듈을 하드코딩으로 우회하지 않는다.
5. Cycle 은 단일 테스트 장면이 아니라 플레이 가능한 MMORPG 지역이다.
6. 상세 규칙은 Skill 과 Workflow 문서(docs/Design-ModulePlan-CycleWorkflow.md)를 따른다.
