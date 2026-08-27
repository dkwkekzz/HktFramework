# CYCLE C-GROWTH-001 — Verification

[PASS] Semantic Closure     (Intent 12 문장이 전부 State 또는 Rule 로 닫힌다 · GAP 0)
[PASS] World Rule Execution (View 없이 실측 — 아래 WORLD SCENARIO)
[PASS] Projection           (04 계약 그대로 · 투영하지 않은 것도 사유가 적혀 있다)
[PASS] View Binding         (Fixture 만으로 16 · World 미기동)
[PART] Playable             (실제 브라우저에서 왕복 실측 · 쌓임 0 → 19 까지 눈으로 확인.
                             **문턱을 넘는 순간은 헤드리스 각본이 잡지 못했다** — 아래 PLAYABLE)
[PASS] Regression           (1520 tests · 자라지 않은 몸의 값이 한 톨도 다르지 않다)
[PASS] Catalog              (존재 종류를 더하지도 바꾸지도 않았다 — `catalog:check` 정합)

STATUS  IN PROGRESS   ← Human Play 확인 전에는 COMPLETE 로 바꾸지 않는다 (CLAUDE.md 원칙 15)

## NEW BEHAVIOR

    치면                        1 이 쌓인다 — 얼마나 아팠는지는 묻지 않는다
    쓰러뜨리면                  그 한 대(1)와 함께 14 가 더 쌓인다
    캐면 / 살펴보면             4 / 3
    쌓인 것이 20 을 넘으면       단계가 1 이 되고 겨루는 값 넷이 오른다
                                (물리·오라 공격 +4 · 물리·오라 방어 +3)
    그래서                      같은 종류의 상대에게 같은 기술로 **더 큰 피해**가 들어간다
                                — 디버그 명령을 한 번도 열지 않고
    자라지 않은 몸              C-COMBAT-001 까지와 **한 톨도 다르지 않다**
    밖의 손                     `deeds` 를 밀어 올리면 단계가 따라 오른다.
                                기본값을 덮어도 자란 몫이 지워지지 않는다
    단계가 열지 않는 것          곡괭이 없이는 여전히 못 캔다 · 땅은 여전히 열을 거둔다

## WORLD SCENARIO — View 없이 실측

세계만 굴려 얻은 값이다 (`world/tests/drive.ts` 로 요청을 넣고 관찰을 읽었다).

    ── ① 기본 기술로 자율 존재 하나를 넘어뜨린다 ────────────────
    한 대가 남기는 값 20 · 때린 횟수 7 · 상대 상태 downed (생명 0)
    쌓인 것 21 · 단계 1
    사건  strike+1→7(0▸0) · down+14→21(0▸1)

    **여기서 03 의 BALANCE ② 를 고쳐 적는다.** 그 절은 여섯 대로 셈해 `6 + 14 = 20`
    이 첫 문턱에 정확히 닿는다고 적었으나, 실제 각본은 **일곱 대**다 — 생명이 절반
    아래로 내려간 방랑자가 몸에 몰아 단단해지기 때문이다
    (C-COMBAT-001 · RULE-NPC-ALLOCATION-001 — 물리 방어 30→50 · 한 대 20→17).
    결론은 그대로다: **한 마리를 넘어뜨리면 첫 문턱을 넘는다.** 여유가 1 늘었을 뿐이다.
    셈이 틀린 것이 아니라 셈이 아래 층 하나를 세지 않은 것이며, 그 사실을 여기 남긴다.

    ── ② 원천마다 얼마인가 ──────────────────────────────────
    치기 1 · 치기+쓰러뜨림 15 · 캐기 4 · 살펴봄 3      (World.DeedCatalog 그대로)

    ── ③ 단계가 결과를 바꾼다 (BALANCE ① 대조) ───────────────
    단계 0   공격 40 · 방어 50 · 한 대 20 · wanderer(120) 6대
    단계 1   공격 44 · 방어 53 · 한 대 22 · 6대
    단계 2   공격 48 · 방어 56 · 한 대 23 · 6대
    단계 3   공격 52 · 방어 59 · 한 대 25 · **5대**
    단계 4   공격 56 · 방어 62 · 한 대 26 · 5대
    단계 5   공격 60 · 방어 65 · 한 대 28 · 5대

    03 의 BALANCE ① 표와 여섯 줄이 **전부 일치한다.** 한 단계는 숫자를 바꾸고
    세 단계를 모아야 대수가 바뀐다 — DC-GROWTH-POWER-PAYS-IN-REACH-OR-CONSTRAINT
    가 요구한 폭이 실측으로 확인되었다 (`power_envelope: small_change_per_step`).

    ── ④ 기본값은 그대로다 · 밖의 손과 겹치지 않는다 ──────────
    Before  deeds 0 · 유효 공격 40
    Input   set-attribute(deeds, 20)
    After   유효 공격 44 · 단계 몫 physicalAttack+4 auraAttack+4 armor+3 resistance+3
    Input   set-attribute(physicalAttack, 100)   ← 밖에서 기본값을 덮는다
    After   유효 공격 **104** — 자란 몫이 살아 있다

    ── ⑤ 단계는 아무 관문도 열지 않는다 ─────────────────────
    단계 5 · 곡괭이 없이 채굴 요청
        → Failure(RULE-MINE-001 · no-mining-tool) · 관찰의 가용성도 false 로 같다
    단계 5 로 법칙의 자리(heat-binding) 안에 서기
        → 온기 100 → 65.6  (땅은 단계가 높아도 그대로 거둔다)

    ── ⑥ 쌓인 것은 줄지 않는다 ──────────────────────────────
    쓰러진 뒤 1 (쓰러지기 전과 같다) · TTL 이 지나 사건 0개가 된 뒤에도 1

    ── ⑦ 회귀 ───────────────────────────────────────────
    deeds 0 인 몸  공격 40 · 방어 50 · 오라 공격 40 · 오라 방어 20 · 통찰 0
                   한 대 20 — C007 이래의 기준값 그대로

