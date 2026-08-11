# cycles/

Cycle별 Artifact Chain 저장소. **Artifact가 Stage 사이의 API다** — Stage 간에는 대화가 아니라 이 파일들만 전달된다.

## 디렉터리 구조

Cycle 시작 시 `cycle-XXX/`를 만들고, 각 Stage는 자신의 출력 Artifact를 아래 고정 이름으로 저장한다.

```text
cycles/
└─ cycle-001/
   ├─ 00-cycle-contract.md        (Scope Definition)
   ├─ 01-intent-package.md        (Intent Stage)
   ├─ 02-world-definition.md      (World Model Stage)
   ├─ 03-semantic-review.md       (Human Semantic Review)
   ├─ 04-implementation-result.md (Implementation Stage)
   ├─ 05-verification-report.md   (Verification Stage)
   ├─ 06-evolution-review.md      (Evolution Compatibility Review)
   └─ gaps/
      └─ GAP-001.md               (Design Gap — 발생 시)
```

## 규칙

- 각 Artifact는 [../../templates/](../../templates/)의 해당 템플릿 형식을 따른다.
- 번호가 앞선 Artifact 없이 다음 Stage를 시작할 수 없다 (`03`이 APPROVED가 아니면 `04` 불가).
- 완료된 Cycle의 Artifact는 수정하지 않는다 — 기록이다.
- Baseline Merge(Stage 7)의 결과는 이 디렉터리가 아니라 `../WORLD-BASELINE.md`에 반영된다.
