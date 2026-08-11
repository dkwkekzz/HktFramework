# Graph — <도메인>

> Human Design 진본. **인간만 수정한다.** Agent 는 Gap Proposal 로만 변경을 제안할 수 있다.

## Goal 노드

### GOAL-<도메인>-001 <이름>

목표 상태 (검증 가능한 상태식으로):

```text
HasItem(Actor, Stone, 2) = true
```

상위 Goal: GOAL-… (없으면 루트)

## Possibility 노드

### POSS-<도메인>-001 <이름>

달성 Goal: GOAL-<도메인>-001
방법 요약: (한 문장 — 예: 광맥을 채굴해 돌을 얻는다)
내부 요구 Goal: GOAL-… (이 가능성 실행에 필요한 조건이 다른 Goal 로 이어지는 경우)

## 그래프 구조

```text
GOAL-<도메인>-001
├─ POSS-<도메인>-001
├─ POSS-<도메인>-002
└─ POSS-<도메인>-003
       ↓ requires
   GOAL-<도메인>-002
```
