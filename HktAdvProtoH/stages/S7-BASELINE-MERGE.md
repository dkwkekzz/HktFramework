# Stage 7 — World Baseline Merge

검증된 Cycle 의 Semantic 을 World Baseline 에 병합한다.
**이 Stage 만이 `context/WORLD-BASELINE.md` 를 수정할 수 있다.**

## 진입 조건

```text
05-VERIFICATION-REPORT.md              모든 Closure PASS
06-EVOLUTION-COMPATIBILITY-RESULT.md   PASS
```

둘 중 하나라도 PASS 가 아니면 **시작하지 않는다** (RULE 11).

## 입력

```text
context/WORLD-BASELINE.md              (현재 버전)
cycles/<cycle-id>/02-WORLD-DEFINITION-PACKAGE.md
cycles/<cycle-id>/05-VERIFICATION-REPORT.md
cycles/<cycle-id>/06-EVOLUTION-COMPATIBILITY-RESULT.md
```

## 출력

```text
cycles/<cycle-id>/07-WORLD-BASELINE-UPDATE.md
context/WORLD-BASELINE.md              (v(n) → v(n+1))
context/CURRENT-CYCLE.md               (다음 Cycle 대기 상태로)
```

템플릿: [../templates/WORLD-BASELINE-UPDATE.md](../templates/WORLD-BASELINE-UPDATE.md)

## 절차

### 1. Cycle 완료 체크리스트 확인

11개 항목이 모두 참인지 확인한다. 하나라도 실패하면 병합하지 않는다.

```text
[ ] Cycle Scope 가 명확하다.
[ ] Goal / Possibility Trace 가 존재한다.
[ ] Intent 가 명확하다.
[ ] Intent 의 모든 의미가 World State / Rule 에 존재한다.
[ ] World Rule 에 의한 실제 Transition 이 발생한다.
[ ] Transition 이 Observable 하다.
[ ] 인간이 설계 언어로 결과를 확인할 수 있다.
[ ] Runtime 에서 Design 까지 역추적할 수 있다.
[ ] 새로운 Semantic 이 기존 Baseline 과 연결된다.
[ ] 현재 구현이 Target Horizon 을 구조적으로 막지 않는다.
[ ] 검증된 결과가 World Baseline 에 병합되었다.   ← 이 Stage 가 만족시킨다
```

### 2. 병합 대상 선별

**검증된 것만** 올린다.

```text
올린다                              올리지 않는다
Verification 이 실제 실행으로        구현했지만 실행으로 확인 못한 State
확인한 State / Rule                 Observable 하지 않은 State (P8)
Observable Contract 로 노출된 항목   Deferred 로 남긴 의미
                                    Design Gap 으로 제안만 된 의미
```

### 3. Baseline 갱신

`context/WORLD-BASELINE.md` 의 5개 절을 갱신하고 버전을 올린다.

```text
Supported State
Supported Rules
Supported Goals
Supported Possibilities
Observable
```

각 항목에 **근거 Cycle ID** 를 남긴다. 이후 Cycle 이 재사용할 때 원본 Intent 까지
역추적할 수 있어야 한다.

병합 이력 표에 한 줄을 추가한다.

### 4. Backlog 정리

이번 Cycle 에서 해소된 Backlog 항목을 제거하거나 상태를 갱신한다.

### 5. Cycle 종료

- `context/CURRENT-CYCLE.md` 를 "다음 Cycle 대기" 상태로 바꾼다.
- `cycles/<cycle-id>/README.md` 의 상태를 `MERGED` 로 바꾼다.
- Cycle 디렉토리의 Artifact 는 **삭제하지 않는다** — Traceability 의 근거다.

## 금지

```text
Verification / Evolution Gate 를 통과하지 않은 Semantic 병합
"거의 다 됐으니" 부분 병합
Baseline 항목을 Entity 단위가 아닌 형태로 기록
Baseline 갱신과 다음 Cycle 설계(Stage 0)를 한 invocation 에서 처리
```

## 종료

Baseline 갱신 → **STOP.**
다음 Cycle 의 Stage 0 는 별도 invocation 이다.
