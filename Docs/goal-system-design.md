# Goal 시스템 — 데이터 모델 명세

> **종류:** 데이터 모델 명세
> **의존 문서:** 없음 (본 문서가 기반)
> **사용 문서:** `agent-goal-binding.md`, `goal-system-tooling.md`
> **상태:** v0.3 / 2026-05-04

---

## 1. 정의

**Goal**: 검증 가능한 성공 기준을 갖고, 더 작은 Goal로 분해 가능하며, 코드 모듈에 의해 실현되는 시간 독립적 의도 노드.

**Pillar Goal**: `parents: []`이며 `tags`에 `pillar:*`을 포함하는 최상위 Goal.

**Constraint Goal**: `parents: []`이며 `tags`에 `constraint`를 포함하는 횡단 제약 Goal.

**봉사 (Serve)**: 코드가 Goal의 success criteria 달성에 기여하는 관계. Goal `realizes` ↔ 코드 `@goal:` 태그로 표현.

**Goal 그래프**: Goal과 그 관계로 구성되는 DAG (Directed Acyclic Graph). 트리가 아니다 — 한 Goal은 다중 부모를 가질 수 있다.

---

## 2. 적용 범위

| 다룬다 | 다루지 않는다 |
|--------|--------------|
| Goal 데이터 구조 | 에이전트가 언제 Goal을 만드는가 → `agent-goal-binding.md` |
| 무결성 규칙 | 무결성 검증 도구 구현 → `goal-system-tooling.md` |
| 파일 형식과 배치 | Task 시스템 |
| 코드와의 참조 모델 | 인게임 퀘스트 시스템 |

---

## 3. 스키마

### 3.1 필수 필드

| 필드 | 타입 | 제약 |
|------|------|------|
| `id` | string | `G-\d{4}` 형식. 영구 불변. |
| `title` | string | ≤ 80자. 검증 가능한 상태로 기술. |
| `intent` | markdown | "왜 이 Goal이 존재하는가". |
| `success_criteria` | array | 길이 ≥ 1. 각 원소는 3.4 참조. |
| `status` | enum | 3.5 참조. |
| `created_at` | ISO8601 | |
| `updated_at` | ISO8601 | |

### 3.2 관계 필드

| 필드 | 타입 | 제약 |
|------|------|------|
| `parents` | `[ID]` | DAG. Pillar/Constraint Goal은 `[]`. |
| `children` | `[ID]` | `parents`와 양방향 일관 (4.2 R4). |
| `constraints` | `[ID]` | 참조 대상은 Constraint Goal이어야 함 (4.2 R6). |
| `realizes` | array | 각 원소: `{path: string, role: string}`. |
| `related_docs` | `[path]` | |

### 3.3 선택 필드

| 필드 | 타입 | 용도 |
|------|------|------|
| `rationale` | markdown | 분해 방식의 설계 근거 |
| `alternatives_considered` | array | 각 원소: `{option: string, rejected_because: string}` |
| `risks` | `[string]` | |
| `tags` | `[string]` | 자유 태그. 예: `pillar:exploration`, `constraint`, `layer:vm` |
| `superseded_by` | ID | `status: superseded`일 때 필수 |

### 3.4 success_criteria 원소 구조

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `description` | string | Y | 사람이 읽는 조건 |
| `measurable` | boolean | Y | 자동 측정 가능 여부 |
| `measure` | string \| null | N | 측정 방법 (measurable=true일 때 권장) |

### 3.5 status

| 값 | 의미 | 허용 전이 대상 |
|----|------|--------------|
| `proposed` | 검토 중 | `active`, `abandoned` |
| `active` | 추구 중 | `achieved`, `abandoned`, `superseded` |
| `achieved` | 모든 criteria 충족 | `superseded` |
| `abandoned` | 종착 | (없음) |
| `superseded` | 종착, `superseded_by` 필수 | (없음) |

### 3.6 ID 범위

| 범위 | 용도 |
|------|------|
| `G-0001` ~ `G-0099` | Pillar Goal, Constraint Goal |
| `G-0100` ~ `G-0999` | 시스템 수준 Goal |
| `G-1000` ~ | 일반 Goal |

ID는 영구 불변. 폐기되어도 재사용 금지.

---

## 4. 무결성 규칙

### 4.1 그래프 구조

Goal 그래프는 DAG다. 단일 부모 제약 없음 — 한 Goal은 여러 부모를 가질 수 있다.

### 4.2 무결성 규칙

