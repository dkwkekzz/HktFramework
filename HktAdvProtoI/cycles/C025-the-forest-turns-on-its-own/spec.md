# C025 — 숲이 스스로 돈다

```text
CYCLE          C025 — 개체군 셋 · 관계 다섯(CALLS · EATS · LEAVES) · 방을 넘는 관계 ·
               LEAVES 가 사체를 세운다 · presence 셋 · trend · 무관찰 실주행 명령 · ㉜ ㉝ 보고
SOURCE         content/roadmap/play/RoomBearsLife.md (§2 완료 확인 ⑥ · §4 Breath 의 돌아감 ·
               §5.6 · §5.7 대조 · §6 W42 나머지 · W44 · W45 · V21 나머지 · V22 · E18 · 확정 6 · 9)
               content/roadmap/L2-World-Life.md (F9 · F14 · F15 · §2.2 "걸어서 오는 것은 3층" ·
               §3.1 layer(presence · anchor) · §3.2 links · §3.3 검사 ㉜ ㉝)
               content/roadmap/L2-World-Concept.md §4 숲의 생태 사슬 · W9(플레이어 없이 돈다)
               content/roadmap/L2-World-Material.md S9 흐름의 anchor · A.2 회복 원인
               content/roadmap/L2-World-Time.md §2.3 철 · §2.6 presence
               cycles/C022~C024/spec.md (탄생지 · 개체군 값 · 내림 · 변성 — 이름으로 인용한다)
SELECTED_FROM  Play §7 Cycle Breakdown 의 넷째 항목 (C025 · 이 Play 의 마지막)
확장            C024 가 세운 개체군의 내림과 철의 수 세기 위에 **관계**를 얹는다. 그 spec 들의
               Semantic/Rule 을 복사하지 않고 이름으로 인용한다. 루트 TODO.md §4 의 C025 항목
               다섯(㉜ ㉝ · trend · 상한과 내림의 글자 · nest-kill 의 주인 · 사체를 세우는 것)을 받는다
```

## Playable Goal

**관찰자가 자리를 비운 채 세계 시계 두 바퀴가 지나는 동안, 숲이 값으로 한 바퀴 도는 것을
관찰한다** — 광식충이 늘면 숲 안쪽에 새가 들고, 새가 늘면 둥지에 포식수가 오고, 포식수가
새를 줄이고 둥지에 사체를 남기며, 그 사체가 균류가 되어 균사가 다시 서고, 그 균사가 뿌리로
가 다음 탄생을 잇는다. 돌아와 보면 자락 셋의 넓이가 달라져 있고 둥지에 사체가 있다.

## Experience Intent

```text
Start  태어남과 마름은 내가 만든 것이었다 — 내가 캐면 마르고 두면 찬다.
End    며칠 자리를 비웠다. 돌아오니 새가 와 있고 포식수의 자리가 넓어졌고 둥지에 사체가 있다.
       내가 없어도 돌았다. 내가 하는 건 그 바퀴를 조금 밀거나 늦추는 것이다.
```

Play §4 Breath 의 **돌아감** 구간이다. 이 Play 의 마지막 Cycle 이므로 실주행 판정이 뒤따른다.

## World Change

1. **개체군이 셋이 된다** — 광식충(거목의 방)에 **대형 조류**(숲 안쪽)와 **포식수**(둥지)가
   더해진다. 개체는 없다 — 값과 자락뿐이다 (F9 · F10). 걷는 몸은 3층의 것이다.
2. **값 사이의 관계가 선다** (F14) — 방이 `links` 를 밝힌다. 세 갈래다:
   `CALLS`(부른다 — to 를 올린다) · `EATS`(먹는다 — to 를 내린다) · `LEAVES`(남긴다 — to 인
   잔류 원천을 세운다). 관계는 **개체군 사이**의 것이므로 3층을 침범하지 않는다.
3. **관계는 철에 매인다** — 철이 바뀌는 순간 한 번 판정한다 (C024 가 내림에 세운 그 자리다).
   판정은 그 철이 **시작할 때의 값들을 함께 읽어 함께 적용한다** — 그래야 사슬이 한 철에
   한 마디씩 나아가고, 한 철에 바퀴가 통째로 돌아 버리지 않는다.
4. **관계가 방을 넘는다** — 두 개체군이 다른 방에 살면 그 관계는 **이음을 밝힌다**. 밝힌
   이음이 실제로 두 방을 잇지 않으면 그 관계는 아무 일도 하지 않는다 (Flow 의 anchor 가
   그런 그대로 · C021 R3 의 어법).
