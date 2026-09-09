# DESIGN — 기획 관점 상세

살아 있는 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 경위는 git history 가 소유한다.
요약은 [STATE.md](STATE.md) §1, 할 일은 [TODO.md](TODO.md) §2 가 든다 — 여기는 그 둘이 가리키는 상세다.

```text
질문    어떤 기획서가 얼마나 반영되었는가 — 층 · 컨텐츠 행 · 원본 기획 하나하나의 덮임과 남은 것.
기능    §1 기반 층 · §2 컨텐츠 행 · §3 원본 기획 → Play 덮임과 남은 것 · §4 자리 없는 것 · §5 쓸 Play · §6 코드에 아직 없는 축
쓰는 이  advprotoi-design — 주입 · Play 승인 · 실주행 판정 반영 때. Cycle 마감이 "뒤 층 · 뒤 Play 로" 보낸 것은 §3 의 "남은 것" 에 바로 적는다.
규약    층의 정의 · 주입 방식 · 열 질문은 content/roadmap/README.md (불변). 여기는 상태와 남은 것만.
상태 어휘  층 · 행: 확정 / 다음 / 미주입.  Play: 닫힘 · 판정 대기 · 진행 · 승인 대기 · 쓸 수 있음 · 기다림
```

## 1. 기반 층 — 축의 순서

한 번에 하나만 열린다. 위 층의 답으로만 아래 층이 설명된다 (정의는 [README §1·§2](../content/roadmap/README.md)).

| 층 | 이름 | 결과물 (확정 문서) | 증명 Play | 상태 | 남은 것 |
|---|---|---|---|---|---|
| 0 | 게임 방향 | [L0-Game.md](../content/roadmap/L0-Game.md) | 없음 — 판단 기준 | **확정** | 미증명 넷 (§3 L0) |
| 1 | 세계의 문법 | [L1-World-Grammar.md](../content/roadmap/L1-World-Grammar.md) | 없음 — 코드가 이미 이 문법 위 | **확정** | 없음 |
| 2 | 세계 자체 | [L2-World-Tool](../content/roadmap/L2-World-Tool.md) · [Tool-Scale](../content/roadmap/L2-World-Tool-Scale.md) · [Concept](../content/roadmap/L2-World-Concept.md) · [Region](../content/roadmap/L2-World-Region.md) · [Material](../content/roadmap/L2-World-Material.md) · [Time](../content/roadmap/L2-World-Time.md) · [Life](../content/roadmap/L2-World-Life.md) · [Access](../content/roadmap/L2-World-Access.md) · [Foundation](../content/roadmap/L2-World-Foundation.md) | 2층 Play 아홉 + 회수 둘 ([PLAYS.md](PLAYS.md)) | **다음** — 기획은 닫혔다 (더 쌓을 기획 없음) · Play 실주행 판정이 남았다 | 판정 대기 셋(Frost · Access · Life) · Cycle 미완 둘(Foundation · Trail) · 도구 Play HundredRooms |
| 3 | 주체와 몸 | [L7 §3](../content/roadmap/L7-Fairy-Growth-Combination.md) 의 3층 몫 (편성 · 무대의 한 명 · Core 가 몸의 State 로) | [OneStandsOnStage](../content/roadmap/play/OneStandsOnStage.md) | **다음** — Human 결정으로 2층 판정과 **병행**. 3층 몫만 (C037~C040) | 나머지 절반(몸의 값 전반 · 생물의 앎과 선택)은 별도 주입 → 3층 둘째 Play |
| 4 | 자원과 물건 | — | (가칭) CarryAndItOpens | 미주입 | L7 4층 몫 · Material 쓰임 · Access 4층 몫 (§3) |
| 5 | 대결 | — | (가칭) TwoWaysToFell | 미주입 | L7 5층 몫 · Concept W6 · W7 |
| 6 | 능력 | — | (가칭) OneCoreTwoWays | 미주입 | L7 6층 몫 |
| 7 | 성장 | [L7-Fairy-Growth-Combination.md](../content/roadmap/L7-Fairy-Growth-Combination.md) (원문 · 배분 확정) | (가칭) OneGemChangesTheAnswer | 미주입 — 원문은 확정 | L7 7층 몫 · 보류 계열 일곱 |
| 8 | 화면 | — | 없음 — 각 Play 의 Required 로 | — | — |

