# 40. AI 에이전트 작업 프로토콜과 제한

> 상위: [Design-Modules.md](../Design-Modules.md) · 함께 읽기: [00-Module-Contract.md](00-Module-Contract.md)

이 문서는 **이후 세션에서 모듈 하나를 집어 작업할 때의 절차**를 규정한다.

---

## 1. 모듈 반복 작업 프로토콜

AI 에이전트는 다음 상태 머신으로만 작업한다.

```text
1. 선행 모듈 확인
2. MODULE.yaml 읽기
3. 실패하는 검증 시나리오 작성
4. 최소 구현
5. 타입·단위 테스트 실행
6. 속성 테스트 실행
7. 대표 Lab 실행
8. 인과 추적 확인
9. 통합 시나리오 실행
10. 증거 파일 생성
11. VERIFIED 등록
```

3번이 4번보다 먼저다. **실패하는 시나리오 없이 구현을 시작하지 않는다.**

의사 코드는 다음과 같다.

```ts
async function completeModule(moduleId: string): Promise<void> {
  const spec = await registry.load(moduleId);
  assertDependenciesVerified(spec.dependencies);

  let attempt = 0;

  while (attempt < spec.maxAttempts) {
    attempt += 1;

    const result = await runAllModuleChecks(moduleId);

    if (result.passed) {
      await writeEvidence(moduleId, result);
      await markVerified(moduleId);
      return;
    }

    const diagnosis = diagnoseFailure(result);

    if (diagnosis.requiresContractChange) {
      await createChangeRequest(moduleId, diagnosis);
      throw new Error("Upstream contract change required");
    }

    await patchOnlyOwnedFiles(moduleId, diagnosis);
  }

  await markExplicitFailure(moduleId, "retry_budget_exhausted");
}
```

재시도 예산이 소진되면 **조용히 멈추지 않고 명시적 실패로 기록한다.**

---

## 2. 작업 제한

AI 에이전트는 다음을 할 수 없다.

```text
자신의 모듈 범위 밖 파일을 임의 수정
실패한 테스트 삭제
검증 조건 완화
예상 결과를 현재 잘못된 결과로 변경
결정성을 깨는 Math.random 사용
실제 세계 상태 직접 수정
임의 실행 코드를 콘텐츠 데이터에 삽입
증거 없이 VERIFIED 표시
```

---

## 3. 상위 계약 변경 절차

상위 계약 변경이 필요하면 다음 절차를 따른다.

```text
Change Request 생성
    ↓
영향 모듈 계산
    ↓
새 계약 버전 생성
    ↓
의존 모듈 VERIFIED 해제
    ↓
모든 영향 시나리오 재검증
```

영향 전파의 예 (분할 원칙 2.5):

```text
K2 Rule Engine 변경
    ↓
K3 Event Replay 검증 무효
    ↓
I3 Conflict Resolver 검증 무효
    ↓
R3 Ability Runtime 검증 무효
    ↓
N0 Authoritative Server 검증 무효
```

**우회 금지**: 상위 계약을 바꿔야 하는 상황에서 자기 모듈 안에 임시 보정 로직을 넣어 테스트를 통과시키는 것은 위반이다. Change Request 를 만들고 멈춘다.

---

## 4. 세션 시작 체크리스트

이후 세션에서 작업을 이어받을 때 순서대로 확인한다.

```text
1. ../../STATE.md 의 모듈 상태 보드를 읽는다.
2. 다음 대상 모듈의 선행 모듈이 모두 VERIFIED 인지 확인한다.
   - BLOCKED 면 선행 모듈로 되돌아간다.
3. 해당 페이즈 문서(10~21)에서 대표 검증과 금지 항목을 읽는다.
4. 01-Global-Invariants.md 에서 이 모듈이 강제하는 GI 항목을 확인한다.
5. 30-Vertical-Slices.md 에서 이 모듈이 참여하는 슬라이스를 확인한다.
6. 1절 프로토콜 1~11 을 순서대로 수행한다.
7. STATE.md 의 상태 보드와 evidence/latest.json 을 갱신한다.
```

## 5. 세션 종료 조건

한 세션은 다음 중 하나로 끝난다.

```text
모듈 VERIFIED 등록 완료
명시적 실패 기록 (retry_budget_exhausted / axiom_conflict / performance_limit)
Change Request 생성 후 중단
```

“구현했지만 검증은 다음에”는 유효한 종료 상태가 아니다. `IMPLEMENTED` 로 남기고 STATE.md 에 남은 게이트를 명시한다.