| ID | 규칙 | 위반 예 |
|----|------|--------|
| R1 | 순환 금지 | A→B→A |
| R2 | `parents=[]`는 Pillar/Constraint Goal에만 허용 | 일반 Goal의 `parents`가 빈 배열 |
| R3 | 모든 ID 참조(`parents`/`children`/`constraints`/`superseded_by`)가 실재 | `parents: [G-9999]`인데 G-9999.md 없음 |
| R4 | 양방향 일관 — A.parents에 B면 B.children에 A | A.parents=[B], B.children=[] |
| R5 | `achieved`는 모든 criteria 충족, `superseded`는 `superseded_by` 필수 | `achieved`이나 미충족 criterion 존재 |
| R6 | `constraints`의 참조 대상은 `tags`에 `constraint` 포함 | `constraints: [G-0142]`인데 G-0142가 일반 Goal |

검증기 구현은 `goal-system-tooling.md` 2.3 참조.

---

## 5. 코드 참조 모델

### 5.1 양방향 참조

| 방향 | 위치 | 형식 |
|------|------|------|
| Goal → Code | Goal `realizes` | YAML 배열 |
| Code → Goal | 코드 파일 헤더 또는 디렉토리 `GOALS.md` | 텍스트 태그 |

두 방향이 일치해야 무결.

### 5.2 Goal → Code 형식

```yaml
realizes:
  - path: Source/HktVoxelCore/Private/MeshBuilder.cpp
    role: Binary Greedy Meshing 핵심 알고리즘
```

`path` 규칙:
- 프로젝트 루트 기준 상대 경로
- 파일 또는 디렉토리 (디렉토리는 모듈 단위 봉사)
- 슬래시 `/` 사용

### 5.3 Code → Goal 형식

**방식 A — 파일 헤더 태그:**

```cpp
// @goal: G-0142
// @goal: G-0001
```

- 정규식: `@goal:\s*G-\d{4}\b`
- 한 파일에 다중 태그 허용
- 파일 헤더 영역(첫 코드 줄 이전)에서만 인식

**방식 B — 디렉토리 GOALS.md:**

```markdown
# Module: HktVoxelCore

## Realizes
- G-0142
- G-0150

## Respects
- G-0003
```

방식 B 적용 범위: 해당 디렉토리 내 모든 코드 파일. 개별 파일 태그가 추가/덮어쓰기 가능.

### 5.4 양방향 일관성 조건

| ID | 조건 |
|----|------|
| C1 | Goal `realizes.path`가 파일 시스템에 실재 |
| C2 | 코드 태그의 ID가 실재 Goal |
| C3 | Goal A의 `realizes`에 X 있으면 X의 태그(또는 X 디렉토리 GOALS.md)에 A 있음 |
| C4 | X의 태그에 A 있으면 A의 `realizes`에 X 있음 |

위반 처리 정책은 `goal-system-tooling.md` 4.2 참조.

---

## 6. 파일 시스템

### 6.1 배치

```
docs/
├── goals/
│   ├── G-0001.md
│   ├── G-0010.md
│   ├── G-0142.md
│   ├── ...
│   ├── INDEX.md       # 자동 생성
│   ├── TREE.md        # 자동 생성 (DAG의 평탄화 뷰, 명칭은 관용적)
│   └── graph.mmd      # 자동 생성
└── rnd/
```

### 6.2 명명·배치 규칙

| 규칙 | 정의 |
|------|------|
| 파일명 = ID | `G-0142.md`. 제목을 파일명에 포함 금지. |
| 평탄 저장 | 모든 Goal은 `goals/` 단일 디렉토리. 의미적 하위 폴더 금지. |
| ID 범위 샤딩 (선택) | 파일 수 임계 초과 시 `goals/0100-0999/G-0142.md` 등으로 저장 샤딩만 허용. 의미 분류 아님. |

### 6.3 샤딩 임계

| 파일 수 | 권장 |
|--------|------|
| ≤ 500 | 샤딩 없음 |
| 500 ~ 2000 | ID 범위 샤딩 권장 |
| > 2000 | 샤딩 필수 |

### 6.4 파일 형식

Markdown + YAML frontmatter. frontmatter가 단일 진실 공급원이며, 본문과 충돌 시 frontmatter 우선.

```markdown
---
<frontmatter: 3절 스키마>
---

## Intent
<markdown>

## Success Criteria
<frontmatter success_criteria의 가독 버전>
```

### 6.5 자동 생성 뷰

| 파일 | 내용 | 생성기 |
|------|------|--------|
| `INDEX.md` | 다축 인덱스 (Pillar / Status / Tag) | `goal-system-tooling.md` 3.2 |
| `TREE.md` | DAG의 평탄화 계층 뷰. 다중 부모는 첫 등장 외 참조 처리. | `goal-system-tooling.md` 3.3 |
| `graph.mmd` | Mermaid DAG | `goal-system-tooling.md` 3.4 |

모든 자동 생성 파일은 첫 줄에 `<!-- 자동 생성 — 직접 수정 금지 -->`, 둘째 줄에 `Last generated: <ISO8601>`.

### 6.6 참조 형식

