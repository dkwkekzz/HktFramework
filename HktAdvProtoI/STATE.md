# STATE — 지금 어디에 서 있는가

살아 있는 상태 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 새 세션은 [CLAUDE.md](CLAUDE.md)(규약)와 이 문서(상태)
둘을 읽고 시작한다. 경위는 git history 가 소유한다.

## 1. 다음에 할 일 — 레인

한 Cycle = 브랜치 `cycle/C###` = 세션 하나. **말할 것: "C011 진행"** — `advprotoi-cycle` 이 명세(spec.md) → 실현 → 마감을
이어 돌리고 UNRESOLVED · GAP 에서만 멈춘다. PR 은 번호 순으로 합친다. 병렬 규칙은
[Plan-Skill §4 항목 4](design/Plan-Skill-CycleExecutionWorkflow.md). 승인 게이트 없음 — Play 여섯(2층 다섯 + 컨텐츠 M5)은 승인돼 있고, 일곱째(Life)는 주입된 그대로다.

**design 은 닫혀 있다** — 2층 세계 절반의 기획(컨셉 · Region · 재료 · 시간 · 생명)은 더 쌓지 않는다.
남은 일은 **Cycle 실주행**이다. 실주행 관찰(Material 원문 §7 단계 11)이 다음 기획(3층)의 입력이다.
design 이 다시 열리는 때는 둘 — ① 2층 Play 실주행에서 DESIGN GAP 이 돌아올 때 ② T6 이 서서 HundredRooms 를 쓸 때 · 2층이 닫혀 3층을 주입할 때.

| 레인 | 지금 할 수 있는 것 | 기다리는 것 | 다음 |
|---|---|---|---|
| Material — [RoomBearsMaterial](content/roadmap/play/RoomBearsMaterial.md) | **C011** 방이 재료를 낳는다 — 이름·성질·상수는 Play 의 위임된 결정 D1~D4 에 있다. Region State 와 세계 과정이 섰으므로(C008~C010) 재료가 생애를 가질 수 있다 | — | C012 → C014 |
| Time — [RoomNeverSame](content/roadmap/play/RoomNeverSame.md) | 대기 (상수 · 철 · 덧씌움 전부 확정 사항에 있다) | Material 닫힘 (철이 바꿀 원천과 흔적이 먼저) | C015 → C018 |
| Frost — [RoomOfAnotherKind](content/roadmap/play/RoomOfAnotherKind.md) (컨텐츠 M5) | 대기 | Time 닫힘 (재료 생태와 철을 다른 갈래에 두 번째로 쓴다) | C019 → C021 |
| Life — [RoomBearsLife](content/roadmap/play/RoomBearsLife.md) | 대기 (계약 · 확정 사항 · 상수는 [L2-World-Life.md](content/roadmap/L2-World-Life.md) 와 Play 에 있다) | Frost 닫힘 (탄생이 소비할 재료 · 탈 주기 · 대조할 갈래가 먼저) | C022 → C025 |
| ENGINE B — [Region 작성기](content/roadmap/L2-World-Tool-Scale.md) (도구 2단계) | **T1** 검사기 독립(`world:check` · JSON · npm test) → T2 RegionBrief 형(여덟 답 · 방 아홉 역기술) → T3 뼈대 생성기 절반. 게임 명사 없음 · 분리 커밋 · Cycle 과 **병행**한다 — 말할 것: **"T1 진행"** (브랜치 `engine/T1`) | T3 의 phases 는 C016 · ecology 는 C022 · T6 은 Life(C025) 닫힘 | T4 → T5 → T6 → Play HundredRooms |

## 2. 진행

단일 출처는 각 Play 의 Cycle Breakdown 체크박스다.

