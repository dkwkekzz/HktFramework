# Implementation Package 템플릿

`cycles/<cycle-id>/PACKAGE.md` 로 작성한다. Design-Workflow §19 + Design-CycleWorkflow §19 + Design-GameView §26 확장판.
View Definition(6·7절 상세)은 별도 파일 `cycles/<cycle-id>/VIEW.md` 로 분리하고 여기서는 참조만 한다.

```text
PACKAGE <CYCLE-ID>

1. SOURCE DESIGN
   Cycle Goal (플레이 경험 문장)
   Goal / Possibility Graph (ID 부여: GOAL-*, POSSIBILITY-*)

2. INTENT
   INTENT-<도메인>-NNN
   세계에서 무엇이 참이어야 하는가 (구현 요구사항 금지)
   Source Goal / Source Possibility 참조

3. REQUIRED WORLD STATE
   세계의 사실만. Decision Semantic State(Knowledge, CurrentGoal 등) 포함.
   기존 Module 이 이미 제공하는 Semantic 은 [기존: <Module>] 로 표기.

4. REQUIRED WORLD RULE
   RULE-<이름>-NNN: Input / Preconditions / Transition / Result
   Implements: INTENT-* / Derived From: GOAL-*, POSSIBILITY-*

5. OBSERVABLE CONTRACT
   상태: 노출해야 하는 Semantic State 목록
   전이: Before / Input / Rule / After 단위
   Possibility 가용성: AVAILABLE/UNAVAILABLE + reason

6. VISUAL REQUIREMENT
   인간이 게임 공간에서 무엇을 볼 수 있어야 하는가 (구현 금지, 요구만)

7. VIEW DEFINITION
   → cycles/<cycle-id>/VIEW.md 참조

8. REQUIRED GAMEVIEW CAPABILITIES
   gameview/VOCABULARY.md 의 ✅ 어휘 목록 (전부 ✅ 여야 구현 착수 가능)
   부족분: 조합 우회 방안 또는 GVP-NNN Proposal 참조

9. EXISTING MODULE DEPENDENCIES
   state/REGISTRY.md 조회 결과 — 사용할 기존 Module 과 사용 방식 (Black Box)

10. NEW MODULE BOUNDARY
    이번 Cycle 이 새로 만드는 Module 의 Requires / Provides 초안

11. CONSTRAINTS
    변경 불가 항목 (Goal/Possibility/Intent/Rule 의미, 기존 Module 내부, gameview/ 내부)

12. COMPLETION CONDITIONS
    Positive Scenario / Negative Scenario / Gate 체크 방법
```
