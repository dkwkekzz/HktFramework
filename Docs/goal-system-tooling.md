# Goal 시스템 — 도구 명세

> **종류:** 도구 인터페이스 계약
> **의존 문서:** `goal-system-design.md`
> **사용 문서:** `agent-goal-binding.md`
> **상태:** v0.2 / 2026-05-04

---

## 1. 적용 범위

### 1.1 정의하는 것

각 도구의 입력·출력·동작·오류 처리 계약. 구현 언어·플랫폼·라이브러리는 자유.

### 1.2 정의하지 않는 것

| 영역 | 참조 |
|------|------|
| 데이터 스키마 | `goal-system-design.md` |
| 도구 호출 시점·정책 | `agent-goal-binding.md` |
| 구체적 구현 코드 | (구현자 재량) |

---

## 2. 도구 분류와 우선순위

### 2.1 분류

| 범주 | 도구 |
|------|------|
| 파서·검증기 | `parse`, `validate-schema`, `validate-dag` |
| 뷰 생성기 | `render-index`, `render-tree`, `render-graph` |
| 참조 일관성 | `scan-code-tags`, `validate-bidirectional`, `sync-realizes` |
| 라이프사이클 보조 | `next-id`, `new-goal`, `verify-goal` |

### 2.2 구현 우선순위

| Phase | 도구 | 필수성 | 차단 효과 |
|-------|------|--------|----------|
| 1 | parse, validate-schema, validate-dag | 필수 | 데이터 무결성 보장 |
| 2 | render-index, render-tree, render-graph | 필수 | Goal 가시성 |
| 3 | scan-code-tags, validate-bidirectional | 필수 | 코드 연결 |
| 4 | next-id, new-goal | 권장 | 작성 마찰 감소 |
| 5 | sync-realizes, verify-goal | 선택 | 자동화 보조 |

---

## 3. 파서·검증기

### 3.1 parse

**입력:** Goal 파일 경로 또는 디렉토리 경로

**출력:** Goal 객체 또는 객체 배열. 각 객체 = `{ frontmatter: <YAML object>, body: <string> }`

**오류:**
| 조건 | 종류 |
|------|------|
| YAML 파싱 실패 | ParseError |
| 필수 필드 누락 | SchemaError |
| 타입 불일치 | SchemaError |

**규칙:**
- 본문 보존 (수정 금지)
- 미지 frontmatter 필드 보존 (전방 호환)

### 3.2 validate-schema

**입력:** parse 결과 객체

**출력:** `{ passed: bool, violations: [...] }`

**검증:** `goal-system-design.md` 3절 스키마 + 3.5 status 전이 + 3.6 ID 범위

**오류 보고 형식:**
```json
{
  "passed": false,
  "violations": [
    {"goal": "G-0142", "field": "status", "issue": "invalid_transition", "from": "achieved", "to": "active"}
  ]
}
```

### 3.3 validate-dag

**입력:** 모든 Goal 객체 집합

**출력:** `{ passed: bool, violations: [...] }`

**검증 항목:** `goal-system-design.md` 4.2 R1~R6

| 규칙 | 알고리즘 |
|------|---------|
| R1 | DFS 사이클 탐지 |
| R2 | `parents=[]` 항목 중 `tags`에 `pillar:*` 또는 `constraint` 미보유 항목 |
| R3 | 모든 ID 참조의 실재성 확인 |
| R4 | parents/children 양방향 일관 확인 |
| R5 | achieved 항목의 criteria 충족 + superseded 항목의 `superseded_by` 존재 |
| R6 | `constraints` 참조 대상이 `tags`에 `constraint` 보유 |

**규칙:**
- 위반 발견 시에도 정상 종료 (exit 0)
- `--strict` 플래그 시 위반 발견 시 exit 1

---

## 4. 뷰 생성기

### 4.1 공통 규칙

| 규칙 | 정의 |
|------|------|
| 헤더 주석 | 첫 줄 `<!-- 자동 생성 — 직접 수정 금지 -->` |
| 생성 시각 | 둘째 줄 `Last generated: <ISO8601>` |
| 입력 | 모든 Goal 객체 집합 |
| 충돌 처리 | 기존 파일 덮어쓰기 (사용자 편집 보존 X) |

