# CC-A-REASON-MUST-BE-TRUE

접수: Feedback — C-COMBAT-004-what-you-leave-on-them 의 MASTER FEEDBACK 이 보고한
관찰이다. Cycle Agent 는 관찰만 보고했고, 승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    거절 사유는 **있는 것**만으로 모자라다 — **참**이어야 한다.
    참이 아닌 사유는 사유가 없는 것보다 나쁘다: 플레이어를 틀린 방향으로 보낸다.

## 무엇을 말하는가 (예시)

한 줄로: `DC-COMBAT-UNAVAILABLE-HAS-A-REASON` 은 사유가 **드러나야 한다**고만 적는다.
C-COMBAT-004 에서 세계는 사유를 드러냈다 — 그런데 그 사유가 거짓이었다.

```text
상황    아무도 고르지 않았다 (대상 없음)
나간 것  "이미 표식을 남겨 두었다"        ← 거짓 — 표식은 하나도 없다
원인    관문이 "상대가 없다" 와 "그 사정이 거짓이다" 를 한 답으로 뭉갰다
결과    플레이어가 "표식을 지우면 되겠구나" 라는 틀린 결론으로 간다
```

브라우저 실측이 잡았고, 판정의 갈래를 갈라 고쳤다 (07 NOTES ②).

같은 모양의 자리가 이 세계에 이미 셋 있다 — 전부 "사유가 참이 되게 하려고 판정의
순서나 갈래를 고친" 자리다.

    C011    막기 판정을 행동 관문 앞에 두었다 — "기력 부족" 이 참이 되게
    C017    no-target-selected 와 target-is-self 를 갈랐다
    C024    no-occupied-slot 을 "가방 탓이 아니다" 로 다시 썼다

## OBSERVED REPEATING PATTERN

    C011 · C017 · C024   소급 근거 — 같은 판단을 이름 없이 반복했다
    C-COMBAT-004         거짓 사유의 첫 실측 — 이 관찰로 처음 이름이 붙는다

## 승격 조건 검사

    반복되는가            판단은 네 번째 — 위반 실측은 처음이다
    형태를 제한하는가      예 — 관문이 사유를 낼 때 그 사유가 지금의 세계 상태에서 참인지를
                          함께 요구한다 (판정 갈래를 사유 단위로 가른다)
    시스템 목록을 낳는가    아니오
    이미 있는 DC 와 겹치는가 DC-COMBAT-UNAVAILABLE-HAS-A-REASON 의 강화다 — **새 DC 로
                          세울지, 그 DC 의 requires 에 "사유는 참이어야 한다" 한 문장을
                          더할지**가 Human 의 결정이다

HUMAN DECISION: PENDING
