# C011 — Human Semantic Review

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md (R1) · 02-intent.md (R1) · 03-world-semantic.md · 04-gameview.spec.yaml

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 제시된 판단 지점과 결정

    1  R1 개정 — 자세 재세움 간격(GUARD_REARM_LOCK 0.6초)을 세계 규칙으로 추가한 것
       결정  수용. 이것이 없으면 막기를 여닫는 것만으로 완벽 창이 끊임없이 새로 열려
             01 INCLUDED 의 "창은 한 번만 열린다" 가 말뿐인 문장이 된다.
             새 의미를 더한 것이 아니라 이미 확정된 의미를 세계에서 성립시키는 조건이므로
             Goal · INCLUDED · EXCLUDED 를 바꾸지 않은 채 R1 으로 기록한 처리가 맞다

    2  수치 — 완벽 창 0.20 · 기력 +10 · 열림 0.8 · 되받아침 +25% 는 원본 §8.2·§8.4 그대로,
       재세움 0.6 만 이 Cycle 소유
       결정  수용. 원본에서 가져올 수 있는 것은 가져오고 새로 정하는 값은 하나로 줄인 것이
             옳다. 0.6 을 기본 스킬 한 번의 길이와 같게 둔 근거(한 번의 공격을 읽는 주기가
             그대로 재세움 주기가 된다)도 자의적이지 않다.
             셋 다 Human Play 확인에서 조정 대상으로 남는다는 것도 명시되어 있다

    3  되받아침 증폭이 방어력 감쇄보다 앞에 오는 것
       결정  수용. "본래 피해가 커진다" 는 02 Intent 의 문장 그대로이며,
             열린 상대가 막고 있어도 커진 몫이 실린다는 결과도 그 문장에서 따라 나온다.
             원본 §8.4 의 COUNTER_DAMAGE_BONUS 가 걸리는 자리와도 같다

    4  하나의 창 안에 둘 이상의 타격이 닿으면 둘 다 완벽한 것
       결정  수용. 창을 시각으로만 정의하면 이것이 따라 나오고, 금지되는 것은
             "창을 다시 여는 것" 하나로 충분하다. 상태를 하나 더 만들지 않은 쪽이
             결정론과 관찰 가능성 모두에 낫다.
             둘을 동시에 읽어 낸 것에 대한 보상으로도 읽힌다

## 결과
    APPROVED
    Return To  없음
    Reason     Cycle Goal 이 Intent → World Semantic → GameView Specification 으로
               끊기지 않고 이어지며, 네 판단 지점 모두 그대로 간다.
               특히 이 Cycle 은 C010 이 인계한 DC-COMBAT-DEFENSE-IS-ACTIVE 의 두 번째
               requires 를 실제로 닫는다 — 막아 낸 것이 기력(자원)과 열림(대상의 틈)을
               함께 만들어 그 자리에서 때릴 기회가 된다.
               Stage 6 World Implementation 으로 진행한다.
