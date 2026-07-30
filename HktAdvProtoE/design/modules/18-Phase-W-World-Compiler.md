# 18. Phase W — 세계 요구와 세계 컴파일러

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「16. Phase W — 세계 요구와 세계 컴파일러」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 16. Phase W — 세계 요구와 세계 컴파일러

## W0. 세계 요구 추출

| 항목 | 내용 |
| -- | -- |
| 목적 | 주체의 가능성에서 필요한 공간·자원·규칙·정보·상대를 추출한다 |
| 포함 | Requirement Template, Scope, Importance, Rarity |
| 대표 검증 | “병을 치료한다”에서 완성 치료제가 아니라 재료·지식·생물·공간 요구가 생성됨 |
| 선행 | G1~G3 |

## W1. 요구 정규화와 결합

| 항목 | 내용 |
| -- | -- |
| 목적 | 서로 다른 표현의 요구를 하나의 공통 실체로 만족시킬 수 있도록 묶는다 |
| 포함 | Normalize, Cluster, Existing Realization Search |
| 대표 검증 | 마물·치료사·국가·종교의 요구가 하나의 염분 협곡으로 결합됨 |
| 선행 | W0, C |

## W2. 실체화 후보 생성과 검증

| 항목 | 내용 |
| -- | -- |
| 목적 | 지역·자원·생물·제도 후보를 만들고 가장 상호작용성이 높은 후보를 선택한다 |
| 포함 | Candidate Generation, Scoring, Contradiction Check |
| 대표 검증 | 세계관 공리를 위반하는 후보는 높은 활용도에도 선택되지 않음 |
| 선행 | W1, K1 |

후보 점수는 다음 요소를 사용한다.

```text
요구 충족 수
주체 종류 다양성
충돌 가능성
협력 가능성
기존 실체 재사용성
세계관 일치
공간 접근 가능성
구현 비용
모순
중복
```

## W3. 잠재 세계·정식화·근거 보존

| 항목 | 내용 |
| -- | -- |
| 목적 | 미지의 세계를 점진적으로 구체화하면서 이미 관찰된 사실을 보존한다 |
| 포함 | Latent, Foreshadowed, Canonical, Observed, Provenance, History, Patch |
| 대표 검증 | “불을 먹는 생물”이라는 소문이 이후 생성 조건을 제한하지만 외형은 방문 전까지 미정 |
| 선행 | W2, K3 |

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| W0 | `packages/world-compiler/W0-requirement-extraction` |
| W1 | `packages/world-compiler/W1-requirement-clustering` |
| W2 | `packages/world-compiler/W2-realization` |
| W3 | `packages/world-compiler/W3-canon-provenance` |

### 관련 원문 절

- W0/W3 은 [01-Global-Invariants.md](01-Global-Invariants.md) GI-04(세계 실체의 생성 근거 보존), W3 은 GI-05(관찰된 세계의 소급 변경 금지)의 대상이다.
- 원문 「27. 전체 완성 판정」의 `orphanWorldEntities = 0` 조건이 W3 Provenance 의 판정 기준이다.
- 원문 「2.1」의 좋은 모듈 예시 중 “여러 세계 요구를 하나의 공간 요소로 결합한다”가 W1 이다.

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS8](30-Vertical-Slices.md#vs8-주체-요구로부터-세계-생성) | W0~W3, X0 |

### 함께 읽을 세계 설계 원본

- 가능성 노드가 결과가 아니라 요구를 제출한다는 원칙과 치료제 요구 6항 — [Design-MMO.md](../Design-MMO.md) 11장
- `WorldRequirement` / `WorldRequirementKind` 필드, 규모별 실체화 조건 — 같은 문서 11.1 · 11.2
- 컴파일 절차 11단계, `Score(r)` 식, `compileWorld` 의사 코드 — 같은 문서 12장
- 잠재/암시/정식화/관찰 4단계 — 같은 문서 13장
- `SpaceRequirement` 필드 — 같은 문서 18.2