5. **남긴 것이 원천을 세운다** — 포식수가 있으면 한 철에 둥지의 **사체**가 선다. 그 원천은
   이제 **시간으로 돌아오지 않는다** — 되돌리는 것은 다음 사냥이다 (C018 이 지나가는 것에,
   C023 이 탄생에 세운 그 어법 그대로). 그 사체가 C024 의 변성을 먹여 균사를 세우고, 균사가
   뿌리로 가 탄생을 잇는다 — **바퀴가 닫힌다.**
6. **주인 없는 회복 원인이 없어진다** — 사체의 되돌아옴 원인(`nest-kill`)이 전제하는 것이
   이제 세계에 있다. ㉛ 의 대상이 셋이 되고 셋 다 통과한다 (C024 가 TODO 로 넘긴 자리).
7. **값이 방향을 가진다** — 개체군 State 에 `trend` 가 선다. 올리는 것과 내리는 것이 둘
   이상이 되어야 방향이 뜻을 가지므로 지금까지 비워 두었던 자리다 (Life §3.2).
8. **자락이 셋이 된다** — 새와 포식수도 값만큼의 자락으로 선다 (V21). 값도 이름도 실리지
   않는 것은 그대로다 — 관찰자가 읽는 것은 넓이뿐이다.
9. **아무도 없는 세계를 굴려 볼 수 있다** — 관찰자 0 인 채로 세계 시계를 N 바퀴 돌리고 값의
   궤적을 적는 개발 명령이 선다 (E18). 세계를 바꾸지 않는 읽기 전용 도구다.

## Observable Result

1. 광식충이 상한의 절반 이상인 채로 한 철이 지나면 **숲 안쪽에 새의 자락이 선다** — 거목의
   방에서는 아무 일도 일어나지 않는다 (관계는 이음을 넘어 이웃의 값을 올린다).
2. 새가 선 뒤 한 철이 더 지나면 **광식충의 자락이 한 겹 줄고**, 둥지에 **포식수의 자락**이 선다.
3. 포식수가 선 뒤 한 철이 지나면 **새의 자락이 줄고**, 둥지에 **사체**가 서서 캘 수 있다.
4. 그 사체 위에서 C024 의 변성이 다시 서고(전조가 돌아온다), 그것이 터진 뒤 균사가 돌아오며,
   그 균사가 뿌리혹을 되살려 다음 탄생이 선다 — **아무도 캐지 않았는데** 그렇게 된다.
5. 관찰자가 방을 비운 채로 세계 시계 두 바퀴를 굴리면 값 셋이 오르내린 **궤적**이 남는다.
   같은 씨앗의 같은 세계는 언제 돌려도 같은 궤적이다.
6. `npm run world:check` 의 ㉜ 가 관계 다섯을 실제로 재어 `pass` 이고, ㉝ 가 "관계 없는
   개체군 0" 을 보고한다. ㉛ 은 대상 셋을 잡고 셋 다 통과한다.

## Reuse

```text
Existing (그대로 쓴다 · 이름만 인용한다)
  생명 계약 · 탄생지 State · 요구 판정 · 결속의 진행 · 전조 자락 (C022)
  태어남의 한 Tick · 머묾 · 떼의 자락 · 계승 (C023)
  값마다의 되돌아옴 배속과 멎음 코드 · 값의 내림과 철의 수 세기 · 변성 (C024)
  원천 계통 전부 · 시계와 철 · 소란 · presence layer 와 그 투영 자리 · 이음과 anchor

Added — World
  RegionEcology.links               관계 목록 (from · to · kind · via?)
  PopulationState.trend             값의 방향 (오름 · 내림 · 멈춤) — 저장된다
  RULE-POPULATION-LINK-001 (ADDED)  철이 바뀌면 관계가 값을 올리고 내리고 원천을 세운다
  RULE-POPULATION-DECLINE-001 (CHANGED)  같은 철의 자리에서 내림 다음에 관계가 온다 · trend 를 적는다
  RULE-SOURCE-CONDITION-001 (CHANGED)    누가 **남기는** 원천이 아직 없으면 condition-unmet
  RULE-SOURCE-RECOVERY-001 (AFFECTED)    그 원천은 시간으로 돌아오지 않는다
  RULE-POPULATION-PRESENCE-001 (AFFECTED) 자락을 밝힌 개체군이 셋이 된다

Added — Data
  content/regions/lives.ts          대형 조류 · 포식수 · 그 떼의 코드 둘
  content/regions/forest-deep.ts    대형 조류의 개체군과 자락 둘 · links 둘
  content/regions/predator-nest.ts  포식수의 개체군과 자락 하나 · links 둘 ·
                                    NEST_CARCASS 의 recoveryLife
  content/regions/red-eye-tree.ts   links 하나 (이음을 넘는 CALLS)
  content/authoring/contracts.ts    nest-kill 이 ㉛ 의 대상 목록에 든다

Added — Protocol
  없음 (자락도 원천도 이미 실리는 자리다 — 항목이 하나도 늘지 않는다)

Added — View
  새와 포식수의 자락 색 · 사체가 아직 없을 때의 문구 · 떼 코드 둘의 문구

Added — 도구
  world:run   관찰자 0 인 채로 세계 시계 N 바퀴를 굴리고 값 셋의 궤적을 낸다 (읽기 전용 · E18)
```

