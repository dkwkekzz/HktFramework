# artifacts/ — Stage 간 Handoff 저장소

Workflow 의 Stage 를 잇는 것은 **대화가 아니라 이 폴더의 파일**이다.
Artifact 에 없는 정보는 다음 Stage 에게 **존재하지 않는 정보**다.

```
Human Design (design/graph/)
        ↓
intent/          INTENT-*        Stage 1
        ↓
world/           WORLD-*         Stage 2   (Review Status: DRAFT)
        ↓
                 Human Semantic Review     Stage 3  → APPROVED 만 통과
        ↓
implementation/  IMPL-*          Stage 4
        ↓
verification/    VERIFY-*        Stage 5
        ↓
                 Human Observation
```

`design-gaps/` 는 어느 Stage 에서든 나올 수 있다. `Blocking: yes` 인 Gap 이 열려 있으면
그 계열의 후속 Stage 는 실행하지 않는다.

`REGISTRY.md` 가 색인이다. Stage Router 가 가장 먼저 읽는다.

양식·ID 규칙: `.claude/skills/observable-world-workflow/references/artifact-contracts.md`
