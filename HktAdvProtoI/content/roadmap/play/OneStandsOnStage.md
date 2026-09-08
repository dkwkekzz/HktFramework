# OneStandsOnStage — 한 명만 무대에 선다

상태: **초안 — Human 승인 대기.** 승인은 "C034 진행" 한 마디로 갈음한다 — 그 말이 곧 승인이고, 문서 끝 Human 질문의 **제안값이 확정 후보**로
첫 Cycle 의 spec 에 든다 (답을 주면 그 답이 든다). 선행: 2층 Play 여덟 가운데 Frost · Access 가 세운 것(협곡 · 문의 요구 · 성질 어휘)을 쓴다 —
C029(Access 의 Lock 데이터 계약)가 main 에 있어야 C036 이 실현된다. C034 · C035 는 지금 실현할 수 있다.

## 0. Row

**기반 층 L3 — 주체와 몸.** 놓는 미지: **M8 협곡의 열을 쫓는 것** (생물 — 무엇을 원하는지 안다: 열).

로드맵의 원칙은 "한 번에 한 층" 이고 2층은 아직 Play 실주행 판정 중이다. 그러나 7층 주입물([L7-Fairy-Growth-Combination.md](../L7-Fairy-Growth-Combination.md))이
먼저 와서 확정됐고, 그 배분(L7 §3)의 3층 몫 — **편성 · 무대의 한 명 · 교체 · 요정 Core 가 몸의 State 로 적힌다** — 을 Human 이 지금 열기로 했다
(STATE §1 Human 결정). 3층의 다른 절반(몸이 무엇을 가지는가 · 생물이 무엇을 알고 어떻게 행동하는가)은 이 Play 가 **최소로** 연다 — 깎이고 회복되는
값 하나(온기)와, 그것을 원하는 생물 하나. 그 이상(감각 · 지식 · 성장 단계 · 능력치 전반)은 3층의 다음 Play 다.

이 Play 가 증명하는 축은 하나다: **무대에 서는 몸은 하나이고, 어느 몸이 서는가가 세계에 개입하는 방법을 바꾼다.** 그것을 보이려면 몸이 세계에
깎여야 하고(추위), 세계가 몸에 무언가를 요구해야 하고(문 — 2층이 세운 `heat:hides`), 몸을 원하는 것이 있어야 한다(포식자). 셋 다 협곡에 이미 자리가 있다.

```text
2층이 세운 것 (그대로 쓴다)   협곡 방 둘 · 눈보라 area · 결정면 · FROST_DEPTH 의 문(time: LONG_NIGHT + property: heat:hides — Access §14.1) ·
                            문 앞의 흔적과 현상(C029) · 성질 어휘 · "체온을 쫓는 포식자" 가 남긴 언 사체(FROZEN_REMAINS · Frost 5.2)
이 Play 가 처음 세우는 것    편성(요정 여럿) · 무대의 몸 하나 · 교체(Leave · Entry 의 자리) · 온기(깎이고 회복되는 값) · Core 가 몸의 State 로 적히는 것 ·
                            property Lock 을 몸이 답하는 첫 판정(Access K12 — "3층이 받는다") · 걸어 다니며 무언가를 원하는 생물 하나
하지 않는 것                 요정의 획득(7층) · Class(6층) · Leave/Entry 의 효과 내용(6층 — 여기서는 자리만) · 소지의 판정(4층) · 피해 종류(5층) ·
                            생물의 지식과 학습(3층 다음 Play) · 새 방 짓기
```

## 1. References

