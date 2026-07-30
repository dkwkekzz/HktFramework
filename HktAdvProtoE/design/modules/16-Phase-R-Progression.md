# 16. Phase R — 성장과 능력

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「14. Phase R — 성장과 능력」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 14. Phase R — 성장과 능력

## R0. 성장 그래프 연산

| 항목 | 내용 |
| -- | -- |
| 목적 | 사건 경험이 가능성 그래프의 노드·간선·가중치를 변경하게 한다 |
| 포함 | Unlock, Reweight, Add Edge, Prune, Merge, Specialize |
| 대표 검증 | 반복 실패 후 준비·조사 전략의 가중치가 상승하여 다음 행동이 달라짐 |
| 선행 | U3, G2, I3 |

## R1. 숙련·가치·정체성 변화

| 항목 | 내용 |
| -- | -- |
| 목적 | 단순 레벨이 아닌 행동 방식과 자아의 변화를 성장으로 표현한다 |
| 포함 | Skill Mastery, Trait Shift, Value Conflict, Identity Coherence |
| 대표 검증 | 동료를 반복적으로 보호한 인물이 보호 행동과 관련 능력에 특화됨 |
| 선행 | R0 |

## R2. 능력 정의 및 컴파일

| 항목 | 내용 |
| -- | -- |
| 목적 | 의념 능력을 조작·대상·전달·조건·비용 조합으로 정의한다 |
| 포함 | 감응, 피복, 응축, 방사, 전환, 각인, 연결, 구현 |
| 대표 검증 | 발동 조건이나 비용이 없는 고영향 능력 정의가 스키마 단계에서 거부됨 |
| 선행 | S3, G0, K1 |

## R3. 능력 실행

| 항목 | 내용 |
| -- | -- |
| 목적 | 능력 조건·비용·위반 결과를 권위 규칙으로 실행한다 |
| 포함 | Ability Intent, Cost Transaction, Vow, Breach Effect |
| 대표 검증 | 조건이 참일 때만 효과가 발생하고 비용이 정확히 차감됨 |
| 선행 | R2, K2 |

## R4. 징후·대응·균형 감사

| 항목 | 내용 |
| -- | -- |
| 목적 | 강력한 능력에 관찰 가능한 징후와 현실적인 대응 경로가 있도록 검증한다 |
| 포함 | Observable Tell, Counter Predicate, Batch Duel Evaluation |
| 대표 검증 | 능력의 정체를 알아낸 상대가 준비하면 실제 성공률을 낮출 수 있음 |
| 선행 | R3, U1 |

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| R0 | `packages/progression/R0-growth-graph` |
| R1 | `packages/progression/R1-identity-mastery` |
| R2 | `packages/progression/R2-ability-definition` |
| R3 | `packages/progression/R3-ability-runtime` |
| R4 | `packages/progression/R4-ability-audit` |

### 관련 원문 절

- R2/R3 은 [01-Global-Invariants.md](01-Global-Invariants.md) GI-06(강력한 능력의 무비용 사용 금지), R4 는 GI-07(대응 불가능한 고영향 능력 금지)의 대상이다.
- 원문 「2.5」의 무효화 연쇄에 R3(Ability Runtime)이 포함된다.
- 원문 「27. 전체 완성 판정」의 `abilitiesWithoutCounterplay = 0` 조건이 R4 의 최종 판정 기준이다.

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS5](30-Vertical-Slices.md#vs5-경험에-따른-성장과-능력) | R0~R4 |

### 함께 읽을 세계 설계 원본

- `GrowthEffect` 연산 10종과 성장 축 9개 — [Design-MMO.md](../Design-MMO.md) 22장
- 능력이 생성되는 캐릭터 요소 7항, 의념 원자 조작 8종의 기능표, `AbilityDefinition` 필드 — 같은 문서 16.1 · 16.2
- 능력 강도 `Power` 계산식과 강력한 능력의 요구 조건 7항, 검증 불가 비용 배제 규정 — 같은 문서 16.3
- 예시 능력 「파열 장부」 — 같은 문서 16.4
- 프로토타입 초기 능력 원자 6개 — 같은 문서 37장
