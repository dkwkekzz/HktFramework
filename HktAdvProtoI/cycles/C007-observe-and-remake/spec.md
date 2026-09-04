# C007 — 보고 다시 만든다

```text
CYCLE          C007-observe-and-remake
SOURCE         content/roadmap/play/RoomBecomesLand.md §2 Play Goal(완료 확인 넷 중 셋째) ·
               §4 Breath(조망 · 더 채우고 싶음) · §5.4 · §5.5 · §6 E8·E9 · 불변 조건
               (근거: design/Plan-World-Authoring-Engine.md §3.4 Observation API · §4 1단계 ⑧⑨ ·
                §4 완료 조건 1~3 · content/roadmap/L2-World-Tool.md §4 파일 지도 ·
                content/roadmap/L2-World-Concept.md §3.6 검사 ①~④ ·
                content/roadmap/L2-World-Region.md §3.2 검사 ⑤~⑨)
SELECTED_FROM  Play Cycle Breakdown — "C007 — 보고 다시 만든다"
```

**확장 Cycle** — C001~C006 의 State/Rule 위에 더한다. 복사·재작성하지 않는다.
이 Cycle 은 **세계의 규칙을 하나도 더하지 않는다.** 더하는 것은 도구(읽기 전용 관찰)와
데이터 하나뿐이다 — 그것이 이 Cycle 의 주장이다.

## Playable Goal

`npm run world:observe -- <방> --height --surface --traversable --semantic --top-view --report` 를 돌리면
그 방의 땅이 PNG 다섯 장과 보고 한 장으로 나온다 — 내가 걸어 본 백왕령과 같은 산 · 같은 강 · 같은
막힌 자리다. 그리고 **숲 가장자리 파일에 stamp 하나를 더하고 다시 띄우면 그 방에 분지가 생긴다** —
`engine` 도 `content/world` 도 `content/view` 도 한 줄 바뀌지 않은 채로.

## Experience Intent

```text
Start   나는 백왕령을 걸어 봤지만 그 땅을 한 번에 본 적이 없다. 숲 가장자리는 여전히 평평하고,
        그것을 채우려면 무엇을 해야 하는지 확신이 없다.
End     한 장의 그림으로 내가 걸은 땅을 내려다본다 — 막힌 자리가 어디이고 조건이 어디까지인지 보인다.
        그리고 같은 방법으로 다음 방을 채울 수 있다는 것을 **직접 해 보아 안다**.
```

Play 의 Breath 중 **조망 → 더 채우고 싶음** 구간을 만든다. 이 Play 의 마지막 Cycle 이다.

## World Change

```text
① 없다. 세계의 규칙도 State 도 관찰 계약도 한 글자도 바뀌지 않는다 —
   이 Cycle 이 더하는 것은 읽기 전용 도구와 데이터뿐이다
② 숲 가장자리(FOREST_EDGE)의 space 에 op 가 하나 는다 — stamp(basin). 그 방의 hash 가 바뀐다.
   같은 코드가 그 데이터를 읽어 분지를 그리고, 세계는 그 경사를 C006 의 규칙 그대로 판정한다
```

## Observable Result

```text
① world:observe 가 그 방의 땅을 PNG 다섯 장으로 낸다 — 높이 · 표면 · 통행 · 의미 · 위에서 본 한 장
② 그림의 막힌 자리(통행)가 내가 걸어서 막힌 자리와 같다 — 강과 능선 꼭대기
③ 보고가 수를 읊는다 — chunk 수 · instance 수 · 격자 크기 · 표면 태그별 칸 수 · 막힘 사유별 칸 수 · hash
④ 보고가 검사 아홉을 읊는다 — 그래프 넷(⑤~⑧, 이미 있던 것)과 세계관 넷(①~④) 과 core rule 수(⑨)
⑤ 두 번 돌리면 글자 하나까지 같다 — 그림 파일의 바이트도 같다
⑥ world:shot 이 실제로 띄운 게임의 그 방을 PNG 로 낸다 — 그림과 걸어 본 것이 같은 땅이다
⑦ 숲 가장자리에 분지가 생긴다 — 데이터 한 덩이를 더했을 뿐이고 코드는 한 줄도 바뀌지 않았다
⑧ 그 분지의 급경사는 C006 의 규칙 그대로 몸을 세운다 — 새 방에 새 규칙이 필요하지 않았다
```

