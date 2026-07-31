# S1 natural-state

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [12-Phase-S-World-State.md](../../../design/modules/12-Phase-S-World-State.md)
> 선행: [V0](../../verification/V0-module-contract/README.md) · [K0](../../kernel/K0-entity-state/README.md) ·
> [K1](../../kernel/K1-predicate-query/README.md) · [K2](../../kernel/K2-rule-transaction/README.md) ·
> [K3](../../kernel/K3-event-replay/README.md) · [S0](../S0-spatial-affordance/README.md)

## 목적 (G0)

물리·생물·생태 상태를 공통 규칙으로 표현해, 먹이 관계와 시간만으로 개체군이 늘고 주는 과정을 사건으로 남긴다.

## 계약 (G1)

| 항목 | 값 |
|---|---|
| 소유 상태 | `food_web` (파생) · `natural_law_book` (데이터로 적힌 자연 법칙 10개) |
| 입력 | `world_state` · `spatial_layout` · `natural_law` · `tick_span` |
| 출력 | `population_series` · `food_web_link` · `natural_event` · `invariant_report` |

```ts
executeS1({
  world: { components, operations },   // 풀 · 사슴 · 늑대
  layout,                              // S0 의 논리 격자 — 먹이 관계가 거리를 본다
  worldSeed: '20260731',
  ticks: 45,
});
```

원문 「10」 S1 의 포함 항목이 그대로 컴포넌트가 된다.

| 원문의 「포함」 | 컴포넌트 | 이 값을 움직이는 법칙 |
|---|---|---|
| 질량 | `mass.kg` | `l1_feed` (먹은 만큼 옮겨 온다) |
| 온도 | `temperature.celsius` | `l1_fever_rises` · `l1_body_cools` |
| 손상 | `damage.wounds` | `l1_wounds_fester` |
| 허기 | `hunger.value` | `l1_feed` · `l1_prowl` · `l1_endure` · `l1_starve` · `l1_breed` |
| 질병 | `disease.load` | `l1_wounds_fester` · `l1_body_recovers` · `l1_plague_takes_its_share` |
| 개체군 | `population.count` | `l1_breed` · `l1_starve` · `l1_feed` · `l1_plague_takes_its_share` |
| 먹이 관계 | `diet.eats` + `habitat.radius` | [src/foodWeb.ts](src/foodWeb.ts) 가 S0 의 공간 색인과 함께 푼다 |

## 설계 판단

### ① 자연 법칙도 데이터 AST 다

`if (hunger > 8) population -= 1` 을 코드로 적으면 그 감소는 **원인 없는 상태 변경**이 되고(GI-01),
재생할 수도 감사할 수도 없다. [src/laws.ts](src/laws.ts) 의 열 가지 법칙은 전부 K2 의 `RuleSpec` 이며,
K2 가 델타로 바꾸고 K3 이 사건으로 남긴다. 그래서 법칙집을 **갈아 끼울 수 있다** — 장면
`state_stays_inside_its_declared_bounds` 는 굶주림 법칙만 바꿔 넣은 세계를 돌린다.

### ② 시간의 흐름 자체를 의도로 적는다

자연에는 의도가 없다. 그러나 K2 가 세계를 바꾸는 유일한 문이 의도이고, K3 은 그 문을 지날 때만
사건을 남긴다. 그래서 하루를 네 개의 의도로 적었다.

```text
fester   상처와 병이 하루만큼 진행한다
settle   체온이 하루만큼 움직인다
hunt     먹이가 사정권에 있다 (대상을 달고 온다)
endure   먹을 것이 없다
```

한 의도에 한 법칙만 적용되므로(K2), 하루에 일어나는 일을 한 규칙에 몰아넣으면 "굶으면서 동시에
상처가 곪는" 하루를 적을 수 없다. 의도를 나눈 이유가 이것이다.

### ③ 무엇을 먹을지는 S1 이, 먹어도 되는지는 법칙이 정한다

K2 의 조건식은 **주어진 결합**에 대한 참·거짓만 판정한다. 세계를 뒤져 대상을 찾아오지 못한다.
그러니 "무엇을 먹을 것인가"는 규칙 밖에서 정해져 의도에 실려 와야 한다. 대신 "배가 고픈가",
"먹이가 남았는가"는 전부 규칙의 `requires` 가 판정한다 — 그래야 그 판정이 데이터로 남고 사건이 된다.

