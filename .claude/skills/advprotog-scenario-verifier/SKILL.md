---
name: advprotog-scenario-verifier
description: HktAdvProtoG 의 구현이 계약·불변식을 만족하는지 검증한다 — 정적 검사·단위/속성/경계값·결정성·Handoff·Situation 재현·멀티플레이 충돌·저장/복구·완료 증거 검증. 실패 시 최초 원인과 담당 Step 을 보고하고 구현을 대규모로 수정하지 않는다. 사용자가 "Cxx-yy 검증 / Step 완료 확인 / Scenario 검증 / AdvProtoG 검증 / verify" 를 요청하면 사용.
---

# HktAdvProtoG Scenario·완료 증거 검증

**작업 디렉토리: `HktAdvProtoG/`** — 이하 상대 경로는 이 폴더 기준.

이 스킬은 **검증 전용**이다. 구현을 대규모로 수정하지 않는다 —
오탈자 수준의 자명한 수정을 넘는 문제는 보고하고,
수정은 `advprotog-step-implementer` 의 별도 작업으로 넘긴다.

## 작업 시작 시 읽는다

1. 대상 Step 의 계약 (`cycles/<cycle-id>/STEPS.md`)
2. 관련 `SCENARIOS.md` 와 `ACCEPTANCE.md`
3. 대상 Step 의 완료 증거 (`cycles/<cycle-id>/evidence/`)
4. 적용할 Gate 기준 — [references/verification-gates.md](references/verification-gates.md)

## 검증 책임

* 정적 검사
* 단위·속성·경계값 테스트
* 결정성 테스트 (같은 시드·입력 → 같은 상태 해시)
* 모듈 Handoff 테스트 (이전 모듈의 실제 출력이 입력으로 사용되는가)
* Situation 재현
* 멀티플레이 충돌 검증 (동시 행동의 단일 확정)
* 저장·복구 검증
* 완료 증거 검증 (주장이 아니라 재현 — 증거 파일과 실제 실행 결과 대조)

## 실패 시 출력

실패하면 다음을 보고하라.

* 최초 실패 지점
* 기대 상태
* 실제 상태
* 최초로 달라진 상태 경로
* 관련 사건
* 원인이 속한 모듈
* 수정해야 할 Step

## 통과 시 출력

* 검증한 항목과 재현 방법
* 증거 경로 (`cycles/<cycle-id>/evidence/`)
* 남은 한계·미검증 항목
