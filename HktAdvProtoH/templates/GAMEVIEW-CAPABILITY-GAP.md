# GAMEVIEW CAPABILITY GAP

> 필요한 시각 표현이 Capability Resolution 순서(① 기존 Component → ② Primitive 조합 → ③ 새 Component)로 해결되지 않을 때,
> GameView Core를 직접 확장하지 않고 이 형식으로 확장 **후보**를 제출한다 (Design-GameView.md §21·§23).
> DESIGN GAP의 GameView판이다 — 대상이 World Semantic이 아니라 Visual Capability라는 점만 다르다.
> 파일은 `cycles/cycle-XXX/gaps/CAP-NNN.md`로 저장한다.

```text
GAMEVIEW CAPABILITY GAP

Gap ID:
    CAP-NNN

Found In Stage:
    <Implementation / Verification>

Required By:
    <Cycle / Intent — 예: CYCLE-003, INTENT-PERCEPTION-001>

Visual Requirement:
    <어떤 표현이 필요한가 — 예: 곡선 Sector 형태의 시야 범위>

Resolution 시도 결과:
    ① 기존 Component:   <불가 이유>
    ② Primitive 조합:   <불가 이유>
    ③ 새 Component:     <불가 이유>

Missing Capability:
    <이름 — 예: Sector Geometry>

Proposed Capability:
    <일반화된 형태 — World-specific 이름 금지.
     예: Generic Sector Primitive { center, radius, angleFrom, angleTo }>

Blocking:
    yes / no
    (no면 해당 표현만 보류하고 나머지 구현은 계속할 수 있다)
```

## 승인 처리

- 인간이 승인하면 GameView Core 확장은 **별도 작업**으로 수행한다 — 요청한 Cycle의 구현과 커밋을 분리한다.
- 승인 전까지 View Definition은 임시로 기존 어휘의 근사 표현(placeholder)을 사용할 수 있다 — 단 Verification Report에 근사임을 명시한다.
