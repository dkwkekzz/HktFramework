---
name: observable-world-workflow
description: HktAdvProtoH 의 Goal/Possibility 기반 Observable World 구현을 Stage 단위로 라우팅한다 — 요청이 Intent / World Model / Semantic Review / Implementation / Verification 중 어느 Stage 인지 판별하고, 그 Stage 에 필요한 최소 Guide 와 직전 Handoff Artifact 만 로드해 **한 Stage 만** 실행한 뒤 종료한다 (ONE INVOCATION = ONE STAGE). 사용자가 "Intent 정리 / World State·Rule 설계 / 의미 리뷰 / 승인된 패키지 구현 / 의미 검증 / Observable World 작업 / AdvProtoH 작업" 을 요청하면 사용.
---

# Observable World — Stage Router

이 Skill 은 **지식 문서가 아니라 Control Plane** 이다.
세계 의미론을 설명하지 않는다. 현재 요청이 어느 Stage 인지 판별하고, 그 Stage 에 필요한 **최소 Guide + 직전 Handoff Artifact** 만 로드해 실행시킨 뒤 종료한다.

## 0. 절대 규칙

```
ONE INVOCATION = ONE STAGE
```

한 번의 호출에서 Workflow 의 **한 Stage 만** 수행한다.
Stage 가 끝나면 Output Artifact 를 기록하고 **STOP** 한다.
다음 Stage 는 사용자의 **새로운 호출**이 시작한다.

Stage Router 는 workflow executor 가 아니라 **context router** 다.

## 1. 경로 상수

```
TRACK      = HktAdvProtoH
DESIGN     = HktAdvProtoH/design                  # 원본 설계 문서 (fallback 전용)
GRAPH      = HktAdvProtoH/design/graph            # Human Design — Goal/Possibility Graph
ARTIFACTS  = HktAdvProtoH/artifacts
REGISTRY   = HktAdvProtoH/artifacts/REGISTRY.md   # Stage 판별의 1차 근거
GUIDES     = .claude/skills/observable-world-workflow/references
```

## 2. Stage 판별표

| 요청 성격 | Stage | 로드할 Guide | 필요한 Input Artifact | Output Artifact |
|---|---|---|---|---|
| "…를 구현 가능한 의미 단위로 정리해줘", Goal/Possibility 를 의미로 풀어달라 | **1 Intent** | `intent-agent.md` + `common-invariants.md` | `GRAPH/` 의 **해당 subset 만** | `artifacts/intent/INTENT-*.md` |
| "이 INTENT-… 에 필요한 World State/Rule 을 설계해줘", Observable 계약을 만들어달라 | **2 World Model** | `world-model-agent.md` + `common-invariants.md` + `artifact-contracts.md` | `INTENT-*` | `artifacts/world/WORLD-*.md` (`Review Status: DRAFT`) |
| "이 WORLD-… 를 리뷰하겠다 / 승인·반려한다" | **3 Semantic Review** | `semantic-review.md` | `WORLD-*` (DRAFT) | 리뷰 결과 기록 → `WORLD-*` 의 `Review Status` 갱신 |
| "이 승인된 WORLD-… 를 구현해줘" | **4 Implementation** | `implementation-agent.md` + `common-invariants.md` | `WORLD-*` (**APPROVED 만**) + 대상 코드 | `artifacts/implementation/IMPL-*.md` |
| "WORLD-… 구현이 설계대로 닫혀 있는지 검증해줘" | **5 Verification** | `verification-agent.md` + `common-invariants.md` | APPROVED `WORLD-*` + `IMPL-*` + runtime evidence | `artifacts/verification/VERIFY-*.md` |

판별이 애매하면 **추측하지 말고 `AskUserQuestion` 으로 Stage 를 확정**한다.
"전부 다 해줘" 같은 요청은 여러 Stage 요청이다 — **가장 앞선 미완 Stage 하나만** 수행하고, 나머지는 다음 호출로 넘긴다고 보고한다.

## 3. 실행 절차

