# DESIGN — 기획 관점 상세

살아 있는 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 경위는 git history 가 소유한다.
요약은 [STATE.md](STATE.md) §1, 할 일은 [TODO.md](TODO.md) 가 든다 — 여기는 그 둘이 가리키는 상세다.

```text
질문    어떤 기획서가 얼마나 반영되었는가 — 층 · 컨텐츠 행 · 원본 기획 하나하나의 덮임과 남은 것 · 다음에 자를 묶음.
기능    §1 기반 층 · §2 컨텐츠 행 · §3 원본 기획 → Cycle 덮임과 남은 것 · §4 자리 없는 것 · §5 다음 묶음 후보 · §6 코드에 아직 없는 축
쓰는 이  advprotoi-cycle — 주입 보존 · 묶음 승인("C### 진행") · 실주행 판정 반영 때. Cycle 마감이 "뒤 층 · 뒤 묶음으로" 보낸 것은 §3 의 "남은 것" 에 바로 적는다.
규약    층의 정의 · 주입 방식 · 열 질문은 content/roadmap/README.md (불변). 여기는 상태와 남은 것만.
상태 어휘  층 · 행: 확정 / 다음 / 미주입.  묶음: 닫힘 · 판정 대기 · 진행 · 제안 대기 · 후보
```

## 1. 기반 층 — 축의 순서

한 번에 하나만 열린다. 위 층의 답으로만 아래 층이 설명된다 (정의는 [README §1·§2](../content/roadmap/README.md)).

| 층 | 이름 | 결과물 (확정 문서) | 세운 Cycle | 상태 | 남은 것 |
|---|---|---|---|---|---|
| 0 | 게임 방향 | [L0-Game.md](../content/roadmap/L0-Game.md) | 없음 — 판단 기준 | **확정** | 미증명 넷 (§3 L0) |
| 1 | 세계의 문법 | [L1-World-Grammar.md](../content/roadmap/L1-World-Grammar.md) | 없음 — 코드가 이미 이 문법 위 | **확정** | 없음 |
| 2 | 세계 자체 | [L2-World-Tool](../content/roadmap/L2-World-Tool.md) · [Tool-Scale](../content/roadmap/L2-World-Tool-Scale.md) · [Concept](../content/roadmap/L2-World-Concept.md) · [Region](../content/roadmap/L2-World-Region.md) · [Material](../content/roadmap/L2-World-Material.md) · [Time](../content/roadmap/L2-World-Time.md) · [Life](../content/roadmap/L2-World-Life.md) · [Access](../content/roadmap/L2-World-Access.md) · [Foundation](../content/roadmap/L2-World-Foundation.md) | C001~C034 ([CYCLES §3.1](CYCLES.md)) | **다음** — 기획은 닫혔다 (더 쌓을 기획 없음) | Foundation 의 조건 · 기회 · Event(C035~C037 진행 중) · Rooms GAP 둘(후보 3) · 판정 대기 셋 · 도구 묶음 HundredRooms |
| 3 | 주체와 몸 | [L7 §3](../content/roadmap/L7-Fairy-Growth-Combination.md) 의 3층 몫 (편성 · 무대의 한 명 · Core 가 몸의 State 로) | 없음 | **다음** — Human 결정으로 2층 판정과 **병행** | 3층 몫 묶음(후보 2) · 나머지 절반(몸의 값 전반 · 생물의 앎과 선택)은 별도 주입 |
| 4 | 자원과 물건 | — | 없음 | 미주입 | L7 4층 몫 · Material 쓰임 · Access 4층 몫 (§3) |
| 5 | 대결 | — | 없음 | 미주입 | L7 5층 몫 · Concept W6 · W7 |
| 6 | 능력 | — | 없음 | 미주입 | L7 6층 몫 |
| 7 | 성장 | [L7-Fairy-Growth-Combination.md](../content/roadmap/L7-Fairy-Growth-Combination.md) (원문 · 배분 확정) | 없음 | 미주입 — 원문은 확정 | L7 7층 몫 · 보류 계열 일곱 |
| 8 | 화면 | — | — | — | 별도 주입 없음 — 각 묶음의 Required 로 |