### 4.2 render-index → INDEX.md

**구조:**
```
<!-- 자동 생성 — 직접 수정 금지 -->
Last generated: <ISO8601>

# Goals Index

## By Pillar
### G-XXXX <pillar title>
- <자식 Goal 목록>

## By Status
### Active (N)
- <목록>
### Achieved (N)
### Abandoned (N)
### Superseded (N)
### Proposed (N)

## By Tag
### <tag name> (N)
- <목록>
```

**다중 부모 처리:** 모든 해당 위치에 등장. 부가 위치에는 `*(also under G-XXXX)*`.

### 4.3 render-tree → TREE.md

**구조:**
```
<!-- 자동 생성 — 직접 수정 금지 -->
Last generated: <ISO8601>

# Goal DAG (평탄화 뷰)

- G-XXXX <title>
  - G-YYYY <title>
- G-AAAA <title>
  - → G-YYYY (G-XXXX 하위 참조)
```

**규칙:**
- 진입점: `parents=[]`인 모든 Goal (Pillar + Constraint)
- 다중 부모 Goal은 첫 등장 부모 아래에서만 자식 트리 펼침. 이후 등장은 참조만.

### 4.4 render-graph → graph.mmd

**구조:**
```
%% 자동 생성 — 직접 수정 금지
%% Last generated: <ISO8601>

graph TD
  G0010[G-0010 <title>] --> G0142[G-0142 <title>]
  G0001[G-0001 <title>] -.제약.-> G0142
```

**엣지 종류:**
| 종류 | 표현 |
|------|------|
| 부모-자식 | `-->` |
| 제약 | `-.제약.->` |

**노드 ID:** `G-0142` → `G0142` (Mermaid 하이픈 불가). 표시 텍스트는 원본 ID 유지.

**대용량 처리:** Goal > 100개 시 Pillar별 subgraph 분할.

---

## 5. 참조 일관성

### 5.1 scan-code-tags

**입력:** 프로젝트 루트 또는 디렉토리

**출력:** `{ <file_path>: [<Goal ID>, ...] }`

**스캔 대상:**
| 종류 | 위치 | 정규식 |
|------|------|--------|
| 파일 헤더 태그 | 파일 시작 ~ 첫 코드 줄 | `@goal:\s*G-\d{4}\b` |
| 디렉토리 GOALS.md | 디렉토리 내 `GOALS.md` | `## Realizes` 섹션 파싱 |

**무시 대상:**
- 컴파일 산출물 (`.o`, `.obj`, `.exe`, ...)
- `.gitignore`된 경로
- `Binaries/`, `Intermediate/`, `Saved/`

### 5.2 validate-bidirectional

**입력:** 모든 Goal 객체 + scan-code-tags 결과

**출력:** `{ passed: bool, violations: [...] }`

**검증:** `goal-system-design.md` 5.4 C1~C4

| 조건 | 검증 |
|------|------|
| C1 | Goal `realizes.path`의 파일 시스템 실재 |
| C2 | 코드 태그 ID의 Goal 실재 |
| C3 | A의 `realizes`에 X → X의 태그(또는 디렉토리 GOALS.md)에 A |
| C4 | X의 태그에 A → A의 `realizes`에 X |

**규칙:**
- 모든 위반은 `severity: warning` (차단 X)
- 자동 수정은 sync-realizes의 책임 (별도 명시 호출)

**오류 형식:**
```json
{
  "passed": false,
  "violations": [
    {"condition": "C1", "goal": "G-0142", "missing_path": "Source/...", "severity": "warning"}
  ]
}
```

### 5.3 sync-realizes

**입력:** scan-code-tags 결과 + Goal 객체

**동작:**
| 상황 | 처리 |
|------|------|
| 코드 X 태그에 A 있는데 A.realizes에 X 없음 | A.realizes에 X 추가. `role: TODO` |
| A.realizes에 X 있는데 X 태그에 A 없음 | 변경 없음 (코드 측 정보 부족 가능성) |

