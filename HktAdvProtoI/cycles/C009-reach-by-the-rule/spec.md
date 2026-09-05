# C009 — 규칙을 이용해 닿는다

```text
CYCLE          C009-reach-by-the-rule
SOURCE         content/roadmap/play/RuleBoundRoom.md §2 Play Goal · §4 Breath(가설 → 시험 → 이해 → 이용 → 도달) ·
               §5.4 심장 · §5.6 패턴 표와 탈출 · §6 W13 · W14 · 확정 사항 2·3·5
               (근거: content/roadmap/L2-World-Region.md §10 Connector 모델(activation) ·
                §16 Region Spec(FANTASY_MAZE — state.heartAccess · exit.emergency · topology.children) ·
                §17 규칙 가독성 "규칙을 이해한 뒤 실제 선택이 달라지는가" ·
                content/roadmap/L2-World-Concept.md W8 세계가 질문을 만든다)
SELECTED_FROM  Play Cycle Breakdown — "C009 — 규칙을 이용해 닿는다"
```

**확장 Cycle** — C008 이 세운 Region State(pattern · pressure)와 규칙 위에 더한다. 복사·재작성하지 않는다.
C008 에서 패턴은 **방 안의 길**만 바꾸었다. 이 Cycle 에서 패턴이 처음으로 **방 밖으로 나가는 문**을 바꾼다 —
Region Rule 이 Connector 를 재편한다는 Region §10 의 마지막 문장이 여기서 선다.

## Playable Goal

관찰자가 미로에서 심장 쪽 문을 찾는다. 그 문은 대개 잠겨 있고, **특정 패턴에서만 열린다.**
압력을 채워 그 패턴을 불러내고, 그 패턴에서 구역 B 로 걸어가 문을 건너면 **미로의 심장**이다.
그리고 어디서 길을 잃든 "돌아가기" 하나로 입구에 선다 — 미로는 사람을 가두지 않는다.

## Experience Intent

```text
Start   길이 바뀐다는 것은 알았다. 그런데 심장 쪽 문은 잠겨 있고, 걸어도 걸어도 잠겨 있다.
End     문이 열리는 것은 내가 거기 있을 때가 아니라 **패턴이 P2 일 때**다.
        규칙을 알면 문을 열 수 있다 — 압력을 채워 원하는 패턴을 부르고 그때 B 로 간다.
        미로가 나를 심장으로 데려간 것이 아니라, 내가 규칙으로 미로를 쓴 것이다.
```

Play 의 Breath 중 **가설 → 시험 → 이해 → 이용 → 도달** 구간을 만든다.
**공유된 세계**(두 관찰자 · 떠난 뒤에도 남는 State)는 C010 이다.

## World Change

```text
① 미로의 심장이 지어진다 — MAZE_HEART 가 Region 이 된다 (depth deep · 작은 방).
   미로의 중첩 자식이다 (containment: parent = FANTASY_MAZE · Play §5.4 · Spec topology.children)
② 심장 쪽 문이 선다 — MAZE_HEART_GATE. 미로의 HEART_GATE anchor(구역 B 안 · C008 이 세워 두었다)와
   심장을 잇는 door Connector **하나**다 (Play §5.4 "door Connector 하나로 들어간다")
③ 뒤집힌 정원 쪽 문이 선다 — INVERTED_GARDEN_DOOR. 심장에서 나가는 끝 하나이고 그 너머는
   **아직 짓지 않은 곳**이다 (경계가 셋이 된다). 이 Cycle 은 건너지 않는다 (확정 5)
④ Connector 가 **방의 State 를 조건으로 갖는다** — 심장 쪽 문은 그 방의 패턴이 P2 일 때만 활성이다
   (Region §10 activation · Play §5.4 heartAccess). 조건은 컨텐츠 데이터다 — 규칙 코드에는 문 이름도
   패턴 이름도 없다
⑤ 건너기 규칙의 전제 4(Connector 가 열려 있다)가 **지금의 세계 State 를 읽는다**. 사유 코드는 그대로다
   (connector-inactive) — 잠긴 문이 정적 목록에서 오던 것이 이제 그 방의 패턴에서도 온다
⑥ 세계 밖의 명령이 하나 는다 — "돌아가기". 그 방이 비상 자리를 밝혀 두었으면 몸을 **같은 방 안**의
   그 자리로 옮긴다 (Spec exit.emergency = COLLAPSE_TO_ENTRY · W14). 미로의 비상 자리는 입구 anchor 다
⑦ 저장되는 State 는 하나도 늘지 않는다 — 문이 열렸는가는 패턴에서 **유도된다**.
   STATE_VERSION 은 C008 그대로다
```

