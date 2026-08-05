---
name: advprotog-cycle-planner
description: HktAdvProtoG 의 다음 Cycle 을 설계한다 — 현재 상태 확인 → Cycle 후보 3개 생성 → 후보 선택 → Cycle Contract 작성 → 인과 역추적 → Module Step 계획 → 구현 순서 → cycles/<cycle-id>/ 산출물 6종. 아직 코드를 수정하지 않는다. 사용자가 "다음 Cycle 설계 / Cycle 계획 / AdvProtoG Cycle 설계 / cycle plan / cycle planner" 를 요청하면 사용.
---

# HktAdvProtoG 다음 Cycle 설계

**작업 디렉토리: `HktAdvProtoG/`** — 이하 상대 경로는 이 폴더 기준.
설계·구현 기준 단일 원본은
[docs/Design-ModulePlan-CycleWorkflow.md](../../HktAdvProtoG/docs/Design-ModulePlan-CycleWorkflow.md) 다.

이 스킬은 **계획 전용**이다. 코드를 수정하지 않는다.

## 입력

* 현재 저장소의 실제 구현 상태
* 마지막 VERIFIED Cycle (없으면 "없음")
* `docs/Design-ModulePlan-CycleWorkflow.md`
* 이전 플레이테스트 결과와 미해결 위험

## 금지

* 코드 구현
* 단일 NPC 행동·단일 검증 장면을 Cycle 로 승격 (그것은 Scenario 다)
* 검증 장면을 Gameplay Loop 로 오인
* 현재 구현 상태를 조사하지 않고 계획 작성

---

## 1. 현재 상태 확인

다음을 먼저 조사하라.

* 마지막 VERIFIED Cycle
* 현재 모듈별 구현 상태
* 기존 Gameplay Loop
* 기존 Situation 과 Scenario
* 현재 플레이 가능한 지역과 콘텐츠
* 이전 Cycle 의 미해결 문제
* 회귀 테스트와 리플레이 상태
* 아직 검증되지 않은 핵심 설계 가정
* 코드에는 존재하지만 실제 플레이에서 사용되지 않는 기능

추측하지 말고 코드, 테스트, 완료 증거, 리플레이를 근거로 판단하라.

## 2. 다음 Cycle 후보 생성

다음 Cycle 후보를 3개 생성하라.

각 후보는 기능 목록이 아니라 하나의 소형 MMORPG 지역 또는 기존 지역의 MMORPG적 심화여야 한다.

각 후보에 다음을 제시하라.

* 플레이어 판타지
* 지역 또는 기존 지역의 변화
* 중앙 갈등
* 주요 세력과 주체
* 최소 3개의 연결된 Gameplay Loop
* 탐험 요소
* 전투 또는 위험 대응
* 자원과 경제 순환
* 제작 또는 성장
* 사회적 상호작용
* 여러 플레이어의 협력·경쟁 방식
* 영속적으로 남는 세계 변화
* 플레이어가 개입하지 않았을 때의 진행
* 주 깊이 축
* 보조 깊이 축
* 검증할 핵심 시스템 가설
* 예상 구현 범위
* 가장 큰 기술적 위험
* 기존 Cycle 과의 연결

배고픈 NPC, 음식 하나, 거래 한 번과 같은 단일 검증 장면을 Cycle 후보로 제안하지 마라.

## 3. 후보 선택

다음 기준으로 가장 적절한 후보 하나를 선택하라.

* MMORPG 경험 가치
* 현재 구조에서 가장 중요한 불확실성 검증
* 기존 구현 재사용 가능성
* 한 Cycle 안에서 검증 가능한 범위
* 이후 Cycle 확장성
* 기술적 위험 감소 효과
* 기존 Cycle 회귀 가능성

선택 이유와 제외한 후보들의 제외 이유를 명확히 작성하라.

## 4. Cycle Contract 작성

선택한 Cycle 에 대해 Cycle 기본 정보, MMORPG 구성, Gameplay Loop,
Situation(최소 5개), Scenario 를 작성하라.
각 항목의 필수 필드와 형식은
[references/cycle-output-schema.md](references/cycle-output-schema.md) 를 따른다.

MMORPG Identity Gate (원본 문서 Phase 12.1) 를 후보 평가와 계약 작성 양쪽에서 적용하라 —
탐험 지역·복수 역할·반복 Loop·자율 주체·경제·성장·멀티플레이·영속성 중
하나라도 완전히 없으면 Cycle 이 아니라 시스템 프로토타입이다.

## 5. 인과 역추적

최종 플레이 경험에서 다음 내부 원인까지 역추적하라.

```text
플레이 경험
← 공간과 UI
← 사건과 충돌
← 행동 의도
← 지각·믿음·기억
← 정식 세계 상태
← 세계 요구
← 가능성
← 의존성
← 주체
← 공리
```

모든 주요 장소, 자원, NPC, 세력, 능력, 경제 요소에 생성 근거를 부여하라.

## 6. Module Step 계획

`V → O → S → D → P → Q → W → R → E → G → C → X → N → A` 순서로 Cycle 의 Module Step 을 작성하라.
각 Step 의 필수 항목은 [references/cycle-output-schema.md](references/cycle-output-schema.md) 의
STEPS.md 절을 따른다. 모드는 CREATE / EXTEND / REFINE / HARDEN / REUSE 중 하나이며 SKIP 은 없다.

하나의 Step 이 너무 크면 구현 결과를 개별적으로 확인할 수 있는 하위 Step 으로 나눠라.

## 7. 구현 순서

모듈 순서를 지키면서도 중간마다 플레이 가능한 통합 상태를 확인할 수 있도록 구현 구간을 나눠라.

각 구간에 다음을 명시하라.

* 포함 Step
* 구현 결과
* 플레이 또는 Lab 에서 확인할 장면
* 자동 검증
* 다음 구간 진입 조건

## 8. 산출물

`cycles/<cycle-id>/` 에 다음 6종을 작성하라
(상세 스키마: [references/cycle-output-schema.md](references/cycle-output-schema.md)).

* `CYCLE.md`
* `CYCLE.yaml`
* `STEPS.md`
* `SCENARIOS.md`
* `ACCEPTANCE.md`
* `TRACE.graph.json`

계획 완료 후 아직 구현하지 말고, 다음 내용을 마지막에 보고하라.

1. 선택한 Cycle
2. 플레이어가 실제로 반복하게 될 활동
3. MMORPG 라고 판단할 수 있는 근거
4. 가장 먼저 구현할 Step
5. 가장 위험한 가정
6. Cycle 완료를 판정할 최종 플레이 장면
