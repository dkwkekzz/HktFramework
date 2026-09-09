# C024 — 스폰이 아니라 회복이다

```text
CYCLE          C024 — 개체군 값이 원천의 되돌아옴을 좌우한다 · 값이 내린다(CONDITION_LOST) ·
               끊으면 마르고 두면 돌아온다(멸종 없음) · 사체 → 균류 변성형 ·
               협곡에 탄생지가 없는 사유 · ㉚ 분포 보고 · ㉛ 의 대상이 둘
SOURCE         content/roadmap/play/RoomBearsLife.md (§2 완료 확인 ③ · ⑤ · ⑦ · §4 Breath 의 끊어 봄 ·
               §5.4 도구 · §5.5 · §5.7 · §6 W41 뒷면 · W42 내리는 원인 · W45 · V19 나머지 · V22 ·
               E17 나머지 · 확정 5 · 6)
               content/roadmap/L2-World-Life.md (F3 변성형 · F6 · F8 · F9 · F15 ·
               §2.2 "생명의 죽음과 사체" · §3.2 데이터 계약(declineCause) · §3.3 검사 ㉚ ㉛)
               content/roadmap/L2-World-Material.md S6 생애 · S7 공급 · A.2 회복 원인 열
               content/roadmap/L2-World-Time.md §2.3 철 (값이 내리는 눈금이 철이다)
               content/roadmap/L2-World-Region.md §5.1 (미지 이름 표 · 협곡의 대조)
               cycles/C022-owner-of-the-molt/spec.md · cycles/C023-birth-is-consumption/spec.md
               (생명 계약 · 탄생지 State · 결속과 계승 · 소비와 세움 — 이름으로 인용한다)
SELECTED_FROM  Play §7 Cycle Breakdown 의 셋째 항목 (C024)
확장            C022·C023 이 세운 생명 계약 · 탄생지 State · 한 규칙의 결속/계승/탄생 위에 **더한다** —
               그 spec 들의 Semantic/Rule 을 복사하지 않고 이름으로 인용한다.
               루트 TODO.md §4 의 C024 항목 넷(값이 내리는 것 · 탄생의 소란이 쌓이는가 ·
               carcass-decay 가 무엇을 전제하는가 · ㉛ 이 참조만 잰다)을 받는다
```

## Playable Goal

**관찰자가 밑동의 허물이 예전처럼 차오르지 않는 것을 보고, 그것이 시간이 아니라 **살아 있는
것의 수**에 매여 있음을 알아챈다.** 둥지의 균사를 캐고 뿌리혹을 끊어 두면 한 철 한 철 떼의
자락이 줄고 마침내 허물이 아주 마르며, 그 자리에서 세계는 다시 처음처럼 알집을 맺는다.
그리고 둥지에서는 사체가 균류로 **바뀌어** 그 균사가 다시 서는 것을 본다.

## Experience Intent

```text
Start  태어난 것들이 돌고 허물이 다시 쌓인다. 그 쌓임은 그저 시간이 하는 일로 보인다.
End    시간이 하는 일이 아니었다 — 벗을 것이 있어야 허물이 쌓인다. 내가 사슬을 끊으면 수가 줄고
       허물이 마른다. 다 마른 자리에서 세계는 사라지지 않고 **처음부터 다시** 맺는다.
       그리고 태어나는 길은 하나가 아니다 — 어떤 것은 맺히고, 어떤 것은 잇고, 어떤 것은 바뀐다.
```

Play §4 Breath 의 **잇댐 → 끊어 봄** 구간이다. 돌아감(개체군 셋과 관계 다섯이 관찰자 없이 한 바퀴)은 C025 가 받는다.

## World Change

1. **되돌아옴이 개체군의 값에 매인다** (F8) — 원천이 "내 되돌아옴은 이 개체군이 좌우한다" 를
   밝히면, 그 값마다의 **배속**이 세계 시간에 곱해진다. 값이 0 이면 배속이 0 이고 **진행이
   한 톨도 오르지 않는다** — Respawn Timer 가 세계 안의 원인으로 갈아 끼워지는 자리다.
   밝히지 않은 원천은 한 값도 달라지지 않는다.