## Observable Result

```text
① 구역 B 에 심장 쪽 문의 표식이 있다 — 그리고 대개 **잠겨 있음**으로 보인다
② 압력이 넘쳐 패턴이 P2 가 되는 순간, 그 표식이 **열림**으로 바뀐다. 몸을 움직이지 않아도 바뀐다
③ 잠겨 있을 때 건너려 하면 "잠겨 있다" 로 거절된다 — C002 부터 쓰던 그 문구 그대로다
④ 열려 있을 때 건너면 **미로의 심장**이다. 방 이름과 깊이가 바뀐다
⑤ 심장에는 나가는 끝이 둘이다 — 왔던 문과 뒤집힌 정원 쪽 문. 정원 쪽은 "아직 갈 수 없는 곳이다"
⑥ 심장에는 압력 줄이 없다 — 규칙을 품은 방이 아니다. 걸어도 미로의 압력은 오르지 않는다
⑦ 미로 어디서든 명령 표면에 "돌아가기" 가 있고, 걸면 입구(구역 A)에 선다.
   압력도 패턴도 그대로다 — 옮겨진 것은 몸뿐이다
⑧ 미로 밖의 방에서는 "돌아가기" 가 가용하지 않다 — 그 방에는 비상 자리가 없다
```

## Reuse

### Existing (그대로 쓴다)

```text
Region · Connector · 건너기 규칙(RULE-REGION-TRANSIT-001)과 사유 여섯 · 경계(frontier) 판정 · 중첩 ·
region-exit 표식(open | locked) · 투영 · 다중 관찰자 · engine/world-authoring 전부(compile · check · anchor) ·
C008 의 Region State(pattern · pressure · rearrangedAt) · RULE-MAZE-CONNECTION-001 · 패턴 표 ·
미로의 HEART_GATE anchor(구역 B 안 · C008 이 세워 두었다) · 명령 표면(CommandCatalog · 등록되지 않은 명령은
이름만 실려 간다) · Request.Outcome 거절과 사유 코드 · 영속(스냅샷)
```

### Added (이 Cycle 이 세운다)

```text
Data       content/regions/maze-heart.ts — Region Spec 하나(anchor 둘) ·
           graph.ts 에 Connector 둘(MAZE_HEART_GATE · INVERTED_GARDEN_DOOR) · 중첩 하나 · 경계 하나 ·
           Connector 활성 조건 표 하나(문 → 방 + 패턴 이름들) ·
           RegionSpec 에 비상 자리 자리(emergencyAnchor) · 미로가 그것을 밝힌다
World      Connector 활성 판정이 세계 State 를 읽는다 (isConnectorOpen CHANGED) ·
           RULE-EMERGENCY-RETURN-001 하나 · 그 명령의 목록 항목과 가용성 판정
Protocol   commands 에 항목 하나 · interactions 에 role 하나 — 형은 하나도 바뀌지 않는다.
           **STATE_VERSION 은 오르지 않는다** (저장되는 State 가 늘지 않았다)
View       명령 문구 하나 · 사유 문구 하나 · 심장 방의 표(이름 · 땅) — code-text · region-presentation 에 항목 추가
Engine     없음 — Play §6 E5 그대로다. Connector 의 activation 은 기반이 모르는 세계 규칙의 것이고
           (engine/world-authoring/graph.ts 머리 주석), 조건 표는 컨텐츠 데이터다
```

## Out of Scope

