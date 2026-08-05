---
name: advprotog-cycle-plan
description: HktAdvProtoG 의 다음 Cycle 하나를 설계한다 — 현재 상태 조사(코드·테스트·증거 근거) → 소형 MMORPG 후보 3개 → 선택과 배제 사유 → Cycle Contract → 인과 역추적 → V~A Module Step 계획 → 구현 구간 분할 → cycles/<id>/ 산출물 6종. 계획 전용이며 코드를 수정하지 않는다. 사용자가 "다음 Cycle 설계 / Cycle 계획 / AdvProtoG Cycle 설계 / cycle plan" 을 요청하면 사용.
---

# HktAdvProtoG 다음 Cycle 설계 — 실행 절차

**작업 디렉토리: `HktAdvProtoG/`** — 이하 상대 경로는 이 폴더 기준.
**규정 원본은 [WORKFLOW.md](../../HktAdvProtoG/WORKFLOW.md)** (상시 운영 규정) 와
[design/Design-CycleModulePlan.md](../../HktAdvProtoG/design/Design-CycleModulePlan.md) (절차·템플릿 원본) 다.
이 스킬은 그 규정을 효율적 순서로 실행하는 방아쇠일 뿐, 규정을 중복 기재하지 않는다.
어긋나면 WORKFLOW → Design-CycleModulePlan 순으로 이긴다.

## 이 스킬의 경계

**계획만 한다. 코드를 수정하지 않는다.** 산출물은 `cycles/<cycle-id>/` 문서 6종뿐이다.
구현은 사용자가 계획을 승인한 뒤 별도 요청으로 시작한다.

한 바퀴의 목표는 **Cycle 하나를 CONTRACTED 상태까지 세우는 것**이다.
아래 셋 중 하나면 중간에 끊고, 남은 것을 STATE.md TODO 에 남긴다.

- 마지막 Cycle 이 VERIFIED 가 아니다 (WORKFLOW §8 마지막 줄 — 기준선 없이 착수 금지)
- 후보 선택이 설계 판단으로 갈려 사용자에게 물어야 한다
- 조사 단계에서 규정 위반(§6 금지 목록)이 이미 코드에 있어 그 정리가 선행 작업이다

## 실행 순서 (토큰 효율)

1. **읽기 · 현재 상태 조사** — `STATE.md` 먼저, 그 다음 `WORKFLOW.md`, `cycles/` 의 최신 Cycle 문서만
   부분 읽기. `design/` 원문은 필요한 절만. 다음을 **추측하지 말고 코드·테스트·완료 증거·리플레이를
   근거로** 판단한다:
   마지막 VERIFIED Cycle · 모듈별 구현 상태 · 기존 Gameplay Loop · 기존 Situation/Scenario ·
   현재 플레이 가능한 지역과 콘텐츠 · 이전 Cycle 미해결 문제 · 회귀 테스트와 리플레이 상태 ·
   아직 검증되지 않은 핵심 설계 가정 · 코드에는 있으나 실제 플레이에서 쓰이지 않는 기능.
   근거를 못 찾은 항목은 "근거 없음"으로 적는다 — 채워 넣지 않는다.
2. **후보 3개** — 각 후보는 기능 목록이 아니라 **하나의 소형 MMORPG 지역 또는 기존 지역의 MMORPG적
   심화**여야 한다 (WORKFLOW §2·§4). 후보마다:
   플레이어 판타지 · 지역 또는 기존 지역의 변화 · 중앙 갈등 · 주요 세력과 주체 ·
   **최소 3개의 연결된 Gameplay Loop** · 탐험 · 전투 또는 위험 대응 · 자원과 경제 순환 ·
   제작 또는 성장 · 사회적 상호작용 · 멀티플레이 협력·경쟁 방식 · 영속적으로 남는 세계 변화 ·
   플레이어 미개입 시의 진행 · 주 깊이 축 · 보조 깊이 축 · 검증할 핵심 시스템 가설 ·
   예상 구현 범위 · 가장 큰 기술적 위험 · 기존 Cycle과의 연결.
   배고픈 NPC·음식 하나·거래 한 번 같은 단일 검증 장면은 후보로 제안하지 않는다.
3. **선택** — MMORPG 경험 가치 · 가장 중요한 불확실성 검증 · 기존 구현 재사용 가능성 ·
   한 Cycle 안에서 검증 가능한 범위 · 이후 Cycle 확장성 · 기술적 위험 감소 효과 ·
   기존 Cycle 회귀 가능성으로 하나를 고르고, **선택 이유와 배제한 두 후보의 배제 이유**를 남긴다.
