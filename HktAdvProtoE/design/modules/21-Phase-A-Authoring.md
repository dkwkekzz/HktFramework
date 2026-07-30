# 21. Phase A — AI 제작과 감사 도구

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행: [20-Phase-N-Runtime.md](20-Phase-N-Runtime.md) · 후속: 없음 (최종 페이즈)

**AI 는 세계 상태를 직접 바꾸는 권위자가 되어서는 안 된다.**
AI 는 후보를 제안하고, 검증 파이프라인이 통과시킨 것만 콘텐츠 정의로 등록된다.

---

## AI 의 역할 경계

| AI 가 담당할 수 있는 것 | AI 가 담당해서는 안 되는 것 |
|---|---|
| 세계관 공리 후보 생성 | 실제 행동 성공 여부 |
| 종 가능성 문법 후보 생성 | 규칙 비용 계산 |
| 캐릭터의 자기모순 후보 생성 | 아이템 생성 |
| 능력 규칙 AST 후보 생성 | 관계 수치 직접 변경 |
| 미충족 요구를 만족할 지역 후보 생성 | 전투 피해 직접 결정 |
| 사건 이후의 대사 문장 생성 | 이미 관찰된 세계 사실 변경 |
| 역사 요약과 소문 표현 | |

생성 파이프라인:

```text
세계 요구 → AI 후보 생성 → JSON 스키마 검증 → 세계관 공리 검사
→ 규칙 의존성 검사 → 비용·대응 가능성 검사 → 그래프 도달 가능성 검사
→ 자동 시뮬레이션 → 통과한 후보만 콘텐츠 정의로 등록
```

---

## 모듈 목록

| ID | 목적 | 대표 검증 | 선행 |
|---|---|---|---|
| A0 | 세계관·종·가능성·능력·지역을 코드 수정 없이 작성한다 | 비개발자가 종 하나를 만들고 자동 시나리오를 실행할 수 있음 | V1, G1, R2, W0 |
| A1 | AI 가 공리와 미충족 요구를 바탕으로 구조화된 후보를 생성한다 | AI 출력이 자유 코드가 아니라 허용 스키마 데이터로만 생성됨 | A0, W0 |
| A2 | AI 후보의 모순·누락·무비용 능력·죽은 경로를 실행 전에 제거한다 | “어디서나 무비용 즉사” 능력이 명확한 이유와 함께 거부됨 | A1, K1 |
| A3 | 후보를 축소 세계에서 반복 실행하여 실패 원인을 수정한다 | 막힌 목적 그래프를 발견하여 대체 경로나 필요 요구를 추가 | A2, V3, I3 |
| A4 | 확정된 주체 상태를 자연어와 아트 요청으로 표현한다 | 대사를 바꿔도 실제 목적·약속·사건 상태는 변경되지 않음 | I1, I2, A2 |
| A5 | 세계가 왜 그렇게 되었는지 추적하고 설계 누락을 탐지한다 | 사건 하나를 클릭하면 목적→행동→규칙→결과→성장 전체 경로 표시 | 전체 모듈 |

---

## A0 — content-editor

패키지: `packages/authoring/A0-content-editor`

| 항목 | 내용 |
|---|---|
| 포함 | Worldview Editor, Grammar Editor, Ability Editor, Scenario Editor |
| 대표 검증 | 비개발자가 편집기로 종 하나를 만들고 자동 시나리오를 실행할 수 있음 |
| 선행 | V1, G1, R2, W0 |

---

## A1 — ai-generation

패키지: `packages/authoring/A1-ai-generation`

| 항목 | 내용 |
|---|---|
| 포함 | Context Assembler, Model Adapter, JSON Candidate |
| 대표 검증 | AI 출력이 자유 코드가 아니라 허용된 스키마 데이터로만 생성됨 |
| 선행 | A0, W0 |
| 금지 | 임의 실행 코드를 콘텐츠 데이터에 삽입 |

규칙 AST 를 제안할 수 있지만 임의 코드를 서버에 삽입할 수 없다.

---

## A2 — static-validation

패키지: `packages/authoring/A2-static-validation`

| 항목 | 내용 |
|---|---|
| 포함 | Schema, Dependency, Reachability, Cost, Counterplay Validator |
| 대표 검증 | “어디서나 무비용 즉사” 능력이 생성되면 명확한 실패 이유와 함께 거부 |
| 선행 | A1, K1 |

GI-06(무비용 능력 금지)·GI-07(대응 불가 능력 금지)을 실행 전에 차단한다. 거부는 이유 없이 하지 않는다 — 위반한 검사기와 경로를 함께 보고한다.

---

## A3 — simulation-repair

패키지: `packages/authoring/A3-simulation-repair`

| 항목 | 내용 |
|---|---|
| 포함 | Batch Simulation, Fitness Score, Repair Prompt, Retry Budget |
| 대표 검증 | 막힌 목적 그래프를 발견하여 대체 경로나 필요한 세계 요구를 추가 |
| 선행 | A2, V3, I3 |

AI 가 무한히 수정하지 않도록 종료 조건을 둔다.

```text
통과
명시적 실패
재시도 한도 초과
공리 충돌로 수정 불가
성능 한도 초과
```

---

## A4 — dialogue-assets

패키지: `packages/authoring/A4-dialogue-assets`

| 항목 | 내용 |
|---|---|
| 포함 | Speech Act Realizer, Dialogue Surface, Asset Request |
| 대표 검증 | 대사를 바꿔도 주체의 실제 목적·약속·사건 상태는 변경되지 않음 |
| 선행 | I1, I2, A2 |

대사 생성은 자유 텍스트부터 시작하지 않는다.

```text
NPC의 실제 목적 · NPC의 믿음 · 상대와의 관계
· 숨길 정보 · 공개할 정보 · 선택한 사회적 행동
    ↓
SpeechAct 생성
    ↓
문장 표현
```

---

## A5 — observability

패키지: `packages/authoring/A5-observability`

| 항목 | 내용 |
|---|---|
| 포함 | Causal Debugger, Belief Compare, Provenance Viewer, Coverage Dashboard |
| 대표 검증 | 사건 하나를 클릭하면 목적→행동→규칙→결과→성장의 전체 경로가 표시됨 |
| 선행 | 전체 모듈 |

이 시스템은 결과만 보면 원인을 찾기 어렵다. 다음 네 화면은 **필수**다.

### 주체 사고 뷰어

```text
현재 지각한 현상 · 관련 기억 · 활성 욕구 · 후보 목적
· 후보 전략 점수 · 선택한 행동 · 포기한 행동과 이유
```

### 사건 인과 뷰어

```text
원인 사건 · 참여 주체 · 제출된 Intent · 적용 규칙
· 변경 상태 · 발생한 흔적 · 새로 생성된 Hook
```

### 세계 생성 근거 뷰어

```text
이 협곡은 왜 존재하는가?
  우식각의 이동 요구 · 국가의 국경 요구
  · 경계 신의 영역 요구 · 밀수 조직의 은폐 경로 요구
이 광물은 왜 존재하는가?
  마물의 번식 기관 · 치료제 · 국가 연구 · 암시장 상품
```

### 믿음 비교 뷰어

```text
실제 상태 · 플레이어가 믿는 상태 · NPC A가 믿는 상태
· 국가 공식 기록 · 소문으로 유통되는 상태
```

Coverage Dashboard 는 [60-Traceability-And-Completion.md](60-Traceability-And-Completion.md) 의 추적표와 완성 판정 지표를 자동 집계한다.

---

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS11](30-Vertical-Slices.md#vs11-ai-제작-반복) | A0~A5 — 이 페이즈의 핵심 슬라이스 |