2층의 도구 절반 2단계(Region 작성기 T1~T6)는 전부 섰다 — 남은 것은 T3 의 ecology 산출(Life 가 닫혀 이제 붙일 수 있다)과 Play HundredRooms 뿐. 단계 정의는 [Tool-Scale §3](../content/roadmap/L2-World-Tool-Scale.md).

## 2. 컨텐츠 행 — 미지의 목록

행 하나 = 미지 하나 = Play 하나. 순서가 없다 — 요구 축이 확정이면 언제든 시작한다. 이름은 Human 만 짓는다.

| 미지 | 종류 | 원본 | 요구 축 | Play | 상태 |
|---|---|---|---|---|---|
| M1 거대 악마의 숲 | 지역 | [Region §5.1·§5.4](../content/roadmap/L2-World-Region.md) | 2 | RegionGraphRooms | 판정 끝 — GAP 둘을 Trail 이 받았다 · Trail 승인 → 닫힘 |
| M2 환상의 미로 | 지역 | [Region §16](../content/roadmap/L2-World-Region.md) | 2 | RuleBoundRoom | 닫힘 |
| M3 숲의 재료 계통 | 자원 | Concept §4 · RoomBearsMaterial D1·D2 | 2 | RoomBearsMaterial | 닫힘 |
| M4 천공고래의 길 | 현상 | Concept §9 · RoomNeverSame 확정 9 | 2 | RoomNeverSame · RoomRemembersAndOffers 가 깊게 한다 | 닫힘 (Foundation 진행 중) |
| M5 빙결 협곡 | 지역 | [M5-FrostCanyon.md](../content/roadmap/M5-FrostCanyon.md) | 2 | RoomOfAnotherKind | **판정 대기** |
| M6 붉은 알집 | 구조 | [Life §5](../content/roadmap/L2-World-Life.md) · RoomBearsLife 확정 1·2 | 2 | RoomBearsLife | **판정 대기** — 거목 내부 세계 서쪽 벽(`CORE_EMBER`)에 놓였다 |
| M7 열을 저장하는 결정의 원천 | 자원 | [Access D2](../content/roadmap/L2-World-Access.md) | 2 | RoomAsksForPossibilities | **판정 대기** |
| M8 협곡의 열을 쫓는 것 | 생물 | Concept §6 · Frost Cause Network | 2 · 3 | OneStandsOnStage (C040) | 승인 대기 — 이름은 Human (코드 후보 `HEAT_STALKER`) |
| (이후) | 지역 · 생물 · 자원 · 구조 | `M<N>-*.md` | 2 · 3 · … | 그 미지 하나를 만나는 Play | Human 이 이름을 줄 때마다 등급 판정(A/B/C) |

## 3. 원본 기획 → Play 덮임 · 남은 것

```text
읽는 법
  원본      작업에 올린 기획 — 로드맵 결과물(L<N> · M<N>) · 지목된 design/ 문서 · 실주행이 돌려보낸 GAP. 이것만이 Play 의 재료다
  덮음      그 원본을 재료로 쓴 Play 와 그 상태
  덮인 것   그 Play 들이 증명했거나 증명 중인 원본의 절
  남은 것   아직 어느 Play 도 받지 않은 원본의 절 → 받는 자리(쓸 Play · 층 · 컨텐츠 행 · 도구 · 두지 않음). 비면 그 원본은 다 덮인 것이다
갱신      새 주입 · Play 승인 · Cycle 이 main 에 합쳐짐 · 실주행 판정 반영 — 이 넷이 일어날 때 advprotoi-design 이 고친다.
          Cycle 마감이 "뒤 층 · 뒤 Play 로" 보내는 것은 그 원본의 "남은 것" 에 바로 적는다 (다른 곳에 두지 않는다)
```

### L0-Game — 게임 방향 (원문 둘)