- [L7-Fairy-Growth-Combination.md](../L7-Fairy-Growth-Combination.md) — §9 원정 편성 · §10 한 명만 무대에 · §11 Active/Entry/Leave/Off-field · §20 탐험에서도 교체 · §4~§5 Fairy Core · 확정 2(계열 여섯) · 확정 4(대기 요정은 몸이 없다 · 교체 제약 없음) · 확정 5(파티 크기는 세계 조건) · 확정 10(소지는 요정별) · 확정 11(수치 축 유지) · 위임 D1 · D5
- [L2-World-Access.md](../L2-World-Access.md) — §14.1 FROST_DEPTH Lock(`heat:hides`) · §15 Possible Answers 중 **Actor: 체열 억제 능력** · K10(World Truth ≠ Player Observation ≠ Actor Knowledge) · K12(property Lock 의 판정은 3층) · §3.1 "3층이 받는다" 줄
- [RoomAsksForPossibilities.md](RoomAsksForPossibilities.md) — W46~W52(어휘 · Lock 데이터 · 문 앞 현상 · 완화 표시) · C029~C031 · "property Lock 이 실제로 열리게 한다 → 3층의 Cycle"
- [RoomOfAnotherKind.md](RoomOfAnotherKind.md) · [M5-FrostCanyon.md](../M5-FrostCanyon.md) — 협곡 방 둘 · 눈보라(관찰 범위) · 결정면(접촉 코드) · Cause Network "열이 귀해 체온을 쫓는 포식자" · FROZEN_REMAINS
- [L2-World-Life.md](../L2-World-Life.md) F10(태어난 개체의 몸 · 행동은 3층) · F11(요정은 특수 탄생 — 7층) · [L2-World-Time.md](../L2-World-Time.md) 2.6(지나가는 것)
- [design/Design-Concept.md](../../../design/Design-Concept.md) §7 Natural Law(추운 환경에서 체온이 내려간다 — 문법 예시) · [design/Design-Subject-Decision.md](../../../design/Design-Subject-Decision.md) §6 목적(주체가 만들고자 하는 세계 상태) · §25 직접 명령과 자율 행동
- [design/Design-Inventory-Equipment-D1.md](../../../design/Design-Inventory-Equipment-D1.md) §26.1 "현재 컨트롤 캐릭터는 아직 없는 개념" — 이 Play 가 그 결손을 연다
- [L0-Game.md](../L0-Game.md) §1 둘째 원문 · §4 · 미증명 ③(성장 선택의 애착과 고민)
- TODO.md §3 "협곡을 지나는 것(체온을 감지하는 포식자) — 3층 · 생명" — 이 Play 가 받는다 (지운다)

## 2. Play Goal

**관찰자가 요정 둘(화염계 · 백왕계)을 편성해 백왕령을 떠나 협곡을 지나는 동안 — 추위가 무대에 선 몸의 온기를 깎고, 교체하면 다른 Core 의 몸이
서서 깎임이 달라지며, 빙결 심층의 문이 "체열을 감춘" 몸에게만 열리고, 열을 쫓는 것이 따뜻한 몸만 따라오는 것을 겪는다. 누가 무대에 설지 고르는
것이 협곡을 건너는 방법이 된다.**

완료 확인 다섯:

```text
① 세계에 관찰자의 몸은 언제나 하나다 — 편성은 둘이어도 actors 에는 하나. 교체하면 그 자리에 다른 요정의 몸이 서고, 이전 몸은 사라진다(저장된 편성에 값이 남는다)
② 협곡의 추위 자락 안에서 백왕계의 온기가 깎이고 0 이면 생명이 깎인다. 화염계는 깎이지 않는다. 백왕령에 돌아오면 온기가 돈다
③ 빙결 심층의 문 앞에서 — 온기가 문턱 아래인 백왕계에게는 문이 열리고(heat:hides 를 몸이 답한다), 화염계에게는 "체열이 감지된다" 로 닫힌다. 긴 밤이 아니면 둘 다 닫힌다
④ 열을 쫓는 것이 협곡을 지나며 온기가 문턱 위인 몸을 감지해 다가온다 — 화염계는 쫓기고, 식은 백왕계는 지나쳐진다
⑤ 둘째 관찰자가 첫째의 교체를 본다 — 존재가 바뀐다. 떠난 자리와 들어선 자리가 판에 남는다(Leave · Entry 의 자리)
```

## 3. Experience Intent

```text
Start   "협곡은 나를 깎는다. 화염계로 바꾸니 안 깎인다 — 됐다."
End     "안 깎이는 몸으로는 문이 안 열리고 쫓긴다. 식은 몸으로는 문이 열리지만 죽어 간다. 누구를 언제 세우느냐가 길이다 —
         내 요정 둘은 강하고 약한 게 아니라 세계에 다르게 답한다."
```

L0 미증명 ③(요정을 성장시키는 선택에 애착과 고민이 생기는가)의 첫 실감 — 성장이 아니라 **선택**에서 먼저 온다. 같은 문 앞에서 두 몸이 서로 다른 답이다.

## 4. Breath

```text
편성 → 무대 → 추위 → 깎임 → 교체 → 안도 → 요구 → 거절 → 식힘 → 열림 → 쫓김 → 갈림 → 돌아옴
```

Core Breath 의 `위험 → 관찰 → 이해 → 시도 → 극복` 구간. "극복" 이 수치가 아니라 **어느 몸을 세우는가**로 온다.

