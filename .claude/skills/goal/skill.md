# Goal Skill — Goal 시스템 작업 워크플로

[`Docs/agent-goal-binding.md`](../../../Docs/agent-goal-binding.md) v0.3 운영 절차 구현체.

**사용자가 `/goal` 을 명시 호출할 때만 활성화** — 일반 작업에 자동 적용 금지 (binding §1.1, §1.3). 호출되지 않은 상태에서는 Goal 결합을 강요하지 않으며, 자유 작업마다 "Goal 결합 없이 처리합니다" 식 안내도 하지 않는다.

## 사용법

```
/goal show <ID>               — Goal 표시 (Q)
/goal find <조건>             — 필터 조회 — 예: status:active, tag:layer:vm, parent:G-0010 (Q)
/goal neighbors <ID>          — 부모/자식/형제/제약/realizes 한 번에 (Q)
/goal which <PATH>            — 코드 경로 → 적용 Goal ID 역참조 (Q)
/goal site                    — 단일 HTML 사이트 생성 (Docs/goals/site.html)
/goal new                     — 새 Goal 작성 — 대화형 (A)
/goal edit <ID>               — Goal 수정 (A)
/goal abandon <ID>            — Goal 폐기 (A)
/goal supersede <ID> <NEW_ID> — Goal 대체 — superseded_by:NEW_ID (A)
/goal plan <ID>               — Goal 분해 → Task 후보 도출 (P)
/goal serve <ID>              — Goal 봉사 작업 — intent/constraints 컨텍스트 로드 (S)
/goal verify <ID>             — success_criteria 자동 검증 (V)
/goal sync                    — 코드 @goal 태그 ↔ Goal.realizes 동기화 — dry-run 우선
/goal classify "<발화>"        — 작업 분류 시뮬레이션 (Goal/의도/봉사/자유)
/goal validate [full]         — 스키마+DAG 검증 (full 시 양방향 일관성 추가)
```

`/goal` 단독 호출 시 사용자에게 무엇을 하고 싶은지 묻는다. 자동 분류 금지.

## 환경 상수

```
GOALS_DIR     = Docs/goals
PROJECT_ROOT  = .
GOALSYS_CWD   = Tools/goal-system          (CLI 실행 위치)
GOALSYS_CLI   = python -m goalsys.cli      (위 디렉토리에서 호출)
```

CLI 호출은 `cd Tools/goal-system && python -m goalsys.cli ...` 패턴. 경로는 모두 프로젝트 루트 기준 상대.

---

## 1. 작업 분류 (binding §2)

`/goal classify` 또는 호출 트리거 발화 수신 시 다음 결정 트리를 위에서 아래로 평가, **첫 Yes 에서 멈춤**:

| # | 질문 | Yes → 분류 |
|---|------|----------|
| 1 | 사용자가 Goal ID 를 명시했는가? | 봉사 작업 (S) |
| 2 | Goal 자체를 다루는 동사 ("보여줘", "만들어줘", "검증해줘") 를 썼는가? | Goal 작업 (Q/A/V) |
| 3 | 버그 수정/증상 보고인가? | §2 버그 양상 분류 |
| 4 | 새 시스템·기능·아키텍처 추가인가? | 의도 작업 (A 제안) |
| 5 | 모두 No | 자유 작업 (결합 없음) |

### 1.1 분류는 제안

분류는 **에이전트의 제안**. 사용자가 다른 분류를 명시하면 따른다 (binding §2.4).

### 1.2 분류별 사용자 노출

| 분류 | 알릴 내용 |
|------|----------|
| Goal 작업 | 변경할 Goal 파일과 영향 범위 |
| 의도 작업 | Goal 작성 제안 (수락/거부 선택지) |
| 봉사 작업 | 봉사 Goal ID 와 결합 근거 |
| 자유 작업 | 알리지 않음 |

---

## 2. 버그 양상 분류 (binding §3)

위에서 아래로 평가, 첫 Yes 에서 멈춤:

| # | 질문 | Yes → | 처리 |
|---|------|------|------|
| 1 | 증상이 기존 Goal 의 success criterion 위반? | B1 | 봉사 작업 (S). 회귀 테스트를 success criterion 측정에 통합. |
| 2 | 증상이 Constraint Goal 위반? | B2 | 봉사 작업 (S). **다른 작업 중단**. 위반 경로 분석을 보고에 포함. |
| 3 | 수정 중 명시되지 않은 의도가 드러나는가? | B3 | 1) 수정 완료 → 2) 사용자에게 Goal 작성 제안 → 3) 수락 시 §3.A.1 신규 작성 절차 진입, 거부 시 종결. |
| 4 | 모두 No | B4 | 결합 없이 수정. |

### 2.1 B3 제안 형식 (binding §3.4)

