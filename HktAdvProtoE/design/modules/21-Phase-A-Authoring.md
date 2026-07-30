# 21. Phase A — AI 제작과 감사 도구

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「19. Phase A — AI 제작과 감사 도구」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 19. Phase A — AI 제작과 감사 도구

## A0. 콘텐츠 작성 스키마와 편집기

| 항목 | 내용 |
| -- | -- |
| 목적 | 세계관·종·가능성·능력·지역을 코드 수정 없이 작성한다 |
| 포함 | Worldview Editor, Grammar Editor, Ability Editor, Scenario Editor |
| 대표 검증 | 비개발자가 편집기로 종 하나를 만들고 자동 시나리오를 실행할 수 있음 |
| 선행 | V1, G1, R2, W0 |

## A1. AI 후보 생성

| 항목 | 내용 |
| -- | -- |
| 목적 | AI가 세계관 공리와 미충족 요구를 바탕으로 구조화된 후보를 생성한다 |
| 포함 | Context Assembler, Model Adapter, JSON Candidate |
| 대표 검증 | AI 출력이 자유 코드가 아니라 허용된 스키마 데이터로만 생성됨 |
| 선행 | A0, W0 |

## A2. 정적 검증

| 항목 | 내용 |
| -- | -- |
| 목적 | AI 후보의 모순·누락·무비용 능력·죽은 경로를 실행 전에 제거한다 |
| 포함 | Schema, Dependency, Reachability, Cost, Counterplay Validator |
| 대표 검증 | “어디서나 무비용 즉사” 능력이 생성되면 명확한 실패 이유와 함께 거부 |
| 선행 | A1, K1 |

## A3. 시뮬레이션 평가와 수정 반복

| 항목 | 내용 |
| -- | -- |
| 목적 | 후보를 실제 축소 세계에서 반복 실행하여 실패 원인을 수정한다 |
| 포함 | Batch Simulation, Fitness Score, Repair Prompt, Retry Budget |
| 대표 검증 | 막힌 목적 그래프를 발견하여 대체 경로나 필요한 세계 요구를 추가 |
| 선행 | A2, V3, I3 |

AI가 무한히 수정하지 않도록 종료 조건을 둔다.

```text
통과
명시적 실패
재시도 한도 초과
공리 충돌로 수정 불가
성능 한도 초과
```

## A4. 대사와 시각 자원 요청 생성

| 항목 | 내용 |
| -- | -- |
| 목적 | 확정된 주체 상태를 자연어와 아트 요청으로 표현한다 |
| 포함 | Speech Act Realizer, Dialogue Surface, Asset Request |
| 대표 검증 | 대사를 바꿔도 주체의 실제 목적·약속·사건 상태는 변경되지 않음 |
| 선행 | I1, I2, A2 |

## A5. 인과·믿음·생성 근거·회귀 감사

| 항목 | 내용 |
| -- | -- |
| 목적 | 세계가 왜 그렇게 되었는지를 추적하고 전체 설계 누락을 탐지한다 |
| 포함 | Causal Debugger, Belief Compare, Provenance Viewer, Coverage Dashboard |
| 대표 검증 | 사건 하나를 클릭하면 목적→행동→규칙→결과→성장의 전체 경로가 표시됨 |
| 선행 | 전체 모듈 |

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| A0 | `packages/authoring/A0-content-editor` |
| A1 | `packages/authoring/A1-ai-generation` |
| A2 | `packages/authoring/A2-static-validation` |
| A3 | `packages/authoring/A3-simulation-repair` |
| A4 | `packages/authoring/A4-dialogue-assets` |
| A5 | `packages/authoring/A5-observability` |

원문 「25. 프로젝트 디렉터리 구조」의 `/apps/world-editor` 가 A0, `/apps/simulation-dashboard` 가 A5 를 실행하는 앱이다.

### 관련 원문 절

- A1 은 [40-Agent-Protocol.md](40-Agent-Protocol.md) 의 작업 제한 중 “임의 실행 코드를 콘텐츠 데이터에 삽입” 금지의 대상이다.
- A2 는 [01-Global-Invariants.md](01-Global-Invariants.md) GI-06 · GI-07 을 실행 전에 차단하는 위치다.
- A5 의 Coverage Dashboard 가 원문 「26. 원래 설계와 모듈 추적표」와 「27. 전체 완성 판정」의 지표를 집계한다. [60-Traceability-And-Completion.md](60-Traceability-And-Completion.md) 참조.

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS11](30-Vertical-Slices.md#vs11-ai-제작-반복) | A0~A5 |

### 함께 읽을 세계 설계 원본

- AI 가 담당할 수 있는 것 / 담당해서는 안 되는 것, 생성 파이프라인, SpeechAct 생성 순서 — [Design-MMO.md](../Design-MMO.md) 33장
- 디버그 4화면(주체 사고 뷰어 · 사건 인과 뷰어 · 세계 생성 근거 뷰어 · 믿음 비교 뷰어) — 같은 문서 35장
- 콘텐츠 품질 검증 체크리스트(캐릭터 · 거대 마물 · 조직 · 지역) — 같은 문서 36장
