# RoomRemembersAndOffers — 방은 기억하고, 때가 되면 내민다

상태: **초안 — Human 승인 대기** (문서 끝 Human 질문 열). 계약은 [L2-World-Foundation.md](../L2-World-Foundation.md) (초안 — 이 Play 와 한 번에 승인한다).
선행: [RoomNeverSame.md](RoomNeverSame.md)(시계 · 경로 · 떨어진 비늘 · 뒤척임) · [RoomBearsMaterial.md](RoomBearsMaterial.md)(원천 · 캔 횟수 · 고갈) ·
[RoomAnswersWhenAsked.md](RoomAnswersWhenAsked.md)(지목과 판) — 셋 다 닫혀 있다. 이 Play 는 그 셋 위에 **기억 · 조건의 한 형 · 기회**를 얹는다. 새 축을 요구하지 않는다.

## 0. Row

**기반 층 2 — 세계 절반 ②-부속 다섯째(Region Foundation)의 증명 Play.** 2층의 기획 증명 여덟째다.
이 Play 가 놓는 것: *방은 자기에게 일어난 일을 센다 — 되돌아옴이 자국을 지우고 뒤척임이 발자국을 묻어도 셈은 남는다. 세계의 조건은
종류가 아니라 **한 형**으로 적히고, 그 형이 기억을 읽을 수 있다. 방이 내미는 것(기회)은 데이터이고, 때가 있는 기회가 Event 다 —
첫 Event 는 전투가 아니라 채집이다.*

놓는 미지: **없음** — 미지 M4 천공고래의 길을 한 번 더 깊게 한다 (비늘이 **기회**가 된다). 이름 있는 새 사실을 Human 이 주면 그것으로 바꾼다 (Human 질문 2).

미증명 ①(재방문해도 재미있는가)의 **2층 몫 셋째**다 — Time 이 "다른 때" 를, Life 가 "안에서 계속 새로 생기는 것" 을 주었다면, 이 Play 는
**"다른 과거"** 를 준다: 같은 방이 내가(우리가) 한 일을 셈해 두고 그것이 다음 조건이 된다. 미증명 ④(발견 뒤에도 살아 움직이는가)에도 닿는다 —
발견된 방이 "지금은 없고 그때는 있는 것" 을 내민다 (G4).

```text
이 Play 가 세우는 것    RegionState.history(항목 다섯 · D4) · 수명 표(State 필드마다 지우는 손) · 판의 「기억」 줄 · Condition 형과 평가기 ·
                      흩어진 조건 자리 넷의 한 형 읽기 · History 를 읽는 첫 조건 · Opportunity 형과 첫 기회(비늘 · Event) · 판의 「할 수 있는 것」 줄이
                      기회에서 오는 것 · Mutation op 표의 대조 · 검사 ㊸~㊼ · 기회 표 · T2 열셋째 답 · T4 결정 나무
이 Play 가 세우지 않는 것  새 세계 사실(이름 · 원천 · 규칙) · 확률 · Player Knowledge(3층) · 기회의 판정 변경(available/reason 은 지금 규칙 그대로) ·
                      Region 자체 성장(G12 빈칸 3) · Object 류 · 지도
```

## 1. References

