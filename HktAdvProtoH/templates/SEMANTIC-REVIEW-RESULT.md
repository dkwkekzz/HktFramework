# CYCLE-<NNN> — Semantic Review Result

> Stage 3 산출물. **인간이 판정한다.** Agent 가 스스로 APPROVED 를 기록하지 않는다.

## 검토 대상

```text
01-INTENT-PACKAGE.md
02-WORLD-DEFINITION-PACKAGE.md
```

## 검토 질문

> 이 World State / World Rule 이 내가 정의한 Intent 를 정확하게 표현하는가?

## 검토 항목

| # | 항목 | 판정 | 비고 |
|---|---|---|---|
| 1 | Intent 의 각 의미가 State / Rule 로 정확히 옮겨졌는가 (더 강하지도 약하지도 않게) | | |
| 2 | Precondition 이 의도한 "할 수 있음" 의 경계와 같은가 | | |
| 3 | Transition 이 의도한 세계 변화와 같은가 | | |
| 4 | Observable Contract 만 보고 세계를 이해할 수 있는가 | | |
| 5 | 실패했을 때 왜 실패했는지 볼 수 있는가 | | |
| 6 | Deferred 로 선언한 것이 들어와 있지 않은가 | | |

## 판정

```text
APPROVED
```

또는

```text
REJECTED

Reason:


Required Change:

```

## 판정자 / 일시

```text
판정자:
일시:
```

---

`APPROVED` 가 아니면 Stage 4 로 진행할 수 없다.
`Required Change` 는 Stage 2 재실행의 추가 입력이 된다.
