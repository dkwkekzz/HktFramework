# C025 — Human Semantic Review

> 이 파일은 Human 의 결정을 그대로 옮긴 것이다. 판단은 Agent 가 하지 않았다.

## 검토 대상

    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml

## 판정

    APPROVED

제시한 판단 셋(큰 기술만 좁고 멀게 움직인다 · 기본 기술은 한 톨도 건드리지 않는다 ·
View 가 그리는 것은 세계가 보낸 원이지 각·길이로 계산한 부채꼴이 아니다)에 이의 없음.

## Human 이 직접 넣은 지시 3건

    "여기서는 설명된 다양한 스킬들을 다 직접 관찰할 수 있어야 한다."
    "테스트용으로 일단 플레이어가 다 이 스킬들을 사용할 수 있어야 한다."
    "스킬들을 사용하기 위한 간단한 ui/ux도 마련하자."

### 무엇이 이미 참인가 — 코드 대조

    플레이어가 셋 다 쓸 수 있다        이미 참이다.
                                     `world/projection/observer-view.ts` 가 셋을 모두
                                     interaction 으로 싣고(`attack` · `skill-heavy` ·
                                     `skill-aura`), `view/interaction-presentation.ts` 가
                                     셋 다 키를 준다 (F · G · R).
                                     **이 Cycle 이 새로 열 것은 없다** — 유지되는지만
                                     확인하고 Stage 8 에서 실측한다

    관찰에 실린다                     이미 참이다. 셋의 `profile` 이 위력 · 기력 수지 ·
                                     방식 · 구간 경계를 싣고, 이 Cycle 이 모양 셋을 더한다
                                     (04 delta.added)

### 무엇이 없는가 — 이 지시가 여는 것

    ① 모양이 화면에 나타나지 않는다
        휘두름의 끝점은 이미 실려 오지만(`swing.center` · `radius`) 지금은
        **충돌체 관찰(C)을 켰을 때만** 그려진다. 그것은 디버그 표면이며,
        이 Cycle 의 결과는 디버그를 켜지 않은 플레이에서 보여야 한다.
        04 의 VIEW NOTE ① 이 요구하는 것이 이것이다

    ② 셋을 나란히 놓고 고르는 자리가 없다
        지금 화면이 주는 것은 조작 안내 한 줄씩이다 ("고급 스킬: G").
        무엇이 넓고 무엇이 멀리 닿는지, 지금 걸 수 있는지, 못 걸면 왜인지가
        **한자리에서 견주어지지 않는다.** 04 의 VIEW NOTE ② 가 요구하는 것이 이것이다

### 이 지시를 어느 Stage 가 지는가

    Stage 7 (View Implementation) 이 전부 진다.

    **계약은 바뀌지 않는다.** 04-gameview.spec.yaml 이 이미 셋의 모양과
    가능/사유를 싣고 있고, VIEW NOTE ①②③ 이 이 지시와 같은 것을 요구한다.
    그러므로 Stage 3 · 4 로 반환하지 않으며 World 의미도 바뀌지 않는다.

    표현의 형태(어디에 · 무엇으로 · 늘 띄울지)는 View 의 결정이다
    (DC-WORLD-OWNS-THE-SURFACE-LIST 의 경계 — 목록은 세계의 것, 표현은 View 의 것).

### 이 지시가 넓히지 않는 것

    새 기술을 만들지 않는다              01-cycle.md EXCLUDED 그대로. "다양한 스킬" 은
                                       세계에 이미 있는 셋을 뜻한다
    새 조작을 세계에 만들지 않는다        새 interaction 도 새 Action 도 없다.
                                       04 의 `interactions` 절 그대로
    디버그 표면을 늘리지 않는다           충돌체 관찰(C)은 지금 하는 일을 그대로 한다.
                                       이 지시가 여는 것은 **평시 화면**이다
