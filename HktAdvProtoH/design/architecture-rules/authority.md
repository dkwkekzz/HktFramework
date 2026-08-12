# Architecture Rules — Authority

근거: [Design-AgentExecution.md](../Design-AgentExecution.md) §2 Rule 3·4, §22, [Design-CycleWorkflow.md](../Design-CycleWorkflow.md) §10.

## Rule 3 — Authoritative World

실제 World Semantic 상태 변화는 **Authoritative World Rule을 통해서만** 발생한다.
어떤 코드 경로도 Rule을 우회하여 World State를 직접 변경할 수 없다.

## Rule 4 — Command Boundary

Client는 상태 변경 **결과**를 보내지 않는다. 행동 **의도**만 전달한다.

```
WRONG  Client: Stone += 1
RIGHT  Client: Mine(Player01, Deposit01)
```

Command Contract에는 `prohibited_fields`로 결과 필드를 명시적으로 금지한다
(예: `inventory_delta`, `resulting_resource_amount`).

## Authority Closure (§22)

모든 Semantic Transition에 대해 다음 사슬을 추적할 수 있어야 한다.

```
Input → Authoritative Rule → Precondition Result → Authoritative Transition
```

Client가 직접 World State를 변경하는 경로가 하나라도 있으면 FAIL이다.

## 검증 (Verifier가 확인할 것)

- 모든 mutable State에 `owner: AuthoritativeWorld` + `mutable_by: [WorldRule]` 지정
- 모든 Command에 결과 필드 금지 목록 존재
- 모든 Transition이 Rule id로 역추적 가능
- Client → State 직접 쓰기 경로 부재 (구현 단계에서는 forbidden import/write 검사)
