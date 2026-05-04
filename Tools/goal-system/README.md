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
| `goalsys/cli.py`           | 모든 서브커맨드 진입점 | tooling §7 |

## CLI

```bash
# Phase 1 — 파서·검증·뷰
python -m goalsys.cli validate ../../Docs/goals
python -m goalsys.cli build-views ../../Docs/goals

# Phase 2 — 코드 ↔ Goal 양방향
python -m goalsys.cli scan-code-tags ../../
python -m goalsys.cli validate-bidirectional ../../Docs/goals ../../
python -m goalsys.cli sync-realizes ../../Docs/goals ../../ --dry-run

# Phase 3 — 라이프사이클 보조
python -m goalsys.cli next-id system ../../Docs/goals
python -m goalsys.cli new-goal system ../../Docs/goals \
  --title "예시 Goal" --parents G-0010,G-0020 --tags layer:rendering

# Phase 4 — 자동 검증
python -m goalsys.cli verify-goal G-0142 ../../Docs/goals
```

`validate` / `validate-bidirectional` 종료 코드:

- `0` — 통과 (또는 위반이 모두 ``warning``)
- `1` — 검증 실패 (스키마 또는 DAG 오류, ``--strict`` 시 경고 포함)
- `2` — 파싱 실패

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

## 확장 후크

`goalsys.verify.register_measure_handler(pattern, handler)` 로 ``measure`` 텍스트별
자동 측정기를 등록할 수 있다. 핸들러는 ``(goal, criterion_dict) → result_dict`` 시그니처.
프로젝트별 측정기는 별도 모듈에서 임포트 시점에 등록한다.