## VIEW FIXTURE — World 미기동

    growth.fixture.json      단계 1/5 · 방금 한 대와 쓰러뜨림 · 그 둘째가 올렸다
    growth-max.fixture.json  단계 5/5 · **다음 문턱이 아예 오지 않는다**
    combat.fixture.json      자라지 않은 몸 (회귀 기준)

    자란 것 1/5 · 쌓인 것 20 · 다음까지 30 (50)
    단계 몫 물리 공격 +4 · 오라 공격 +4 · 물리 방어 +3 · 오라 방어 +3
    한 대 +1 (6)
    쓰러뜨림 +14 (20) → 자란 것 0 ▸ 1
    자란 것 0/5 · 쌓인 것 0 · 다음까지 20 (20)          ← 0 도 보인다
    단계 몫 물리 공격 +0 · 오라 공격 +0 · 물리 방어 +0 · 오라 방어 +0
    자란 것 5/5 · 쌓인 것 240 · 더 오를 곳이 없다        ← 0 을 지어내지 않는다

    앞뒤가 맞지 않는 수를 보내도 화면이 고치지 않는다 (deeds 7 · level 4 · 남은 3) ·
    보태는 몫의 차례도 세계가 정한다 · 모르는 원천은 코드 그대로 선다
    (`deed.solved-an-event +9 (29)`)

## PLAYABLE — 실제 게임에서 실측

`npx vite` 로 세계와 클라이언트를 한 프로세스에 띄우고 헤드리스 크로뮴
(900×640 · `/opt/pw-browsers/chromium`)에서 사람이 하는 조작 그대로 눌렀다.
페이지 오류 0 · 왕복 81ms · 보낸 요청 375.

    1. 처음부터 서 있다
           자란 것 0/5 · 쌓인 것 0 · 다음까지 20 (20)
           단계 몫 물리 공격 +0 · 오라 공격 +0 · 물리 방어 +0 · 오라 방어 +0

    2. `F` 를 누른다 — **전선에 실제로 나간 요청** (웹소켓 프레임 그대로):

           {"type":"action","action":{"interactionId":"attack","mark":1}}

       새 요청이 생기지 않았다는 것이 이 Cycle 의 뜻이기도 하다 —
       자라게 하는 조작은 지금까지 하던 것 그대로다.

    3. 땅을 눌러 방랑자가 지키는 자리(-10,-8)까지 걸어가 계속 쳤다.
       첫 타격에 화면에 뜬 줄:

           한 대 +1 (1)

       계속 치는 동안 그 줄이 뜨고 사라지며 쌓인 것이 올라갔다:

           자란 것 0/5 · 쌓인 것 19 · 다음까지 1 (20)
           (그때 HP 183/200 — 상대도 나를 치고 있었다)

    4. **문턱을 넘는 순간은 이 각본이 잡지 못했다.** 상대가 밀려나거나 걸어가면
       헤드리스 각본의 고정된 화면 좌표 클릭이 그를 놓치고, 그 뒤로는 휘둘러도
       닿지 않는다. 세 번 다시 돌렸고 가장 멀리 간 것이 19/20 이었다.

       **이것은 세계의 결함이 아니라 각본의 한계다.** 같은 걸음을 세계에서 돌리면
       일곱 대에 넘어뜨리고 21 로 단계 1 이 된다 (위 WORLD SCENARIO ①), 그 뒤의
       화면 표시도 Fixture 로 확인되어 있다 (위 VIEW FIXTURE). 남은 것은 그 둘이
       한 화면에서 이어지는 것을 **사람이 눈으로 보는 일**이며, 그것이 Gate 14 다.

