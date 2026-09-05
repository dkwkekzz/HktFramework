# C027 — 존재도 같은 자리에 선다

```text
CYCLE          C027-a-being-stands-too
SOURCE         content/roadmap/play/RoomAnswersWhenAsked.md §2 Play Goal · §4 Breath(지목 → 대답 → 이해) ·
               §5.3 · §5.5 · §5.6 · §6 V1 · V5 · 확정 사항 1·3·7·8·10
               (근거: design/Plan-Place-Observation-Surface.md §1 측정 · §5 세 자리 규약 ·
                design/Design-Targeting-R0.md §3.2 대상 프레임 ·
                content/roadmap/L2-World-Region.md §17 규칙 가독성)
SELECTED_FROM  Play Cycle Breakdown — "C027 — 존재도 같은 자리에 선다"
```

**확장 Cycle** — C001~C008 과 C026 의 State/Rule 위에 더한다. 복사·재작성하지 않는다.

C026 과 같이 이 Cycle 도 **세계를 한 자리도 바꾸지 않는다.** WorldState 도, 관찰 계약(봉투)도,
STATE_VERSION 도, 요청의 종류도 늘지 않는다. 존재의 사실(이름 · 생명 · 지금 행동 · 그것이 주는
행동과 불가 사유)은 **이미 매 tick 봉투에 실려 온다** — 지금은 화면이 그것을 한 자리에서 읽지
못할 뿐이다. 그래서 이 Cycle 의 W(World) 레인은 비어 있다.

## Playable Goal

관찰자가 눈앞의 **존재**를 지목하면 자리를 지목했을 때와 **같은 판**에 그것이 선다 —
무엇인가(사람이 읽을 이름) · 어떤 상태인가(생명 · 지금 하는 일) · 그것이 나에게 무엇을 주는가
(할 수 있는 행동과, 지금 못 한다면 그 사유). 그리고 아무것도 지목하지 않았을 때 그 판은
**내가 선 자리**를 진다 — 깊이 · 안전한 이유 · 압력이 좌상단에서 이리로 옮겨 오고,
상시 HUD 에는 **내 몸의 상태만** 남는다.

## Experience Intent

```text
Start   자리는 물으면 답하는데 존재는 아직 아니다 — 눌러도 제목에 세계의 코드가 뜨고 그뿐이다.
        그리고 세계의 사실(깊이 · 안전한 이유 · 압력)이 여전히 좌상단에 늘 선불돼 있고, 판이 그것을 가린다.
End     존재를 눌러도 같은 판이 답한다 — 이름 · 생명 · 지금 하는 일 · 내가 걸 수 있는 것.
        아무것도 안 누르면 판은 내가 선 자리를 말한다. 좌상단에는 내 몸만 남는다.
        **배울 것이 하나다** — 존재든 자리든 내 발밑이든, 답은 늘 같은 자리에 온다.
```

Play 의 Breath 중 **지목 → 대답 → 이해** 구간을 존재까지 넓힌다.
**되물음**(거절 사유와 알림이 기록으로 남는 것)은 C028 이다.

## World Change

```text
없음.

WorldState · Rule · 관찰 계약(봉투) · STATE_VERSION · interaction 목록 — 어느 것도 늘지 않는다.
이 Cycle 이 화면에 세우는 사실은 전부 이미 봉투에 있다:
  ① 존재의 사실   entities[].name · state · kind · role · vitality(health · healthMaximum · downed) ·
                 progress · attended (C001 이전부터 · 팩 protocol/gameview.ts)
  ② 대상이 주는 것 interactions[] 중 targetEntityId 가 그 존재인 것 — available · reason · profile
  ③ 내가 선 자리   hud[region.depth] · standingConditions[] · region.state (C006 · C008)
그러므로 존재 지목도 세계에 아무 요청도 보내지 않는다 — 패킷도 왕복도 0 이다 (확정 7).
```

## Observable Result

