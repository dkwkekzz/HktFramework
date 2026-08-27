# CYCLE C-TERRAIN-002 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable   (자동 — 실제 클라이언트에서 돌렸다. **사람의 손은 아직 아니다**)
[PASS] Regression

## NEW BEHAVIOR

    법칙이 몸에서 거둔다        → 거둔 만큼이 **그 자리에 쌓인다** (세계의 열이 줄지 않는다)
    쌓인 것이 넘침에 이른다      → 그 자리가 **뿜기 시작한다** (phase binding → venting)
    뿜는 자리 안에 있다         → 그 법칙이 **그 자리에서 멎는다** (거두지 않는다)
    뿜는 자리 안이고 덜 찼다     → **열이 돌아온다** (self.state = warming)
    뿜는 자리 안이고 가득하다    → 받지 않는다 (sheltered) — 분출구를 소모하지 않는다
    받는 몸이 없다              → 흩어진다 (escapeRate 1.5/초)
    지닌 것을 다 썼다           → **닫히고 도로 거둔다** (venting → binding) — 반복이다

## WORLD SCENARIO — 실측

    세계를 직접 굴려 찍은 값이다 (View 없이 · `driveWorld` · dt 1/30 · 2.5초마다).
    관찰자의 몸을 zone-vein-4 중심 부근(-9, 9)에 두고 **아무 요청도 보내지 않았다.**

```text
    t |  온기 | 내 상태   | 발밑 vein-4   | 저쪽 vein-1   | self 패널의 줄             | 발밑 자리의 이름 | 맥동
------+-------+-----------+---------------+---------------+----------------------------+------------------+-----
  0.0 |  100 | taking    | binding  50% | venting 100% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 50%       | —
  2.5 |   90 | taking    | binding  67% | venting  94% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 67%       | —
  5.0 |   80 | taking    | binding  83% | venting  88% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 83%       | —
  7.5 |   70 | taking    | binding 100% | venting  81% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 100%      | —
 10.0 |   85 | warming   | venting  75% | venting  75% | 해숨구멍 — 열을 돌려받는 중           | 해숨구멍 · 남은 75%    | 0.75
 12.5 |  100 | warming   | venting  50% | venting  69% | 해숨구멍 — 열을 돌려받는 중           | 해숨구멍 · 남은 50%    | 0.50
 15.0 |  100 | sheltered | venting  44% | venting  63% | 해숨구멍 — 여기서는 멎는다            | 해숨구멍 · 남은 44%    | 0.44
 17.5 |  100 | sheltered | venting  37% | venting  56% | 해숨구멍 — 여기서는 멎는다            | 해숨구멍 · 남은 37%    | 0.37
 20.0 |  100 | sheltered | venting  31% | venting  50% | 해숨구멍 — 여기서는 멎는다            | 해숨구멍 · 남은 31%    | 0.31
 22.5 |  100 | sheltered | venting  25% | venting  44% | 해숨구멍 — 여기서는 멎는다            | 해숨구멍 · 남은 25%    | 0.25
 25.0 |  100 | sheltered | venting  19% | venting  38% | 해숨구멍 — 여기서는 멎는다            | 해숨구멍 · 남은 19%    | 0.19
 27.5 |  100 | sheltered | venting  12% | venting  31% | 해숨구멍 — 여기서는 멎는다            | 해숨구멍 · 남은 12%    | 0.12
 30.0 |  100 | sheltered | venting   6% | venting  25% | 해숨구멍 — 여기서는 멎는다            | 해숨구멍 · 남은 6%     | 0.06
 32.5 |  100 | taking    | binding   0% | venting  19% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 0%        | —
 35.0 |   90 | taking    | binding  17% | venting  13% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 17%       | —
 37.5 |   80 | taking    | binding  34% | venting   6% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 34%       | —
 40.0 |   70 | taking    | binding  50% | venting   0% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 50%       | —
 42.5 |   60 | taking    | binding  67% | binding   0% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 67%       | —
 45.0 |   50 | taking    | binding  84% | binding   0% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 84%       | —
 47.5 |   40 | warming   | venting 100% | binding   0% | 해숨구멍 — 열을 돌려받는 중           | 해숨구멍 · 남은 100%   | 1.00
 50.0 |   55 | warming   | venting  75% | binding   0% | 해숨구멍 — 열을 돌려받는 중           | 해숨구멍 · 남은 75%    | 0.75
 52.5 |   70 | warming   | venting  50% | binding   0% | 해숨구멍 — 열을 돌려받는 중           | 해숨구멍 · 남은 50%    | 0.50
 55.0 |   85 | warming   | venting  25% | binding   0% | 해숨구멍 — 열을 돌려받는 중           | 해숨구멍 · 남은 25%    | 0.25
 57.5 |  100 | taking    | binding   0% | binding   0% | 빙원 — 열을 거두어 가는 중           | 빙원 · 찬 0%        | —
```

    읽는 법 — 네 순간이 이 Cycle 이다.

        t = 0.0    발밑은 거두는 자리(찬 50%)이고, 열려 있는 것은 **저쪽**이다(남은 100%)
        t = 7.5    발밑이 **찬 100%** — 내가 준 열 30 이 그 자리에 다 쌓였다
        t = 10.0   발밑이 **venting** 이 되었고 내 상태가 `warming` —
                   온기가 70 → 85 로 **올라간다.** 나는 한 걸음도 옮기지 않았다
        t = 42.5   저쪽이 **binding 0%** — 어제 쉬어 간 자리가 닫혔다
        t ≥ 47.5   차고 → 넘치고 → 비고 → 다시 찬다. 25초 주기의 **반복**이며,
                   그 주기는 세계가 정한 것이 아니라 내가 거기 서 있었기 때문이다

    보존 대조 — t = 0 에서 온기 100 + 발밑 30(50%) = 130.
    t = 7.5 에서 온기 70 + 발밑 60(100%) = 130. **한 점도 만들거나 지우지 않았다.**