2. **멎은 것이 자기 사유를 말한다** — 배속이 0 이라 멎은 원천은 그 원천이 밝힌 조건 코드를
   진다 (`recovery-stalled` · `condition-unmet` · `not-this-season` 곁의 여섯째). 표시가 아니라
   **원인**이다: 되돌아옴을 멎게 하는 그 판정과 관찰에 실리는 그 코드가 같은 하나다.
3. **개체군의 값이 내린다** — 개체군이 "이것들이 차 있어야 산다" 를 밝히면, **한 철 내내 한
   번도 다 차지 않았을 때** 철이 바뀌는 순간 값이 1 준다 (0 아래로는 내려가지 않는다).
   한 철 안에 한 번이라도 다 찼으면 내리지 않는다 — 태어남이 잠깐 먹어 비는 것으로는 줄지 않는다.
4. **끊으면 마르고 두면 돌아온다** — 둥지의 균사를 캐면 뿌리혹의 되돌아옴이 멎고(C013 의
   매달림 그대로), 뿌리혹이 한 철 내내 비면 광식충이 준다. 값이 줄면 허물의 되돌아옴이 느려지고
   0 에서 아주 멎는다. 캔 것을 두면 균사가 돌아오고 뿌리혹이 차고 값이 다시 오른다.
5. **멸종은 없다** (F15) — 값이 0 이 되면 결속의 요구(`이 개체군이 0 이하`)가 **다시 차므로**
   알집이 처음처럼 맺힌다. 값이 0 인 것은 종점이 아니라 최초의 자리로 돌아간 것이다.
   규칙이 하나도 늘지 않는다 — C022 가 세운 요구가 그대로 그 일을 한다.
6. **셋째 탄생 방식이 선다** — 둥지의 **사체가 균류로 바뀐다**(`CARCASS_TO_FUNGUS` · TRANSFORMATION).
   사체를 먹고 거목균의 개체군을 올리며, 뒤에 붉게 되돌아온 흙을 남긴다. **규칙은 한 줄도 늘지
   않는다** — 결속·계승을 굴리던 그 한 규칙이 변성도 굴린다 (W40 · mode 마다 규칙을 따로 두지 않는다).
7. **둥지의 균사도 주인을 가진다** — 그 되돌아옴의 원인(`carcass-decay`)이 무엇을 전제하는지
   이름으로 선다: 거목균이다. 그래서 되돌아옴의 배속이 그 값에 매이고, 검사 ㉛ 의 대상이 둘이 된다.
   C022 가 참조만 세워 둔 자리(허물)와 **같은 자리**이고, 이제 둘 다 값이 일을 한다.
8. **없다는 것이 세계에 적힌다** (F6) — 협곡은 탄생지가 0 이고 **왜 0 인지**를 데이터가 밝힌다
   (열을 먹는 결정이 있어 결속에 쓸 열이 남지 않는다). 재료의 고립 사유(Material S9)를 생명에
   그대로 옮긴 것이다 — 없음이 침묵이 아니라 답이 된다.
9. **도구가 그것을 보고한다** — ㉚ 이 방마다의 탄생 방식 분포를 세고(숲은 결속 하나 · 계승 하나 ·
   변성 하나), 탄생지가 0 인 방이 밝힌 사유를 함께 싣는다. 판정하지 않는다 — 편중은 사람이 본다.

## Observable Result

1. 밑동의 허물을 다 캐고 기다려도 **돌아오지 않는다** — 광식충이 하나도 없는 세계에서. 그 원천을
   지목하면 판이 "벗을 것이 없다" 를 말한다 (되돌아오는 중 · 바닥남과 갈리는 여섯째 말).
2. 광식충이 있는 세계에서는 같은 허물이 돌아온다 — 값이 클수록 빨리 돈다.
3. 둥지의 균사를 캐고 뿌리혹을 캐고 한 철을 보내면 **떼의 자락이 한 겹 줄어든다**. 다시 한 철이면
   또 한 겹. 그동안 세계 위에 숫자는 하나도 뜨지 않는다.
4. 자락이 다 사라진(값이 0) 뒤 캔 것을 두고 기다리면 **뿌리에 알집이 다시 맺힌다** — 작은 붉은
   점(계승)이 아니라 큰 알집(결속)이다. 세계가 처음으로 돌아갔다.
5. 둥지의 사체 곁에 **삭는 자리**가 서 있고, 그것이 다 차면 사체가 사라지며 그 자리가 **붉게
   되돌아온 흙**으로 바뀐다. 그 뒤 균사가 다시 돌아온다 — 아무도 캐지 않았는데.