## 5. Play Structure

### 5.1 편성 · 무대 — 관찰자는 몸이 아니라 편성을 가진다

```text
존재   Party(관찰자마다 하나 · 저장) — FairyEntry 둘(화염계 · 백왕계): 각각 Core(계열) · 몸의 값(hp · cp · 온기) · 소지(확정 10) · activeIndex
       세계의 actors 에는 activeIndex 의 몸 하나만 있다 (확정 4 — 대기 요정은 몸이 없다)
상태   RULE-PARTY-SWITCH-001(Action Law — 관찰자 요청): 무대의 몸을 편성에 되접고(값 · 소지 · 자리) 다른 항목의 몸을 같은 자리에 세운다.
       Leave 자리(떠난 몸의 자리 · 시각)와 Entry 자리(들어선 몸)가 기록된다 — 효과는 없다(6층). 제약 없음 (확정 4) · 진행 중인 행동은 끊긴다
관찰   판의 「무대」 줄(누가 서 있는가 · 대기 누구) · 교체 순간 존재가 바뀐다(그림 · 이름) · 기록에 "떠남 · 들어섬" 한 줄 · 둘째 관찰자에게도 같은 존재
추론   "나는 하나의 몸이 아니다. 무대에 세울 것을 고른다"
반응   교체를 눌러 본다 — 백왕령에서는 아무 일도 달라지지 않는다 (아직 세계가 몸을 가리지 않는다)
```

### 5.2 추위 · 깎임 — 세계가 몸을 깎는다 (3층의 첫 값)

```text
존재   온기(warmth · warmthMax — Actor State · 저장 · 편성에 되접힌다) — 계열이 정하는 값. 협곡의 추위 자락 = 이미 있는 hazard/climate(눈보라 area) +
       협곡 방 전체의 상시 위상(phases.standing — Frost C019) 에 **몸에 하는 일**(chill) 하나가 붙는다
상태   RULE-CHILL-001(Natural Law): 추위 자락 안의 몸은 tick 마다 온기가 깎인다 — 눈보라 안은 더 빠르다. 온기 0 이면 생명이 깎인다(RULE-COLD-DAMAGE-001).
       자락 밖(백왕령 · 조건 area)에서는 온기가 돈다(RULE-WARMTH-RECOVER-001). 값은 Human 질문 3 의 제안
       Core 가 몸의 State 로 적힌다: 화염계 몸은 heat:emits 를 가진다 → 추위가 온기를 깎지 못한다 (Actor 가능성 — Access §15 의 Actor 줄이 처음 0 이 아니게 된다)
관찰   판에 온기(압력 줄과 같은 형식) · 깎이는 동안 몸의 숨이 어는 표식이 짙어진다(Frost 의 trace 어법) · 0 에 닿으면 생명 줄이 줄기 시작한다 ·
       화염계로 서면 표식이 없다 · 지목한 몸의 판에 성질 문장("열을 낸다" — C029 의 재료 성질 문장과 같은 어법)
추론   "이 방은 내 몸을 깎는다. 화염계는 안 깎인다 — 저 아이의 본질이다"
반응   협곡에서는 화염계를 세운다. 안도
```

### 5.3 요구 · 거절 · 식힘 · 열림 — 문이 몸에게 답을 묻는다 (property Lock 의 첫 판정)

```text
존재   FROST_DEPTH_DOOR 의 Lock — time: LONG_NIGHT + property: heat:hides (Access §14.1 · C029 의 데이터 계약 그대로). 2층은 표시까지였다(K12)
상태   RULE-LOCK-PROPERTY-001: 몸의 성질 집합(Actor.properties — **저장하지 않는다**, 몸의 State 에서 유도: 온기 < 문턱 → heat:hides · 화염계 Core → heat:emits ·
       그 밖은 없음)이 Lock.requires 를 만족하면 Connector 활성. 판정은 건너기 요청 때 · 활성 표시는 문 앞에서. 2층의 time 판정은 그대로 앞에 선다
관찰   화염계로 문 앞: "체열이 감지된다" (C029 의 사유 코드 그대로 — 이제 표시가 아니라 거절이다) · 백왕계로 서서 온기가 문턱 아래로 내려가면 김이 사라지고
       문의 표식이 열림으로 바뀐다 · 건너면 경계(FROST_DEPTH 는 아직 짓지 않은 곳 — region-not-built 그대로) · 긴 밤이 아니면 "이 철이 아니다" 가 먼저 선다
추론   "문은 살아 있는 것이 아니라 열을 본다. 식어야 지난다 — 식으면 죽어 간다"
반응   문 앞에서 백왕계로 바꾸고 기다린다. 온기가 문턱을 지나면 건넌다 — 생명이 줄기 전에
```

