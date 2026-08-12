---
name: advprotoh-cycle-verify
description: HktAdvProtoH 의 구현된 Cycle 을 검증하고 완료 판정한다 — Semantic Closure → Observable Closure → Positive/Negative Runtime Scenario → GameView Completion Gate → Cycle Completion Gate(§25) → Module Packaging + Registry 등록. 실패 시 원인 단계를 보고하고 대규모 수정은 하지 않는다. 사용자가 "AdvProtoH 검증 / Cycle 검증 / VERIFIED 판정 / cycle verify" 를 요청하면 사용.
---

# HktAdvProtoH Cycle 검증·완료 판정 (Stage 10~11)

**작업 디렉토리: `HktAdvProtoH/`**. 대상은 `state/CYCLES.md` 상태 `IMPLEMENTED` 인 Cycle. 기준: [design/Design-CycleWorkflow.md](../../HktAdvProtoH/design/Design-CycleWorkflow.md) §22~§25 · [design/Design-GameView.md](../../HktAdvProtoH/design/Design-GameView.md) §30.

검증은 **주장이 아니라 재현**이다 — 실제 실행 결과·Transition 레코드·코드 라인 인용으로만 판정한다.

## 절차

### 1. Semantic Closure
PACKAGE §2 Intent 의 모든 문장 ↔ World State/Rule 구현 코드 매핑 표를 만든다. 연결 안 되는 문장 1개라도 있으면 FAIL.

### 2. Observable Closure
- Rule 의 모든 Precondition 이 Observable 에 노출되는가.
- Possibility 가용성이 reason 과 함께 노출되는가.
- Transition 이 `Before/Input/Rule/After` 로 기록되는가.
- View(Game·Inspector)가 **Observable 만** 읽는가 — World 내부 직접 참조 grep 으로 확인.

### 3. Runtime Scenario
- **Positive**: PACKAGE §12 시나리오를 실제 실행해 Before→After 수치를 Transition 레코드로 확인.
- **Negative**: 각 Precondition 을 하나씩 깨뜨린 상태를 실행해 `UNAVAILABLE + 올바른 reason` 을 확인. "실패한다"가 아니라 **왜 실패했는지가 보이는가**가 기준.

### 4. GameView Completion Gate (Design-GameView §30)
- View 가 ObservableWorldState 만 읽는가 / View 내부에 Rule 재판단이 없는가.
- 이번 Cycle 때문에 `gameview/` 에 World-specific 코드가 추가되지 않았는가 — `git log`/diff 로 `gameview/` 변경이 GameView 트랙 커밋(또는 Proposal 파일)뿐인지 확인.
- VIEW.md 의 어휘가 전부 VOCABULARY ✅ 인가.

### 5. 눈 검증
Playable Assembly 실행 방법을 제시하고 사용자 플레이 확인을 요청한다 (Game View 결과 + Inspector 의 설계 언어 확인). 자동 검증이 있어도 최종 권위는 인간 관찰이다.

### 6. Cycle Completion Gate
Design-CycleWorkflow §25 체크리스트 16항을 전부 판정해 `cycles/<cycle-id>/ACCEPTANCE.md` 에 항목별 증거(실행 로그·파일:라인)와 함께 기록한다. 하나라도 FAIL 이면 완료 아님 — 원인 단계(설계/구현/검증)와 담당 스킬을 보고하고 종료한다.

### 7. Module Packaging (전항 PASS 시)
1. `world/modules/<name>/MODULE.md` 작성 ([templates/module-contract.md](../../HktAdvProtoH/templates/module-contract.md)) — Requires/Provides/Traceability/Verification Scenarios.
2. `state/REGISTRY.md` 에 Module 등록 + 공유 World Semantic 표 갱신.
3. `state/CYCLES.md` 상태를 `VERIFIED` 로 갱신.

### 8. 마지막 보고
판정 결과(항목별 PASS/FAIL 요약), 등록된 Module, 사용자가 직접 확인할 플레이 장면, 발견된 이슈와 후속 제안.

## 금지

- 재현 없이 "동작한다" 판정 (코드가 있어 보인다 ≠ PASS)
- 검증 중 발견한 문제의 대규모 수정 — 원인 보고까지만, 수정은 담당 스킬 재실행으로
- Negative Scenario 생략
- Gate FAIL 상태에서 Module 등록
