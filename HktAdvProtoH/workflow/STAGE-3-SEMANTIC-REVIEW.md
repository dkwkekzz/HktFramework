# STAGE-3-SEMANTIC-REVIEW — Human Semantic Review Gate

## 역할

인간이 World Definition을 검토하는 Gate. **Agent가 이 Gate를 대신 통과시킬 수 없다.**

## 검토 질문

```text
이 World State / World Rule이
내가 정의한 Intent를 정확하게 표현하는가?

이 Observable Contract / Visual Requirement로
내가 설계 언어 그대로 Runtime을 관찰할 수 있는가?
```

## 입력

- `state/cycles/cycle-XXX/02-world-definition.md`
- `state/cycles/cycle-XXX/01-intent-package.md` (대조용)

## 출력

- `state/cycles/cycle-XXX/03-semantic-review.md` — [../templates/SEMANTIC-REVIEW-RESULT.md](../templates/SEMANTIC-REVIEW-RESULT.md) 형식
- 결과는 `APPROVED` 또는 `REJECTED (Reason + Required Change)` 둘 중 하나다.

## Agent가 할 수 있는 것

- 인간의 검토를 돕는 요약 자료 제시 (Intent 문장 ↔ State/Rule 매핑 표 등).
- 인간이 구두/텍스트로 내린 판정을 Semantic Review Result Artifact로 **기록**.

## Agent가 할 수 없는 것

- 판정 자체를 내리는 것 (자동 APPROVED 금지).
- REJECTED 시 World Definition을 이 invocation에서 바로 수정하는 것 — 수정은 새로운 World Model Stage invocation으로 수행한다.

## Gate 규칙

`APPROVED`되지 않은 World Definition은 Implementation에 전달할 수 없다 (RULE 4).

## STOP 조건

Review Result 기록 + 진행 표 갱신 후 STOP.
