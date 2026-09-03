# STATE — 지금 어디에 서 있는가

이 프로젝트의 **살아 있는 상태 문서**다. 새 세션은 [CLAUDE.md](CLAUDE.md)(변하지 않는 규약)와 이 문서
(지금의 상태) 둘을 읽고 시작한다.

**현재 상태만 둔다** — 완료·승인·날짜 경위를 본문에 쌓지 않는다 (CLAUDE.md 핵심 원칙 10). 닫힌 것은
지우고 다음 것으로 갈아 끼운다. 경위는 git history 가 이미 소유한다 (`cycles/C###-*/` 에는 spec 과 TODO 만 있다).

## 1. 다음에 할 일

```text
말할 것    "다음 Cycle 진행"
도는 것    advprotoi-design ③ (다음 미완료 Cycle 의 00-cycle) → advprotoi-plan (01·02) → advprotoi-build (03·04·05 + 코드)
승인 게이트 없음 — Play 셋은 승인되어 있다. Human 질문이 새로 생기면 그때만 멈춘다
```

**다음 Cycle — C002 "출구는 여럿, 목적지는 모른다"**: 숲 안쪽 · POI 방 셋 · 닫힌 고대 문 ·
붉은 황야/얼음 협곡 쪽 Connector. 출구는 종류만 보이고 닫힌 문은 거절한다
([content/roadmap/play/RegionGraphRooms.md](content/roadmap/play/RegionGraphRooms.md) Cycle Breakdown).

병행 가능 — ENGINE 레인 A (지형 컴파일러 본체). 게임 명사가 없어 Cycle 을 막지 않는다
([design/Plan-World-Authoring-Engine.md](design/Plan-World-Authoring-Engine.md) §5). C008~C010 이 그것을 쓴다.

## 2. 진행 — Play 와 Cycle

진행의 **단일 출처는 각 Play 문서의 Cycle Breakdown 체크박스**다. 이 표는 그 요약이다.

| Play | 증명하는 것 | Cycle | 상태 |
|---|---|---|---|
| [RegionGraphRooms](content/roadmap/play/RegionGraphRooms.md) | 세계는 방들의 그래프다 | C001 ~ C004 | C001 닫힘 · **C002 다음** |
| [RuleBoundRoom](content/roadmap/play/RuleBoundRoom.md) | 방은 규칙을 품는다 (환상의 미로) | C005 ~ C007 | 대기 |
| [RoomBecomesLand](content/roadmap/play/RoomBecomesLand.md) | 방이 땅이 된다 (백왕령) | C008 ~ C010 | 대기 |

세 Play 가 닫히면 로드맵 2층이 닫힌다. 덮임 지도는 [play/README.md](content/roadmap/play/README.md).

**Human 판정 대기** — C001 의 실주행 관찰 X-①~⑧
([cycles/C001-region-graph-rooms/TODO.md](cycles/C001-region-graph-rooms/TODO.md)).
`npm run dev` 로 띄워 북쪽 표식까지 걸어가 `Q` 를 누르면 된다. 자동 시나리오 33 은 전부 PASS 다.

## 3. 로드맵 — 무엇이 주입되었나

층 순서와 재료는 [content/roadmap/README.md](content/roadmap/README.md) 가 소유한다.

```text
0 게임 방향     확정   L0-Game.md
1 세계의 문법   확정   L1-World-Grammar.md
2 세계 자체     열림   도구 L2-World-Tool.md · 컨셉 L2-World-Concept.md · 구성 L2-World-Region.md
                      → Play 셋으로 증명 중 (§2)
3 주체와 몸     미주입  ← 2층이 닫히면 다음
4~7             미주입  물건 · 대결 · 능력 · 성장
```

컨텐츠 층의 미지 — M1 거대 악마의 숲(RegionGraphRooms) · M2 환상의 미로(RuleBoundRoom).
정식 이름 표는 [L2-World-Region.md](content/roadmap/L2-World-Region.md) §5.1.

## 4. 코드에 지금 있는 것

```text
컨텐츠   채광 · 캐릭터 행동과 모션 · 세계/클라이언트 분리 · 다중 관찰자 · 이어짐 계량 · 몸 충돌 ·
        기본 전투 정책 · 시점과 그림 방향 · 개발 명령 표면과 세계의 대답 ·
        Region — 방 둘(백왕령 civil · 숲 가장자리 outer)과 길 하나. WorldPosition = regionId + (x, z) ·
        건너기 Rule · 방으로 잘리는 투영 · content/regions/ 데이터
기반    world-kernel · physics · view-kernel · protocol-core ·
        world-authoring — Region Description · Graph · 검사 (세계 제작 도구의 첫 모듈. 컴파일러는 아직 없다)
```

컨텐츠에 **없는** 것 — 전투 공식 · 막기 · 피해 종류 · 관통 · 살펴봄 · 치명 · 지목 · 태도 · 선딜 ·
소지품 · 자리 · 장비 · 스킬 형태 · 지형(높이·표면·경사) · 성장. 전부 `design/` 에 기획으로만 있다.

기반에는 컨텐츠가 아직 쓰지 않는 능력이 남아 있다 — 겹침 표면 · 칸 띠 · 터치 입력 · 이펙트 레이어 ·
지면 구역 · 세계 영속. 쓰기 시작하는 것이 다음 Cycle 들의 일이다.

## 5. 열린 부채

Cycle 이 남긴 것 — 각 Cycle 의 `TODO.md` 가 원본이다.

```text
wrong-region 사유의 플레이 실측     C001 은 Connector 하나뿐이라 하네스로만 확인했다 → C002
방 바닥이 지형 굴곡에 묻힐 수 있다   폴리곤 꼭짓점 넷만 지형에 드리운다 → 방이 평평해지는 C008
카메라가 방 크기에 맞지 않는다      80×80 방이 나오는 C003 에서 필요해진다
```

## 6. 실행

```text
npm run dev            세계 + 클라이언트 (원클릭은 scripts/run.*)
npm test               경계 검사 + vitest 전체
npm run build          tsc --noEmit + vite build
npm run boundary:check engine/content 경계 (규칙 4 포함 — regions 는 world·view 를 부르지 않는다)
```