```text
덮음      없음 — 판단 기준 (모든 Play 의 §5 · 열 질문 ⑦~⑩)
덮인 것   전 Play 가 §4 네 질문을 통과한다. 둘째 원문(요정 컬렉션 · 무대의 한 명)은 L7 행이 받는다
남은 것   미증명 넷
          ① 재방문 — Time 이 "다른 때" · Life 가 "새로 생기는 것" · Foundation 이 "다른 과거"      → 컨텐츠 행이 채운다
          ② 다중 플레이어의 이유 — Time 소란 · 발자국이 필요조건. 충분조건(분업 · 거래 · 정보 공유)  → 어느 층에도 없다 (§4)
          ③ 성장 선택의 애착과 고민                                                            → OneStandsOnStage · 7층 Play
          ④ 발견 뒤에도 움직이는가 — Time · Life · Foundation 이 세운다                          → 판정은 실주행
          빈칸 5 — L0 §3 에 "가능성 탐색" 마디 (Access 가 요구)                                 → Human — L0
```

### L1-World-Grammar — 세계의 문법

```text
덮음      없음 — 코드가 이미 이 문법 위
덮인 것   Entity · State · Subject · Law · 시간 · 저장/유도 · 계산/확률 · 순서 · 성장 축이 닿는 자리
남은 것   없음 (요정 Core 의 넷째 자리는 L7 §3 이 "문법 변경 없음" 으로 정리했다). 확률 → 5층 이후
```

### L2-World-Tool — 도구 절반 1단계 (WE · Plan)

```text
덮음      RegionGraphRooms(판정 끝) · RoomBecomesLand(닫힘)
덮인 것   Description · Graph · 관찰 · 검사 ⑤~⑨ · Height Field · Stamp · Curve · Surface · traversable · 컴파일 캐시 · Build→Observe 루프
남은 것   Tree/Rock Kit · scatter 밀도 · 자산 카탈로그(WE §17~§26)   → Land 뒤 폴리싱(데이터) — Play 없음
          Streaming                                              → 큰 Region 이 실제로 올 때 ENGINE 레인(chunk 적재) — Play 없음
```

### L2-World-Tool-Scale — 도구 2단계 · Region 작성기

```text
덮음      ENGINE 레인 T1~T6 (섰다 — Cycle 아님)
덮인 것   검사기 · brief 형 · 뼈대 생성기(절반) · 등급 판정기 · 초안기 · 판정 표면
남은 것   HundredRooms Play (§5 순서 1 — 쓸 수 있음)
          T3 의 ecology 산출                                       → Life 가 닫혔다 — ENGINE 레인 지금
          갈래별 땅 묶음의 분기(§7 "땅이 같다")                        → templates 손질 — Play 없음 · 지금 손볼 수 있다
```

### L2-World-Concept — 세계관 컨셉 ①

```text
덮음      RegionGraphRooms(W1 · W11) · RuleBoundRoom(W5 · W8 · W9) · RoomBecomesLand(W2 · §16) · RoomBearsMaterial(W4 · §4)
덮인 것   깊이 · 끝없음 · 지역은 하나의 현상 · 단서 · 플레이어 없이 돈다 · 안전은 조건 · 비주얼 방향 · 동근원 · 숲의 사슬
남은 것   W3 위험 일곱 갈래가 몸에 닿는 것 — 추위는 OneStandsOnStage · 나머지(지형 · 물질 · 생물 · 생태 …)  → 3층 둘째 Play · 5층
          W7 지식이 전투력 · W10 강함만으로 안 됨                                                  → 3층 둘째 · 5층
          §8 요정/Class                                                                        → L7 행
          W6 압도적 존재와의 접촉                                                                 → 컨텐츠 행 + 5층
          §14 사회적 분업                                                                        → 자리 없음 (§4)
          §16 비주얼 세부                                                                        → content/view 결정 Layer (도구 아님)
```

### L2-World-Region — 세계 content 구성 ②