6. 거목균이 하나도 없는 세계에서는 캔 균사가 돌아오지 않고, 지목하면 판이 "삭일 것이 없다" 를 말한다.
7. `npm run world:check` 의 ㉚ 이 `방 2 · 탄생지 3 · 방식 3` 을 보고하고, 협곡의 줄에 "탄생지가
   없는 사유" 가 함께 실린다. ㉛ 은 대상 둘(허물 · 균사)을 잡고 **둘 다 통과**한다.

## Reuse

```text
Existing (그대로 쓴다 · 이름만 인용한다)
  생명 계약과 탄생지 State · 요구 판정 · 결속의 진행 · 전조 자락 · 조건 코드 (C022)
  태어남의 한 Tick(전이 · 소비 · 세움 · 값 · 소란) · 머묾과 되돌아옴 · 떼의 자락 · 계승 (C023)
  원천 계통 전부 — 채취와 고갈 · 되돌아옴과 그 두 문턱 · 매달림 · 철의 배속 · 조건 코드 (C011~C014 · C020)
  시계와 철 · 뒤척임의 수 세기 (C015 · C016) · 소란 (C017) · 지나가는 것 (C018)
  검사 ㉗~㉝ 의 계약과 그 일곱 (C022) · 지목과 대상 프레임 · 늘 떠 있는 판 (C026~C028)

Added — World
  ResourceSourceSpec.recoveryByLife    값마다의 되돌아옴 배속 (recoveryLife 가 가리킨 개체군의 값으로 색인)
  ResourceSourceSpec.noOwnerCode       그 배속이 0 이라 멎은 동안 지는 조건 코드
  PopulationSpec.declineWhen           "이것들이 차 있어야 산다" — 요구 어휘(LifeRequirement)를 그대로 쓴다
  RegionEcology.absenceReason          탄생지가 없는 방이 밝히는 사유 (resourceEcology.isolationReason 의 생명판)
  PopulationState.metThisSeason        이 철에 한 번이라도 다 찼는가 (저장된다)
  World.seasonsApplied                 지금까지 **적용한** 철의 수 (turnsApplied 와 같은 어법 · 저장된다)
  RULE-RECOVERY-SPEED-001 (CHANGED)    철의 배속에 **개체군의 배속**이 곱해진다
  RULE-SOURCE-CONDITION-001 (CHANGED)  개체군의 배속이 0 인 원천은 밝힌 코드를 진다 (멎게 하는 코드다)
  RULE-POPULATION-DECLINE-001 (ADDED)  철이 바뀌면, 그 철 내내 못 찬 개체군의 값이 1 준다
  RULE-LIFE-BIRTH-001 (AFFECTED)       변성도 같은 한 규칙이 굴린다 (대상 집합만 는다)
  RULE-LIFE-SITE-PHASE-001 (AFFECTED)  변성의 뒤 자락도 SPENT 인 동안 선다
  RULE-POPULATION-PRESENCE-001 (AFFECTED)  값이 내리면 선 자락이 줄어든다

Added — Data
  content/regions/lives.ts          거목균(TREE_FUNGUS) · 변성지의 자연 형태 · 규칙 id 하나
  content/regions/predator-nest.ts  사체(원천 하나) · 변성지 하나 · 개체군 하나 · 자락 넷 ·
                                    NEST_FUNGUS 의 recoveryLife 와 값마다의 배속
  content/regions/forest-edge.ts    MOLT_LITTER 의 값마다의 배속과 멎음 코드
  content/regions/red-eye-tree.ts   ORE_EATER 의 declineWhen
  content/regions/frost-canyon.ts   탄생지가 없는 사유
  content/authoring/contracts.ts    carcass-decay 가 ㉛ 의 대상 목록에 든다

Added — Protocol
  없음 (원천의 조건 코드도 떼의 자락도 이미 실린다 — 항목이 하나도 늘지 않는다)

Added — View
  변성지의 phase 별 외형 · 사체의 그림 · 자락 넷의 색 ·
  문구(no-molter · no-decomposer · carcass-* · 형태 둘)

Added — Engine
  CheckLife.absences                   탄생지가 없는 방과 그 사유 (항목 추가 · 선택 항목)
  ㉚ 이 그 사유를 refs 에 함께 싣는다 (판정은 그대로 없다)
```