- [L2-World-Foundation.md](../L2-World-Foundation.md) — 원문 §2.8 · §3 · §4 · §5 · §8 · §10 · §14 · §15 · 확정 후보 G1~G13 · §4 데이터 계약 · §5.2 검사 ㊸~㊼ · §8 대조 · §10 D1~D4
- [L2-World-Time.md](../L2-World-Time.md) 2.6 지나가는 것 · 2.7 남의 행동은 내 흔적 · T7 · T8 · §3 PresenceRoute(leavesBehind)
- [L2-World-Material.md](../L2-World-Material.md) S3(WORLD_EVENT 역할) · S6 생애 · S8 채취는 결과를 남긴다 · §6.2 ResourceSource
- [L2-World-Access.md](../L2-World-Access.md) §4.3 Lock.requires(time · state 항) · 빈칸 1 — 조건 자리를 옮기는가의 선례
- [L2-World-Region.md](../L2-World-Region.md) R4(World State 는 공유된다) · R13(규칙 코드는 이름을 모른다) · §10 Connector 의 persistence 항
- [L1-World-Grammar.md](../L1-World-Grammar.md) §1 저장과 유도 · §3 확률 없음
- [RoomNeverSame.md](RoomNeverSame.md) 확정 9(비늘 · WORLD_EVENT) · §5 뒤척임이 자국을 묻는다 · C018 "되돌리는 것은 다시 지나가는 것"
- [RoomBearsMaterial.md](RoomBearsMaterial.md) W18 Source phase · taken · C012 자국 넷
- [RoomAnswersWhenAsked.md](RoomAnswersWhenAsked.md) 확정 7 · 12(관찰자가 쥐는 것 · 답의 출처) · §5.3 지목 · C027 「할 수 있는 것」 줄
- TODO.md §2 Time — "Observable ⑤ 와 SPEC-006 경계 ① 중 어느 쪽인가" · §3 "World Event Opportunity → 다음 Region 의 Play" (이 Play 가 받는다)
- [L0-Game.md](../L0-Game.md) §3 Core Breath — `이해 → 시도` 와 `극복 → 성장 → 새로운 미지`

## 2. Play Goal

**관찰자가 숲 가장자리에서 원천 하나를 세 번 캐고 되돌아온 뒤 지목했을 때 "세 번 캐였다 · 마지막 고갈은 N초 전" 을 판에서 읽고,
고래가 한 번도 지나지 않은 동안에는 비늘 자리가 아무것도 내밀지 않다가 고래가 지난 뒤 판이 그 자리를 「할 수 있는 것: 채취」로 내미는 것을 보고
(언제까지인지는 세계가 말하지 않는다), 캐고 나면 "지나간 뒤 캐였다 — 다시 지나야 한다" 로 닫히는 것을 읽으며, 뒤척임이 발자국과 자국을 묻은 뒤에도
내 자리의 판에 "뒤척임 두 번 · 고래가 한 번 지났다" 가 남아 있는 것을 확인하고, 세계 보고에서 방마다 기회의 수와 State 마다의 수명이 한 표로 서는 것을 본다.**

완료 확인 여섯:

```text
① 원천을 캐고 되돌아온 뒤 taken 은 0 인데 history.takenTotal 은 3 이다 — 지목한 판이 「기억」 줄로 그것을 말한다. 화면 위 글자 · 숫자 HUD 는 없다
② 세계를 저장하고 되살려도 history 가 남는다 (WORLD · 스냅샷). 뒤척임은 자국 · 발자국을 묻되 history 를 묻지 않는다 (Human 질문 4)
③ 조건 자리 넷(CONNECTOR_ACTIVATIONS · phases.connectorActivation · occurrence.seasons/dayPhases · Lock.requires 의 time/state)이 하나의 Condition 형으로
   읽히고, 규칙 코드에는 여전히 방 · 철 · 원천의 이름이 0 이다 (R13). 검사 ㊹ 가 넷을 한 번에 본다
④ 고래가 지난 적 없는 방에서 비늘 자리를 지목하면 판이 기회를 내밀지 않고, 지난 뒤에는 「채취」를 내밀며, 캔 뒤에는 "다시 지나야" 로 닫힌다 —
   세 답이 전부 **하나의 기회 데이터**(availability · progress)에서 나온다. "언제 다시 지나는가" 는 실리지 않는다
⑤ Opportunity 의 outcomes.world 가 §4.2 표의 op 만 쓰고(㊺), 그 op 가 지금 있는 Transition 을 가리킨다 — 코드가 옮겨지지 않았다(diff 로 확인)
⑥ world:check 가 ㊸~㊼ 을 보고하고, world:observe --report 에 기회 표와 수명 표가 선다 — 기회가 하나도 없는 방(백왕령 · 미로)이 눈에 띈다
```