```text
두 관찰자가 같은 문 상태를 본다는 증명 · 한쪽의 걸음이 다른 쪽의 문을 연다 · 떠난 뒤에도 남는 State   C010
뒤집힌 정원 방 · 공간 왜곡 결정(보상) · 미로의 포식 생물 · RULE_SPATIAL_ECHO · bridgeState        이 Play 밖
지식으로 문을 여는 것 (entry.requirement.knowledge · activation.knowledge)                     3층
심장 안의 규칙 · 심장의 재료 · 심장이 미로의 패턴을 바꾸는 것                                    없음 — 심장은 방과 문뿐이다 (확정 5)
닫힌 문이 몸을 밀어내는 것 · 문이 닫히는 순간의 강제 전이                                        없음 — 건너기는 요청 판정뿐이다
"돌아가기" 가 방을 건너는 것                                                                   없음 — 같은 방 안이다 (W14)
```

## SPEC

```text
SPEC-001  심장이 지어진다
          조건   세계가 만들어진다
          기대   MAZE_HEART 에 Description 이 있다 — depth deep · anchor 둘(미로 쪽 · 정원 쪽).
                미로의 중첩 자식이다 (containment 에 parent = FANTASY_MAZE · child = MAZE_HEART)
          경계   checkGraph 의 검사 일곱이 전부 0 이다 — 나갈 끝이 있고(no-exit 0),
                시작 방에서 닿고(unreachable 0), 중첩이 Connector 로 이어져 있다(containment-unlinked 0).
                뒤집힌 정원은 경계 목록에 있고 Description 이 없다 (frontier-built 0 · unused-frontier 0)

SPEC-002  심장 쪽 문은 패턴이 정한다
          조건   미로의 패턴이 P2 다
          기대   MAZE_HEART_GATE 가 활성이다 — 표식이 열림이고 건너기가 거절되지 않는다
          경계   패턴이 DEFAULT · P1 이면 활성이 아니다 — 표식이 잠김이고 건너기는 connector-inactive 로
                거절된다. **몸은 아무것도 하지 않았다** — 활성은 몸이 아니라 방의 State 가 정한다

SPEC-003  압력이 문을 연다
          조건   미로 안에서 걸어 압력을 임계까지 두 번 넘긴다 (DEFAULT → P1 → P2)
          기대   두 번째로 넘긴 tick 에 심장 쪽 문이 활성이 된다.
                건너기 요청 하나만으로 갈리는 것은 **그 방의 패턴**이다
          경계   세 번 넘기면 DEFAULT 로 돌아오고 문은 다시 잠긴다 (순환은 셋 · 확정 2)

SPEC-004  열린 문으로 건너면 심장이다
          조건   패턴이 P2 이고 몸이 HEART_GATE anchor 곁(건너기 거리 안)에 있다
          기대   건너기가 받아들여진다. 몸의 방이 MAZE_HEART 로 바뀌고 심장 쪽 anchor 에 선다.
                관성과 진행 중이던 행동은 남지 않는다 (C003 이 세운 전이 그대로)
          경계   그 문은 **하나**이고 양방향이다 — 심장에서 같은 문으로 미로에 돌아온다.
                돌아올 때도 같은 조건을 읽는다 (패턴이 P2 가 아니면 connector-inactive)

SPEC-005  심장은 규칙 없는 방이다
          조건   심장 안의 몸이 움직인다
          기대   심장에는 Region State 가 없다 — 관찰 결과에 그 자리가 없고, 그 걸음은
                **미로의 압력에도 아무것도 더하지 않는다**
          경계   심장에서 나가는 끝은 둘이다 — 왔던 문과 정원 쪽 문. 정원 쪽으로 건너려 하면
                region-not-built 로 거절된다 (C002 가 세운 대답 그대로)

SPEC-006  돌아가기는 몸만 옮긴다
          조건   미로 안 어디서든 "돌아가기" 명령을 건다
          기대   몸이 그 방이 밝힌 비상 자리(미로의 입구 anchor)에 선다. 방은 바뀌지 않는다.
                관성과 진행 중이던 행동은 남지 않는다
          경계   압력도 패턴도 rearrangedAt 도 한 값도 바뀌지 않는다 — 이 옮김은 **이동이 아니다**.
                그러므로 압력이 오르지 않고, 그것으로 패턴을 넘길 수도 없다

SPEC-007  비상 자리가 없는 방에서는 걸 수 없다
          조건   미로 밖의 방(백왕령 등)에서 "돌아가기" 명령을 건다
          기대   가용하지 않다고 밝혀져 있고, 걸어도 거절된다 — 몸의 자리는 바뀌지 않는다
          경계   목록 자체는 늘 실린다 — 걸 수 있는 것이 무엇인지는 허용 여부와 별개로 밝혀진다
                (INTENT-COMMAND-CATALOG-001 그대로)

SPEC-008  다른 문들은 그대로다
          조건   미로 밖의 Connector 열넷으로 건넌다
          기대   판정도 사유도 표식도 C008 과 한 글자도 다르지 않다 —
                활성 조건 표에 없는 문은 언제나 활성이다
          경계   미로 밖의 방을 관찰해도 심장 쪽 문의 상태는 실리지 않는다 (관찰은 방으로 잘린다)

SPEC-009  세계를 되살려도 문은 패턴대로다
          조건   패턴을 P2 까지 넘긴 뒤 세계를 저장하고 되살린다
          기대   되살린 세계에서 심장 쪽 문이 활성이고 건너면 심장이다.
                문의 열림은 저장된 값이 아니라 **패턴에서 유도된 사실**이다
          경계   STATE_VERSION 이 C008 과 **같다** — 저장되는 State 가 하나도 늘지 않았다.
                C008 이 저장한 스냅샷이 그대로 되살아난다
```

