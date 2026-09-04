# STATE — 지금 어디에 서 있는가

살아 있는 상태 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 새 세션은 [CLAUDE.md](CLAUDE.md)(규약)와 이 문서(상태)
둘을 읽고 시작한다. 경위는 git history 가 소유한다.

## 1. 다음에 할 일 — 레인

한 Cycle = 브랜치 `cycle/C###` = 세션 하나. **말할 것: "C027 진행"** — `advprotoi-cycle` 이 명세(spec.md) → 실현 → 마감을
이어 돌리고 UNRESOLVED · GAP 에서만 멈춘다. PR 은 번호 순으로 합친다. 병렬 규칙은
[Plan-Skill §4 항목 4](design/Plan-Skill-CycleExecutionWorkflow.md). 승인 게이트 없음 — Play 여덟 중 일곱이 승인돼 있다
(2층 여섯 + 컨텐츠 M5). Life 는 주입된 그대로다.

**다음 세션 인계 (design 은 여기까지)** — 2층 **세계 절반**의 기획은 닫혔다 (컨셉 · Region · 재료 · 시간 · 생명). 더 쌓지 않는다.
남은 일은 **Cycle 실주행**이다. 실주행 관찰(Material 원문 §7 단계 11)이 다음 기획(3층)의 입력이다.

**design 이 한 번 다시 열렸다 닫혔다 (아래 ①)** — C006·C008 실주행이 화면 결손을 돌려보냈다: 세계의 사실이
세계 위 글자와 상시 HUD 로 늘 선불되고(백왕령 한 화면에 글자 다섯 · 같은 조건이 두 자리에 중복), 못 지나간 사유는
2.2초 뒤 사라져 추적할 수 없다. 검토는 [design/Plan-Place-Observation-Surface.md](design/Plan-Place-Observation-Surface.md),
회수는 Play [RoomAnswersWhenAsked](content/roadmap/play/RoomAnswersWhenAsked.md) (승인 · C026~C028).
새 축도 새 미지도 아니다 — 이미 선 축들이 관찰되는지를 증명한다. **Observe 레인**으로 병행한다.

**도구 절반 2단계 — [Region 작성기](content/roadmap/L2-World-Tool-Scale.md) (확정 · 이 저장소 안에서 새로 짓는다).** "지역을 더할 때마다
2층 공정을 다시 타는가" 의 답: 아니다 — 새 지역은 세 등급(A 데이터만 · B 규칙 하나 · C 새 축)으로 가르고 대부분은 A 라서 도구가 쓴다.
순서 T1~T6 은 roadmap README §2.1. ENGINE 레인이라 Cycle 실주행과 **병행**한다 — 말할 것: **"T1 진행"** (브랜치 `engine/T1`).
design 이 다시 열리는 때는 둘 — ① 2층 Play 실주행에서 DESIGN GAP 이 돌아올 때 ② T6 이 서서 HundredRooms 를 쓸 때 · 2층이 닫혀 3층을 주입할 때.

