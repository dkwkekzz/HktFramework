# Goal 스킬 사용 가이드

> **종류:** 사용자 가이드
> **대상:** Goal 시스템과 `/goal` 슬래시 커맨드를 처음 사용하는 사람
> **의존 문서:** [`agent-goal-binding.md`](./agent-goal-binding.md) (운영 절차 원본)
> **상태:** v0.1 / 2026-05-05

---

## 1. 개요

`/goal` 은 Claude Code 슬래시 커맨드다. 입력창에 직접 타이핑하면 [`.claude/skills/goal/skill.md`](../.claude/skills/goal/skill.md) 스킬이 로드되고, 에이전트는 [`agent-goal-binding.md`](./agent-goal-binding.md) v0.3 운영 절차에 따라 작업한다.

핵심 원칙 — **사용자 명시 호출형**:

- `/goal` 을 호출하지 않은 일반 작업은 Goal 과 결합되지 않은 채로 진행된다.
- 에이전트는 "이건 Goal 결합 없이 처리합니다" 같은 안내를 하지 않는다.
- Goal ID 가 없다고 작업을 거부하지 않는다.
- status 변경·Goal 작성·폐기는 **항상 사용자 승인 후**.

---

## 2. 명령 일람

```
/goal show <ID>             — Goal 표시
/goal find <조건>           — 필터 조회
/goal new                   — 새 Goal 작성 (대화형)
/goal edit <ID>             — Goal 수정
/goal abandon <ID>            — Goal 폐기
/goal supersede <ID> <NEW_ID> — Goal 대체 (superseded_by:NEW_ID)
/goal plan <ID>             — Goal 분해 → Task 후보 도출
/goal serve <ID>            — Goal 봉사 작업 (코드 작성)
/goal verify <ID>           — success_criteria 자동 검증
/goal sync                  — 코드 @goal 태그 ↔ Goal.realizes 동기화
/goal classify "<발화>"      — 작업 분류 시뮬레이션
/goal validate              — 스키마 + DAG + 양방향 일관성 일괄 검증
```

`/goal` 단독 호출 시 에이전트가 무엇을 하고 싶은지 되묻는다 (자동 분류 금지).

---

## 3. 시나리오별 사용법

### 3.1 새 Goal 만들기 (의도 작업)

새 시스템·기능을 추가하기로 결정했을 때:

```
/goal new
```

에이전트 절차 (binding §4.2.1):

| # | 단계 |
|---|------|
| 1 | `next-id` 로 ID 할당 |
| 2 | 대화로 title / intent / parents / constraints / success_criteria 채움 |
| 3 | 초안 제시 → 사용자 검토 |
| 4 | 파일 작성 (`Docs/goals/G-XXXX.md`) |
| 5 | `validate` + `build-views` 실행 |

명시 호출하지 않고 "새 시스템 X 추가하자" 라고만 말해도, `/goal` 호출 후라면 에이전트는 **Goal 작성 제안**을 한다. 수락 시 위 절차로 진입.

### 3.2 기존 Goal 조회

```
/goal show G-0142
/goal find status:active tag:layer:vm
/goal find parent:G-0010
```

| 조회 종류 | 처리 |
|----------|------|
| 단순 조회 | `Docs/goals/INDEX.md` / `TREE.md` / `graph.mmd` 우선 |
| 복잡 필터 | frontmatter 기반 Python 한 줄 호출 |

출력 형식:

```
조회 결과 (필터: status=active, tag=layer:vm)
- G-0110 <title> (active)
- G-0142 <title> (active) — 다중 부모: G-0010, G-0020
총 N 개. 상세: Docs/goals/G-XXXX.md
```

### 3.3 Goal 봉사 코드 작성 (봉사 작업)

사용자가 Goal ID 를 명시한 구현 요청은 자동으로 봉사 작업으로 분류된다 (binding §2.2 행 1).

```
/goal serve G-0142
```

또는 자연어로:

```
G-0142 봉사하는 HISM 렌더러 구현해줘
```

에이전트 절차 (binding §4.4):

| # | 단계 |
|---|------|
| 1 | `Docs/goals/G-0142.md` + `constraints` 참조 Goal 컨텍스트 로드 |
| 2 | constraints 위반 가능성 사전 점검 |
| 3 | 코드 작성 |
| 4 | 헤더에 `// @goal: G-0142` 태그 추가 |
| 5 | `sync-realizes --dry-run` → 사용자 확인 → 실수행 |
| 6 | `validate-bidirectional` 로 C1~C4 위반 확인 |
| 7 | 봉사 Goal ID 와 함께 완료 보고 |

