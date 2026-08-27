# CYCLE C-TERRAIN-003 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable   (자동 — 실제 클라이언트에서 돌렸다. **사람의 손은 아직 아니다**)
[PASS] Regression

## NEW BEHAVIOR

    세계가 만들어진다            → 자리들이 목록에서 베껴지지 않고 **씨앗에서 태어난다**
    같은 씨앗으로 다시 띄운다     → **같은 땅**이다 (배치 · 지닌 것 · 단계까지)
    다른 씨앗으로 띄운다         → **다른 땅**이다 — 그러나 같은 법칙으로 설명된다
    어느 씨앗이든               → 맥은 이웃하여 밭으로 뻗고, 가장 찬 맥이 해숨구멍으로
                                  태어나고, 시작 자리·붙박이 위에는 서지 않는다
    태어난 뒤                   → 거둠 · 넘침 · 뿜음 · 닫힘이 **변경 없이** 그대로 돈다

## WORLD SCENARIO — 실측

    세계를 직접 굴려 찍은 값이다 (View 없이 · driveWorld).

    ① 씨앗이 세계를 정한다 — 셋을 낳아 보았다

```text
    씨앗 1 (기본):  zone-1 (-12.6,  9.6) venting 100%   ← 오늘의 해숨구멍
                    zone-2 ( -7.6,  9.6) binding  67%
                    zone-3 ( -7.6, 14.6) binding  36%
                    zone-4 ( -2.6,  9.6) binding  10%
    씨앗 2:         (-13.4,-14.0) 47% · (-8.4,-14.0) 56% · (-8.4,-9.0) 7% · (-3.4,-14.0) venting
    씨앗 42:        (-10.3,-11.1) 8% · (-5.3,-11.1) venting · (-0.3,-11.1) 11% · (-10.3,-6.1) 8%

    같은 씨앗(1) 두 번 → 배치·지닌 것·단계까지 동일: true
```

    셋 다 맥 넷이 이웃(중심 사이 5.0)으로 뻗고, 뿜는 맥이 정확히 하나이며, 시작 자리
    (0,0)·광맥·순회 경로 어디도 품지 않는다. 씨앗 20개 구조 불변식은
    world-genesis.spec.ts 가 돌려 지킨다.

    ② 태어난 세계 위에서 순환이 그대로 돈다 — (-0.6, 9.6) 에 서서 아무것도 하지 않았다

```text
    t |  온기 | 내 상태   | 발밑 zone-4    | 태어난 해숨구멍 zone-1
  0.0 |  100 | taking    | binding  10%  | venting 100%
  5.0 |   80 | taking    | binding  44%  | venting  88%
 12.5 |   50 | taking    | binding  94%  | venting  69%
 15.0 | 55.6 | warming   | venting  84%  | venting  63%   ← 발밑이 넘쳐 열렸다
 20.0 | 85.6 | warming   | venting  34%  | venting  50%   ← 열이 돌아온다
 30.0 |   86 | taking    | binding  23%  | venting  25%   ← 발밑이 닫혀 도로 거둔다
 40.0 |   46 | taking    | binding  90%  | venting   0%
 50.0 | 90.6 | warming   | venting  15%  | binding   0%   ← 태어난 해숨구멍이 닫혔다
 60.0 | 65.6 | taking    | binding  57%  | binding   0%
```

    태어난 자리가 C-TERRAIN-002 의 시간(거둠→넘침→뿜음→닫힘)을 **한 줄의 규칙 변경도
    없이** 돈다 — INTENT-BIRTH-DOES-NOT-CHANGE-THE-TURNING-001 의 실측이다. 그리고
    태어날 때 열려 있던 해숨구멍은 아무도 받지 않아 40초에 닫혔다 — 어제의 예외가
    오늘은 없다.

## VIEW FIXTURE

    view/tests/terrain.spec.ts 27/27 — World 미기동.
    새 검사 둘: 진단 표면(C)을 켜면 self 패널에 `세계 씨앗 1` 한 줄 · 평시 표면은
    그리지 않는다. 기존 지시(범위 · 색 · 이름의 퍼센트) 검사는 fixture 그대로 통과 —
    태어난 자리도 같은 계약으로 그려진다는 것의 증거다.

