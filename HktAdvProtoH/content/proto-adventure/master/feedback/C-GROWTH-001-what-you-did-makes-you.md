# Feedback — C-GROWTH-001-what-you-did-makes-you

    반영 시점    origin/main aadd8a4 를 합류시킨 브랜치 위에서
                 (`claude/world-growth-progress-495l4b` · 68f9873).
                 `feedback:gate` 의 HEAD 검사는 통과하지 못했다 — 그 Cycle 이 아직
                 병합되지 않았기 때문이다. 다만 게이트가 지키려는 것(공유 파일을
                 **최신 내용 위에서** 고치는 것)은 합류로 충족됐고, 밀린 Feedback 이
                 이것 하나뿐이라 병합이 사실을 고를 여지가 없다. 직전 반영
                 (`밀린 둘을 배치로`)도 같은 자리에서 돌았다.
    근거         cycles/C-GROWTH-001-what-you-did-makes-you/08-verification.md 의 MASTER FEEDBACK

## Overlay

    MC-GAIN-LEVEL                 MISSING → **PARTIAL**
        선 것    세계 안에서 한 일이 몸에 쌓이고, 쌓인 것이 문턱을 넘으면 겨루는 값 넷이
                 오른다. `world_shape` 의 두 문장이 실측으로 닫혔다 — 걸어가 살펴보고
                 쳐서 넘어뜨리니 쌓인 것 0 → 22 · 단계 0 → 1 이 되었고, 그 뒤 같은
                 기술의 피해가 26 → 28 로 · 한 대가 남기는 값이 20 → 22 로 달라졌다.
                 **디버그 명령을 한 번도 열지 않았다.**
        남은 것  둘이다.
                 ① 쌓이는 원천이 이 노드가 든 넷 중 **둘뿐**이다 — "탐험하고" 와
                   "사건을 해결한 것" 이 세계에 없다. 땅이 이제 막 법칙을 지녔고
                   (C-TERRAIN-001) 사건이라 부를 것이 아직 없어 지어내지 않았다
                 ② GS §5 가 든 다섯 중 **셋(생명력 · 기력 · 기본 이동)이 자라지 않는다** —
                   그 셋은 아직 "유효 값" 이라는 자리를 지니지 않아 걸린 것도 배분도
                   성장도 닿을 곳이 없다. 성장만 그 셋을 건드리면 세계에 **세 번째
                   종류의 값 변경 경로**가 생기므로 열지 않았다 (05 승인이 확정)
        근거     08 의 WORLD SCENARIO ①③ · PLAYABLE 5 · `shots/`

    MP-OUTGROW-THE-OPPONENT       PARTIAL 그대로 — **막고 있는 것이 달라졌다**
        "자라는 축이 없다" 에서 **"전투 밖의 원천이 얇다"** 로 옮겨갔다.
        이 갈래가 말하는 것은 *전투 밖에서 기른 값으로 정면 교환을 이기는 것*인데,
        선 원천 넷 중 전투 밖의 것은 캐는 일 하나뿐이고(4/회 · 첫 문턱까지 다섯 번)
        한 단계의 폭이 작아(한 대에 2) 그것만으로 판이 뒤집히지 않는다.
        `overlay_missing` 을 `성장의 원천` → `전투 밖의 원천` 으로 고쳐 그 사실을 적었다.

    **`implemented` 는 건드리지 않았다.** 이 Cycle 은 세계 표(MW-*)를 하나도 바꾸지
    않았다 — 몸에 값이 하나 늘었을 뿐 무대에 생긴 것이 없다.

