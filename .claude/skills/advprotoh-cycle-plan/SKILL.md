---
name: advprotoh-cycle-plan
description: HktAdvProtoH 의 Cycle 하나를 설계한다 — Cycle Goal 확정 → Module Registry 조회 → Goal/Possibility → Intent → World State/Rule → Observable Contract → Visual Requirement → Capability Resolution(VOCABULARY 대조) → View Definition → Implementation Package. 코드를 수정하지 않으며 인간 Semantic Review 요청으로 끝난다. 사용자가 "AdvProtoH Cycle 설계 / 다음 Cycle 계획 / cycle plan" 을 요청하면 사용.
---

# HktAdvProtoH Cycle 설계 (Stage 1~7 + Human Review 요청)

**작업 디렉토리: `HktAdvProtoH/`** — 이하 상대 경로는 이 폴더 기준.
기준 문서: [design/Design-CycleWorkflow.md](../../HktAdvProtoH/design/Design-CycleWorkflow.md) · [design/Design-Workflow.md](../../HktAdvProtoH/design/Design-Workflow.md) · [design/Design-GameView.md](../../HktAdvProtoH/design/Design-GameView.md).

이 스킬은 **설계 전용**이다. `world/`·`app/`·`gameview/` 코드를 수정하지 않는다.

## 읽기

**필수**: `state/REGISTRY.md` · `state/CYCLES.md` · `gameview/VOCABULARY.md`(✅ 어휘 확인용 — GameView 문서 중 이것만).
**금지**: `gameview/` 내부 코드·GAMEVIEW.md·STATE.md (트랙 경계 — Vocabulary 가 인터페이스의 전부다).

## 절차

### 1. Cycle Goal 확정
사용자가 제시한 목표를 **플레이 경험 문장**으로 확정한다. 기술 작업 목록("Inventory 시스템을 만든다")이면 반려하고 플레이 경험("Player 가 광맥에 접근해 Stone 을 획득할 수 있다")으로 재정의를 요청한다. 사람이 직접 플레이해 확인할 수 있을 만큼 작아야 한다.

### 2. Module Resolution
`state/REGISTRY.md` 를 조회해 이번 Goal 에 필요한 Semantic 중 **이미 존재하는 것 / 새로 만들 것**을 가른다. 기존 Capability 는 재구현 금지 — Black Box 로 사용 계획만 세운다.

### 3. Goal / Possibility Graph
이번 Cycle 범위만큼만 작게. 모든 노드에 ID 부여 (`GOAL-*`, `POSSIBILITY-*`).

### 4. Intent Extraction
`INTENT-<도메인>-NNN`. 세계에서 무엇이 참이어야 하는가만 — 클래스·함수 언급 금지. Source Goal/Possibility 역참조 필수.

### 5. World State / Rule 설계
- State: 세계의 사실만. `이것은 세계의 사실인가, 프로그램 구현의 사실인가?` 를 매 항목 질문. 판단에 영향을 주는 상태(Knowledge, CurrentGoal 등)는 Decision Semantic State 로 포함.
- Rule: `Input / Preconditions / Transition / Result` + `Implements: INTENT-*` 추적 정보.
- **Semantic Closure 사전 검사**: Intent 의 모든 문장이 State 또는 Rule 로 연결되는지 표로 확인. 끊긴 문장 하나라도 있으면 설계 미완.

### 6. Observable Contract (State/Rule 과 동시에)
- 노출 상태 + `Before / Input / Rule / After` 전이 단위 + Possibility 가용성(AVAILABLE/UNAVAILABLE + reason).
- **Observable Closure 사전 검사**: Rule 의 모든 Precondition 이 관측 가능한지 확인.

### 7. Visual Requirement → Capability Resolution → View Definition
1. Visual Requirement: 인간이 게임 공간에서 봐야 하는 것을 요구로만 기술.
2. Capability Resolution: 필요한 표현을 `gameview/VOCABULARY.md` 의 ✅ 어휘와 대조.
   - ✅ 로 충족 → 그대로 binding.
   - 부족 → 먼저 ✅ Primitive **조합**으로 우회 설계 (사다리 ①②).
   - 조합으로도 불가 → `gameview/proposals/GVP-NNN-<slug>.md` 생성 ([templates/capability-proposal.md](../../HktAdvProtoH/templates/capability-proposal.md)). **이것이 이 스킬이 gameview/ 아래에 쓸 수 있는 유일한 파일이다.** Proposal 이 필요한 표현은 Cycle 을 막지 않도록 가능하면 임시 조합 표현을 함께 설계한다.
3. View Definition: `cycles/<cycle-id>/VIEW.md` ([templates/view-definition.md](../../HktAdvProtoH/templates/view-definition.md)). ✅ 어휘만 binding, View 내 Rule 재판단 금지.

### 8. 산출물
- `cycles/<cycle-id>/PACKAGE.md` — [templates/implementation-package.md](../../HktAdvProtoH/templates/implementation-package.md) 12개 절 전부.
- `cycles/<cycle-id>/VIEW.md`
- (필요시) `gameview/proposals/GVP-NNN-*.md`
- `state/CYCLES.md` 에 상태 `PLANNED` 로 1행 추가.

### 9. Human Semantic Review 요청으로 종료
구현하지 말고 마지막에 보고한다:
1. Cycle Goal 과 플레이 확인 장면
2. Intent ↔ State/Rule 매핑 요약 (인간이 "내 의도가 정확히 표현됐는가"를 판단할 수 있게)
3. 재사용 Module / 신규 Module 경계
4. 사용 어휘와 부족분(Proposal) 목록
5. 리뷰 승인 시 다음 단계: `advprotoh-cycle-implement`

## 금지

- 코드 작성·수정 (Proposal 파일 생성 제외)
- Goal/Possibility 를 구현 편의로 축소·변경
- ⏳ 어휘를 전제로 한 View Definition
- Registry 조회 없이 Semantic 신규 정의
- gameview 내부 구조를 읽거나 가정하는 설계
