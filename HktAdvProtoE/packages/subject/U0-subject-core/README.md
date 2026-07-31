# U0 subject-core

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [13-Phase-U-Subject.md](../../../design/modules/13-Phase-U-Subject.md)
> 선행: [V0](../../verification/V0-module-contract/README.md) · [K0](../../kernel/K0-entity-state/README.md) ·
> [K1](../../kernel/K1-predicate-query/README.md) · [K2](../../kernel/K2-rule-transaction/README.md) ·
> [K3](../../kernel/K3-event-replay/README.md) · [S0](../../world-state/S0-spatial-affordance/README.md) ·
> [S1](../../world-state/S1-natural-state/README.md)

## 목적 (G0)

사람·생물·조직·신이 목적을 만들 수 있는 공통 주체 구조를 제공한다 — 같은 몸 상태에서도 가치와
성격이 다르면 무엇을 먼저 돌볼지가 달라진다.

## 계약 (G1)

| 항목 | 값 |
|---|---|
| 소유 상태 | `subject_state` (여섯 컴포넌트 + 능력 태그) · `need_book` (데이터로 적힌 욕구 정의) |
| 입력 | `world_state` · `spatial_layout` · `subject_law` · `need_book` · `tick_span` |
| 출력 | `subject_view` · `need_ranking` · `priority_trace` · `subject_event` · `invariant_report` |

```ts
executeU0({
  world: { components, operations },   // 두 사람과 똑같이 굶은 두 몸
  layout,                              // S0 의 논리 격자 — 몸은 자리를 가진다
  worldSeed: '20260731',
  ticks: 2,
  naturalLaws: NATURAL_LAWS,           // 넣으면 몸이 스스로 굶고 스스로 먹는다 (S1)
});
```

원문 「11」 U0 의 「포함」 일곱 항목이 그대로 주체의 칸이 된다.

| 원문의 「포함」 | 표현 | 법칙이 읽는가 | 법칙이 쓰는가 | 우선순위를 바꾸는가 |
|---|---|---|---|---|
| 욕구 | `needs.<id>` 0~10 | ✓ | `u0_hunger_grows_from_the_body` · `u0_hunger_fades_when_the_body_is_fed` · `u0_wounds_call_for_safety` · `u0_a_whole_body_calms_the_mind` | **N** 긴급도 |
| 가치 | `values.<id>` 0~1 | — | — (성장은 R 페이즈) | **V** 가치 일치 |
| 특성 | `traits.<id>` 0~1 | — | — (성장은 R 페이즈) | **T** 성격 일치 · 온도 |
| 감정 | `emotions.<id>` 0~1 | ✓ | `u0_wounds_call_for_safety` · `u0_helplessness_breeds_despair` · `u0_means_at_hand_calm_the_mind` | 온도 |
| 능력 | 실체 태그 `cap_<id>` | ✓ `has_tag` | — (획득은 R 페이즈) | 수단 표시 |
| 자원 | `resources.<id>` 0 이상 | ✓ | — (교환은 I 페이즈) | 수단 표시 |
| 신체 연결 | `body.entity_ids` | ✓ 모든 감각의 통로 | — (몸은 세계의 것) | 욕구를 통해 |

빈칸을 남겨 둔 것이 아니다. 가치와 성격을 바꾸는 것은 성장(R 페이즈)의 일이므로 U0 의 법칙이
쓰지 않는 것이 옳다. 대신 **일곱 항목이 하나도 빠짐없이 결과를 바꾼다**는 것을 장면
`nothing_in_the_subject_is_decoration` 과 같은 이름의 단위 테스트가 하나씩 흔들어 확인한다.

## 설계 판단

### ① 느끼는 일도 사건이다

GI-01 은 "모든 세계 상태 변경에는 원인이 되는 `WorldEvent` 가 존재해야 한다"고 못 박는다.
주체의 욕구와 감정도 세계의 상태다. 배가 고파지는 것을 코드 한 줄로 처리하면 그 변화는
원인 없는 상태 변경이 되고, "왜 저 NPC 는 갑자기 배가 고파졌는가"에 답할 수 없다.

그래서 하루를 세 개의 의도로 적었다. [src/laws.ts](src/laws.ts) 의 열 가지 법칙은 전부 K2 의
`RuleSpec` 이며, K2 가 델타로 바꾸고 K3 이 사건으로 남긴다.

```text
sense_hunger   몸의 허기를 느낀다    (몸마다 하나)
sense_harm     몸의 상함을 느낀다    (몸마다 하나)
weigh_means    손에 쥔 수단을 잰다   (주체마다 하나)
```

### ② 우선순위 계산은 저장소를 아예 들여오지 않는다

GI-02 는 "주체는 서버의 실제 세계 상태가 아니라 자신의 `BeliefState` 를 통해서만 판단한다"고
규정한다. 이것을 주석으로 적어 두면 언젠가 "이 판정만 세계를 한 번 들여다보면 쉬운데" 하는
자리가 생긴다.

그래서 [src/rank.ts](src/rank.ts) 는 `EntityStore` 를 **인자로도 받지 못하고 import 하지도
않는다.** 저장소를 만지는 자리는 [src/subject.ts](src/subject.ts) 하나뿐이고, 그 파일이 내주는
`SubjectView` 가 주체가 볼 수 있는 전부다. 단위 테스트가 import 목록을 실제로 훑어 이 경계를
지킨다.

### ③ 잰 것과 재지 않은 것을 함께 남긴다