```text
덮음      RegionGraphRooms(R1 · R3 · R5 · R6 · R9 · R12) · RuleBoundRoom(R4 · R7 · R8 · §10 · §16 · §17) · RoomBecomesLand(R11 · §13) · RoomBearsMaterial(R10 · §15)
덮인 것   Graph · WorldPosition · 중첩 · Connector · 진입/이탈 · 공간 분리 · State 공유 · Rule · Spec 양식 · 규칙 가독성 · Terrain 은 결과 · 하나의 Cause
남은 것   §8 Discovery State(개인 지식) · §6 Hard Entry 의 knowledge activation   → 3층 둘째 Play (knowledge Lock 판정)
          §12 Growth Outcome 의 capability                                      → 4층 · 7층 Play
          §6 Soft Requirement(몸의 값)                                           → OneStandsOnStage(온기) · 3층 둘째
          §5.1 이름 표의 나머지(거꾸로 된 정원 · 걷는 숲 · …)                          → 컨텐츠 행 — Human 이 하나씩
          거꾸로 된 정원의 문 저쪽 anchor 'MAZE_HEART_SIDE'                          → 정원을 짓는 Play 가 가져간다
```

### L2-World-Material — 재료 생태와 공급 계약

```text
덮음      RoomBearsMaterial(닫힘 — S1~S12) · RoomOfAnotherKind(판정 대기 — 둘째 적용) · RoomBearsLife(판정 대기 — RESIDUE 의 주인)
덮인 것   원천 · 흔적 · 구배 · 생애 · 공급 · 채취 결과 · 흐름 · 도구 보고 ⑩~㉒
남은 것   S10 이 미룬 쓰임(Recipe · 조합 · Item 효과 · 수치 · Class 요구)                    → 4층 Play · 7층 Play
          CREATURE Carrier 의 살아 있는 쪽 · 채취가 생물 행동에 미치는 것 · §4 "주변 생물의 행동"   → 3층 둘째 Play
          §2.2 플레이어 지식 상태                                                        → 3층 둘째
          살아 있는 생물(광식충 · 조류 · 포식수)에 매달린 원천 일곱 — 몸과 행동                  → 3층
          둘째 흐름 · 유한 원천(FINITE_WORLD_STATE)                                       → 다음 Region 의 컨텐츠 행
          hazard · phenomenon layer 컨텐츠 주입 — 검사 ①④ 가 그때까지 absent                → 컨텐츠 층 주입
```

### L2-World-Time — 세계의 시간과 위상

```text
덮음      RoomNeverSame(닫힘 — T1~T8) · RoomOfAnotherKind(둘째 적용 — 철이 안전 조건에 닿는다) · RoomRemembersAndOffers(M4 를 깊게 — 진행)
덮인 것   시계 · 네 철 · 위상 덧씌움 · 소란 · 발자국 · 압도적 존재의 경로 · 검사 ㉓~㉖
남은 것   §5 밤과 철이 몸을 깎는 것(추위 · 피로 · 긴 밤 버티기)   → OneStandsOnStage(추위만) · 3층 둘째(피로 · 밤)
          생물의 철 따른 이동 · 번식 · 동면                       → 3층 둘째 · Life 실주행
          압도적 존재와의 접촉이 몸에 하는 일                       → 3층 둘째 · 5층
          지식이 철의 규칙을 연다                                 → 3층 둘째
          날씨                                                → 두지 않는다 (컨텐츠 행의 현상으로)
          걷는 숲의 나무 이동                                    → 그 Region 의 컨텐츠 행
```

### L2-World-Life — 생명의 성립과 탄생

```text
덮음      RoomBearsLife(판정 대기 — F1~F15 · C022~C025 가 세웠다)
덮인 것   생명의 정의 · 네 탄생 방식 · 소비와 흔적 · 개체군 값과 관계 · 멸종 없음 · 회복 · 검사 ㉗~㉝
남은 것   F10 태어난 개체의 몸 · 감각 · 지식 · 행동 · 죽음 · 성장 단계 · 능력치   → OneStandsOnStage(M8 — 첫 개체) · 3층 둘째(나머지)
          성별 · 번식 · 유전과 변이                                      → 자리 없음 (§4)
          플레이어가 탄생에 개입하는 Action(Exploit)                        → 3층 둘째 이후
          F11 요정의 원리 결속                                          → 7층 Play(D1 요정 획득)
          F12 최초의 생명                                              → 확정하지 않는다
          §3.5 작성기가 생명을 안다                                       → T3 ecology (지금)
```

