# Architecture Rules — Observation

근거: [Design-AgentExecution.md](../Design-AgentExecution.md) §2 Rule 5·6, §23, [Design-CycleWorkflow.md](../Design-CycleWorkflow.md) §11~§15.

## Rule 5 — Observer Projection

Player / Designer / AI 등의 Observer는 World 내부 구현을 직접 읽지 않는다.

```
Authoritative World → Observer Projection → Observable World
```

## Rule 6 — Observable is Semantic

Observable은 Network Packet이나 Serialization Format이 아니다.

```
Observable Semantic ≠ Replication Representation
```

Observable Contract는 의미 단위로 정의하고, 전송/복제 형식은 구현 세부로 분리한다.

## Observable 설계 시점

Observable은 구현 마지막에 붙이는 Debug UI가 아니라
World State/Rule과 **동시에** 설계한다.
State뿐 아니라 `Before → Input → Rule → After` Transition도 관찰 가능해야 한다.

## Observable Closure (§23)

Rule 판단과 결과를 이해하는 데 필요한 World 의미가
적절한 Observer에게 제공되는지 검사한다.

Designer Observer는 최소 다음을 볼 수 있어야 한다.

- Current Goal / Current Possibility / Possibility Availability
- Preconditions / Selected Rule
- Before State / Input / After State
- Failure Reason

단, Designer도 World 내부 객체를 직접 읽지 않는다 — Projection을 통해서만 본다.

## 검증 (Verifier가 확인할 것)

- Observer별(최소 Player / Designer) Projection 정의 존재
- Designer Observable에 위 8개 항목 포함
- Observable 정의에 packet/serialization 세부 없음
- 모든 Rule의 판단·결과가 Observable로 노출됨
