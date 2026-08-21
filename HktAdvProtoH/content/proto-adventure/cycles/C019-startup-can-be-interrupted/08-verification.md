# C019 — Verification

    STATUS   VERIFIED (자동 검증 전항 통과) · **Human Play 대기**
             Cycle Completion Gate 15항 중 14항 참. 남은 하나는 사람이 화면에서
             확인해야 하는 항목이다 (아래 PLAYABLE).

## 6종 검사

    [x] 1. Semantic Closure        Intent 7 → State 3 · Rule 5 로 전부 닫힌다
    [x] 2. World Rule 실행         Before → Input → Rule → After 를 26건 실측
    [x] 3. Projection              actionPhase · cancels · profile 경계가 계약대로 나온다
    [x] 4. View Binding            Fixture 만으로 9건 통과 (World 미기동)
    [~] 5. Playable                World→View 통합 3건 실측 통과 · **화면 확인은 Human 몫**
    [x] 6. Regression              AFFECTED 4종 + 기존 828건 전량 통과
    [x] 7. Catalog                 존재 종류를 건드리지 않았다 — `catalog:check` 정합

    전체 861건 통과 (기존 828 + C019 신규 33) · 타입 검사 통과 · 경계 위반 0

## NEW BEHAVIOR

    ① 기술의 시간이 셋으로 갈리고 그 경계가 기술마다 다르다
       기본 공격 0.6초 중 앞 0.15초 · 큰 기술 0.9초 중 앞 0.45초가 선딜이다.
       같은 진행도 0.4 가 기본 기술이면 이미 판정, 큰 기술이면 아직 선딜이다 (실측).

    ② 선딜 중에 맞으면 그 기술이 없던 일이 된다
       피해 0 이 아니라 산정 자체가 없다 — 캔슬된 큰 기술의 StrikeEvent 가 0건임을
       관찰로 확인했다.

    ③ 이미 나간 칼은 멈추지 않는다
       판정·후딜 구간의 피격은 행동을 바꾸지 않고 진행도도 흔들지 않는다 (실측).
       같은 개입이 시점만으로 갈린다: swingBegin - 0.01 → cancelled,
       swingBegin + 0.01 → uninterrupted.

    ④ 자율 존재가 큰 기술을 건다
       시작 기력 20 < 비용 30 이므로 기본 기술로 모으다가 32 에서 큰 기술을 건다.
       지어낸 주기가 아니라 C007 수지의 결과다 (실측 — 8초 안에 도달).

    ⑤ 무엇이 왜 끊겼는지가 보인다
       cancels 가 strikes · contacts 와 나란히 실리고 같은 수명으로 사라진다.

## WORLD SCENARIO

    world/tests/skill-phase.spec.ts — 21건

        RULE-SKILL-PHASE-001
            기술이 아닌 행동(idle · hit)      → phase 없음
            attack 0.1 / 0.5 / 0.9           → startup / active / recovery
            heavy 0.4                        → startup (기본 기술이면 active 인 지점)
            heavy 0.50 정확히                → active (경계에 선 순간은 이미 나갔다)
            heavy 0.85 정확히                → recovery
            선딜 실시간                       → 0.15초 ↔ 0.45초

        RULE-HIT-001 (CHANGED)
            heavy 0.2 에서 피격              → cancelled · CancelEvent 1건 · 행동 hit
            heavy 0.6 에서 피격              → uninterrupted · 행동 유지 · elapsed 불변
            heavy 0.9 에서 피격              → uninterrupted
            mine 중 피격                     → struck · hit · CancelEvent 0건
            0.49 vs 0.51                     → cancelled vs uninterrupted

        RULE-NPC-DECIDE-001 (CHANGED)
            기력을 모은 뒤 heavy-attack 을 걸고 그 구간이 관찰된다

        관찰
            idle 에는 actionPhase 가 실리지 않는다
            내 heavy 가 startup → active → recovery 로 읽힌다
            방해가 없으면 완주한다 (캔슬 0건)
            profile 에 attack 0.25/0.75 · heavy 0.50/0.85 · aura 0.25/0.75

        캔슬 관찰
            선딜 중 피격 → cancels 1건 (attacker · target · skill 일치)
            캔슬된 기술의 StrikeEvent 0건
            끊은 타격 자체는 StrikeEvent 로 남는다 (같은 순간의 다른 두 사실)
            2초 뒤 cancels 0건 (STRIKE_EVENT_TTL)

