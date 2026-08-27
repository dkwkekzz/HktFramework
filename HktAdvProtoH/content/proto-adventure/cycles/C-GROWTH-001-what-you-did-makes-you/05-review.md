# C-GROWTH-001 — Human Semantic Review

## 검토 대상

    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml

## 질문

    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 결과

    APPROVED
    승인       Human 위임 · 세션 지시 ("계속 진행" — Stage 5 대기 보고에 대한 답)
    Return To  해당 없음
    Reason     해당 없음

## 승인이 확정한 것

승인은 아래 판단들을 함께 확정한다. Stage 6·7 은 이것을 다시 열지 않는다.

    자란 몫의 자리        **유효 값의 넷째 항이다.** 기본값을 덮지 않는다 —
                          덮으면 밖의 손(RULE-ATTRIBUTE-SET-001)과 안의 성장이 서로를
                          지운다. C023 의 "가감이 아니라 재계산" 을 그대로 잇는다
                          (02 의 POSSIBILITY-THE-BASE-IS-NEVER-TOUCHED-BY-GROWING)

    자라는 값의 목록       겨룸에서 읽히는 넷뿐이다 — physicalAttack · auraAttack ·
                          armor · resistance. 관통 둘 · 치명 둘 · 통찰은 성질상 자라지
                          않고, **생명력 · 기력 · 이동은 유효 값 자리가 없어 이 Cycle 이
                          닿지 않는다** — GS §5 가 이름을 댄 다섯 중 셋이 결손으로
                          남으며 그것을 08 이 위층에 보고한다
                          (02 의 INTENT-WHAT-GROWS-IS-WHAT-THE-CONTEST-READS-001)

    쌓임의 원천 넷         세계에 실재하는 것만 쓴다 — 치기 · 쓰러뜨림 · 캐기 · 살펴봄.
                          탐험과 사건 해결은 지어내지 않고 결손으로 남긴다
                          (02 의 INTENT-ONLY-REAL-ACTS-COUNT-001)

    쓰러뜨림의 자리        RULE-STRIKE-DAMAGE-001 안이다. RULE-DOWNED-001 은 쓰러진 몸만
                          알고 쓰러뜨린 몸을 모르며, 밖의 손이 생명을 0 으로 만들 때도
                          불린다 — **밖의 손이 만든 쓰러짐은 아무의 일도 아니다**

    수치 셋               03 의 BALANCE ①~⑤ —
                          원천 1 · 14 · 4 · 3 ·
                          문턱 20 · 50 · 90 · 140 · 200 (최대 5단계) ·
                          단계당 physicalAttack +4 · auraAttack +4 · armor +3 · resistance +3.
                          첫 문턱 20 은 Frontier 의 Playable Result 문장에 맞춘 값이다

    자율 존재도 쌓는다      규칙이 조종 주체를 가리지 않는다. 08 이 재는 상대는 같은
                          종류의 **다른 개체**이고 새 몸의 Deeds 는 언제나 0 이므로
                          비교는 흔들리지 않는다 (03 의 BALANCE ④)

    밖의 손                `deeds` 는 MutableAttribute 에 들고 **줄이는 쪽으로도 열린다** —
                          밖의 손은 되돌릴 수 있어야 디버그의 자리다.
                          단계는 들지 않는다 (파생)

    Capability 판정        `MC-GAIN-LEVEL` 은 이 Cycle 로 IMPLEMENTED 가 되지 않을 수
                          있다. 원천 넷 중 둘이 세계에 없으므로 정직한 판정은 PARTIAL 이며
                          Stage 8 이 실측으로 확정한다 (01 의 Master Feedback)

## 다음

    Stage 6  World Implementation   — world/ + 06-world-implementation.md
    Stage 7  View Implementation    — view/ + 07-view-implementation.md