## VIEW FIXTURE

    view/tests/terrain.spec.ts — 25 통과 (World 미기동, Fixture 만으로)

    ground-taking.fixture.json     맥 넷 · fill 1.0 / 0.75 / 0.25 / 0.5 · 하나 venting
    ground-warming.fixture.json    **새 fixture** · self.state = warming
    ground-sheltered.fixture.json  self.state = sheltered

    확인된 것   `빙원 · 찬 75%` · `해숨구멍 · 남은 100%` 이름이 나온다 ·
               fill 0.75 가 fill 0.25 보다 진하다 · 뿜는 자리만 intensity 를 지닌다 ·
               계약에 saturation·kept 가 없다 (화면이 넘침을 판정할 수 없다) ·
               `돌려받는 중` ≠ `여기서는 멎는다` · 미등록 상태 코드도 그려진다

## PLAYABLE — 실제 클라이언트에서

    `npm run terrain:shot` (Vite + Chromium · 560×420). 세계에 붙어 빙원 안에 서고,
    **조작을 하나도 하지 않은 채** 머물렀다. 그림 둘을 찍었다 — 열리기 전과 열린 뒤.

    self 패널 (열리기 전 · 세계 시간 5s)
        온기 88/100
        빙원 — 열을 거두어 가는 중

    self 패널 (열린 뒤 · 세계 시간 44s)
        온기 89/100
        해숨구멍 — 열을 돌려받는 중

    땅 위에 그려진 자리 이름 — **둘이 서로 바뀌었다**

        열리기 전     왼쪽 자리 `해숨구멍 · 남은 13%`   발밑 `빙원 · 찬 75%`
        열린 뒤       왼쪽 자리 `빙원 · 찬 0%`         발밑 `해숨구멍 · 남은 74%`

        이것이 Cycle Goal 의 화면이다 — 어제 쉬어 간 자리가 닫혀 있고, 내가 서 있던
        자리가 열려 있다. 좌표는 하나도 바뀌지 않았고 **그 자리의 지금**만 바뀌었다.

    자동 판정 (terrain-shot.js)

        지금 걸린 법칙이 읽힌다 (③)         OK
        거두어 가는 중임이 읽힌다 (③)        OK
        지닌 열이 읽힌다 (④)                OK
        열이 실제로 줄었다 (④)              OK
        머문 자리가 분출구가 되었다 (⑦)      OK
        열이 돌아온다 (⑧)                   OK
        돌아온 열이 실제로 늘었다 (⑧)        OK
        페이지 오류 0                       OK
        종합                                OK

