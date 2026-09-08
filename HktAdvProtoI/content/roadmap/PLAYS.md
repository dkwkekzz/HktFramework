# PLAYS — Play 작성 로드맵 · 기획 작업 관리

살아 있는 문서 하나 — **현재 상태만** (CLAUDE.md 원칙 10). 있는 Play 전부와 앞으로 쓸 Play 전부가 한 표에 서고, 기획(advprotoi-design)이
지금 무엇을 할 수 있고 무엇을 기다리는지가 §3 큐에 선다. [README.md](README.md) 가 **주입 순서**(층과 행)를, [play/README.md](play/README.md) 가
**있는 Play 의 증명 내용**을 소유한다면, 이 문서는 **Play 를 쓰는 일 자체의 순서와 상태**를 소유한다. Cycle 의 상태는 여기 두지 않는다 —
그것은 [../../STATE.md](../../STATE.md) §1 · §2 와 각 Play 의 Cycle Breakdown 체크박스다.

```text
읽는 법
  Play 상태     닫힘(실주행 판정 반영) · 판정 대기(Cycle 다 닫힘 · Human 실주행) · 진행(Cycle 도는 중) · 승인 대기(초안 섬) · 쓸 수 있음(전제가 다 섰다 · 아직 안 씀) ·
               기다림(전제가 아직) · 없음(층 자체가 Play 없이 닫힘)
  기획 할 일    그 Play 에 대해 advprotoi-design 이 아직 해야 하는 것 — 없으면 "—"
  풀리는 조건   무엇이 합쳐지거나 답해지면 다음 상태로 가는가
갱신 규칙
  Play 승인 · Cycle 이 main 에 합쳐짐 · 실주행 판정 반영 · 새 주입 — 이 넷이 일어날 때 advprotoi-design 이 이 표를 고친다. 닫힌 행은 §1 에 남되 할 일은 지운다
```

## 1. 있는 Play — 층별

| 층 / 행 | Play | Cycle | 상태 | 기획 할 일 | 풀리는 조건 |
|---|---|---|---|---|---|
| L2 · M1 | [RegionGraphRooms](play/RegionGraphRooms.md) | C001~C004 | **판정 끝 — GAP 둘** | GAP 둘은 Trail 초안이 받았다 (아래) | Trail 승인 → 이 행이 닫힌다 |
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
그 뒤에도 2층에 쓸 Play 가 하나 있다 (HundredRooms · §2).

## 2. 쓸 Play — 순서대로

번호는 예정이다 — 실제 번호는 승인 때 "전 이름공간 최대 + 1" 로 정한다 (C038 부터 · 앞 Play 가 늘면 밀린다).

| 순서 | 층 / 행 | Play (가칭) | 증명 (방향) | 전제 — 무엇이 서야 쓰는가 | 그때 함께 필요한 주입 · 위임 | Cycle (예정) | 상태 |
|---|---|---|---|---|---|---|---|
| 1 | L2 · 도구 | **HundredRooms** ([L2-World-Tool-Scale](L2-World-Tool-Scale.md) §5) | 미지 백 줄 → 방 백 개가 검사를 통과하고 관찰자가 열 곳을 걸어 흔적 → 원천 → 철 → 탄생지를 본다. 코드 diff 0 | T1~T6 (섰다) · T3 의 ecology 는 C022 · 템플릿 갈래 분기는 Frost 뒤(섰다) | 미지 백 줄의 **이름** (Human — 세계관 사실) | C025 뒤 · 셋 안팎 | **쓸 수 있음** (Cycle 은 C025 뒤) |
| 2 | **L3** 나머지 절반 | (가칭) BodyKnowsAndWants | 몸이 무엇을 가지는가(온기 밖의 값 · 감각) · 생물이 무엇을 알고 어떻게 고르는가(Subject-Decision 의 목적 · 지식 · 선호가 세계 State 로) · 관찰자가 요구를 어디까지 이해하는가(Access K10 의 3층 몫 · knowledge Lock 판정) | OneStandsOnStage 실주행 판정 | 3층 주입 — 몸의 값 · 생물 행동 재료(Design-Subject-Decision · Autonomous-Behavior · Creature-Behavior) 지목 + 미지: 무엇을 원하는지 아는 생물 하나 더 (Human 이름) | C038~ (넷 안팎) | 기다림 |
| 3 | **L4** | (가칭) CarryAndItOpens — 캐서 지니면 갈 수 있는 곳이 늘어난다 | 보석 하나(빙정석 또는 빙결정 — D2)를 캐서 **지니고**(D1 §26 기구 · 요정별 소지 — L7 확정 10), 물건 하나가 같은 행동을 다른 행동으로 바꾼다(L7 §17). 소지가 문의 요구에 답하는 **둘째 종류의 답**(Access ㊵ — 몸 · 소지 · 동행 가운데 둘째) · 열 결정(C030)을 **들면** 문이 열린다 | C030(열 결정의 원천) · OneStandsOnStage C036(property Lock 판정 기구 재사용) | 4층 주입 — 가공 사슬 · 조합과 쓰임(Design-Item-* · Inventory-D1 · Resource-Catalog) · D2(빙정석=빙결정) · D4(능력치 아이템의 범위) + 미지: 어디서 나는지 정해진 자원 하나(보석 하나 — 이름과 Region 은 Human) | C042~ (넷 안팎) | 기다림 — **Human 결정으로 앞당길 수 있다** (3층과 거의 독립) |
| 4 | **L5** | (가칭) TwoWaysToFell — 처음으로 맞서 이긴다 | 같은 적을 두 가지 상태 순서로 쓰러뜨린다(L7 §14 — Wet → Frozen → 파괴 / Mark → 파괴 → 침식). 대상의 World State(Access 어휘의 확장 — L7 확정 8)를 생성 · 소비하는 것이 전투의 문법이고, 시스템은 순서를 지정하지 않는다 | L3 두 Play · L4 Play (지닌 것이 계산에 든다) | 5층 주입 — 공격 · 방어 · 피해 종류 · 지목(Design-Combat-* · Targeting) · D3(지식 슬롯 모델) + 미지: 여러 해법을 허용하는 몬스터 하나(Human 이름 — M8 을 깊게 해도 된다) | C046~ | 기다림 |
| 5 | **L6** | (가칭) OneCoreTwoWays — 능력 표현이 세계에 닿는다 | 한 Core 가 두 Class 로 다른 Law 가 되고(L7 §6), Leave 가 남긴 장판이 다음 요정의 능력과 반응한다(§11 늪의 마녀). Active · Entry · Leave · Off-field 의 **내용** | L5 Play (상태가 있어야 능력이 만들 것이 있다) | 6층 주입 — 스킬 체계 · 실행 형태 · 효과(Design-Skill-*) · D5(Off-field 시간 규모) + Class 둘의 정식 이름(L7 §6 예시 중 — Human) | C050~ | 기다림 |
| 6 | **L7** | (가칭) OneGemChangesTheAnswer — 자원 관계에서 성장이 나온다 | 보석 하나로 Class 가 바뀌어(Fairy + Gem + 조건 — L7 §7 · 확정 7) 못 풀던 자리를 **새 방법**으로 푼다. "원하는 Class → 필요한 Gem → 그 Region" 이 탐험 목표가 된다(§8). Knowledge 하나가 숨겨진 관계를 연다(§18). 미증명 ③ 의 직접 증명 | L6 Play (Class 가 있어야 바뀔 것이 있다) · L4 Play (Gem 을 지닌다) | 7층 주입 — D1(요정 획득 방식) · Class Change 의 조건 데이터 · Growth-Balance 의 검증 대상("열린 방법의 수") + 미지: 보석 하나의 Region 과 원인 · Knowledge 하나(Human) | C054~ | 기다림 — **Human 결정으로 앞당길 수 있다** (순서를 미리 보이는 가치) |
| — | 컨텐츠 행 | (Play 없음이 대부분) | 보석 여덟 · 클래스 · 아이템 · 지식 · 지역(L7 §6 후보) — 등급 A(데이터만)면 Region 작성기 · Spec 한 장 · 검사 · Human 판정으로 닫는다. B(규칙 하나)면 Cycle 하나, C(새 축)면 기반 층 | Human 이 이름 · 종류 · 세계관 사실을 확정 | 미지 하나씩 | — | Human 이 이름을 줄 때마다 |

