# C026 — 자리를 지목하면 그 자리의 사실이 선다

```text
CYCLE          C026-a-place-answers
SOURCE         content/roadmap/play/RoomAnswersWhenAsked.md §2 Play Goal · §4 Breath(조용함 → 눈에 띔 →
               궁금함 → 지목 → 대답) · §5.1 · §5.2 · §5.3 · §5.4 · §5.5 · §5.6 · §6 V1~V4 · E1~E3 ·
               확정 사항 1·2·3·4·7·9·10·11·12
               (근거: design/Plan-Place-Observation-Surface.md §1 측정 · §4 지목 판정 · §5 세 자리 규약 ·
                content/roadmap/L2-World-Region.md §17 규칙 가독성·탐험 구조 ·
                content/roadmap/L2-World-Concept.md W8 세계가 질문을 만든다 ·
                design/Design-Targeting-R0.md §5.2 Pointer Intent Policy)
SELECTED_FROM  Play Cycle Breakdown — "C026 — 자리를 지목하면 그 자리의 사실이 선다"
```

**확장 Cycle** — C001~C008 의 State/Rule 위에 더한다. 복사·재작성하지 않는다.

이 Cycle 은 **세계를 한 자리도 바꾸지 않는다.** WorldState 도, 관찰 계약(봉투)도, STATE_VERSION 도,
요청의 종류도 늘지 않는다. 바뀌는 것은 **화면이 무엇을 언제 말하는가**와 **클릭이 무엇을 뜻하는가**뿐이다.
그래서 이 Cycle 의 W(World) 레인은 비어 있다 — `content/world/` 는 한 줄도 열지 않는다.

번호가 C022 가 아닌 이유: C022~C025 는 [RoomBearsLife](../../content/roadmap/play/RoomBearsLife.md) 의 것이다.

## Playable Goal

관찰자가 땅의 한 자리를 눌러 **지목한다.** 화면 중앙 상단에 그 자리가 서고 —
어느 방인가 · 땅이 어떤가 · 지날 수 있는가, 못 지난다면 왜 · 무엇이 걸려 있는가 — 가 **기다림 없이** 읽힌다.
**걸어가 거절당하기 전에** 못 지나가는 이유를 안다. 그리고 세계 위에 늘 떠 있던 글자는 하나도 없다.

## Experience Intent

```text
Start   화면이 이미 다 적어 두었다. 읽을 것은 많고 궁금할 것은 없다.
End     화면은 조용하다. 저 바닥만 색이 다르다 — 눌러 본다. 그 자리가 판에 서고 답이 즉시 뜬다:
        젖은 땅이고, 지날 수 없고, 이유는 이것이다.
```

Play 의 Breath 중 **조용함 → 눈에 띔 → 궁금함 → 지목 → 대답** 구간을 만든다.
**이해 · 되물음**(답이 남는 것)은 C028 이고, **존재를 같은 자리에서 보는 것**은 C027 이다.

## World Change

```text
없음.

WorldState · Rule · 관찰 계약(봉투) · STATE_VERSION · interaction 목록 — 어느 것도 늘지 않는다.
이 Cycle 이 화면에 세우는 사실은 전부 이미 있다 (확정 12):
  ① 땅의 사실   관찰자가 자기 content/regions 를 **세계와 같은 규칙**으로 컴파일해 읽는다.
               세계도 같은 함수로 판정한다 (content/world/semantic/terrain.ts 와 같은
               engine/world-authoring 의 isTraversableAt · blockedReasonAt · tagsAt)
  ② 세계의 사실 방 · 깊이 · 규칙을 품은 방의 State 는 **이미 봉투에 매 tick 실려 온다**
               (region · region.state · hud 의 region.depth)
그러므로 지목은 세계에 아무 요청도 보내지 않는다 — 패킷도 왕복도 0 이다.
```

## Observable Result