## 3. Experience Intent

```text
Start   방은 지금만 있다. 캐면 자국이 남지만 되돌아오면 없던 일이고, 뒤척임이 지나면 발자국도 없다. 세계는 내가 한 일을 잊는다.
        비늘은 고래가 지나면 거기 있고 아니면 없다 — 왜 지금은 없는지 세계는 "아직 그때가 아니다" 밖에 말하지 않는다.
End     방은 센다. 세 번 캤다는 것을, 뒤척임이 두 번 지났다는 것을, 고래가 한 번 지났다는 것을 — 누가 했는지는 세지 않는다.
        비늘 자리는 고래가 지난 적이 있어야 무언가를 내밀고, 캐면 "다시 지나야" 로 닫힌다. 때가 있는 기회다.
        그리고 그 셋 — 기억 · 조건 · 기회 — 이 전부 한 형의 데이터라서, 다음 방에 다른 기회를 두는 것은 코드가 아니라 값 몇 줄이다.
```

## 4. Breath

```text
익숙함 → 셈 → 잊힘의 부재 → 기다림 → 때 → 내밈 → 닫힘 → 남은 것
```

- **익숙함** — 숲 가장자리. 캐 본 원천이다. 세 번 캐고 고갈. 되돌아올 때까지 기다린다.
- **셈** — 되돌아온 원천을 지목한다. 판: "세 번 캐였다 · 마지막 고갈 N초 전". 세계가 내가 한 일을 세고 있었다.
- **잊힘의 부재** — 뒤척임. 발자국이 묻히고 자국이 처음으로 돌아간다. 다시 지목한다 — 셈은 그대로다.
- **기다림** — 경로 선의 한 마디, 비늘 자리. 지목한다 — 판이 아무것도 내밀지 않는다 (고래가 지난 적이 없다). "언제" 는 없다.
- **때** — 낮. 그늘이 방을 덮고 소란이 오른다. 고래가 지났다.
- **내밈** — 비늘 자리를 지목한다. 판: 「할 수 있는 것 · 채취」. 이것이 기회다 — 때가 있는 것.
- **닫힘** — 캔다. 다시 지목 — "지나간 뒤 캐였다 · 다시 지나야". 언제 다시 지나는지는 말하지 않는다.
- **남은 것** — 내 자리를 본다. "뒤척임 두 번 · 깨어남 한 번 · 고래가 한 번 지났다 (N초 전)". 이 방의 과거가 다음 조건이다.

Core Breath 의 `이해 → 시도` (무엇을 할 수 있는가가 읽힌다) 와 `극복 → 성장 → 새로운 미지` 사이의 **기억** (과거가 조건이 된다) 이다.

## 5. Play Structure

### 5.0 World Cause — 새 원인을 두지 않는다

```text
숲     거목의 계통이 원천을 낳고(Material) · 시계와 철이 방을 바꾸고(Time) · 천공고래가 낮에 방들을 지나 비늘을 떨군다(RoomNeverSame 확정 9)
이 Play  그 사실들에 **셈**을 붙이고(History) · 그 사실들이 이미 걸고 있던 조건에 **한 형**을 주고(Condition) · 비늘이 이미 하던 일에 **이름**을 붙인다(Opportunity)
```

세계 사실은 한 줄도 늘지 않는다 — 늘어나는 것은 세계가 **자기에 대해 아는 것**(history)과 그것을 **적는 방식**(형)이다.

### 5.1 셈 — 방이 기억한다 (G7 · G8 · D4)