## HUMAN PLAY — 사람이 확인할 것

    `npm run dev` → 땅을 눌러 왼쪽 위(방랑자가 지키는 자리)로 걸어간다 → `F` 로 친다.

    봐야 할 것 넷
        ① 첫 타격에 `한 대 +1 (1)` 이 뜨고 `쌓인 것` 이 오르는가
        ② 넘어뜨리는 순간 `쓰러뜨림 +14 (21) → 자란 것 0 ▸ 1` 이 뜨는가 —
           **그 한 줄이 이 Cycle 이 만든 순간이다**
        ③ 그 직후 `물리 공격 40 → 44` 로 바뀌고, 다음 방랑자에게 한 대가
           20 이 아니라 22 를 남기는가
        ④ 그 줄들이 self 패널 **맨 뒤**에 서는 것이 손에 맞는가 —
           화면이 좁으면 잘려 나가는 자리다 (07 NOTES)

## REGRESSION

    자라지 않은 몸이 그대로다 (핵심)
        C007  한 대 20 · 자율 존재는 기본 스킬 12대를 견딘다        그대로
        C010~C015  능력치 · 방식 · 관통 · 치명의 값과 경위          그대로
        C016  통찰 0 · 가려짐 문턱 30·60·90                        그대로
        C023  걸린 것의 기여 · 유효 값 재계산                        그대로
        C-COMBAT-001  배분 넷 · 몫 · 바꾸는 대가 15 · 0 바닥         그대로
        C-TERRAIN-001 땅이 거두는 열                                그대로

    갱신한 기존 시험 — **값이 아니라 새 칸을 받아들인 것들**
        allocation · critical · damage · damage-type · observe · penetration
            TypedStat deep-equal 에 `fromGrowth: 0` 이 든다 (자라지 않은 몸이므로)
        combat · command       MutableAttribute 목록에 `deeds`
        critical               손수 만든 WorldState 에 `growthEvents: []`
        view fixtures 33개     `growth`(단계 0) · `growthEvents: []` · `fromGrowth: 0`

    의미가 바뀐 시험 **하나**
        exchange.spec.ts — "가득 찬 채로 바꿔 껴도 값과 용도는 정확히 따라온다"
            아홉 번 캐는 각본이라 그 몸은 36 을 쌓아 **한 단계 자라 있다**.
            기대값을 상수에서 세계가 스스로 밝힌 몫으로 옮겼고, 그 결과
            "자란 몫은 걸린 것을 벗어도 남는다" 가 덤으로 확인된다.
            **이것이 이 Cycle 이 기존 플레이에 남긴 유일한 실제 변화다** —
            오래 캔 몸은 이제 조금 더 세다.

    전체    1520 passed (84 files) · tsc 0 · boundary 0 · catalog 정합