2층의 도구 절반 2단계(Region 작성기 T1~T6)는 전부 섰다 — 남은 것은 T3 의 ecology 산출(생명이 코드에 있어 이제 붙일 수 있다)과 HundredRooms 묶음뿐. 단계 정의는 [Tool-Scale §3](../content/roadmap/L2-World-Tool-Scale.md).

## 2. 컨텐츠 행 — 미지의 목록

행 하나 = 미지 하나 = 묶음 하나(등급 A 는 묶음 없이 Spec). 순서가 없다 — 요구 축이 확정이면 언제든 시작한다. 이름은 Human 만 짓는다.

| 미지 | 종류 | 원본 | 요구 축 | Cycle | 상태 |
|---|---|---|---|---|---|
| M1 거대 악마의 숲 | 지역 | [Region §5.1·§5.4](../content/roadmap/L2-World-Region.md) | 2 | C001~C004 | 판정 끝 — GAP 둘(§3 실주행 GAP) → 묶음 후보 3 |
| M2 환상의 미로 | 지역 | [Region §16](../content/roadmap/L2-World-Region.md) | 2 | C008~C010 | 닫힘 |
| M3 숲의 재료 계통 | 자원 | Concept §4 · 위임된 결정(재료 이름 · 성질 — 코드와 spec 에 있다) | 2 | C011~C014 | 닫힘 |
| M4 천공고래의 길 | 현상 | Concept §9 · Time 2.6 | 2 | C015~C018 | 닫힘 (Foundation 묶음이 깊게 한다) |
| M5 빙결 협곡 | 지역 | [M5-FrostCanyon.md](../content/roadmap/M5-FrostCanyon.md) | 2 | C019~C021 | **판정 대기** |
| M6 붉은 알집 | 구조 | [Life §5](../content/roadmap/L2-World-Life.md) | 2 | C022~C025 | **판정 대기** — 거목 내부 세계 서쪽 벽(`CORE_EMBER`)에 놓였다 |
| M7 열을 저장하는 결정의 원천 | 자원 | [Access D2](../content/roadmap/L2-World-Access.md) | 2 | C029~C031 | **판정 대기** |
| M8 협곡의 열을 쫓는 것 | 생물 | Concept §6 · Frost Cause Network · M5 | 2 · 3 | 없음 | 3층 몫 묶음(후보 2)이 놓는다 — 이름은 Human (코드 후보 `HEAT_STALKER`) |
| (이후) | 지역 · 생물 · 자원 · 구조 | `M<N>-*.md` | 2 · 3 · … | 그 미지 하나를 만나는 묶음 | Human 이 이름을 줄 때마다 등급 판정(A/B/C) |

## 3. 원본 기획 → Cycle 덮임 · 남은 것

```text
읽는 법
  원본      작업에 올린 기획 — 로드맵 결과물(L<N> · M<N>) · 지목된 design/ 문서 · 실주행이 돌려보낸 GAP. 이것만이 묶음의 재료다
  덮음      그 원본을 SOURCE 로 쓴 Cycle 범위(묶음)와 그 상태
  덮인 것   그 Cycle 들이 세웠거나 세우는 중인 원본의 절
  남은 것   아직 어느 Cycle 도 받지 않은 원본의 절 → 받는 자리(묶음 후보 · 층 · 컨텐츠 행 · 도구 · 두지 않음). 비면 그 원본은 다 덮인 것이다
갱신      새 주입 · 묶음 승인 · Cycle 이 main 에 합쳐짐 · 실주행 판정 반영 — 이 넷이 일어날 때 고친다.
          Cycle 마감이 "뒤 층 · 뒤 묶음으로" 보내는 것은 그 원본의 "남은 것" 에 바로 적는다 (다른 곳에 두지 않는다)
재주입    기획서를 새 공정으로 다시 자를 때 "덮인 것" 은 Existing(codemap) 이고 "남은 것" 이 그 묶음의 Goal 후보다
```

