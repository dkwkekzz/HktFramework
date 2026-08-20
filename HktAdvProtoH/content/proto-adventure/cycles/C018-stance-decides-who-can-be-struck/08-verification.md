# C018 — Verification

> 이 Cycle 이 세계에 더한 것은 값 하나와 관문 하나다. 그런데 그 하나가 세계에서 처음으로
> **"칠 수 없는 것"** 을 만들었고, 처음으로 **물러나는 것을 답으로** 만들었다.
> 아래는 그것을 실제로 돌려 본 기록이다.

## 6종 검사

    [PASS] Semantic Closure     03 의 SEMANTIC CLOSURE 18줄이 모두 State 또는 Rule 로 닫힌다.
                                닫히지 않은 문장 없음
    [PASS] World Rule 실행      world/tests/relation.spec.ts 20 tests — View 없이 실측
    [PASS] Projection           04 계약 대조 — 태도 둘 · contacts 실림 · 투영하지 않기로 한
                                넷은 실제로 없다
    [PASS] View Binding         view/tests/relation.spec.ts 13 tests — Fixture 만으로
    [PASS] Playable             세계 서버에 이어 붙어 실측 (아래 PLAYABLE)
    [PASS] Regression           전체 46 files · 794 tests 통과 · boundary 0 위반 ·
                                catalog 3원소 정합

## NEW BEHAVIOR

```text
지키는 자리 밖    → 아무도 나를 사냥감으로 보지 않는다 · 아무 일도 성립하지 않는다
자리 안으로 걸음   → 그 존재가 나를 사냥감으로 대한다 · 쫓아온다 · 서로 칠 수 있다
자리 밖으로 걸음   → 태도가 풀린다 · 쫓기가 멎는다 · 다시 칠 수 없다
중립인 것을 침    → 닿아도 생명이 줄지 않고 행동도 끊기지 않는다 + 사유가 뜬다
빗나감           → 아무것도 뜨지 않는다 (무산과 다르다)
```

## WORLD SCENARIO — world/tests/relation.spec.ts (20 tests, 전부 통과)

    태도가 자리에서 나온다
        자리 안(3,0) → hostile · 자리 밖(12,0) → neutral
        지킬 것이 없는 존재는 바로 옆(2,0)에 있어도 neutral
    방향값이다
        같은 상대에 대해 toward=hostile · from=neutral 이 동시에 성립한다
    **주체의 종류가 판정을 바꾸지 않는다**
        `spawnActor(control:'player', guardedGround:…)` 와 `control:'autonomous'` 로
        규칙에 직접 물었다 — 사람이 지키는 쪽일 때도 hostile 이 나오고,
        관문이 양쪽 모두에 allowed 를 낸다
        몸은 지킬 것 없이 태어난다 (player · autonomous 둘 다 guardedGround = null)
    관문
        중립인 몸을 맞혀도 hp 가 한 톨도 줄지 않고 strikes 가 비어 있다
        무산이 사유(not-hostile)와 자리와 함께 실린다 · 한 휘두름에 한 번만
        빗나가면 strikes 도 contacts 도 비어 있다 — 무산과 빗나감이 다르다
        적대는 그대로 맞는다 (관문 뒤의 계산 무변경)
        밖에서는 칠 수 없다 (경계 밖 6.2 에서 휘둘러도 hp 불변)
    물러나면 풀린다
        걸어 나가면 neutral · 다시 걸어 들어가면 hostile — 푸는 규칙 없이
        때린 뒤 나가도 neutral — 원한이 남지 않는다
    자율 판단
        지킬 것이 있는 존재는 자리에 든 침입자를 쫓는다 (state = move)
        지킬 것이 없는 존재는 눈앞의 상대를 두고 자기 순회를 계속한다
        침입자가 나가면 더 쫓지 않고 자기 자리로 돌아간다
    수명 · 결정론
        무산도 STRIKE_EVENT_TTL 을 산다
        같은 뿌리의 두 세계에서 **무산이 앞서 일어나도** 뒤이은 타격의 Critical 판정과
        피해량이 완전히 같다 → 성립하지 않은 접촉은 흔들림을 소비하지 않는다

## VIEW FIXTURE — view/tests/relation.spec.ts (13 tests, 전부 통과)

    적대에는 `[적대]` 가 이름 앞에 붙고 중립에는 붙지 않는다 · 내 몸에도 붙지 않는다
    `[적대] Wanderer 1 ?` — 관계 표시와 C014 의 "아직 모른다" 표시가 함께 선다
    무산이 맞은 자리에 `적대가 아니다` 로 뜨고, 크게 그려지지 않으며 경위가 붙지 않는다
    성립한 타격(숫자)과 무산(문구)이 한 화면에 섞이지 않고 각자 남는다
    펼치면 두 방향이 따로 읽힌다 — `관계 적대→나 · 나→중립` · 중립인 존재도 줄이 비지 않는다
    사유 코드(not-hostile)가 그대로 화면에 나오지 않는다
    같은 종류의 둘이 같은 그림에 서로 다른 표시를 얻는다 — 종류로 태도를 짐작하지 않는다