## Out of Scope

```text
태어난 개체의 몸 · 걸음 · 감각 · 사냥 · 죽음 — 값이 도는 것까지가 2층이다        3층 (F10)
개체를 사냥해 값을 내리는 것                                                     5층
분화형 SEPARATION                                                  Play Human 질문 1
개체군의 상한·내림의 글자를 봉투에 싣는 것 — 세계는 값을 말하지 않는다          두지 않는다
```

## SPEC

```text
SPEC-001  관계가 값을 올린다 (CALLS)
  ① from 의 값이 그 상한의 **절반 이상**인 채로 철이 바뀌면 to 의 값이 1 오른다
  ② to 의 상한에서는 오르지 않는다
  경계 ③ from 이 절반보다 적으면 오르지 않는다
  경계 ④ 관계를 밝히지 않은 개체군은 이 규칙이 건드리지 않는다

SPEC-002  관계가 값을 내린다 (EATS)
  ① from 의 값이 1 이상인 채로 철이 바뀌면 to 의 값이 1 준다
  ② 값은 0 아래로 내려가지 않는다
  경계 ③ from 이 0 이면 내리지 않는다

SPEC-003  관계가 원천을 세운다 (LEAVES)
  ① from 의 값이 1 이상인 채로 철이 바뀌면 to 인 원천이 **선다** (거기 없던 것이 선다)
  ② 이미 서 있으면 아무 일도 일어나지 않는다
  경계 ③ from 이 0 이면 서지 않는다
  경계 ④ 그 원천은 **시간으로 돌아오지 않는다** — 아직 없는 동안 `condition-unmet` 을 지고
     되돌아옴의 진행이 오르지 않는다 (되돌리는 것은 다음 사냥이다)

SPEC-004  한 철의 판정은 함께 읽고 함께 적용한다
  ① 그 철이 시작할 때의 값들로 관계 전부를 판정한 뒤 한꺼번에 적용한다 —
     한 철에 사슬이 **한 마디**만 나아간다 (앞의 관계가 올린 값을 뒤의 관계가 그 철에 쓰지 않는다)
  경계 ② 데이터의 차례가 답을 바꾸지 않는다 (차례를 뒤집어도 그 철의 결과가 같다)
  경계 ③ 철을 여럿 건너뛴 큰 걸음도 지난 만큼 일어난다 (내림과 같은 어법)

SPEC-005  관계가 방을 넘는다
  ① 두 개체군이 다른 방에 살면 그 관계는 이음을 밝히고, 그 이음이 실제로 두 방을 이으면 선다
  경계 ② 밝힌 이음이 그 두 방을 잇지 않으면 **아무 일도 하지 않는다** (끊긴 참조는 조용하다)
  경계 ③ 값이 오르는 것은 **to 가 사는 방**이다 — from 의 방은 한 값도 달라지지 않는다

SPEC-006  값이 방향을 가진다
  ① 그 철에 값이 올랐으면 `trend` 가 오름 · 내렸으면 내림 · 그대로면 멈춤이다
  ② 저장되고 되살아난다
  경계 ③ 값이 오르고 내려 제자리면 멈춤이다 (한 철의 결과만 본다)

SPEC-007  같은 철의 두 규칙이 정해진 차례로 돈다
  ① 철이 바뀌면 **내림이 먼저이고 관계가 다음이다** — 내림은 C024 가 세운 자리이고
     관계는 그 위에 얹힌다
  경계 ② 한 철에 같은 개체군이 내림과 관계로 둘 다 움직일 수 있고, 그때 `trend` 는
     그 철의 **처음과 끝**을 견준 답이다

SPEC-008  바퀴가 닫힌다
  ① 포식수가 남긴 사체 위에서 변성이 다시 서고, 그것이 터져 균사가 돌아오고, 그 균사가
     뿌리혹을 되살려 다음 탄생이 선다 — 관찰자가 하나도 없는 채로
  경계 ② 어느 한 마디를 끊으면(그 원천을 캐 두면) 그 뒤가 서지 않는다

SPEC-009  아무도 없는 세계를 굴려 볼 수 있다
  ① `world:run` 이 관찰자 0 인 채로 N 바퀴를 굴리고 값 셋의 궤적을 낸다
  ② 같은 인자로 두 번 돌리면 **글자까지 같다** (결정론 · 읽기 전용)
  경계 ③ 저장소에 한 값도 쓰지 않는다

SPEC-010  도구가 관계를 잰다
  ① ㉜ 가 관계 다섯의 양 끝과 이음을 재어 `pass` 다 — LEAVES 의 to 는 잔류 원천이다
  ② ㉝ 가 "관계 없는 개체군 0" 을 보고한다 (판정하지 않는다)
  ③ ㉛ 의 대상이 셋이고 셋 다 통과한다 (허물 · 균사 · 사체)
```

