# Task 시스템 — 데이터 모델 + 운영 명세

> **종류:** 데이터 모델 + 운영 명세
> **의존 문서:** `goal-system-design.md`, `goal-system-tooling.md`
> **상태:** v0.1 / 2026-05-06

---

## 1. 정의

**Task**: 1개 이상 Goal 의 success_criteria 미달분을 좁히기 위한 일감 단위. Goal 과 달리 **유한한 수명**을 갖는다 (todo → done | cancelled).

**봉사 (Serve)**: Task 가 1개 이상 Goal 에 봉사한다. Goal 봉사 없이 Task 생성 불가 (T-R1).

**일감 도출 (Plan)**: `agent-goal-binding.md` §4.3 의 P 라이프사이클 — Goal 의 success_criteria 미달 영역 식별 → Task 후보 생성. 사용자 명시 호출형.

---

## 2. 적용 범위

| 다룬다 | 다루지 않는다 |
|--------|--------------|
| Task 데이터 구조 | 외부 이슈 트래커 통합 (별도 결정) |
| Task ↔ Goal 참조 모델 | Sprint / 마일스톤 / 우선순위 매트릭스 |
| 라이프사이클 (todo → done\|cancelled) | 작업 시간 추정 / 번다운 차트 |
| 무결성 규칙 + CLI 도구 | 자동 일감 발행 — `tooling §8` 강제 금지 원칙 유지 |

---

## 3. 스키마

### 3.1 필수 필드

| 필드 | 타입 | 제약 |
|------|------|------|
| `id` | string | `T-\d{5}`. 영구 불변. 폐기되어도 재사용 금지. |
| `title` | string | ≤ 80자. |
| `goal_ids` | `[GoalID]` | 길이 ≥ 1 (T-R1). 봉사 Goal. |
| `status` | enum | 3.4 참조. |
| `created_at` | ISO8601 | |
| `updated_at` | ISO8601 | |

### 3.2 선택 필드

| 필드 | 타입 | 용도 |
|------|------|------|
| `closed_at` | ISO8601 \| null | terminal status (done/cancelled) 일 때 필수 (T-R2). 그 외 null. |
| `constraint_violation` | GoalID \| null | B2 (Constraint Goal 위반) 표시. 참조 대상은 constraint Goal (T-R3). |
| `related_commits` | `[sha]` | Task 결과 커밋 (사람/도구 둘 다 추가 가능). |
| `related_pr` | int \| null | GitHub PR 번호. |

### 3.3 본문

```markdown
## Description
<자유 마크다운 — 미달 영역, 작업 범위, 검증 방법>
```

### 3.4 status

| 값 | 의미 | 허용 전이 |
|----|------|----------|
| `todo` | 도출됨, 착수 전 | `in_progress`, `cancelled` |
| `in_progress` | 진행 중 | `done`, `cancelled` |
| `done` | 완료 (terminal) | (없음) |
| `cancelled` | 취소 (terminal) | (없음) |

---

## 4. 무결성 규칙

| ID | 규칙 | 위반 예 |
|----|------|--------|
| T-R1 | 모든 `goal_ids` 가 실재 Goal | `goal_ids: [G-9999]` 인데 G-9999.md 없음 |
| T-R2 | terminal status 는 `closed_at` 필수, 비-terminal 은 `closed_at` null | `status: done` 인데 `closed_at: null` |
| T-R3 | `constraint_violation` 참조 대상은 Goal `tags` 에 `constraint` 보유 | `constraint_violation: G-0010` (G-0010 은 pillar) |

검증기: `python -m goalsys.cli validate-tasks Docs/tasks Docs/goals`.

---

## 5. 파일 시스템

### 5.1 배치

```
Docs/
├── goals/        # 기존 — Goal 평탄 저장소
└── tasks/
    ├── T-00001.md
    ├── T-00002.md
    ├── ...
    ├── INDEX.md  # 자동 생성 — by status / by goal / open backlog
    └── README.md
```

### 5.2 명명·배치 규칙

| 규칙 | 정의 |
|------|------|
| 파일명 = ID | `T-00001.md`. 제목을 파일명에 포함 금지. |
| 평탄 저장 | 모든 Task 는 `tasks/` 단일 디렉토리. |
| ID 영구 불변 | terminal status 후에도 파일 보존. ID 재사용 금지. |

### 5.3 파일 형식

Markdown + YAML frontmatter. frontmatter 가 단일 진실 공급원.

```markdown
---
id: T-00001
title: <짧은 제목>
goal_ids: [G-0100, G-0101]
status: todo
created_at: 2026-05-06T15:00:00+09:00
updated_at: 2026-05-06T15:00:00+09:00
closed_at: null
related_commits: []
related_pr: null
---

## Description
<자유 마크다운>
```