## State

```text
WorldState.regions[regionId].pattern       REUSED — C008 이 세웠다. 이 Cycle 이 그것을 **문의 조건**으로 읽는다
WorldState.regions[regionId].pressure      REUSED
WorldState.regions[regionId].rearrangedAt  REUSED
   ↑ 저장되는 State 는 **하나도 늘지 않는다.** heartAccess 는 State 가 아니라 pattern 에서 유도되는
     사실이다 — 같은 pattern 이면 언제나 같은 답이므로 저장할 이유가 없다 (terrain 과 같은 성격 ·
     C008 이 "저장/유도" 를 가른 그 규율 그대로). 그래서 STATE_VERSION 이 오르지 않는다

RegionSpec.emergencyAnchor  ADDED — 그 방이 밝힌 비상 자리의 anchor 태그 (Spec exit.emergency).
                            없으면 그 방에는 비상 자리가 없다. 컨텐츠 데이터이지 State 가 아니다
Connector 활성 조건 표        ADDED — 문 하나마다 { 방, 그 방의 패턴 이름들 }. 컨텐츠 데이터다 ·
                            저장되지 않는다 (CLOSED_CONNECTORS 와 같은 성격)
```

이 Cycle 의 데이터 값:

```text
MAZE_HEART          depth deep · 작은 방 (심장 호수의 선례 — anchor 말고 아무 것도 없다 · 확정 5)
anchor 둘            MAZE_SIDE (미로에서 들어서는 자리) · GARDEN_DOOR (뒤집힌 정원 쪽)
MAZE_HEART_GATE     FANTASY_MAZE.HEART_GATE ↔ MAZE_HEART.MAZE_SIDE · bidirectional · transition door
                    (Play §5.4 "door Connector 하나" — 하나이므로 오가는 것도 이 하나다.
                     TREE_INNER_DOOR 의 선례: 들어간 자리로 나온다)
INVERTED_GARDEN_DOOR MAZE_HEART.GARDEN_DOOR → INVERTED_GARDEN · one-way · transition door.
                    그 너머는 경계다 (확정 5 — 정원은 그 Region 의 Play 의 것)
활성 조건            MAZE_HEART_GATE 는 FANTASY_MAZE 의 패턴이 P2 일 때만 활성 (확정 2 · Play §5.6
                    "P2 에서만 heartAccess = OPEN"). 표에 없는 문 열넷은 언제나 활성이다
미로의 비상 자리      FANTASY_MAZE.emergencyAnchor = ANCIENT_GATE (입구 · 구역 A 안 · Play §5.6 "A 의 입구 anchor")
경계 셋              RED_WASTE · ICE_CANYON · INVERTED_GARDEN
```

## Rule

