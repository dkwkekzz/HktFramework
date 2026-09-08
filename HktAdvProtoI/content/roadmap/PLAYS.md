# PLAYS — Play 작성 로드맵 · 기획 작업 관리

살아 있는 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 진입점은 [../../STATE.md](../../STATE.md) §1 이고, 이 문서는 그 표의 "기획" 줄이 가리키는 집이다.

```text
목적    기획(advprotoi-design)이 할 일의 **단일 출처**. "원본 기획이 다 Play 로 덮였는가 · 무엇이 남았는가 · 다음에 쓸 Play 는 무엇인가" 에
        이 문서 하나가 답한다.
기능    §1 원본 기획 → Play 덮임 (작업에 올린 원본 전부 · 덮은 Play · 덮인 절 · 남은 절과 받는 자리)
        §2 있는 Play 의 상태 · 기획 할 일 · 풀리는 조건        §3 쓸 Play — 순서 · 증명 방향 · 받는 것 · 전제 · 예정 Cycle
        §4 기획 작업 큐 — 지금부터 순서대로 (Human 차례는 굵게)
소유    Play 의 상태는 여기만 (STATE · play/README 는 링크). 층 · 행의 상태는 README.md, Cycle 이 남긴 것은 TODO.md.
        TODO §3(뒤 층 · 뒤 Play 로)의 줄은 기획이 받는 즉시 §1 의 "남은 것" 으로 옮기고 TODO 에서 지운다.
```

```text
읽는 법
  원본          작업에 올린 기획 — 로드맵 결과물(L<N> · M<N>) · 지목된 design/ 문서 · 실주행이 돌려보낸 GAP. 이것만이 Play 의 재료다
  덮는 Play     그 원본을 재료로 쓴 Play 와 그 상태
  덮인 것       그 Play 들이 증명했거나 증명 중인 원본의 절
  남은 것       아직 어느 Play 도 받지 않은 원본의 절 — **받는 자리**(쓸 Play · 층 · 컨텐츠 행 · 도구 · 두지 않음)를 반드시 적는다.
               "남은 것" 이 비면 그 원본은 다 덮인 것이다
  Play 상태     닫힘(실주행 판정 반영) · 판정 대기(Cycle 다 닫힘 · Human 실주행) · 진행(Cycle 도는 중) · 승인 대기(초안 섬) ·
               쓸 수 있음(전제가 다 섰다 · 아직 안 씀) · 기다림(전제가 아직) · 없음(Play 없이 닫힘)
갱신 규칙
  새 주입 · Play 승인 · Cycle 이 main 에 합쳐짐 · 실주행 판정 반영 — 이 넷이 일어날 때 advprotoi-design 이 고친다.
  원본이 늘면 §1 에 행이 늘고, Play 가 무언가를 받으면 그 줄이 "남은 것" 에서 "덮인 것" 으로 옮겨진다
```

## 1. 원본 기획 → Play 덮임