```text
① 땅을 누르면 화면 중앙 상단에 판이 선다 — 무엇을 지목했는지가 제목이고 그 자리의 사실이 줄로 서 있다.
   **기다림이 없다** (같은 프레임에 찬다)
② 그 자리가 세계 안에서 표시된다 — 내가 누른 것과 판이 말하는 것이 같은 자리다
③ 못 지나가는 자리(급경사 · 강 · 닫힌 통로)를 누르면 **걸어가기 전에** 사유가 읽힌다.
   실제로 걸어가면 같은 사유로 거절된다 — 두 답이 다르지 않다
④ 규칙 없는 방을 지목하면 규칙 줄이 **아예 없다.** 0 으로 지어내지 않는다
⑤ 방에 들어서면 이름이 **한 번 지나가고** 사라진다. 그 뒤 세계 위에는 이름표가 없다 —
   백왕령의 조건 셋과 도시, 미로의 구역과 통로는 색과 경계로만 갈린다 (글자 다섯 → 0)
⑥ 대상이 없으면 판이 없다. Escape 로 풀면 판이 사라지고, 방을 옮겨도 풀린다.
   판이 서 있는 동안에도 자판으로 걸을 수 있다
⑦ 클릭으로 하던 일(빈 땅으로 이동 · 광맥 채굴 · 출구 건너기)은 C008 까지와 **결과가 같다**
```

## Reuse

### Existing (그대로 쓴다)

```text
컴파일과 규칙 표 (content/view/terrain-presentation 이 이미 compileRegion · tagsAt 을 쓴다) ·
engine/world-authoring 의 질의 셋 (isTraversableAt · blockedReasonAt · tagsAt) ·
봉투의 region { id, hash, state? } · hud 의 region.depth · standingConditions ·
renderer.pickEntity · pickGround · interaction-choice(거리로 뜻을 고른다) · code-text 문구 표 ·
SceneGroundZone(색 · 경계 · 맥동) · SceneSlotBar(늘 떠 있는 원소의 선례) · notice · 다중 관찰자 · 영속
```

### Added (이 Cycle 이 세운다)

```text
Engine   E1 입력 해석 정책 주입 (집기 → 요청 변환을 밖으로 뺀다) ·
         E2 지목 강조 렌더 지시 · E3 늘 떠 있는 판 (자판을 잡지 않는다)
View     지목을 쥐는 것 (관찰자 소유 · app 조립) · 자리 읽기(내 Description 에서) ·
         대상 프레임의 결정 표 · 지목 표식 · 방 이름 진입 제목 · zone label 을 걷는 것
World    없음
Protocol 없음
Data     없음 — content/regions 는 한 줄도 바뀌지 않는다
```

## Out of Scope

```text
존재를 지목하는 것 · 그 대상이 주는 행동 목록 · 상시 HUD 를 내 몸으로 좁히는 것(V5)      C027
거절 사유·알림이 판에 기록으로 남는 것(V6)                                              C028
관찰이 대가를 갖거나 가려지는 것 · 그때 필요한 세계 판정과 봉투의 답 자리(ENGINE GAP)      3층
적대 · Tab 순환 · 공격 의도 · CurrentTarget 을 세계가 쥐는 것                            5층 (TG)
hover 로 미리 알려 주는 것                                                              이 Play 밖 (확정 11)
지목한 자리로 길을 찾아 걸어가는 것                                                      없음 — 이동은 지금 그대로다
```

## SPEC