수정 완료 후 다음 형식으로 사용자에게 묻는다 — **강요 금지**:

```
수정 완료. 작업 중 "<드러난 의도>" 가 명시된 Goal 로 없음을 확인.
Goal 로 추가 시 효과:
- 동종 버그 회귀 검증 자동화
- 해당 영역 의도 명시화
추가할까요?
```

### 2.2 양상 비율의 신호

| 비율 | 시사 |
|------|-----|
| B1, B2 다수 | success criterion 이 측정 가능하게 작성됨 (정상) |
| B3 다수 | 해당 영역 Goal 커버리지 부족 |
| B4 다수 | 정상 (모든 작업이 Goal 일 필요 없음) |

---

## 3. 라이프사이클 절차 (binding §4)

5종 작업: **Q**uery / **A**uthor / **P**lan / **S**erve / **V**erify.

### 3.Q — 조회 (`/goal show`, `/goal find`, `/goal neighbors`, `/goal which`)

| # | 단계 |
|---|------|
| 1 | 단순 조회는 자동 생성 뷰 (`Docs/goals/INDEX.md` / `TREE.md` / `graph.mmd` / `site.html`) 우선 사용 |
| 2 | ID 단일 조회는 `show`, 그래프 이웃은 `neighbors`, 필터 검색은 `find` |
| 3 | 코드 경로에서 Goal 역참조는 `which-goal` |
| 4 | 결과를 ID 목록 + 요약으로 출력 |

CLI 호출 패턴:

```bash
# ID 단일 — frontmatter + body 요약
cd Tools/goal-system && python -m goalsys.cli show G-0107 ../../Docs/goals
# 필터 검색 — AND 결합. 토큰 키: status / tag / parent / ancestor / child / descendant / constraint / text
python -m goalsys.cli find ../../Docs/goals status:active tag:layer:rendering
python -m goalsys.cli find ../../Docs/goals ancestor:G-0010 status:active
python -m goalsys.cli find ../../Docs/goals "60fps"  # 자유 텍스트 — title + intent 부분일치
# 이웃 — 부모/자식/형제/constraints/constrained_by/realizes
python -m goalsys.cli neighbors G-0107 ../../Docs/goals
# 코드 → Goal — 헤더 @goal 태그 + 상위 GOALS.md + frontmatter realizes (goals_dir 인자 시)
python -m goalsys.cli which-goal HktGameplay/Source/HktCore/Foo.h ../.. ../../Docs/goals
```

기존 임시 Python 한 줄 호출은 `find` 가 대체. 복잡 조건은 `--json` 으로 받아 후처리.

출력 형식 (binding §4.1):

```
조회 결과 (필터: <조건>)
- G-0110 <title> (active)
- G-0142 <title> (active) — 다중 부모: G-0010, G-0020
총 N 개. 상세: Docs/goals/G-XXXX.md
```

### 3.A — 작성·수정·폐기·대체 (`/goal new`, `/goal edit`, `/goal abandon`, `/goal supersede`)

#### 3.A.1 신규 작성 (binding §4.2.1)

| # | 단계 | 명령 |
|---|------|------|
| 1 | ID 할당 | `cd Tools/goal-system && python -m goalsys.cli next-id <pillar\|system\|general> ../../Docs/goals` |
| 2 | 사용자 대화로 필수 필드 채움 — title / intent / success_criteria / parents / constraints | — |
| 3 | 초안 제시 → 사용자 검토 (§3.A.2 형식) | — |
| 4 | 파일 작성 — 아래 두 경로 중 택1 | (아래) |
| 5 | 무결성 검증 | `python -m goalsys.cli validate ../../Docs/goals` |
| 6 | 자동 생성 뷰 갱신 | `python -m goalsys.cli build-views ../../Docs/goals` |

step 4 — 파일 작성 경로:

| 경로 | 용도 | 명령 |
|------|------|------|
| (a) Write 직접 | 본문(Intent / Success Criteria 마크다운) 까지 한 번에 작성 — 기본 권장 | `Write Docs/goals/G-XXXX.md` (frontmatter + 본문) |
| (b) `new-goal` CLI | TODO 본문 골격만 빠르게 만들고 나중에 채움 | `python -m goalsys.cli new-goal <category> ../../Docs/goals --title "..." --parents G-0010,G-0020 --tags layer:rendering` |

(b) 사용 시 `next-id` 가 내부 호출되므로 step 1 은 생략 가능. (a) 사용 시 step 1 의 ID 가 frontmatter 에 들어간다.

#### 3.A.2 초안 제시 형식 (binding §4.2.2)

```
초안:
---
id: <할당 예정 — 검증 후 부여>
title: <기술된 제목>
status: proposed
parents: [<제안 부모 + 근거>]
constraints: [<해당 시>]
success_criteria:
  - description: ...
    measurable: true | false
    measure: ...
---
검토 후 확정 시 ID 부여.
```