| Play | 증명 | Cycle | 상태 |
|---|---|---|---|
| RegionGraphRooms | 세계는 방들의 그래프다 | C001~C004 | **넷 다 닫힘** — Play Goal 실주행 확인이 남았다 |
| RoomBecomesLand | 방이 땅이 된다 (백왕령) | C005~C007 | **셋 다 닫힘** — Play Goal 실주행 확인이 남았다 |
| RuleBoundRoom | 방은 규칙을 품는다 (환상의 미로 = Region 하나) | C008~C010 | **셋 다 닫힘** — Play Goal 실주행 확인이 남았다 |
| RoomBearsMaterial | 방이 재료를 낳는다 (거대 악마의 숲 = M3 재료 계통) | C011~C014 | **C011 다음** |
| RoomNeverSame | 같은 방은 두 번 없다 (시계 · 네 철 · 소란 · 경로 = M4) | C015~C018 | 대기 |
| RoomOfAnotherKind | 다른 갈래의 방 (M5 빙결 협곡 · 컨텐츠) | C019~C021 | 대기 |
| RoomBearsLife | 방이 생명을 낳는다 (허물의 주인 = M6 붉은 알집) | C022~C025 | 대기 |

**Human 판정 대기 73** — 각 Cycle 의 `TODO.md` (그림은 같은 폴더 `shots/`). `npm run dev` 로 직접 본다.
[C001](cycles/C001-region-graph-rooms/TODO.md) 8 · [C002](cycles/C002-many-exits/TODO.md) 8 ·
[C003](cycles/C003-small-door-big-room/TODO.md) 6 · [C004](cycles/C004-polish-is-data/TODO.md) 6 ·
[C005](cycles/C005-land-rises/TODO.md) 7 · [C006](cycles/C006-land-blocks-and-flows/TODO.md) 9 ·
[C007](cycles/C007-observe-and-remake/TODO.md) 5 · [C008](cycles/C008-a-room-with-a-rule/TODO.md) 8 ·
[C009](cycles/C009-reach-by-the-rule/TODO.md) 9 · [C010](cycles/C010-one-world/TODO.md) 7.

Play 셋이 닫혔으므로 **Play 전체 실주행**이 그 위에 셋 더 있다 —
RegionGraphRooms(백왕령 → 거목 → 추락 → 물길 → 귀환) · RoomBecomesLand(능선에 막히고 강에 막히고 다리로 건넌다) ·
RuleBoundRoom(규칙을 관찰해 심장에 닿고, 두 번째 관찰자가 같은 미로를 본다).

## 3. 로드맵

```text
0 게임 방향   확정   L0-Game.md
1 세계의 문법  확정   L1-World-Grammar.md
2 세계 자체   열림   L2-World-Tool · Concept · Region · Material · Time · Life — 세계 절반 기획 닫힘 → Play 일곱 중 셋 닫힘 (§2)
              도구 절반 2단계 L2-World-Tool-Scale(Region 작성기) 확정 — T1~T6 (README §2.1) · T1 다음
3 주체와 몸   미주입  ← 2층이 닫히면 다음.   4~7 (물건 · 대결 · 능력 · 성장) 미주입
```

컨텐츠 층의 미지 — M1 거대 악마의 숲 · M2 환상의 미로 · M3 숲의 재료 계통(생체 광석 · 광식충 허물 · 거목균) · M4 천공고래의 길 · M5 빙결 협곡 · M6 붉은 알집. 정식 이름 표는 [L2-World-Region §5.1](content/roadmap/L2-World-Region.md).
주입 순서는 [content/roadmap/README.md](content/roadmap/README.md).

## 4. 코드에 있는 것

