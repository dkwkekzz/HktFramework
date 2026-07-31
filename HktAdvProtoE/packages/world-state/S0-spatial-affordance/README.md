# S0 spatial-affordance

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [12-Phase-S-World-State.md](../../../design/modules/12-Phase-S-World-State.md)
> 선행: [V0](../../verification/V0-module-contract/README.md) · [K0](../../kernel/K0-entity-state/README.md) ·
> [K1](../../kernel/K1-predicate-query/README.md) · [K2](../../kernel/K2-rule-transaction/README.md)

## 목적 (G0)

위치·거리·충돌·접근 가능성을 렌더링과 독립적으로 계산해, 주체가 지금 어떤 대상에 어떤 행동을 할 수 있는지와 그 이유를 함께 돌려준다.

## 계약 (G1)

| 항목 | 값 |
|---|---|
| 소유 상태 | `spatial_index` · `navigation_grid` — 둘 다 세계에서 **다시 계산되는 파생 상태**다 |
| 입력 | `world_state` · `spatial_layout` · `affordance_spec` · `access_request` |
| 출력 | `affordance_offer` · `movement_path` · `spatial_query_result` · `access_rejection` |

```ts
executeS0({
  world: { components, operations },        // K0 의 세계
  layout: { cellSize: 1, origin, size },    // 논리 격자
  affordances: [TAKE_RELIC, OPEN_DOOR],     // 원문 「10」의 Affordance
  rules: [OPEN_DOOR_RULE],                  // 세계를 바꾸는 것은 K2 의 규칙뿐이다
  steps: [
    { kind: 'resolve', id: 'before', actor: 'hunter' },
    { kind: 'act', id: 'open', intent: { id: 'i', actor: 'hunter', verb: 'open', targets: ['oak_door'] } },
    { kind: 'resolve', id: 'after', actor: 'hunter' },
  ],
});
```

원문 「10」 S0 의 포함 항목이 그대로 소스 파일이 된다.

| 원문의 「포함」 | 파일 |
|---|---|
| Transform | [src/transform.ts](src/transform.ts) |
| Spatial Index | [src/spatialIndex.ts](src/spatialIndex.ts) |
| Movement | [src/movement.ts](src/movement.ts) |
| Collision | [src/collision.ts](src/collision.ts) |
| Affordance | [src/affordance.ts](src/affordance.ts) |

## 설계 판단

### ① `Affordance` 를 한 칸도 늘리지 않았다

원문 「10」의 인터페이스는 여섯 칸이다. 이동 비용을 `estimatedCost` 에 미리 적어 두고 싶어지지만,
이동 비용은 **누가 어디에서 묻는가**에 따라 달라진다 — 대상에 붙는 값이 아니다. 그래서 선언에는
행동 자체의 비용만 두고, S0 이 경로에서 잰 값을 제시(`AffordanceOffer`)의 `movement` 항목으로
**더한다**(덮어쓰지 않는다). 같은 문에 대해 `hunter` 는 `{stamina:2, movement:2}`,
문 앞에 이미 서 있는 `patient_scout` 은 `{stamina:2}` 를 받는다.

### ② 격자를 쓰는 이유는 성능이 아니라 재현성이다

연속 공간에서 경로를 찾으면 부동소수 오차가 갈래를 바꾸고, 같은 세계가 서버마다 다르게 굴러간다
(GI-12). 칸은 정수이므로 흔들리지 않는다. 대기열에서 꺼내는 순서도 **비용 → ix → iy → iz** 로
못을 박아, `Map` 의 삽입 순서 같은 우연에 기대지 않는다.

이동은 축 정렬 여섯 방향뿐이다. 대각선을 허용하면 두 벽이 만나는 모서리를 사선으로 빠져나가고,
그것을 막으려면 "양옆이 모두 뚫려 있을 때만 대각선"이라는 예외를 하나 더 두어야 한다 — 예외는
언젠가 빠뜨린다. 여섯 방향이면 "막힌 칸에 들어가지 않는다" 한 줄이 모서리 통과까지 함께 막는다.