세계 설계 원본 9장의 활성도는 아홉 항이다.

```text
A(v) = N + V + T + M + R + F * C - Risk - Taboo
```

U0 이 재는 것은 **앞의 셋뿐**이다. 나머지를 0 으로 채워 넣으면 "이미 다 쟀다"로 읽히고, 뒤에
오는 모듈은 자기 자리가 비어 있다는 것을 모른다. `NeedRanking.pending` 이 그 이름과 주인을
들고 있으며, 브라우저 Lab 의 「입력 상태」 구획에 그대로 나온다.

| 항 | 누가 |
|---|---|
| N 욕구 긴급도 · V 가치 일치 · T 성격 일치 | **U0** |
| M 관련 기억 · R 대상과의 관계 | U3 |
| F 행동 가능성 | G2 |
| C 비용 · Risk 위험 · Taboo 금기 | G3 |

같은 이유로 U0 은 **확률을 내보이기만 하고 뽑지 않는다.** 뽑으려면 난수가 필요하고, 그것은
V2 의 결정적 시드를 거쳐야 하며, 무엇보다 고르는 일은 G3 의 몫이다.

### ④ 능력과 자원은 표시이지 점수가 아니다

원본 9장에서 행동 가능성은 `F` 항이고 그것은 G2 의 것이다. U0 이 수단을 점수에 더하면 같은
항을 두 모듈이 재게 된다. 그래서 `NeedScore.means` 는 **가졌는가 / 못 가졌는가**만 말한다 —
속성 테스트가 "능력과 자원을 아무리 쥐여 줘도 활성도는 한 칸도 바뀌지 않는다"를 강제한다.

그렇다고 장식은 아니다. 수단이 없는 절박은 절망이 되고(`u0_helplessness_breeds_despair`),
절망은 온도를 올려 선택을 흔든다. 능력과 자원은 **감정을 거쳐** 우선순위에 닿는다.

### ⑤ 능력은 컴포넌트가 아니라 태그다

원본 10장은 `capabilities: Id[]` 라고 적었다. 실체의 태그 배열이 정확히 그 모양이고, K1 의
`has_tag` 가 그것을 읽고 K2 의 `attach_tag`·`remove_tag` 가 그것을 쓴다. 컴포넌트로 바꿔
적으면 원본과 어긋나고(원문 「23」 상위 계약 변경 금지) 법칙이 읽을 수단도 사라진다.
태그 `cap_forage` 하나가 원본의 원소 `forage` 하나다.

### ⑥ 조직과 신의 몸

원문 「6」은 사람·생물·조직·신이 모두 같은 `Subject` 인터페이스를 구현한다고 하면서도,
"조직이나 국가는 추상적인 의지만으로 행동할 수 없다"고 못 박는다(GI-08).

U0 에서 그것은 **몸의 문제**가 된다. 조직의 몸은 구성원이고 신의 몸은 앵커다. 몸마다 감각
의도가 하나씩 나가므로 구성원이 넷인 조직은 네 번 느끼고, 쓰러진 구성원을 통해서는 아무것도
느끼지 못한다 — 제약 규칙 `u0_the_dead_do_not_feel` 이 그 자리를 막고 거부 사유로 자기 이름을
남긴다. 장면 `person_creature_organization_and_god_share_one_structure` 가 이것을 보인다.

### ⑦ 한 틱 안에서는 몸이 먼저 산다

의도 제출 순서는 **자연 법칙(S1) → 주체 법칙(U0)** 이다. 주체가 먼저 느끼게 하면 언제나
어제의 몸을 느끼게 된다 — 오늘 먹은 개가 오늘도 배고파하는 셈이다. 순서를 바꾸면 같은 세계가
다르게 굴러가므로(GI-12) [src/module.ts](src/module.ts) 에서 한 번 못을 박는다.

## 대표 검증 (G4)

원문 「11」 U0 의 대표 검증은 "동일한 배고픔 상태에서도 가치와 성격이 다른 주체의 우선순위가
달라짐"이다. 장면 `same_hunger_different_values_diverge` 가 그것을 그대로 보인다.

```text
                끼니    맡은 자리    몸      온도    1위
  파수꾼        2.05      7.25      2.60    0.80   맡은 자리
  도둑          6.80      3.05      3.20    2.75   끼니
```

**두 사람의 욕구 수위는 한 칸도 다르지 않다.** 몸의 허기도 같고, 같은 법칙 아래에서 같은 속도로
굶는다. 그것을 먼저 단정으로 강제한 뒤에야 순위 비교가 뜻을 갖는다 — 같음을 증명하지 않은
"다름"은 아무것도 말하지 않는다.

갈린 이유도 이름으로 나온다. `compareSubjects` 가 두 사람의 항별 기여를 대조해 **무엇이 얼마나**
갈랐는지 큰 것부터 늘어놓는다.

## 실행

```bash
pnpm test U0-subject-core
pnpm lab                      # 브라우저 Lab 의 U0 탭
pnpm verify U0 --lab --regression
```

## 검증 상태

`pnpm verify` 가 출력하는 `status=` 가 이 모듈의 실제 상태다. 손으로 적지 않는다.
현재 상태와 막힌 게이트는 [STATE.md](../../../STATE.md) 를 본다.

G6(통합 게이트)은 VS1(한 주체의 생존 행동)이 `S0, S1, U0, U1, G0~G3` 일곱 모듈을 함께 요구하므로
U1·G0~G3 이 올 때까지 미측정이며, **미측정은 통과가 아니다**(원문 「23」).