## Out of Scope

```text
개체군 셋(광식충 · 대형 조류 · 포식수)과 관계 다섯(EATS · CALLS · LEAVES) · Region 을 넘는 CALLS ·
  LEAVES 가 사체 원천을 **만드는** 것(지금 사체는 시간으로 돌아온다) · presence 나머지 둘 ·
  populations 의 trend · 무관찰 실주행 명령 · ㉜ ㉝ 이 실제로 재는 것                        C025
사체의 되돌아옴 원인(`nest-kill`)이 전제하는 개체군 — 포식수가 세계에 서면 ㉛ 의 대상이 셋이 된다  C025
태어난 개체의 몸 · 걸음 · 감각 · 죽음 · 사냥                                                 3층 (F10)
탄생 과정에 개입하는 구체적 Action (2층의 개입은 채취뿐)                                     3층 이후
분화형 SEPARATION                                                              Play Human 질문 1
```

## SPEC

```text
SPEC-001  개체군이 되돌아옴의 속도를 좌우한다
  ① 값마다의 배속을 밝힌 원천이 고갈된 뒤, 그 개체군의 값이 v 이면 세계 시간 1 초가 진행에
     `배속[v] × 철의 배속` 만큼 실린다. 되돌아옴의 **길이는 바뀌지 않는다**
  ② 값이 0 이면 배속이 0 이고 진행이 한 톨도 오르지 않는다 — 세계 시간을 아무리 흘려도 돌아오지 않는다
  ③ 값이 목록보다 크면 목록의 마지막이 답이다
  경계 ④ **밝히지 않은 원천은 한 값도 달라지지 않는다** — 같은 방의 다른 원천들이 그 증인이다
  경계 ⑤ 그 개체군을 세계가 모르면 값이 0 으로 읽혀 멎는다 (끊긴 참조는 아무 일도 하지 않는다)

SPEC-002  멎은 것이 자기 사유를 말한다
  ① 배속이 0 이라 멎은 원천이 아직 available 이 아니면, 그 원천이 밝힌 코드가 관찰에 실린다
  ② 값이 오르면 그 코드가 사라지고 진행이 다시 오른다
  경계 ③ **거기 서 있는(available) 원천에는 걸리지 않는다** — 아직 없는 것에만 묻는다 (C014 · C018 · C023 의 규율)
  경계 ④ 코드를 밝히지 않은 원천은 멎어도 한 글자도 늘지 않는다

SPEC-003  값이 내린다 — 한 철 내내 모자랐을 때
  ① 요구를 밝힌 개체군은, 그 철 동안 한 번이라도 요구가 다 차면 그 철에는 내리지 않는다
  ② 한 번도 다 차지 않은 채로 철이 바뀌면 값이 1 준다
  ③ 값은 0 아래로 내려가지 않는다
  경계 ④ 요구를 밝히지 않은 개체군은 내리지 않는다
  경계 ⑤ 철을 여럿 건너뛴 큰 걸음도 지난 만큼 일어난다 (뒤척임의 수 세기와 같은 어법)
  경계 ⑥ 껐다 켠 세계가 같은 철을 두 번 세지 않는다 (적용한 수가 스냅샷에 실린다)

SPEC-004  끊으면 마르고 두면 돌아온다
  ① 균사와 뿌리혹을 캐 두고 한 철을 보내면 광식충의 값이 준다
  ② 값이 준 뒤 허물의 되돌아옴이 실제로 느려진다 (같은 세계 시간에 진행이 덜 실린다)
  ③ 캔 것을 그대로 두면 균사가 돌아오고 뿌리혹이 차고, 값이 다시 오른다
  경계 ④ 캐지 않은 세계에서는 한 철이 지나도 값이 내리지 않는다

SPEC-005  멸종은 없다
  ① 값이 0 이 되면 결속(`이 개체군이 0 이하`)의 요구가 다시 차서 알집이 맺히기 시작한다
  ② 그 결속이 다 차면 값이 다시 1 이 되고, 그 뒤로는 계승이 잇는다
  경계 ③ 값이 0 이 아닌 동안에는 결속이 서지 않는다 (C022·C023 이 세운 그대로 · 회귀)

SPEC-006  셋째 탄생 방식 — 사체가 균류로 바뀐다
  ① 사체가 available 이고 전조가 다 차면 변성지가 결속해 밝힌 초에 태어난다
  ② 태어나는 그 Tick 에 **사체가 고갈되고** 거목균의 값이 1 오른다 — 결속·계승과 같은 한 규칙이다
  경계 ③ 사체가 available 이 아니면 결속이 오르지 않고 진행이 그 자리에 멎는다
  경계 ④ 거목균의 값이 상한이면 전이가 **통째로** 일어나지 않는다 (사체도 그대로다)

SPEC-007  변성이 남기는 것
  ① 태어난 뒤 SPENT 인 동안 그 자리에 "붉게 되돌아온 흙" 의 자락이 선다
  경계 ② 그 밖의 phase 에서는 서지 않는다 (전조가 조건 코드로 가려지는 그 기제 그대로)

SPEC-008  균사의 되돌아옴이 균류의 값에 매인다
  ① 거목균이 0 인 세계에서 캔 균사는 돌아오지 않고 밝힌 코드를 진다
  ② 변성이 한 번 일어나 값이 1 이 되면 균사가 다시 돌아오기 시작한다
  경계 ③ 그 방의 다른 원천들(갓 둘 · 껍질 조각)은 한 값도 달라지지 않는다

SPEC-009  없다는 것이 세계에 적혀 있다
  ① 협곡의 방들은 탄생지가 0 이고, 그 가운데 하나가 사유를 밝힌다
  ② ㉚ 이 방마다의 탄생 방식 분포를 보고하고, 사유를 밝힌 방을 그 보고에 함께 싣는다
  경계 ③ ㉚ 은 판정하지 않는다 — 사유가 있든 없든 `report` 다

SPEC-010  ㉛ 의 대상이 둘이고 둘 다 통과한다
  ① 살아 있는 것을 전제하는 회복 원인이 둘이다 (허물의 탈피 주기 · 균사의 사체 분해)
  ② 둘 다 개체군을 밝히고, 그 개체군을 세우는 탄생지가 세계에 있다 — `pass`
  경계 ③ 밝히지 않은 원천은 여전히 대상이 아니다 (밝히지 않은 것을 결손으로 세지 않는다)
```