```text
존재   RegionState.history — 원천별 { takenTotal · depletedTimes · lastDepletedAt } · turns · awakenings · passages[route]
상태   WORLD 수명 — 스냅샷에 실린다 (STATE_VERSION ↑). 되돌아옴이 taken 을 0 으로 되돌려도 takenTotal 은 남는다.
       올리는 자리는 다섯(채취 완료 · 고갈 · 뒤척임 · 깨어남 · 경로 통과)이지만 올리는 **일은 한 자리**가 한다 (addDisturbance 의 선례)
조건   없음 — 셈은 조건 없이 늘 일어난다
관찰   지목한 원천의 판에 「기억」 줄 — "세 번 캐였다 · 마지막 고갈 N초 전" · 내 자리의 판에 "뒤척임 N번 · 깨어남 N번 · 고래가 N번 지났다 (마지막 N초 전)".
       누가 했는지는 없다 (T2.7 의 규율). 나이("N초 전")는 관찰자가 잰다 (C028 어법)
추론   "세계가 세고 있다. 내가 한 것과 남이 한 것을 가르지 않는다"
반응   없음
```

**수명 표**가 함께 선다 — 지금 있는 State 필드마다 지우는 손 하나(Foundation §4.4). 이 Play 의 State 가 그 표의 첫 PERSISTENT 항(history)이다.

### 5.2 잊힘의 부재 — 뒤척임은 자국을 묻고 기억은 못 묻는다 (G7 · Human 질문 4)

```text
존재   onTurn.burySigns(C016) — 자국 · 발자국 · 옮겨 선 마디를 처음으로. history 는 손대지 않는다 · turns += 1
관찰   뒤척임 뒤 같은 원천을 지목 — 자국은 없고 「기억」 줄은 그대로. 내 자리의 판에 뒤척임 횟수가 하나 올랐다
추론   "묻히는 것과 남는 것이 다르다 — 자국은 TEMPORARY, 셈은 PERSISTENT"
```

### 5.3 조건의 한 형 — 넷이 하나로 읽힌다 (G5 · 빈칸 2)

```text
존재   Condition 형(Foundation §4.1) + 평가기(engine — target 은 경로 문자열 · 직전 값 비교는 호출자가 준다 · 게임 명사 0)
상태   없음 — 조건은 State 가 아니다. 유도된다
조건   CONNECTOR_ACTIVATIONS(미로 패턴) · phases.connectorActivation(철) · occurrence.seasons/dayPhases(원천의 때) · Lock.requires 의 time/state 항
       (C029 가 섰으면 — 아니면 자리) 이 이 형으로 **읽힌다**. 옮기는가 어댑터인가는 spec (Access 빈칸 1 과 한 번에)
관찰   화면에는 아무것도 달라지지 않는다 — 열리던 문은 그대로 열리고 닫히던 문은 그대로 닫힌다. 검사 ㊹ 가 넷을 한 번에 보고,
       규칙 코드의 이름 수는 여전히 0 이다 (R13 실측의 재현)
추론   —
반응   같은 형의 첫 새 조건 하나 — 5.4
```

### 5.4 기다림 — History 를 읽는 첫 조건 (G8 · TODO §2 Time 의 미결 하나)

```text
존재   비늘 자리(FALLEN_SCALE · 숲 가장자리 · WORLD_EVENT)의 availability 에 { target: history passages[SKY_WHALE_ROUTE] · EXISTS } 가 든다
상태   지금 세계는 서는 순간이 시간표 안이라 첫 tick 부터 고래가 지난다 (TODO §2 Time) — 그래서 "지난 적 없는 방" 을 보려면 시간표 한 줄 또는
       HKT_PRESENCE 로 첫 지나감을 뒤로 민다 (검증용 손잡이 · 규칙은 그대로)
조건   지난 적이 없다 → 자리가 아무것도 내밀지 않는다 (discovery HIDDEN) · 지났다 → 5.5
관찰   지목해도 판에 「할 수 있는 것」이 없다. "아직 그때가 아니다" 도 없다 — 그것은 지난 뒤 캐인 자리의 말이다(5.6)
추론   "여기는 무언가의 자리인데 아직 아무 일도 없었다"
```

TODO §2 Time 의 미결 — *Observable ⑤("지나가기 전에는 그 자리에 없다")와 SPEC-006 경계 ①("지목하면 아직 그때가 아니다") 중 어느 쪽인가* — 이 조건이
둘을 **다른 과거**로 가른다: 지난 적 없음 = ⑤ · 지난 뒤 캐임 = ① . 둘 다 참이 된다 (Human 질문 5).

