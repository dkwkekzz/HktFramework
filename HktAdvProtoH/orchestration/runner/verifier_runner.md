# Verifier Runner Protocol

Verifier Session 역할을 맡은 Agent 가 따르는 절차.
근거: [Design-AgentExecution.md](../../design/Design-AgentExecution.md) §20~§23·§31·§33.

## 원칙

- **Generator ≠ Verifier.** 산출물을 만든 Session 이 자기 결과를 최종 승인하지 않는다.
- Verifier 는 Generator 의 내부 reasoning / 대화 기록을 받지 않는다.
  입력은 오직: Official Artifacts + Runtime Evidence + Test Results + Expected Contract.
- Verifier 는 구현을 편의상 수정하지 않는다. FAIL 은 FAIL 로 보고한다.

## Deterministic 우선 (§20)

AI 판단이 필요 없는 검사는 반드시 Script 로 먼저 실행한다.

```bash
node scripts/validation/verify.mjs schema <name> <file>   # Schema validation
node scripts/validation/verify.mjs envelope <task>        # Task Envelope 6요소
node scripts/validation/verify.mjs closure <cycle>        # Intent trace 완전성
node scripts/validation/verify.mjs frozen                 # Frozen 해시 보호
node scripts/validation/verify.mjs registry               # Registry 정합성
node scripts/validation/verify.mjs cycle <cycle>          # Cycle 전체 감사
```

Script 가 FAIL 이면 LLM 판단 없이 즉시 FAIL 이다.
Script 통과 후 semantic 판단이 필요한 항목만 LLM 으로 검사한다.

## Gate 별 검사 요지

| Gate | Deterministic | Semantic (LLM) |
|---|---|---|
| Scope | schema, 산출물 존재 | 범위가 한 Cycle 로 작고 플레이 가능한가 |
| Intent | schema, trace 존재 | Goal→Possibility→Intent 의미 일관성 |
| Semantic Closure | `closure` — trace 의 모든 항목이 State/Rule 로 해소 | 매핑이 의미상 올바른가, 중복 semantic 없는가 (§21) |
| Authority Closure | command 에 prohibited_fields 존재, authority owner 지정 | 모든 Transition 이 Rule 로만 발생하는가 (§22) |
| Observable Closure | Designer 8항목 존재 | Observer 가 Rule 판단·결과를 이해할 수 있는가 (§23) |
| Contract | schema, id/version 부여 | Observable↔GV Spec 상호 참조 완전성 |
| World Verify | build/test 결과, forbidden import 검사 | Rule 구현이 Contract 의미와 일치하는가 |
| GameView Verify | binding source 가 전부 Observable 항목인지 | Visual Meaning 구현 여부 |
| Integration | e2e_trace 사슬 연결 검사 | trace 의미 정합 |
| Playable | scenario expected 3층(world/observable/gameview) 대조 | Cycle Goal 자체가 플레이 가능한가 (§31) |

## 결과 규약

`verification_result` schema 로 기록한다.

- `evidence` — 실행한 명령·재현 방법·대조 파일을 남긴다 (주장 금지, 재현 가능해야 함).
- FAIL 시 `failure_type` 을 [failure_routes.yaml](../routing/failure_routes.yaml) 의 키로 분류한다.
  Routing 결정은 Orchestrator 가 하지만 분류는 Verifier 의 책임이다.
- `mode: SIMULATED` 는 Dry Run 전용이다. 실제 Cycle 의 Gate 에서는 금지.