## MASTER FEEDBACK

    Capability Overlay
        MC-GAIN-LEVEL    MISSING → **PARTIAL**    근거 이 문서의 WORLD SCENARIO ①③ · PLAYABLE

            노드의 `world_shape` 두 문장은 **닫혔다** — 세계 안에서 한 일이 몸의 값을
            바꾸고, 그 값이 오른 뒤 같은 종류·같은 행동의 결과가 실제로 달라진다
            (한 대 20 → 22 · 세 단계에 6대가 5대로).

            그러나 `semantic` 이 든 원천 넷 중 **둘이 세계에 없다** — "탐험하고" 와
            "사건을 해결한 것". 땅이 이제 막 법칙을 지녔고(C-TERRAIN-001) 사건이라
            부를 것이 아직 없어 지어내지 않았다. 그러므로 IMPLEMENTED 가 아니다.

            남는 결손의 이름 둘
                쌓이는 원천이 넷 중 둘뿐이다
                GS §5 가 든 다섯 중 셋(생명력 · 기력 · 기본 이동)이 자라지 않는다 —
                그 셋은 아직 "유효 값" 이라는 자리를 지니지 않으며, 그 자리를 여는
                것은 이 Cycle 이 아니라고 05 승인이 확정했다

    Possibility 판정
        MP-OUTGROW-THE-OPPONENT    **PARTIAL**

            "전투 밖에서 기른 값으로 정면 교환을 이긴다" 중 **기르는 축은 섰다.**
            그러나 이 Cycle 이 세운 원천 중 전투 밖의 것은 캐는 일 하나이고
            (4/회 — 첫 문턱까지 다섯 번), 그것만으로 정면 교환의 판을 뒤집기에는
            폭이 작다 (한 단계 = 한 대에 2). 갈래가 온전해지려면 전투 밖의 원천이
            더 서야 한다 — 그것이 위 결손 첫째와 같은 자리다.

    Constraint Evaluation
        DC-WORLD-PROGRESSION-IS-REACH          SATISFIED
            단계를 읽는 Precondition 이 세계에 **하나도 없다.** 곡괭이 관문도 땅의
            법칙도 단계 5 에서 그대로였다 (WORLD SCENARIO ⑤)
        DC-GROWTH-GOAL-FIRST                   SATISFIED
            오르는 것 자체가 Goal 이 아니다. 화면에도 성장 전용 표면을 세우지 않았다
        DC-COMBAT-PLAYER-CAUSALITY             SATISFIED
            같은 일은 같은 양을 쌓고(네 번 캐서 4·4·4·4), 오른 원인이 사유와 함께
            실린다. 쌓임에 세계의 흔들림이 들어가지 않는다
        DC-WORLD-OWNS-THE-SURFACE-LIST         SATISFIED
            단계 · 남은 양 · 보태는 몫을 전부 세계가 세어서 싣는다. 화면에 산술이
            하나도 없고, 앞뒤가 맞지 않는 수를 보내도 고치지 않는 것으로 확인했다
        DC-GROWTH-POWER-PAYS-IN-REACH-OR-CONSTRAINT   **SATISFIED** (UNRESOLVED 에서 닫힘)
            한 단계가 대수를 바꾸지 않고 세 단계를 모아야 바뀐다 —
            `power_envelope.general_combat: small_change_per_step` 이 실측으로 확인되었다
        DC-GROWTH-REWARD-IS-NEW-REACH          SATISFIED
            `capability_access: 1` 을 지켰다 — 단계가 여는 것이 하나도 없다
        DC-GROWTH-CAPABILITY-DECLARES-ITS-LIMITS  SATISFIED
            Contract 의 `capability_reach` 세 칸이 실측과 맞는다.
            다만 `effective` 칸의 "기력 · 기본 이동" 은 **이 Cycle 이 닿지 않았다** —
            아래 Master Gap ②
        DC-GROWTH-INTENT-IS-MEASURED           SATISFIED
            선언(`power_envelope`)과 실측을 이 문서가 대조했다

    Constraint Candidate
        **`쌓는 규칙은 조종 주체를 가리지 않는다`** — 관찰된 반복이다.
        걸린 것(C023) · 배분(C-COMBAT-001) · 열(C-TERRAIN-001) · 이제 쌓임까지
        넷이 모두 "어떤 몸이든 지닌다 · 규칙이 신원을 읽지 않는다" 로 섰다.
        네 Cycle 이 각자 그 판단을 다시 내렸으므로 원칙으로 올릴 값이 있어 보인다.
        승격 판단은 Human 이다.

    Master Gap
        ① **GBC-GAIN-LEVEL 의 `capability_reach.effective` 가 실제보다 넓다.**
           그 칸은 "때리는 값 · 버티는 값 · 기력 · 기본 이동" 을 들지만, 이 Cycle 이
           닿은 것은 앞의 둘뿐이다. 뒤의 둘은 유효 값이라는 자리를 지니지 않아
           성장이 닿을 곳이 없었다.
           Affected  GBC-GAIN-LEVEL · MC-GAIN-LEVEL
           Options   (a) Contract 를 실제에 맞춰 좁힌다
                     (b) 그 셋에 유효 값 자리를 여는 것을 후보로 세운다
                     (c) 둘 다 — 좁히고, 여는 일을 후보로 남긴다
           Decision By  Human (Master)

        ② `validation.static: PENDING` 이 그대로다 — 비교 집합이 이 성장 하나뿐이라
           Dominance 를 잴 수 없다. 둘째 성장이 설 때 함께 본다 (결손이 아니라 상태다).

    Works 로 넘긴 화면 몫 (works/BACKLOG.md — VIEW 레인)
        ① 타격 경위에 `fromGrowth` 를 쓰는 일 — 세계는 이미 보내고 있다
        ② 오름을 알리는 연출 — 지금은 줄 하나가 잠깐 서 있다 사라지므로 놓치기 쉽다.
           이펙트 예산 일곱 중 무엇을 뺄지 함께 정해야 한다 (F1 규칙 ③).
           `justLeveled` 가 문을 열어 두었다

## FAILURES

    없음. 반환한 Stage 없음.

    다만 **넘어가지 않은 것 하나**를 위 PLAYABLE 4 에 적어 두었다 —
    헤드리스 각본이 문턱을 넘는 순간을 잡지 못했다. 세계와 Fixture 양쪽에서
    그 순간이 확인되어 있으므로 결함이 아니라 **사람 손으로 닫을 자리**다.

## STATUS

    IN PROGRESS   ← Human Play 뒤에만 COMPLETE (Gate 14)
