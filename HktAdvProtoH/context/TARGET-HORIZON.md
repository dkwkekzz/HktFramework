# TARGET-HORIZON

> 최종 방향과 절대적인 구조적 원칙. **변경 빈도가 매우 낮아야 한다.**
> 이 문서는 구현 명세가 아니다 — 현재 Cycle에서 잘못된 구조적 결정을 하지 않기 위한 방향성이다.
> 이 문서 때문에 미래 기능을 미리 구현하지 않는다.

## Target Horizon

Persistent Open World MMORPG

- 다수의 Player / AI Actor가 존재한다.
- Actor는 하나의 공유 World 안에서 행동한다.
- World State는 지속적으로 변화한다.
- 다양한 Goal / Possibility가 연결된다.
- Actor마다 Knowledge / Skill / Experience / Preference가 다를 수 있다.
- Resource / Crafting / Combat / Economy / Social / Ecology 등으로 확장한다.
- World Semantic은 Runtime에서 Observable해야 한다.
- Runtime Transition은 설계 Intent까지 역추적할 수 있어야 한다.

## Permanent Semantic Foundation

초기부터 잘못 정의하면 이후 모든 Cycle에 영향을 주는 세계 의미.
작은 Cycle에서도 아래 개념은 최종 World Model과 호환되는 의미로 정의한다.

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

## 절대 구조 원칙

1. **Actor / Entity 단위 의미** — `World.playerInventory` 같은 단일 Player 가정 금지. 현재 Actor가 하나뿐이어도 `Actor01.Inventory` 형태로, 두 번째 Actor를 같은 의미 모델에 추가할 수 있어야 한다.
2. **세계의 의미 있는 상태 변화는 반드시 World Rule에 귀속** — 이유 없는 `stoneCount++` 금지.
3. **View는 Observable World State만 읽는다** — World 내부 구현 직접 접근 금지.
4. **Semantic Transition은 `Before / Input / Rule / After` 형태로 관찰 가능**해야 한다.
5. **Traceability** — Runtime Transition → World Rule → Intent → Possibility → Goal 역추적이 항상 성립한다.
6. **일반화 대상은 World Semantic이지 Implementation Mechanism이 아니다** — ECS / DB / Shard / Replication / Cache 전략은 실제 필요가 생길 때 결정한다.
7. **Semantic Overlap** — 새 Cycle은 기존 World Semantic을 실제로 재사용·연결한다. Feature Island 금지.

## Deferred Capability (구현하지 않는다 — 필요해질 때까지)

```text
대규모 동시 접속
서버 샤딩
길드
경매장
지역 경제
레이드
정치
생태계
Resource Respawn
Network Authority
```

미래 기능을 미리 구현하지 않는다. 단, 현재 설계가 이것들을 구조적으로 불가능하게 만들지는 않는지 Evolution Compatibility Gate에서 확인한다.

## Fallback Reference

필요한 의미를 Artifact와 Baseline만으로 판단할 수 없을 때만 다음 원본 문서를 참조한다 (기본 Context 아님 — RULE 12).

- [../design/Design-Concept.md](../design/Design-Concept.md) — 세계·주체·목적/가능성 그래프 개념 정의
- [../design/Design-Workflow.md](../design/Design-Workflow.md) — Goal/Possibility 기반 Observable World 구현 Workflow
- [../design/Design-CycleWorkflow.md](../design/Design-CycleWorkflow.md) — Progressive Cycle Workflow 원문
