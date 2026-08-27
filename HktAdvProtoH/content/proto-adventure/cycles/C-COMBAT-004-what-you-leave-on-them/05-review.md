# C-COMBAT-004 — Human Semantic Review

## 검토 대상

    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml

## 질문

    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 결과

    APPROVED
    승인    Human 위임 · 세션 지시 ("complete 처리하고 다음 cycle 진행" ·
            앞선 "선택은 agent 가 제안대로 진행")
    Return To  해당 없음
    Reason     해당 없음

## 승인이 확정한 것

승인은 아래 판단들을 함께 확정한다. Stage 6·7 은 이것을 다시 열지 않는다.

    표식이 사는 자리       **걸린 쪽의 몸**이 지닌다 (Actor.Marks — 남긴 자 Id → 남긴 시각).
                        지목(관찰자 장부)도 태도(유도)도 아닌 셋째 자리다

    표식은 시각이다        깃발이 아니다. 지우는 규칙이 세계에 생기지 않는다
                        (`guardBrokenUntil` 과 같은 꼴 · Q61(a))

    관문이 보는 대상       **고른 대상**(C017)을 읽는다. 자율 존재는 그 장부를 읽지
                        않으므로 상대를 읽는 요구가 그들에게 언제나 거짓이다 —
                        그 대가를 알고 고른다 (03 JUDGEMENT ①)

    갈림의 처리           관문은 고른 몸을, 표식은 **닿은 몸**을 본다.
                        관문은 예고이지 약속이 아니다 (03 JUDGEMENT ②)

    요구를 지는 것        `mark-strike` 자신이다 — 이미 걸어 둔 상대에게는 나가지 않는다.
                        `hatsu-burst` 에는 **조건**으로만 얹는다 (회귀가 심판이다)

    표식은 여럿           쌍마다 하나. 한 몸이 여럿에게 지닐 수 있고 한 자가 여럿에게
                        남길 수 있다 (03 JUDGEMENT ④)

    피해 0 도 타격이다     피격·밀려남·쌓임이 그대로 일어난다. 표식 한 대가 선딜을
                        끊을 수 있는 것은 **따라온 결과이지 지어낸 것이 아니다**
                        (03 JUDGEMENT ⑤)

    수치 넷              03 의 BALANCE ①~④ — 피해 0 · 기력 10/충전 0 · 지속 6.0초 ·
                        `hatsu-burst` 에 보태는 몫 0.5

    가려지지 않는다        표식은 살펴봄 관문 밖이다 — 겨루는 힘이 아니라 그 몸에
                        일어난 일이다 (태도·배분이 선 자리와 같다)

## 다음

    Stage 6  World Implementation   — world/ + 06-world-implementation.md
    Stage 7  View Implementation    — view/ + 07-view-implementation.md
