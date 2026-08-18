# C012 — Human Semantic Review

> 이 파일은 Human 의 결정을 그대로 옮긴 것이다. 판단은 Agent 가 하지 않았다.
> 2026-08-17 세션 기록이다.

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml

## 제시한 판단 4건
    1. 오라 스킬 1종을 신설한다 — 설계 §9 이행 규칙만 따르면 피해 스킬 2종이 모두
       물리가 되어 고를 오라 쪽이 없다 (01-cycle.md SCOPE NOTE)
    2. aura-strike 를 기본 스킬과 모든 값이 같고 방식만 다르게 둔다 —
       값이 다르면 결과 차이가 방식 때문인지 값 때문인지 갈리지 않는다
       (03-world-semantic.md BALANCE)
    3. 두 종류의 방어를 반대로 치우치게 둔다 (rabbit-swordsman 50/20 · wanderer 30/90) —
       상대가 누구냐에 따라 답이 뒤집힌다. 이행값은 건드리지 않아 C010 피해값 불변
    4. breakdown 의 targetDefense 를 defenseStat { name, value } 로 바꾸고
       옛 이름을 별칭으로 남기지 않는다 (04 DEFENSE STAT NOTE)

## 결과
    APPROVED       2026-08-17
    Return To      해당 없음
    Reason         01~04 와 위 판단 4건을 제시한 뒤 Human 이 "구현 cycle 끝까지 진행" 으로
                   답했다. 항목별 수정 요청은 없었다.
                   Stage 6 World Implementation 으로 진행한다.

    기록 주의      이 승인은 항목별 검토가 아니라 **제시된 묶음에 대한 진행 지시**다.
                   Stage 8 의 Human Play 확인에서 의미가 어긋나면 그때 되돌린다.