## Reuse

### Existing (그대로 쓴다)

```text
engine/world-authoring 전부 — compileRegion · buildHeightField · evaluateSurface · traversable 격자 ·
  areas/points · query(tagsAt · isTraversableAt · blockedReasonAt) · checkGraph(검사 일곱) · descriptionHash ·
content/regions 의 Description 아홉과 terrain-rules 의 규칙 표(COMPILE_RULES) ·
tools/world-editor/observe.ts 의 --graph (방 · Connector · 중첩 · 경계 · 검사) 와 그 표 그리는 방식 ·
tools/fx-lab/test/_common.js 의 playwright 띄우기(CHROMIUM_PATH) 와 tools/cycle-shot 의 촬영 선례 ·
vite.config.ts 의 검증용 손잡이(HKT_SPAWN · HKT_SPAWN_REGION · HKT_NPCS) ·
C006 의 이동 규칙 · 사유 코드 · 조건 투영 — 하나도 바꾸지 않는다
```

### Added (이 Cycle 이 세운다)

```text
Engine     engine/world-authoring/observe.ts — 컴파일 결과를 **숫자 버퍼**로 래스터한다
           (높이 · 표면 · 통행 · 의미) + 요약 수치. PNG 도 색도 게임 명사도 모른다 (Plan §3.4)
Tools      tools/world-editor/observe.ts 에 방 하나를 보는 길을 더한다 — 인자 · 색 표 · 검사 ①~④ ·
           보고. PNG 인코딩은 tools 의 것 (node:zlib 으로 — 의존성을 더하지 않는다)
           tools/world-editor/shot.ts — world:shot (playwright · terrain-shot 선례)
           tools/world-editor/compile.ts — world:compile (같은 방을 두 번 컴파일해 hash 를 읊는다)
Data       content/regions/forest-edge.ts 에 stamp(basin) 하나
World      없음
View       없음
Protocol   없음
```

## Out of Scope

```text
컴파일 산출을 파일로 굽는 것(*.compiled.generated.ts)   없음(다음 Play/부채) — Plan §3 이 예고했지만
    이것을 읽을 소비처가 아직 없다. 세계와 관찰자가 켤 때 컴파일하는 것으로 지금 충분하고,
    굽기는 생성물의 낡음(stale) 문제를 함께 데려온다. world:compile 은 hash 를 읊는 데까지
lab 페이지(top view · op 목록 · 재컴파일)                Plan §2.2-7 이 "후순위" 로 둔 것. 지금 필요가 없다
scatter · random(seed) 로 놓는 장식                     이 Play 가 요구하지 않는다 (E6 의 나머지)
검사 ①②④ 가 가리키는 layer 를 데이터로 놓는 것          resource · hazard · phenomenon 은 컨텐츠 층 주입의 것.
    (resource · hazard · phenomenon)                    도구는 그 자리를 읽을 뿐 채우지 않는다
Region 을 새로 짓는 것 · 새 규칙                          이 Cycle 은 규칙을 하나도 더하지 않는다
```

## SPEC