4. **Cycle Contract** — 선택한 Cycle에 대해 세 묶음을 쓴다.
   - *기본*: Cycle ID · 제목 · 기준 Cycle · 플레이어 판타지 · 플레이 목표 · 시스템 가설 ·
     주/보조 깊이 축 · 범위 제한 · **의도적으로 구현하지 않을 내용**
   - *MMORPG 구성*: 지역 구조 · 주요 장소 · 주요 주체 · 주요 세력 · 자원 종류 · 생산과 소비 ·
     운송과 거래 · 제작 결과 · 성장 결과 · 관계와 평판 · 멀티플레이 상호작용 · 저장할 영속 상태
   - *Gameplay Loop*: 각 Loop 를 `초기 동기 → 정보 획득 → 준비 → 행동 → 위험 또는 충돌 → 보상
     → 세계 상태 변화 → 새로운 가능성` 형식으로 쓰고, **Loop 간 연결**도 함께 쓴다.
5. **Situation 최소 5개** — 고정 퀘스트 문장으로 쓰지 말고 구조로 쓴다: 발생 조건 · 참여 주체 ·
   충돌하는 의존성 · 관찰 가능한 현상 · 가능한 개입 · **개입하지 않은 결과** · 결과로 남는 상태 ·
   후속 Situation.
6. **Scenario** — 각 Situation마다 정상·실패·경계·멀티플레이·저장/복구 Scenario 를 쓴다.
   Scenario 는 Cycle 목표가 아니라 검증 단위다 (WORKFLOW §2·§3).
7. **인과 역추적** — 최종 플레이 경험에서
   `공간·UI ← 사건·충돌 ← 행동 의도 ← 지각·믿음·기억 ← 정식 세계 상태 ← 세계 요구 ← 가능성
   ← 의존성 ← 주체 ← 공리` 로 내려가며, **모든 주요 장소·자원·NPC·세력·능력·경제 요소에 생성
   근거**를 부여한다. 근거를 못 만든 요소는 Cycle 범위에서 뺀다.
8. **Module Step 계획** — `V → O → S → D → P → Q → W → R → E → G → C → X → N → A` 순서로 쓴다.
   각 Step 필수 항목은 WORKFLOW §5 를 따르고, 여기에 Step ID · 변경할 파일 · 새로 생성할 파일 ·
   예상 위험을 더한다. 구현 결과를 개별로 확인할 수 없을 만큼 큰 Step 은 하위 Step 으로 쪼갠다.
9. **구현 구간 분할** — 모듈 순서를 지키면서도 중간마다 플레이 가능한 통합 상태를 확인할 수 있게
   구간을 나누고, 구간마다 포함 Step · 구현 결과 · 플레이 또는 Lab 에서 확인할 장면 · 자동 검증 ·
   다음 구간 진입 조건을 명시한다.
10. **산출물 · 보고** — 아래 6개 파일을 쓰고 STATE.md 를 갱신한 뒤 **구현하지 말고** 보고한다.

## 산출물

```text
cycles/<cycle-id>/CYCLE.md          4~7 (계약 · Loop · Situation · 역추적 서술)
cycles/<cycle-id>/CYCLE.yaml        4 의 기계 판독 계약 (Design-CycleModulePlan §12 템플릿)
cycles/<cycle-id>/TRACE.graph.json  7 의 역추적 그래프
cycles/<cycle-id>/STEPS.md          8~9 (Module Step + 구현 구간)
cycles/<cycle-id>/SCENARIOS.md      6
cycles/<cycle-id>/ACCEPTANCE.md     WORKFLOW §8 완료 판정을 이 Cycle 기준으로 구체화
```

## 마지막 보고 (이 6개만)

1. 선택한 Cycle
2. 플레이어가 실제로 반복하게 될 활동
3. MMORPG라고 판단할 수 있는 근거
4. 가장 먼저 구현할 Step
5. 가장 위험한 가정
6. Cycle 완료를 판정할 최종 플레이 장면

## 하지 말 것

- **코드를 수정하지 않는다** — 이 스킬의 산출물은 `cycles/<id>/` 문서뿐이다.
- `design/` 원문을 수정하지 않는다 — 파생(WORKFLOW.md · STATE.md · cycles/)만 갱신한다.
- 마지막 Cycle 이 VERIFIED 가 아닌데 다음 Cycle 을 착수하지 않는다 (WORKFLOW §8).
- 단일 검증 장면(배고픈 NPC·자원 충돌 하나)을 Cycle 후보로 올리지 않는다 (WORKFLOW §2).
- 조사 근거를 추측으로 채우지 않는다 — 없으면 "근거 없음"으로 적는다.
- 주 깊이 축과 보조 깊이 축을 둘 넘게 잡지 않는다 (WORKFLOW §4).
- 다음 모듈이나 Gameplay Loop 에서 소비되지 않는 출력을 Step 계획에 넣지 않는다 (WORKFLOW §5).
- 장황한 설계 일지를 쓰지 않는다 — 위 6개 보고 항목과 산출물 파일만 낸다.
