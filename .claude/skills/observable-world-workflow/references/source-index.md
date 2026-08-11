# Source Index — Fallback Reference 진입점

원본 설계 문서는 제거하지 않는다. 다만 **기본 Context 에서 제외**한다.

```
Normal path:   Stage Guide + Handoff Artifact + common-invariants.md
Fallback path: 위로 의미가 부족함 → source-index.md → 원본의 해당 절만 읽음
```

원본을 통째로 읽는 것은 **최후 수단**이다. 아래 표에서 절을 특정한 뒤 그 절만 읽는다.

## 원본 문서

| 문서 | 실제 경로 | 절 지도 |
|---|---|---|
| 세계 의미론 | `HktAdvProtoH/design/Design-Concept.md` (2722줄) | [world-semantics-source.md](world-semantics-source.md) |
| 구현 Workflow | `HktAdvProtoH/design/Design-Workflow.md` (1257줄) | [design-workflow-source.md](design-workflow-source.md) |

## 주제 → 절 (자주 필요한 것)

| 막힌 지점 | 읽을 곳 |
|---|---|
| 세계 / 세계 상태의 정의가 애매하다 | Concept §1, §2 |
| 주체와 일반 개체의 차이 | Concept §3 |
| 지식·믿음이 무엇까지 포함하는가 | Concept §4.1 |
| 숙련도 / 능력 / 경험 / 선호의 구분 | Concept §4.2 ~ §4.5 |
| 세계 법칙(자연 법칙 vs 행동 법칙) | Concept §5 |
| 목적의 정의, 목적과 행동의 차이 | Concept §6 |
| 목적 그래프 vs 가능성 그래프 | Concept §7, §8 |
| 미충족 조건 → 하위 목적 탐색 | Concept §8.3, §13 |
| Runtime 결정 순환 전체 | Concept §10 ~ §22 |
| 실행 가능성 vs 선택 | Concept §15, §16, §17 |
| 경험·성장으로 상태가 바뀌는 방식 | Concept §20 |
| 전체 예시(아린/늑대/채굴/제작) | Concept §26, §27 |
| Intent 를 어떻게 뽑는가 | Workflow §4, §5 |
| Intent → World State 도출 | Workflow §6, §7 |
| Decision Semantic State 규칙 | Workflow §8 |
| World Rule 형식 | Workflow §9, §10, §11 |
| Observable World State 설계 | Workflow §12 ~ §15 |
| View 규칙 / Rendering 이 검증인 이유 | Workflow §16, §17 |
| Goal/Possibility 의 Runtime Observable | Workflow §18 |
| Implementation Package 구조·예제 | Workflow §19, §20 |
| Agent 가 할 수 있는 것 / 없는 것 | Workflow §21, §22, §23 |
| 완료의 정의 | Workflow §24 |
| Semantic Closure 판정 | Workflow §25 |
| Observable Closure 판정 | Workflow §26 |
| Traceability | Workflow §27 |
| Agent Workflow 원형 / 인간 Review 지점 | Workflow §28, §29 |

## 읽는 규칙

1. 표에서 **절 번호를 먼저 특정**한다.
2. `Read` 의 `offset` / `limit` 로 그 절만 읽는다 (줄 범위는 각 절 지도에 있다).
3. 읽은 절을 그대로 Artifact 에 복사하지 않는다 — **의미를 확인하는 용도**다.
4. 원본과 Artifact 가 충돌하면 원본이 옳다. 단, 원본을 고치는 것은 인간의 설계 결정이다.