1. `REGISTRY` 를 읽는다 — 각 Artifact 의 ID·상태를 파악한다.
2. Stage 를 판별한다 (§2). 애매하면 사용자에게 묻는다.
3. **입력 Artifact 존재·상태를 확인**한다.
   - 없으면 실행하지 않는다. 선행 Stage 가 필요하다고 보고하고 STOP.
   - Stage 4 는 `Review Status: APPROVED` 가 아니면 **거부**한다. 자동 승인 금지.
4. Stage 를 실행한다.
   - **권장**: 대응 subagent 에 위임해 clean context 로 실행한다.
     `ow-intent-agent` / `ow-world-model-agent` / `ow-implementation-agent` / `ow-verification-agent`
     (Stage 3 은 인간 Gate 이므로 subagent 없음 — Router 가 직접 진행한다.)
   - subagent 를 쓸 수 없으면 해당 Guide 만 읽어 인라인 실행한다. **다른 Stage 의 Guide 는 읽지 않는다.**
5. Output Artifact 를 `artifacts/` 아래 규정 경로에 **파일로** 기록한다 (계약: `artifact-contracts.md`).
6. `REGISTRY` 를 갱신한다.
7. **STOP** — 종료 보고(§6)를 출력한다.

## 4. 금지

1. 한 호출에서 두 개 이상의 Stage 를 수행하지 않는다.
2. Stage 가 끝났다고 다음 Stage 를 자동 시작하지 않는다.
3. Human Semantic Review 를 자동 통과시키지 않는다. Router 도, subagent 도 스스로 `APPROVED` 를 쓰지 않는다 — **인간의 명시적 승인 발화만** 승인이다.
4. 이전 Stage 의 대화·reasoning 을 다음 Stage 의 입력 계약으로 쓰지 않는다. **입력은 Artifact 파일뿐**이다.
5. 부족한 세계 의미를 임의로 발명하지 않는다 → **Design Gap** 생성 후 STOP (§5).
6. 구현 편의를 위해 Goal / Possibility / Intent 의 의미를 바꾸지 않는다.
7. 원본 설계 문서(`DESIGN/Design-Concept.md`, `DESIGN/Design-Workflow.md`)를 **기본 경로에서 통째로 읽지 않는다** (§7).

## 5. Design Gap 처리

어느 Stage 든, 진행에 필요한 **세계 의미가 설계에 없다면** 채워 넣지 않는다.

```
artifacts/design-gaps/GAP-<NNN>.md
```

를 생성하고 (양식: `artifact-contracts.md`), `REGISTRY` 에 등록한 뒤 **STOP** 한다.
`Blocking: yes` 인 Gap 이 열려 있는 동안 그 Artifact 계열의 후속 Stage 는 실행하지 않는다.
Gap 의 해소는 **설계 변경**이며 인간의 결정이다.

## 6. 종료 보고 형식

```
Stage:            <1 Intent | 2 World Model | 3 Semantic Review | 4 Implementation | 5 Verification>
Input Artifact:   <ID 또는 경로>
Output Artifact:  <경로>
Registry:         갱신됨
Design Gaps:      <없음 | GAP-NNN (blocking)>
다음 Stage:       <이름> — 별도 호출로 시작할 것
STOP
```

## 7. Fallback Reference

기본 경로:

```
Stage Guide + Handoff Artifact + common-invariants.md
```

이것만으로 **의미가 부족할 때에 한해**:

```
GUIDES/source-index.md   →  주제 → 원본 문서의 특정 절
                         →  그 절만 읽는다
```

원본 문서를 통째로 읽는 것은 최후 수단이다.
`world-semantics-source.md` / `design-workflow-source.md` 는 원문 사본이 아니라 **원본 절 지도**다.

## 8. 완료의 정의

다음이 모두 존재해야 하나의 세계 단위가 완료다.

```
Goal/Possibility Trace ✓   Intent ✓   World State ✓   World Rule ✓
Runtime Transition ✓   Observable State ✓   Observable Transition ✓   Required View ✓
Semantic Closure ✓   Observable Closure ✓
```

"컴파일된다 / 실행된다 / 테스트가 통과한다" 는 완료 조건이 **아니다**.
