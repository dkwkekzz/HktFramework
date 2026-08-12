# Cycles

Cycle Artifact 저장소. 각 Cycle 디렉터리가 곧 Workflow 의 진행 기록이다.

```text
cycles/
    INDEX.md
    _template/
    C012-inventory-capacity/
        01-cycle.md
        02-intent.md
        03-world-semantic.md
        04-gameview.spec.yaml
        05-review.md
        06-world-implementation.md
        07-view-implementation.md
        08-verification.md
```

## 규칙

- 새 Cycle 은 `_template/` 을 복사해 `C<번호>-<이름>/` 으로 시작한다.
- 각 Artifact 는 해당 Stage Guide (`guides/`) 의 OUTPUT 형식을 따른다.
- **과거 Cycle Artifact 는 수정하지 않는다.** 당시의 설계와 결과를 기록하는 History 다.
- 실제 구현(`world/` `view/` `protocol/`)은 후속 Cycle 로 계속 발전한다.

```text
Cycle Artifact History     과거 기록      변경하지 않는다
Current World / View       현재 게임      계속 변경된다
```

## 상태 표기

각 Cycle 의 진행 상태는 `01-cycle.md` 상단에 둔다.

```text
CYCLE C012 — Inventory Capacity

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS
```

## Agent 실행 형태

```text
AGENTS.md 와 guides/intent.md 를 읽어라.
cycles/C012-inventory-capacity/01-cycle.md 를 입력으로 사용한다.
Intent 단계를 수행하고
cycles/C012-inventory-capacity/02-intent.md 를 작성하라.
```

전체 Design 문서를 읽히지 않는다. 관련 기존 Semantic 만 추가로 확인시킨다.