```text
① 존재를 지목하면 판의 제목이 **사람이 읽을 이름**이다 — 이름이 없는 것은 그 종류의 이름으로 선다.
   `MAZE_GATE_RETURN` 같은 세계의 코드가 제목 자리에 서지 않는다
② 사람·짐승을 지목하면 생명(지금 / 최대)과 지금 하는 일이 줄로 읽힌다.
   생명이 없는 것(광맥 · 출구 표식)에는 그 줄이 **아예 없다**
③ 그 대상에 걸 수 있는 행동이 줄로 서고, 지금 못 하는 것은 **왜 못 하는지**가 함께 읽힌다
④ 지목한 몸이 세계 안에서 표시되고, 그 몸이 세계에서 사라지면 판이 저절로 풀린다.
   **쓰러진 몸은 풀리지 않는다** — 쓰러진 채로 계속 읽힌다
⑤ 아무것도 지목하지 않으면 판이 **내가 선 자리**를 진다 — 방 · 깊이 · 땅 · 안전한 이유 ·
   (규칙을 품은 방이면) 압력. Escape 로 풀면 판이 사라지지 않고 이 자리로 돌아온다
⑥ 좌상단 상시 HUD 에 깊이 · 안전한 이유 · 압력이 **없다.** 내 몸의 것(행동 · 소지품 · 곡괭이 ·
   세계 시간 · 함께 보는 사람)만 남는다 — 같은 사실이 두 자리에 적히지 않는다
⑦ 판과 상시 HUD 가 화면에서 겹치지 않는다 — 둘 다 처음부터 끝까지 읽힌다
⑧ 조작 안내에 **지목하는 법**이 적혀 있다 — 화면이 말하지 않아 알 수 없던 것이 없다
⑨ 클릭으로 하던 일(이동 · 채굴 · 건너기)과 자리 지목(C026)은 결과가 **한 글자도 다르지 않다**
```

## Reuse

### Existing (그대로 쓴다)

```text
C026 이 세운 것 전부 — 입력 해석 정책(pointerRules) · 지목(관찰자 소유) · 지목 표식 ·
늘 떠 있는 판(engine/view-kernel/hud/target-frame) · 자리 읽기 · 판의 결정 표 ·
방 이름 진입 제목 · 세계 위 글자 0 ·
봉투의 entities(name · state · kind · role · vitality · progress · attended) ·
봉투의 interactions(targetEntityId · available · reason · profile) ·
hud[region.depth] · standingConditions · region.state ·
code-text 문구 표 · role-presentation · kind-presentation · SceneState.keyHints
```

### Added (이 Cycle 이 세운다)

```text
Engine   없음 — C026 이 세운 판과 표식을 그대로 쓴다.
         (판과 상시 HUD 가 겹치지 않는 것은 두 위젯의 자리 문제이므로 배치만 손댄다 —
          형과 시그니처는 바뀌지 않는다)
View     존재 읽기 (봉투의 그 존재에서 사실을 만든다) · 존재의 이름 표(이름 없는 것의 종류 이름) ·
         대상이 주는 행동의 줄 · 기본 대상(내가 선 자리) 읽기 · 지목 안내 한 줄
World    없음
Protocol 없음
Data     없음 — content/regions 는 한 줄도 바뀌지 않는다
```

## Out of Scope

```text
거절 사유·세계의 알림이 판의 기록으로 남는 것(V6) · 규칙 방의 State 가 그 기록과 함께 읽히는 것   C028
그 대상에 행동을 **판에서 직접 거는 것** (판은 읽는 자리다 — 거는 것은 지금까지대로 클릭이다)     없음 (이 Play 밖)
적대 · Tab 순환 · 공격 의도 · CurrentTarget 을 세계가 쥐는 것                                  5층 (TG)
hover 로 미리 알려 주는 것                                                                    이 Play 밖 (확정 11)
지목이 가려지는 것 · 관찰의 대가                                                              3층 (확정 2 · 3)
```

## SPEC