```text
SPEC-001  땅이 그림 다섯 장이 된다
          조건   world:observe 로 백왕령을 넷과 위에서 본 한 장으로 낸다
          기대   PNG 다섯이 나온다 — 높이 · 표면 · 통행 · 의미 · 위에서 본 것. 크기는 그 방의 격자에서
                나오고(41×41 vertex → 41×41 픽셀), 세계는 하나도 바뀌지 않는다
          경계   무엇도 밝히지 않으면 아무 그림도 쓰지 않는다 — 지금처럼 --graph 를 읊는다

SPEC-002  그림이 컴파일 결과 그대로다
          조건   래스터 넷을 컴파일 결과와 맞춰 본다
          기대   높이 그림의 밝기는 그 격자의 height 를 최소~최대로 편 값이고, 표면·통행·의미 그림의
                색은 그 칸의 태그 색인이다. 격자와 픽셀이 1:1 이다
          경계   막힌 칸이 하나도 없는 방(데이터가 없는 여덟 방)의 통행 그림은 한 색이다

SPEC-003  막힌 자리가 걸어서 막힌 그 자리다
          조건   통행 래스터에서 막힌 칸을 고르고, 세계에 그 자리로 이동을 요청한다
          기대   거절되고 사유가 같다 (급경사 · 물). 통행 가능한 칸으로는 받아들여진다
          경계   그림의 어느 칸도 세계의 판정과 어긋나지 않는다 — 그림과 세계는 같은 컴파일에서 나온다

SPEC-004  보고가 수를 읊는다
          조건   --report 로 백왕령을 본다
          기대   격자 크기 · chunk 수 · instance 수 · 표면 태그별 칸 수 · 막힘 사유별 칸 수 ·
                area 수 · point 수 · hash 가 나온다. 수는 컴파일 결과에서 세고 도구가 정하지 않는다
          경계   데이터가 없는 방의 보고도 나온다 — instance 0 · area 0 · 막힘 0

SPEC-005  보고가 검사 아홉을 읊는다
          조건   --report 로 검사를 본다
          기대   그래프 검사(⑤~⑧ · checkGraph 그대로)와 세계관 검사(① 자원과 위험이 같은 근원인가 ·
                ② 깊이 없는 자리 · ③ 조건 없이 선 settlement · ④ Region 의 phenomenon 수)와
                ⑨ core rule 수가 함께 나온다. **판정하지 않는다** — 수와 목록을 적을 뿐이다
          경계   ③ 은 실제로 답을 낸다 — 백왕령의 city 는 condition 셋을 곁에 두고 있고,
                아직 아무 layer 도 없는 검사(① ② ④)는 "놓인 것이 없다" 로 적힌다

SPEC-006  두 번 돌리면 같다
          조건   같은 명령을 두 번 돌린다
          기대   글자가 같고 PNG 의 바이트가 같다. 시각·난수·Map 순회 순서에 기대지 않는다
          경계   world:compile 로 같은 방을 두 번 컴파일하면 hash 가 같다 (Plan 완료 조건 1)

SPEC-007  관찰은 세계를 바꾸지 않는다
          조건   observe · compile 을 돌린 앞뒤로 저장소를 본다
          기대   밝힌 그림 파일 말고는 아무것도 쓰지 않는다. content 도 engine 도 건드리지 않는다
          경계   모르는 인자·모르는 방 이름에는 아는 것을 밝히고 아무것도 하지 않는다 (C004 의 어법 그대로)

SPEC-008  띄운 게임을 찍는다
          조건   world:shot 으로 방 하나를 밝혀 찍는다
          기대   실제로 띄운 게임의 그 방이 PNG 로 나온다. 어느 자리에서 볼지 밝힐 수 있다
          경계   브라우저가 없으면 무엇이 없는지 말하고 멈춘다 — 조용히 빈 그림을 남기지 않는다

SPEC-009  데이터 하나가 새 땅을 만든다
          조건   숲 가장자리의 space 에 stamp(basin) 하나를 더하고 세계를 띄운다
          기대   그 방에 분지가 생긴다. 그 방의 hash 가 바뀌고, 표면 태그가 경사를 따라 갈린다
          경계   `git diff --stat -- engine content/world content/view` 가 비어 있다 —
                변한 것은 content/regions 하나다 (Play 완료 확인 1)

SPEC-010  새 땅에 새 규칙이 필요하지 않다
          조건   그 분지의 급경사 자리로 이동을 요청한다
          기대   C006 의 규칙 그대로 거절되고 사유가 같다 (급경사). 규칙은 한 글자도 늘지 않았다
          경계   분지의 완만한 자리로는 이동이 받아들여진다. 나머지 일곱 방은 여전히 평평하다
```

## State

```text
Region.space.ops[]   REUSED — 숲 가장자리에 값이 하나 는다 (stamp basin). 형은 이미 있다
Region.hash          REUSED — 그 방의 값이 바뀐다
WorldState           CHANGED 없음 — 이 Cycle 은 세계의 State 를 하나도 더하지 않는다
```

이 Cycle 의 데이터 값:

```text
FOREST_EDGE   stamp(basin) — 중심 · 반경 · 깊이 · falloff 는 데이터다.
              C006 의 임계(45°)에서 급경사가 실제로 생기되 방을 가로지르는 길은 남아야 한다
래스터 색      높이(회색 눈금) · 표면/통행/의미(태그별 색) — 도구의 표. 게임의 색과 같을 필요가 없다
```

## Rule

```text
R1  모든 Rule                    REUSED — 이 Cycle 은 세계의 규칙을 하나도 더하지도 고치지도 않는다.
                                **그것이 이 Cycle 의 주장이다** — 새 방은 데이터로 채워진다
R2  RULE-MOVE-001                AFFECTED — 대상 집합만 는다. 숲 가장자리에도 막히는 칸이 생긴다.
                                전제도 사유 코드도 그대로다 (SPEC-010)
R3  관찰 · 영속                   REUSED — 봉투도 STATE_VERSION 도 그대로다
```

## REUSED / ADDED

```text
REUSED   Rule 전부 · 사유 코드 전부 · protocol 전부 · 관찰 계약 전부 · STATE_VERSION ·
         컴파일러와 규칙 표 · checkGraph · --graph 보고
ADDED    engine/world-authoring/observe.ts (래스터·요약 — 숫자만) ·
         tools 의 방 관찰(PNG·색 표·검사 ①~④·보고) · world:shot · world:compile ·
         숲 가장자리의 stamp op 하나
CHANGED  없음 — engine 의 기존 export 도, content/world 도, content/view 도, content/protocol 도
AFFECTED 숲 가장자리에서 걸을 수 있는 자리 (규칙이 아니라 데이터가 바꾼다)
```

## Observable (관찰 계약)

**하나도 바뀌지 않는다.** 봉투의 형도 값의 갈래도 그대로다 — `content/protocol` 을 손대지 않고
`STATE_VERSION` 도 그대로다. 숲 가장자리의 `region.hash` 값만 데이터가 늘어 달라진다.

이 Cycle 의 관찰은 **게임 밖**에 있다 — 도구가 파일로 낸다. 그것이 이 Cycle 의 성질이다:
관찰자가 화면에서 보는 것은 하나도 바뀌지 않고, 만드는 사람이 보는 것이 는다.

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
래스터의 크기와 색           격자 vertex 하나 = 픽셀 하나로 둔다 (해상도를 도구가 정하지 않는다).
                          색은 도구의 표이고 게임의 색과 다르다 — 통행 그림은 막힘/통행 둘로
                          갈리는 것이 목적이므로 게임의 지면색을 따라갈 이유가 없다
높이 그림의 눈금             그 방의 최소~최대를 0~255 로 편다. 절대 눈금을 쓰면 평평한 여덟 방이
                          전부 검은 그림이 되어 아무것도 읽히지 않는다. 보고가 실제 최소·최대를 적는다
검사 ①②④ 가 빌 때           resource · hazard · phenomenon 은 아직 이 세계에 없다 (컨텐츠 층 주입의 것).
                          "위반 0" 이 아니라 "놓인 것이 없다" 로 적는다 — 없는 것을 통과로 적으면
                          검사가 거짓말을 한다. Concept §3.6 도 "원인 없이 놓인 것" 만 잡는다고 했다
검사 ② 의 "깊이"            Concept 은 "depth 태그 없는 area" 라고 적었으나 이 세계의 depth 는 area 가
                          아니라 Region 이 갖는다 (regions/spec.ts). 그래서 depth 없는 **Region** 을
                          센다 — 뜻("모든 자리는 깊이를 가진다")은 그대로다
검사 ⑨ core rule 수         이 세계에는 아직 Region 별 rule 이 없다 (RuleBoundRoom 이 세운다).
                          0 을 적는다 — 보고만 하고 판단하지 않는다는 것이 §3.2 의 지시다
분지 stamp 의 값             중심 · 반경 · 깊이 · falloff 는 데이터다 (C005 의 ridge 선례).
                          "숲 가장자리에 basin 하나" 만 Play §5.5 가 준 것이다
world:compile 이 굽지 않는 것 Out of Scope 참고. 완료 조건 1 이 요구하는 것은 "두 번 돌려 같은 hash" 이고
                          그것은 굽지 않고도 성립한다
```