```text
SPEC-001  지목하면 판이 선다
          조건   관찰자가 자기 방 안의 한 점을 지목한다
          기대   그 자리를 제목으로 하는 판 하나가 서고, 그 점의 사실이 줄로 실린다
          경계   지목하지 않았으면 판이 없다. 지목을 풀면 사라진다. 판은 자판을 잡지 않는다

SPEC-002  땅이 어떤지 말한다
          조건   평지 · 비탈 · 급경사 · 젖은 자리를 각각 지목한다
          기대   그 점의 표면 태그와 **지날 수 있는가**가 실리고, 지날 수 없으면 사유 코드가 함께 실린다
          경계   이동 규칙이 그 점에 대해 내리는 판정과 **같다** — 지목해서 얻은 답과 걸어가서 얻은
                답이 다르면 안 된다 (둘이 engine/world-authoring 의 같은 함수를 같은 데이터로 부른다)

SPEC-003  무엇이 걸렸는지 말한다
          조건   조건 area · 도시 area · 미로의 구역 · 통로 위의 점을 지목한다
          기대   그 점에 걸린 area 태그들이 실린다. 여럿이면 전부 실린다 — 하나로 줄이지 않는다
                (C006 의 safe-by 와 같은 규율). 통로면 지금 열려 있는지도 함께 실린다
          경계   아무 area 에도 걸리지 않은 점이면 그 목록이 비어 있다

SPEC-004  규칙을 품은 방이면 그 State 도 말한다
          조건   미로 안의 점을 지목한다
          기대   그 방의 지금 State(패턴 · 압력 · 임계)가 판에 실린다 — 값은 봉투의 region.state 다
          경계   규칙을 품지 않은 방에서는 **그 줄이 아예 없다** — 0 으로 지어내지 않는다
                (C008 SPEC-007 과 같은 경계)

SPEC-005  지어내지 않는다
          조건   봉투가 실어 온 region.hash 가 내 Description 의 hash 와 다르다
          기대   땅에서 유도한 줄들을 답으로 내놓지 않고, **어긋났다는 사실**을 판에 적는다
          경계   hash 가 같으면 그 줄들이 정상으로 선다. 모르는 코드는 코드 그대로 뜨고 문구를 지어내지 않는다

SPEC-006  지목은 세계에 아무것도 보내지 않는다
          조건   자리를 여러 번 지목하고 푼다
          기대   그동안 세계로 나간 요청이 **0** 이다. WorldState 도 스냅샷도 달라지지 않는다
          경계   미로 안에서 지목해도 압력이 오르지 않는다 — 지목은 이동이 아니다.
                다른 관찰자의 화면에도 아무 일이 일어나지 않는다

SPEC-007  클릭의 뜻은 정책이 정한다
          조건   빈 땅을 클릭한다 · 광맥을 클릭한다 · 출구 표식을 클릭한다 · 땅을 지목한다
          기대   각각 C008 까지와 **같은 결과**가 나온다 (이동 · 채굴 · 건너기). 지목은 그 위에 더해진 뜻이다
          경계   Engine 은 집기(pick)까지만 하고 무엇을 요청할지 스스로 정하지 않는다 —
                정책을 주지 않으면 아무 요청도 만들지 않는다 (기본 동작을 숨겨 두지 않는다)

SPEC-008  세계 위에 늘 떠 있는 글자가 없다
          조건   백왕령(조건 셋 + 도시)과 환상의 미로(구역 넷 + 통로 여섯)의 화면을 만든다
          기대   지면 구역 어느 것에도 이름표가 실리지 않는다 — 자리와 색과 경계만 남는다
          경계   구역 자체는 그대로 그려진다. 걷어낸 것은 글자이지 구역이 아니다

SPEC-009  판은 판일 뿐이다
          조건   판이 선 상태에서 자판으로 걷고 시점을 돌린다
          기대   몸이 움직이고 시점이 돈다 — 판은 초점을 붙잡지 않는다
          경계   Escape 는 판을 푼다. 판이 없을 때의 Escape 는 지금까지와 같다

SPEC-010  방 이름은 지나간다
          조건   방을 건너 다른 방에 들어선다
          기대   그 방의 이름이 한 번 뜨고 사라진다
          경계   같은 방에 머무는 동안 다시 뜨지 않는다. 방을 옮기면 다시 한 번 뜬다
```

## State

```text
WorldState                       REUSED — **한 자리도 늘지 않는다.** 이 Cycle 의 핵심 사실이다
봉투(GameViewSnapshot)            REUSED — region { id · hash · state? } · hud.region.depth ·
                                 standingConditions. 한 자리도 늘지 않는다
관찰자의 지목                      ADDED — **세계 밖이다.** 조립(app)이 쥔다:
                                 지금 무엇을 지목했는가(존재 id 또는 좌표). 스냅샷에 실리지 않는다
```

이 Cycle 의 데이터 값: **없음** — content/regions 도 시뮬 상수도 늘지 않는다.

## Rule

이 Cycle 에는 World Rule 이 없다. 아래는 **표현과 입력의 규약**이며 실현은 `content/view` 와
조립(app)에 선다 — 각 R# 는 그 자리의 함수 머리에 id 주석으로 남는다 (grep 이 매핑 표다).