## State

```text
RegionState.populations[id].metThisSeason : boolean   이 철에 요구가 한 번이라도 다 찼는가 (저장된다)
World.seasonsApplied                      : number    지금까지 적용한 철의 수 (저장된다)

(위 둘만 는다. 탄생지의 phase 와 진행 · 개체군의 값 · 원천의 phase 와 진행은 그대로다)
```

데이터 값 표 — **전부 데이터이고 규칙은 한 글자도 알지 못한다.**

```text
원천의 값마다 배속 (recoveryByLife · 값 0..상한 으로 색인)
  MOLT_LITTER   ← ORE_EATER    [0, 0.5, 1, 1.5, 2]   0 에서 정지 · 상한 4 에서 두 배 (확정 6)
  NEST_FUNGUS   ← TREE_FUNGUS  [0, 1, 2]             0 에서 정지 · 상한 2 에서 두 배 (같은 꼴)

멎음 코드 (noOwnerCode)
  MOLT_LITTER   no-molter      "벗을 것이 없다"
  NEST_FUNGUS   no-decomposer  "삭일 것이 없다"

개체군
  ORE_EATER     상한 4 · declineCause CONDITION_LOST · declineWhen [ ROOT_NODULE 이 있다 ]
  TREE_FUNGUS   상한 2 · declineCause CONDITION_LOST · declineWhen [ NEST_CARCASS 가 있다 ]
                (떼의 자락도 소란도 밝히지 않는다 — 균류는 돌지 않는다)

원천 하나가 는다 — 둥지의 사체 NEST_CARCASS (PREDATOR_NEST)
  재료 ORE_EATER_MOLT (새 Seed 를 만들지 않는다) · 형태 carcass · carrier residue ·
  기회 by-product · 공급 event-scarce · 되돌아옴 원인 nest-kill(둥지의 주인이 다시 사냥한다) ·
  채취 1 · 되돌아옴 240 초 · 자락 하나

탄생지 하나가 는다 — CARCASS_TO_FUNGUS (PREDATOR_NEST · TRANSFORMATION)
  세계 원인 FOREST_CHAIN · 규칙 RULE_NEST_TRANSFORM · 형태 carcass-bloom · 개체군 TREE_FUNGUS
  요구   [ NEST_CARCASS 가 있다 (no-carcass) · TREE_FUNGUS 가 1 이하 (fungus-crowded) ]
  결속   120 세계 초 · 머묾 120 세계 초 (확정 5 의 눈금 · 깊은 자리)
  먹는 것 [ NEST_CARCASS ] · 세우는 것 없음
  전조   삭는 모양(사체가 없으면 서지 않는다 · 결속 중 옅어진다) · 냄새의 자리
  뒤     붉게 되돌아온 흙

탄생지가 없는 사유 (absenceReason)
  FROST_CANYON  "열을 먹는 결정이 있어 결속에 쓸 열이 남지 않는다" (Frost 확정 2 · F6)
```

