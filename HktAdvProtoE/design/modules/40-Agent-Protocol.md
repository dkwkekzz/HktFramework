# 40. AI 에이전트의 모듈 반복 작업 프로토콜 · 작업 제한

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「22. AI 에이전트의 모듈 반복 작업 프로토콜」 / 「23. AI 에이전트 작업 제한」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 22. AI 에이전트의 모듈 반복 작업 프로토콜

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

---

# 23. AI 에이전트 작업 제한

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

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 세션 시작 시 읽는 순서

원문 「22」의 1~11 단계를 이 저장소에서 실행할 때의 진입 경로다. 원문 절차를 대체하지 않는다.

```text
1. ../../STATE.md 의 모듈 상태 보드를 읽는다.
2. 대상 모듈의 선행 모듈이 모두 VERIFIED 인지 확인한다 (= 원문 22의 1단계).
   - 아니면 선행 모듈로 되돌아간다.
3. 해당 페이즈 문서(10~21)의 「원문」 절에서 목적·포함·출력·대표 검증·금지·선행을 읽는다.
4. 00-Module-Contract.md 의 MODULE.yaml 형식으로 계약을 작성한다 (= 원문 22의 2단계).
5. 01-Global-Invariants.md 에서 관련 조건을 확인한다.
6. 30-Vertical-Slices.md 에서 이 모듈이 포함된 슬라이스를 확인한다.
7. 원문 22의 3~11 단계를 순서대로 수행한다.
8. STATE.md 의 상태 보드와 evidence/latest.json 을 갱신한다.
```

### 세션 종료 상태

원문 「4. 검증 상태」의 상태값으로만 기록한다. “구현했지만 검증은 다음에”는 `IMPLEMENTED` 이며 완료가 아니다(원문 「4」: “`IMPLEMENTED`는 완료 상태가 아니다”).

원문 「22」가 규정하는 종료는 다음 세 가지다.

- `markVerified` — 증거 파일 생성 후 VERIFIED 등록
- `markExplicitFailure(moduleId, "retry_budget_exhausted")` — 재시도 예산 소진
- `throw new Error("Upstream contract change required")` — Change Request 생성 후 중단

원문 「19. Phase A」 A3 의 종료 조건(통과 / 명시적 실패 / 재시도 한도 초과 / 공리 충돌로 수정 불가 / 성능 한도 초과)은 AI 콘텐츠 후보 수정 루프에 대한 규정이며, 위 모듈 작업 종료와는 별개다.

### 무효화 연쇄 참조

원문 「2.5 이미 검증된 모듈의 계약을 변경하면 하위 모듈의 검증을 무효화한다」의 예시 연쇄 `K2 → K3 → I3 → R3 → N0` 는 [Design-Modules.md](../Design-Modules.md) 2.5 에 있다.