## PLAYABLE — 자동 (실제 클라이언트)

    npm run terrain:shot (CHROMIUM_PATH 지정 · HKT_SPAWN=-0.55,9.62 — 태어난 zone-4 안).
    실제 vite 클라이언트가 세계에 붙어 돌았고 두 그림이 남았다 (같은 자리 · 다른 시각):

        열리기 전   self 패널 `온기 92/100` · `빙원 — 열을 거두어 가는 중`,
                    땅 위에 `빙원 · 찬 67%` · `빙원 · 찬 1%` (태어난 맥들의 이름)
        열린 뒤     `해숨구멍 — 열을 돌려받는 중` · 땅 위에 `해숨구멍 · 남은 81%`
                    — 내가 머문 발밑이 넘쳐 분출구가 되었다

    도구 판정 8 중 7 OK. 실패 1(돌아온 열이 before 보다 큰가)은 도구가 손배치 시절
    타이밍(발밑 50% 찬 맥)을 전제한 것이다 — 태어난 발밑은 10% 라 더 오래 거둬진 뒤
    회복 **초입**에 그림이 찍혔다 (92 → 41 · 상태는 이미 "돌려받는 중"). 회복이 실제로
    일어나는 것은 위 WORLD SCENARIO 의 t=15→20 (55.6 → 85.6) 이 닫는다. 도구의 그
    전제는 이 Cycle 의 대상이 아니다 (기존 도구 · 세계 계약 무변).

## REGRESSION

    npm test — 89 파일 · **1662 통과** (병합 직후 1551 → 신규 포함 · 실패 0)
    AFFECTED 재실행:
        RULE-GROUND-LAW-APPLY-001 · RULE-GROUND-VENT-001 — terrain.spec 의 규칙 검사가
            자체 자리로 변경 없이 통과 (거둠·보존·넘침·뿜음·닫힘 전부)
        C-TERRAIN-001·002 의 관찰·플레이 시나리오 — 태어난 자리에서 **읽어** 재구성해
            전부 통과 (taking · warming · sheltered · none · 옮겨 가는 예외 · 가로지르기)
        growth.spec 의 땅 관련 검사 — 낡은 role 참조를 정정하고 통과
        원점 시작 플레이 — 땅에 닿지 않는다 (QUIET 보장 · 5초 온기 100 유지)
    catalog:check 정합 · boundary 0 · lanes:check 맞음 · master:graph:check 정합.
    스냅샷 영속 — STATE_VERSION 3→4: 옛 스냅샷은 복구 포기 → 새 세계 (마이그레이션
    없음 · C-TERRAIN-002 와 같은 처리).