## Rule

```text
R1  RULE-RECOVERY-SPEED-001 (CHANGED)
    IF   원천이 되돌아오는 중이고, 그 원천이 값마다의 배속과 그 개체군을 밝혔다
    THEN 세계 시간 dt 가 `dt × 철의 배속 × 배속[그 개체군의 값]` 만큼 진행에 실린다.
         값이 목록보다 크면 마지막 값 · 세계가 모르는 개체군은 값 0 · 밝히지 않은 원천은 1.
    경계 되돌아옴의 **길이도 두 문턱도 한 값 바뀌지 않는다** (C020 이 철에 세운 그대로)

R2  RULE-SOURCE-CONDITION-001 (CHANGED)
    IF   원천이 아직 available 이 아니고, 그 원천이 밝힌 값마다의 배속이 지금 0 이며,
         멎음 코드를 밝혔다
    THEN 그 코드가 조건 코드 목록에 실리고, 되돌아옴의 진행이 그 코드로 멎는다
    경계 available 인 원천에는 걸리지 않는다 · 밝히지 않은 원천에는 한 글자도 늘지 않는다

R3  RULE-POPULATION-DECLINE-001 (ADDED · 세계 과정)
    IF   개체군이 요구(declineWhen)를 밝혔고 지금 그것이 다 차 있다
    THEN 그 개체군의 metThisSeason 이 참이 된다 (매 Tick)
    IF   시각이 낸 철의 수가 적용한 수보다 많다
    THEN 지난 철마다: metThisSeason 이 거짓인 개체군은 값 -= 1 (0 미만 없음) ·
         그리고 metThisSeason 을 거짓으로 되돌린다. 그 뒤 World.seasonsApplied 를 맞춘다
    경계 건너뛴 철은 지난 만큼 일어난다 — 첫 철만 metThisSeason 을 쓰고 나머지는 거짓으로 친다
    경계 요구를 밝히지 않은 개체군은 이 규칙이 건드리지 않는다
    경계 **관찰자와 무관하다** — 그 방에 몸이 없어도 돈다

R4  RULE-LIFE-BIRTH-001 (AFFECTED — 대상 집합만 는다)
    변성지도 결속·계승과 **같은 한 규칙**이 굴린다. mode 는 데이터의 글자일 뿐 규칙이 읽지 않는다

R5  RULE-LIFE-SITE-PHASE-001 (AFFECTED — 대상 집합만 는다)
    변성지의 전조와 뒤 자락도 같은 한 자리가 답한다 (전조는 조건과 결속으로 · 뒤는 SPENT 로)

R6  RULE-POPULATION-PRESENCE-001 (AFFECTED — 대상 집합만 는다)
    값이 내리면 선 자락이 그만큼 줄어든다. 자락을 밝히지 않은 개체군은 아무것도 서지 않는다
```

## REUSED / ADDED