## Frontier (자기 트랙만 — GROWTH)

    지웠다   FR-WHAT-YOU-DID-MAKES-YOU → 이 Cycle 로 닫혔다.

             배운 것 둘.

             **① 후보가 셈으로 적은 판정을 실행이 반증했다.** 후보와 03 은
             "여섯 대 + 쓰러뜨림 = 정확히 20 에 닿는다" 로 셈했으나, 이 세계에는
             흔들림이 있다 (C015 — 치명 25% · ×2). **치명이 터지면 덜 때리고
             넘어뜨리므로 덜 쌓인다.** 씨앗 열 판에서 한 마리의 벌이가 18~21 로
             흔들렸고 둘은 첫 문턱에 닿지 않았다. C-TERRAIN-001 이 같은 자리에서
             같은 것을 배웠다 — **후보 단계의 판정은 예측이고, 그것을 실측으로
             고쳐 올리는 것이 이 접합점의 값어치다.**

             **② 없는 원천을 지어내지 않은 것이 결손을 또렷하게 남겼다.** 노드가
             든 넷 중 둘이 세계에 없다는 사실이 `overlay_gap` 에 이름으로 남았고,
             그래서 다음에 무엇이 이 노드를 마저 채우는지가 읽힌다.

    새 후보  **없다.** 이 Cycle 이 연 것은 후보가 아니라 **Human 이 정할 물음 둘**이다
             (아래 Master Gap). 특히 Gap ① 은 그 자체가 "후보를 세울 것인가" 를 묻는
             것이라, Human 이 답하기 전에 트랙에 세우면 답을 대신하는 일이 된다.

    고친 것  남은 후보 둘의 `의존` 칸 — "쌓인다" 의 형태가 이제 섰으므로
             (`Actor.Deeds` · `World.DeedCatalog` · 문턱 표 · `GrowthEvents`)
             둘 다 그것을 재사용한다고 적었다. 추천 순서도 둘로 다시 썼다.

    고친 것  "지금 열 수 없는 것" 의 첫 줄 — MC-GROW-EXPLORATION-MASTERY 를 막던 것이
             "땅이 없다" 에서 **"푸는 일이 없다"** 로 옮겨갔다. 땅은 섰고(C-TERRAIN-001)
             쌓이는 형태도 섰다 — 남은 것은 땅의 법칙을 *원리로 푸는* 행위다.

    SELECTED 를 비웠다 — 다음 선택은 Human 의 몫이다.

## Constraint Evaluation

    노드에 기록한 것 (MC-GAIN-LEVEL 의 `constraint_evaluation`)

    DC-GROWTH-POWER-PAYS-IN-REACH-OR-CONSTRAINT   **UNRESOLVED → SATISFIED**
        후보와 노드가 "한 단계의 폭은 C-GROWTH-001 의 03 이 정한다" 로 미뤄 둔 자리다.
        03 이 정하고 08 이 실측했다 — 단계 0~5 에서 유효 공격 40·44·48·52·56·60,
        한 대가 남기는 값 20·22·23·25·26·28. **한 단계는 숫자를 바꾸고 세 단계를
        모아야 대수가 바뀐다** (wanderer 120 을 6대 → 5대). 선언
        (`power_envelope.general_combat: small_change_per_step`)과 실측이 맞는다.

    DC-COMBAT-PLAYER-CAUSALITY                    **PARTIAL** (새로 걸었다)
        후보가 "난수가 없다" 를 근거로 SATISFIED 라 적었던 자리다. **한 일에
        대해서는 참이다** — `DEED_AMOUNTS` 는 고정값이고 같은 일은 언제나 같은 양을
        쌓는다 (네 번 캐서 4·4·4·4). **그러나 한 마리에서 얻는 총량은 흔들린다**
        (18~21). 흔들림이 쌓임에 직접 닿지는 않으나 **몇 번 하게 되는가를 통해
        간접으로 닿는다.** 문장의 좁은 뜻은 지켜졌고 넓은 뜻은 지켜지지 않았다.
        어디까지로 볼 것인가는 Human 이 정한다 (Master Gap ③).

    DC-WORLD-OWNS-THE-SURFACE-LIST                **SATISFIED** (새로 걸었다)
        단계 · 남은 양 · 보태는 몫을 전부 세계가 세어서 싣는다. 결정 Layer
        (`view/growth-presentation.ts`)에 산술이 하나도 없고, 앞뒤가 맞지 않는 수를
        보내도 화면이 고치지 않는 것으로 확인했다 (07 FIXTURE TESTS ③).

    이 파일이 소유하는 것 (노드에 걸 자리가 없는 판정)

    DC-WORLD-PROGRESSION-IS-REACH        SATISFIED — 단계를 읽는 Precondition 이 세계에
        **하나도 없다.** 단계 5 로도 곡괭이 없이는 못 캐고(`no-mining-tool`), 땅은
        온기 100 → 65.6 으로 그대로 거둔다 (08 WORLD SCENARIO ⑤)
    DC-GROWTH-GOAL-FIRST                 SATISFIED — 성장 전용 표면을 세우지 않았다
    DC-GROWTH-REWARD-IS-NEW-REACH        SATISFIED — `capability_access: 1` 을 지켰다
    DC-GROWTH-CAPABILITY-DECLARES-ITS-LIMITS  SATISFIED — 다만 `capability_reach.effective`
        가 실제보다 넓다 (아래 Master Gap ①)
    DC-GROWTH-INTENT-IS-MEASURED         SATISFIED — 선언과 실측을 08 이 대조했다