#### 제약 위반 발견 시

진행을 멈추고 회피 옵션을 제시한다 (binding §4.4.1):

1. 재설계
2. 우회
3. 별도 Goal 분리

사용자 결정 후 진행.

### 3.4 달성 검증

```
/goal verify G-0142
```

에이전트 절차 (binding §4.5):

| # | 단계 |
|---|------|
| 1 | `success_criteria` 읽음 |
| 2 | `verify-goal` CLI 호출 — `measurable=true` 자동 측정 |
| 3 | `manual_required` 항목은 사용자 수동 확인 요청 |
| 4 | 결과 보고 |
| 5 | **status 변경은 사용자 확인 후 — 자동 변경 금지** |

출력 형식:

```
G-XXXX 검증 결과

Criterion 1: 200 NPC 가시 상태에서 평균 프레임타임 ≤ 16.6ms
  측정: UE5 stat unit, 5분 평균
  결과: ✅ pass
  현재 값: 14.2ms

Criterion 2: 1% low ≤ 22ms
  결과: ⚠ manual_required
  현재 값: (자동 측정 미구현)

종합: 1/2 충족
권장 status: active 유지 (1 항목 수동 확인 필요)
```

### 3.5 버그 양상 분류

```
/goal classify "전투 입력이 한 프레임 밀린다"
```

에이전트가 binding §3.2 결정 트리 적용:

| # | 질문 | Yes → |
|---|------|------|
| 1 | 기존 Goal 의 success criterion 위반? | B1 — 봉사 작업 |
| 2 | Constraint Goal 위반? | B2 — 봉사 작업, 긴급 |
| 3 | 명시되지 않은 의도 인식? | B3 — 수정 후 Goal 작성 제안 |
| 4 | 모두 No | B4 — 자유 작업 |

예: "전투 입력 지연 ≤ 1프레임" success criterion 이 G-XXXX 에 있으면 → B1 → 해당 Goal 봉사 작업으로 처리. 회귀 테스트를 측정에 통합.

### 3.6 일감 분해

```
/goal plan G-0142
```

에이전트 절차 (binding §4.3):

| # | 단계 |
|---|------|
| 1 | 대상 Goal 의 `success_criteria` 읽음 |
| 2 | 현재 `realizes` 코드 점검 |
| 3 | 미달 부분 식별 |
| 4 | Task 후보 생성 (각 Task 에 봉사 Goal ID 명시) |

출력 — Task 최소 표현:

```yaml
- goal_id: G-0142
  title: HISM 인스턴스 풀 도입
  description: 200+ NPC 렌더링을 위한 HISM 컴포넌트 풀 구현
  status: todo
  created_at: 2026-05-05T00:00:00+09:00
- goal_id: G-0142
  title: GPU 컬링 적용
  ...
```

Task 시스템 자체는 본 가이드 범위 밖.

### 3.7 Goal 폐기·대체

```
/goal abandon G-0142            # 폐기
/goal supersede G-0142 G-0200   # G-0200 으로 대체
```

| 작업 | 처리 | 파일 |
|------|------|------|
| 폐기 | `status: abandoned`. 자식 Goal 은 사용자 결정 (재배치 또는 함께 폐기). | **삭제 X** |
| 대체 | `status: superseded` + `superseded_by: G-0200` (필수). | **삭제 X** |

ID 는 영구 불변 — 폐기되어도 재사용 금지.

### 3.8 코드 ↔ Goal 양방향 동기화

코드에 `// @goal:` 태그를 추가했지만 Goal 의 `realizes` 에 반영 안 됐을 때:

```
/goal sync
```

에이전트는 항상 `--dry-run` 먼저 실행 → 사용자 확인 → 실수행.

수동 검증만 필요할 때:

```
/goal validate
```

스키마 + DAG (R1~R6) 점검 — 내부적으로 `goalsys validate` 호출. 코드 ↔ Goal 일관성(C1~C4) 까지 보려면:

```
/goal validate full
```

→ `validate-bidirectional` 도 함께 실행. 두 검사 모두 위반은 경고 — 차단 X (tooling §7.2 강제 금지 원칙).

---

## 4. 작업 분류 결정 트리 (binding §2)

`/goal classify` 또는 호출 트리거 발화 수신 시 위에서 아래로 평가, **첫 Yes 에서 멈춤**:

| # | 질문 | Yes → 분류 | 처리 |
|---|------|----------|------|
| 1 | Goal ID 명시? | 봉사 작업 | §3.3 |
| 2 | Goal 자체를 다루는 동사 ("보여줘", "만들어줘", "검증해줘")? | Goal 작업 | §3.1, §3.2, §3.4, §3.7 |
| 3 | 버그 수정/증상 보고? | 버그 양상 분류 | §3.5 |
| 4 | 새 시스템·기능·아키텍처 추가? | 의도 작업 | Goal 작성 제안 (수락 시 §3.1) |
| 5 | 모두 No | 자유 작업 | 결합 없음 |

분류는 **에이전트 제안**. 사용자가 다른 분류를 명시하면 따른다.

### 4.1 분류별 사용자 노출

| 분류 | 알릴 내용 |
|------|----------|
| Goal 작업 | 변경할 Goal 파일과 영향 범위 |
| 의도 작업 | Goal 작성 제안 (수락/거부 선택지) |
| 봉사 작업 | 봉사 Goal ID 와 결합 근거 |
| 자유 작업 | 알리지 않음 |

---

## 5. 자주 헷갈리는 케이스 (binding 부록 A)

| 상황 | 분류 | 근거 |
|------|------|------|
| "이 함수 리팩토링" | 봉사 (`@goal` 태그 있음) / 자유 (없음) | 코드 태그 유무 |
| "테스트 추가" | 봉사 | success criterion 측정 향상 |
| "주석 정리" | 자유 | 의도 변화 없음 |
| "이 모듈 전체 새로 짜자" | 의도 | 새 의도 가능성 |
| "버그 수정" | B1~B4 | §3.5 양상 분류 |
| "성능 최적화" | 봉사 | 성능 Goal 에 봉사 |
| "라이브러리 교체" | 의도 / 자유 | 아키텍처 영향에 따라 |
| "문서 업데이트" | Goal 작업 (Goal 파일이면) / 자유 | 변경 대상 파일에 따라 |

---

## 6. 강제 금지 (binding §1.3)

호출 모델과 무관하게 다음은 금지:

- Goal ID 없는 작업의 거부
- 사용자가 호출하지 않은 상태에서 Goal 결합 강요
- 자유 작업마다 "이건 Goal 결합 없이 처리합니다" 같은 안내

---

## 7. Chat ↔ Code 핸드오프 (binding §5.1)

| 단계 | 도구 | 산출물 | 라이프사이클 |
|------|------|--------|-------------|
| 의도 정립 | Claude Chat | Goal 파일 | A (작성) |
| 일감 분해 | Claude Chat | Task 목록 (Goal ID 포함) | P (분해) |
| 구현 | Claude Code | 코드 + `@goal:` 태그 | S (봉사) |
| 검증 | Claude Code 또는 CI | 검증 보고서 | V (검증) |

핸드오프 매개는 **Goal ID**. Code 측은 Goal ID 로 `Docs/goals/G-XXXX.md` 를 읽어 intent / constraints / success_criteria 를 컨텍스트에 로드한다.

---

## 8. 시작 지점

현재(2026-05-05) `Docs/goals/` 는 비어 있다. 설계 §3.6 ID 범위에 따른 권장 진입 순서:

1. 최상위 Pillar Goal — `G-0001` ~ `G-0099` 범위, `tags: [pillar:*]`
2. 횡단 Constraint Goal — 같은 범위, `tags: [constraint]`
3. 시스템 수준 Goal — `G-0100` ~ `G-0999`
4. 일반 Goal — `G-1000` ~

첫 사용:

```
/goal new
```

→ 카테고리 `pillar` 선택 → title / intent / success_criteria 입력 → 초안 검토 → 확정.

---

## 부록 A — 관련 문서

| 문서 | 종류 |
|------|------|
| [`agent-goal-binding.md`](./agent-goal-binding.md) | 운영 절차 원본 (이 가이드의 출처) |
| [`goal-system-design.md`](./goal-system-design.md) | Goal 데이터 모델 |
| [`goal-system-tooling.md`](./goal-system-tooling.md) | 도구 인터페이스 계약 |
| [`.claude/skills/goal/skill.md`](../.claude/skills/goal/skill.md) | 에이전트 스킬 정의 |
| [`Tools/goal-system/README.md`](../Tools/goal-system/README.md) | CLI 구현체 |

## 부록 B — 변경 이력

- v0.1: 초안. binding v0.3 의 사용자 관점 정리.