먹이가 없을 때 `hunt` 를 보내지 않는 것도 같은 이유다. 대상 없는 `hunt` 를 보내면 규칙의
`target.population.count` 가 결합을 찾지 못해 **규칙 자체가 잘못되었다**는 거부가 나온다 —
세계의 사실("먹을 것이 없다")이 명세의 잘못으로 둔갑한다.

### ④ 먹이 관계는 종과 거리를 함께 본다 (S0 이 선행인 이유)

"늑대가 사슴을 먹는다"는 종의 성질이고, "지금 그 사슴이 사정권 안에 있는가"는 공간의 사실이다.
종만 보면 지구 반대편의 풀을 뜯고, 공간만 보면 늑대가 풀을 뜯는다. `far_meadow` 는 세계에 있는
풀이지만 사슴의 서식지 5m 밖에 있어 **한 포기도 줄지 않는다**.

먹지 못하는 이유는 네 갈래로 나뉜다 — 먹이를 선언하지 않았다 · 세계에 없다 · 서식지 밖이다 ·
바닥났다. 뭉치면 "왜 굶는가"에 답할 수 없다.

후보가 여럿이면 **개체군이 많은 쪽**을 고른다. 가까운 쪽을 고르면 거리가 소수점에서 갈릴 때
결과가 흔들리지만, 개체군은 정수이므로 흔들리지 않는다(GI-12).

### ⑤ 먹는 것은 만드는 것이 아니라 옮기는 것이다

`l1_feed` 는 먹이의 개체군을 `transfer` 로 옮겨 자기 질량으로 삼는다. 빼고 더하는 두 효과로 적으면
총량이 슬쩍 늘거나 줄 수 있다 — `transfer` 는 K2 가 보존을 보장하는 유일한 효과다. 총량이 늘어나는
유일한 길은 번식이며, 그것은 옮기는 일이 아니므로 다른 법칙이 맡는다.

### ⑥ "감소"는 첫 감소가 아니라 돌아오지 못하는 감소다

살아 있는 개체군은 잡아먹히고 새끼를 치며 오르내린다. "처음으로 한 마리 줄어든 틱"으로 재면 그저
그날의 물결을 잡을 뿐이고, 먹이와의 인과가 보이지 않는다. 그래서 **정점을 마지막으로 찍은 다음
틱**을 감소의 시작으로 삼는다.

```text
풀   ████▇▇▆▆▅▅▄▄▃▃▂▂▁▁                        3일부터 감소
사슴 ▇█▇█▇█▇█▇█▇█▇█▇█▇█▇█▇▆▅▄▃▂▁               28일부터 감소   ← 풀이 바닥난 뒤
늑대 ▁▁▂▂▃▃▄▄▅▅▆▆▇▇███████▇▇▇▆▆▆▅              37일부터 감소   ← 9일의 지연
```

지연은 손으로 넣은 숫자가 아니다. 늑대의 허기가 하루 +2 씩 쌓여 굶주림 임계(8)를 넘기까지 걸리는
시간이며, 법칙의 상수와 세계의 상태에서 저절로 나온다.

### ⑦ 하한은 법칙마다가 아니라 스키마 한 곳에 있다

"개체군은 음수가 될 수 없다"를 법칙마다 다시 적으면 언젠가 한 곳을 빠뜨린다. 하한은 컴포넌트
스키마에만 있고, 그것을 어기는 효과는 K0 이 거부한다 — 거부된 트랜잭션은 **절반도** 적용되지 않고
사건도 남기지 않는다.

## 원문의 범위 (그대로 지킨 것)

> 초기 프로토타입에서는 실제 원자 시뮬레이션이 아니라 콘텐츠에 필요한 거시 상태만 구현한다.

분자도 열역학도 두지 않았다. 개체군은 무리 하나의 **수치**이고, 한 끼는 마릿수와 무관하게 한 단위다.
개체 수에 비례하는 소비는 이 층이 아니라 콘텐츠 층이 정할 값이다.

## 실행

```bash
pnpm test S1-natural-state
pnpm lab                 # S1 탭
pnpm verify S1 --lab --regression
```
