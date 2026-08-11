# CYCLE-<NNN> — Implementation Result

> Stage 4 산출물. 무엇을 어디에 구현했는지 Stage 5 가 검증할 수 있는 형태로 남긴다.

## 1. 구현 범위

```text
입력 Package:  02-WORLD-DEFINITION-PACKAGE.md  (APPROVED)
Review 결과:   03-SEMANTIC-REVIEW-RESULT.md
```

## 2. Implementation Mechanism 결정

Agent 가 결정한 구현 선택과 근거. (세계 의미가 아니라 **구현 방식**의 기록이다.)

| 결정 | 선택 | 근거 |
|---|---|---|
| 런타임 / 언어 | | |
| 실행 방법 | | |
| 자료구조 | | |
| 파일 구조 | | |

## 3. World State 구현 위치

| State (02 기준) | 코드 위치 | Entity 단위 유지 |
|---|---|---|
| `<Entity>.<Field>` | `path:line` | [ ] |

## 4. World Rule 구현 위치

| Rule | 코드 위치 | Precondition 1:1 대응 | Trace 주석 |
|---|---|---|---|
| `RULE-<...>` | `path:line` | [ ] | [ ] |

**Precondition 대응표**

| 02 의 Precondition | 코드 위치 | 개별 보고 가능 |
|---|---|---|
| P1 | | [ ] |

## 5. Observable 구현 위치

| Observable 항목 | 코드 위치 |
|---|---|
| Current Goal | |
| Selected Possibility | |
| Precondition 별 참·거짓 | |
| Selected Rule | |
| Before / Input / Rule / After | |
| 실패 Reason | |

**View 경계** — View 가 Observable 만 읽는지:

```text
경계 지점 코드 위치:
```

## 6. Runtime Instance

Contract 가 정한 최소 instance.

```text

```

## 7. 실행 방법

Stage 5 가 그대로 재현할 수 있게 쓴다.

```bash

```

## 8. 자기 점검

| 항목 | 확인 |
|---|---|
| Required World State 를 하나도 생략하지 않았다 | [ ] |
| Precondition 을 묶거나 생략하지 않았다 | [ ] |
| Rule 밖에서 Semantic State 를 변경하는 코드가 없다 | [ ] |
| Observable Contract 를 전부 구현했다 | [ ] |
| View 가 World 내부 구현을 직접 읽지 않는다 | [ ] |
| Contract 의 Deferred 기능을 구현하지 않았다 | [ ] |
| 사용처 없는 확장 지점 / Factory / placeholder 를 만들지 않았다 | [ ] |
| 특정 instance 이름에 분기하는 코드가 없다 | [ ] |

## 9. 미해결

Design Gap 을 제출했다면 여기 링크한다.

```text

```