### L2-World-Access — 세계의 요구와 가능성

```text
덮음      RoomAsksForPossibilities(판정 대기 — K1~K15 · C029~C031) · OneStandsOnStage(승인 대기 — property Lock 의 첫 판정 · Actor 가능성)
덮인 것   Lock 넷 · 성질 어휘 · Seed 의 성질 · 여러 종류의 답 · 흔적 · 검사 ㉞~㊷ · time/state 판정 · (3층) heat:hides 를 몸이 답한다
남은 것   knowledge Lock 의 판정 · 관찰자가 요구를 어디까지 이해하는가(§7 네 단계)             → 3층 둘째 Play
          가능성을 지니는 것(소지 · 장비 · 섭취 · 동행) · 성질 상속 · 수치 · 조합과 상쇄 · SUPPORTS/OPPOSES 효과   → 4층 Play
          클래스 · 요정 자체가 가능성이 되는 성장                                             → 7층 Play
          "세 계통의 답이 실제 플레이에서 성립"                                                → 4층 Play 의 완료 확인(몸 · 소지 · 환경)
          요구를 실제로 채우는 것 — property Lock 의 판정(몸 · 소지 · 지식)                       → 3층(몸 — Stage) · 4층(소지)
          플레이어 사이의 가능성 공유                                                        → 자리 없음 (§4)
```

### L2-World-Foundation — Region Foundation (②-부속 다섯째)

```text
덮음      RoomRemembersAndOffers(진행 — C034~C036)
덮인 것   G1~G13 — 여덟 자리 · 기억(history · 수명 표) · 조건의 한 형 · 기회=데이터 · Event=때 있는 기회 · Mutation op 표 · 검사 ㊸~㊼ · 최소 완성 기준 25
남은 것   §5.5 Player Knowledge · 발견 상태 다섯 · knowledge Lock          → 3층 둘째 Play (G10)
          Actor · NPC · participants                                  → OneStandsOnStage(첫 개체) · 3층 둘째
          전투 Opportunity · Boss 탄생 조건 · killed                     → 5층 Play
          제작 · Recipe · Item · Currency                              → 4층 Play
          Character Growth · Mastery · Class Progress · Capability      → 7층 Play
          G12 Region 자체 성장(둥지 → 군락 · 폐허 → 마을)                   → Life 개체군 + 3층 NPC 뒤
          경제 · 세력 · 협동 · 구조 · 미니게임 · 서사 · NPC 조우              → 자리 없음 (§4)
```

### M5-FrostCanyon — 빙결 협곡 (컨텐츠)

```text
덮음      RoomOfAnotherKind(판정 대기)
덮인 것   협곡 방 둘 · 위험 갈래 셋 · 빙정석 계통 · 문의 요구 표시 · 철이 고개를 넘는다
남은 것   추위가 몸에 하는 일                            → OneStandsOnStage(온기)
          결정면 접촉이 몸에 하는 일(crystallizing)         → 3층 둘째 Play
          체온을 쫓는 포식자                              → OneStandsOnStage(M8)
          판정 "아니오"                                  → GAP 회수 기획
```

### design/Plan-Place-Observation-Surface — 자리를 관찰하는 표면

```text
덮음      RoomAnswersWhenAsked(닫힘 — 확정 열하나 · 실주행 반영)
남은 것   없음 — 남은 결손은 Human 결정 ([PLAYS.md](PLAYS.md) Observe 결정 대기)
```

### 실주행 GAP — RegionGraphRooms Q1 · Q2

Play 실주행 판정에서 "아니오" 로 돌아온 것. 새 축 · 새 미지가 아니다. 둘 다 [TrailBehindClueAhead](../content/roadmap/play/TrailBehindClueAhead.md) 초안이 받았다 — 승인되면 이 절을 지운다.

