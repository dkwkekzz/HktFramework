# Stage 3 — Human Semantic Review

**인간 전용 Gate.** Agent 가 이 Stage 를 스스로 통과시킬 수 없다.

## 검토 질문

> 이 World State / World Rule 이 내가 정의한 Intent 를 정확하게 표현하는가?

## 입력

```text
cycles/<cycle-id>/01-INTENT-PACKAGE.md
cycles/<cycle-id>/02-WORLD-DEFINITION-PACKAGE.md
```

## 출력

```text
cycles/<cycle-id>/03-SEMANTIC-REVIEW-RESULT.md
```

템플릿: [../templates/SEMANTIC-REVIEW-RESULT.md](../templates/SEMANTIC-REVIEW-RESULT.md)

## 인간이 보는 지점

| # | 볼 것 |
|---|---|
| 1 | Intent 문장의 각 의미가 State / Rule 로 **정확히** 옮겨졌는가 — 더 강하지도, 더 약하지도 않게 |
| 2 | Precondition 이 내가 의도한 "할 수 있음" 의 경계와 같은가 |
| 3 | Transition 이 내가 의도한 세계 변화와 같은가 |
| 4 | Observable Contract 를 보고 내가 세계를 이해할 수 있는가 |
| 5 | 실패했을 때 **왜 실패했는지** 를 볼 수 있는가 |
| 6 | Deferred 로 선언한 것이 슬쩍 들어와 있지 않은가 |

## 결과

```text
APPROVED
```

또는

```text
REJECTED

Reason:
    ...

Required Change:
    ...
```

`APPROVED` 가 아닌 World Definition 은 **Stage 4 로 전달할 수 없다.**

## REJECTED 이후

Stage 2 를 **별도 invocation 에서** 다시 실행한다.
`Required Change` 가 Stage 2 재실행의 추가 입력이 된다.

## Agent 의 역할

Agent 는 이 Stage 에서 다음만 할 수 있다.

```text
허용                                   금지
Review 대상 요약 제시                   스스로 APPROVED 기록
인간의 판정을 03 Artifact 로 기록        "문제 없어 보이므로 진행" 판단
REJECTED 사유를 구조화                   Review 없이 Stage 4 시작
```
