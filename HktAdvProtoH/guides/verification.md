# Verification Stage Guide

## Role

이번 Cycle 이 실제로 닫혔는지 검증하고, 영향받은 기존 기능의 Regression 을 확인한다.

## Input

- `cycles/<CycleId>/01~07` 전체
- `world/` `view/` `protocol/` 현재 구현
- 관련 과거 Cycle 의 `08-verification.md` (Regression Scenario 기반)

## Do

1. **Semantic Closure** — Goal → Possibility → Intent → State / Rule 이 모두 연결되는가.
2. **World Rule 실행** — View 없이 `Before → Input → Rule → After` 를 실측한다.
3. **Projection** — World 결과가 `04-gameview.spec.yaml` 계약대로 산출되는가.
4. **View Binding** — Fixture 만으로 View 가 그 의미를 표현하는가.
5. **Playable** — Server + Client 를 연결해 Cycle Goal 을 실제로 달성한다.
6. **Regression** — `03-world-semantic.md` 의 AFFECTED 항목과 과거 Cycle Scenario 를 재실행한다.
7. **Catalog** — 이번 Cycle 이 존재 종류를 추가·변경했으면 `npm run catalog:check` 로
   kind 정적 데이터 3원소(world·view·motions)의 정합을 확인한다.
8. **Master Feedback** — 위층에 되돌릴 것을 **보고**한다 (반영은 하지 않는다).
   - `01-cycle.md` 의 MASTER TRACE 가 가리키는 Capability 의 Overlay 변화
   - Active Constraint 가 실제 구현 형태를 제한했다면 그 판정 결과와 근거
   - 이번 Cycle 에서 관찰된 반복 설계 패턴 (Constraint Candidate 후보)
   - 상위 의미와 어긋난 지점 (Master Gap)

## Output

`cycles/<CycleId>/08-verification.md`

항목: 6종 검사 체크박스 · `NEW BEHAVIOR` · `WORLD SCENARIO` · `VIEW FIXTURE` ·
`PLAYABLE` · `REGRESSION` · `MASTER FEEDBACK` · `FAILURES` · `STATUS`

형식과 작성 예시는 `advprotoh-cycle` 스킬의 `references/artifact-format.md` 가 단일 출처다.

## Must

- 검증은 **실행 결과**로 기록한다 — 통과 주장만 적지 않는다.
- 6종 검사 결과를 모두 표기한다 (해당 없음이면 사유를 적는다).
- AFFECTED 로 표시된 기존 Rule 은 반드시 Regression 을 돈다.
- 최종 판정은 Human Play 이후에 `COMPLETE` 로 바꾼다.
- Overlay 승격 보고의 근거는 이 문서의 실측이다 — 코드가 있다는 사실이 아니다.

## Must Not

- 검증을 통과시키기 위해 Semantic 이나 Spec 을 수정하지 않는다 — 실패는 담당 단계로 반환한다.
- 코드가 돌아간다는 사실만으로 완료 판정하지 않는다.
- `master/` 파일을 직접 편집하지 않는다 — MASTER FEEDBACK 보고까지가 이 단계의 책임이다.
- Constraint 를 승격하거나 Master Graph 를 확장하지 않는다.

## Done When

Cycle Completion Gate 가 모두 참이다.

이 15항이 Gate 의 단일 출처다. 다른 문서에 복제하지 않는다.

```text
[ ] 작은 플레이 가능한 Goal 이 정의되어 있다
[ ] Goal / Possibility 가 존재한다
[ ] Intent 가 존재한다
[ ] Intent 의 모든 의미가 State / Rule 로 닫혀 있다
[ ] World State 변화가 World Rule 을 통해서만 발생한다
[ ] World 는 Authoritative 하다
[ ] GameView Specification 이 존재한다
[ ] View 는 Spec 외 World 정보를 사용하지 않는다
[ ] World 는 View 구현 정보를 사용하지 않는다
[ ] World 를 View 없이 검증할 수 있다
[ ] View 를 Fixture 만으로 검증할 수 있다
[ ] Server + Client 연결 시 실제 플레이가 가능하다
[ ] Runtime 결과를 Goal / Possibility / Intent 까지 추적할 수 있다
[ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다
[ ] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다
```