## MASTER FEEDBACK (보고 — 반영은 Master 가 최신 main 위에서)

    Overlay 변화 보고

        MW-SHAPED-LANDFORM        ABSENT → **PARTIAL 제안**
            선 것    자리의 배치가 손이 아니라 순환의 원리(씨앗·법칙)에서 나온다 —
                     "법칙이 그 생김새의 원인이어야 한다" 의 절반이 섰다.
                     맥은 흩어진 점이 아니라 이웃으로 뻗은 밭이다
            남은 것  world_shape 의 나머지 — 산맥·수계·대기 같은 실제 생김새가 없다
                     (무대는 여전히 평면 · 자리의 분포까지만)
        MW-WORLD-PRESSURE         ABSENT → **PARTIAL 제안**
            선 것    "표현될 자리가 없다" 던 implemented_note 의 그 자리가 생겼다 —
                     세계가 만들어질 때 에너지의 분포(씨앗의 표본열)가 먼저 서고
                     자리들이 그 결과다. 발현 하나(heat-binding)에 한한다
            남은 것  지역 개념 · 여러 법칙 · Free/Bound 의 세계 표현
        MW-TERRAIN-SUNEATER-ICEFIELD  PARTIAL 그대로 — 풍경(검은 빛·서리 무늬)은 여전히 없다

    Constraint Evaluation

        DC-WORLD-TERRAIN-IS-A-PRINCIPLE          SATISFIED — 생성이 테마가 아니라
            조건과 결과다. 법칙의 정의(veins·veinRadius·veinStride)가 낳고, 자리마다
            손으로 정하는 값이 없다
        DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION   SATISFIED — **시작 배치조차 손이 놓지
            않는다.** 손배치가 남긴 마지막 자리(GROUND_ZONES)가 사라졌고, 태어난
            해숨구멍은 계산된 포화의 결과다
        DC-WORLD-OWNS-THE-SURFACE-LIST           SATISFIED — 새 판정 표면 없음.
            genesisSeed 는 값이지 판정이 아니고, 진단 표면에서만 그려진다
        DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE       UNRESOLVED (예정대로) — 예고는 여전히
            다음 후보(FR-THE-LAND-SHOWS-BEFORE-IT-TAKES)의 몫이다

    Constraint Candidate

        없음 — 새로 관찰된 반복 패턴 없음. ("목록을 씨앗으로 바꾼다" 는 아직 한 번이다 —
        광맥·붙박이가 같은 길을 가면 그때 후보가 된다.)

    Master Gap

        ① **붙박이가 아직 손이다** — 광맥·NPC 자리·시작 자리는 QUIET_GROUND 로 태어남을
           비켜 서 있을 뿐 태어나지 않는다. 사슬 ⑥(정착 — "사람이 조용한 자리를 찾아온다")
           이 서면 방향이 뒤집힌다 (03 RATIONALE 4). 다음 후보 재료다.
        ② **04 의 debug.genesisSeed 자리가 옮겨졌다** — debug 봉투는 engine 소유
           (protocol-core)라 땅 도메인(ground.genesisSeed)이 실었다. 뜻 동일 (07 NOTES 1).
           debug 봉투의 팩 확장 자리가 필요해지면 ENGINE 트랙 감이다.
        ③ 자원 사슬(⑤)의 다음 열쇠 — 태어난 분포가 "어디서 나는가" 를 답할 바닥이
           되었다. BT 24종이 Master 에 섰으므로(Q73~75) 자원을 **세계에** 세우는 후보가
           이제 이 Cycle 위에 놓일 수 있다.

    다음 후보 (Frontier — 제안)

        FR-THE-LAND-SHOWS-BEFORE-IT-TAKES 그대로 — 부채(불공정)는 남아 있고, 이제
        예고할 대상이 태어난 세계 전체다.

## FAILURES

    없음. (PLAYABLE 의 도구 판정 1 실패는 도구의 옛 전제 — 위에 근거를 적었다.)

## 못 한 것 · 확인하지 못한 것

    1. **HUD 겹침** — 그림에서 디버그·self 패널이 여전히 포개진다 (C-TERRAIN-002 08 과
       같은 문제 · VIEW/ENGINE 레인의 기존 부채 — panels-do-not-overlap).
    2. **씨앗이 다른 세계를 실제 클라이언트로 밟지 않았다** — 헤드리스 실측(씨앗 셋)과
       검사(씨앗 스물)로 닫았다. 클라이언트에서 씨앗을 고르는 입구가 아직 없다
       (WorldSetup.genesisSeed — 띄우는 쪽의 값).
    3. terrain-shot 의 여덟째 판정 전제(위 PLAYABLE) — 도구 갱신은 이 Cycle 범위 밖.

## STATUS

    IN PROGRESS — **Gate 14 (Human Play) 대기.**

    Gate 15항 중 열넷이 실행 결과로 참이다. 남은 것은 14번 하나 — 사람이 실제 게임에서
    확인하는 것: `npm run dev` 로 띄워 빙원(북서쪽)으로 걸어가 머물러 보고, 발밑이
    해숨구멍으로 열리는 것과 (진단 표면 C 를 켜면) `세계 씨앗 1` 이 보이는 것.
    Human 이 확인하거나 자동 증거를 받아들이면 COMPLETE 로 바꾼다 (C-TERRAIN-002 선례).