### L0-Game — 게임 방향 (원문 둘)

```text
덮음      없음 — 판단 기준 (모든 묶음의 검사 · 열 질문 ⑦~⑩)
덮인 것   C001~C031 전부가 §4 네 질문을 통과한다. 둘째 원문(요정 컬렉션 · 무대의 한 명)은 L7 행이 받는다
남은 것   미증명 넷
          ① 재방문 — Time 이 "다른 때" · Life 가 "새로 생기는 것" · Foundation 이 "다른 과거"      → 컨텐츠 행이 채운다
          ② 다중 플레이어의 이유 — Time 소란 · 발자국이 필요조건. 충분조건(분업 · 거래 · 정보 공유)  → 어느 층에도 없다 (§4)
          ③ 성장 선택의 애착과 고민                                                            → 3층 몫 묶음 · 7층
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
덮음      C001~C007 (방들의 그래프 · 땅)
덮인 것   Description · Graph · 관찰 · 검사 ⑤~⑨ · Height Field · Stamp · Curve · Surface · traversable · 컴파일 캐시 · Build→Observe 루프
남은 것   Tree/Rock Kit · scatter 밀도 · 자산 카탈로그(WE §17~§26)   → 폴리싱(데이터) — 묶음 없음
          Streaming                                              → 큰 Region 이 실제로 올 때 ENGINE 레인(chunk 적재) — 묶음 없음
```

### L2-World-Tool-Scale — 도구 2단계 · Region 작성기

```text
덮음      ENGINE 레인 T1~T6 (섰다 — Cycle 아님)
덮인 것   검사기 · brief 형 · 뼈대 생성기(절반) · 등급 판정기 · 초안기 · 판정 표면
남은 것   HundredRooms (§5 후보 4 — 코드 diff 0)
          T3 의 ecology 산출                                       → ENGINE 레인 지금
          갈래별 땅 묶음의 분기(§7 "땅이 같다")                        → templates 손질 — 묶음 없음 · 지금 손볼 수 있다
```

### L2-World-Concept — 세계관 컨셉 ①

```text
덮음      C001~C004(W1 · W11) · C008~C010(W5 · W8 · W9) · C005~C007(W2 · §16) · C011~C014(W4 · §4)
덮인 것   깊이 · 끝없음 · 지역은 하나의 현상 · 단서 · 플레이어 없이 돈다 · 안전은 조건 · 비주얼 방향 · 동근원 · 숲의 사슬
남은 것   W3 위험 일곱 갈래가 몸에 닿는 것 — 추위는 3층 몫 묶음 · 나머지(지형 · 물질 · 생물 · 생태 …)  → 3층 둘째 · 5층
          W7 지식이 전투력 · W10 강함만으로 안 됨                                                  → 3층 둘째 · 5층
          §8 요정/Class                                                                        → L7 행
          W6 압도적 존재와의 접촉                                                                 → 컨텐츠 행 + 5층
          §14 사회적 분업                                                                        → 자리 없음 (§4)
          §16 비주얼 세부                                                                        → content/view 결정 Layer (도구 아님)
```

### L2-World-Region — 세계 content 구성 ②