```text
R1  RULE-CONNECTOR-ACTIVATION-001                ADDED (Region Rule 의 두 번째 얼굴)
    IF   그 문이 활성 조건 표에 있다
    THEN 그 조건이 가리키는 방의 지금 pattern 이 표의 목록에 있을 때만 활성이다.
         표에 없는 문은 언제나 활성이다 (지금까지의 세계 그대로)
    비고 **규칙은 문 이름도 패턴 이름도 알지 못한다** — 아는 것은 "조건을 가진 문" 뿐이고
         어느 문이 어느 패턴에서 열리는지는 데이터에만 있다 (C004 가 세운 규율 · C008 R1 과 같은 규율).
         Region §10 의 "Region Rule 은 Connector 의 활성화 여부를 변화시킬 수 있다" 가 여기서 선다

R2  RULE-REGION-TRANSIT-001                      CHANGED (전제 4 가 State 를 읽는다)
    IF   전제 4 — Connector 가 열려 있다
    THEN 정적 목록(CLOSED_CONNECTORS)에 없고 **그리고** R1 의 활성 판정을 통과해야 열린 문이다.
         어느 하나라도 걸리면 거절하고 사유는 그대로 connector-inactive 다
    비고 전제의 **순서도 사유 코드도 하나도 바뀌지 않는다** (거리 → 닫힘 → 경계 → 행동).
         바뀐 것은 "닫힘" 이 무엇을 보는가 하나다 — 정적 사실에 세계 State 가 더해졌다.
         멀리서는 여전히 거리가 먼저 걸린다: 문이 왜 잠겼는지는 붙어서 물어야 안다

R3  RULE-EMERGENCY-RETURN-001                    ADDED (세계 밖의 명령 · Spec exit.emergency)
    IF   그 몸이 선 방이 비상 자리를 밝혀 두었다
    THEN 몸이 **같은 방 안**의 그 anchor 에 선다. Velocity = (0,0) · CurrentAction = idle
    ELSE 거절한다 — 사유 코드 no-emergency-exit
    비고 이것은 **이동이 아니다** — move-progress 를 거치지 않으므로 압력이 오르지 않는다.
         방을 건너지도 않는다. 미로가 사람을 가두지 않는다는 것 하나를 위한 자리다 (Play §5.6 탈출).
         전이의 몸통은 C003 이 뽑아 둔 자리와 같은 일을 하되 방은 그대로다

R4  RULE-MAZE-CONNECTION-001                     REUSED — 한 글자도 바뀌지 않는다.
    THEN 압력과 패턴 순환은 C008 그대로다. 그 패턴을 **문이 읽기 시작했을 뿐**이다

R5  RULE-MOVE-001                                REUSED — C008 의 통로 전제까지 그대로다.
    THEN 심장에는 통로도 규칙도 없으므로 그 방에서는 이 전제가 없는 것과 같다

R6  영속                                          REUSED — 형이 늘지 않는다. STATE_VERSION 그대로

R7  그 밖의 Rule 전부                              REUSED — 하나도 바뀌지 않는다
```

## REUSED / ADDED

```text
REUSED   Rule 전부(R4~R7) · 사유 코드 connector-inactive · region-not-built · 건너기의 전제 순서 ·
         region-exit 표식의 두 갈래 · 투영이 방으로 잘리는 것 · 명령 표면 · 컴파일과 검사
ADDED    MAZE_HEART Region 데이터 · Connector 둘 · 중첩 하나 · 경계 하나 · 활성 조건 표 ·
         RegionSpec.emergencyAnchor · RULE-CONNECTOR-ACTIVATION-001 · RULE-EMERGENCY-RETURN-001 ·
         명령 항목 하나(emergency-return)와 interaction role 하나 · 사유 코드 하나(no-emergency-exit) ·
         문구 셋(명령 · 사유 · 심장의 이름)
CHANGED  RULE-REGION-TRANSIT-001 의 전제 4 가 세계 State 를 읽는다 (사유도 순서도 그대로)
AFFECTED checkGraph 의 수 (방 열하나 · Connector 열여섯 · 중첩 셋 · 경계 셋) ·
         미로의 관찰 결과에 region-exit 이 하나 는다 (심장 쪽 문)
```

## Observable (관찰 계약)

투영할 State — 점 경로로:

