# STATE — 지금 어디에 서 있는가

살아 있는 상태 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 새 세션은 [CLAUDE.md](CLAUDE.md)(규약)와 이 문서(상태)
둘을 읽고 시작한다. 경위는 git history 가 소유한다.

## 1. 다음에 할 일 — 레인

한 Cycle = 브랜치 `cycle/C###` = 세션 하나. **말할 것: "C003 진행"** — `advprotoi-cycle` 이 명세(spec.md) → 실현 → 마감을
이어 돌리고 UNRESOLVED · GAP 에서만 멈춘다. PR 은 번호 순으로 합친다. 병렬 규칙은
[Plan-Skill §4 항목 4](design/Plan-Skill-CycleExecutionWorkflow.md). 승인 게이트 없음 — Play 셋은 승인돼 있다.

| 레인 | 지금 할 수 있는 것 | 기다리는 것 | 다음 |
|---|---|---|---|
| Rooms — [RegionGraphRooms](content/roadmap/play/RegionGraphRooms.md) | **C003** 작은 문, 큰 방, 돌아올 수 없는 길 — 거목 → 내부 세계(중첩 · 80×80) → 추락 → 심장 호수 → 물길. 거목 쪽 Connector 둘은 C002 가 놓았다: RegionSpec 하나를 더하고 경계 목록에서 이름 하나를 빼면 열린다 | — | C004 (순차) |
| Rule — [RuleBoundRoom](content/roadmap/play/RuleBoundRoom.md) | C005 (LOCKED Connector 의미(W7)가 섰다 — 그 위에 activation(W12)을 얹는다) | — (미로 입구인 고대 문을 여는 것은 C004) | C006 → C007 |
| ENGINE A — [Plan-World-Authoring-Engine §5](design/Plan-World-Authoring-Engine.md) | 지형 컴파일러 E6~E8 (Cycle 아님 · 게임 명사 없음 · 분리 커밋) | — | C008 이 쓴다 |
| Land — [RoomBecomesLand](content/roadmap/play/RoomBecomesLand.md) | 대기 | ENGINE A + Rule 닫힘 (승인된 순서: Rooms → Rule → Land) | C008 → C010 |

Human 결정 (승인된 순서에 닿는 것 — 정하면 표를 고친다):
① C005 build 를 C002 와 겹칠지 — 입구 없이 하네스·개발 명령으로만 미로에 들어가는 상태를 허용하는가
② C008 을 Rule 앞으로 당길지

## 2. 진행

단일 출처는 각 Play 의 Cycle Breakdown 체크박스다.

| Play | 증명 | Cycle | 상태 |
|---|---|---|---|
| RegionGraphRooms | 세계는 방들의 그래프다 | C001~C004 | C001 · C002 닫힘 · **C003 다음** |
| RuleBoundRoom | 방은 규칙을 품는다 (환상의 미로) | C005~C007 | C005 가능 |
| RoomBecomesLand | 방이 땅이 된다 (백왕령) | C008~C010 | 대기 |

**Human 판정 대기** — C001 X-①~⑧ · C002 X-①~⑧: 각 Cycle 의 `TODO.md`
([C001](cycles/C001-region-graph-rooms/TODO.md) · [C002](cycles/C002-many-exits/TODO.md), 그림은 같은 폴더 `shots/`).
직접 보려면 `npm run dev` → 출구 표식까지 걸어가 `Q`.

## 3. 로드맵

```text
0 게임 방향   확정   L0-Game.md
1 세계의 문법  확정   L1-World-Grammar.md
2 세계 자체   열림   L2-World-Tool · L2-World-Concept · L2-World-Region → Play 셋으로 증명 중 (§2)
3 주체와 몸   미주입  ← 2층이 닫히면 다음.   4~7 (물건 · 대결 · 능력 · 성장) 미주입
```

컨텐츠 층의 미지 — M1 거대 악마의 숲 · M2 환상의 미로. 정식 이름 표는 [L2-World-Region §5.1](content/roadmap/L2-World-Region.md).
주입 순서는 [content/roadmap/README.md](content/roadmap/README.md).

## 4. 코드에 있는 것

```text
컨텐츠   채광 · 캐릭터 행동과 모션 · 세계/클라이언트 분리 · 다중 관찰자 · 이어짐 계량 · 몸 충돌 · 기본 전투 정책 ·
        시점과 그림 방향 · 개발 명령 표면 · 세계의 대답이 화면에 뜸(거절 문구) ·
        Region — 방 여섯(백왕령 civil · 숲 가장자리 outer · 숲 안쪽과 POI 셋 wild)과 Connector 열 ·
        WorldPosition = regionId + (x, z) · 건너기 Rule(거절 여섯) · 방으로 잘리는 투영 ·
        연결의 종류 다섯(길 · 오솔길 · 문 · 고개 · 들어감) · 닫힌 문 · 아직 짓지 않은 곳(경계) · content/regions/ 데이터
기반    world-kernel · physics · view-kernel(키가 눈앞의 것을 고름 · 세계의 대답을 띄움) · protocol-core ·
        world-authoring(Description · Graph · 경계 · 닿음 · 검사 여섯 — 컴파일러는 아직 없다)
없음    전투 공식 · 막기 · 피해 종류 · 살펴봄 · 지목 · 태도 · 소지품 · 장비 · 스킬 형태 · 지형(높이·표면·경사) · 성장 — design/ 에만
미사용   기반에 있으나 컨텐츠가 아직 안 쓰는 것 — 겹침 표면 · 칸 띠 · 터치 입력 · 이펙트 레이어 · 지면 구역 · 세계 영속
```

## 5. 열린 부채

원본은 각 Cycle 의 `TODO.md`. 지금:
C001 — 방 바닥이 지형 굴곡에 묻힘(→ C008).
C002 — 카메라가 방 크기에 안 맞음(40×40 도 한 화면에 안 들어온다 → C003) ·
`pass` 색 표식이 지금은 전부 경계를 가리킨다(방이 지어지면 저절로 풀린다).

## 6. 실행

```text
npm run dev · npm test · npm run build · npm run boundary:check
npm run cycle:shot cycles/C###/shots.json     마감 촬영 (CHROMIUM_PATH 로 브라우저 지정 가능)
```
