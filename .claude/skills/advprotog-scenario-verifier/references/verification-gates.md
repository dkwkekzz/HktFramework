# 검증 Gate 기준

원본: [docs/Design-ModulePlan-CycleWorkflow.md](../../../HktAdvProtoG/docs/Design-ModulePlan-CycleWorkflow.md)
Phase 10(Step Gate·Handoff Gate), Phase 12.10(결정성·회귀), §6.3(완료 판정 순서).
충돌 시 원본 문서가 우선한다.

## 완료 판정 순서 (§6.3)

```text
Step 검증
→ 모듈 간 Handoff 검증
→ Situation 통합 검증
→ Cycle 전체 Gameplay Loop 검증
→ 멀티플레이 검증
→ 저장·재접속 검증
→ 이전 Cycle 전체 회귀 검증
→ 완료 증거 생성
```

이 스킬의 담당은 앞의 세 단계(Step·Handoff·Situation)와 결정성·저장/복구다.
Cycle 전체 Loop·멀티플레이·회귀의 **종합 판정**은 `advprotog-cycle-integrator` 담당이다.

## Step Gate (Phase 10)

* 입력·출력 스키마 등록
* 정상·실패·경계 테스트 통과
* 결정성 확인
* Scenario 연결
* Lab 에서 처리 과정 확인
* 플레이어 기여 증거 확인
* 완료 증거 생성

## Module Handoff Gate (Phase 10)

* 이전 모듈의 실제 출력이 다음 모듈 입력으로 사용됨
* 운영 경로에 테스트 하드코딩이 없음
* 미소비 출력이 없음
* 오류가 숨겨지지 않음
* 인과 추적 ID 유지
* 상태 변경은 사건을 통해서만 발생

## 결정성 (Phase 12.10)

* 같은 시드와 입력에서 같은 최종 상태 해시
* 차이가 생기면 최초 차이 Tick 과 상태 경로 출력
* 저장·불러오기 리플레이 통과

## Scenario 종류별 검증 질문 (Phase 6)

인과 / 공간 / 경제 / 사회 / 충돌 / 멀티플레이 / 영속 / 회귀 —
각 종류의 검증 질문 표는 원본 문서 Phase 6 을 따른다.