## PLAYABLE — 세계 서버 실측 (`npm run world` + WebSocket 관찰자)

    ① 걸음이 태도를 가른다 · 지키는 존재가 자기 자리를 지킨다

        START   내 몸=player-2 pos=(3.0,2.0)  npc-1 toward=neutral  hp=200
        IN      중심까지=5.70  npc-1 toward=hostile  npc-1 state=move  hp=200
                (반경 7 · 6.80 지점에서 neutral → hostile 로 갈리는 순간이 관찰됐다)
        OUT     중심까지=9.28  npc-1 toward=neutral  hp=200
        AFTER   npc-1 pos=(-8.5,-10.0) 중심까지=2.5 → 자기 자리로 돌아갔다

        **물러나는 것이 실제로 답이었다** — 생명을 한 톨도 잃지 않고 상황이 끝났다.

    ② 머무르면 대가가 있다 (다른 실행)

        자리 안에 머문 관찰자는 npc-1 에게 17 씩 반복해 맞았다 —
        `타격: [{a:"npc-1", t:"player-1", dmg:17}]`
        지키는 존재가 침입자를 실제로 몰아낸다. 관문이 양쪽에 똑같이 서 있다는 증거다.

    ③ 중립인 것은 쳐도 상하지 않는다 (다른 실행)

        npc-2(지킬 것 없음) 옆에서 휘두른 결과
        `contacts=[{attackerId:"player-1", targetId:"npc-2", skill:"attack",
                    at:{x:4.795…, z:11.602…}, since:161.18…, reason:"not-hostile"}]`
        `strikes=[]` — 닿았고, 아무 일도 일어나지 않았고, 왜인지가 함께 왔다.

    계약 실측 — 관찰 결과의 키:
        specId · scene · observer · entities · interactions · hud · strikes ·
        **contacts** · debug · currentTarget · commands

    `npm run build` 통과 (tsc --noEmit + vite build) — Client 도 이 계약으로 선다.

## REGRESSION

    전체 46 files · 794 tests 통과.
    `npm run boundary:check` 경계 위반 0 · `npm run catalog:check` 3원소 정합.

    03 AFFECTED 전부 재실행
        RULE-STRIKE-DAMAGE-001 · RULE-HIT-001 · RULE-SKILL-BUDGET-001 ·
        RULE-CRITICAL-STRIKE-001 · RULE-GUARD-BLOCK-001    값·판정·경위 무변경 확인
        (C010 의 20 · C011 의 막기 수지 · C013 의 관통 · C015 의 Critical 실측값이
         모두 그대로 나온다)
        RULE-OBSERVE-* · RULE-MINE-001                     무변경
        RULE-BODY-PUSH-001                                 관문 밖 — 중립인 둘도 비켜선다
        Observer Projection                                태도 둘과 contacts 가 더해졌고
                                                           기존 자리는 그대로다

    **기존 시나리오 정정의 성격** — 전투를 보는 과거 Cycle 의 시나리오들이 실패했고,
    상대에게 `guardedGround` 를 주어 고쳤다 (dummyAt 9종 · 인라인 배치 4곳 ·
    사람 둘 대결 1곳 · 추격 배치 2곳). **이것은 세계를 약하게 만든 것이 아니다** —
    지금까지 말하지 않고 전제해 온 것("이 둘은 칠 수 있는 사이다")을 시나리오가
    드러내 적게 한 것이며, 그 전제가 이제 세계의 값이 되었기 때문이다.
    수치·판정·경위는 하나도 바뀌지 않았다.

