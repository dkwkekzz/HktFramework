# Stage 3 — Human Semantic Review (Gate)

이 단계는 **자동으로 생략할 수 없는 Gate** 다.
Agent 는 리뷰를 *대행*하지 않는다. Agent 의 역할은 **리뷰 대상을 읽기 쉽게 제시하고, 인간의 판단을 기록**하는 것뿐이다.

## 검토 질문

> 이 World Definition 이 원래 Human Design 의 의도를 정확하게 표현하는가?

검토 대상:

```
Intent
  ↓
World State / World Rule / Observable Contract
```

## Agent 가 하는 일

1. 대상 `WORLD-*` 를 읽는다 (`Review Status: DRAFT` 여야 한다).
2. 인간에게 다음을 **한 화면으로** 제시한다.
   - Trace (Goal → Possibility → Intent → World)
   - Intent Statement 원문
   - Required World State 요약
   - World Rule 의 Preconditions / Transition
   - Observable Contract 요약
   - Semantic Closure Checklist 의 **빈 칸과 약한 연결**
   - 열려 있는 Design Gap
3. 아래 체크리스트로 **의심 지점을 지적**한다 (판정이 아니라 제시).
4. 인간의 결정을 받는다 (`AskUserQuestion` 사용 가능).
5. 결정을 `WORLD-*` 의 `Review Status` / `Reviewed By` / `Reviewed At` / `Review Notes` 에 기록하고 REGISTRY 를 갱신한다.
6. **STOP** — 승인되었더라도 구현으로 넘어가지 않는다.

## 리뷰 체크리스트 (제시용)

```
[ ] Intent 문장의 모든 조건이 Precondition 으로 나타나는가
[ ] Intent 문장의 모든 결과가 Transition 으로 나타나는가
[ ] Intent 에 없는 조건/결과가 몰래 추가되지 않았는가
[ ] World State 에 Implementation State 가 섞이지 않았는가        (I3)
[ ] 선택에 영향을 주는 상태가 Planner 내부로 숨지 않았는가          (I4)
[ ] 의미 있는 상태 변화가 모두 Rule 에 귀속되는가                  (I5)
[ ] 각 Precondition 의 개별 판정값이 Observable 인가               (I6)
[ ] 실행되지 않은 이유(UNAVAILABLE Reason)가 Observable 인가       (I6)
[ ] View 가 Observable 만 읽도록 규정되었는가                     (I7)
[ ] Trace 가 Goal 까지 끊김 없이 이어지는가                       (I8)
```

## 결과 어휘

```
APPROVED            의도를 정확히 표현함. Stage 4 로 갈 수 있다.
REVISION REQUIRED   방향은 맞으나 수정 필요. Stage 2 를 다시 호출한다.
REJECTED            의도를 잘못 표현함. 또는 Design 자체를 바꿔야 함.
```

## 절대 금지

- Agent 가 스스로 `APPROVED` 를 기록하는 것.
- 인간의 응답 없이 "문제 없어 보이므로 승인으로 간주" 하는 것.
- World Model Agent 의 초안을 승인된 것으로 취급하는 것.
- 리뷰 중에 `WORLD-*` 의 의미를 Agent 가 고쳐 쓰는 것 — 수정은 Stage 2 재실행이다.

승인 근거는 **인간의 명시적 승인 발화**뿐이다. 그 발화를 `Review Notes` 에 인용해 남긴다.