```text
덮음      C001~C004(R1 · R3 · R5 · R6 · R9 · R12) · C008~C010(R4 · R7 · R8 · §10 · §16 · §17) · C005~C007(R11 · §13) · C011~C014(R10 · §15)
덮인 것   Graph · WorldPosition · 중첩 · Connector · 진입/이탈 · 공간 분리 · State 공유 · Rule · Spec 양식 · 규칙 가독성 · Terrain 은 결과 · 하나의 Cause
남은 것   §8 Discovery State(개인 지식) · §6 Hard Entry 의 knowledge activation   → 3층 둘째 (knowledge Lock 판정)
          §12 Growth Outcome 의 capability                                      → 4층 · 7층
          §6 Soft Requirement(몸의 값)                                           → 3층 몫 묶음(온기) · 3층 둘째
          §5.1 이름 표의 나머지(거꾸로 된 정원 · 걷는 숲 · …)                          → 컨텐츠 행 — Human 이 하나씩
          거꾸로 된 정원의 문 저쪽 anchor 'MAZE_HEART_SIDE'                          → 정원을 짓는 묶음이 가져간다
          §11 미지 여섯 · §17 "실패가 정보로" — 온 길의 기록 · 갈 길의 단서                 → 묶음 후보 3 (Rooms GAP 회수)
```

### L2-World-Material — 재료 생태와 공급 계약

```text
덮음      C011~C014(S1~S12) · C019~C021(둘째 적용 — 판정 대기) · C022~C025(RESIDUE 의 주인 — 판정 대기)
덮인 것   원천 · 흔적 · 구배 · 생애 · 공급 · 채취 결과 · 흐름 · 도구 보고 ⑩~㉒
남은 것   S10 이 미룬 쓰임(Recipe · 조합 · Item 효과 · 수치 · Class 요구)                    → 4층 · 7층
          CREATURE Carrier 의 살아 있는 쪽 · 채취가 생물 행동에 미치는 것 · §4 "주변 생물의 행동"   → 3층 둘째
          §2.2 플레이어 지식 상태                                                        → 3층 둘째
          살아 있는 생물(광식충 · 조류 · 포식수)에 매달린 원천 일곱 — 몸과 행동                  → 3층
          둘째 흐름 · 유한 원천(FINITE_WORLD_STATE)                                       → 다음 Region 의 컨텐츠 행
          hazard · phenomenon layer 컨텐츠 주입 — 검사 ①④ 가 그때까지 absent                → 컨텐츠 층 주입
```

### L2-World-Time — 세계의 시간과 위상

```text
덮음      C015~C018(T1~T8) · C019~C021(둘째 적용 — 철이 안전 조건에 닿는다)
덮인 것   시계 · 네 철 · 위상 덧씌움 · 소란 · 발자국 · 압도적 존재의 경로 · 검사 ㉓~㉖
남은 것   2.6 지나가는 것 · 2.7 — 지나간 뒤 남긴 것을 세계가 기억하고 때가 되면 내민다(비늘)   → 묶음 후보 1 (Foundation)
          §5 밤과 철이 몸을 깎는 것(추위 · 피로 · 긴 밤 버티기)   → 3층 몫 묶음(추위만) · 3층 둘째(피로 · 밤)
          생물의 철 따른 이동 · 번식 · 동면                       → 3층 둘째 · Life 실주행
          압도적 존재와의 접촉이 몸에 하는 일                       → 3층 둘째 · 5층
          지식이 철의 규칙을 연다                                 → 3층 둘째
          날씨                                                → 두지 않는다 (컨텐츠 행의 현상으로)
          걷는 숲의 나무 이동                                    → 그 Region 의 컨텐츠 행
```

### L2-World-Life — 생명의 성립과 탄생

```text
덮음      C022~C025(F1~F15 — 판정 대기)
덮인 것   생명의 정의 · 네 탄생 방식 · 소비와 흔적 · 개체군 값과 관계 · 멸종 없음 · 회복 · 검사 ㉗~㉝
남은 것   F10 태어난 개체의 몸 · 감각 · 지식 · 행동 · 죽음 · 성장 단계 · 능력치   → 3층 몫 묶음(M8 — 첫 개체) · 3층 둘째(나머지)
          성별 · 번식 · 유전과 변이                                      → 자리 없음 (§4)
          플레이어가 탄생에 개입하는 Action(Exploit)                        → 3층 둘째 이후
          F11 요정의 원리 결속                                          → 7층(D1 요정 획득)
          F12 최초의 생명                                              → 확정하지 않는다
          §3.5 작성기가 생명을 안다                                       → T3 ecology (지금)
```

