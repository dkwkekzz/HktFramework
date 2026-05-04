# goal-system — Phase 1 (스키마 및 검증기)

[Docs/goal-system-design.md](../../Docs/goal-system-design.md) §9.1 의 구현체.
프로젝트의 1차 표현인 **Goal** 파일(YAML frontmatter + Markdown)을 파싱·검증하고
인덱스 뷰(INDEX/TREE/Mermaid 그래프)를 자동 생성한다.

## 모듈 구성

| 모듈 | 책임 | 설계 §  |
|---|---|---|
| `goalsys/parser.py` | YAML frontmatter + Markdown 파서 | §3, §8 / Task 1.1 |
| `goalsys/schema.py` | 필수 필드/타입/ID 형식 검증 | §3, §3.4 / Task 1.2 |
| `goalsys/dag.py`    | DAG 무결성 5 규칙 검증 | §4.2 / Task 1.3 |
| `goalsys/views.py`  | INDEX/TREE/graph.mmd 생성 | §7.3 / Task 1.4 |
| `goalsys/cli.py`    | `validate` / `build-views` 명령 | — |

## 사용

```bash
# 검증
python -m goalsys.cli validate ../../Docs/goals

# 인덱스/트리/Mermaid 자동 생성
python -m goalsys.cli build-views ../../Docs/goals
```

`validate` 종료 코드:

- `0` — 통과
- `1` — 검증 실패 (스키마 또는 DAG 오류)
- `2` — 파싱 실패 (frontmatter 깨짐, 디렉토리 없음 등)

## 테스트

```bash
cd Tools/goal-system
python -m pytest tests/ -v
```

테스트 픽스처(`tests/fixtures/`) 는 설계 §8 의 예시 4개 — Pillar / 시스템 /
다중 부모 / 제약 — 를 모두 포함한다.

## 의존성

- Python ≥ 3.11
- PyYAML ≥ 6.0
- pytest (테스트만)

## Phase 1 체크리스트 (설계 §9.1 대응)

- [x] Task 1.1 — Goal 파일 형식 파서
- [x] Task 1.2 — 스키마 검증
- [x] Task 1.3 — DAG 무결성 검증 (5 규칙)
- [x] Task 1.4 — 자동 생성 뷰 (INDEX / TREE / graph.mmd)

다음 단계는 §9.2 — 코드 ↔ Goal 양방향 연결 (`realizes` 경로 검증, `@goal:`
태그 스캐너).
