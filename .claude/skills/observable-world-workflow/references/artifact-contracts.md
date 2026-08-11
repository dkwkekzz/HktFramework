# Artifact Contracts

Stage 사이를 잇는 것은 대화가 아니라 **파일로 존재하는 Artifact** 다.
이 문서는 그 파일의 위치·이름·필수 항목·상태 어휘를 규정한다.

## 1. 저장 위치와 파일명

```
HktAdvProtoH/
├── design/graph/                       # Human Design (Stage 0) — Goal / Possibility Graph
└── artifacts/
    ├── REGISTRY.md                     # 모든 Artifact 의 ID·상태 색인
    ├── intent/         INTENT-<DOMAIN>-<NNN>.md
    ├── world/          WORLD-<DOMAIN>-<NNN>.md
    ├── implementation/ IMPL-WORLD-<DOMAIN>-<NNN>.md
    ├── verification/   VERIFY-WORLD-<DOMAIN>-<NNN>.md
    └── design-gaps/    GAP-<NNN>.md
```

ID 규칙

```
GOAL-<DOMAIN>-<NAME>          예) GOAL-RESOURCE-ACQUIRE-STONE
POSSIBILITY-<NAME>            예) POSSIBILITY-MINE-STONE
INTENT-<DOMAIN>-<NNN>         예) INTENT-MINING-001
WORLD-<DOMAIN>-<NNN>          예) WORLD-MINING-001
RULE-<NAME>-<NNN>             예) RULE-MINE-001
OBS-<DOMAIN>-<NNN>            예) OBS-MINING-001
GAP-<NNN>                     예) GAP-004
```

`<NNN>` 은 3자리 0-패딩, 도메인별 1부터 증가. 발급 전 `REGISTRY.md` 에서 최대값을 확인한다.
**한 WORLD 는 정확히 하나의 INTENT 를 폐쇄한다.** 1:1 대응이 아니면 Intent 를 쪼갠다.

## 2. Intent Package

```
# INTENT-<DOMAIN>-<NNN>

## Source Goal
GOAL-...

## Source Possibility
POSSIBILITY-...

## Intent Statement
<세계에서 무엇이 참이어야 하는가 — 조건절 + 행동 + 결과. 자연어 서술.
 클래스·함수·시스템 이름을 쓰지 않는다.>

## Semantic Terms
| 용어 | 이 Intent 안에서의 의미 |
|---|---|
| 알고 있다 | ... |
| 적절한 도구 | ... |

## Constraints
<이 Intent 가 지켜야 하는 세계 제약. 없으면 "없음">

## Open Questions / Design Gaps
<GAP-NNN 참조 또는 "없음">

## Trace
Goal → Possibility → Intent
```

## 3. World Definition Package

```
# WORLD-<DOMAIN>-<NNN>

## Source Intent
INTENT-...

## Trace
GOAL-... → POSSIBILITY-... → INTENT-... → WORLD-...

## Required World State
<엔티티별 상태 목록. 각 항목에 Intent 의 어느 문장에서 왔는지 표기>

## Required World Rule
RULE-<NAME>-<NNN>
  Implements:   INTENT-...
  Derived From: GOAL-... / POSSIBILITY-...
### Preconditions
### Input
### Transition
### Result

## Observable Contract
<Must expose: Actor / Goal / Possibility / Rule / 각 Precondition 의 개별 판정값 /
 Before State / After State / UNAVAILABLE 사유>

## Required Views
<Designer / Debug / Game View 가 각각 무엇을 보여야 하는가>

## Constraints

## Semantic Closure Checklist
| Intent 문장 조각 | 대응 World State / Rule | 충족 |
|---|---|---|

## Design Gaps
<GAP-NNN 또는 "없음">

## Review Status
DRAFT            # DRAFT | APPROVED | REJECTED | REVISION REQUIRED
Reviewed By:     -
Reviewed At:     -
Review Notes:    -
```

`Review Status` 는 **Stage 3 에서 인간의 명시적 판단으로만** 갱신된다.

## 4. Implementation Result

```
# IMPL-WORLD-<DOMAIN>-<NNN>

## Package ID
WORLD-...   (Review Status: APPROVED 확인 기록)

## Implemented Rule(s)
| Rule ID | 위치(file:line) |

## Implemented State(s)
| World State | 위치(file:line) |

## Observable Implementation
<Observable Contract 각 항목 → 실제 노출 지점>

## View Integration
<어느 View 가 Observable 의 무엇을 읽는가>

## Changed Files

## Tests

## Known Limitations

## Design Gaps Found
<GAP-NNN 또는 "없음">
```

## 5. Verification Report

```
# VERIFY-WORLD-<DOMAIN>-<NNN>

## Package ID
WORLD-...

## Semantic Closure     : PASS | FAIL
## Observable Closure   : PASS | FAIL
## Runtime Scenario     : PASS | FAIL
## Traceability         : PASS | FAIL

## Failures
<항목별 — 무엇이, 왜 실패했는가>

## Evidence
<Before / Input / Rule / After 실측 로그, 명령어, 출력>

## Final Result
PASS | FAIL | BLOCKED BY DESIGN GAP
```

## 6. Design Gap

```
# GAP-<NNN>

Raised At Stage:  <1 Intent | 2 World Model | 4 Implementation | 5 Verification>
Related Artifact: INTENT-... / WORLD-...
Missing Semantic: <이름>
Reason:           <왜 현재 설계로는 닫히지 않는가>
Proposed State / Rule:
                  <후보. 확정이 아니라 제안>
Blocking:         yes | no
Resolution:       OPEN | RESOLVED(<어떻게>) | REJECTED(<왜>)
```

Gap 의 해소는 인간의 설계 결정이다. Agent 가 스스로 `RESOLVED` 로 바꾸지 않는다.

## 7. REGISTRY.md 형식

```
| ID | Kind | Trace | Status | 파일 |
|---|---|---|---|---|
| INTENT-MINING-001 | Intent | GOAL-... / POSSIBILITY-... | DONE | artifacts/intent/INTENT-MINING-001.md |
| WORLD-MINING-001  | World  | INTENT-MINING-001          | DRAFT | artifacts/world/WORLD-MINING-001.md |
```

Status 어휘

```
Intent          : DONE | BLOCKED
World           : DRAFT | APPROVED | REJECTED | REVISION REQUIRED
Implementation  : DONE | BLOCKED
Verification    : PASS | FAIL | BLOCKED
Gap             : OPEN | RESOLVED | REJECTED
```

각 Stage 는 종료 직전 REGISTRY 를 갱신한다. 갱신 없이 STOP 하지 않는다.

## 8. Handoff 로 전달하지 않는 것

```
이전 Agent 의 전체 대화
이전 Agent 의 reasoning
이전 Agent 가 읽은 모든 문서
이전 Agent 의 임시 메모
```

다음 Stage 는 위 파일들만 입력으로 받는다. Artifact 에 없는 정보는 **존재하지 않는 정보**로 취급한다.