### L2-World-Access — 세계의 요구와 가능성

```text
덮음      C029~C031(K1~K15 — 판정 대기)
덮인 것   Lock 넷 · 성질 어휘 · Seed 의 성질 · 여러 종류의 답 · 흔적 · 검사 ㉞~㊷ · time/state 판정
남은 것   property Lock 의 판정 — 몸이 요구에 답한다(§14.1 FROST_DEPTH `heat:hides` · §15 Actor: 체열 억제 · K12)   → 3층 몫 묶음 (후보 2)
          knowledge Lock 의 판정 · 관찰자가 요구를 어디까지 이해하는가(§7 네 단계)             → 3층 둘째
          가능성을 지니는 것(소지 · 장비 · 섭취 · 동행) · 성질 상속 · 수치 · 조합과 상쇄 · SUPPORTS/OPPOSES 효과   → 4층
          클래스 · 요정 자체가 가능성이 되는 성장                                             → 7층
          "세 계통의 답이 실제 플레이에서 성립"                                                → 4층 묶음의 완료 확인(몸 · 소지 · 환경)
          플레이어 사이의 가능성 공유                                                        → 자리 없음 (§4)
```

### L2-World-Foundation — Region Foundation (②-부속 다섯째)

```text
덮음      C034(닫힘 — G7 수명 표 · G8 기억 · §4.3 · §4.4 · ㊸ ㊼ · D4 · D5) · C035~C037(묶음 「방은 기억하고 때가 되면 내민다」 — 승인 · C035 진행 중 · CYCLES §3.4)
덮인 것   기억(history · 되돌아옴 · 뒤척임이 못 묻는다) · 수명 표 · 검사 ㊸ ㊼ · 판의 「기억」 줄
남은 것   C035 조건의 한 형(G5 · §4.1 · ㊹ · 빈칸 2) · C036 기회=데이터(G3 · §4.5 · ㊺ ㊻ · 기회 표) · C037 Event(G4 · D3 비늘) · op 표(G6) · Yield 표(G11) ·
          T2 열셋째 답 · T4 결정 나무 · T6 ㊻ · 최소 완성 기준 23 · 24 (G13)                                → C035~C037
          §5.5 Player Knowledge · 발견 상태 다섯 · knowledge Lock          → 3층 둘째 (G10)
          Actor · NPC · participants                                  → 3층 몫 묶음(첫 개체) · 3층 둘째
          전투 Opportunity · Boss 탄생 조건 · killed                     → 5층
          제작 · Recipe · Item · Currency                              → 4층
          Character Growth · Mastery · Class Progress · Capability      → 7층
          G12 Region 자체 성장(둥지 → 군락 · 폐허 → 마을)                   → Life 개체군 + 3층 NPC 뒤
          경제 · 세력 · 협동 · 구조 · 미니게임 · 서사 · NPC 조우              → 자리 없음 (§4)
```

### M5-FrostCanyon — 빙결 협곡 (컨텐츠)

```text
덮음      C019~C021 (판정 대기)
덮인 것   협곡 방 둘 · 위험 갈래 셋 · 빙정석 계통 · 문의 요구 표시 · 철이 고개를 넘는다
남은 것   추위가 몸에 하는 일 · 체온을 쫓는 포식자(Cause Network 의 마지막 마디 · FROZEN_REMAINS)   → 3층 몫 묶음 (후보 2)
          결정면 접촉이 몸에 하는 일(crystallizing)                                        → 3층 둘째
          판정 "아니오"                                                                  → GAP 회수
```

### design/Plan-Place-Observation-Surface — 자리를 관찰하는 표면