Access ㊴ 의 Answer Map 에서 `heat:hides` 의 Actor 열이 0 → 1 이 된다 (world:observe --report). 열 결정(HEAT_CRYSTAL · C030)과 눈보라 완화(C031)는
그대로 다른 종류의 답이다 — 이 Play 는 그 둘을 건드리지 않고 셋째 종류(Actor)를 세운다. **하나의 요구에 세 종류의 답**이 처음 실제로 선다 (Access 이후 Play 줄).

### 5.4 쫓김 · 갈림 — 열을 원하는 것 (M8 · 3층의 첫 생물)

```text
존재   M8 열을 쫓는 것 — 협곡의 자율 존재 하나(control: autonomous · 종류 하나 · 카탈로그 셋 자리). 긴 밤과 스밈에 FROST_CANYON 을 순회한다(wanderPath — 기존 기구).
       무엇을 원하는지 안다: **열** (Subject-Decision §6 — 목적 = 만들고자 하는 세계 상태: "따뜻한 것에 닿는다")
상태   RULE-HEAT-SEEK-001: 감지 범위 안에 온기가 문턱 위인 몸이 있으면 순회를 끊고 그 몸으로 다가간다(npc-decide 의 기존 판단에 목적 하나가 는다).
       닿으면 기존 타격(strike)으로 생명을 깎는다 — 5층이 아니라 기존 기본 전투 정책 그대로. 온기가 문턱 아래인 몸은 감지하지 않는다 — 지나친다.
       언 사체(FROZEN_REMAINS · Frost 5.2)가 그것이 지난 자리에 선다 — 2층이 "경로가 지난 자리" 로 세운 것을 이 생물이 실제로 남긴다
관찰   그것의 그림 · 다가올 때 판의 「지나는 것」 줄에 "열을 쫓는다" · 화염계로 서면 따라오고 식은 백왕계로 서면 지나친다 · 지목하면 "따뜻한 것을 원한다"
추론   "안 깎이는 몸은 눈에 띈다. 식은 몸은 안 보인다 — 문과 같은 눈이다. 세계는 하나의 눈으로 나를 본다"
반응   갈림 — 문까지는 화염계로 빨리 가고, 문 앞에서 식힌다 · 또는 처음부터 식은 채 빨리 지난다 · 또는 그것이 없는 철에 간다. 정답은 없다 (L7 §16)
```

### 5.5 돌아옴

```text
존재   백왕령 — 추위 자락 밖. 온기가 돈다. 편성 둘의 값이 각자 남아 있다(화염계는 성하고 백왕계는 깎였다)
관찰   판의 「무대」 · 「온기」 · 기록의 떠남 · 들어섬 열 줄
추론   "둘 다 내 것이고 둘 다 필요했다. 셋째가 있으면 무엇을 세울까" (L7 §22 초반 → 중반의 첫 걸음 · 미증명 ③)
```

## 6. Required Capability