## REGRESSION

    AFFECTED 로 표시한 것 전부를 돌렸다 (03-world-semantic.md).

    RULE-GROUND-LAW-APPLY-001 (CHANGED)
        C-TERRAIN-001 의 검사 전부가 world/tests/terrain.spec.ts 에 그대로 있다 —
        자리 밖 무변화 · 시간 비례 · 몸이 상하지 않음 · 누구인지 묻지 않음 ·
        다한 뒤 생명 · 쓰러진 몸 제외. 값 하나도 달라지지 않았다.
    RULE-DOWNED-001 (AFFECTED)
        끝의 형태가 그대로다 — 열이 다하고 생명이 다하면 `downed` 다.
    기존 플레이 (C001~C026)
        원점에서 시작하는 플레이가 땅에 닿지 않는다 (검사로 확인).
        빙원이 시작 자리 다섯 · 광맥 · npc 순회 경로 어디와도 닿지 않는다 (검사로 확인).
    전체
        npm test — 82 파일 · **1489 통과** (이 Cycle 전 1461 · +28)
        npm run catalog:check — 카탈로그 3원소가 정합한다
        npm run boundary:check — 경계 위반 0
        npm run master:graph:check — 정합성 통과

## MASTER FEEDBACK

    WorldState Overlay — 01-cycle.md 의 Target WorldState 가 가리킨 셋

        MW-TERRAIN-CIRCULATION   ABSENT → **PRESENT**
            근거: 위 WORLD SCENARIO. 자리가 거둔 것을 지니고, 넘치고, 뿜고, 비고,
            다시 찬다. 그 world_shape 가 요구한 "같은 자리를 다른 시각에 보면 다르고,
            그 다름이 그 사이에 무슨 일이 있었는가로 설명된다" 가 성립한다 —
            25초 주기는 세계가 정한 것이 아니라 그 자리에 누가 서 있었는가의 결과다.
        MW-NATURAL-REFUGE        PARTIAL → **PRESENT**
            근거: 예외가 놓이지 않는다. `GroundZoneRole` 이 세계에서 사라졌으므로
            "왜 하필 거기가 안전한가" 에 세계가 답한다 — 거기에 열이 모였기 때문이고,
            열이 모인 것은 누군가 거기서 빼앗겼기 때문이다. 그리고 옮겨 가고 사라진다.
        MW-SURVIVAL-PRESSURE     PARTIAL → **PARTIAL (넓어짐)**
            압력이 이제 순환에서 나온다 — 읽어서 이용할 거리가 생겼다. 다만 world_shape 의
            "법칙을 읽은 사람과 읽지 못한 사람이 다른 결과를 낸다" 는 아직 절반이다:
            지금 상태는 읽히나 **앞으로 일어날 일**은 읽히지 않는다. 그 절반이
            FR-THE-LAND-SHOWS-BEFORE-IT-TAKES 다.

        MW-MACRO-TERRAIN 은 PARTIAL 그대로다 — 법칙이 여전히 하나이고, 그 법칙이 낳는
        자원이 없으며, 깊이와의 직교도 없다 (그 셋은 이 Cycle 의 EXCLUDED 였다).

    Capability Overlay
        없음 — 이 Cycle 은 Capability 를 Target 으로 삼지 않았다 (01 MASTER TRACE).

    Constraint Evaluation

        DC-WORLD-TERRAIN-IS-A-PRINCIPLE          PARTIAL → **SATISFIED**
            그 Constraint 의 requires 는 "어떤 상태를 어떤 조건에서 **반복** 변화시키는지"
            인데 C-TERRAIN-001 이 세운 것은 반복이 아니라 지속이었다 (그 Cycle 이 스스로
            판정을 고쳐 올렸다). 위 WORLD SCENARIO 의 25초 주기가 그 반복이다.
        DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION   SATISFIED (**형태로 닫힘**)
            C-TERRAIN-001 은 예외가 자기가 멎게 하는 법칙의 이름을 지니게 해서
            "모든 것을 막는 안전지대" 를 적을 수 없게 했다. 이 Cycle 은 한 걸음 더 갔다 —
            **어떤 안전지대도** 적을 수 없다. 형이 없다 (검사가 그것을 지킨다).
        DC-CONDITION-OPENS-WITHOUT-RECORDING     SATISFIED (**몸에 대해**)
            몸에는 한 항목도 늘지 않았다. State 가 는 곳은 땅이며, 땅의 State 는 판정을
            위한 기록이 아니라 세계가 겪은 일의 결과다 (광맥의 남은 자원과 같은 종류).
        DC-WORLD-OWNS-THE-SURFACE-LIST           SATISFIED
            화면은 `fill` 을 **받는다** — kept 도 saturation 도 계약에 없으므로 나누지
            못하고, 그래서 "곧 넘친다" 를 스스로 판정할 수 없다. 검사가 그것을 지킨다.
        DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE       UNRESOLVED (예정대로)
            증거가 **먼저** 오는 절은 다음 후보의 몫이다. 이 Cycle 은 그 예고가 예고할
            거리를 만들었다 — 이제 자리마다 fill 이 있고 넘칠 시각이 정해진다.

    Constraint Candidate
        없음 — 이 Cycle 에서 새로 관찰된 반복 패턴이 없다.

    Master Gap
        **`MW-CIRCULATION-EVIDENCE` 가 ABSENT 인 채로 남는다** — 그리고 그것이 이제
        다음 후보의 Target 이다. Master 가 이 Cycle 중에 그 노드를 세웠으므로
        (BT §15.8 주입), FR-THE-LAND-SHOWS-BEFORE-IT-TAKES 는 처음으로
        "Capability 를 Target 으로 삼지 않는다" 가 아니라 **그 노드를 연다** 고 적을 수 있다.

        그리고 순환이 섰으므로 그 아래가 열렸다 — `MW-ADAPTED-LIFE`(무엇이 어디 사는가) ·
        `MW-TERRAIN-RESOURCE`(그 법칙이 낳는 자원) · `MW-NATURAL-SETTLEMENT`(정착) 셋이
        전부 ABSENT 이고 이제 **매달릴 자리가 있다.** 이것이 이 Cycle 의 값어치다:
        세운 것은 열 게이지가 아니라 그 셋이 놓일 바닥이다.

    다음 후보 (Frontier)
        `FR-THE-LAND-SHOWS-BEFORE-IT-TAKES` — 순서 경고가 "이쪽을 먼저, 예고를 바로
        다음에" 라고 적었고 이쪽이 닫혔다. 이제 예고할 거리가 실제로 있다:
        자리마다 fill 이 있고, 그 값이 어느 속도로 오르는지가 정해져 있다.