```text
R1  RULE-DESIGNATE-001                            ADDED (조립 · 관찰자 소유)
    IF   관찰자가 지면의 한 점을 지목한다
    THEN 그 좌표를 지금의 대상으로 쥔다. 새로 지목하면 바뀌고, Escape · 방 이동이면 풀린다.
         **세계로 아무것도 보내지 않는다** (확정 7 · 12)

R2  RULE-PLACE-READING-001                        ADDED (View · 결정 Layer)
    IF   대상이 자리다
    THEN 그 점의 사실을 만든다 — 방 · 깊이는 봉투에서, 표면 · 통행 · 사유 · area 는 내 Description 의
         컴파일 결과에서(세계와 같은 함수), 규칙 State 는 봉투의 region.state 에서.
         hash 가 어긋나면 땅에서 유도한 줄 대신 어긋남을 적는다 (SPEC-005)

R3  RULE-POINTER-INTENT-001                       CHANGED (조립 — 기존 클릭의 뜻)
    IF   화면의 무엇인가가 클릭된다
    THEN 정책이 그것을 요청 또는 지목으로 옮긴다. 기존 셋(이동 · 채굴 · 건너기)의 결과는 그대로다.
         Engine 은 집기까지만 하고 스스로 요청을 만들지 않는다 (SPEC-007 경계)

R4  RULE-QUIET-GROUND-001                         CHANGED (View — 세계 위 이름표)
    THEN 지면 구역에는 이름표를 붙이지 않는다. 세계 위 글자는 그 자리에 실물이 서 있는 것에만 남는다
         (존재 · landmark · 출구 표식). 방 이름은 들어선 순간 한 번 지나간다 (확정 4)

R5  세계의 Rule 전부                                REUSED — 한 글자도 바뀌지 않는다.
         RULE-MOVE-001 의 판정도, RULE-MAZE-CONNECTION-001 의 압력도 그대로다 (SPEC-006 경계)
```

## REUSED / ADDED

```text
REUSED   WorldState 와 Rule 전부 · 봉투 · 사유 코드 · 컴파일과 규칙 표 · 영속 · SceneGroundZone ·
         pickGround · pickEntity · code-text
ADDED    지목(관찰자 소유) · 자리 읽기 · 대상 프레임(기구 + 결정 표) · 지목 표식 · 방 이름 진입 제목 ·
         입력 해석 정책
CHANGED  지면 구역의 이름표를 걷는다(R4) · 클릭의 뜻이 "첫 interaction 즉시 실행" 에서
         "정책이 정한 것" 으로 바뀐다(R3 — 기존 셋의 결과는 같다)
AFFECTED 없음 — 세계의 어떤 Rule 도 대상 집합이 달라지지 않는다
```

## Observable (관찰 계약)

```text
늘어나는 것   **없다.** 이 Cycle 은 관찰 계약을 한 자리도 건드리지 않는다

읽는 것 (이미 있다)
  region.id · region.hash             REUSED — 방과, 내 데이터가 그 방과 같은가
  region.state?                       REUSED — 규칙을 품은 방의 pattern · pressure · pressureLimit (C008)
  hud[region.depth]                   REUSED — 깊이 태그
  standingConditions[]                REUSED — 내가 선 자리의 조건 (C006)

봉투 밖에서 만드는 것 (관찰자가 자기 Description 에서 · 확정 12)
  표면 태그 · 지날 수 있는가 · 못 지나가는 사유 · 그 점에 걸린 area 태그와 통로의 열림
```

**투영하지 않는 것** — 누가 무엇을 지목했는가. 세계는 그것을 모른다 (확정 7).
그리고 답은 지목한 **한 점**의 것이지 방 전체의 지도가 아니다 (확정 9) — 방을 알고 싶으면 여러 번 지목한다.

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
지목의 거리            제한 없다 — 확정 2 가 "공짜" 라고 했으므로 제한을 지어내지 않는다
판에 적는 줄의 순서     Play §5.4 의 순서 그대로 (어디인가 → 땅이 어떤가 → 무엇이 걸렸나 → 규칙이 있나).
                     표현의 결정이므로 content/view 의 표에 둔다
지목 표식의 색·모양     표현의 결정 — 기존 색 계열과 겹치지 않게 고르고 표에 둔다
지목의 입력            클릭 하나로 이동과 지목을 함께 뜻할 수 없다. 정책이 가르는 방법(누르는 자리 ·
                     보조키 · 두 번 누름 중 하나)은 표현·입력의 결정이므로 이 Cycle 이 정하고
                     TODO 에 감사 항목으로 올린다 — 세계 의미가 아니다
hash 어긋남의 문구      기존 region.hash-mismatch 코드를 그대로 쓴다 (C001 의 선례)
```