```text
Existing   Rooms · Land · Rule · Material · Time · Frost(협곡 방 둘 · 눈보라 area · 결정면 · FROST_DEPTH 문 · phases.standing · 관찰 범위 · 접촉 코드) ·
           Observe(지목 · 판 · 기록) · Access C029~C031 의 W46~W52(어휘 · Lock 데이터 · 문 앞 현상 · 사유 코드 · Answer Map) · 자율 존재(spawn · wanderPath ·
           perceptionRange · npc-decide · strike) · 기본 전투(hp · downed) · 관찰자의 몸(RULE-OBSERVER-JOIN-001 · observer-body) · CONNECTOR_ACTIVATIONS ·
           카탈로그 3원소 · HKT_SPAWN* · HKT_NPCS · HKT_CLOCK
Required — 세계 (content/world · content/regions)
  W53  Party — 관찰자마다 편성 하나 (FairyEntry[] · activeIndex · 저장). FairyEntry = lineage(Core 계열) · characterKind · 몸의 값(hp · cp · 온기) · 소지.
       관찰자가 참여하면 몸 하나가 아니라 편성이 생기고 activeIndex 의 몸만 actors 에 선다. 시작 편성 둘(Human 질문 1 · D1 후보)
  W54  교체 — RULE-PARTY-SWITCH-001 (관찰자 요청 · 되접기 · 같은 자리에 세우기 · Leave/Entry 기록 · 진행 중 행동 취소 · 제약 없음). 둘째 관찰자에게 존재 교체로 보인다
  W55  온기 — Actor State warmth · warmthMax(카탈로그) · RULE-CHILL-001(추위 자락 · tick) · RULE-COLD-DAMAGE-001(0 이면 hp) · RULE-WARMTH-RECOVER-001(자락 밖).
       추위 자락 = hazard/climate area + phases.standing 에 "몸에 하는 일" chill 하나 (Frost 의 observeRangeScale · contact 와 같은 자리)
  W56  Core 가 몸의 State 로 — 계열(lineage)이 카탈로그의 한 열이 되고, 몸의 성질 집합(Actor.properties)이 State 에서 **유도**된다(저장 안 함):
       화염계 → heat:emits (추위가 깎지 못한다) · 온기 < 문턱 → heat:hides. 어휘는 W46 의 것 — 새 어휘 없음
  W57  property Lock 의 판정 — RULE-LOCK-PROPERTY-001: Lock.requires 의 property 를 Actor.properties 로 판정해 Connector 활성. time 판정 뒤에 선다.
       "표시일 뿐" 이던 C020 · C029 의 분할선을 여기서 넘는다 (K12 의 3층 몫). Answer Map 의 Actor 열이 센다
  W58  M8 열을 쫓는 것 — 카탈로그 한 항목 · 협곡 순회(철 조건: 긴 밤 · 스밈 — 2층의 "지나가는 것" 어법) · RULE-HEAT-SEEK-001(감지 문턱 · 다가감 · 지나침) ·
       지난 자리에 FROZEN_REMAINS 가 선다(Material RESIDUE 의 기존 Source 를 이 생물이 만든다). 이름은 Human (질문 2)
  W59  투영 — 편성(무대 · 대기) · 온기 · 몸의 성질 문장 · 열을 쫓는 것의 목적 문장 · Leave/Entry 기록. 봉투에 새 자리 셋 (편성 · 온기 · 성질)
Required — 표현 (content/view)
  V26  교체 입력 — 키 하나(bindings) · 판의 「무대」 줄(누가 서 있고 누가 대기인가) · 교체 순간 존재 바뀜(그림 · 이름 — 카탈로그 둘째 · 셋째 항목)
  V27  온기 — 판의 「온기」 줄(압력 · 소란과 같은 형식) · 깎이는 몸의 숨이 어는 표식 짙기 · 0 에 닿으면 생명 줄 · 화염계는 표식 없음
  V28  문구 — on-stage(무대) · waiting(대기) · left-here(떠났다) · entered-here(들어섰다) · chilled(식어 간다) · warm-body(열을 낸다) · hidden-heat(열이 감춰졌다) ·
       seeks-warmth(따뜻한 것을 원한다) · 문의 거절은 C029 의 asks-warmth 그대로
  V29  M8 의 그림 — motions/<kind>/ 하나 (없으면 placeholder — 카탈로그 규칙 그대로)
Required — 기구 (ENGINE 레인)
  E22  없음 — 관찰자 참여(observer-join)는 몸이 아니라 "컨텐츠가 만드는 것" 을 이미 팩에 맡긴다. 편성은 팩의 것이다. 봉투 확장은 protocol-core 의 기존 확장 자리
```

### 불변 조건 — 코드 변경 없이 폴리싱

```text
계열을 더한다 · 온기 값을 바꾼다 · 문턱을 바꾼다 · 추위 자락을 옮긴다 · 감지 범위 · 순회 철을 바꾼다 · 시작 편성을 바꾼다
    → content/regions · character-catalog · 카탈로그 3원소의 데이터만
Leave/Entry 에 효과를 붙인다(장판 · 상태) → 6층. 교체에 제약을 둔다 → 확정 4 를 뒤집는 Human 결정. 요정을 얻는다 · 편성을 늘린다 → 7층
```

## 7. Cycle Breakdown

번호는 C034 부터다 — C032 · C033 은 [TrailBehindClueAhead](TrailBehindClueAhead.md) 의 것이다.