## State

```text
RegionState.populations[id].trend : 'rising' | 'falling' | 'steady'   저장된다

(그 하나만 는다. 값 · metThisSeason · 적용한 철의 수 · 탄생지의 phase 는 그대로다)
```

데이터 값 표 — **전부 데이터이고 규칙은 한 글자도 알지 못한다.**

```text
개체군 셋 (확정 6 의 눈금)
  ORE_EATER   거목의 방 · 상한 4   (이미 있다)
  BIG_BIRD    숲 안쪽  · 상한 2   자락 둘 · 소란 없음 · declineWhen 없음 (관계가 값을 굴린다)
  PREDATOR    둥지     · 상한 1   자락 하나 · 소란 없음 · declineWhen 없음

관계 다섯 (확정 9 의 상수 · 문턱은 헤더가 아니라 **관계의 갈래**가 정한다)
  ORE_EATER  ─CALLS ─▶ BIG_BIRD   via TREE_APPROACH   (거목 → 숲 안쪽)
  BIG_BIRD   ─EATS  ─▶ ORE_EATER  via TREE_APPROACH
  BIG_BIRD   ─CALLS ─▶ PREDATOR   via NEST_TRAIL      (숲 안쪽 → 둥지)
  PREDATOR   ─EATS  ─▶ BIG_BIRD   via NEST_TRAIL
  PREDATOR   ─LEAVES▶ NEST_CARCASS                    (같은 방 · 이음 없음)

문턱 (헤더 상수 · 확정 9)
  CALLS   from 이 상한의 **절반 이상**이면 to += 1
  EATS    from 이 **1 이상**이면 to -= 1
  LEAVES  from 이 **1 이상**이면 to 인 원천이 선다

사체가 주인을 얻는다
  NEST_CARCASS.recoveryLife = PREDATOR       (㉛ 의 셋째 대상 · C024 가 넘긴 자리)
  nest-kill 이 LIFE_BOUND_RECOVERY_CAUSES 에 든다
```

## Rule

```text
R1  RULE-POPULATION-LINK-001 (ADDED · 세계 과정)
    IF   시각이 낸 철의 수가 적용한 수보다 많다
    THEN 지난 철마다, 세계의 모든 관계를 **그 철 시작의 값들로** 판정해 한꺼번에 적용한다 —
         CALLS  from ≥ ⌈상한/2⌉ → to += 1 (상한을 넘지 않는다)
         EATS   from ≥ 1        → to -= 1 (0 미만 없다)
         LEAVES from ≥ 1        → to 인 원천을 세운다 (standSourceState — 이미 서 있으면 그대로)
    경계 두 개체군이 다른 방이면 밝힌 이음이 그 두 방을 실제로 이을 때만 선다
    경계 세계가 모르는 개체군 · 원천 · 이음을 가리킨 관계는 **아무 일도 하지 않는다**
    경계 **관찰자와 무관하다** — 세계 어디에도 관찰자가 없어도 돈다

R2  RULE-POPULATION-DECLINE-001 (CHANGED)
    같은 철의 자리에서 **내림이 먼저이고 관계가 다음이다**. 그리고 그 철의 처음과 끝을
    견주어 `trend` 를 적는다 (오름 · 내림 · 멈춤)

R3  RULE-SOURCE-CONDITION-001 (CHANGED)
    IF   어느 관계가 `LEAVES` 로 밝힌 원천이 아직 available 이 아니다
    THEN `condition-unmet` 이 실린다 — 흐름 · 지나가는 것 · 탄생이 세우는 것과 **같은 코드**다
         (거기 지금 없다는 같은 사실이다). 걸린 동안 되돌아옴의 진행이 오르지 않는다

R4  RULE-POPULATION-PRESENCE-001 (AFFECTED — 대상 집합만 는다)
    자락을 밝힌 개체군이 셋이 된다. 값이 오르내리면 선 자락이 그만큼 늘고 준다
```

