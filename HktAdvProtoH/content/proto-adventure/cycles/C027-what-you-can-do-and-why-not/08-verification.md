# CYCLE C027 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression

## 실측 환경

    npm test              60 파일 · **1059 통과 / 0 실패**   (착수 시점 1016 → +43)
    npx tsc --noEmit      오류 0
    npm run build         성공
    npm run boundary:check  경계 위반 0 (assembly 8 · content/proto-adventure 122 ·
                          content/blank 3 · engine 56)
    npm run catalog:check  카탈로그 3원소 정합
    실제 플레이           `npx vite --port 5599` (세계가 같은 프로세스에서 돎) +
                          Chromium 1440×900 으로 조작·관찰

    변경 파일             `world/` **0** · `engine/` **0** · `protocol/` **0** · `server/` **0**
                          (`git diff --stat` 로 확인 — 출력이 비어 있다)

## NEW BEHAVIOR

    지닌 기술 전부가 한 자리에      셋이 나란히 선다. 하나가 다른 하나를 밀어내지 않는다
    막힌 기술마다 자기 사유          기력이 모자란 것과 막는 중인 것이 각자의 칸에서 갈린다
    고르기 전에 값을 안다           치를 기력 · 채울 기력 · 지금 이 몸의 공격 피해 · 방식
    요청의 대답이 그 자리에          거절이 그것을 부른 칸에 붙는다. 남의 자리에 붙지 않는다
    닿지 못한 것과 거절이 갈린다     "세계에 닿지 않음" 과 "거절 · 사유" 는 다른 말이다
    받아들여짐이 보인다             나간 것과 애초에 못 나간 것이 화면에서 갈린다

## WORLD SCENARIO

    **이 Cycle 은 세계의 행동을 하나도 바꾸지 않는다.** 그러므로 이 자리의 검증은
    "새 전이가 일어나는가" 가 아니라 **"기존 전이가 한 톨도 달라지지 않았는가"** 다.

        Input    `npx vitest run content/proto-adventure/world`
        Result   26 파일 · **532 통과 / 0 실패** — 기대값이 한 줄도 바뀌지 않았다

        기술에 직접 걸린 것만 다시   skill-phase · combat · guard · c019-integration
        Result                     4 파일 · **98 통과 / 0 실패**

        Before → Input → Rule → After 의 실측 자체는 C007 · C011 · C012 · C019 의
        08 이 이미 소유한다. 이 Cycle 은 그것들을 **재실행**했을 뿐이며, 그것이
        이 Cycle 이 세계에 손대지 않았다는 증거다.

## PROJECTION

    04 가 `change: NONE` 으로 판정했고, Stage 6 이 그것을 반증하려다 실패했다.

        투영 코드 변경          0 줄 (`world/projection/observer-view.ts` 무변경)
        계약 형 변경            0 (`protocol/gameview.ts` 무변경)
        `skill.identification`  `profile` 이 실린 interaction 이 기술이다 —
                                투영을 고치지 않고도 이미 참이다

    실측으로 확인한 계약 값 (`combat` · `guard` · `damage-type` fixture, 그리고 실제 세계)

        interactions[].available   기술마다 따로 온다
        interactions[].reason      기술마다 따로 온다 · 언제나 하나
        interactions[].profile     일곱 값 전부 온다 (cost · charge · rawDamage ·
                                   damageType · baseDamage · attackRatio ·
                                   swingBegin · swingEnd)
        RequestOutcomeView         표식을 붙여 되돌아온다 — 기술 요청도 예외가 아니다

