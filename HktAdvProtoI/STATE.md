# STATE — 지금 어디에 서 있는가

살아 있는 상태 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 새 세션은 [CLAUDE.md](CLAUDE.md)(규약)와 이 문서(상태)
둘을 읽고 시작한다. 경위는 git history 가 소유한다.

## 1. 다음에 할 일 — 레인

한 Cycle = 브랜치 `cycle/C###` = 세션 하나. **말할 것: "C006 진행"** — `advprotoi-cycle` 이 명세(spec.md) → 실현 → 마감을
이어 돌리고 UNRESOLVED · GAP 에서만 멈춘다. PR 은 번호 순으로 합친다. 병렬 규칙은
[Plan-Skill §4 항목 4](design/Plan-Skill-CycleExecutionWorkflow.md). 승인 게이트 없음 — Play 넷은 전부 승인돼 있다.

| 레인 | 지금 할 수 있는 것 | 기다리는 것 | 다음 |
|---|---|---|---|
| Land — [RoomBecomesLand](content/roadmap/play/RoomBecomesLand.md) | **C006** 땅이 막고 흐른다 — traversable(45°) + 이동 거절 + curve(강 · carve · wet) + 다리 point + 조건 area 와 safe-by 사유. 여기서 **세계가 처음 땅을 읽는다** — 규칙 표를 world 와 view 가 함께 읽을 자리를 그때 정한다 (지금은 content/view) | — | C007 (순차) |
| ENGINE A — [Plan-World-Authoring-Engine §5](design/Plan-World-Authoring-Engine.md) | C006·C007 이 쓸 나머지 — curve op · traversable 격자 · scatter/random · observe 래스터 (Cycle 아님 · 게임 명사 없음 · 분리 커밋) | — | C006 · C007 이 쓴다 |
| Rule — [RuleBoundRoom](content/roadmap/play/RuleBoundRoom.md) | 대기 | Land 닫힘 (순서: Rooms → Land → Rule — 규칙이 바꿀 area · traversable 을 Land 가 먼저 세운다) | C008 → C010 |
| Material — [RoomBearsMaterial](content/roadmap/play/RoomBearsMaterial.md) | 대기 — 다만 **Human 답 넷이 먼저다**: 재료의 이름 · 관찰 가능한 성질(U1·U2 → C011) · 회복의 시간 규모(U3 → C013) · 채취 단위(U4 → C012). 답이 없으면 C011 은 명세에서 멈춘다 | Rule 닫힘 (Region State 와 세계 과정이 서야 재료가 생애를 가진다) + U1·U2 | C011 → C014 |

## 2. 진행

단일 출처는 각 Play 의 Cycle Breakdown 체크박스다.

| Play | 증명 | Cycle | 상태 |
|---|---|---|---|
| RegionGraphRooms | 세계는 방들의 그래프다 | C001~C004 | **넷 다 닫힘** — Play Goal 실주행 확인이 남았다 (C004 TODO X-⑥) |
| RoomBecomesLand | 방이 땅이 된다 (백왕령) | C005~C007 | C005 닫힘 · **C006 다음** |
| RuleBoundRoom | 방은 규칙을 품는다 (환상의 미로 = Region 하나) | C008~C010 | 대기 |
| RoomBearsMaterial | 방이 재료를 낳는다 (거대 악마의 숲의 재료 생태) | C011~C014 | 대기 · UNRESOLVED 넷 |

**Human 판정 대기** — 각 Cycle 의 `TODO.md` (그림은 같은 폴더 `shots/`). `npm run dev` 로 직접 본다.
[C001](cycles/C001-region-graph-rooms/TODO.md) 8 · [C002](cycles/C002-many-exits/TODO.md) 8 ·
[C003](cycles/C003-small-door-big-room/TODO.md) 6 · [C004](cycles/C004-polish-is-data/TODO.md) 6 ·
[C005](cycles/C005-land-rises/TODO.md) 7.
RegionGraphRooms 가 닫혔으므로 **Play 전체 실주행**(백왕령 → 거목 → 추락 → 물길 → 귀환)이 그 위에 하나 더 있다.

## 3. 로드맵

```text
0 게임 방향   확정   L0-Game.md
1 세계의 문법  확정   L1-World-Grammar.md
2 세계 자체   열림   L2-World-Tool · L2-World-Concept · L2-World-Region · L2-World-Material → Play 넷으로 증명 중 (§2)
3 주체와 몸   미주입  ← 2층이 닫히면 다음.   4~7 (물건 · 대결 · 능력 · 성장) 미주입
```

컨텐츠 층의 미지 — M1 거대 악마의 숲 · M2 환상의 미로. 정식 이름 표는 [L2-World-Region §5.1](content/roadmap/L2-World-Region.md).
주입 순서는 [content/roadmap/README.md](content/roadmap/README.md).

## 4. 코드에 있는 것

```text
컨텐츠   채광 · 캐릭터 행동과 모션 · 세계/클라이언트 분리 · 다중 관찰자 · 이어짐 계량 · 몸 충돌 · 기본 전투 정책 ·
        시점과 그림 방향 · 개발 명령 표면 · 세계의 대답이 화면에 뜸(거절 문구) ·
        Region — 방 아홉(백왕령 civil · 숲 가장자리 outer · 숲 안쪽과 POI 셋과 거목 wild · 거목 내부와 심장 호수 deep)과
        Connector 열셋 · 중첩 둘 · WorldPosition = regionId + (x, z) · 건너기 Rule(거절 다섯) · 방으로 잘리는 투영 ·
        연결의 종류 일곱(길 · 오솔길 · 문 · 고개 · 들어감 · 추락 · 물길) · 요청 없이 일어나는 전이(추락) ·
        아직 짓지 않은 곳(경계 셋) · 백왕령의 능선(stamp 하나 → 높이·표면 색) · content/regions/ 데이터
기반    world-kernel · physics · view-kernel(키가 눈앞의 것을 고름 · 세계의 대답을 띄움 · 컴파일된 땅을 그림) · protocol-core ·
        world-authoring(Description · Graph · 중첩 · 경계 · 닿음 · 검사 일곱 · 지형 컴파일러 — height-field · surface · compile · hash)
도구    world:observe --graph (방 · Connector · 중첩 · 경계 · 검사 보고 — 읽기 전용)
없음    전투 공식 · 막기 · 피해 종류 · 살펴봄 · 지목 · 태도 · 소지품 · 장비 · 스킬 형태 · 성장 — design/ 에만 ·
        지형이 몸에 하는 일(traversable) · 강 · 조건 area — C006 이 세운다
미사용   기반에 있으나 컨텐츠가 아직 안 쓰는 것 — 겹침 표면 · 칸 띠 · 터치 입력 · 이펙트 레이어 · 지면 구역 · 세계 영속
```

## 5. 열린 부채

원본은 각 Cycle 의 `TODO.md`. 지금:
C003 — 촬영 하네스에서 자판 걸음이 몸을 옮기지 못한다(원인 미확정 — 실주행에서도 그런지 확인 필요).
C005 — 80×80 방의 바닥 채움 눈금이 삼각형 상한에 걸려 조금 굵다(뜬 거리 0.020) ·
컴파일을 켤 때마다 한다(굽는 도구 world:compile 은 C007).
Human 감사 — C005 의 표면 임계 15°(평지/비탈)는 문서 근거가 없는 기본형이다.

## 6. 실행

```text
npm run dev · npm test · npm run build · npm run boundary:check
npm run cycle:shot cycles/C###/shots.json     마감 촬영 (CHROMIUM_PATH 로 브라우저 지정 가능)
```
