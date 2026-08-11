# 50-verification — <PKG-ID>

## 1. Semantic Closure (§25)

> 10-intent.md 의미 단위 목록의 **모든 항목**이 실제 코드의 State/Rule 로 연결되는가.

| 의미 단위 | 연결 대상 | 코드 확인 위치 | 판정 |
|---|---|---|---|
| | | | ✓/✗ |

미연결 문장이 하나라도 있으면 **실패**.

## 2. Observable Closure (§26)

> Rule 판단에 영향을 주는 모든 의미가 View 에서 관측 가능한가. 실행 불가 사유도 표현되는가.

| Precondition / 상태 | 관측 위치 | 불가 사유 표현 | 판정 |
|---|---|---|---|
| | | | ✓/✗ |

## 3. Runtime Scenario

> 실제 실행해서 Transition 을 관측한 증거. 약속이 아니라 실측만 기록한다.

```text
Transition #…
Intent: …
Before: …
Input: …
Rule: …
After: …
```

재현 방법(명령/절차):

## 4. Traceability (§27)

- [ ] Runtime Transition → Rule → Intent → Possibility → Goal 역추적 가능
- [ ] Goal → … → Runtime Instance 순추적 가능

## 종합 판정

| 필드 | 값 |
|---|---|
| 판정 | VERIFIED / FAILED |
| 실패 시 최초 원인 단계 | intent / world / implementation |
| 실패 상세 | |