## VIEW FIXTURE

    `view/tests/skill-observation.spec.ts` — **43 통과 / 0 실패.** World 미기동 (VUX-SK-V-12).
    `view/tests/fixtures/skill-unknown.fixture.json` — 새 Fixture 하나.

    기획서 §14 의 묶음별 결과

        VUX-SK-FX-READY         PASS   셋 전부가 칸이 된다 · 세계가 준 순서 그대로 ·
                                       실제 바인딩(F · G · R)이 칸에 보인다 ·
                                       기술이 없으면 칸도 줄도 없다
        VUX-SK-FX-UNAVAILABLE   PASS   `combat` fixture 한 화면에서 기본은 `지금 됨`,
                                       고급은 `불가 · 기력 모자람` — **둘 다 보인다** ·
                                       `guard` 는 셋 다 `불가 · 막는 중`
        VUX-SK-FX-STALE         PASS   요청 중 · 거절 · 닿지 못함 · 받아들여짐이 서로 다르다 ·
                                       거절이 남의 자리에 붙지 않는다
        VUX-SK-FX-UNKNOWN       PASS   모르는 기술도 칸을 얻고, 키가 없어도 사라지지 않고,
                                       모르는 사유·방식이 원문 그대로 보인다
        VUX-SK-FX-AIMING /
          ACTIVATION / PRESENCE  해당 없음  세계에 그 의미가 없다 (04 fixtures.outOfScope)
        VUX-SK-FX-MULTI-TARGET   해당 없음  이미 닫혀 있다 (C007 · C010)
        VUX-SK-FX-HIDDEN         해당 없음  이 Cycle 의 표면에는 내 몸의 관찰만 실린다

    자동 검증 (기획서 §14.2 중 이 Cycle 해당분)

        VUX-SK-V-01   PASS   보이는 기술마다 실제 bindingId · availability · reason 을
                             그대로 표현한다
        VUX-SK-V-02   PASS   기술마다 키가 실리고, 손가락 버튼이 서는 조건
                             (`key && prompt && !terrainTarget`)을 모두 만족하며,
                             같은 code 는 같은 기술 하나로 풀린다
        VUX-SK-V-05   PASS   걸어 둔 것이 기력 · 존재 · 타격 · 이펙트를 하나도 바꾸지 않는다 ·
                             세계에 없는 자리(재사용 대기 · 토글 · 연계)를 만들지 않는다
        VUX-SK-V-10   PASS   모르는 코드가 원문으로 보이고 예외가 나지 않는다
        VUX-SK-V-12   PASS   43 항목이 World 프로세스 없이 통과한다