| 레인 | 지금 할 수 있는 것 | 기다리는 것 | 다음 |
|---|---|---|---|
| Land — [RoomBecomesLand](content/roadmap/play/RoomBecomesLand.md) | 없음 — C005·C006·C007 **셋 다 닫힘**. 남은 것은 Human 판정과 Play Goal 실주행이다 | — | — |
| ENGINE A — [Plan-World-Authoring-Engine §5](design/Plan-World-Authoring-Engine.md) | C006·C007 이 쓸 나머지 — curve op · traversable 격자 · scatter/random · observe 래스터 (Cycle 아님 · 게임 명사 없음 · 분리 커밋) | — | C006 · C007 이 쓴다 |
| Rule — [RuleBoundRoom](content/roadmap/play/RuleBoundRoom.md) | **C009** 규칙을 이용해 닿는다 — 패턴 조건 activation(heartAccess) + 심장 Region + 돌아가기 명령. C008 은 닫혔다 | — | C010 (순차) |
| Observe — [RoomAnswersWhenAsked](content/roadmap/play/RoomAnswersWhenAsked.md) | **C027** 존재도 같은 자리에 선다 — 존재 지목(선택 유지 · 해제) + 프레임이 존재의 상태와 그 대상이 주는 행동·불가 사유를 진다 + 상시 HUD 를 내 몸으로 좁히고 깊이·안전한 이유·압력을 판으로 옮긴다(V5). C026 은 닫혔다 | — | C028 |
| Material — [RoomBearsMaterial](content/roadmap/play/RoomBearsMaterial.md) | 대기 (명세는 지금도 쓸 수 있다 — 이름·성질·상수는 Play 의 위임된 결정 D1~D4 에 있다) | Rule 닫힘 (Region State 와 세계 과정이 서야 재료가 생애를 가진다) | C011 → C014 |
| Time — [RoomNeverSame](content/roadmap/play/RoomNeverSame.md) | 대기 (상수 · 철 · 덧씌움 전부 확정 사항에 있다) | Material 닫힘 (철이 바꿀 원천과 흔적이 먼저) | C015 → C018 |
| Frost — [RoomOfAnotherKind](content/roadmap/play/RoomOfAnotherKind.md) (컨텐츠 M5) | 대기 | Time 닫힘 (재료 생태와 철을 다른 갈래에 두 번째로 쓴다 — 두 계약이 먼저 서야 한다) | C019 → C021 |
| Life — [RoomBearsLife](content/roadmap/play/RoomBearsLife.md) | 대기 (계약 · 확정 사항 · 상수는 [L2-World-Life.md](content/roadmap/L2-World-Life.md) 와 Play 에 있다) | Frost 닫힘 (탄생이 소비할 재료 · 탈 주기 · 대조할 갈래가 먼저 서야 한다) | C022 → C025 |
| ENGINE B — [Region 작성기](content/roadmap/L2-World-Tool-Scale.md) (도구 2단계) | **T1** 검사기 독립(`world:check` · JSON · npm test) → T2 RegionBrief 형(여덟 답 · 방 아홉 역기술) → T3 뼈대 생성기 절반. 게임 명사 없음 · 분리 커밋 · Cycle 과 병행 | T3 의 phases 는 C016 · ecology 는 C022 · T6 은 Life(C025) 닫힘 | T4 → T5 → T6 → Play HundredRooms |

## 2. 진행

단일 출처는 각 Play 의 Cycle Breakdown 체크박스다.

| Play | 증명 | Cycle | 상태 |
|---|---|---|---|
| RegionGraphRooms | 세계는 방들의 그래프다 | C001~C004 | **넷 다 닫힘** — Play Goal 실주행 확인이 남았다 (C004 TODO X-⑥) |
| RoomBecomesLand | 방이 땅이 된다 (백왕령) | C005~C007 | **셋 다 닫힘** — Play Goal 실주행 확인이 남았다 |
| RuleBoundRoom | 방은 규칙을 품는다 (환상의 미로 = Region 하나) | C008~C010 | C008 닫힘 · **C009 다음** |
| RoomBearsMaterial | 방이 재료를 낳는다 (거대 악마의 숲 = M3 재료 계통) | C011~C014 | 대기 |
| RoomNeverSame | 같은 방은 두 번 없다 (시계 · 네 철 · 소란 · 경로 = M4) | C015~C018 | 대기 |
| RoomOfAnotherKind | 다른 갈래의 방 (M5 빙결 협곡 · 컨텐츠) | C019~C021 | 대기 |
| RoomBearsLife | 방이 생명을 낳는다 (허물의 주인 = M6 붉은 알집 · 숲이 값으로 한 바퀴 돈다) | C022~C025 | 대기 |
| RoomAnswersWhenAsked | 물으면 답한다 (지목 · 대상 프레임 · 세계 위 글자 0) | C026~C028 | C026 닫힘 · **C027 다음** — 순서 밖 · 병행 |

**Human 판정 대기** — 각 Cycle 의 `TODO.md` (그림은 같은 폴더 `shots/`). `npm run dev` 로 직접 본다.
[C001](cycles/C001-region-graph-rooms/TODO.md) 8 · [C002](cycles/C002-many-exits/TODO.md) 8 ·
[C003](cycles/C003-small-door-big-room/TODO.md) 6 · [C004](cycles/C004-polish-is-data/TODO.md) 6 ·
[C005](cycles/C005-land-rises/TODO.md) 7 · [C006](cycles/C006-land-blocks-and-flows/TODO.md) ·
[C007](cycles/C007-observe-and-remake/TODO.md) 5 · [C008](cycles/C008-a-room-with-a-rule/TODO.md) 8 ·
[C026](cycles/C026-a-place-answers/TODO.md) 7.
RegionGraphRooms 가 닫혔으므로 **Play 전체 실주행**(백왕령 → 거목 → 추락 → 물길 → 귀환)이 그 위에 하나 더 있다.

## 3. 로드맵

```text
0 게임 방향   확정   L0-Game.md
1 세계의 문법  확정   L1-World-Grammar.md
2 세계 자체   열림   L2-World-Tool · Concept · Region · Material · Time · Life — 세계 절반 기획 닫힘 → Play 일곱으로 증명 중 (§2)
              도구 절반 2단계 L2-World-Tool-Scale(Region 작성기) 확정 — T1~T6 (README §2.1) · T1 다음
3 주체와 몸   미주입  ← 2층이 닫히면 다음.   4~7 (물건 · 대결 · 능력 · 성장) 미주입
```