### 5.5 때 · 내밈 — 기회는 데이터다 (G3 · G4 · D3)

```text
존재   Opportunity 하나 — id SCALE_AFTER_PASSAGE(가칭) · region FOREST_EDGE · availability { all: [ history passages[SKY_WHALE_ROUTE] EXISTS ·
       { target: source FALLEN_SCALE · state == available } ] } · discovery TRACE(그늘 · 경로 선의 마디) · target source FALLEN_SCALE ·
       possibleActions [observe · gather] · progress { counter · history sources[FALLEN_SCALE].takenTotal } · outcomes { world: [CHANGE_STATE source → depleted ·
       ADD history.takenTotal] · yield: [Material WHALE_SCALE] }
상태   기회는 State 가 아니다 — 데이터다. 열렸는가(availability)는 매 tick 유도된다. **판정은 바뀌지 않는다** — 채취의 available/reason 은 지금 규칙 그대로이고,
       기회는 그 판정에 이름 · 발견 방식 · 남는 것을 붙인다
조건   SINCE 가 있다 — availability 의 첫 항이 "지난 뒤로" 다. 그래서 이것은 **Event** 다 (G4). 닫는 창은 두지 않는다(Human 질문 6) — 캐면 닫힌다
관찰   고래가 지난 뒤 비늘 자리를 지목 → 판: 「할 수 있는 것 · 채취」 (C027 의 줄 그대로 — 출처가 기회 데이터로 바뀐다). "언제까지" 는 없다
추론   "때가 있는 것이다. 지금이다"
반응   캔다
```

### 5.6 닫힘 — 다시 지나야 한다 (S7 · RoomNeverSame 확정 9)

```text
존재   캔 뒤 원천 phase depleted · takenTotal 1 · availability 거짓 (state != available)
관찰   지목 → 판: "지나간 뒤 캐였다 · 다시 지나야 한다" (사유 코드 — 되돌리는 것이 시간이 아니라 다시 지나가는 것이라는 확정 그대로) · 「기억」 줄 "한 번 캐였다"
추론   "닫혔다. 다시 열리는 것은 내가 아니라 고래다"
```

### 5.7 남은 것 — 세계 한 장 (㊸~㊼ · 기회 표)

```text
존재   world:check ㊸~㊼ · world:observe --report 의 기회 표(방 × 기회 — discovery · Event 여부 · target · yield) 와 수명 표 · T2 열셋째 답 · T4 결정 나무(§14)
관찰   ㊸ ㊹ ㊺ 통과 · ㊻ 기회가 하나도 없는 방 — 백왕령 · 미로 · 협곡 둘 … (원천마다 채집 기회 기본형을 T3 이 낼 때까지는 비늘 하나뿐이다 —
       그것이 결손이 아니라 "기회는 데이터" 의 증명이다: 기회를 더하는 것이 값 몇 줄임을 다음 방이 보인다) · ㊼ 지우는 손 없는 값 0
```

## 6. Required Capability

