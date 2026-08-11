# STAGE-5-VERIFICATION — Verification Stage

## 역할

구현이 닫힌 의미 단위로 성립하는지 검사한다. 단순한 코드 테스트가 아니다.

## 입력

- `state/cycles/cycle-XXX/01-intent-package.md`
- `state/cycles/cycle-XXX/02-world-definition.md`
- `state/cycles/cycle-XXX/04-implementation-result.md`
- 코드 (Repository)

## 출력

- `state/cycles/cycle-XXX/05-verification-report.md` — [../templates/VERIFICATION-REPORT.md](../templates/VERIFICATION-REPORT.md) 형식

## 검사 항목 (5종 모두)

### 1. Semantic Closure

Intent의 모든 의미가 State / Rule로 표현되었는가? 연결되지 않은 Intent 문장이 하나라도 있으면 실패.

### 2. Observable Closure

Rule의 판단(Preconditions)과 결과를 이해하는 데 필요한 의미가 모두 Observable한가?
실행 불가 시 이유(`unavailable — reason: ...`)도 표현되는가?

### 3. Runtime Closure

실제 실행에서 `Before / Input / Rule / After`의 Semantic Transition이 발생하는가?
State뿐 아니라 **Transition 자체**가 Observable한가? 실측 값을 Report에 기록한다 — 약속이 아니라 실행 결과만 인정한다.

### 4. Traceability

`Runtime Transition → World Rule → Intent → Possibility → Goal` 역추적이 실제로 성립하는가?

### 5. GameView Closure

Visual Requirement의 모든 항목이 GameView에서 실제로 관찰되는가? 그리고 구조가 지켜졌는가:

```text
[ ] View는 ObservableWorldState만 읽는다 (world/ 직접 import 없음)
[ ] GameView 내부에 World Rule 재판단이 없다
[ ] 새 Semantic 때문에 GameView Core에 World-specific 코드가 추가되지 않았다
[ ] Semantic → Visual 연결이 View Definition에만 존재한다
[ ] Transition이 시각적으로 확인된다
```

## 원칙

- 검사는 재현 가능해야 한다 — 실행 방법/시나리오를 Report에 남긴다.
- 실패 발견 시 이 invocation에서 구현을 수정하지 않는다. 실패 항목과 원인을 Report에 기록하고 STOP — 수정은 새로운 Implementation Stage invocation으로.
- Observable Proof(Contract에 정의된 형태)가 실제 화면/출력으로 존재하는지 확인한다.

## STOP 조건

Verification Report 저장 + 진행 표 갱신 후 STOP. Evolution Compatibility Review를 이어서 실행하지 않는다.