```text
SPEC-001  존재를 지목하면 그 존재가 판에 선다
          조건   관찰자가 눈앞의 존재(사람 · 짐승 · 광맥 · 출구 표식)를 지목한다
          기대   판의 제목이 그 존재의 이름이다. 이름이 없는 존재는 **그 종류의 이름**으로 선다
          경계   이름도 종류도 모르는 것은 코드 그대로 뜬다 (지어내지 않는다 — C026 SPEC-005 와 같은 규율).
                자리를 지목했을 때의 제목은 C026 그대로다

SPEC-002  그 존재가 어떤 상태인지 말한다
          조건   사람 · 짐승을 지목한다
          기대   생명(지금 / 최대)과 지금 하는 일이 줄로 실린다. 생명에는 얼마나 남았는지가 함께 보인다
          경계   생명을 갖지 않는 존재(광맥 · 출구 표식)에는 **그 줄이 아예 없다** — 0 으로 지어내지 않는다.
                쓰러진 몸은 쓰러졌다는 것이 읽힌다

SPEC-003  그 대상이 주는 것을 말한다
          조건   광맥을 지목한다 · 출구 표식을 지목한다 · 아무것도 주지 않는 존재를 지목한다
          기대   그 대상을 겨냥한 행동이 줄로 서고, 지금 걸 수 없는 것은 **사유 코드가 함께** 실린다
          경계   그 대상을 겨냥한 행동이 하나도 없으면 그 줄들이 없다.
                다른 대상을 겨냥한 행동은 실리지 않는다 — 지목한 것의 것만 읽힌다

SPEC-004  지목은 유지되고, 사라지면 풀린다
          조건   존재를 지목한 뒤 그 몸이 쓰러진다 · 세계에서 사라진다 · 방을 옮긴다 · Escape 를 누른다
          기대   쓰러져도 **풀리지 않는다** (확정 8). 세계에서 사라지면 풀린다. 방을 옮기면 풀린다.
                Escape 로 풀린다. 그동안 새로 지목하지 않으면 대상은 그대로다
          경계   풀린 자리는 비어 있지 않다 — SPEC-005 의 기본 대상으로 돌아간다

SPEC-005  지목이 없으면 판은 내가 선 자리를 진다
          조건   아무것도 지목하지 않은 채 서 있다 · 걸어서 다른 자리로 간다
          기대   판이 **내 몸이 선 자리**의 사실을 진다 — C026 의 자리 읽기와 **같은 줄들**이고,
                내가 움직이면 따라 바뀐다
          경계   내가 선 자리의 안전한 이유는 세계가 준 것(standingConditions)이고 땅에서 유도한 것이
                아니다. 규칙을 품지 않은 방에서는 압력 줄이 아예 없다 (C008 · C026 SPEC-004 경계 그대로)

SPEC-006  상시 HUD 는 내 몸의 상태만 진다
          조건   깊이가 있는 방 · 조건 area 위 · 규칙을 품은 방에서 화면을 만든다
          기대   좌상단 HUD 에 깊이 · 안전한 이유 · 압력이 **없다.** 그 셋은 판에 있다
          경계   내 몸의 것(행동 · 소지품 · 곡괭이 · 세계 시간 · 함께 보는 사람)은 그대로 남는다.
                같은 사실이 두 자리에 동시에 적히지 않는다

SPEC-007  화면이 지목하는 법을 말한다
          조건   화면의 조작 안내를 읽는다
          기대   지목하는 법이 한 줄로 적혀 있다
          경계   기존 안내 줄들은 그대로다 — 줄이 하나 늘 뿐이다

SPEC-008  판과 상시 HUD 는 겹치지 않는다
          조건   판이 선 채로 상시 HUD 가 가장 길어지는 화면(소지품 · 곡괭이 · 행동 · 세계 시간 · 함께)을 만든다
          기대   두 자리가 화면에서 서로를 덮지 않는다 — 둘 다 처음부터 끝까지 읽힌다
          경계   판이 길어져도 가로로 번지지 않는다 (너비 상한이 있다)

SPEC-009  존재 지목도 세계에 아무것도 보내지 않는다
          조건   존재를 여러 번 지목하고 푼다
          기대   그동안 세계로 나간 요청이 **0** 이다. WorldState 도 스냅샷도 달라지지 않는다
          경계   지목한 것의 어떤 행동도 저절로 걸리지 않는다 — 판은 읽는 자리다

SPEC-010  하던 것은 그대로다 (회귀)
          조건   빈 땅을 클릭한다 · 광맥을 클릭한다 · 출구 표식을 클릭한다 · 자리를 지목한다
          기대   이동 · 채굴 · 건너기와 C026 의 자리 읽기가 **결과가 같다**
          경계   세계 위 상시 글자는 여전히 0 이고, 방 이름은 여전히 한 번 지나간다
```

## State

```text
WorldState                       REUSED — **한 자리도 늘지 않는다**
봉투(GameViewSnapshot)            REUSED — entities[].{name·state·kind·role·vitality·progress·attended} ·
                                 interactions[].{targetEntityId·available·reason·profile} ·
                                 hud[region.depth] · standingConditions · region.state.
                                 한 자리도 늘지 않는다
관찰자의 지목                      REUSED (C026 ADDED) — 존재 id 또는 좌표. 세계 밖이고 조립(app)이 쥔다
판의 기본 대상                     ADDED — 지목이 없을 때의 대상은 **내 몸이 선 자리**다 (Play §5.5).
                                 값이 아니라 규약이다 — 새로 쥐는 State 가 없다
```

이 Cycle 의 데이터 값: **없음** — content/regions 도 시뮬 상수도 늘지 않는다.

## Rule

이 Cycle 에도 World Rule 이 없다. 아래는 **표현과 입력의 규약**이며 실현은 `content/view` 와
조립(app)에 선다 — 각 R# 는 그 자리의 함수 머리에 id 주석으로 남는다 (grep 이 매핑 표다).