```text
Q1  깊이만으로는 "어디쯤인가" 가 잡히지 않는다 — 바닥 색 + 상단 문구로 "얼마나 깊이 왔는가" 를 알게 하려 했는데 Human 의 답은
    "지도도 없는데 어떻게 알 수 있다는 건지". 세계가 위치·방향을 어떤 형태로 줄지(지도 · 이정표 · 흔적 · 깊이 감각만)는 기획이 정한다   C001~C004
Q2  떨어지는 자리를 세계가 알리지 않는다 — 추락은 거목 내부 세계 북쪽 끝 (0, 38) 곁에서 저절로 일어나는데 Human 은 절벽에서
    "너무 가파르다" 만 보았다. 예고를 둘지(바닥의 갈라짐 · 소리 · 흔적) 그대로 둘지는 기획이 정한다                              C003
절벽 낙하(자리가 아닌 절벽에서 떨어지기)는 Trail 밖 → 원하면 별도 주입
```

### L7-Fairy-Growth-Combination — 요정 성장·조합 모델 (확정 · 3~7층에 배분)

```text
3층 몫    OneStandsOnStage(승인 대기) — §9 편성 · §10 무대의 한 명 · §11 Entry/Leave/Off-field 의 자리 · §20 · §4~§5 Core 가 몸의 State 로 · 확정 4 · 5 · 10 · 11. 나머지 없음
4층 몫    §8 보석 = 성장 재료 · §17 Item = 행동을 바꾸는 장치 · §24 스탯 부착물 금지 · §16 · 확정 6(보석 여덟 후보) · 확정 10 · D2 · D4   → 4층 Play
5층 몫    §13 정해진 Phase 없음 · World State 어휘 열하나(확정 8) · §14 창발 전투 · §16 여러 답 · §23 Monster · D3(지식 슬롯)        → 5층 Play
6층 몫    §6 Class = Core 를 쓰는 방법 · §11 의 내용 · §5 · §19 탐험 조합 · D5(Off-field 시간 규모)                               → 6층 Play
7층 몫    §1~§3 컬렉션 넷 · §7 Class Change(확정 7) · §8 순환 · §12 · §18 Knowledge(확정 9) · §21 Build · §22 · §25~§27 · 확정 2 · D1   → 7층 Play
          보류된 계열 일곱                                                                                          → 컨텐츠 행(요정) — Human 이 하나씩
```

## 4. 어느 층에도 자리가 없는 것

원본이 "뒤 층" 이라고만 한 것 — 새 주입이 있어야 한다. 로드맵 8층은 화면이라 이것들의 층이 아니다. **9층 이상을 세울지, 3~7층 어딘가에 넣을지는 Human 결정** ([TODO.md](TODO.md) §1).

```text
다중 플레이어의 충분조건 — 분업 · 거래 · 정보 공유 · 가능성 공유    L0 ② · Concept §14 · Access
사회 — 경제 · 세력 · 협동 · 구조 · 미니게임 · 서사 · NPC 조우         Foundation §5.5
생물의 성별 · 번식 · 유전과 변이                                  Life
절벽 낙하                                                    Trail 밖
```

## 5. 쓸 Play — 순서대로

번호는 예정이다 — 실제 번호는 승인 때 "전 이름공간 최대 + 1" 로 정한다 (C041 부터 · 앞 Play 가 늘면 밀린다). "받는 것" 이 §3 의 "남은 것" 과 짝이다.