| 원본 | 층 | 덮는 Play (상태) | 덮인 것 | 남은 것 → 받는 자리 |
|---|---|---|---|---|
| [L0-Game.md](L0-Game.md) 게임 방향 (원문 둘) | 0 | 없음 — 판단 기준 (모든 Play 의 §5 · 열 질문 ⑦~⑩) | 전 Play 가 §4 네 질문을 통과한다. 둘째 원문(요정 컬렉션 · 무대의 한 명)은 L7 행이 받는다 | 미증명 넷 — ① 재방문(Time 이 필요조건 · 컨텐츠 행이 채운다) ② 다중 플레이어의 이유(Time 소란 · 발자국이 필요조건 — **충분조건은 뒤 층: 분업 · 거래 · 정보 공유 — 아직 어느 층에도 없다**) ③ 성장 선택의 애착과 고민(→ OneStandsOnStage · 7층 Play) ④ 발견 뒤에도 움직이는가(Time · Life 가 세운다 — 판정은 실주행) |
| [L1-World-Grammar.md](L1-World-Grammar.md) 세계의 문법 | 1 | 없음 — 코드가 이미 이 문법 위 | Entity · State · Subject · Law · 시간 · 저장/유도 · 계산/확률 · 순서 · 성장 축이 닿는 자리 | 없음 — 성장 축의 넷째 자리(요정 Core)는 L7 §3 이 "문법 변경 없음" 으로 정리했다 |
| [L2-World-Tool.md](L2-World-Tool.md) 도구 절반 1단계 (WE · Plan) | 2 | RegionGraphRooms(판정 끝) · RoomBecomesLand(닫힘) | Description · Graph · 관찰 · 검사 ⑤~⑨ · Height Field · Stamp · Curve · Surface · traversable · 컴파일 캐시 · Build→Observe 루프 | Tree/Rock Kit · scatter 밀도 · 자산 카탈로그(WE §17~§26) → **Land 뒤 폴리싱(데이터) — Play 없음**. Streaming → **큰 Region 이 실제로 올 때 ENGINE 레인(chunk 적재) — Play 없음** |
| [L2-World-Tool-Scale.md](L2-World-Tool-Scale.md) 도구 2단계 — Region 작성기 | 2 | ENGINE 레인 B T1~T6 (섰다 — Cycle 아님) | 검사기 · brief 형 · 뼈대 생성기(절반) · 등급 판정기 · 초안기 · 판정 표면 | **HundredRooms Play (§3 순서 1 — 쓸 수 있음)** · T3 의 ecology 산출 → C022 · 갈래별 땅 묶음의 분기(§7 "땅이 같다") → **T6 뒤 templates 손질 — Play 없음** |
| [L2-World-Concept.md](L2-World-Concept.md) 세계관 컨셉 ① | 2 | RegionGraphRooms(W1 · W11) · RuleBoundRoom(W5 · W8 · W9) · RoomBecomesLand(W2 · §16) · RoomBearsMaterial(W4 · §4) — 전부 닫힘/판정 끝 | 깊이 · 끝없음 · 지역은 하나의 현상 · 단서 · 플레이어 없이 돈다 · 안전은 조건 · 비주얼 방향 · 동근원 · 숲의 사슬 | W3 위험 일곱 갈래가 **몸에 닿는 것** → OneStandsOnStage(추위)가 첫 갈래 · 나머지 갈래(지형 · 물질 · 생물 · 생태 …)는 **3층 둘째 Play · 5층**. W7 지식이 전투력 · W10 강함만으로 안 됨 → **3층 둘째 · 5층**. §8 요정/Class → **L7 행**. W6 압도적 존재와의 접촉 → **컨텐츠 행 + 5층**. §14 사회적 분업 → **뒤 층(자리 없음 — L0 ② 와 같은 구멍)**. §16 비주얼 세부 → **content/view 결정 Layer(도구 아님)** |
| [L2-World-Region.md](L2-World-Region.md) 세계 content 구성 ② | 2 | RegionGraphRooms(R1 · R3 · R5 · R6 · R9 · R12) · RuleBoundRoom(R4 · R7 · R8 · §10 · §16 · §17) · RoomBecomesLand(R11 · §13) · RoomBearsMaterial(R10 · §15 자원) | Graph · WorldPosition · 중첩 · Connector · 진입/이탈 · 공간 분리 · State 공유 · Rule · Spec 양식 · 규칙 가독성 · Terrain 은 결과 · 하나의 Cause | §8 Discovery State(개인 지식 — "이 방이 무엇인지 안다") · §6 Hard Entry 의 knowledge activation → **3층 둘째 Play(knowledge Lock 판정)**. §12 Growth Outcome 의 capability → **4층 · 7층 Play**. §6 Soft Requirement(몸의 값) → **OneStandsOnStage(온기) · 3층 둘째**. §5.1 이름 표의 나머지(거꾸로 된 정원 · 걷는 숲 · …) → **컨텐츠 행 — Human 이 하나씩** |
| [L2-World-Material.md](L2-World-Material.md) 재료 생태와 공급 계약 | 2 | RoomBearsMaterial(닫힘 — S1~S12) · RoomOfAnotherKind(판정 대기 — 둘째 적용) · RoomBearsLife(대기 — RESIDUE 의 주인) | 원천 · 흔적 · 구배 · 생애 · 공급 · 채취 결과 · 흐름 · 도구 보고 ⑩~㉒ | S10 이 미룬 **쓰임**(Recipe · 조합 · Item 효과 · 수치 · Class 요구) → **4층 Play(§3 순서 3) · 7층 Play**. CREATURE Carrier 의 살아 있는 쪽 · 채취가 생물 행동에 미치는 것 · §4 "주변 생물의 행동" → **3층 둘째 Play**. §2.2 플레이어 지식 상태 → **3층 둘째**. TODO §3 "World Event Opportunity · 둘째 흐름 · 유한 원천" → **다음 Region 의 컨텐츠 행** |
| [L2-World-Time.md](L2-World-Time.md) 세계의 시간과 위상 | 2 | RoomNeverSame(닫힘 — T1~T8) · RoomOfAnotherKind(둘째 적용 — 철이 안전 조건에 닿는다) | 시계 · 네 철 · 위상 덧씌움 · 소란 · 발자국 · 압도적 존재의 경로 · 검사 ㉓~㉖ | §5 표: 밤과 철이 **몸을 깎는 것**(추위 · 피로 · 긴 밤을 버티기) → **OneStandsOnStage(추위만) · 3층 둘째(피로 · 밤)**. 생물의 철 따른 이동 · 번식 · 동면 → **3층 둘째 · Life 실주행**. 압도적 존재와의 접촉이 몸에 하는 일 → **3층 둘째 · 5층**. 지식이 철의 규칙을 연다 → **3층 둘째**. 날씨 → **두지 않는다(컨텐츠 행의 현상으로)**. 걷는 숲의 나무 이동 → **그 Region 의 컨텐츠 행** |
| [L2-World-Life.md](L2-World-Life.md) 생명의 성립과 탄생 | 2 | RoomBearsLife(진행 대기 — F1~F15 · 주입된 그대로) | 생명의 정의 · 네 탄생 방식 · 소비와 흔적 · 개체군 값과 관계 · 멸종 없음 · 회복 · 검사 ㉗~㉝ (전부 C022~C025 가 세운다) | F10 태어난 개체의 몸 · 감각 · 지식 · 행동 · 죽음 · 성장 단계 · 능력치 → **OneStandsOnStage(M8 이 걷고 원한다 — 첫 개체) · 3층 둘째(나머지)**. 성별 · 번식 · 유전과 변이 → **3층 이후(자리 없음 — 주입 필요)**. 플레이어가 탄생에 개입하는 Action(Exploit) → **3층 둘째 이후**. F11 요정의 원리 결속 → **7층 Play(D1 요정 획득)**. F12 최초의 생명 → **확정하지 않는다**. §3.5 작성기가 생명을 안다 → **T3 ecology(C022 뒤)** |
| [L2-World-Access.md](L2-World-Access.md) 세계의 요구와 가능성 | 2 | RoomAsksForPossibilities(진행 대기 — K1~K15 · C029~C031) · **OneStandsOnStage(승인 대기 — property Lock 의 첫 판정 · Actor 가능성)** | Lock 넷 · 성질 어휘 · Seed 의 성질 · 여러 종류의 답 · 흔적 · 검사 ㉞~㊷ · time/state 판정 · (3층) heat:hides 를 몸이 답한다 | knowledge Lock 의 판정 · 관찰자가 요구를 어디까지 이해하는가(§7 네 단계) → **3층 둘째 Play**. 가능성을 지니는 것(소지 · 장비 · 섭취 · 동행) · 물건이 성질을 물려받음 · 수치 · 조합과 상쇄 · SUPPORTS/OPPOSES 효과 → **4층 Play**. 클래스 · 요정 자체가 가능성이 되는 성장 → **7층 Play**. "세 계통의 답이 실제 플레이에서 성립" → **4층 Play 의 완료 확인(몸 · 소지 · 환경)**. 플레이어 사이의 가능성 공유 → **뒤 층(자리 없음)**. 빈칸 5(L0 §3 에 "가능성 탐색" 마디) → **Human — L0** |
| [M5-FrostCanyon.md](M5-FrostCanyon.md) 빙결 협곡 (컨텐츠) | M5 | RoomOfAnotherKind(판정 대기 — Q39~Q44) | 협곡 방 둘 · 위험 갈래 셋 · 빙정석 계통 · 문의 요구 표시 · 철이 고개를 넘는다 | 추위가 몸에 하는 일 → **OneStandsOnStage(온기)**. 결정면 접촉이 몸에 하는 일(crystallizing — W35 "몸의 변화 없음") → **3층 둘째 Play**. 체온을 쫓는 포식자 → **OneStandsOnStage(M8)**. 판정 "아니오" → **GAP 회수 기획** |
| [design/Plan-Place-Observation-Surface.md](../../design/Plan-Place-Observation-Surface.md) 자리를 관찰하는 표면 | 2 (관찰) | RoomAnswersWhenAsked(닫힘 — 확정 열하나 · 실주행 반영) | 지목 · 대상 프레임 · 기록 · 세계 위 글자 0 · 시점 상하 | 없음 — §5.4 는 뒤집혔고 남은 결손은 TODO §2 Observe 의 결정 줄(판 id 유일성 · 존재 지목 중 내 깊이 읽기 등 — **기획 작업이 아니라 Human 결정**) |
| 실주행 GAP 둘 — RegionGraphRooms Q1 · Q2 (TODO §3) | 2 (회수) | TrailBehindClueAhead(승인 대기 — C032~C033) | 온 길의 기록 · 갈 길의 단서(출구 종류 · 방향 · 추락 자리의 땅) | 없음 — 승인되면 TODO §3 에서 지운다. 절벽 낙하(자리가 아닌 절벽에서 떨어지기)는 Play 밖 → **원하면 별도 주입** |
| [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 요정 성장·조합 모델 (확정 · 3~7층에 배분) | 7 → 3 · 4 · 5 · 6 · 7 | **OneStandsOnStage(승인 대기)** — 3층 몫 | §9 편성 · §10 무대의 한 명 · §11 Entry/Leave/Off-field 의 **자리** · §20 탐험에서도 교체 · §4~§5 Core 가 몸의 State 로 · 확정 4 · 5 · 10 · 11 | **3층 몫의 나머지 없음.** 아래 네 줄이 나머지 층의 몫 |
| ↳ L7 4층 몫 | 4 | 없음 | — | §8 보석 = 성장 재료(Material Seed) · §17 Item = 행동을 바꾸는 장치 · §24 스탯 부착물 금지 · §16 "아이템 → 폭발 도구" · 확정 6(보석 여덟 후보) · 확정 10 · D2 · D4 → **4층 Play(§3 순서 3)** |
| ↳ L7 5층 몫 | 5 | 없음 | — | §13 정해진 Phase 없음 · World State 어휘 열하나(확정 8) · §14 창발 전투 · §16 여러 답 · §23 Monster 질문 · D3(지식 슬롯 모델) → **5층 Play(§3 순서 4)** |
| ↳ L7 6층 몫 | 6 | 없음 | — | §6 Class = Core 를 쓰는 방법 · §11 Active/Entry/Leave/Off-field 의 **내용** · §5 "모든 Class 는 Core 의 일부를 쓴다" · §19 탐험 조합 · D5(Off-field 시간 규모) → **6층 Play(§3 순서 5)** |
| ↳ L7 7층 몫 | 7 | 없음 | — | §1~§3 컬렉션 넷 · §7 Class Change(Fairy + Gem + 조건 · 확정 7) · §8 순환 · §12 고정 역할 없음 · §18 Knowledge = 관계의 해금(확정 9) · §21 Build · §22 단계 · §25~§27 · 확정 2(계열 여섯 — 일곱은 보류) · D1(요정 획득) → **7층 Play(§3 순서 6)**. 보류된 계열 일곱 → **컨텐츠 행(요정) — Human 이 하나씩** |

**어느 층에도 자리가 없는 것** (원본이 "뒤 층" 이라고만 한 것 — 새 주입이 있어야 한다): 다중 플레이어의 충분조건(분업 · 거래 · 정보 공유 · 가능성 공유 —
L0 ② · Concept §14 · Access) · 생물의 성별 · 번식 · 유전과 변이(Life) · 절벽 낙하(Trail 밖). 로드맵 8층은 화면이라 이것들의 층이 아니다 —
**9층 이상이 필요한지, 3~7층 어딘가에 넣을지는 Human 결정** (§4 큐 10).

## 2. 있는 Play — 상태

| 층 / 행 | Play | Cycle | 상태 | 기획 할 일 | 풀리는 조건 |
|---|---|---|---|---|---|
| L2 · M1 | [RegionGraphRooms](play/RegionGraphRooms.md) | C001~C004 | **판정 끝 — GAP 둘** | GAP 둘은 Trail 초안이 받았다 | Trail 승인 → 이 행이 닫힌다 |
| L2 | [RoomBecomesLand](play/RoomBecomesLand.md) | C005~C007 | 닫힘 (판정 반영) | — | — |
| L2 · M2 | [RuleBoundRoom](play/RuleBoundRoom.md) | C008~C010 | 닫힘 (판정 반영) | — | — |
| L2 · M3 | [RoomBearsMaterial](play/RoomBearsMaterial.md) | C011~C014 | 닫힘 (판정 반영) | — | — |
| L2 · M4 | [RoomNeverSame](play/RoomNeverSame.md) | C015~C018 | 닫힘 (판정 반영) | — | — |
| M5 | [RoomOfAnotherKind](play/RoomOfAnotherKind.md) | C019~C021 | **판정 대기** (TODO §1 Q39~Q44) | "아니오" 가 돌아오면 DESIGN GAP 회수 — 기존 Play 에 Cycle 을 더하거나 관찰 가능성 Play 하나로 묶는다 | Human 실주행 답 |
| L2 (관찰) | [RoomAnswersWhenAsked](play/RoomAnswersWhenAsked.md) | C026~C028 | 닫힘 (판정 반영) | — | — |
| L2 (회수) | [TrailBehindClueAhead](play/TrailBehindClueAhead.md) | C032~C033 | **승인 대기** (Human 질문 여섯) | 승인 반영 — play/README 표 · STATE 레인(Observe 재개) · TODO §3 GAP 둘 삭제 · RegionGraphRooms 행 닫기 | Human 답 + 승인 |
| L2 · M6 | [RoomBearsLife](play/RoomBearsLife.md) | C022~C025 | 진행 대기 (주입된 그대로 — 별도 승인 없음) | 실주행 뒤 판정 · GAP 회수 | C025 닫힘 → 실주행 |
| L2 · M7 | [RoomAsksForPossibilities](play/RoomAsksForPossibilities.md) | C029~C031 | 진행 대기 | 실주행 뒤 판정 · GAP 회수 | C031 닫힘 → 실주행 |
| **L3** · M8 | [OneStandsOnStage](play/OneStandsOnStage.md) | C034~C037 | **승인 대기** ("C034 진행" = 승인 · 제안값 여섯) | 승인 반영 — 제안값을 확정 후보로 · Human 이 준 답이 있으면 그것으로 | Human 한 마디 |

2층은 Play 열(2층 여덟 + M5 + 회수 초안)이 전부 실주행 판정으로 닫혀야 층이 닫힌다 — 남은 것은 M5 판정 · Life · Access 실주행 · Trail 이다.

## 3. 쓸 Play — 순서대로

번호는 예정이다 — 실제 번호는 승인 때 "전 이름공간 최대 + 1" 로 정한다 (C038 부터 · 앞 Play 가 늘면 밀린다). "받는 것" 열이 §1 의 "남은 것" 과 짝이다.

| 순서 | 층 / 행 | Play (가칭) | 증명 (방향) | 받는 것 (§1 의 남은 것) | 전제 — 무엇이 서야 쓰는가 | 그때 필요한 주입 · 위임 · 미지 | Cycle (예정) | 상태 |
|---|---|---|---|---|---|---|---|---|
| 1 | L2 · 도구 | **HundredRooms** ([Tool-Scale](L2-World-Tool-Scale.md) §5) | 미지 백 줄 → 방 백 개가 검사를 통과하고 관찰자가 열 곳을 걸어 흔적 → 원천 → 철 → 탄생지를 본다. 코드 diff 0 | Tool-Scale 의 HundredRooms | T1~T6(섰다) · T3 ecology 는 C022 · 갈래 분기는 Frost 뒤(섰다) | 미지 백 줄의 **이름**(Human — 또는 초안기 후보를 Human 이 고른다) | C025 뒤 · 셋 안팎 | **쓸 수 있음** |
| 2 | **L3** 둘째 | (가칭) BodyKnowsAndWants | 몸이 무엇을 가지는가(온기 밖 — 피로 · 밤 · 결정면 접촉) · 생물이 무엇을 알고 어떻게 고르는가(목적 · 지식 · 선호가 세계 State) · 관찰자가 요구를 어디까지 이해하는가 · knowledge Lock 판정 · Discovery State | Concept W3 나머지 · W7 · W10 · Region §8 · §6 · Material CREATURE · Time §5 몸/생물/지식 · Life F10 나머지 · Access knowledge · M5 결정면 | OneStandsOnStage 실주행 판정 | 3층 주입 — 몸의 값 · 생물 행동 재료(Subject-Decision · Autonomous-Behavior · Creature-Behavior) 지목 + 미지: 무엇을 원하는지 아는 생물 하나 더(이름) | C038~ (넷 안팎) | 기다림 |
| 3 | **L4** | (가칭) CarryAndItOpens — 캐서 지니면 갈 수 있는 곳이 늘어난다 | 보석 하나를 캐서 **지니고**(요정별 소지 · D1 기구), 물건 하나가 같은 행동을 다른 행동으로 바꾼다. 소지가 문에 답하는 둘째 종류의 답 · 열 결정(C030)을 들면 문이 열린다 → **세 계통의 답(몸 · 소지 · 환경)이 한 문에 실제로 선다** | L7 4층 몫 · Material S10(쓰임) · Access 4층 몫 · Region §12 capability | C030 · OneStandsOnStage C036(Lock 판정 기구) | 4층 주입 — 가공 사슬 · 조합과 쓰임(Item-* · Inventory-D1 · Resource-Catalog) · D2 · D4 + 미지: 어디서 나는지 정해진 자원 하나(보석 하나 — 이름 · Region) | C042~ (넷 안팎) | 기다림 — **Human 결정으로 앞당길 수 있다** |
| 4 | **L5** | (가칭) TwoWaysToFell — 처음으로 맞서 이긴다 | 같은 적을 두 가지 상태 순서로 쓰러뜨린다. 대상의 World State(Access 어휘 확장)를 생성 · 소비하는 것이 전투의 문법 · 순서를 지정하지 않는다 · 압도적 존재와의 접촉이 몸에 하는 일 | L7 5층 몫 · Concept W6 · W7 · Time 접촉 | L3 둘 · L4 Play | 5층 주입 — 공격 · 방어 · 피해 종류 · 지목(Combat-* · Targeting) · D3 + 미지: 여러 해법을 허용하는 몬스터 하나(M8 을 깊게 해도 된다) | C046~ | 기다림 |
| 5 | **L6** | (가칭) OneCoreTwoWays — 능력 표현이 세계에 닿는다 | 한 Core 가 두 Class 로 다른 Law 가 되고, Leave 가 남긴 장판이 다음 요정의 능력과 반응한다. Active · Entry · Leave · Off-field 의 **내용** | L7 6층 몫 | L5 Play | 6층 주입 — 스킬 체계 · 실행 형태 · 효과(Skill-*) · D5 + Class 둘의 정식 이름(L7 §6 예시 중) | C050~ | 기다림 |
| 6 | **L7** | (가칭) OneGemChangesTheAnswer — 자원 관계에서 성장이 나온다 | 보석 하나로 Class 가 바뀌어 못 풀던 자리를 **새 방법**으로 푼다 · "원하는 Class → 필요한 Gem → 그 Region" 이 탐험 목표 · Knowledge 하나가 숨겨진 관계를 연다 · 미증명 ③ 직접 증명 | L7 7층 몫 · Life F11 · Access 7층 몫 · Material S10 의 Class 요구 | L6 · L4 Play | 7층 주입 — D1(요정 획득) · Class Change 조건 데이터 · Growth-Balance 검증 대상 + 미지: 보석 하나의 Region 과 원인 · Knowledge 하나 | C054~ | 기다림 — **Human 결정으로 앞당길 수 있다** |
| — | 컨텐츠 행 | (대부분 Play 없음) | 보석 여덟 · 보류 계열 일곱 · 클래스 · 아이템 · 지식 · 지역(L7 §6 · Region §5.1 나머지 · Time 걷는 숲 · Material 둘째 흐름) — 등급 A 면 작성기 · Spec · 검사 · Human 판정 / B 면 Cycle 하나 / C 면 기반 층 | §1 의 "컨텐츠 행" 표기 전부 | Human 이 이름 · 종류 · 세계관 사실을 확정 | 미지 하나씩 | — | Human 이 이름을 줄 때마다 |
| — | 자리 없음 | (주입 필요) | 다중 플레이어의 충분조건 · 성별 · 번식 · 유전 · 절벽 낙하 | §1 끝 "어느 층에도 자리가 없는 것" | Human 결정 (§4 큐 10) | 새 주입 | — | 결정 대기 |

8층(화면)은 Play 가 없다 — 각 Play 의 Required 로 들어온다. 4층과 7층은 앞당겨도 되는 둘이다 — 앞당기면 초안이 Human 질문이 많은 채로 서고,
앞 층의 실주행이 전제를 바꾸면 다시 손본다.

## 4. 기획 작업 큐 — 지금부터 순서대로

한 줄이 advprotoi-design 의 작업 하나다. 위가 먼저다. Human 이 답해야 풀리는 줄은 **굵게**.

```text
1   **OneStandsOnStage 승인** — "C034 진행" (또는 Human 질문 여섯의 답) → 승인 반영                                                   Human
2   **TrailBehindClueAhead 승인** — 질문 여섯 답 → 승인 반영 (play/README 표 · Observe 레인 재개 · TODO §3 GAP 둘 삭제 · Rooms 행 닫기)    Human
3   **RoomOfAnotherKind 실주행 판정** — TODO §1 Q39~Q44 → "아니오" 가 있으면 DESIGN GAP 회수 기획                                    Human → design
4   HundredRooms Play 초안 — 전제가 다 섰다. 미지 백 줄의 이름은 Human 이 주거나 초안기(world:draft --batch)의 후보를 고른다. Cycle 은 C025 뒤   design (Human 이름)
5   **결정 — 4층 · 7층 Play 를 앞당기는가** (§3 순서 3 · 6). 앞당기면 4 → 7 순으로 초안. 아니면 규칙대로 3층 둘째 Play 뒤                      Human
6   Life 실주행 판정(C025 뒤) · Access 실주행 판정(C031 뒤) → GAP 회수                                                                  Human → design
7   3층 둘째 Play (BodyKnowsAndWants) — OneStandsOnStage 판정 뒤 · 3층 나머지 절반 주입과 함께 (§1 의 "3층 둘째" 표기 전부를 받는다)          Human 주입 → design
8   4층 → 5층 → 6층 → 7층 Play — 각 층이 열릴 때 (앞 층 판정 + 그 층 주입 + 위임 D1~D5 회수). 각 Play 는 §1 의 "남은 것" 을 받아 지운다        Human 주입 → design
9   컨텐츠 행 — Human 이 이름을 줄 때마다 등급 판정(A/B/C) → A 는 Spec · B 는 Cycle 하나 · C 는 기반 층 행                                Human 이름 → design/도구
10  **결정 — 자리 없는 것**(다중 플레이어의 충분조건 · 성별 · 번식 · 유전 · 절벽 낙하)을 어느 층에 둘 것인가 · 9층을 세울 것인가                  Human
```

TODO.md §2(Human 이 정할 것 — 값 · 규칙 · 방향)는 기획 작업이 아니라 **결정 목록**이라 여기 옮기지 않는다. §3(뒤 층 · 뒤 Play 로)의 남은 줄은
§1 의 "남은 것" 에 전부 들어 있다 — 그 층 · Play 를 기획할 때(위 7 · 8 · 9)의 입력이고, 받으면 지운다.
