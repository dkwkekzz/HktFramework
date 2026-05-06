# Tasks

이 디렉토리는 **Task 파일 평탄 저장소** 다. 설계 [`Docs/task-system-design.md`](../task-system-design.md) 참조.

## 규칙 요약

- 파일명 = ID. `T-00001.md`. 제목을 파일명에 넣지 않는다.
- Task 는 1개 이상 Goal 에 봉사 (`goal_ids` 필수, T-R1).
- `done` / `cancelled` 는 `closed_at` 필수 (T-R2).
- 파일은 거의 이동·삭제하지 않는다. ID 는 영구 불변.
- `INDEX.md` 는 **자동 생성** 파일 — 직접 수정 금지.

## 도구

`Tools/goal-system/` — Goal 시스템과 통합된 CLI.

```bash
cd Tools/goal-system

# Task 라이프사이클
python -m goalsys.cli new-task ../../Docs/tasks \
    --title "..." --goal G-0100 --description "..."
python -m goalsys.cli close-task T-00001 ../../Docs/tasks
python -m goalsys.cli close-task T-00001 ../../Docs/tasks --cancelled
python -m goalsys.cli list-tasks ../../Docs/tasks --status todo
python -m goalsys.cli list-tasks ../../Docs/tasks --goal G-0100

# 검증 — 스키마 + 참조 (T-R1/T-R3)
python -m goalsys.cli validate-tasks ../../Docs/tasks ../../Docs/goals

# INDEX 재생성
python -m goalsys.cli render-task-index ../../Docs/tasks ../../Docs/goals
```

## 관련 문서

- [`Docs/task-system-design.md`](../task-system-design.md) — 데이터 모델 + 운영 명세
- [`Docs/agent-goal-binding.md`](../agent-goal-binding.md) — `/goal plan` P 라이프사이클
- [`Docs/goals/README.md`](../goals/README.md) — Goal 평탄 저장소