| 순서 | 층 | Play (가칭) | 증명 (방향) | 받는 것 | 전제 | 그때 필요한 주입 · 미지 | Cycle | 상태 |
|---|---|---|---|---|---|---|---|---|
| 1 | L2 도구 | **HundredRooms** ([Tool-Scale §5](../content/roadmap/L2-World-Tool-Scale.md)) | 미지 백 줄 → 방 백 개가 검사를 통과하고 관찰자가 열 곳을 걸어 흔적 → 원천 → 철 → 탄생지를 본다. 코드 diff 0 | Tool-Scale 의 HundredRooms | T1~T6(섰다) · T3 ecology | 미지 백 줄의 **이름**(Human — 또는 초안기 후보를 Human 이 고른다) | 셋 안팎 | **쓸 수 있음** |
| 2 | L3 둘째 | (가칭) BodyKnowsAndWants | 몸이 무엇을 가지는가(피로 · 밤 · 결정면 접촉) · 생물이 무엇을 알고 어떻게 고르는가 · 관찰자가 요구를 어디까지 이해하는가 · knowledge Lock · Discovery State | §3 의 "3층 둘째" 전부 | OneStandsOnStage 실주행 판정 | 3층 주입 — 몸의 값 · 생물 행동 재료(Subject-Decision · Autonomous-Behavior · Creature-Behavior) + 미지: 무엇을 원하는지 아는 생물 하나 더 | 넷 안팎 | 기다림 |
| 3 | L4 | (가칭) CarryAndItOpens | 보석 하나를 캐서 **지니고**, 물건 하나가 같은 행동을 다른 행동으로 바꾼다 → 세 계통의 답(몸 · 소지 · 환경)이 한 문에 실제로 선다 | L7 4층 몫 · Material S10 · Access 4층 몫 · Region §12 | C030 · OneStandsOnStage C039 | 4층 주입 — 가공 사슬 · 조합과 쓰임(Item-* · Inventory-D1 · Resource-Catalog) · D2 · D4 + 미지: 어디서 나는지 정해진 자원 하나 | 넷 안팎 | 기다림 — **Human 결정으로 앞당길 수 있다** |
| 4 | L5 | (가칭) TwoWaysToFell | 같은 적을 두 가지 상태 순서로 쓰러뜨린다 · 대상의 World State 생성·소비가 전투의 문법 · 압도적 존재와의 접촉 | L7 5층 몫 · Concept W6 · W7 · Time 접촉 | L3 둘 · L4 Play | 5층 주입 — 공격 · 방어 · 피해 종류 · 지목(Combat-* · Targeting) · D3 + 미지: 여러 해법을 허용하는 몬스터 하나 | — | 기다림 |
| 5 | L6 | (가칭) OneCoreTwoWays | 한 Core 가 두 Class 로 다른 Law 가 되고, Leave 가 남긴 장판이 다음 요정의 능력과 반응한다 | L7 6층 몫 | L5 Play | 6층 주입 — 스킬 체계 · 실행 형태 · 효과(Skill-*) · D5 + Class 둘의 정식 이름 | — | 기다림 |
| 6 | L7 | (가칭) OneGemChangesTheAnswer | 보석 하나로 Class 가 바뀌어 못 풀던 자리를 새 방법으로 푼다 · Knowledge 하나가 숨겨진 관계를 연다 · 미증명 ③ 직접 증명 | L7 7층 몫 · Life F11 · Access 7층 몫 · Material S10 의 Class 요구 | L6 · L4 Play | 7층 주입 — D1(요정 획득) · Class Change 조건 데이터 · Growth-Balance + 미지: 보석 하나의 Region 과 원인 · Knowledge 하나 | — | 기다림 — **Human 결정으로 앞당길 수 있다** |
| — | 컨텐츠 행 | (대부분 Play 없음) | 보석 여덟 · 보류 계열 일곱 · 클래스 · 아이템 · 지식 · 지역 — 등급 A 면 작성기 · Spec · 검사 · Human 판정 / B 면 Cycle 하나 / C 면 기반 층 | §3 의 "컨텐츠 행" 전부 | Human 이 이름 · 종류 · 세계관 사실을 확정 | 미지 하나씩 | — | Human 이 이름을 줄 때마다 |

8층(화면)은 Play 가 없다 — 각 Play 의 Required 로 들어온다. 4층과 7층은 앞당겨도 되는 둘이다 — 앞당기면 초안이 Human 질문이 많은 채로 서고, 앞 층의 실주행이 전제를 바꾸면 다시 손본다.

## 6. 코드에 아직 없는 축

design/ 에만 있는 것 — 그 층이 열릴 때 Play 가 세운다.

```text
전투 공식 · 막기 · 피해 종류 · 살펴봄 · 태도 · 장비 · 스킬 형태 · 성장 · 재료의 쓰임          4~7층
기억과 기회(history · 조건의 한 형 · Opportunity · 검사 ㊸~㊼)                                  Foundation C034~C036 이 세우는 중
property Lock 의 판정(몸이 요구에 답하는 것) — 2층은 요구를 세우고 답을 세는 데까지다              3층 Stage C039 · 4층
```
