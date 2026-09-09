# STATE — 지금 어디에 서 있는가

살아 있는 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 경위는 git history 가 소유한다.

```text
목적    새 세션과 Human 이 이 한 장으로 "어느 트랙이 어디까지 왔고 다음이 무엇인지" 를 안다. 할 일의 큐는 TODO.md.
기능    §0 트랙과 순서(전체) · §1 design 관점 · §2 play 관점 · §3 cycle 관점 · §4 코드
상세    DESIGN.md(기획서 → Play 덮임 · 남은 것) · PLAYS.md(Play 마다 판정 질문 · 결정) · CYCLES.md(레인 · 부채) · ../codemap/(코드)
갱신    Play 승인 · Cycle 이 main 에 합쳐짐 · 실주행 판정 반영 — 그때마다 그 트랙 줄만 고친다. 닫힌 것은 지운다.
```

## 0. 트랙과 순서

트랙은 다섯이다. 각 트랙은 자기 줄의 순서대로 가고, 트랙 사이의 의존은 아래 그림이 말한다.

| 트랙 | 주체 | 지났다 | **지금** | 다음 | 그 다음 |
|---|---|---|---|---|---|
| 승인 · 판정 | Human | 2층 Play 다섯 판정 반영(Land · Rule · Material · Time · Observe) · Rooms 판정(GAP 둘) · Foundation 승인 | **승인 둘** — Stage("C037 진행") · Trail(질문 여섯) · **판정 셋** — Frost · Life · Access | Foundation 판정(C036 뒤) · Stage 판정(C040 뒤) · Trail 판정(C033 뒤) | 3층 둘째 Play 승인 · HundredRooms 승인 |
| 기획 | design | 2층 기획 전부(Play 아홉 + 회수 둘) · 3층 첫 Play 초안 · L7 배분 | **승인 반영 둘 대기** · HundredRooms 초안(이름은 Human) | 판정 "아니오" 의 GAP 회수 | 3층 둘째 Play(Stage 판정 + 주입 뒤) → 4 · 5 · 6 · 7층 Play |
| Cycle | cycle | C001~C031 (Play 아홉 닫힘) | **C034**(Foundation — 지금 돌 수 있다) · **C037**(Stage — 승인이 곧 시작) | C035 → C036 · C038 → C039 → C040 · C032 → C033(Trail 승인 뒤) | HundredRooms C041~ |
| ENGINE | engine | Region 작성기 T1~T6 | **T3 ecology 산출** · 갈래별 땅 묶음 templates | — | 큰 Region 이 올 때 chunk 적재 |
| 주입 | Human | L0 · L1 · L2 아홉 · M1~M8 · L7 원문 | (없음 — 2층 기획은 닫혔다) | 3층 나머지 절반(몸의 값 · 생물의 앎과 선택) — Stage 판정 뒤 | 4~7층은 각 층이 열릴 때 · 컨텐츠 행은 Human 이 이름을 줄 때마다 |

```text
순서 — 트랙 사이의 의존 (왼쪽이 먼저 · 병행은 나란히)

  Human 승인 Stage ──→ Cycle C037 → C038 → C039 → C040 ──→ Human 판정 Stage ──→ Human 주입 3층 나머지 ──→ design 3층 둘째 Play ──→ Cycle
  Human 승인 Trail ──→ Cycle C032 → C033 ──────────────────→ Human 판정 Trail ──→ Rooms 행 닫힘 ─┐
  (지금)           ──→ Cycle C034 → C035 → C036 ────────────→ Human 판정 Foundation ──────────────┼──→ 2층 닫힘
  Human 판정 Frost · Life · Access ──→ 예: 행 닫힘 / 아니오: design GAP 회수 ──→ Cycle ──→ 판정 ─┘
  ENGINE T3 ecology ──→ design HundredRooms 초안(Human 이름) ──→ Human 승인 ──→ Cycle C041~ (코드 diff 0)

  층의 순서   2층 닫힘 → 3층(Stage 판정 + 둘째 Play) → 4층 → 5층 → 6층 → 7층.  4층 · 7층 앞당김은 Human 결정 (TODO §1).
  병행 가능   Foundation ∥ Stage(C037 · C038) ∥ Trail ∥ ENGINE — PR 은 번호 순으로 합친다.
```