## VIEW FIXTURE

    view/tests/phase.spec.ts + fixtures/phase.fixture.json — 9건 (World 미기동)

        한 장면이다: 나는 큰 기술의 선딜 중(끊길 수 있다), 적대인 상대는 이미 칼을
        냈고(늦었다), 중립인 상대는 걷는다(구간이 없다). 그 순간 내 기술이 끊겼다.

        선딜인 몸에만 '준비!' 가 붙는다 · 이미 나간 몸엔 붙지 않는다 ·
        기술이 아닌 행동엔 없다 · 관계 표시와 나란히 선다
        끊긴 자리에 "강공격 끊김" 이 뜨고 크게 그려진다 · 타격 숫자와 섞이지 않는다
        **같은 progress 에 phase 만 바꾸면 표시가 따라 바뀐다** — View 가 구간을
        다시 계산하지 않는다는 증거다

## PLAYABLE

    world/tests/c019-integration.spec.ts — 3건 (Fixture 아님)

    진짜 World 를 굴려 나온 관찰 결과를 진짜 View 결정 Layer(resolvePresentation)에
    통과시켰다. 세계 → 계약 → 화면 결정이 한 줄로 이어진다.

        자율 존재가 큰 기술의 선딜에 들면 그 몸 위 이름표에 '준비!' 가 실제로 뜬다
        그 존재가 판정 구간에 들어서면 그 표시가 사라진다 (늦었다가 화면에서 읽힌다)
        내 큰 기술이 끊기면 "강공격 끊김" 이 emphasis 로 뜬다

    **남은 것 — 사람이 화면에서 확인할 것**

        ① 선딜 0.45초가 실제로 보고 반응할 수 있는 길이인가
        ② '준비!' 표시가 그 시간 안에 눈에 들어오는가 (몸 위 이름표 자리에서)
        ③ 늦게 넣었을 때 "내가 늦었다" 가 납득되는가 — 상대의 칼이 그대로 나가는 것이
           화면에서 읽히는가

        셋 다 값이나 표시 자리의 문제이지 규칙의 문제가 아니다. 짧다면 고칠 곳은
        03 BALANCE ① 의 한 줄(heavy 의 swingBegin)이다.

    실행 방법: `npm run world` + `npm run client` (또는 `run.sh`).
    적대인 자율 존재에게 다가가 그 몸 위 '준비!' 를 노려 때린다.

## REGRESSION

    AFFECTED 4종 — 전부 재실행

        RULE-SWING-STRIKE-001      기본 기술의 접촉 시점이 한 프레임도 달라지지 않았다.
                                   피해 20 / 55 · 관통 · 치명 · 막기 실측 전부 그대로
                                   (attack · damage · damage-type · penetration ·
                                    critical · guard spec 전량 통과)
        RULE-NPC-DECIDE-001        C018 의 관계 거르기(사냥감만 쫓는다)가 그대로 선다
                                   (relation.spec 통과)
        RULE-STRIKE-EVENT-EXPIRE-001  타격·무산의 수명이 그대로다
        ActionCollider             기본·오라 기술의 경계값이 같으므로 기하 불변
                                   (collision.spec 통과)

    손질한 기존 테스트 둘 — 의미를 바꾸지 않는 정합 수정임을 확인했다

        ① SWING_BEGIN import → DEFAULT_SWING_BEGIN / 그 기술의 값.
           기본 기술 값이 0.25 그대로이므로 기대값이 변하지 않는다.
        ② combat.spec 의 피격 배율 검증 둘이 "1.5초 뒤" 라는 고정 시각에 기대고 있었다.
           자율 존재가 큰 기술을 고르면 첫 타격 시각이 달라지므로 **맞을 때까지 굴리는**
           방식으로 바꿨다. 검증 대상(HIT_CHARGE_FACTOR · 두 원천의 곱)은 그대로다.

    **회귀로 잡힌 실제 변화 하나** — 판정 구간 피격에는 hit 이 오지 않으므로 충전 억제도
    걸리지 않는다. 03 BALANCE ③ 이 미리 판단해 둔 결과이며 새로 발견된 문제가 아니다.