## PLAYABLE

    세계와 클라이언트를 붙이고 실제로 조작해 관찰한 결과다. 아래 줄은 화면에서 읽은 것이다.

    ### ① 손에 든 것 전부가 한 자리에 (입력 전)

        [F] 기본 스킬: 지금 됨
        [G] 고급 스킬: 지금 됨
        [R] 오라 스킬: 지금 됨

        그리고 패널에 값이 함께 선다 — **이 값들이 화면에 도착한 것은 이번이 처음이다.**

        ── 기술 ──
        [F] 기본 스킬 · 기력 -0 / +12 · 공격 피해 26 (물리)
        [G] 고급 스킬 · 기력 -30 / +8 · 공격 피해 72 (물리)
        [R] 오라 스킬 · 기력 -0 / +12 · 공격 피해 26 (오라)

    ### ② 받아들여짐이 그 자리에서 보인다 (G 한 번)

        [F] 기본 스킬: 불가 · 행동 중
        [G] 고급 스킬: 나갔다
        [R] 오라 스킬: 불가 · 행동 중

        **나간 것과 못 나간 것이 한 화면에서 갈린다.** 그리고 1.6초 뒤

        [F] 기본 스킬: 지금 됨   [G] 고급 스킬: 지금 됨   [R] 오라 스킬: 지금 됨

    ### ③ 거절이 그것을 부른 칸에 붙는다 (막기를 건 뒤 F)

        [F] 기본 스킬: 거절 · 막는 중       ← 내가 실제로 걸었고 거절당했다
        [G] 고급 스킬: 불가 · 막는 중       ← 세계가 미리 말해 둔 것
        [R] 오라 스킬: 불가 · 막는 중

        `거절` 과 `불가` 가 다른 말이라는 것이 화면에서 읽힌다.
        그리고 막기를 풀면 셋 다 `지금 됨` 으로 돌아온다 — 지난 일이 현재를 가리지 않는다.

    ### 기획서 §14.3 의 완료 기준 대조

        30초 안에 쓸 수 있는 것과 못 쓰는 사유를 구분한다        **가능** — 띠 한 줄이 곧 그 답이다
        60초 안에 조준해 기준과 예상 범위를 설명한다              **해당 없음** — 조준이 세계에 없다
                                                              (`VUX-SK-02` 의 자리이며, 그 앞에
                                                               Anchor 를 세우는 World Cycle 이 선다)
        Anchor 와 실제 대상이 같지 않을 수 있음을 설명한다         **해당 없음** — 같은 이유
        오버레이에서 한 실행을 90초 안에 추적한다                 **해당 없음** — `VUX-SK-05` 의 자리

        기획서 §13 이 `VUX-SK-01` 에 건 완료 조건은 첫 줄 하나이며 그것은 충족되었다.

    ### 실측이 찾아낸 것 — 두 번 고쳤다

    Fixture 만으로는 드러나지 않고 **실제로 돌려 보아야 드러난 결함**이 둘이었다.
    둘 다 "화면이 지금 참이 아닌 것을 말한다" 는 같은 병이다.

        ① 낡은 거절이 현재를 가렸다
           막기를 푼 뒤에도 `거절 · 막는 중` 이 그대로 떠 있었다. 세계는 이미 "된다" 고
           말하는데 화면이 지난 일을 현재처럼 말했다.
           → 거절은 세계가 **여전히 같은 사유로 막는 동안에만** 남는다.
             되면 그냥 되고, 사유가 바뀌면 세계의 지금 말이 이긴다.

        ② `나갔다` 가 한 번도 뜨지 않았다
           받아들여진 기술은 그 순간부터 행동 중이라 세계가 곧바로 `action-busy` 로 막는다.
           `불가` 를 먼저 보던 순서에서는 받아들여짐이 영영 화면에 닿지 못했고,
           **나간 것과 애초에 못 나간 것이 같아 보였다** — 이 Cycle 이 없애려던 상태다.
           → 받아들여짐을 `불가` 앞에 두고, 대신 오래 머물지 않게 했다 (1.2초).

    둘 다 04 를 고치지 않고 닫았다 — 계약이 모자란 것이 아니라 화면이 순서를 잘못 정한
    것이었기 때문이다.

## REGRESSION

    03 의 AFFECTED 는 **없음**(세계 판정이 바뀌지 않음)이므로, 회귀의 자리는
    02 의 AFFECTED 넷이다.

    명령 콘솔의 대답 붙이기      **PASS** — 명령은 지금까지처럼 표식을 달고 나가고 그
                              기록 줄에 대답이 붙는다 (`command.spec.ts` 포함 전 항목 통과).
                              달라진 것은 하나다: 표식 없는 대답을 마지막 줄에 붙이던
                              갈래가 사라졌다. 명령은 언제나 표식을 달므로 그 갈래가
                              잡아내던 것은 **처음부터 남의 요청의 대답뿐**이었다 (07 FIXED)

    바닥 프롬프트               **PASS** — `resolvePresentation` 의 interactions 목록이
                              그대로다. `attack` 은 여전히 `KeyF` · `기본 스킬` 이고
                              `skill-heavy` 의 `unavailableText` 도 그대로다.
                              C017 의 우선순위 판단을 뒤집지 않았다 (전용 테스트로 고정)

    손가락 버튼 띠              **PASS (부분)** — 같은 `scene.interactions` 를 읽으므로
                              두 표면이 갈리지 않는다. 기술이 그 띠가 요구하는 조건을
                              모두 만족하는 것을 테스트로 고정했다.
                              다만 **사유 문구는 여전히 그 띠에 그려지지 않는다** —
                              기반의 일이다 (아래 MASTER FEEDBACK)

    기존 Fixture                **PASS** — `combat` · `guard` · `damage-type` 을 그대로 써서
                              띠가 선다. 계약을 열지 않았다는 증거이기도 하다.
                              기대값을 고친 기존 테스트는 **하나**뿐이다
                              (`combat.spec.ts` 의 HUD 순서 — 기술 칸 둘이 는다)

    과거 Cycle 전체              **PASS** — 60 파일 1059 항목. C001~C024 의 검증 자산이
                              하나도 깨지지 않았다

