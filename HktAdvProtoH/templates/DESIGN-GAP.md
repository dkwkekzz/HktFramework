# DESIGN GAP

> 어느 Stage든 필요한 의미가 정의되어 있지 않으면 추측하지 않고 이 형식으로 기록하고 현재 Stage를 중단한다 (RULE 5).
> Agent는 설계 변경을 직접 수행하지 않는다 — 설계 변경 **후보**를 제출할 뿐이다.
> 파일은 `cycles/cycle-XXX/gaps/GAP-NNN.md`로 저장한다.

```text
DESIGN GAP

Gap ID:
    GAP-NNN

Found In Stage:
    <Intent / World Model / Implementation / Verification>

Affected Intent:
    INTENT-...

Missing Semantic:
    <이름>

Why Required:
    <이 의미가 없으면 무엇을 표현/판단할 수 없는가>

Proposal:
    <설계 변경 후보 — 예: Item.ToolCapability>

Blocking:
    yes / no
```