## Constraint Candidate

    **CC-THE-RULE-DOES-NOT-ASK-WHO-DRIVES** (신규 · `candidates/`)
        몸이 지니는 것과 몸에 일어나는 일은 조종 주체를 묻지 않는다.
        C018 · C023 · C-COMBAT-001 · C-TERRAIN-001 · C-GROWTH-001 — 다섯이 같은
        자리에서 같은 판단을 내렸고 넷이 그 이유를 독립적으로 적었다.
        HUMAN DECISION: PENDING

## Master Gap — Human 결정 대기

    ① GBC-GAIN-LEVEL 의 `capability_reach.effective` 가 실제보다 넓다
        Conflict    그 칸은 "때리는 값 · 버티는 값 · 기력 · 기본 이동" 을 들지만
                    이 Cycle 이 닿은 것은 앞의 둘뿐이다
        Affected    GBC-GAIN-LEVEL · MC-GAIN-LEVEL 의 overlay_gap
        Trade-off   (a) Contract 를 실제에 맞춰 좁힌다 — 선언이 정직해지지만
                        GS §5 가 든 다섯 중 셋을 성장 축에서 놓아 주는 셈이다
                    (b) 그 셋에 **유효 값 자리를 여는 것**을 후보로 세운다 — 세계에
                        세 번째 종류의 값 변경 경로가 생기고, 그것을 여는 Cycle 은
                        생명력·기력·이동을 읽는 모든 자리를 지난다 (넓다)
                    (c) 둘 다 — 좁히고, 여는 일을 후보로 남긴다
        결과 예측    (a) 를 고르면 성장은 "겨루는 값만 키우는 축" 으로 확정되고
                    MC-GAIN-LEVEL 의 남은 결손이 원천 둘로 줄어든다

    ② `validation.static: PENDING` 이 그대로다
        비교 집합이 이 성장 하나뿐이라 Dominance 를 잴 수 없다. 결손이 아니라
        상태이며, 둘째 성장이 설 때 함께 본다.

    ③ **잘 터뜨린 판이 덜 쌓는다** — 효율이 벌을 받는다
        Conflict    한 마리를 넘어뜨려 얻는 것이 18~21 로 흔들리고, 그 폭을 정하는
                    것이 플레이어의 판단이 아니라 세계의 흔들림이다 (C015).
                    열 판 중 둘은 넘어뜨리고도 첫 문턱에 닿지 않는다
        Affected    DC-COMBAT-PLAYER-CAUSALITY · GBC-GAIN-LEVEL · World.DeedCatalog
        Trade-off   (a) 그대로 둔다 — Goal 이 적은 길("쓰러뜨리고 캐면")은 어느
                        판에서도 넘고 폭 3 은 작다. 흔들림이 성과에 닿는 것을
                        이 세계가 받아들이기로 한다
                    (b) 쓰러뜨림의 몫을 키운다 (14 → 16) — 한 마리로 언제나 넘게
                        되고(20~23) 폭은 그대로 남는다. 가장 작은 변경
                    (c) 치기의 몫을 없앤다 (1 → 0) — 원천을 **끝난 일**
                        (쓰러뜨림 · 캠 · 살펴봄)로만 두면 흔들림이 아예 닿지 않는다.
                        대신 "치는 것" 이 원천에서 빠지고 문턱을 다시 세워야 한다
        결과 예측    (c) 를 고르면 DC-COMBAT-PLAYER-CAUSALITY 가 PARTIAL 에서
                    SATISFIED 로 돌아가고, 쌓임이 "행위의 수" 가 아니라 "끝낸 일의
                    수" 가 된다 — 그편이 다른 성장 축(숙련 · 스킬 숙련)과도 형태가 같다
        수치는 Human 소유다 (CLAUDE.md 원칙 19)

## Works 로 넘어간 것 (VIEW 레인)

    이 Cycle 이 남긴 화면 몫 둘은 `works/BACKLOG.md` 의 "성장 (이관 — C-GROWTH-001)"
    절에 섰다 — 경위에 자란 몫을 쓰는 일 · 오른 순간을 눈에 걸리게 하는 일.
    둘 다 세계도 계약도 요구하지 않는다.