## MASTER FEEDBACK

    ### Overlay 승격 보고

        MC-RELATION-STANCE        MISSING → **IMPLEMENTED**
            근거(이 문서의 실측):
              · 존재 사이의 태도가 세계의 값으로 있다 (RULE-STANCE-001 · hostile|neutral|friendly)
              · 그 태도가 공격 가부를 가른다 (RULE-HARM-GATE-001 — 중립은 닿아도 상하지 않는다)
              · 어느 쪽에서 본 태도인지가 관찰에 실린다 (두 방향 모두)
            overlay 결손 칸 셋이 모두 닫혔다.

        MG-HOLD-HUNTING-GROUND    PARTIAL → **PRESENT (world_shape 3줄 중 3줄)**
            "지키는 범위를 갖고" ✔ Actor.GuardedGround
            "그 범위에 들어오면 반응하고" ✔ 실측 — 5.70 지점에서 쫓기 시작
            "나가면 더 쫓지 않아야" ✔ 실측 — 9.28 에서 풀리고 자기 자리로 복귀
            판정은 Master 의 몫이다 — 이 문서는 실측만 보고한다.

        MP-LEARN-TO-HANDLE-THE-LAYER
            요구 Capability 중 하나가 닫혔다. 남은 것은 MC-PREDICT (+ MC-OBSERVE 의
            마지막 결손) 이며 그 둘은 같은 자리다 (frontier 후보 3).

    ### Constraint 판정 결과

        DC-WORLD-CREATURE-FROM-PRESSURE   SATISFIED
            적대가 종류에 붙은 성질이 아니라 **지킬 것이 있는가**의 결과다.
            같은 `wanderer` 두 개체가 하나는 적대하고 하나는 하지 않는다 —
            "몬스터를 배치한 것" 이 아니라 "지킬 것이 있는 존재가 그렇게 대하는 것" 이다.
        DC-WORLD-COMBAT-IS-ONE-POSSIBILITY  SATISFIED · **처음으로 실체가 생겼다**
            물러나는 것이 실제 답이 되었다 (PLAYABLE ① — 생명 손실 0으로 상황 종료).
            이 Constraint 는 지금까지 "지켜지고 있다" 고 말할 수밖에 없었다.
            전투를 피하는 길이 세계에 없었기 때문이다.
        DC-WORLD-OWNS-THE-SURFACE-LIST     SATISFIED
            태도의 값도 무산의 사유도 세계가 싣는다. View 는 문구 표만 지닌다.
            `HOSTILITY_REASONS` 목록 자체는 투영하지 않는다 — 항목이 늘어도 화면은
            고치지 않는다.
        DC-COMBAT-ONE-FORMULA · ONE-LAYER-AT-A-TIME · PLAYER-CAUSALITY   무관·유지
            피해 공식 무변경 · 전투 사다리의 층을 올리지 않음 · 새 난수 없음
            (무산이 흔들림을 소비하지 않는다는 것을 실측으로 확인).

    ### Constraint Candidate 후보 — 반복된 설계 패턴

        CC-WORLD-DERIVE-DONT-REMEMBER (제안)
            "세계의 사실은 지금의 상태에서 유도할 수 있으면 저장하지 않는다."
            C007 의 Downed · Modifiers, C016 의 통찰이 연 자리, 그리고 이 Cycle 의 태도 —
            셋 다 저장하지 않기로 한 판단이 **되돌리는 규칙을 없앴다.**
            이번에는 그 덕에 "물러나면 풀린다" 를 구현하는 코드가 0줄이었다.
            반대로 저장했다면 푸는 규칙과 그것을 부르는 자리가 세 곳 필요했고,
            그 순간 원한이라는 개념이 뒷문으로 들어왔을 것이다.
            승격 여부는 Human 이 정한다.

        CC-WORLD-REASONS-ARE-A-LIST (제안, 약한 후보)
            "판정이 여러 사정에서 나올 수 있으면 사정을 목록으로 두고 판정은 목록을 읽는다."
            이번에 `HOSTILITY_REASONS` 로 세웠으나 아직 항목이 하나뿐이라
            **값어치가 실측되지 않았다.** 두 번째 사정이 서는 Cycle 이 이것을 확인한다.
            지금 승격하면 근거가 하나짜리 패턴이 된다 — 보류를 권한다.

    ### 다음 Cycle 을 위해 이 Cycle 이 연 것

        · TG §3.1 의 "적대 Actor 만 Tab 후보로" 와 §3.2 대상 프레임의 관계 표시가
          이제 **읽어 갈 값**을 가진다 (C017 이 남긴 자리).
        · 위협도·어그로 · 진영 · 도발 · 결투 — 모두 `HOSTILITY_REASONS` 에 항목을
          더하는 일로 시작할 수 있다.
        · 사람이 지킬 것을 갖는 Cycle 이 서면 몸 위 관계 표시를 두 방향으로 나눌
          근거가 생긴다 (07 NOTES ③).

    ### Master Gap

        없음. 상위 의미와 어긋난 지점이 관찰되지 않았다.

## FAILURES

    없음. 기계 검증 전 항목 통과.

    다만 **Human Play 확인 전이다.** 아래 둘은 사람이 눈으로 봐야 판정된다.
      · `[적대]` 표시와 무산 문구가 실제 화면에서 읽히는가 (크기·자리·겹침)
      · 지키는 자리의 반경 7.0 이 "다가간다 → 위험해진다" 로 체감되는가
        (실측상 5.70 에서 갈리고 9.28 에서 풀린다 — 그 폭이 플레이로 적당한가)

## STATUS

    VERIFIED (기계 검증) — Human Play 확인 대기

    확인 방법
        `npm run world` + `npm run client` 로 띄운 뒤
        ① 왼쪽 아래(-10,-8) 쪽으로 걸어간다 — 어느 지점에서 그 존재의 이름 앞에
           `[적대]` 가 붙고 그것이 다가오기 시작한다
        ② 그대로 서 있으면 맞는다. 물러나면 표시가 사라지고 그것이 자기 자리로 돌아간다
        ③ 오른쪽 위(12,8) 쪽의 다른 존재는 다가가도 아무 표시가 없다.
           그것을 휘둘러 보면 `적대가 아니다` 가 뜨고 생명이 줄지 않는다
