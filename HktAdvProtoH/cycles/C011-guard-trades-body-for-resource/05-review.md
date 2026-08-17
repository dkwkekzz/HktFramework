# C011 — Human Semantic Review

> 이 파일은 Human 의 결정을 그대로 옮긴 것이다. 판단은 Agent 가 하지 않았다.
> 2026-08-17 세션에서 01~04 를 제시하고 받은 답이다.

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml

## 함께 제시한 판단 3건
    1. 막기를 행동이 아니라 자세로 둔다 (막으며 걷기가 성립해야 하므로)
    2. 막기는 Final Damage 에 걸린다 (R1 핵심 원칙) —
       이와 어긋나는 C010 코드 주석은 구현 단계에서 고친다
    3. 기력 대가와 고갈 붕괴는 포함하고 Guard Break(공격자 압박)는 제외한다
       (01-cycle.md SCOPE NOTE)

## 결과
    APPROVED       2026-08-17
    Return To      해당 없음
    Reason         제시한 의미와 범위를 그대로 승인. 수치 조정 요청 없음.
                   Stage 6 World Implementation 으로 진행한다.