## FAILURES

    없음.

## 못 한 것 · 확인하지 못한 것

    1. **HUD 가 겹쳐 읽기 어렵다.** 찍은 그림에서 디버그 패널과 self 패널이 서로 겹쳐
       글자가 포개진다. 이 Cycle 이 만든 문제가 아니고(C-TERRAIN-001 의 그림도 같다)
       세계·관찰 계약과 무관하므로 **VIEW 레인의 일**이다 — works/BACKLOG.md 로 보고한다.
    2. **자리 이름의 퍼센트가 오르는 것을 브라우저 자동 판정으로 닫지 못했다.**
       라벨이 캔버스 안 스프라이트라 DOM 에서 읽히지 않는다. 두 그림을 사람이 비교하는
       것과 fixture 검사가 그 자리를 대신한다 (07 NOTES 4).
    3. **여러 몸이 한 분출구에서 동시에 받는 경우를 플레이로 보지 못했다.** 규칙 검사로만
       확인했다 (몸마다 ventRate 를 받고 총량이 kept 로 잘린다). 지금 세계에 관찰자가
       하나뿐이라 그렇다.
    4. `npm run terrain:shot` 은 이 환경에서 `CHROMIUM_PATH` 를 주어야 돈다 (번들 크로뮴
       판이 환경의 것과 어긋난다). 도구가 이미 그 훅을 지녔으므로 고치지 않았다.

## STATUS

    IN PROGRESS — **Human Play 대기**

    Cycle Completion Gate 15항 중 열넷이 참이다. 남은 하나는 14번
    "인간이 실제 게임에서 Cycle Goal 달성을 확인했다" 이며, 위 PLAYABLE 은 자동 촬영이지
    사람의 손이 아니다. verification.md 의 Must 가 "최종 판정은 Human Play 이후에
    COMPLETE 로 바꾼다" 고 못 박으므로 여기서 멈춘다.

    Human 이 할 일 — 2분

        npm run dev
        빙원(화면 왼쪽 위 · 푸른 원 넷)까지 걸어 들어간다
        **아무것도 하지 않고 8초쯤 서 있는다**

        봐야 할 것 셋
          ① 발밑 자리의 이름에서 `찬 NN%` 가 오르는가
          ② 100% 가 되는 순간 그 자리가 `해숨구멍 · 남은 NN%` 로 바뀌고 맥동하는가
          ③ self 패널의 줄이 `빙원 — 열을 거두어 가는 중` 에서
             `해숨구멍 — 열을 돌려받는 중` 으로 바뀌고 온기가 **오르는가**

        그리고 하나 더 — 처음 열려 있던 왼쪽 자리가 40초쯤 뒤에 닫히는가.
        그것이 "어제 쉬어 간 자리가 오늘은 닫혀 있다" 다.
