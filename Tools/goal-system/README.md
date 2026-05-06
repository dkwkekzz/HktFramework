# goal-system

[`Docs/goal-system-design.md`](../../Docs/goal-system-design.md) +
[`Docs/goal-system-tooling.md`](../../Docs/goal-system-tooling.md) 의 도구 구현체.
프로젝트의 1차 표현인 **Goal** 파일(YAML frontmatter + Markdown)을 파싱·검증·인덱스 생성하고,
코드의 ``@goal:`` 태그와 양방향 일관성을 점검한다.

## 모듈 구성

| 모듈 | 책임 | 명세 |
|---|---|---|
| `goalsys/parser.py`        | YAML frontmatter + Markdown 파서 | design §3, §6 |
| `goalsys/schema.py`        | 필수 필드/타입/ID 형식 검증 | design §3, §3.4 |
| `goalsys/dag.py`           | DAG 6규칙 검증 (R1~R6) | design §4.2 |
| `goalsys/views.py`         | INDEX/TREE/graph.mmd 생성 | design §6.5 |
| `goalsys/codescan.py`      | 코드 ``@goal:`` 태그 + ``GOALS.md`` 스캔 | tooling §5.1 |
| `goalsys/bidirectional.py` | C1~C4 양방향 검증 + sync-realizes | tooling §5.2~§5.3 |
| `goalsys/lifecycle.py`     | next-id + new-goal | tooling §6.1~§6.2 |
| `goalsys/verify.py`        | verify-goal (자동 측정 후크) | tooling §6.3 |
| `goalsys/tasks.py`         | Task 모델 + CLI 백엔드 (new/close/list/validate/render-index) | task-system-design |
| `goalsys/cli.py`           | 모든 서브커맨드 진입점 | tooling §7 |

## CLI

서브커맨드는 두 묶음으로 나뉜다 — **원자(atomic) 명령**은 tooling §7.1 의
1:1 매핑이고, **복합 별칭**은 운영 편의용이다.

### 원자 명령 (tooling §7.1)

```bash
# 파싱
python -m goalsys.cli parse ../../Docs/goals          # 디렉토리 → JSON 배열
python -m goalsys.cli parse ../../Docs/goals/G-0142.md # 파일 → JSON 객체

# 검증 — 스키마(차단) / DAG(경고)
python -m goalsys.cli validate-schema ../../Docs/goals [--json]
python -m goalsys.cli validate-dag    ../../Docs/goals [--strict] [--json]

# 뷰 생성 — 개별 호출
python -m goalsys.cli render-index ../../Docs/goals
python -m goalsys.cli render-tree  ../../Docs/goals
python -m goalsys.cli render-graph ../../Docs/goals

# 코드 ↔ Goal 양방향
python -m goalsys.cli scan-code-tags ../../
python -m goalsys.cli validate-bidirectional ../../Docs/goals ../../
python -m goalsys.cli sync-realizes ../../Docs/goals ../../ --dry-run

# 라이프사이클 보조
python -m goalsys.cli next-id system ../../Docs/goals
python -m goalsys.cli new-goal system ../../Docs/goals \
  --title "예시 Goal" --parents G-0010,G-0020 --tags layer:rendering

# 자동 검증
python -m goalsys.cli verify-goal G-0142 ../../Docs/goals
```

### 복합 별칭

```bash
python -m goalsys.cli validate    ../../Docs/goals  # = validate-schema + validate-dag
python -m goalsys.cli build-views ../../Docs/goals  # = render-index + render-tree + render-graph
```

### Task 시스템

`Docs/task-system-design.md` 의 구현체. Task 는 Goal success_criteria 미달분을 영속화한다.

```bash
# 라이프사이클
python -m goalsys.cli new-task ../../Docs/tasks \
    --title "..." --goal G-0100 [--goal G-0101] \
    [--description "..."] [--constraint-violation G-0002]
python -m goalsys.cli close-task T-00001 ../../Docs/tasks [--cancelled] [--commit <sha>] [--pr <num>]
python -m goalsys.cli list-tasks ../../Docs/tasks [--status todo] [--goal G-0100]

# 검증 — Goal 디렉토리 제공 시 T-R1/T-R3 참조 검사 추가
python -m goalsys.cli validate-tasks ../../Docs/tasks ../../Docs/goals

# INDEX.md 재생성 — Goal 디렉토리 제공 시 Goal 제목 포함
python -m goalsys.cli render-task-index ../../Docs/tasks ../../Docs/goals
```

### CI 통합 (tooling §7.2)

| 명령 | CI 차단 | 비고 |
|---|---|---|
| `validate-schema` | **예** (위반 시 exit 1) | 스키마 무결성 보장 |
| `validate-dag` | 아니오 (경고) | `--strict` 시에만 차단 |
| `validate-bidirectional` | 아니오 (경고) | `--strict` 시에만 차단 |
| `render-index/tree/graph` | 아니오 | 자동 갱신 |

### 종료 코드

- `0` — 통과 (또는 위반이 경고 수준)
- `1` — 검증 실패 (스키마 위반, 또는 `--strict` 시 DAG·양방향 위반)
- `2` — 파싱 실패 또는 인자 오류

## 테스트

```bash
cd Tools/goal-system
python -m pytest tests/ -v
```

테스트 픽스처(`tests/fixtures/`) 는 design §7 의 예시 4개 — Pillar / 시스템 /
다중 부모 / 제약 — 를 포함한다.

## 의존성

- Python ≥ 3.11
- PyYAML ≥ 6.0
- pytest (테스트만)

## 구현 단계 (tooling §2.2 대응)

- [x] Phase 1 — parse / validate-schema / validate-dag (R1~R6)
- [x] Phase 2 — render-index / render-tree / render-graph
- [x] Phase 3 — scan-code-tags / validate-bidirectional
- [x] Phase 4 — next-id / new-goal
- [x] Phase 5 — sync-realizes / verify-goal

§7.1 의 12개 원자 서브커맨드가 모두 1:1 노출되며, `validate` / `build-views` 는
원자 명령 묶음의 별칭으로만 유지된다.

## 확장 후크

`goalsys.verify.register_measure_handler(pattern, handler)` 로 ``measure`` 텍스트별
자동 측정기를 등록할 수 있다. 핸들러는 ``(goal, criterion_dict) → result_dict`` 시그니처.
프로젝트별 측정기는 별도 모듈에서 임포트 시점에 등록한다.