## REUSED / ADDED

```text
REUSED     Population · populationValueOf · findPopulation · swarmAreasIn · populationsInRegion ·
           seasonsStartedAt · standSourceState · sourceStateOf · sourceConditions ·
           leavingRouteOf · leavingLifeSiteOf 의 어법 · REGION_GRAPH · checkRegions 와 그 계약
ADDED      RegionEcology.links · PopulationLink · PopulationState.trend ·
           RULE-POPULATION-LINK-001 · leavingLinkOf · world:run · BIG_BIRD · PREDATOR
CHANGED    RULE-POPULATION-DECLINE-001 (차례와 trend) · RULE-SOURCE-CONDITION-001 (남기는 것 하나)
AFFECTED   RULE-POPULATION-PRESENCE-001 · RULE-SOURCE-RECOVERY-001 · ㉛ ㉜ ㉝ 의 대상
```

## Observable (관찰 계약)

투영은 **한 항목도 늘지 않는다** — C022~C024 가 세운 자리가 이번 것을 그대로 나른다.

```text
presences[].area           자락 셋 — 떼 · 새 · 포식수. 값이 오르내리면 넓이가 달라진다
resources[].conditions[]   사체가 아직 없는 동안의 `condition-unmet` (기존 코드 · 기존 자리)
resources[].kind           사체의 자연 형태 (기존 자리)

투영하지 않는 것 (그대로다)
  개체군의 값 · 이름 · 상한 · trend · 관계 · 문턱 · 적용한 철의 수.
  **세계는 수를 말하지 않는다** — 관찰자가 읽는 것은 자락의 넓이와 거기 무엇이 있고 없는가뿐이다
```

## UNRESOLVED

없음.

**기본형으로 둔 것** (Design 이 침묵해 기존 규율로 답했다 — Human 이 감사할 자리):

```text
① 새의 자리를 **숲 안쪽**에 둔다 — Play §5.6 산문은 "새의 presence 가 숲 가장자리로 든다" 라
   적었으나, 이음을 넘는 CALLS 가 **실제 이음 위에** 서려면 거목의 이웃이어야 하고 그 방은
   숲 안쪽이다 (거목은 숲 가장자리와 직접 잇지 않는다). 그래서 사슬이 실제 지도 위에서
   거목 → 숲 안쪽 → 둥지로 이어지고, 둥지에서 균사를 거쳐 뿌리로 **닫힌다**
② **방을 넘는 관계는 이음을 밝힌다** — 확정 9 는 CALLS 에 대해서만 그것을 말한다. EATS 도
   방을 넘으므로 같은 규율을 폈다 (밝히지 않으면 그 관계가 서지 않는다). 끊긴 이음이
   아무 일도 하지 않는 것은 Flow 와 같다
③ 한 철의 판정을 **함께 읽고 함께 적용한다** — 확정 9 는 차례를 말하지 않는다. 차례대로
   적용하면 한 철에 바퀴가 통째로 돌아 "며칠 비운 사이에 한 마디씩 나아간다" 가 성립하지
   않고, 데이터의 차례가 세계의 답을 바꾼다
④ 철의 자리에서 **내림이 먼저이고 관계가 다음이다** — 반대로 두면 그 철에 관계가 올린 값이
   같은 철의 내림에 곧바로 깎인다. 내림은 "지난 철이 어땠는가" 의 결산이고 관계는
   "이번 철에 무엇이 오는가" 이므로 이 차례가 뜻에 맞는다
⑤ 새와 포식수는 `declineWhen` 을 밝히지 않는다 — 그 값을 굴리는 것이 관계이기 때문이다
   (조건 결핍으로 마르는 것은 광식충 하나다 · 확정 6 은 그것만 말한다)
⑥ 새와 포식수는 소란을 올리지 않는다 — 확정 6 은 탄생의 소란만 말하고 이 둘은 태어나지
   않는다 (관계가 값을 옮길 뿐이다). 소란을 올리는 것은 지나가는 것의 일이다 (C018)
⑦ `trend` 의 어휘 셋(오름 · 내림 · 멈춤) — Life §3.2 는 이름만 준다. 투영되지 않으므로
   세계 안의 값이고, 읽는 것은 도구(world:run)뿐이다
```
