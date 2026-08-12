# AGENTS.md

## 읽는 순서

모든 Agent 는 다음 셋만 읽고 작업한다.

```text
1. AGENTS.md              이 문서 — 공통 불변 규칙
2. guides/<stage>.md      자기 단계의 작업 방법
3. cycles/<CycleId>/…     현재 Cycle 의 입력 Artifact
```

필요한 경우에만 관련 기존 Capability Artifact 나 코드를 추가로 확인한다.
`design/` 전체 문서는 일반적인 작업 Context 가 아니다.

단계 실행은 **`advprotoh-cycle` 스킬**이 담당한다 — 다음 미완료 Stage 판정, 공통 규칙 상세,
Artifact 형식을 그 스킬이 로드한다. 따라서 이 문서에는 원칙과 인덱스만 둔다.

## 핵심 원칙

```text
 1. AI Agent 는 전체 설계 문서를 매번 읽지 않는다.
 2. AGENTS.md 는 프로젝트 전체 공통 불변 규칙을 제공한다.
 3. 각 Stage Guide 는 해당 단계의 작업 방법만 제공한다.
 4. 각 Agent 는 이전 Artifact 를 입력받아 다음 Artifact 를 만든다.
 5. Artifact 가 Agent 간 Context 전달 수단이다. 대화 History 가 아니다.
 6. Cycle 은 기능 Module 이 아니라 하나의 플레이 가능한 Game Delta 다.
 7. 새 Cycle 은 기존 Capability 를 재사용하거나 확장하거나 변경할 수 있다.
 8. 과거 Cycle Artifact 는 History 로 보존한다.
 9. 현재 World 와 View 는 Cycle 을 거치며 계속 발전한다.
10. 기존 Semantic 변경 시 REUSED / ADDED / CHANGED / AFFECTED 를 명시한다.
11. 영향을 받는 기존 Rule 과 플레이 Scenario 도 함께 검증한다.
12. World 는 Authoritative Server 이고 View 는 독립적인 Client 다.
13. World → View 계약은 GameView Specification 이다.
14. View 는 GameView Specification 만으로 동작할 수 있어야 한다.
15. 최종 완료 조건은 코드 작성이 아니라 실제 Cycle Goal 의 플레이 가능성이다.
```

## 막혔을 때

이전 단계에서 확정된 의미를 임의로 바꾸거나 없는 의미를 만들어내지 않는다.
부족한 내용을 명시하고 그 의미를 책임지는 단계로 반환한다.

```text
GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  어느 단계가 이 의미를 책임지는가
```

## Stage 인덱스

| Stage | Guide | Artifact |
|---|---|---|
| 1. Cycle Definition | [guides/cycle-definition.md](guides/cycle-definition.md) | `01-cycle.md` |
| 2. Intent | [guides/intent.md](guides/intent.md) | `02-intent.md` |
| 3. World Semantic | [guides/world-semantic.md](guides/world-semantic.md) | `03-world-semantic.md` |
| 4. GameView Specification | [guides/gameview-spec.md](guides/gameview-spec.md) | `04-gameview.spec.yaml` |
| 5. Human Semantic Review | Human | `05-review.md` |
| 6. World Implementation | [guides/world-implementation.md](guides/world-implementation.md) | `world/` + `06-world-implementation.md` |
| 7. View Implementation | [guides/view-implementation.md](guides/view-implementation.md) | `view/` + `07-view-implementation.md` |
| 8. Verification | [guides/verification.md](guides/verification.md) | `08-verification.md` |

## 디렉터리 인덱스

| 경로 | 내용 | 수명 |
|---|---|---|
| `guides/` | Stage Guide — 단계별 작업 방법·완료 조건 | 공정이 바뀔 때만 |
| `cycles/` | Cycle Artifact — 진행 기록 | History, 수정하지 않는다 |
| `world/` | Authoritative World 구현 | 현재 게임, 계속 발전 |
| `view/` | Client View 구현 | 현재 게임, 계속 발전 |
| `protocol/` | World ↔ View 경계 타입만 | 현재 게임, 계속 발전 |
| `design/` | 원본 설계 — 경계 사례에서만 참조 | 원본 |

각 단계의 MUST / MUST NOT / DONE WHEN 은 해당 Guide 에 있다. 여기에 중복해 두지 않는다.