## MASTER FEEDBACK

    ### Capability Overlay

        해당 없음 — 이 Cycle 은 Master Graph 의 노드를 늘리지도 옮기지도 않는다
        (01 MASTER TRACE — Frontier 없음 · 직접 관찰 Cycle).

        다만 위층이 알아야 할 사실이 하나 있다.

            **이미 IMPLEMENTED 인 기술 관련 Capability 들(C007 기력 수지 · C012 방식 ·
            C019 구간)의 값이 지금까지 화면에 한 번도 도착하지 않고 있었다.**
            세계에 규칙이 서 있다는 것과 겪는 사람이 그것을 만난다는 것은 다른 일이며,
            Overlay 의 `IMPLEMENTED` 는 지금 **앞의 것만** 본다.
            `MC-*` 마다 "관찰 표면이 있는가" 를 함께 볼 것인지는 Human 이 정할 일이다.

    ### Constraint Evaluation

        DC-WORLD-OWNS-THE-SURFACE-LIST    **SATISFIED**

            근거는 이 문서의 실측이다. 화면 코드에 기술 이름도, 사유의 우선순위도,
            피해 공식도 없다. 유일한 분류는 `interaction.profile !== undefined` 하나이며
            그것도 계약이 실은 값을 보는 일이다.

            테스트가 그것을 고정한다 — "profile 을 떼면 이름이 그대로여도 기술이 아니다",
            "role 이 `skill-` 로 시작하지 않아도 profile 이 있으면 기술이다".

            이 Constraint 가 실제로 형태를 제한한 자리가 둘 있다.
              · 계약에 "이것이 기술이다" 라는 칸을 더하려던 것을 막았다 (03 JUDGEMENT ①)
              · 화면이 `기력 < cost` 를 직접 견주려던 것을 막았다 — `reason` 이 이미 답이다

    ### Constraint Candidate

        관찰된 반복 패턴 하나를 **후보로만** 올린다. 승격 판단은 Human 이다.

            (가칭) **화면은 지난 일로 지금을 가리지 않는다**

            이 Cycle 이 실측에서 두 번 만난 것이 같은 병이었다 —
            낡은 거절이 현재를 가린 것, 받아들여짐이 현재에 가려 영영 못 뜬 것.
            둘 다 "관찰자가 쥔 사실(내 요청)" 과 "세계가 말한 지금" 을 한 자리에
            놓을 때 생긴다.

            이 세계는 관찰자가 쥔 값을 이미 여럿 지닌다 (C005 표식 · C008 시점 ·
            C009 명령 기록 · F1 이펙트 기억). 그중 **세계의 지금과 같은 자리에서
            겨루는 것**은 이번이 처음이며, 앞으로 조준(`VUX-SK-02`)과 진행
            (`VUX-SK-03`)이 같은 자리에서 같은 겨룸을 만든다.
            그때마다 각자 순서를 정하면 화면마다 다른 답이 생긴다.

    ### Master Gap

        없음 — 상위 의미와 어긋난 지점이 없다.

        다만 **다음 Cycle 이 Master 를 거쳐야 한다는 사실**을 보고한다.

            기획서 `VUX-SK-D1` 이 권고한 다음 단계 `VUX-SK-02`(조준)는
            **관찰 Cycle 이 아니다.** Anchor(Self · Unit · Direction · GroundPoint)는
            이 세계에 존재하지 않으며(01 SCOPE NOTE ⑤), 그것을 세우는 것은
            세계에 의미를 더하는 일이다.

            그러므로 `VUX-SK-02` 앞에는 **Anchor 를 세우는 World Cycle 하나**가 서야 하고,
            그 Cycle 의 Goal 은 Frontier 에서 와야 한다. 지금 `master/frontier.md` 의
            여섯 후보 중 그것에 해당하는 것이 없다.

            `VUX-SK-03`(복합 Activation) · `VUX-SK-04`(Presence)도 같다.
            `VUX-SK-05`(실행 추적)만이 순수한 관찰 Cycle이며, 그것은 지금 세계에서도
            대부분 가능하다 (strikes · contacts · cancels · breakdown 이 이미 온다).

    ### 위층에 남기는 부채 하나

        **손가락으로 하는 사람은 여전히 "왜 안 되는가" 를 읽지 못한다.**

        `engine/view-kernel/hud/touch-pad.ts` 는 `available` 을 `data-` 속성으로만 쓰고
        사유 문구를 그리지 않는다. 컨텐츠 Cycle 이 기반을 고치지 않으므로 이번에
        닫지 않았고, 우회 판정도 만들지 않았다 (기획서 §11 의 `[CAPABILITY-GAP]`).

        그러므로 이 Cycle 이 연 INTENT-SKILL-BLOCK-NAMES-ITSELF-001 은
        **아직 한쪽 표면에서만 참이다.** 기반 트랙의 일이다.

