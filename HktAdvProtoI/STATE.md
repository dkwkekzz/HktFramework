# STATE — 지금 어디에 서 있는가

이 프로젝트의 **살아 있는 상태 문서**다. 새 세션은 [CLAUDE.md](CLAUDE.md)(변하지 않는 규약)와 이 문서
(지금의 상태) 둘을 읽고 시작한다.

**현재 상태만 둔다** — 완료·승인·날짜 경위를 본문에 쌓지 않는다 (CLAUDE.md 핵심 원칙 10). 닫힌 것은
지우고 다음 것으로 갈아 끼운다. 경위는 git history 와 `cycles/C###-*/` 산출물이 이미 소유한다.

## 1. 다음에 할 일

```text
말할 것    "다음 Cycle 진행"
도는 것    advprotoi-design ③ (다음 미완료 Cycle 의 00-cycle) → advprotoi-plan (01·02) → advprotoi-build (03·04·05 + 코드)
승인 게이트 없음 — Play 셋은 승인되어 있다. Human 질문이 새로 생기면 그때만 멈춘다
```

**다음 Cycle — C003 "작은 문, 큰 방, 돌아올 수 없는 길"**: 붉은 눈의 거목 → 내부 세계(중첩 · 80×80) →
추락 → 심장 호수 → 물길로 숲 안쪽의 **다른** 자리로
([content/roadmap/play/RegionGraphRooms.md](content/roadmap/play/RegionGraphRooms.md) Cycle Breakdown).
거목으로 가는 Connector 둘은 C002 가 이미 놓았다 — C003 은 RegionSpec 하나를 더하고 경계 목록에서
이름 하나를 빼면 그 문이 열린다.

병행 가능 — ENGINE 레인 A (지형 컴파일러 본체). 게임 명사가 없어 Cycle 을 막지 않는다
([design/Plan-World-Authoring-Engine.md](design/Plan-World-Authoring-Engine.md) §5). C008~C010 이 그것을 쓴다.

## 2. 진행 — Play 와 Cycle

진행의 **단일 출처는 각 Play 문서의 Cycle Breakdown 체크박스**다. 이 표는 그 요약이다.

| Play | 증명하는 것 | Cycle | 상태 |
|---|---|---|---|
| [RegionGraphRooms](content/roadmap/play/RegionGraphRooms.md) | 세계는 방들의 그래프다 | C001 ~ C004 | C001 · C002 닫힘 · **C003 다음** |
| [RuleBoundRoom](content/roadmap/play/RuleBoundRoom.md) | 방은 규칙을 품는다 (환상의 미로) | C005 ~ C007 | 대기 |
| [RoomBecomesLand](content/roadmap/play/RoomBecomesLand.md) | 방이 땅이 된다 (백왕령) | C008 ~ C010 | 대기 |

세 Play 가 닫히면 로드맵 2층이 닫힌다. 덮임 지도는 [play/README.md](content/roadmap/play/README.md).

**Human 판정 대기** — C001 의 실주행 관찰 X-①~⑧
([cycles/C001-region-graph-rooms/05-verification.md](cycles/C001-region-graph-rooms/05-verification.md) §3)
와 C002 의 X-①~⑨
([cycles/C002-many-exits/05-verification.md](cycles/C002-many-exits/05-verification.md) §3).
`npm run dev` 로 띄워 출구 표식까지 걸어가 `Q` 를 누르면 된다 — C002 는 백왕령의 고개 → 숲 가장자리 →
숲 안쪽의 닫힌 문 → 막다른 방 셋 한 바퀴다. 자동 시나리오는 C001 33 · C002 30 전부 PASS 다.

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
        Region — 방 여섯(백왕령 civil · 숲 가장자리 outer · 숲 안쪽과 POI 셋 wild)과 Connector 열.
        WorldPosition = regionId + (x, z) · 건너기 Rule(거절 여섯) · 방으로 잘리는 투영 ·
        연결의 종류 다섯(길 · 오솔길 · 문 · 고개 · 들어감) · 닫힌 문 · 아직 짓지 않은 곳(경계) ·
        content/regions/ 데이터
기반    world-kernel · physics · view-kernel · protocol-core ·
        world-authoring — Region Description · Graph · 경계 · 닿음 · 검사 여섯
        (세계 제작 도구의 첫 모듈. 컴파일러는 아직 없다)
```

컨텐츠에 **없는** 것 — 전투 공식 · 막기 · 피해 종류 · 관통 · 살펴봄 · 치명 · 지목 · 태도 · 선딜 ·
소지품 · 자리 · 장비 · 스킬 형태 · 지형(높이·표면·경사) · 성장. 전부 `design/` 에 기획으로만 있다.

기반에는 컨텐츠가 아직 쓰지 않는 능력이 남아 있다 — 겹침 표면 · 칸 띠 · 터치 입력 · 이펙트 레이어 ·
지면 구역 · 세계 영속. 쓰기 시작하는 것이 다음 Cycle 들의 일이다.

## 5. 열린 부채

Cycle 이 남긴 것 — 각 Cycle 의 `03-impl.md` "알려진 부채" 절이 원본이다.

```text
방 바닥이 지형 굴곡에 묻힐 수 있다   폴리곤 꼭짓점 넷만 지형에 드리운다 → 방이 평평해지는 C008
카메라가 방 크기에 맞지 않는다      80×80 방이 나오는 C003 에서 필요해진다
pass 색 표식이 전부 경계를 가리킨다  "고개 = 아직 없는 곳" 으로 읽힐 여지. 방이 지어지면 저절로 풀린다
거절 문구가 화면에 뜨지 않는다      HUD 프롬프트는 한 줄이고 늘 가용인 기본 스킬이 이긴다
                                (engine/view-kernel/hud/hud.ts). 세계는 거절하고 문구표도 있는데
                                잇는 자리가 없다 → C002 X-②·X-⑥ 이 이것 때문에 막혀 있다
```

## 6. 실행

```text
npm run dev            세계 + 클라이언트 (원클릭은 scripts/run.*)
npm test               경계 검사 + vitest 전체
npm run build          tsc --noEmit + vite build
npm run boundary:check engine/content 경계 (규칙 4 포함 — regions 는 world·view 를 부르지 않는다)
```