#### 3.A.3 수정 (binding §4.2.3)

| # | 단계 |
|---|------|
| 1 | 기존 Goal 파일 읽음 (Read) |
| 2 | 영향 분석 — `realizes` 봉사 코드, 자식 Goal (`children`) 에 미치는 영향 |
| 3 | 사용자 확인 후 변경 적용 (Edit) |
| 4 | `updated_at` 갱신 |
| 5 | `validate` + `build-views` 재실행 |

#### 3.A.4 폐기·대체 (binding §4.2.4)

| 작업 | 처리 | 파일 |
|------|------|------|
| 폐기 (`abandon`) | `status: abandoned`. 자식 Goal 은 사용자 결정으로 재배치 또는 함께 폐기. | **삭제 X** |
| 대체 (`supersede`) | `status: superseded` + `superseded_by: G-YYYY` (필수). | **삭제 X** |

ID 는 영구 불변 — 폐기되어도 재사용 금지 (design §3.6).

### 3.P — 일감 도출 (`/goal plan <ID>`)

| # | 단계 |
|---|------|
| 1 | 대상 Goal 의 `success_criteria` 읽음 |
| 2 | 현재 `realizes` 코드 점검 — 필요 시 파일을 Read |
| 3 | 미달 부분 식별 |
| 4 | 각 미달 부분을 좁히기 위한 Task 후보 생성 |
| 5 | 각 Task 에 봉사 Goal ID 명시 (다중 가능) |

Task 최소 표현 (binding §4.3 — 본 시스템은 Task 시스템 상세를 정의하지 않음):

```yaml
goal_id: G-0142          # 다중 가능
title: <짧은 제목>
description: <상세>
status: todo | in_progress | done | cancelled
created_at: <ISO8601>
```

### 3.S — 봉사 작업 (`/goal serve <ID>` 또는 사용자가 Goal ID 명시한 구현 요청)

| # | 단계 |
|---|------|
| 1 | 봉사 Goal 의 `intent` + `constraints` + realizes 경로를 한 번에 로드 — `python -m goalsys.cli serve-context G-XXXX ../../Docs/goals` (한 호출이 transitive constraints 와 후손 realizes 까지 묶어서 출력) |
| 2 | constraints 위반 가능성 사전 점검 (§3.S.1) |
| 3 | 코드 작성/수정 |
| 4 | 새/변경 코드 헤더에 `// @goal: G-XXXX` 태그 추가/유지 — 정규식 `@goal:\s*G-\d{4}\b` 매치 (design §5.3 방식 A). 모듈 단위 봉사라면 디렉토리 `GOALS.md` 의 `## Realizes` 섹션 사용 (방식 B). |
| 5 | `python -m goalsys.cli sync-realizes ../../Docs/goals ../.. --dry-run` → 사용자 확인 후 dry-run 제거 실수행 |
| 6 | `python -m goalsys.cli validate-bidirectional ../../Docs/goals ../..` 로 C1~C4 위반 확인 |
| 7 | 완료 보고에 봉사 Goal ID 명시 |

#### 3.S.1 제약 위반 발견 시 (binding §4.4.1)

| # | 처리 |
|---|------|
| 1 | 진행 중단 |
| 2 | 위반 원인 보고 — 어떤 constraint Goal 의 어떤 criterion 을 위협하는지 |
| 3 | 회피 옵션 제시 — (a) 재설계 (b) 우회 (c) 별도 Goal 분리 |
| 4 | 사용자 결정 후 진행 |

### 3.V — 달성 검증 (`/goal verify <ID>`)

| # | 단계 |
|---|------|
| 1 | `success_criteria` 읽음 |
| 2 | `python -m goalsys.cli verify-goal G-XXXX ../../Docs/goals` 호출 — `measurable=true` 자동 측정 시도 |
| 3 | `manual_required` 항목은 사용자에게 수동 확인 요청 |
| 4 | 결과 보고 (§3.V.1 형식) |
| 5 | **status 변경은 사용자 확인 후** — 자동 변경 금지 |

#### 3.V.1 출력 형식 (binding §4.5)

```
G-XXXX 검증 결과

Criterion 1: <description>
  측정: <measure>
  결과: ✅ pass | ❌ fail | ⚠ manual_required
  현재 값: <value>

Criterion 2: ...

종합: N/M 충족
권장 status: active 유지 | achieved 변경 가능 | 추가 봉사 작업 도출
```

---

## 4. 강제 금지 (binding §1.3)

다음은 호출 모델과 무관하게 금지:

- Goal ID 없는 작업의 거부
- 사용자가 호출하지 않은 상태에서 Goal 결합 강요
- 자유 작업마다 "이건 Goal 결합 없이 처리합니다" 같은 안내

`/goal` 미호출 작업은 Goal 과 결합되지 않은 채로 진행되며, 그 자체로 정상이다.

---

## 5. Chat ↔ Code 핸드오프 (binding §5.1)

| 단계 | 도구 | 산출물 | 라이프사이클 |
|------|------|--------|-------------|
| 의도 정립 | Claude Chat | Goal 파일 | A |
| 일감 분해 | Claude Chat | Task 목록 (Goal ID 포함) | P |
| 구현 | Claude Code | 코드 + `@goal:` 태그 | S |
| 검증 | Claude Code 또는 CI | 검증 보고서 | V |

핸드오프 매개는 **Goal ID**. Code 측은 Goal ID 로 `Docs/goals/G-XXXX.md` 를 읽어 intent / constraints / success_criteria 를 컨텍스트에 로드한다.

---

## 6. 자주 헷갈리는 케이스 (binding 부록 A)

| 상황 | 분류 | 근거 |
|------|------|------|
| "이 함수 리팩토링" | 봉사 (`@goal` 태그 있음) / 자유 (없음) | 코드 태그 유무 |
| "테스트 추가" | 봉사 | success criterion 측정 향상 |
| "주석 정리" | 자유 | 의도 변화 없음 |
| "이 모듈 전체 새로 짜자" | 의도 | 새 의도 가능성 |
| "버그 수정" | B1~B4 | §2 양상 분류 |
| "성능 최적화" | 봉사 | 성능 Goal 에 봉사 |
| "라이브러리 교체" | 의도 / 자유 | 아키텍처 영향에 따라 |
| "문서 업데이트" | Goal 작업 (Goal 파일이면) / 자유 | 변경 대상 파일에 따라 |

---

## 7. 체크리스트 — 작업 종료 전

### `/goal new` 또는 `/goal edit` 수행 시

1. `cd Tools/goal-system && python -m goalsys.cli validate ../../Docs/goals` — 통과 확인
2. `python -m goalsys.cli build-views ../../Docs/goals` — INDEX/TREE/graph 갱신
3. 변경 Goal ID 와 영향 범위를 사용자에게 보고

### `/goal serve` 수행 시

1. 코드에 `// @goal: G-XXXX` 태그 (또는 디렉토리 `GOALS.md`) 추가/유지 확인
2. `python -m goalsys.cli sync-realizes ../../Docs/goals ../.. --dry-run` — 변경 미리보기
3. 사용자 확인 후 dry-run 제거하여 실수행
4. `python -m goalsys.cli validate-bidirectional ../../Docs/goals ../..` — C1~C4 위반 0 또는 경고만
5. 봉사 Goal ID 와 함께 완료 보고

### `/goal verify` 수행 시

1. `python -m goalsys.cli verify-goal G-XXXX ../../Docs/goals` 결과 텍스트 출력 그대로 보고
2. status 변경 권장은 **제안만** — 사용자 확정 전 파일 수정 금지

### `/goal validate` 수행 시

| 인자 | 절차 |
|------|------|
| (없음) | `python -m goalsys.cli validate ../../Docs/goals` — 스키마 + DAG (R1~R6) |
| `full` | 위 + `python -m goalsys.cli validate-bidirectional ../../Docs/goals ../..` — C1~C4 추가 |

위반은 모두 **경고** — 차단하지 않는다 (tooling §7.2 강제 금지 원칙). `--strict` 모드 사용 금지.

### `/goal site` 수행 시

1. `cd Tools/goal-system && python -m goalsys.cli build-site ../../Docs/goals` — `Docs/goals/site.html` 생성
2. 필요 시 `--out` 으로 다른 경로 지정 가능
3. 단일 HTML — 외부 의존은 Mermaid CDN 1개. 오프라인이면 그래프만 비어 있고 좌측 검색·우측 본문 패널은 동작
4. 노드 클릭 → 우측 패널 + "AI 핸드오프" 버튼 (클립보드: `/goal serve G-XXXX` / `/goal show G-XXXX` / 자연어 프롬프트)
5. `Docs/goals/site.html` 은 git 에 커밋해도 됨 — "어디서든" 보려면 GitHub raw 또는 Pages 가 가장 빠름. 단, build-views 처럼 변경 시 사람이 의식적으로 재생성해야 일관성이 유지됨

### `/goal sync` 수행 시

1. 항상 `python -m goalsys.cli sync-realizes ../../Docs/goals ../.. --dry-run` 부터 — 변경 미리보기 출력
2. 사용자 확인 후 `--dry-run` 제거하여 실수행
3. 자동 실행 금지 — 명시 호출 시에만 (tooling §5.3 규칙)