## FAILURES

    없음 — 6종 검사 전부 통과. 담당 Stage 로 반환한 것도 없다.

    Stage 7 이 두 번 고친 것은 실패가 아니라 **실측이 한 일**이다 (PLAYABLE 절).
    둘 다 04 를 고치지 않고 닫혔으므로 계약이 모자랐던 것이 아니다.

## Cycle Completion Gate

    [x] 작은 플레이 가능한 Goal 이 정의되어 있다          01 GOAL — 한 문장
    [x] Goal / Possibility 가 존재한다                  02 — Goal 2 · Possibility 5
    [x] Intent 가 존재한다                              02 — Intent 6
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다    03 SEMANTIC CLOSURE — 남은 문장 0
    [x] World State 변화가 World Rule 을 통해서만 발생한다  이 Cycle 은 World State 를
                                                       바꾸지 않는다 — `world/` 변경 0 파일
    [x] World 는 Authoritative 하다                     화면은 판정을 하나도 하지 않는다
                                                       (Constraint Evaluation 의 근거)
    [x] GameView Specification 이 존재한다               04 — `change: NONE`
    [x] View 는 Spec 외 World 정보를 사용하지 않는다       boundary:check 위반 0 ·
                                                       `view/` 가 `world/` 를 import 하지 않는다
    [x] World 는 View 구현 정보를 사용하지 않는다          `world/` 무변경
    [x] World 를 View 없이 검증할 수 있다                 world 테스트 532 통과
    [x] View 를 Fixture 만으로 검증할 수 있다             skill-observation 43 통과 (World 미기동)
    [x] Server + Client 연결 시 실제 플레이가 가능하다      PLAYABLE ①②③
    [x] Runtime 결과를 Goal / Possibility / Intent 까지    02 DESIGN TRACE · 04 의 각 `source` ·
        추적할 수 있다                                   07 SPEC CONSUMED 표
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다     **Human 확인 대기**
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다      `skill-presentation.ts` 는 기술 이름을
                                                       하나도 지니지 않는다 — 기술이 넷이 되어도
                                                       열리지 않는다. `SkillAnswer` 는
                                                       조준·진행이 같은 자리에서 쓸 형이다

## STATUS

    IN PROGRESS

    15항 중 14항이 실측으로 충족되었다. 남은 하나는 **Human Play 확인**이며,
    그 전에는 `COMPLETE` 로 바꾸지 않는다 (Guide 의 Must).

    Human 이 확인할 것은 하나다 — 실제로 띄워 F · G · R 을 눌러 보고,
    **셋이 한 자리에 서고, 못 쓰는 것마다 이유가 붙고, 거절이 그 자리에 오는지.**
