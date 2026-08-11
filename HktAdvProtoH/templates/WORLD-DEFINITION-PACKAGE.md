# CYCLE-<NNN> — World Definition Package

> Stage 2 산출물. Intent 의 모든 의미를 State + Rule + Observable 로 폐쇄한다.
> Stage 3 (인간 Gate) 통과 전에는 Implementation 에 전달할 수 없다.

## 1. Required World State

Entity 단위 의미로만 기술한다. `World.player*` 형태는 금지.

### <Entity>

| State | 의미 | 값의 성격 | Decision Semantic |
|---|---|---|---|
| `<Entity>.<Field>` | | | yes / no |

`Decision Semantic = yes` 인 State 는 세계의 판단에 영향을 주므로 반드시 Observable 해야 한다.

**Baseline 재사용**

| Baseline 항목 | 재사용 / 확장 | 비고 |
|---|---|---|

## 2. Required World Rule

---

### RULE-<NAME>-<NNN>

```text
Implements:
    INTENT-<...>

Derived From:
    GOAL-<...>
    POSSIBILITY-<...>
```

**Input**

```text

```

**Preconditions**

각 항목은 위 State 만으로 판정 가능해야 한다. 묶지 않고 개별로 나열한다.

```text
P1
P2
P3
```

**Transition**

```text

```

**Result**

```text

```

---

## 3. Required Observable

### Observable Contract

Rule 실행 여부와 무관하게 항상 노출되어야 하는 것.

```text
Actor / Entity 식별
Current Goal
Selected Possibility
각 Precondition 의 참·거짓
Selected Rule
```

Rule 실행 시 노출되어야 하는 Transition.

```text
Before
Input
Rule
After
```

### 실패 관측

Precondition 이 거짓일 때 인간이 읽는 형태.

```text
<Possibility>   unavailable
Reason:         <설계 언어로 된 이유>
```

### Semantic Lossless 확인

| 설계 판단에 필요한 의미 | Observable 경로 | 손실 여부 |
|---|---|---|

## 4. Closure 자기 점검표

Intent Package 의 Semantic Inventory 를 한 줄씩 옮겨 채운다. **빈칸이 있으면 미완성이다.**

| Intent 의미 요소 | 대응 State / Rule | Observable 경로 |
|---|---|---|

## 5. 자기 점검

| 항목 | 확인 |
|---|---|
| Intent 의 모든 의미 요소가 매핑되었다 (Semantic Closure) | [ ] |
| Rule 의 모든 Precondition 이 개별로 Observable 하다 | [ ] |
| Implementation State 를 World State 에 넣지 않았다 | [ ] |
| Entity 단위 의미를 지켰다 | [ ] |
| Deferred 항목의 placeholder / dummy field 가 없다 | [ ] |
| Rule 없이 변경되는 Semantic State 가 없다 | [ ] |
| Implementation Mechanism 을 결정하지 않았다 | [ ] |