컨텐츠 층의 미지 — M1 거대 악마의 숲 · M2 환상의 미로 · M3 숲의 재료 계통(생체 광석 · 광식충 허물 · 거목균) · M4 천공고래의 길 · M5 빙결 협곡 · M6 붉은 알집. 정식 이름 표는 [L2-World-Region §5.1](content/roadmap/L2-World-Region.md).
주입 순서는 [content/roadmap/README.md](content/roadmap/README.md).

## 4. 코드에 있는 것

```text
컨텐츠   채광 · 캐릭터 행동과 모션 · 세계/클라이언트 분리 · 다중 관찰자 · 이어짐 계량 · 몸 충돌 · 기본 전투 정책 ·
        시점과 그림 방향 · 개발 명령 표면 · 세계의 대답이 화면에 뜸(거절 문구) ·
        자리 지목(Alt+클릭) → 대상 프레임이 그 자리의 사실을 즉시 답함(방 · 깊이 · 표면 · 통행 · 막는 사유 ·
        규칙 방의 구역/길/압력) · 세계 위 상시 글자 0 · 방 이름은 진입 제목 ·
        Region — 방 아홉(백왕령 civil · 숲 가장자리 outer · 숲 안쪽과 POI 셋과 거목 wild · 거목 내부와 심장 호수 deep)과
        Connector 열셋 · 중첩 둘 · WorldPosition = regionId + (x, z) · 건너기 Rule(거절 다섯) · 방으로 잘리는 투영 ·
        연결의 종류 일곱(길 · 오솔길 · 문 · 고개 · 들어감 · 추락 · 물길) · 요청 없이 일어나는 전이(추락) ·
        아직 짓지 않은 곳(경계 셋) · 백왕령의 능선(stamp 하나 → 높이·표면 색) · content/regions/ 데이터
기반    world-kernel · physics · view-kernel(키가 눈앞의 것을 고름 · 세계의 대답을 띄움 · 컴파일된 땅을 그림 ·
        집기와 요청 사이의 입력 해석 정책 · 지목 강조 · 늘 떠 있는 판) · protocol-core ·
        world-authoring(Description · Graph · 중첩 · 경계 · 닿음 · 검사 일곱 · 지형 컴파일러 — height-field · surface · compile · hash)
도구    world:observe --graph (방 · Connector · 중첩 · 경계 · 검사 보고 — 읽기 전용)
없음    전투 공식 · 막기 · 피해 종류 · 살펴봄 · 존재 지목(자리만 섰다 — C027) · 태도 · 소지품 · 장비 ·
        스킬 형태 · 성장 — design/ 에만 ·
        지형이 몸에 하는 일(traversable) · 강 · 조건 area — C006 이 세운다
미사용   기반에 있으나 컨텐츠가 아직 안 쓰는 것 — 겹침 표면 · 칸 띠 · 터치 입력 · 이펙트 레이어 · 지면 구역 · 세계 영속
```

## 5. 열린 부채

원본은 각 Cycle 의 `TODO.md`. 지금:
C003 — 촬영 하네스에서 자판 걸음이 몸을 옮기지 못한다(원인 미확정 — 실주행에서도 그런지 확인 필요).
C005 — 80×80 방의 바닥 채움 눈금이 삼각형 상한에 걸려 조금 굵다(뜬 거리 0.020) ·
컴파일을 켤 때마다 한다(굽는 도구 world:compile 은 C007).
Human 감사 — C005 의 표면 임계 15°(평지/비탈)는 문서 근거가 없는 기본형이다.
화면 — 세계 위 상시 글자는 C026 이 걷었다. 남은 절반(상시 HUD 가 세계의 사실을 진다)은 C027 이 회수한다.
C008 부채 ⑦(몸 뒤의 정체 모를 반투명 판)은 화면을 만지는 그 레인이 먼저 집는다.
C026 — 판이 좌상단 HUD 를 가린다 · 존재 지목의 제목이 원시 id · Alt+클릭이라는 것을 화면이 말하지 않는다.
셋 다 **C027 이 닫는다** (원본은 [C026 TODO](cycles/C026-a-place-answers/TODO.md)).

## 6. 실행

```text
npm run dev · npm test · npm run build · npm run boundary:check
npm run cycle:shot cycles/C###/shots.json     마감 촬영 (CHROMIUM_PATH 로 브라우저 지정 가능)
```
