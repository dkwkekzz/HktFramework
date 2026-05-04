# goal-system — Phase 1 + Phase 2

[Docs/goal-system-design.md](../../Docs/goal-system-design.md) §9.1 / §9.2 의 구현체.
프로젝트의 1차 표현인 **Goal** 파일(YAML frontmatter + Markdown)을 파싱·검증하고
인덱스 뷰(INDEX/TREE/Mermaid 그래프)를 자동 생성한다. Phase 2 에서는 Goal ↔ 코드 간
양방향 연결(`realizes` 경로 실재성, `@goal:` 태그 스캐너, 양방향 일관성)을 검증한다.

## 모듈 구성

| 모듈 | 책임 | 설계 §  |
|---|---|---|
| `goalsys/parser.py` | YAML frontmatter + Markdown 파서 | §3, §8 / Task 1.1 |
| `goalsys/schema.py` | 필수 필드/타입/ID 형식 검증 | §3, §3.4 / Task 1.2 |
| `goalsys/dag.py`    | DAG 무결성 5 규칙 검증 | §4.2 / Task 1.3 |
| `goalsys/views.py`  | INDEX/TREE/graph.mmd 생성 | §7.3 / Task 1.4 |
| `goalsys/realizes.py`   | `realizes[].path` 실재성 검증 | §5.1 / **Task 2.1** |
| `goalsys/scanner.py`    | `@goal:` 태그 + `GOALS.md` 스캐너 | §5.2 / **Task 2.2** |
| `goalsys/consistency.py`| Goal ↔ Code 양방향 일관성 검증 | §5.3 / **Task 2.3** |
| `goalsys/cli.py`    | 모든 명령 진입점 | — |

## 사용

### Phase 1 — 스키마/DAG/뷰

```bash
# 검증
python -m goalsys.cli validate ../../Docs/goals

# 인덱스/트리/Mermaid 자동 생성
python -m goalsys.cli build-views ../../Docs/goals
```

### Phase 2 — 코드 ↔ Goal 연결

```bash
# Task 2.1 — Goal 의 realizes 경로가 저장소에 실재하는지
python -m goalsys.cli check-realizes ../../Docs/goals --repo-root ../..

# Task 2.2 — 코드의 @goal 태그 / GOALS.md 항목 스캔
python -m goalsys.cli scan-tags ../..              # 텍스트 출력
python -m goalsys.cli scan-tags ../.. --json       # JSON 출력 (CI 파이프라인용)

# Task 2.3 — Goal ↔ Code 양방향 일관성 (위 두 검증 + 누락 경고)
python -m goalsys.cli check-consistency ../../Docs/goals --repo-root ../..
python -m goalsys.cli check-consistency ../../Docs/goals --repo-root ../.. --strict  # 경고도 실패
```

종료 코드(공통):

- `0` — 통과
- `1` — 검증 실패 (오류 발생, `--strict` 일 때는 경고도 포함)
- `2` — 입력 오류 (디렉토리 없음, frontmatter 깨짐, 중복 ID 등)

## Phase 2 설계 요약

### 코드 측 표기 (§5.2)

인라인 태그:

```cpp
// @goal: G-0142 (대량 적 렌더링 60fps)
// @goal: G-0001 (결정성 보존)  // 제약   ← 라인에 "제약" 또는 "constraint" 가 있으면 kind=constraint
```

모듈 단위 매핑 (`GOALS.md`):

```markdown
# Module: HktVoxelCore

## Realizes
- G-0142: 대량 적 렌더링 60fps

## Respects (Constraints)
- G-0003: UE5는 표현 계층
```

### 양방향 일관성 검사 항목 (§5.3)

| 검사 | 등급 | 규칙 명 |
|---|---|---|
| `realizes[].path` 가 실재 | error | `RealizesPathMissing` |
| 코드의 `@goal:` 태그가 실재 Goal 을 가리킴 | error | `UnknownGoalTag` |
| Goal A 의 `realizes` 에 X 가 있는데 X 에 A 태그가 없음 | warning | `MissingTag` |
| 코드 X 에 `@goal: A` 가 있는데 `A.realizes` 에 X 가 없음 | warning | `MissingRealizes` |

경로 매칭 규칙: 정확 일치 → 디렉토리 접두 → 글로브(`*.cpp`).
경로 구분자(`/` ↔ `\\`)는 자동 정규화.

## 테스트

```bash
cd Tools/goal-system
python -m pytest tests/ -v
```

테스트 파일:

- `test_parser.py` / `test_schema.py` / `test_dag.py` / `test_views.py` — Phase 1
- `test_realizes.py` / `test_scanner.py` / `test_consistency.py` — Phase 2
- `test_cli.py` — 모든 CLI 명령 통합

픽스처 (`tests/fixtures/`) 는 설계 §8 의 Pillar / 시스템 / 다중 부모 / 제약 4종 모두 포함.

## 의존성

- Python ≥ 3.11
- PyYAML ≥ 6.0
- pytest (테스트만)

## 체크리스트

### Phase 1 (§9.1)
- [x] Task 1.1 — Goal 파일 형식 파서
- [x] Task 1.2 — 스키마 검증
- [x] Task 1.3 — DAG 무결성 검증 (5 규칙)
- [x] Task 1.4 — 자동 생성 뷰 (INDEX / TREE / graph.mmd)

### Phase 2 (§9.2)
- [x] Task 2.1 — `realizes` 경로 실재성 검증
- [x] Task 2.2 — `@goal:` 태그 / `GOALS.md` 스캐너
- [x] Task 2.3 — 양방향 일관성 검증