```text
Existing   Region State(C008~C017) · 스냅샷(STATE_VERSION) · 원천 phase · taken · 되돌아옴(C012 · C013) · 뒤척임 onTurn(C016) · 소란 phase(C017) ·
           PresenceRoute · leavesBehind · FALLEN_SCALE(C018) · 판 · 지목 · 대상 프레임 · 기록(C026~C028) · InteractionView available/reason ·
           world:check · world:observe --report · 검증용 손잡이 HKT_PRESENCE · HKT_CLOCK · HKT_SOURCE_PHASE
Required — 세계 (content/world · content/regions · protocol)
  W53  RegionState.history — 항목 다섯(D4) · WORLD 수명 · STATE_VERSION ↑ · 되살려도 남는다
  W54  history 를 올리는 자리 하나 — 채취 완료 · 고갈 · 뒤척임 · 깨어남 · 경로 통과 다섯이 부른다. 뒤척임은 history 를 묻지 않는다
  W55  Condition 데이터 형(Foundation §4.1) — 조건 자리 넷을 이 형으로 읽는다(옮김/어댑터는 spec · 빈칸 2). 규칙 코드의 이름 0 유지
  W56  History 를 읽는 첫 조건 — 비늘 자리의 availability 에 passages EXISTS
  W57  Opportunity 데이터 형(Foundation §4.5) · RegionSpec.opportunities · 첫 기회 하나(5.5 · D3) — 판정은 그대로, 이름 · 발견 · 남는 것만 붙는다
  W58  투영 — 지목한 대상의 history 요약(계수 · 마지막 시각) · interactions 에 그 행동이 속한 기회의 id 와 discovery. "언제 다시" 는 싣지 않는다
Required — 표현 (content/view)
  V26  판의 「기억」 줄 — 원천(캐인 횟수 · 마지막 고갈 나이) · 내 자리(뒤척임 · 깨어남 · 지나감). 문구는 code-text. 세계 위 글자 0 유지
  V27  「할 수 있는 것」 줄의 출처가 기회 데이터가 된다 — 줄 형식은 C027 그대로 · 닫힌 기회의 사유 코드 문구(passed-and-taken)
Required — 기구 (ENGINE 레인)
  E22  Condition 평가기 — target 경로 · query · operator · qualifier(시간 · 변화). 게임 명사 0. 직전 값은 호출자가 준다(유도 — 저장하지 않는다)
  E23  검사 ㊸~㊼ — 참조 셋(㊸ ㊹ ㊺) + 요약 둘(㊻ ㊼). world:check 에 붙는다. 계약 목록(op 표 · Interaction role)은 컨텐츠가 등록한다
  E24  기회 표 · 수명 표 — world:observe --report
  E25  T2 열셋째 답 · T4 결정 나무(§14 일곱 질문) · T6 ㊻ — content/authoring 의 계약 목록에 기회 계약이 든다
Required — 데이터 (content/regions)
  D1   FOREST_EDGE.opportunities — 비늘 기회 하나 · 수명 표 한 장(spec State 절 — 문서)
```

### 불변 조건 — 코드 변경 없이 폴리싱

```text
기회를 더한다(다른 원천 · 다른 방 · 다른 Event) · 조건을 바꾼다(SINCE 를 WITHIN 으로 · 임계를 History 로) · history 항목을 더한다(Life 의 births)
    → content/regions 의 데이터와 history 형의 한 줄. 코드 0
Player Knowledge 조건 · killed · crafted · 확률
    → 그 층의 Cycle — 같은 형에 한 줄씩 는다. 이것은 폴리싱이 아니라 새 층이다
```

## 7. Cycle Breakdown

번호는 C034 부터다 — C029~C031 은 [RoomAsksForPossibilities](RoomAsksForPossibilities.md), C032~C033 은 [TrailBehindClueAhead](TrailBehindClueAhead.md)(초안)의 것이다.

```text
[ ] C034 — 방이 기억한다: RegionState.history(W53 · W54 · D4) + 수명 표(Foundation §4.4 — spec State 절) + 판의 「기억」 줄(W58 절반 · V26) +
           뒤척임이 자국은 묻고 기억은 안 묻는다(5.2) + 저장하고 되살려도 남는다 + 검사 ㊸ ㊼. 규칙 · 판정은 한 줄도 바뀌지 않는다
[ ] C035 — 조건은 하나의 형이다: Condition 형 + 평가기(E22 · W55) + 조건 자리 넷의 한 형 읽기(옮김/어댑터는 spec) + History 를 읽는 첫 조건(W56 — 고래가
           지난 적 있는 방에만 비늘 자리가 내민다 · 5.4) + 검사 ㊹ + 규칙 코드의 이름 0 실측. 화면은 달라지지 않는다 — 문은 그대로 열리고 닫힌다
[ ] C036 — 방이 기회를 내민다: Opportunity 형(W57) + 첫 기회(비늘 · Event · D1 · 5.5 · 5.6) + 「할 수 있는 것」 줄의 출처(W58 · V27) + Mutation op 표 대조(㊺) +
           검사 ㊻ + 기회 표 · 수명 표(E24) + T2 열셋째 답 · T4 결정 나무 · T6 ㊻(E25) + Play Goal 실주행(숲 가장자리 — 캐고 · 되돌아오고 · 뒤척임 · 고래 · 캐고 · 판)
```