### 5.4 자동 생성 뷰

| 파일 | 내용 | 생성기 |
|------|------|--------|
| `INDEX.md` | By Status / By Goal / Open Backlog (생성 순) | `render-task-index` |

`Docs/goals/` 의 `TREE.md` / `graph.mmd` 와 달리 Task 는 그래프 구조가 없다 — 단일 평탄 인덱스만 유지.

---

## 6. Goal ↔ Task 연결

### 6.1 방향

| 방향 | 위치 | 형식 |
|------|------|------|
| Task → Goal | Task `goal_ids` | YAML 리스트 (T-R1) |
| Goal → Task | (frontmatter 수정 없음) | 자동 생성 INDEX.md 의 "By Goal" 섹션 |

**Goal 파일은 Task 변동에 영향받지 않는다.** Task 가 잦게 추가/완료되더라도 Goal frontmatter 는 정적 — 노이즈 방지.

### 6.2 일감 도출 트리거

| 발화 / 상황 | 트리거 |
|------------|--------|
| `/goal plan G-XXXX` | binding §4.3 P 라이프사이클 — 미달 식별 → Task 후보 yaml 출력 |
| `/goal verify G-XXXX` 의 fail | "Task 도출 권장" 메시지 (자동 발행 X) |
| 버그 양상 B1/B2 | binding §3.3 — 회귀 테스트를 success criterion 측정에 통합하는 Task 가 자연스러움 |

### 6.3 발행 — 사용자 승인 게이트

자동 발행 금지 (`tooling §8` 원칙 유지). 도출된 Task 후보 → 사용자가 명시적으로 `new-task` CLI 또는 발화로 발행을 요청해야 파일 생성.

---

## 7. CLI 도구

| 명령 | 용도 |
|------|------|
| `new-task <tasks_dir> --title ... --goal G-XXXX [--description ...] [--constraint-violation G-YYYY]` | 새 Task 파일 생성. `next_task_id` 자동 할당. |
| `close-task <T-ID> <tasks_dir> [--cancelled] [--commit <sha>] [--pr <num>]` | Terminal status 전환. 기본 `done`. `--cancelled` 로 취소. |
| `list-tasks <tasks_dir> [--status ...] [--goal G-XXXX]` | 필터 조회. |
| `validate-tasks <tasks_dir> [<goals_dir>]` | 스키마 검증 + (goals_dir 제공 시) T-R1/T-R3 참조 검증. |
| `render-task-index <tasks_dir> [<goals_dir>]` | INDEX.md 재생성. |

CI 통합 권고:
- `validate-tasks` 는 위반 시 차단 (스키마는 항상 차단 권장).
- `render-task-index` 는 자동 갱신 (차단 X).

---

## 8. 라이프사이클

| 이벤트 | 처리 |
|-------|------|
| Plan 결과 채택 | `new-task` 호출 → `T-XXXXX.md` 생성 → status `todo` |
| 착수 | (선택) Task 파일 직접 편집 또는 별도 명령 미정 — 현재는 todo→done 단순 전이만 도구화 |
| 완료 | `close-task <ID>` → `done` + `closed_at` |
| 취소 | `close-task <ID> --cancelled` → `cancelled` + `closed_at` |
| 봉사 Goal 폐기 | Task 는 그대로. 사용자가 `cancelled` 처리 결정. |

파일은 거의 이동·삭제하지 않는다 (Goal 시스템과 동일 원칙).

---

## 9. 자동화 경계 — 만들지 않을 것

| 도구 | 이유 |
|------|------|
| verify-goal fail → 자동 new-task | tooling §8 — "자동화는 가시성과 검증에만. 의도와 결합은 사용자 결정." |
| Task → 코드 변경 강제 | 결합 강제 금지 |
| Task status 자동 변경 | 사용자 결정 영역 |
| 미해결 Task 누적 시 빌드 차단 | 우선순위는 사용자 결정 영역 |

원칙: **Task 는 일감의 영속화 + 가시성. 자동 발행/추적/강제 X.**

---

## 부록 A — Task 가 아닌 것

| 안티패턴 | 올바른 형태 |
|---------|------------|
| `"리팩토링한다"` (의도 불명) | `"GravitySystem 컬럼 호이스팅 — G-0100 SC2 위반 0회로"` |
| `"이슈 #42 수정"` | `"PreconditionSection JSON 파서가 dispatched 매처 false negative 반환 — G-0050 SC1 회귀 테스트 추가"` |
| Goal 봉사 없는 Task | (T-R1 차단) |

판별: Goal success_criteria 의 어떤 항목을 좁히는가? 명확히 답할 수 없으면 Task 가 아닌 자유 작업이다.

---

## 부록 B — 변경 이력

- v0.1: 초안. Goal 시스템 v0.3 보강.