한 Cycle = 브랜치 `cycle/C###` = 세션 하나. **말할 것: "C034 진행"**(Foundation) · **"C037 진행"**(Stage — 이 말이 곧 Play 승인이다). `advprotoi-cycle` 이 명세 → 실현 → 마감을 이어 돌리고 UNRESOLVED · GAP 에서만 멈춘다.

## 1. design 관점 — 어떤 기획서가 얼마나 반영되었는가

상세 [DESIGN.md](DESIGN.md).

| 층 | 상태 | 한 줄 |
|---|---|---|
| 0 게임 방향 · 1 세계의 문법 | 확정 | 판단 기준 · 코드가 이미 그 위. L0 미증명 넷은 컨텐츠 행 · 3층 · 7층 · 실주행이 채운다 |
| 2 세계 자체 | **다음** | 기획 아홉 문서 전부 Play 로 덮였다 — 더 쌓을 기획 없음. 판정 셋 · Cycle 둘 · 도구 Play 하나가 남았다 |
| 3 주체와 몸 | **다음** (병행) | L7 의 3층 몫만 OneStandsOnStage 가 받았다 (승인 대기). 나머지 절반은 주입 대기 |
| 4 · 5 · 6 | 미주입 | L7 배분과 2층의 "남은 것" 이 각 층의 입력으로 쌓여 있다 (DESIGN §3) |
| 7 성장 | 미주입 (원문 확정) | L7 원문이 3~7층에 배분됐다 |
| 자리 없는 것 | Human 결정 | 다중 플레이어의 충분조건 · 사회 · 번식 · 절벽 낙하 — 9층인가 3~7층인가 (DESIGN §4) |

컨텐츠 행: M1 (Trail 승인 → 닫힘) · M2 · M3 · M4 닫힘 · **M5 · M6 · M7 판정 대기** · M8 승인 대기 (Stage C040).

## 2. play 관점 — Play 하나하나가 어디까지 왔는가

상세 [PLAYS.md](PLAYS.md) — 판정 질문 · 결정 대기는 거기.

| Play | Cycle | 상태 |
|---|---|---|
| RegionGraphRooms | C001~C004 | 판정 끝 — GAP 둘 → Trail |
| RoomBecomesLand · RuleBoundRoom · RoomBearsMaterial · RoomNeverSame · RoomAnswersWhenAsked | C005~C018 · C026~C028 | 닫힘 |
| RoomOfAnotherKind (M5) | C019~C021 | **판정 대기** — 질문 여섯 |
| RoomBearsLife (M6) | C022~C025 | **판정 대기** — 질문 여섯 |
| RoomAsksForPossibilities (M7) | C029~C031 | **판정 대기** — 질문 다섯 |
| RoomRemembersAndOffers (Foundation) | C034~C036 | **진행** — C034 다음 |
| TrailBehindClueAhead (회수) | C032~C033 | **승인 대기** — 질문 여섯 |
| OneStandsOnStage (3층 · M8) | C037~C040 | **승인 대기** — "C037 진행" |

## 3. cycle 관점 — 지금 돌 수 있는 것

상세 [CYCLES.md](CYCLES.md) — 레인 표 · 병렬 규칙 · 공학 부채.

| 레인 | 지금 | 기다리는 것 |
|---|---|---|
| Foundation | **C034** | — |
| Stage (3층) | **C037** · C038 | Human 승인 한 마디 |
| Trail | 명세까지 | Human 승인 |
| HundredRooms | — | Play 초안 · 승인 · 미지 백 줄의 이름 |
| ENGINE B | T3 ecology · templates | — |

## 4. 코드

코드에 있는 것은 [../codemap/](../codemap/README.md) — `ENGINE.md`(기반 모듈 API) · `CONTENT.md`(컨텐츠 코드 구조) · `README.md`(실행 · 검증 손잡이). 코드에 아직 없는 축은 [DESIGN.md §6](DESIGN.md).
