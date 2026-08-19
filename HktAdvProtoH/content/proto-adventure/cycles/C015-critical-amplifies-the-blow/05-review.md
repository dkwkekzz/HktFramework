# C015 — Human Semantic Review

> 이 파일은 Human 의 결정을 그대로 옮긴 것이다. 판단은 Agent 가 하지 않았다.
> 2026-08-19 세션 기록이다.

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml

## 제시한 판단 3건

    1. 우연의 원천을 세계가 소유한다 — 세계 상태 둘(ChanceSeed · ChanceCursor)과
       그 위의 순수 함수 ChanceAt(Seed, Cursor) 로 흔들림을 만든다.
       되짚을 수 있으면서(같은 세계를 같은 순서로 굴리면 같은 이야기)
       미리 알 수는 없다(뿌리 · 커서 · Roll 값이 관찰에 실리지 않는다).
       근거는 Q11(b) (2026-08-19 Human — 확률 Critical 허용) 이며,
       DC-COMBAT-PLAYER-CAUSALITY 가 REVISED 로 그 예외를 이미 명시해 두었다.
       제시한 대안 — 규칙 밖의 난수원을 그때그때 읽는다. 코드는 짧아지지만
       세계가 되짚을 수 없게 되고, 서버·테스트·재생이 같은 세계를 재현할 수 없다.

    2. 확률의 양 끝에서 커서를 소비하지 않는다 — 0 이면 결코, 1 이면 언제나 터지며
       그 두 갈래에서 ChanceCursor 가 움직이지 않는다.
       `Roll < Chance` 만으로도 결과는 이미 옳지만, **이미 정해진 일에 우연을 쓰지
       않는다**를 규칙으로 세운다. 그 결과 criticalChance 를 0 으로 둔 세계는
       C013 과 한 톨도 다르지 않으며 이것이 Regression 의 기준이 된다
       (03 RULE-CRITICAL-STRIKE-001 Step 2).
       제시한 대안 — 언제나 소비한다. 규칙이 한 줄 짧아지지만 "확률 0 인 존재만
       있는 세계" 조차 커서가 흐르게 되어, 이 층이 정확히 한 자리에만 뚫려 있다는
       증거를 실측으로 보일 수 없다.

    3. 증폭이 막기보다 먼저다 — Critical 이 계산 결과를 키우고, 막기가 그 커진 값을
       마주한다. 피해값만 보면 곱셈이라 순서가 무관하지만 막기의 대가는 감쇄 전
       값으로 매겨지므로(C011 INTENT-GUARD-COST-001) 순서가 기력 대가를 가른다.
       그래서 크게 터진 한 방은 막아도 더 아프고 막는 데 더 들며, 방어가 더 쉽게
       무너진다. 막기의 규칙은 한 줄도 바뀌지 않고 마주하는 크기만 달라진다
       (03 RULE-STRIKE-DAMAGE-001).
       제시한 대안 — 막기가 먼저다. 크게 터진 한 방을 막는 값이 싸지지만
       "생명 대신 기력" 의 무게가 타격 크기와 무관해지고, R1 핵심 원칙이 두 층에
       배정한 `Critical → Final Damage 증폭` 과 `Guard → Final Damage 감소` 중
       어느 쪽이 최종인지가 모호해진다.

## 결과
    APPROVED       2026-08-19
    Return To      해당 없음
    Reason         01~04 와 위 판단 3건을 대안과 함께 제시한 뒤 Human 이
                   "05-review.md APPROVED 로 작성하고 Stage 6~8 진행" 을 선택했다.
                   항목별 수정 요청은 없었다.
                   Stage 6 World Implementation 으로 진행한다.

    기록 주의      이 승인은 항목별 검토가 아니라 **제시된 묶음에 대한 진행 지시**다.
                   Stage 8 의 Human Play 확인에서 의미가 어긋나면 그때 되돌린다.