```text
덮음      C026~C028 (닫힘 — 확정 열하나 · 실주행 반영)
남은 것   없음 — 남은 결손은 Human 결정 ([CYCLES.md §3.3](CYCLES.md) 관찰)
```

### 실주행 GAP — 방들의 그래프 Q1 · Q2

실주행 판정에서 "아니오" 로 돌아온 것. 새 축 · 새 미지가 아니다. → 묶음 후보 3 이 받는다.

```text
Q1  깊이만으로는 "어디쯤인가" 가 잡히지 않는다 — 바닥 색 + 상단 문구로 "얼마나 깊이 왔는가" 를 알게 하려 했는데 Human 의 답은
    "지도도 없는데 어떻게 알 수 있다는 건지". 세계가 위치·방향을 어떤 형태로 줄지(지도 · 이정표 · 흔적 · 깊이 감각만)는 기획이 정한다   C001~C004
Q2  떨어지는 자리를 세계가 알리지 않는다 — 추락은 거목 내부 세계 북쪽 끝 (0, 38) 곁에서 저절로 일어나는데 Human 은 절벽에서
    "너무 가파르다" 만 보았다. 예고를 둘지(바닥의 갈라짐 · 소리 · 흔적) 그대로 둘지는 기획이 정한다                              C003
절벽 낙하(자리가 아닌 절벽에서 떨어지기)는 이 GAP 밖 → 원하면 별도 주입
```

### L7-Fairy-Growth-Combination — 요정 성장·조합 모델 (확정 · 3~7층에 배분)

```text
3층 몫    §9 편성 · §10 무대의 한 명 · §11 Entry/Leave/Off-field 의 자리 · §20 탐험에서도 교체 · §4~§5 Core 가 몸의 State 로 ·
          확정 4 · 5 · 10 · 11 · 위임 D1(이 몫) · D5                                                                   → 묶음 후보 2
4층 몫    §8 보석 = 성장 재료 · §17 Item = 행동을 바꾸는 장치 · §24 스탯 부착물 금지 · §16 · 확정 6(보석 여덟 후보) · 확정 10 · D2 · D4   → 4층
5층 몫    §13 정해진 Phase 없음 · World State 어휘 열하나(확정 8) · §14 창발 전투 · §16 여러 답 · §23 Monster · D3(지식 슬롯)        → 5층
6층 몫    §6 Class = Core 를 쓰는 방법 · §11 의 내용 · §5 · §19 탐험 조합 · D5(Off-field 시간 규모)                               → 6층
7층 몫    §1~§3 컬렉션 넷 · §7 Class Change(확정 7) · §8 순환 · §12 · §18 Knowledge(확정 9) · §21 Build · §22 · §25~§27 · 확정 2 · D1   → 7층
          보류된 계열 일곱                                                                                          → 컨텐츠 행(요정) — Human 이 하나씩
```

## 4. 어느 층에도 자리가 없는 것

원본이 "뒤 층" 이라고만 한 것 — 새 주입이 있어야 한다. 로드맵 8층은 화면이라 이것들의 층이 아니다. **9층 이상을 세울지, 3~7층 어딘가에 넣을지는 Human 결정** ([TODO.md](TODO.md) §1).

```text
다중 플레이어의 충분조건 — 분업 · 거래 · 정보 공유 · 가능성 공유    L0 ② · Concept §14 · Access
사회 — 경제 · 세력 · 협동 · 구조 · 미니게임 · 서사 · NPC 조우         Foundation §5.5
생물의 성별 · 번식 · 유전과 변이                                  Life
절벽 낙하                                                    Rooms GAP 밖
```

## 5. 다음 묶음 후보 — 순서대로