### ③ 충돌은 상자와 선분만 본다

원본 18.4 는 "3D 공간의 시각적 형태와 게임 규칙을 같은 데이터로 취급해서는 안 된다"고 못 박는다.
메시로 판정하면 아티스트가 문턱을 1cm 낮췄을 때 규칙이 바뀐다. 규칙이 보는 것은 축 정렬 상자뿐이고,
메시는 그 상자를 표현할 뿐이다.

선분–상자 판정은 표본을 찍지 않고 **축마다 진입·이탈 구간을 구해 교집합이 남는지** 본다(slab 법).
표본 간격보다 얇은 벽은 통과해 버리고, 간격을 줄이면 부동소수 오차가 갈래를 바꾼다.

### ④ 거절은 네 갈래이고, 섞지 않는다

```text
E_UNKNOWN_TARGET      대상이 세계에 없다        (사라진 것)
E_CONDITION_UNMET     조건이 어긋난다           (열린 문은 다시 열 수 없다)
E_MISSING_CAPABILITY  능력이 없다               (손이 없으면 못 잡는다)
E_UNREACHABLE         닿을 수 없다              (벽이 막는다)
E_OUTSIDE_GRID        격자가 세계를 담지 못한다  (배치의 문제)
```

넷을 "불가능" 하나로 뭉치면 다음 행동이 나오지 않는다. **문이 막았다**를 알아야 문을 여는 목적이
생기고, **손이 없다**를 알아야 도구를 찾는 목적이 생긴다 — G 페이즈가 이 구분을 먹는다.
거절은 하나만 돌려주지도 않는다. 손도 없고 벽 너머이기도 하면 둘 다 남는다.

`E_UNREACHABLE` 은 **무엇이 막았는지를 반드시 이름으로 지목한다.** "닿을 수 없다"만 돌려주면
화면에서 "왜 이 NPC 는 저것을 집지 못하는가"에 답할 수 없다.

### ⑤ 거리와 접근 가능성은 다른 것이다

"닿는 자리"는 대상까지의 거리만으로 정해지지 않는다. 그 자리에서 대상까지 직선이 뚫려 있어야
한다 — 그래야 벽에 등을 대고 벽 너머를 집는 일이 생기지 않는다. 장면
`reach_needs_a_clear_line_not_just_distance` 가 2m 앞의 열쇠를 문 하나 때문에 집지 못하는 모습을
보여 준다.

### ⑥ S0 은 세계를 고치지 않는다

문이 열리는 것은 K2 의 규칙이 비용을 받고 효과를 적용한 결과이며, 그 변화는 `StateDelta` 에 남는다
(GI-01). S0 은 바뀐 세계를 **다시 읽을 뿐**이고, `resolve`·`path`·`range` 걸음은 전후 세계 해시가
반드시 같아야 한다. K0 의 읽기가 동결 사본이므로 S0 에게는 세계를 잡을 손잡이 자체가 없다.

### ⑦ 색인은 답을 정하지 않는다

K1 의 질의 계획과 같은 규율이다 — 격자로 좁힌 반경 질의의 답은 전수 조회의 답과 **반드시 같아야
한다.** 다르면 그것은 최적화가 아니라 버그다. 모든 반경 질의는 두 답을 다 계산해 대조한다.

반경은 실체의 **상자**까지의 거리로 잰다. 중심 거리로 재면 길이 3.5m 짜리 벽이 "반경 3m 안에
없다"가 되어, 코앞의 벽을 못 보는 주체가 생긴다.

## 검증이 실제로 잡아낸 결함

| 잡은 검사 | 결함 |
|---|---|
| 속성 테스트 `어떤 방에서도 출력 불변조건이 깨지지 않는다` | 대상이 사방으로 둘러싸이면 **경로 탐색이 시작조차 하지 않아** 거절이 아무 이름도 지목하지 못했다 — 후보 자리를 지운 실체들을 모으도록 고쳤다(`searchReach.denied`) |

## 실행

```bash
pnpm test S0-spatial-affordance
pnpm lab                 # S0 탭
pnpm verify S0 --lab --regression
```
