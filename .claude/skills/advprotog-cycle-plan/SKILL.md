---
name: advprotog-cycle-plan
description: HktAdvProtoG 의 다음 Cycle 을 설계한다 — 현재 상태 확인 → Cycle 후보 3개 생성 → 후보 선택 → Cycle Contract 작성 → 인과 역추적 → Module Step 계획 → 구현 순서 → cycles/<cycle-id>/ 산출물 6종. 아직 코드를 수정하지 않는다. 사용자가 "다음 Cycle 설계 / Cycle 계획 / AdvProtoG Cycle 설계 / cycle plan" 을 요청하면 사용.
---

# HktAdvProtoG 다음 Cycle 설계

**작업 디렉토리: `HktAdvProtoG/`** — 이하 상대 경로는 이 폴더 기준.
운영 지침 원본은 [WORKFLOW.md](../../HktAdvProtoG/WORKFLOW.md),
구현 기준 원본은 [design/Design-ModulePlan-CycleWorkflow.md](../../HktAdvProtoG/design/Design-ModulePlan-CycleWorkflow.md) 다.

---

[`Design-ModulePlan-CycleWorkflow.md`](../../HktAdvProtoG/design/Design-ModulePlan-CycleWorkflow.md)와 현재 저장소의 구현 상태를 분석하여 다음 Cycle을 설계하라.

아직 코드를 수정하지 마라.

## 1. 현재 상태 확인

다음을 먼저 조사하라.

* 마지막 VERIFIED Cycle
* 현재 모듈별 구현 상태
* 기존 Gameplay Loop
* 기존 Situation과 Scenario
* 현재 플레이 가능한 지역과 콘텐츠
* 이전 Cycle의 미해결 문제
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
* 기존 Cycle과의 연결

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

선택한 Cycle에 대해 다음을 작성하라.

### Cycle 기본 정보

* Cycle ID
* 제목
* 기준 Cycle
* 플레이어 판타지
* 플레이 목표
* 시스템 가설
* 주 깊이 축
* 보조 깊이 축
* 범위 제한
* 이번 Cycle에서 의도적으로 구현하지 않을 내용

### MMORPG 구성

* 지역 구조
* 주요 장소
* 주요 주체
* 주요 세력
* 자원 종류
* 생산과 소비
* 운송과 거래
* 제작 결과
* 성장 결과
* 관계와 평판
* 멀티플레이 상호작용
* 저장할 영속 상태

### Gameplay Loop

각 Loop를 다음 형식으로 작성하라.

```text
초기 동기
→ 정보 획득
→ 준비
→ 행동
→ 위험 또는 충돌
→ 보상
→ 세계 상태 변화
→ 새로운 가능성
```

각 Loop가 다른 Loop와 어떻게 연결되는지도 작성하라.

### Situation

세계 상태와 주체 목적의 충돌로 발생하는 대표 Situation을 최소 5개 작성하라.

고정 퀘스트 문장으로 작성하지 말고 다음 구조로 작성하라.

* 발생 조건
* 참여 주체
* 충돌하는 의존성
* 관찰 가능한 현상
* 가능한 개입
* 개입하지 않은 결과
* 결과로 남는 상태
* 후속 Situation

### Scenario

각 Situation을 검증하기 위한 정상·실패·경계·멀티플레이·저장/복구 Scenario를 작성하라.

Scenario는 Cycle 목표가 아니라 검증 단위다.

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

`V → O → S → D → P → Q → W → R → E → G → C → X → N → A` 순서로 Cycle의 Module Step을 작성하라.

각 Step에 다음을 포함하라.

* Step ID
* 모드: CREATE / EXTEND / REFINE / HARDEN / REUSE
* 목적
* Cycle에서의 책임
* 플레이어에게 보이는 기여
* MMORPG Loop 기여
* 입력과 출력
* 읽고 쓰는 상태
* 이벤트
* 다음 모듈의 소비자
* 구현할 타입과 객체
* 구현할 함수
* 변경할 파일
* 새로 생성할 파일
* Scenario
* Lab 검증
* 자동 테스트
* 완료 조건
* 예상 위험

하나의 Step이 너무 크면 구현 결과를 개별적으로 확인할 수 있는 하위 Step으로 나눠라.

## 7. 구현 순서

모듈 순서를 지키면서도 중간마다 플레이 가능한 통합 상태를 확인할 수 있도록 구현 구간을 나눠라.

각 구간에 다음을 명시하라.

* 포함 Step
* 구현 결과
* 플레이 또는 Lab에서 확인할 장면
* 자동 검증
* 다음 구간 진입 조건

## 8. 산출물

다음 파일 형태로 계획을 작성하라.

* `cycles/<cycle-id>/CYCLE.md`
* `cycles/<cycle-id>/CYCLE.yaml`
* `cycles/<cycle-id>/TRACE.graph.json`
* `cycles/<cycle-id>/STEPS.md`
* `cycles/<cycle-id>/SCENARIOS.md`
* `cycles/<cycle-id>/ACCEPTANCE.md`

계획 완료 후 아직 구현하지 말고, 다음 내용을 마지막에 보고하라.

1. 선택한 Cycle
2. 플레이어가 실제로 반복하게 될 활동
3. MMORPG라고 판단할 수 있는 근거
4. 가장 먼저 구현할 Step
5. 가장 위험한 가정
6. Cycle 완료를 판정할 최종 플레이 장면