```text
entities[role=region-exit].state       REUSED 형 — open | locked. **이 값이 이제 패턴 따라 바뀐다**.
                                       심장 쪽 문의 표식이 그것이다 (Play §5.4 관찰)
interactions[transit].available/reason REUSED 형 — 사유 코드도 그대로 (connector-inactive)
commands[emergency-return]             ADDED — 명령 목록에 항목 하나. available 과 reason 은 State 판정
interactions[role=emergency-return]    ADDED — 같은 판정을 interaction 자리로도 (set-attribute 의 선례)
region.state                           REUSED — 심장에는 **없다** (규칙 없는 방 · C008 SPEC-007 경계 그대로)
hud region.depth                       REUSED — 심장도 deep 이다
```

**heartAccess 라는 값은 투영하지 않는다** — 문의 표식(region-exit.state)이 이미 그것이다.
세계 State 에도 두지 않는다: 같은 패턴이면 언제나 같은 답이므로 유도되는 사실이다.

**투영하지 않는 것** — 어느 패턴이 그 문을 여는가. 세계는 "지금 열렸는가" 만 말하고
"무엇이 그것을 열었는가" 는 말하지 않는다. 활성 조건 표는 관찰자의 `content/regions` 에도 있지만
그것을 읽어 미리 알려 주지 않는다 — 압력을 채워 보고 표식이 바뀌는 것을 보는 것이 이 Cycle 의 플레이다
(Region §17 "규칙을 이해한 뒤 실제 선택이 달라지는가").
심장 너머(뒤집힌 정원)도 여전히 건너야 안다.

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
심장 문의 방향             Play §5.4 는 "door Connector 하나로 들어간다" 까지다. **하나**이므로 양방향으로
                        두었다 (TREE_INNER_DOOR 의 선례 — 들어간 자리로 나온다). 되돌아오는 문을 따로
                        세우면 문이 둘이 되어 Design 의 "하나" 와 어긋난다
활성 조건이 되돌아올 때도    문이 하나이므로 조건도 하나다 — 패턴이 P2 가 아니면 심장에서도 나올 수 없다.
읽히는가                  갇히지는 않는다: 심장에는 걸음을 압력으로 바꾸는 규칙이 없으므로 혼자 있으면
                        패턴이 P2 에 멈춰 있고, 남이 미로를 걸어 패턴을 넘겼다면 계속 걸어 다시 P2 가 온다.
                        **미로 쪽의 "돌아가기" 는 심장을 꺼내 주지 않는다** — 그것은 같은 방 안의 일이다 (W14)
심장의 크기와 anchor 자리   Design 은 "심장에는 Region 과 뒤집힌 정원 쪽 문만 둔다"(확정 5)까지다.
                        HEART_LAKE 의 선례대로 anchor 말고 아무 것도 없는 작은 방으로 두었다 — 데이터다
"돌아가기" 가 debug 권한에   Play 는 "개발 명령 표면 재사용" 이라고 **표면**만 말한다. 뜻은 세계의 것이므로
걸리는가                  (Spec §16 이 exit.emergency 를 Region 의 성질로 적었다) 권한에 걸지 않았다 —
                        권한이 닫힌 세계에서 갇히면 그것이 비상구가 아니다.
                        걸리게 하려면 가용성 판정 한 줄이다
"돌아가기" 가 압력을 올리는가 규칙의 Trigger 는 "이동으로 자리가 바뀐다" 이고 이 옮김은 이동이 아니다 —
                        올리지 않는다. 올린다면 탈출로 패턴을 조작할 수 있게 되어
                        "걸어서 규칙을 쓴다" 는 이 Play 의 축이 흐려진다
비상 자리를 밝힌 방의 수     미로 하나다. 다른 아홉 방은 밝히지 않았으므로 그 방들에서는 명령이 가용하지 않다 —
                        Design 은 미로의 exit.emergency 만 주었고, 없는 곳에 지어내지 않는다
INVERTED_GARDEN 을        Play §5.4 가 "출구 하나: 뒤집힌 정원 쪽(문만, 방은 이 Play 밖)" 이라고 적었다.
경계로 두는 것             문만 세우고 이름은 경계 목록에 둔다 — RED_EYE_TREE · FANTASY_MAZE 가 그랬듯
                        그 방을 짓는 Play 가 이름을 가져간다