| 참조 종류 | 형식 |
|----------|------|
| Goal frontmatter 내 | ID만 (`parents: [G-0142]`) |
| Goal 본문 내 | `[G-0142](./G-0142.md)` |
| 외부 문서 → Goal | ID 우선. 경로 필요 시 `docs/goals/G-0142.md`. |
| 코드 → Goal | `@goal: G-XXXX` (5.3) |

### 6.7 라이프사이클

| 이벤트 | 처리 |
|-------|------|
| 신규 작성 | 다음 가용 ID 할당 → 파일 생성 → `status: proposed` |
| 제목 변경 | frontmatter `title` 수정. 파일 이동 없음. |
| 부모 변경 | frontmatter `parents` 수정. 파일 이동 없음. |
| 폐기 | `status: abandoned`. 파일 보존. |
| 대체 | `status: superseded` + `superseded_by: G-YYYY`. 파일 보존. |

파일은 거의 이동·삭제되지 않는다.

---

## 7. 표준 예시

### 7.1 Pillar Goal

```markdown
---
id: G-0010
title: 플레이어가 미지의 세계를 탐험하는 쾌감을 느낀다
status: active
created_at: 2026-05-04T00:00:00+09:00
updated_at: 2026-05-04T00:00:00+09:00
parents: []
children: [G-0110, G-0111]
constraints: [G-0002]
tags: [pillar:exploration]
---

## Intent

설계 기둥 중 "모험심" 최상위 의도. 미지(未知)의 쾌감을 플레이어 경험의 핵심 축으로 삼는다.

## Success Criteria

- description: 신규 플레이어가 첫 1시간 내 1회 이상 "최초 발견" 이벤트 경험
  measurable: true
  measure: 텔레메트리 first_discovery_event 발생률 ≥ 80% (신규 코호트)
- description: 30시간 시점 미발견 콘텐츠 잔존
  measurable: true
  measure: 도감 완성도 ≤ 70% (p50)
```

### 7.2 시스템 Goal (다중 부모 + 제약)

```markdown
---
id: G-0142
title: 200+ 적 동시 렌더링 시 60fps 유지
status: active
created_at: 2026-05-04T00:00:00+09:00
updated_at: 2026-05-04T00:00:00+09:00
parents: [G-0140, G-0020]
children: [G-0143]
constraints: [G-0001, G-0003]
realizes:
  - path: Source/HktVoxelCore/Public/HktVoxelCrowdRenderer.h
    role: HISM 기반 대량 렌더링 인터페이스
related_docs:
  - docs/rnd/rnd-mass-enemy-rendering.md
tags: [layer:rendering, perf]
---

## Intent

대규모 전투 및 생태계 시뮬레이션의 시각적 구현. G-0140과 G-0020 모두에 봉사.

## Success Criteria

- description: 200 NPC 가시 상태에서 평균 프레임타임 ≤ 16.6ms
  measurable: true
  measure: UE5 stat unit, 5분 평균
- description: 1% low ≤ 22ms
  measurable: true
  measure: UE5 stat unit, 1% low

## Alternatives Considered

- option: UE5 Mass Entity Framework
  rejected_because: 시뮬레이션 시스템이 UE5에 결합되어 G-0003 위반
```

### 7.3 Constraint Goal

```markdown
---
id: G-0001
title: 시뮬레이션 결정성 보존
status: active
created_at: 2026-05-04T00:00:00+09:00
updated_at: 2026-05-04T00:00:00+09:00
parents: []
children: []
tags: [constraint, layer:vm]
---

## Intent

HktCore VM은 서버와 클라이언트가 동일 입력으로 동일 출력을 산출해야 한다.

## Success Criteria

- description: 동일 입력 시퀀스에 대한 서버/클라이언트 상태 해시 100% 일치
  measurable: true
  measure: 자동화 테스트 — 1000 tick 시뮬레이션 후 state hash 비교
```

---

## 부록 A — Goal이 아닌 것

| 안티패턴 | 올바른 형태 |
|---------|------------|
| `"VoxelRenderer 모듈을 만든다"` | `"200+ 적 60fps 유지"` |
| `"버그 #1234 수정"` | `"전투 입력 지연 ≤ 1프레임"` |
| `"재미있는 게임을 만든다"` | `"플레이 세션 평균 길이 ≥ 25분"` |
| `"코드 품질 향상"` | `"VM 단위 테스트 커버리지 ≥ 80%"` |
| `"리팩토링한다"` | (Goal 아님. Task로 처리) |

판별 기준: 6개월 후 그 표현이 의미가 있는가? Yes → Goal 후보.

## 부록 B — 변경 이력

- v0.3: 설계도 스타일로 재작성. 정당화·이론 부분 제거. Tree 표현 제거. 표 위주.
- v0.2: 운영 절차·도구 명세를 분리.
- v0.1: 초안.