```text
R1  RULE-BEING-READING-001                        ADDED (View · 결정 Layer)
    IF   대상이 존재다
    THEN 봉투의 그 존재에서 사실을 만든다 — 이름(없으면 종류의 이름 · 그것도 없으면 코드 그대로) ·
         생명(가진 것만) · 지금 하는 일 · 쓰러졌는가. 없는 것은 줄을 세우지 않는다 (SPEC-001 · 002)

R2  RULE-TARGET-OFFERS-001                        ADDED (View · 결정 Layer)
    IF   대상이 존재다
    THEN 그 존재를 겨냥한 interaction 들을 줄로 세운다 — 걸 수 있으면 그대로, 없으면 사유 코드를
         함께. 다른 대상의 것은 세우지 않는다 (SPEC-003)

R3  RULE-STANDING-READING-001                     ADDED (View · 결정 Layer)
    IF   지목이 없다
    THEN 내 몸이 선 자리를 대상으로 삼아 C026 의 자리 읽기를 그대로 쓴다. 안전한 이유는 세계가 준
         standingConditions 에서 온다 (땅에서 유도하지 않는다) (SPEC-005)

R4  RULE-DESIGNATE-001                            CHANGED (조립 — 수명이 넓어진다)
    IF   지목한 존재가 세계에서 사라진다
    THEN 지목을 푼다. **쓰러진 것은 사라진 것이 아니다** — 풀지 않는다 (확정 8 · SPEC-004).
         Escape · 방 이동으로 푸는 것은 C026 그대로다

R5  RULE-SELF-HUD-001                             CHANGED (View — 상시 HUD 의 범위)
    THEN 상시 HUD 는 내 몸의 상태만 진다. 세계의 사실(깊이 · 안전한 이유 · 압력)은 판이 진다 —
         같은 사실이 두 자리에 적히지 않는다 (SPEC-006)

R6  RULE-DESIGNATE-HINT-001                       ADDED (View — 조작 안내)
    THEN 조작 안내에 지목하는 법이 한 줄로 선다 (SPEC-007)

R7  RULE-POINTER-INTENT-001 · RULE-PLACE-READING-001 · RULE-QUIET-GROUND-001   REUSED (C026)
    한 글자도 바뀌지 않는다 (SPEC-010)

R8  세계의 Rule 전부                                REUSED — 한 글자도 바뀌지 않는다 (SPEC-009 경계)
```

## REUSED / ADDED

```text
REUSED   WorldState 와 Rule 전부 · 봉투 · 사유 코드 · code-text · role-presentation ·
         kind-presentation · C026 의 판 · 지목 · 표식 · 입력 해석 정책 · 자리 읽기 · keyHints
ADDED    존재 읽기 · 존재의 이름 표 · 대상이 주는 행동의 줄 · 기본 대상(내가 선 자리) · 지목 안내 한 줄
CHANGED  지목의 수명이 넓어진다(R4 — 사라지면 풀린다 · 쓰러진 것은 아니다) ·
         상시 HUD 가 내 몸의 상태로 좁아진다(R5 — 깊이 · 안전한 이유 · 압력이 판으로 옮겨 간다) ·
         판의 자리·너비가 상시 HUD 를 덮지 않게 정해진다 (SPEC-008 — 배치의 결정)
AFFECTED 없음 — 세계의 어떤 Rule 도 대상 집합이 달라지지 않는다
```

## Observable (관찰 계약)

```text
늘어나는 것   **없다.** 이 Cycle 도 관찰 계약을 한 자리도 건드리지 않는다

읽는 것 (이미 있다)
  entities[].name                     REUSED — Actor.Name (character 에만 실린다)
  entities[].role · kind              REUSED — 이름이 없는 것의 종류
  entities[].state · progress         REUSED — 지금 하는 일과 그 진행
  entities[].vitality                 REUSED — health · healthMaximum · downed (character 에만)
  entities[].attended                 REUSED — 그 몸을 지금 조종하는 이가 있는가
  interactions[].targetEntityId       REUSED — 그 행동이 겨냥한 대상
  interactions[].available · reason   REUSED — 걸 수 있는가 · 없으면 왜
  hud[region.depth] · standingConditions · region.state   REUSED — 내가 선 자리의 사실 (C001 · C006 · C008)
```

**투영하지 않는 것** — 누가 무엇을 지목했는가 (세계는 그것을 모른다 · 확정 7). 그리고 지목한 대상의
**감춰진 값**은 이 층에 없다 — 세계는 지금 아무것도 숨기지 않으므로 가림은 3층의 것이다 (확정 3).

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
존재 줄의 차례        자리의 차례(어디인가 → 어떤가 → 무엇이 걸렸나 → 규칙)와 같은 어법으로
                    무엇인가 → 어떤 상태인가 → 무엇을 주는가. 표현의 결정이므로 content/view 의 표에 둔다
이름 없는 것의 이름    role · kind 표에서 가져온다 (이미 있는 표 — 새로 짓지 않는다).
                    둘 다 모르면 코드 그대로 (C026 SPEC-005 와 같은 규율)
지목 안내의 문구      기존 조작 안내와 같은 어법. 표현의 결정
판과 HUD 의 자리      겹치지 않게만 정한다. 어느 쪽을 옮길지는 표현의 결정이며 TODO 감사 항목으로 올린다
쓰러진 몸의 표기      기존 downed 상태의 문구를 그대로 쓴다 (새 문구를 짓지 않는다)
```