묶음은 문서가 아니다 — Human 이 기획서를 지목하면 AI 가 첫 Cycle 의 spec 머리에 묶음 블록을 쓰고 "C### 진행" 이 승인이다 ([Design-DesignAuthoringWorkflow §5~§7](../design/Design-DesignAuthoringWorkflow.md)).
번호는 예정이다 — 실제는 승인 때 "전 이름공간 최대 + 1" (지금 C032). "받는 것" 이 §3 의 "남은 것" 과 짝이다. 순서는 제안이고 Human 이 정한다.

| 순서 | 층 / 행 | 묶음 (가칭) | 기획서 | Goal (방향) | 받는 것 | 전제 | 그때 필요한 주입 · 미지 | Cycle | 상태 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | L2 Foundation | 방은 기억하고 때가 되면 내민다 | [L2-World-Foundation](../content/roadmap/L2-World-Foundation.md) §3~§5 · Time 2.6~2.7 | 방이 자기에게 일어난 일을 세고(기억 — C034 닫힘), 조건이 한 형으로 적혀 기억을 읽고, 방이 기회를 내밀고, 때가 있는 기회(Event — 비늘 채집)로 선다 | Foundation 전부 · Time 2.6~2.7 | — | 묶음 질문 Q1~Q9 (C035 spec) | C034~C037 | **진행 — C035 진행 중** ([CYCLES §3.4](CYCLES.md)) |
| 2 | **L3** · M8 | 한 명만 무대에 선다 | [L7](../content/roadmap/L7-Fairy-Growth-Combination.md) §9~§11 · §20 · §4~§5 · [Access](../content/roadmap/L2-World-Access.md) §14.1 · §15 · K12 · [M5](../content/roadmap/M5-FrostCanyon.md) | 요정 둘을 편성해 협곡을 지난다 — 추위가 무대의 몸을 깎고, 교체하면 다른 Core 의 몸이 서고, 문이 몸의 성질을 묻고(property Lock 의 첫 판정), 열을 쫓는 것이 따뜻한 몸만 본다 | L7 3층 몫 · Access property Lock 판정 · Life F10 첫 개체 · M5 남은 것 | 없음 — 2층 판정과 병행 (Human 결정) | 미지 M8 의 이름(Human) · 시작 편성 둘 · 온기 값 (질문으로) | 넷 안팎 | **쓸 수 있음** |
| 3 | L2 회수 | 온 길은 남고, 갈 길에는 단서가 있다 | [Region](../content/roadmap/L2-World-Region.md) §11 · §17 · Concept §19-07 · 실주행 GAP Q1 · Q2 | 관찰자가 방 전이를 기록하고 판에서 되읽는다 · 출구를 지목하면 종류와 방향이 선다 · 추락 자리의 땅이 예고한다 | Rooms GAP 둘 | 없음 — 지금 | 위치 감각의 형태(지도 · 이정표 · 흔적 · 깊이 감각만) · 추락 예고를 둘지 (질문으로) | 둘 | **쓸 수 있음** |
| 4 | L2 도구 | HundredRooms | [Tool-Scale §5](../content/roadmap/L2-World-Tool-Scale.md) | 미지 백 줄 → 방 백 개가 검사를 통과하고 관찰자가 열 곳을 걸어 흔적 → 원천 → 철 → 탄생지를 본다. 코드 diff 0 | Tool-Scale 의 HundredRooms | T3 ecology | 미지 백 줄의 **이름**(Human — 또는 초안기 후보를 Human 이 고른다) | 셋 안팎 | 기다림 — T3 ecology |
| 5 | L3 둘째 | (가칭) 몸이 알고 원한다 | 3층 나머지 절반 주입 + Subject-Decision · Autonomous-Behavior · Creature-Behavior | 몸이 무엇을 가지는가(피로 · 밤 · 결정면) · 생물이 무엇을 알고 어떻게 고르는가 · knowledge Lock · Discovery State | §3 의 "3층 둘째" 전부 | 후보 2 의 판정 | 3층 주입 + 미지: 무엇을 원하는지 아는 생물 하나 더 | 넷 안팎 | 기다림 |
| 6 | L4 | (가칭) 캐서 지니면 갈 수 있는 곳이 늘어난다 | 4층 주입 + Item-* · Inventory-D1 · Resource-Catalog · L7 §8 · §17 | 보석 하나를 캐서 지니고, 물건 하나가 같은 행동을 다른 행동으로 바꾼다 → 세 계통의 답(몸 · 소지 · 환경)이 한 문에 실제로 선다 | L7 4층 몫 · Material S10 · Access 4층 몫 · Region §12 | 후보 2 | 4층 주입 · D2 · D4 + 미지: 어디서 나는지 정해진 자원 하나 | 넷 안팎 | 기다림 — **Human 결정으로 앞당길 수 있다** |
| 7 | L5 | (가칭) 처음으로 맞서 이긴다 | 5층 주입 + Combat-* · Targeting · L7 §13 · §14 | 같은 적을 두 가지 상태 순서로 쓰러뜨린다 | L7 5층 몫 · Concept W6 · W7 · Time 접촉 | 후보 5 · 6 | 5층 주입 · D3 + 미지: 여러 해법을 허용하는 몬스터 하나 | — | 기다림 |
| 8 | L6 | (가칭) 한 Core 가 두 Class 로 | 6층 주입 + Skill-* · L7 §6 · §11 | 한 Core 가 두 Class 로 다른 Law 가 되고, Leave 가 남긴 장판이 다음 요정의 능력과 반응한다 | L7 6층 몫 | 후보 7 | 6층 주입 · D5 + Class 둘의 정식 이름 | — | 기다림 |
| 9 | L7 | (가칭) 보석 하나가 답을 바꾼다 | L7 전문 · Growth-Balance | 보석 하나로 Class 가 바뀌어 못 풀던 자리를 새 방법으로 푼다 · Knowledge 하나가 숨겨진 관계를 연다 · 미증명 ③ | L7 7층 몫 · Life F11 · Access 7층 몫 · Material S10 의 Class 요구 | 후보 8 · 6 | 7층 주입 · D1 + 미지: 보석 하나의 Region 과 원인 · Knowledge 하나 | — | 기다림 — **Human 결정으로 앞당길 수 있다** |
| — | 컨텐츠 행 | (대부분 묶음 없음) | `M<N>-*.md` | 보석 여덟 · 보류 계열 일곱 · 클래스 · 아이템 · 지식 · 지역 — 등급 A 면 작성기 · Spec · 검사 · Human 판정 / B 면 Cycle 하나 / C 면 기반 층 | §3 의 "컨텐츠 행" 전부 | Human 이 이름 · 종류 · 세계관 사실을 확정 | 미지 하나씩 | — | Human 이 이름을 줄 때마다 |

8층(화면)은 묶음이 없다 — 각 묶음의 Required 로 들어온다. 후보 1(진행 중) · 2 · 3 은 Reuse 가 겹치지 않아 **병행**할 수 있다 (PR 은 번호 순으로 합친다).
6층 · 9층 후보는 앞당겨도 되는 둘이다 — 앞당기면 질문이 많은 채로 서고, 앞 층의 실주행이 전제를 바꾸면 다시 손본다.

## 6. 코드에 아직 없는 축

design/ 에만 있는 것 — 그 층이 열릴 때 묶음이 세운다.

```text
전투 공식 · 막기 · 피해 종류 · 살펴봄 · 태도 · 장비 · 스킬 형태 · 성장 · 재료의 쓰임          4~7층
조건의 한 형 · 기회 · Event(Condition · Opportunity · 검사 ㊹ ㊺ ㊻) — 기억(history · ㊸ ㊼)은 코드에 있다        묶음 후보 1 (C035~C037)
편성 · 무대의 한 명 · 온기 · property Lock 의 판정(몸이 요구에 답하는 것)                        묶음 후보 2 · 4층(소지)
온 길의 기록 · 갈 길의 단서                                                                묶음 후보 3
```