```text
[ ] C034 — 무대의 한 명: Party(W53 · 시작 편성 둘) + 교체(W54) + 투영과 판의 「무대」(W59 일부 · V26 · V28 일부) + 둘째 관찰자가 본다(완료 확인 ① ⑤).
           세계는 아직 몸을 가리지 않는다 — 백왕령 · 숲 · 협곡 어디서든 교체가 되고 아무것도 달라지지 않는다. Cycle 없이 값이 도는 것이 증명이다
[ ] C035 — 추위가 몸을 깎는다: 온기(W55) + Core 가 몸의 State 로(W56 — heat:emits 만) + 판의 「온기」 · 숨 표식(V27) + 되접힌 값(편성에 남는다) — 완료 확인 ②.
           협곡 왕복: 백왕계로 들어가 깎이고 · 화염계로 바꿔 멎고 · 돌아와 돈다
[ ] C036 — 문이 몸에게 묻는다: property Lock 판정(W57) + heat:hides 의 유도(W56 나머지) + Answer Map Actor 열 + 문 앞의 거절 · 열림(V28) — 완료 확인 ③.
           **C029 가 main 에 있어야 한다** (Lock 데이터 계약 W47). 그 전에는 명세(spec)까지만
[ ] C037 — 열을 쫓는 것: M8(W58 · V29) + RULE-HEAT-SEEK-001 + 언 사체를 실제로 남긴다 + 「지나는 것」 · 목적 문장 — 완료 확인 ④ + Play Goal 실주행
           (백왕령 → 고개 → 협곡 · 긴 밤 · 쫓기고 · 식히고 · 문을 지나 · 돌아온다)
```

각 항목은 작다 · 플레이 가능 · World 변화 분명 · 관찰 가능 · 검증 가능 · 재사용 가능. 순서는 의존성(편성이 있어야 되접을 값이 있고 · 값이 있어야
성질이 유도되고 · 성질이 있어야 문이 묻고 · 문이 묻는 눈과 같은 눈으로 생물이 본다)이자 Breath 순서다. C034 · C035 는 Life · Access 와 병행할 수 있다
(Reuse 가 겹치지 않는다 — 편성과 온기는 새 State 다). C036 은 C029 뒤, C037 은 C036 뒤.

## Human 질문 (제안값 포함 — "C034 진행" 이면 제안이 확정 후보로 spec 에 든다)

```text
1. 시작 편성 둘 — 화염계 + 백왕계 (D1 의 이 Play 몫)
   제안: 백왕계(백왕령의 요정 — Core 결속 · 온기가 평범해 깎이고 식는다)와 화염계(Core Heat — 추위에 답하되 감지된다). 둘의 대비가 이 Play 다.
   획득 방식은 여기서 정하지 않는다 — 편성은 처음부터 둘로 시작한다 (D1 의 나머지 절반은 7층)

2. M8 의 이름
   "체온을 쫓는 포식자" (Concept §6 · TODO §3) 에는 이름이 없다. 제안 코드 이름 `HEAT_STALKER` · 부를 이름은 Human. 이름 없이 진행하면 코드 이름으로 선다

3. 온기의 값 (전부 Cycle 이 소유하되 규모는 Human)
   제안: warmthMax 100 · 협곡 상시 자락 −1/초 · 눈보라 안 −3/초 · 회복 +2/초(자락 밖) · 감춤 문턱 30(이 아래면 heat:hides) · 온기 0 이면 hp −2/초.
   협곡 왕복(23 걸음 · 약 40초)이 백왕계로는 "식되 죽지는 않는" 길이가 되도록 잡았다. 실측 뒤 조정

4. 열을 쫓는 것의 감지
   제안: 감지 범위 12(눈보라 안에서는 관찰 범위와 같이 좁아진다 — Frost 의 기제) · 감지 문턱 = 감춤 문턱과 같은 30(문과 같은 눈) · 순회 철은 긴 밤 · 스밈 ·
       닿으면 기존 타격. 죽이지 않는다 — 몸이 쓰러지면 떠난다 (사체 남김은 2층 기제 그대로)

5. 화염계는 온기가 전혀 안 깎이는가
   제안: 안 깎인다 (heat:emits — Core 다). 다른 길: 느리게 깎인다. 안 깎여야 "안도 → 그러나 눈에 띈다" 의 대비가 선명하다

6. 교체 순간의 자리
   제안: 같은 자리에 선다 · 진행 중 행동은 끊긴다 · 통행 불가 칸이면 교체가 거절된다("설 자리가 없다"). Leave/Entry 는 자리와 시각만 기록 (효과는 6층)
```
