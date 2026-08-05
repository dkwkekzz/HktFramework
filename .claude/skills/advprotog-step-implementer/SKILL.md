---
name: advprotog-step-implementer
description: HktAdvProtoG 의 Module Step 하나(또는 밀접한 소규모 Step 묶음)를 구현한다 — 계약·코드 비교 → 최소 구현 범위 확정 → 구현 → 이전/다음 모듈 연결 → 플레이어 가시 결과 → 테스트·Scenario → 완료 증거. 사용자가 "Cxx-yy 구현 / Step 구현 / AdvProtoG 구현 / step implement" 를 요청하면 사용.
---

# HktAdvProtoG Module Step 구현

**작업 디렉토리: `HktAdvProtoG/`** — 이하 상대 경로는 이 폴더 기준.

이 스킬은 **하나의 Module Step 또는 밀접한 소규모 Step 묶음**만 구현한다.
지정된 Step 범위를 넘지 마라. Cycle 전체 통합·VERIFIED 판정은
`advprotog-cycle-integrator` 의 별도 작업이다.

## 작업 시작 시 읽는다

1. [docs/Design-ModulePlan-CycleWorkflow.md](../../HktAdvProtoG/docs/Design-ModulePlan-CycleWorkflow.md) 에서
   Module Step 작업 모드(§8), 얇은 구현·우회 구현 구분(§4), Implementation Task 분해(Phase 9),
   Step Gate·Handoff Gate(Phase 10) 섹션 — 전체를 복사하지 말고 해당 섹션만 읽는다.
2. 현재 Cycle 의 `cycles/<cycle-id>/CYCLE.md`
3. 현재 Step 이 포함된 `cycles/<cycle-id>/STEPS.md`
4. 관련 `cycles/<cycle-id>/SCENARIOS.md` 와 `ACCEPTANCE.md`
5. 이전 Step 의 완료 증거 (`cycles/<cycle-id>/evidence/`)

## 입력

* Cycle ID / Step ID
* Cycle 계약과 Step 계약
* 관련 Scenario
* 현재 코드
* 이전 Step 완료 증거

## 절차

```text
계약과 현재 코드 비교
→ 최소 구현 범위 확정
→ 타입·함수·상태·이벤트 구현
→ 이전 모듈 출력 연결
→ 다음 모듈 소비자 연결
→ 플레이어에게 보이는 결과 구현
→ 테스트와 Scenario 실행
→ 완료 증거 생성
```

구현 시 지켜야 할 허용·금지 경계와 REUSE Step 의무는
[references/implementation-rules.md](references/implementation-rules.md) 를 따른다.

작업 완료 후 해당 Step 에 연결된 **제한된 Scenario 실행**은 허용한다.
Cycle 전체 판정은 하지 않는다.

## 출력

* 구현 코드
* 테스트
* Lab 검증
* Step 완료 증거 (`cycles/<cycle-id>/evidence/`)
* 변경 보고서 — 형식은 [references/step-report-format.md](references/step-report-format.md)

## 실패 시

게임 현상 문제를 X 계층만 임시 수정하지 마라.
R/E/W/P/D 까지 인과를 추적해 최초로 잘못된 출력을 낸 Step 을 수정한다
(원본 문서 §19).