각 항목은 작다 · 플레이 가능 · World 변화 분명 · 관찰 가능 · 검증 가능 · 재사용 가능.
순서는 의존성(기억이 서야 그것을 읽는 조건이 있고 · 조건의 형이 서야 기회의 availability 가 그 형이다)이자 Breath 의 순서(셈 → 기다림 → 내밈)다.
C034 는 Life · Access · Trail 과 병행할 수 있다 — 세계 State 에 history 하나가 늘 뿐이다(STATE_VERSION 은 번호 순으로 합친다).

## Human 질문

이 문서의 플레이 층은 AI 의 제안이고, 아래는 게임 의미의 결정이라 Human 이 정한다.

```text
1. 2층을 다시 여는 것 — STATE §1 은 "design 은 여기까지 · 더 쌓지 않는다" 였다. 이 주입을 ②-부속 다섯째(새 축 없음)로 받는 것을 승인하는가.
   제안: 받는다 — 축이 아니라 여덟 자리의 이름과 셋(조건의 형 · 기억 · 기회)이고, 그 셋 없이는 "새 플레이가 기반을 늘리지 않는다"(§14)를 검사할 수 없다

2. 놓는 미지 — 제안: 없음 (M4 천공고래의 길을 깊게 한다 — 비늘이 기회가 된다). 이름 있는 새 사실(지역 · 현상)을 주면 그것으로 바꾼다

3. History 항목 — 제안 D4 (원천별 캔 횟수 누계 · 고갈 횟수 · 마지막 고갈 시각 · 뒤척임 횟수 · 깨어남 횟수와 마지막 시각 · 경로별 지나간 횟수와 마지막 시각).
   더하거나 뺄 것이 있는가. 상한은 두지 않는다(정수)

4. 뒤척임이 History 를 묻는가 — 제안: 묻지 않는다. 그래야 "과거의 플레이가 미래의 조건이 된다"(원문 §2.8)가 성립한다.
   묻는다면 History 는 TEMPORARY 가 되고 이 Play 의 5.2 가 사라진다

5. TODO §2 Time 의 미결(Observable ⑤ vs SPEC-006 경계 ①) — 제안: 둘 다 참으로 가른다 — 지난 적 없음 = 자리가 내밀지 않는다 · 지난 뒤 캐임 = "다시 지나야".
   받으면 그 줄을 TODO 에서 지운다

6. 비늘 기회의 시간 창 — 제안: 닫는 창 없음(캐면 닫히고 · 다시 지나면 열린다 — 확정 9 그대로). "지나간 뒤 N초 안에만" 을 원하면 값 하나(WITHIN)

7. 확률 — 제안: 두지 않는다(L1 §3 · 빈칸 1). 형의 chance 자리는 5층 이후가 난수 State 와 함께 채운다

8. 조건 자리 넷을 Condition 형으로 옮기는가 · 읽기만 하는가 — 제안: 첫 Cycle 의 spec 에 위임한다 (Access 빈칸 1 과 한 번에 정한다)

9. 원문 §2.3 의 Property 이름들(temperature · corruption · ownerFaction …)을 이 세계의 어휘로 받지 않고 이름공간의 형식만 받는다(§2 ③) — 승인하는가.
   받는다면 어느 것을 · 어느 Play 가 쓰는지와 함께

10. 3층 · 뒤 Play 로 두는 것 — 발견 상태 다섯(3층) · Region 자체 성장의 첫 사례(Life 뒤 · 빈칸 3) · Object 류(컨텐츠 행). 이 경계를 승인하는가
```
