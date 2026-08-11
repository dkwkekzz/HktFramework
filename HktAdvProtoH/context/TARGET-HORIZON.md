# TARGET-HORIZON

> 이 문서는 **변경 빈도가 매우 낮아야 한다.**
> 최종 방향과 절대적인 구조적 원칙만 담는다. 구현 명세가 아니다.
> 모든 Stage 의 Agent 가 **항상** 기본 Context 로 읽는 세 문서 중 하나다.

## 1. 최종 방향

**Persistent Open World MMORPG**

```text
- 다수의 Player / AI Actor 가 존재한다.
- Actor 는 하나의 공유 World 안에서 행동한다.
- World State 는 지속적으로 변화한다.
- 다양한 Goal / Possibility 가 연결된다.
- Actor 마다 Knowledge / Skill / Experience / Preference 가 다를 수 있다.
- Resource / Crafting / Combat / Economy / Social / Ecology 등으로 확장한다.
- World Semantic 은 Runtime 에서 Observable 해야 한다.
- Runtime Transition 은 설계 Intent 까지 역추적할 수 있어야 한다.
```

Target Horizon 은 **지금 구현할 목록이 아니다.**
현재 Cycle 에서 잘못된 구조적 결정을 하지 않기 위한 방향성이다.

## 2. 절대 원칙

| # | 원칙 |
|---|---|
| P1 | Goal / Possibility Graph 가 게임 의도의 Source of Truth 다. Implementation 이 이를 바꾸지 않는다. |
| P2 | Intent 의 모든 의미는 World State 또는 World Rule 로 표현된다 (Semantic Closure). |
| P3 | 세계의 의미 있는 상태 변화는 반드시 어떤 World Rule 에 귀속된다. 이유 없는 `stoneCount++` 는 금지다. |
| P4 | World Rule 의 판단·결과에 관계되는 의미적 상태는 Observable 해야 한다 (Observable Closure). |
| P5 | View 는 World 내부 구현이 아니라 Observable World State 를 읽는다. |
| P6 | State 뿐 아니라 Transition(Before / Input / Rule / After) 도 Observable 해야 한다. |
| P7 | 정적 Goal/Possibility 와 동적 Runtime 상태는 동일한 설계 언어로 함께 관찰된다. |
| P8 | 설계적으로 의미 있는 상태가 관측되지 않는 기능은 구현 완료가 아니다. |

## 3. Permanent Semantic Foundation

작은 Cycle 에서 정의하더라도 **최종 World Model 과 호환되는 의미로** 정의해야 하는 개념.
여기서 잘못 정의하면 이후 모든 Cycle 이 영향을 받는다.

```text
Entity Identity
Actor
World State
World Rule
Position
Inventory
Ownership
Knowledge
Goal
Possibility
Semantic Transition
Observable Projection
```

이 개념들에 대해서는 **Entity 단위 의미**를 지킨다.

```text
금지                          허용
World.playerInventory   →     Actor01.Inventory
World.playerPosition    →     Actor01.Position
World.playerStoneCount  →     Actor01.Inventory[Stone]
                              Deposit01.ResourceAmount
```

현재 Runtime 에 Actor 가 하나뿐이어도, 같은 의미 모델에 Actor02 를 추가할 수 있어야 한다.

## 4. Deferred Capability

필요해질 때까지 **구현하지 않는다.** Backlog 에 있다는 이유로 placeholder / dummy field 를
World State 에 만들지 않는다. 목록은 [EVOLUTION-BACKLOG.md](EVOLUTION-BACKLOG.md) 에 있다.

## 5. 일반화의 경계

```text
일반화해야 하는 것            미리 일반화하지 않는 것
─────────────────────         ──────────────────────
World Semantic                Implementation Mechanism

Actor / Entity                ECS 사용 여부
ResourceType                  DB 구조
World Rule                    Shard 전략
Position / Inventory          Network Replication
Goal / Possibility            Cache 방식
```

`UniversalResourceProviderFactory`, `DistributedInteractionOrchestrator`,
`GenericMMORPGCapabilityResolver` 같은 구현 추상화는 실제 필요가 생길 때 만든다.

## 6. 한 문장

> Open World MMORPG 라는 장기 방향을 유지하면서, 매 Cycle 마다 최소한의 World Capability 를
> `Goal/Possibility → Intent → World State → World Rule → Runtime Transition → Observable Verification`
> 까지 완전히 닫아 검증한 뒤 World Baseline 에 누적한다.