8층(화면)은 Play 가 없다 — 각 Play 의 Required 로 들어온다. 3층 Play 가 둘인 이유: L7 의 3층 몫(편성 · 교체)이 먼저 열렸고, 3층 본래의
절반(몸 · 생물의 앎과 선택)은 그 다음이다. 4층과 7층은 앞당겨도 되는 둘이다 — 앞당기면 초안이 Human 질문이 많은 채로 서고, 앞 층의 실주행이
전제를 바꾸면 다시 손본다 (L7 배분 §3 · 이 문서 §3 의 결정 줄).

## 3. 기획 작업 큐 — 지금부터 순서대로

한 줄이 advprotoi-design 의 작업 하나다. 위가 먼저다. Human 이 답해야 풀리는 줄은 **굵게**.

```text
1  **OneStandsOnStage 승인** — "C034 진행" (또는 Human 질문 여섯의 답) → 승인 반영 (제안값 → 확정 후보 · STATE 레인 그대로)         Human
2  **TrailBehindClueAhead 승인** — 질문 여섯 답 → 승인 반영 (play/README 표 · Observe 레인 재개 · TODO §3 GAP 둘 삭제 · Rooms 행 닫기)  Human
3  **RoomOfAnotherKind 실주행 판정** — TODO §1 Q39~Q44 → "아니오" 가 있으면 DESIGN GAP 회수 기획                                  Human → design
4  HundredRooms Play 초안 — 전제가 다 섰다 (T1~T6). 미지 백 줄의 이름은 Human 이 준다 — 없으면 초안기(world:draft --batch)가 후보를 내고
   Human 이 고른다. Cycle 은 C025 뒤                                                                                            design (Human 이름)
5  **결정 — 4층 · 7층 Play 를 앞당기는가** (§2 순서 3 · 6). 앞당기면 4 → 7 순으로 초안. 아니면 규칙대로 3층 둘째 Play 뒤                    Human
6  Life 실주행 판정(C025 뒤) · Access 실주행 판정(C031 뒤) → GAP 회수                                                                Human → design
7  3층 둘째 Play (BodyKnowsAndWants) — OneStandsOnStage 판정 뒤 · 3층 나머지 절반 주입과 함께                                        Human 주입 → design
8  4층 → 5층 → 6층 → 7층 Play — 각 층이 열릴 때 (앞 층 판정 + 그 층 주입 + 위임 D1~D5 회수)                                            Human 주입 → design
9  컨텐츠 행 — Human 이 이름을 줄 때마다 등급 판정(A/B/C) → A 는 Spec · B 는 Cycle 하나 · C 는 기반 층 행                              Human 이름 → design/도구
```

TODO.md §2(Human 이 정할 것 — 값 · 규칙 · 방향)는 기획 작업이 아니라 **결정 목록**이라 여기 옮기지 않는다. §3(뒤 층 · 뒤 Play 로)의 남은 줄은
그 층 · Play 를 기획할 때(위 7 · 8)의 입력이다 — 받으면 지운다.
