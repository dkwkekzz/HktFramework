# Module Contract 템플릿

`world/modules/<module>/MODULE.md` 로 작성한다 (Design-CycleWorkflow §10·§24).

```text
MODULE <이름>

IDENTITY
    ID / Version / 산출 Cycle

REQUIRES
    이 Module 이 세계에 존재하기 위해 필요한 World Semantic
    (구현 클래스가 아니라 세계 의미로 기술)

PROVIDES
    Possibility:
    Rule:
    Transition:
    Observable:

WORLD SEMANTIC DEPENDENCIES
    공유 Semantic 사용 목록 (REGISTRY 의 공유 World Semantic 참조)

TRACEABILITY
    Goal → Possibility → Intent → Rule → Runtime Transition 매핑

VERIFICATION SCENARIOS
    Positive: ...
    Negative: 각 Precondition 별 UNAVAILABLE + reason

VIEW DEFINITION
    이 Module 을 검증한 Cycle 의 VIEW.md 참조
```