## MASTER FEEDBACK

    ### Overlay 변화 제안

        MC-INTERRUPT   PARTIAL → **IMPLEMENTED** (근거: 이 문서의 실측)
            overlay 가 적어 둔 결손은 "끊는 것을 **노리는** 수단 — 지금은 아무 타격에나
            따라오는 부수 효과라 언제 끊을까 라는 판단이 없다" 였다.
            그 결손이 닫혔다: 끊김은 이제 선딜 구간에만 성립하고(RULE-HIT-001 실측),
            같은 개입이 시점만으로 갈리며(0.49 vs 0.51), 무엇을 노릴지가 화면에서
            읽힌다(통합 실측). world_shape("그 구간에 노려서 개입하면 행동이 완성되지
            못하게 만들 수 있어야 한다")가 닫혔다.

            **다만 Human Play 확인 전이다** — 승격은 그 뒤에 하는 것이 옳다.
            C013 · C015 가 같은 상태로 overlay 에 단서를 달았던 선례를 따른다.

        MP-INTERRUPT   요구 Capability 가 MC-INTERRUPT 하나뿐이므로, 위 승격이 확정되면
                       이 갈래가 **닫힌다** — MG-OVERCOME-SUPERIOR-OPPONENT 의
                       다섯 번째 경로다 (C011 · C012 · C013 · C015 에 이어).

        MW-ZONE-DANGER 의 demands 4종 중 MC-INTERRUPT 가 채워진다 (0/4 → 1/4).

    ### Constraint 판정

        DC-COMBAT-PLAYER-CAUSALITY   SATISFIED — 캔슬 판정에 난수가 한 번도 쓰이지
            않는다. 세계의 흔들림(ChanceCursor)을 건드리지 않으며, 같은 시점의 같은
            개입은 언제나 같은 결과를 낸다 (0.49 vs 0.51 실측).

        DC-COMBAT-ONE-FORMULA        SATISFIED — 피해 공식 파일을 한 글자도 고치지
            않았다. 캔슬은 공식 밖에서 "그 산정이 일어나지 않게" 한다.

        DC-COMBAT-ONE-LAYER-AT-A-TIME SATISFIED — 능동 방어 · Critical · Aura 를
            건드리지 않았다. 각 층의 실측값이 회귀에서 그대로 나온다.

        DC-WORLD-OWNS-THE-SURFACE-LIST SATISFIED — 구간 판정도 캔슬 사유도 세계가
            싣는다. View 테스트 하나가 "진행도로 다시 계산하지 않음" 을 못박는다.

    ### Constraint Candidate 후보 — 1건

        **CC-THE-WORLD-JUDGES-THE-MOMENT (가칭)**
            관찰 패턴: 세계 안에서만 아는 경계로 갈리는 사실은, 그 경계가 아니라
            **갈린 결과**를 실어야 한다.
            사례 2회 — C012 의 defenseShape(방어 형태를 View 가 스탯으로 고르지 않는다) ·
            C019 의 actionPhase(구간을 View 가 progress 로 계산하지 않는다).
            DC-WORLD-OWNS-THE-SURFACE-LIST 와의 경계 판단이 필요하다: 그쪽은 "목록을
            세계가 소유한다" 이고 이쪽은 "판정을 세계가 소유한다" 다. 같은 원칙의
            다른 얼굴일 수 있으므로 **Human 판단으로 남긴다** (기존 표면 무리 3종과
            같은 자리에 둘 것).

    ### Master Gap

        없음. 상위 의미와 어긋난 지점이 발견되지 않았다.

    ### 이 Cycle 이 다음에 남기는 것

        시점 판정의 바닥이 섰다 — R1 §14 Active Defense 층(완벽한 막기 · 카운터)이
        요구하는 "언제 눌렀는가" 가 이 위에 얹힌다. MC-PERFECT-GUARD 의 결손이
        "막기의 **시작 시각**이 판정에 쓰이지 않는다" 였고, 이제 세계에 행동 안의
        시점을 읽는 규칙이 있다.

## FAILURES

    없음. 자동 검증에서 실패한 항목이 없다.

    검증 중 두 번 되돌아간 곳이 있었고 둘 다 **테스트의 문제**였지 세계의 문제가
    아니었다 — 기록으로 남긴다.

        ① 난전에서 시점을 겨누려 했다
           "플레이어가 상대의 선딜을 노려 때린다" 를 사거리 안 두 몸으로 검증하려다
           서로 계속 때리는 통에 의도한 시점을 잡지 못했다. 주체를 뒤집어(내 큰 기술이
           끊긴다) 결정적으로 만들고, "노려 끊는다" 쪽은 규칙 단위 검증
           (0.49 vs 0.51)과 Human Play 로 나눴다.

        ② 후딜을 겨눈 tick 이 행동을 넘겼다
           후딜이 0.135초뿐이라 누적 tick 이 그 구간을 지나쳤다. 구간마다 새 세계에서
           그 지점을 직접 겨누도록 고쳤다.