```text
REUSED     LifeSite · LifeRequirement · lifeUnmetCodes · isBindablePhase · lifeSiteStateOf ·
           populationValueOf · swarmAreasIn · leavingLifeSiteOf · ResourceSource · sourceConditions ·
           sourceStateOf · depleteSourceState · standSourceState · initialSourceState ·
           seasonAt · turnsStartedAt · RECOVERY_VISIBLE_FRACTION · checkRegions 와 그 계약
ADDED      recoveryByLife · noOwnerCode · declineWhen · absenceReason · metThisSeason ·
           seasonsApplied · seasonsStartedAt · RULE-POPULATION-DECLINE-001 ·
           CheckLife.absences · TREE_FUNGUS · NEST_CARCASS · CARCASS_TO_FUNGUS · RULE_NEST_TRANSFORM
CHANGED    RULE-RECOVERY-SPEED-001 (개체군의 배속이 곱해진다) ·
           RULE-SOURCE-CONDITION-001 (멎음 코드 하나가 는다)
AFFECTED   RULE-LIFE-BIRTH-001 · RULE-LIFE-SITE-PHASE-001 · RULE-POPULATION-PRESENCE-001 ·
           RULE-SOURCE-RECOVERY-001 (배속을 곱하는 자리 하나) · ㉚ ㉛ 의 대상
```

## Observable (관찰 계약)

투영은 **한 항목도 늘지 않는다** — C022·C023 이 세운 자리가 이번 것을 그대로 나른다.

```text
resources[].conditions[]   원천의 조건 코드 — 여기에 `no-molter` · `no-decomposer` 가 실린다 (기존 자리)
resources[].kind           변성지의 자연 형태 `carcass-bloom` · 사체의 형태 `carcass` (기존 자리)
traces[]                   변성의 전조 둘과 뒤 자락 하나 (기존 자리 · 덧씌움)
presences[].area           떼의 자락 — 값이 내리면 그만큼 줄어든다 (기존 자리)

투영하지 않는 것 (그대로다)
  개체군의 값과 그 이름 · metThisSeason · 적용한 철의 수 · 탄생지의 진행 · 되돌아옴의 배속.
  **값은 어디에도 실리지 않는다** — 관찰자가 읽는 것은 자락의 넓이와 멎은 것의 사유뿐이다.
  이것이 이 Play 의 미지감이다: 수를 세는 것이 아니라 세계가 마르고 차는 것을 본다
```

## UNRESOLVED

없음.

**기본형으로 둔 것** (Design 이 침묵해 기존 규율로 답했다 — Human 이 감사할 자리):

```text
① 거목균(TREE_FUNGUS)이 **개체군으로 선다** — 확정 6 의 눈금 표에는 셋(광식충 · 조류 · 포식수)뿐이나,
   Play §5.7 이 요구한 변성형은 값을 올릴 개체군이 있어야 성립한다. Concept §4 의 사슬에 이미 있는
   균류를 그 자리에 세웠다. 상한 2 는 확정 6 의 눈금(4 · 2 · 1)에서 가운데를 골랐다
② 값이 내리는 판정을 **철이 바뀌는 순간**에 둔다 (확정 6 "한 철 이어지면"). "이어졌는가" 는
   그 철 동안 한 번이라도 찼는가로 잰다 — 태어남이 잠깐 먹어 비는 것을 결핍으로 세면
   값이 결코 자라지 못한다
③ 값마다의 배속을 **목록**으로 둔다 (확정 6 은 두 끝만 말한다 — 0 에서 정지 · 상한에서 두 배).
   사이는 고르게 폈다. 곡선을 데이터로 두면 폴리싱이 코드 변경 없이 된다
④ 사체(NEST_CARCASS)의 되돌아옴은 **시간**이다 — 그것을 남기는 포식수는 C025 가 세운다.
   그래서 그 원인(`nest-kill`)을 아직 ㉛ 의 대상 목록에 넣지 않았다 (넣으면 주인 없는 원인이 되어
   검사가 붉어진다). 넣는 것은 포식수가 서는 C025 다 — TODO §4 에 적는다
⑤ 변성의 결속 120 초 · 머묾 120 초 · 사체의 되돌아옴 240 초 — 확정 5 의 눈금(60 · 90 · 120 · 180)과
   D3 의 깊이 규칙(깊은 자리가 길다)을 따랐다. 둥지는 wild 다
⑥ 변성의 요구에 "거목균이 1 이하" 를 둔다 — 상한에서 전이가 통째로 서지 않는 것(C023 경계)을
   요구로도 밝혀 두면 관찰자가 그 사유를 지목으로 읽는다. 규칙은 그대로다
⑦ 협곡의 사유는 **빙결 협곡(FROST_CANYON) 하나**가 밝힌다 — 얼음 협곡·고개까지 세 방에 같은
   글자를 세 번 적지 않는다 (Material 의 고립 사유가 백왕령 하나에 적힌 그 어법)
```
