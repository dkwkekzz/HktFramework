# View Work Guide (VIEW 레인)

## Role

**관찰만을 위한 화면 작업** 하나를 닫는다 — 이미 GameView 로 실려 오는 것을 배치·표기·
강조·조작감으로 더 잘 보이게 한다. 세계(`world/`)와 관찰 계약(`protocol/`)은 불변이다.
Cycle 이 아니다 — 8 Stage 를 돌지 않고, Cycle 번호를 쓰지 않고, Master Feedback 이 없다.
레인 판정(이 작업이 VIEW 인가 Cycle 인가)은 guides/works.md 소유다.

## Input

- Human 의 작업 목표 (무엇이 안 보이는가 / 무엇이 불편한가)
- 대상 화면의 `view/` 코드
- 관련 GameView 관찰 (읽기만 — 무엇이 이미 실려 오는가를 아는 용도)

## Do

1. **레인 판정을 먼저 통과한다** (guides/works.md) — `world/` `protocol/` 을 바꿔야
   성립하는 목표면 시작하지 않고 승격 사유를 보고한다.
2. ID 를 딴다 — `V-NNN` (`works/` 에서 최대 +1. VIEW 레인은 동시에 한 세션이므로
   충돌하지 않는다).
3. 목표를 **화면에서 확인 가능한 한 문장**으로 쓴다
   (예: "막힌 행동은 버튼이 흐려지고 사유가 툴팁으로 보인다").
4. `view/` 만 고쳐 구현한다.
5. 눈으로 검증한다 — 실제 Client 를 띄워(run-client) 목표 문장을 확인하고,
   같은 화면을 쓰는 기존 표면이 깨지지 않았는지 본다.
6. `works/V-NNN-<name>.md` 를 남긴다 (형식은 아래). 작업 중 발견한
   **세계 관찰의 결손**은 REPORT 절에 적는다 — 스스로 메우지 않는다.

## Output

`view/` 코드 + `works/V-NNN-<name>.md`

```markdown
# V-001 — reason-tooltip

    목표        막힌 행동은 버튼이 흐려지고 사유가 툴팁으로 보인다
    바뀐 표면    <어느 화면·어느 요소>
    검증        <실행해서 무엇을 확인했는가 — 목표 문장 + 회귀 표면>
    계약 diff    없음 (git diff — world/ · protocol/ 이 비어 있다)

## REPORT (없으면 없음)
    <세계 관찰의 결손 — 무엇이 안 실려 와서 무엇을 못 보여줬는가.
     Human 판단 대기 — 진짜면 다음 NEXT 에서 Frontier 후보 재료가 된다>
```

## Must

- 목표는 화면에서 눈으로 확인 가능해야 한다.
- GameView 만 소비한다 (CLAUDE.md 원칙 14) — World 내부를 직접 읽지 않는다.
- DC-WORLD-OWNS-THE-SURFACE-LIST — 사유·판정·유효 값을 view 가 계산하지 않는다.
  세계가 실어 준 것을 **보여 주기만** 한다.
- 닫기 전에 `git diff` 로 `world/` `protocol/` `engine/` `master/` 가 비어 있음을 확인한다.
- Kind 표현을 바꿨으면 `npm run catalog:check` 를 돌린다.

## Must Not

- `world/` · `protocol/` · `engine/` · `master/` · `cycles/` 를 편집하지 않는다.
- Cycle 번호(`C-*`)를 쓰지 않고 `cycles/` 에 디렉터리를 만들지 않는다.
- 관찰의 결손을 view 쪽 계산·추측으로 메우지 않는다 — REPORT 로 보고한다.
- 기존 `works/` 파일을 수정하지 않는다 — History 다.

## Done When

- 목표 한 문장이 실제 화면에서 확인된다.
- 계약 diff 가 없다 (`world/` `protocol/` 무변경).
- `works/V-NNN-<name>.md` 가 남아 있고, 발견한 결손이 REPORT 에 노출되어 있다.