```text
컨텐츠   채광 · 캐릭터 행동과 모션 · 세계/클라이언트 분리 · 다중 관찰자 · 이어짐 계량 · 몸 충돌 · 기본 전투 정책 ·
        시점과 그림 방향 · 개발 명령 표면 · 세계의 대답이 화면에 뜸(거절 문구) ·
        Region — 방 열하나 · Connector 열여섯 · 중첩 셋 · 경계 셋 · WorldPosition = regionId + (x, z) ·
        건너기 Rule(거절 여섯) · 방으로 잘리는 투영 · 연결의 종류 일곱(길 · 오솔길 · 문 · 고개 · 들어감 · 추락 · 물길) ·
        요청 없이 일어나는 전이(추락) · 아직 짓지 않은 곳(경계 셋) ·
        땅 — 백왕령의 능선과 강(막힘 · 다리 하나 · 젖은 강가) · 숲 가장자리의 분지 · 조건 area 와 "왜 여기가 안전한가" ·
        규칙 — **방이 규칙을 품는다**(환상의 미로): Region State(pattern · pressure · rearrangedAt · 저장된다) ·
        걸음이 압력이 되고 넘치면 통로가 재배열된다 · 닫힌 통로가 몸을 막는다 · 구역 넷과 식물 이름표 ·
        **방의 State 가 문을 연다**(C009): Connector 활성 조건 · 미로의 심장(중첩 자식) · 비상 자리로 돌아가기 ·
        **그리고 그 전부가 세계에 하나다** — 관찰자가 둘이어도 같은 값이고, 떠나도 남는다 (C010 이 쟀다) ·
        content/regions/ 데이터
기반    world-kernel · physics · view-kernel(키가 눈앞의 것을 고름 · 세계의 대답을 띄움 · 컴파일된 땅을 그림 ·
        landmark billboard) · protocol-core ·
        world-authoring(Description · Graph · 중첩 · 경계 · 닿음 · 검사 일곱 · 지형 컴파일러 — height-field ·
        curve/carve · surface · traversable 격자 · areas/points 산출 · tagsAt · compile · hash · observe 래스터)
도구    world:observe (--graph · 방 하나의 높이·표면·통행·의미 PNG 다섯 + 보고 · 읽기 전용) · world:compile · world:shot ·
        cycle:shot (마감 촬영 · 창 둘로 관찰자 둘) ·
        검증용 손잡이 HKT_SPAWN · HKT_SPAWN_REGION · HKT_NPCS · HKT_REGION_PATTERN · HKT_NPC_REGION
없음    전투 공식 · 막기 · 피해 종류 · 살펴봄 · 지목 · 태도 · 소지품 · 장비 · 스킬 형태 · 성장 — design/ 에만 ·
        재료의 생애 · 세계의 철 · 생명의 탄생 — Play 넷이 아직 남았다
미사용   기반에 있으나 컨텐츠가 아직 안 쓰는 것 — 겹침 표면 · 칸 띠 · 터치 입력 · 이펙트 레이어 · 지면 구역 · 세계 영속
```

## 5. 열린 부채

원본은 각 Cycle 의 `TODO.md` — 여기는 **여러 Cycle 을 건너 살아 있는 것**만 가리킨다.

```text
컴파일을 켤 때마다 두 번 한다 (세계 한 번 · 관찰자 한 번)      C005 → C006 ④ → C007 ③
이동 **진행**은 traversable 을 보지 않는다 (막는 것은 요청 판정뿐)  C006 ③
잠깐 뜨는 문구를 촬영이 잡지 못한다 (토스트는 HUD 훑기에 안 걸린다)  C006 ① → C008 ① → C009 ③④
몸 뒤의 정체 모를 반투명 판 — 원인 미확정, 추측으로 손대지 않았다   C008 ⑦ → C009 ⑤ (화면을 만지는 레인이 먼저 집을 자리)
재배열이 길을 **끊지 않는다** (바꾸는 것은 "갈 수 있는가" 가 아니라 "어느 길로 가는가")  C008 ② — X-⑥ 판정이 정한다
심장은 P2 가 아니면 나올 수 없고 "돌아가기" 가 꺼내 주지 않는다     C009 ①② — **C010 에서 관찰자가 둘이 되면 실제로 겪힌다**
검사 ①②④ 는 아직 빈 검사다 (resource · hazard · phenomenon layer 가 없다)  C007 ④ — 컨텐츠 층 주입이 채운다
observers.present 가 방 단위가 아니라 **세계 전체**의 수다 — 다른 방의 둘도 서로를 2 로 센다  C010 ③ (Human 이 정할 자리)
촬영이 사람의 걸음과 떠남을 밀지 못한다 — 캔버스 둘이면 이어짐의 왕복이 수십 초로 밀린다  C010 ①②
Human 감사 — C005 의 표면 임계 15°(평지/비탈)는 문서 근거가 없는 기본형이다
```

## 6. 실행

```text
npm run dev · npm test · npm run build · npm run boundary:check
npm run cycle:shot cycles/C###/shots.json     마감 촬영 (CHROMIUM_PATH 로 브라우저 지정 가능)
npm run world:observe -- <방> --report        방 하나의 땅을 읽는다 (읽기 전용)
```