**규칙:**
- 사용자 명시 호출 시에만 실행 (자동 실행 금지)
- `--dry-run` 플래그 지원 필수
- frontmatter만 수정. 본문 변경 금지.

---

## 6. 라이프사이클 보조

### 6.1 next-id

**입력:** ID 카테고리 (`pillar` | `system` | `general`)

**출력:** 다음 가용 ID 문자열

**범위:**
| 카테고리 | 범위 |
|---------|------|
| `pillar` | G-0001 ~ G-0099 |
| `system` | G-0100 ~ G-0999 |
| `general` | G-1000 ~ |

**규칙:**
- 사용 중 ID + abandoned/superseded ID 모두 회피 (재사용 금지)
- 카테고리 내 가장 작은 미사용 ID 반환

### 6.2 new-goal

**입력:** 카테고리, 선택 필드 (title, parents, constraints, tags)

**출력:** 생성된 파일 경로

**템플릿:**
```markdown
---
id: <next-id 결과>
title: <입력 또는 TODO>
status: proposed
created_at: <현재 시각>
updated_at: <현재 시각>
parents: <입력 또는 []>
children: []
constraints: <입력 또는 []>
tags: <입력 또는 []>
---

## Intent

TODO

## Success Criteria

- description: TODO
  measurable: false
  measure: null
```

**규칙:**
- 생성 후 active로 자동 승격 X
- 자동 생성 뷰 갱신은 호출자 책임

### 6.3 verify-goal

**입력:** Goal ID

**출력:**
```json
{
  "goal_id": "G-0142",
  "criteria": [
    {
      "description": "...",
      "measurable": true,
      "measure": "...",
      "automated": true | false,
      "result": "pass" | "fail" | "manual_required",
      "current_value": "..."
    }
  ],
  "summary": { "passed": N, "failed": N, "total": N }
}
```

**규칙:**
- 자동 측정만 시도. 측정 불가 항목은 `manual_required`로 표시.
- status 자동 변경 금지. 결과만 반환.
- 측정 방법은 `measure` 필드 해석 (구현 자유)

---

## 7. 통합 인터페이스

### 7.1 CLI

```
goal parse <path>
goal validate-schema [<path>]
goal validate-dag [--strict]
goal render-index
goal render-tree
goal render-graph
goal scan-code-tags [<path>]
goal validate-bidirectional
goal sync-realizes [--dry-run]
goal next-id <category>
goal new-goal [--title=...] [--parents=...]
goal verify-goal <goal-id>
```

### 7.2 CI 통합 (권장)

| 명령 | 차단 정책 |
|------|----------|
| `validate-schema` | 실패 시 CI 차단 |
| `validate-dag` | 위반 시 경고 (차단 X) |
| `validate-bidirectional` | 위반 시 경고 (차단 X) |
| `render-index/tree/graph` | 자동 갱신 (차단 X) |

`validate-dag`/`validate-bidirectional`은 `--strict` 모드 사용 금지 (강제 금지 원칙).

### 7.3 사전 커밋 후크 (선택)

사용자 선택으로만 활성화. 차단은 `validate-schema`만.

---

## 8. 만들지 않을 도구

| 도구 | 이유 |
|------|------|
| Goal 없는 커밋 차단 hook | Goal 결합 강제는 운영 원칙 위반 |
| 자동 Goal 추론 후 무단 결합 | 사용자 동의 없는 결합은 정합성 훼손 |
| Goal status 자동 변경기 | status 변경은 항상 사용자 결정 |
| 자동 Goal 작성기 | Goal 인플레이션 위험 |
| Goal 자동 폐기기 | 의도 손실 위험 |
| PR 메시지 강제 검사기 | Goal 결합 강제 |

원칙: **자동화는 가시성과 검증에만.** 의도와 결합은 사용자 결정.

---

## 부록 A — 변경 이력

- v0.2: 설계도 스타일로 재작성. 정당화 부분 제거. 표 위주.
- v0.1: 초안.
