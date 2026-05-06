"""Goal 시스템 CLI 진입점.

원자 서브커맨드 (tooling §7.1):
    parse / validate-schema / validate-dag /
    render-index / render-tree / render-graph /
    scan-code-tags / validate-bidirectional / sync-realizes /
    next-id / new-goal / verify-goal

복합 별칭 (운영 편의):
    validate     = validate-schema + validate-dag
    build-views  = render-index + render-tree + render-graph

CI 통합 (§7.2): ``validate-schema`` 만 차단(exit 1), 나머지 검증은 경고.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Callable, Sequence

from .bidirectional import sync_realizes, validate_bidirectional
from .codescan import scan_code_tags
from .dag import validate_dag
from .lifecycle import IdExhaustedError, NewGoalRequest, new_goal, next_id
from .parser import (
    Goal,
    GoalParseError,
    goals_by_id,
    load_goals,
    parse_goal_file,
)
from .schema import validate_goals
from .tasks import (
    NewTaskRequest,
    Task,
    TaskIdExhaustedError,
    TaskParseError,
    TaskTransitionError,
    close_task,
    generate_task_index,
    load_tasks,
    new_task,
    start_task,
    validate_task_refs,
    validate_tasks,
)
from .verify import format_report, verify_goal
from .views import generate_graph, generate_index, generate_tree


# tooling §3.2~§3.3 — JSON 페이로드의 issue discriminator.
ISSUE_SCHEMA_VIOLATION = "schema_violation"
ISSUE_DUPLICATE_ID = "duplicate_id"

# 뷰 파일명 → 생성기. render-* / build-views 가 공유한다.
_VIEW_RENDERERS: dict[str, Callable[[Sequence[Goal]], str]] = {
    "INDEX.md": generate_index,
    "TREE.md": generate_tree,
    "graph.mmd": generate_graph,
}


def _load_or_exit(goals_dir: Path) -> tuple[list[Goal] | None, int]:
    """``load_goals`` 의 표준 오류 처리 — 실패 시 (None, exit_code) 반환."""

    try:
        return load_goals(goals_dir), 0
    except (GoalParseError, FileNotFoundError) as exc:
        print(f"파싱 오류: {exc}", file=sys.stderr)
        return None, 2


def _goal_to_payload(goal: Goal) -> dict:
    """tooling §3.1 — parse 출력의 객체 형태."""

    return {
        "frontmatter": goal.raw_frontmatter,
        "body": goal.raw_body,
        "source": str(goal.source_path) if goal.source_path else None,
    }


def cmd_parse(path: Path) -> int:
    """tooling §3.1 — Goal 파일/디렉토리를 파싱해 JSON 출력."""

    try:
        if path.is_dir():
            goals = load_goals(path)
            payload: list[dict] | dict = [_goal_to_payload(g) for g in goals]
        elif path.is_file():
            payload = _goal_to_payload(parse_goal_file(path))
        else:
            print(f"오류: {path} 가 파일도 디렉토리도 아니다", file=sys.stderr)
            return 2
    except (GoalParseError, FileNotFoundError) as exc:
        print(f"파싱 오류: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(payload, ensure_ascii=False, indent=2, default=str, sort_keys=True))
    return 0


def cmd_validate_schema(goals_dir: Path, *, as_json: bool) -> int:
    """tooling §3.2 — 스키마 단독 검증. 위반 시 exit 1 (CI 차단)."""

    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc

    violations: list[dict] = [err.to_dict() for err in validate_goals(goals)]
    # 중복 ID 도 스키마 위반으로 취급 — schema 단계에서 한 번에 보고.
    try:
        goals_by_id(goals)
    except GoalParseError as exc:
        violations.append({"issue": ISSUE_DUPLICATE_ID, "message": str(exc)})

    passed = not violations
    if as_json:
        print(json.dumps({"passed": passed, "violations": violations},
                         ensure_ascii=False, indent=2))
    else:
        for v in violations:
            tag = "Duplicate" if v["issue"] == ISSUE_DUPLICATE_ID else "Schema"
            print(f"[{tag}] {_format_violation(v)}", file=sys.stderr)
        if passed:
            print(f"OK — {len(goals)} goals, schema 위반 없음")
        else:
            print(f"검증 실패 — schema 위반 {len(violations)}개", file=sys.stderr)
    return 0 if passed else 1


def _format_violation(v: dict) -> str:
    """JSON 페이로드 형태의 violation 한 건을 사람이 읽는 한 줄로."""

    if v["issue"] == ISSUE_DUPLICATE_ID:
        return v["message"]
    if v["issue"] == ISSUE_SCHEMA_VIOLATION:
        loc = f"{v['goal']}.{v['field']}"
        prefix = f"[{v['source']}] " if v.get("source") else ""
        return f"{prefix}{loc}: {v['message']}"
    # dag_error / dag_warning
    return f"[{v['rule']}] {v['goal']}: {v['message']}"


def cmd_validate_dag(goals_dir: Path, *, strict: bool, as_json: bool) -> int:
    """tooling §3.3 — DAG 단독 검증. 기본 exit 0 (경고), --strict 시 exit 1."""

    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc

    dag_errors, dag_warnings = validate_dag(goals)
    violations = [e.to_dict() for e in dag_errors] + [w.to_dict() for w in dag_warnings]
    passed = not violations

    if as_json:
        print(json.dumps({"passed": passed, "violations": violations},
                         ensure_ascii=False, indent=2))
    else:
        for err in dag_errors:
            print(f"[DAG] {err}", file=sys.stderr)
        for warn in dag_warnings:
            print(f"[DAG/warn] {warn}", file=sys.stderr)
        summary = (
            f"DAG — {len(goals)} goals, errors={len(dag_errors)}, "
            f"warnings={len(dag_warnings)}"
        )
        # tooling §7.2: validate-dag 는 기본 차단 X. --strict 시에만 exit 1.
        will_block = strict and not passed
        print(summary, file=sys.stderr if will_block else sys.stdout)

    return 1 if (strict and not passed) else 0


def _render_view(goals_dir: Path, filename: str) -> int:
    """단일 뷰 파일 생성. render-index/tree/graph 공통 본체."""

    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc
    (goals_dir / filename).write_text(_VIEW_RENDERERS[filename](goals), encoding="utf-8")
    print(f"생성 완료: {filename} ({len(goals)} goals)")
    return 0


def cmd_render_index(goals_dir: Path) -> int:
    """tooling §4.2."""
    return _render_view(goals_dir, "INDEX.md")


def cmd_render_tree(goals_dir: Path) -> int:
    """tooling §4.3."""
    return _render_view(goals_dir, "TREE.md")


def cmd_render_graph(goals_dir: Path) -> int:
    """tooling §4.4."""
    return _render_view(goals_dir, "graph.mmd")


def cmd_validate(goals_dir: Path, *, strict: bool) -> int:
    """복합 별칭 — validate-schema + validate-dag.

    스키마 위반은 항상 차단. DAG 는 ``--strict`` 시에만 차단.
    """

    rc_schema = cmd_validate_schema(goals_dir, as_json=False)
    rc_dag = cmd_validate_dag(goals_dir, strict=strict, as_json=False)
    return max(rc_schema, rc_dag)


def cmd_build_views(goals_dir: Path) -> int:
    """복합 별칭 — render-index + render-tree + render-graph."""

    worst = 0
    for filename in _VIEW_RENDERERS:
        worst = max(worst, _render_view(goals_dir, filename))
    return worst


def cmd_scan_code_tags(root: Path, *, as_json: bool) -> int:
    try:
        index = scan_code_tags(root)
    except FileNotFoundError as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 2
    if as_json:
        payload = {
            "file_tags": index.file_tags,
            "dir_tags": index.dir_tags,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        for path in sorted(index.file_tags):
            print(f"{path}: {', '.join(index.file_tags[path])}")
        for dpath in sorted(index.dir_tags):
            print(f"{dpath}/GOALS.md: {', '.join(index.dir_tags[dpath])}")
        print(
            f"-- 파일 태그 {len(index.file_tags)}개, "
            f"디렉토리 태그 {len(index.dir_tags)}개 --",
            file=sys.stderr,
        )
    return 0


def cmd_validate_bidirectional(goals_dir: Path, project_root: Path, *, strict: bool) -> int:
    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc
    code_index = scan_code_tags(project_root)
    violations = validate_bidirectional(goals, code_index, project_root)
    for v in violations:
        print(f"[Bidirectional] {v}", file=sys.stderr)
    if violations and strict:
        return 1
    print(f"양방향 검사 — {len(goals)} goals, {len(violations)} 위반(경고)")
    return 0


def cmd_sync_realizes(goals_dir: Path, project_root: Path, *, dry_run: bool) -> int:
    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc
    code_index = scan_code_tags(project_root)
    actions = sync_realizes(goals, code_index, dry_run=dry_run)
    for a in actions:
        print(str(a))
    if not actions:
        print("동기화 대상 없음.")
    elif dry_run:
        print(f"-- dry-run: {len(actions)} 항목이 적용 예정 --", file=sys.stderr)
    else:
        print(f"-- 적용 완료: {len(actions)} 항목 --", file=sys.stderr)
    return 0


def cmd_next_id(category: str, goals_dir: Path) -> int:
    try:
        gid = next_id(category, goals_dir)
    except (ValueError, IdExhaustedError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 2
    print(gid)
    return 0


def cmd_new_goal(
    category: str,
    goals_dir: Path,
    *,
    title: str | None,
    parents: list[str] | None,
    constraints: list[str] | None,
    tags: list[str] | None,
) -> int:
    req = NewGoalRequest(
        category=category,
        title=title,
        parents=parents,
        constraints=constraints,
        tags=tags,
    )
    try:
        path = new_goal(req, goals_dir)
    except (ValueError, IdExhaustedError, FileExistsError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 2
    print(str(path))
    return 0


def _load_tasks_or_exit(tasks_dir: Path) -> tuple[list[Task] | None, int]:
    try:
        return load_tasks(tasks_dir), 0
    except (TaskParseError, FileNotFoundError) as exc:
        print(f"Task 파싱 오류: {exc}", file=sys.stderr)
        return None, 2


def cmd_new_task(
    tasks_dir: Path,
    *,
    title: str,
    goal_ids: list[str],
    description: str | None,
    constraint_violation: str | None,
) -> int:
    if not goal_ids:
        print("오류: --goal 최소 1개 필요", file=sys.stderr)
        return 2
    req = NewTaskRequest(
        title=title,
        goal_ids=goal_ids,
        description=description or "",
        constraint_violation=constraint_violation,
    )
    try:
        path = new_task(req, tasks_dir)
    except (FileExistsError, TaskIdExhaustedError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 2
    print(str(path))
    return 0


def cmd_start_task(task_id: str, tasks_dir: Path) -> int:
    try:
        path = start_task(task_id, tasks_dir)
    except (FileNotFoundError, TaskTransitionError, ValueError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 2
    print(str(path))
    return 0


def cmd_close_task(
    task_id: str,
    tasks_dir: Path,
    *,
    final_status: str,
    commit: str | None,
    pr: int | None,
) -> int:
    try:
        path = close_task(
            task_id, tasks_dir, final_status=final_status, commit=commit, pr=pr,
        )
    except (FileNotFoundError, TaskTransitionError, ValueError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 2
    print(str(path))
    return 0


def cmd_list_tasks(
    tasks_dir: Path,
    *,
    status: str | None,
    goal_id: str | None,
) -> int:
    tasks, rc = _load_tasks_or_exit(tasks_dir)
    if tasks is None:
        return rc
    filtered = tasks
    if status:
        filtered = [t for t in filtered if t.status == status]
    if goal_id:
        filtered = [t for t in filtered if goal_id in t.goal_ids]
    for t in sorted(filtered, key=lambda x: x.id):
        goals_str = ",".join(t.goal_ids)
        print(f"{t.id}\t{t.status}\t→ {goals_str}\t{t.title}")
    print(f"-- {len(filtered)} task(s) --", file=sys.stderr)
    return 0


def cmd_validate_tasks(tasks_dir: Path, goals_dir: Path | None) -> int:
    tasks, rc = _load_tasks_or_exit(tasks_dir)
    if tasks is None:
        return rc
    errors = validate_tasks(tasks)
    # 참조 검증 — Goal 디렉토리가 있을 때만 (T-R1, T-R3)
    if goals_dir is not None:
        goals, grc = _load_or_exit(goals_dir)
        if goals is None:
            return grc
        goal_id_set = {g.id for g in goals}
        constraint_id_set = {g.id for g in goals if "constraint" in g.tags}
        errors.extend(validate_task_refs(
            tasks,
            goal_ids=goal_id_set,
            constraint_ids=constraint_id_set,
        ))
    for e in errors:
        print(f"[Task] {e}", file=sys.stderr)
    if errors:
        print(f"검증 실패 — {len(errors)} 위반", file=sys.stderr)
        return 1
    print(f"OK — {len(tasks)} tasks, 위반 없음")
    return 0


def cmd_render_task_index(tasks_dir: Path, goals_dir: Path | None) -> int:
    tasks, rc = _load_tasks_or_exit(tasks_dir)
    if tasks is None:
        return rc
    titles: dict[str, str] = {}
    if goals_dir is not None and goals_dir.is_dir():
        goals, grc = _load_or_exit(goals_dir)
        if goals is not None:
            titles = {g.id: g.title for g in goals}
    text = generate_task_index(tasks, goal_titles=titles)
    (tasks_dir / "INDEX.md").write_text(text, encoding="utf-8")
    print(f"생성 완료: {tasks_dir / 'INDEX.md'} ({len(tasks)} tasks)")
    return 0


def cmd_verify_goal(goal_id: str, goals_dir: Path, *, as_json: bool) -> int:
    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc
    target = next((g for g in goals if g.id == goal_id), None)
    if target is None:
        print(f"오류: Goal {goal_id} 없음 (in {goals_dir})", file=sys.stderr)
        return 2
    report = verify_goal(target)
    if as_json:
        print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(format_report(report))
    return 0


def _split_csv(value: str | None) -> list[str] | None:
    if value is None:
        return None
    items = [s.strip() for s in value.split(",") if s.strip()]
    return items or None


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="goalsys", description="Goal 시스템 CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    # --- 원자 명령 (tooling §7.1) ---

    p_parse = sub.add_parser("parse", help="Goal 파일/디렉토리 파싱 → JSON")
    p_parse.add_argument("path", type=Path, help="Goal 파일 또는 디렉토리")

    p_vs = sub.add_parser("validate-schema", help="스키마 단독 검증 (CI 차단)")
    p_vs.add_argument("goals_dir", type=Path)
    p_vs.add_argument("--json", action="store_true", help="JSON 출력")

    p_vd = sub.add_parser("validate-dag", help="DAG 단독 검증 (기본 경고)")
    p_vd.add_argument("goals_dir", type=Path)
    p_vd.add_argument("--strict", action="store_true", help="위반 시 exit 1")
    p_vd.add_argument("--json", action="store_true", help="JSON 출력")

    p_ri = sub.add_parser("render-index", help="INDEX.md 단독 생성")
    p_ri.add_argument("goals_dir", type=Path)

    p_rt = sub.add_parser("render-tree", help="TREE.md 단독 생성")
    p_rt.add_argument("goals_dir", type=Path)

    p_rg = sub.add_parser("render-graph", help="graph.mmd 단독 생성")
    p_rg.add_argument("goals_dir", type=Path)

    # --- 복합 별칭 (운영 편의) ---

    p_val = sub.add_parser("validate", help="스키마 + DAG 일괄 검증 (별칭)")
    p_val.add_argument("goals_dir", type=Path)
    p_val.add_argument("--strict", action="store_true", help="경고도 실패로 취급")

    p_build = sub.add_parser("build-views", help="INDEX/TREE/graph.mmd 일괄 생성 (별칭)")
    p_build.add_argument("goals_dir", type=Path)

    p_scan = sub.add_parser("scan-code-tags", help="코드의 @goal 태그 / GOALS.md 스캔")
    p_scan.add_argument("root", type=Path, help="스캔 시작 경로 (프로젝트 루트 권장)")
    p_scan.add_argument("--json", action="store_true", help="JSON 출력")

    p_bi = sub.add_parser("validate-bidirectional", help="C1~C4 양방향 일관성 검증")
    p_bi.add_argument("goals_dir", type=Path)
    p_bi.add_argument("project_root", type=Path, help="realizes 경로 기준 루트")
    p_bi.add_argument("--strict", action="store_true", help="위반 시 exit 1")

    p_sync = sub.add_parser("sync-realizes", help="코드 태그 → Goal.realizes 동기화")
    p_sync.add_argument("goals_dir", type=Path)
    p_sync.add_argument("project_root", type=Path)
    p_sync.add_argument("--dry-run", action="store_true", help="파일 수정 없이 미리보기")

    p_nid = sub.add_parser("next-id", help="다음 가용 Goal ID 출력")
    p_nid.add_argument("category", choices=["pillar", "system", "general"])
    p_nid.add_argument("goals_dir", type=Path)

    p_new = sub.add_parser("new-goal", help="초안 Goal 파일 생성")
    p_new.add_argument("category", choices=["pillar", "system", "general"])
    p_new.add_argument("goals_dir", type=Path)
    p_new.add_argument("--title", default=None)
    p_new.add_argument("--parents", default=None, help="콤마 구분 ID 목록")
    p_new.add_argument("--constraints", default=None)
    p_new.add_argument("--tags", default=None)

    p_ver = sub.add_parser("verify-goal", help="Goal 의 success_criteria 자동 검증")
    p_ver.add_argument("goal_id")
    p_ver.add_argument("goals_dir", type=Path)
    p_ver.add_argument("--json", action="store_true")

    # --- Task 시스템 ---

    p_nt = sub.add_parser("new-task", help="새 Task 파일 생성")
    p_nt.add_argument("tasks_dir", type=Path)
    p_nt.add_argument("--title", required=True)
    p_nt.add_argument("--goal", action="append", default=[], dest="goal_ids",
                      help="봉사 Goal ID — 복수 지정 가능")
    p_nt.add_argument("--description", default=None)
    p_nt.add_argument("--constraint-violation", default=None,
                      help="B2 긴급 표시 — 위반 constraint Goal ID")

    p_st = sub.add_parser("start-task", help="Task 착수 — todo → in_progress")
    p_st.add_argument("task_id")
    p_st.add_argument("tasks_dir", type=Path)

    p_ct = sub.add_parser("close-task", help="Task 종결 — done | cancelled")
    p_ct.add_argument("task_id")
    p_ct.add_argument("tasks_dir", type=Path)
    p_ct.add_argument("--cancelled", action="store_true",
                      help="done 대신 cancelled 로 종결")
    p_ct.add_argument("--commit", default=None, help="related_commits 에 추가")
    p_ct.add_argument("--pr", type=int, default=None, help="related_pr 설정")

    p_lt = sub.add_parser("list-tasks", help="Task 목록 조회")
    p_lt.add_argument("tasks_dir", type=Path)
    p_lt.add_argument("--status", default=None,
                      help="todo | in_progress | done | cancelled")
    p_lt.add_argument("--goal", default=None, dest="goal_id",
                      help="특정 Goal 에 봉사하는 Task 만")

    p_vt = sub.add_parser("validate-tasks", help="Task 스키마 + 참조 검증")
    p_vt.add_argument("tasks_dir", type=Path)
    p_vt.add_argument("goals_dir", type=Path, nargs="?", default=None,
                      help="제공 시 T-R1/T-R3 참조 검증 추가")

    p_rti = sub.add_parser("render-task-index", help="Tasks INDEX.md 생성")
    p_rti.add_argument("tasks_dir", type=Path)
    p_rti.add_argument("goals_dir", type=Path, nargs="?", default=None,
                      help="제공 시 Goal 제목까지 포함")

    args = parser.parse_args(argv)

    if args.cmd == "parse":
        return cmd_parse(args.path)
    if args.cmd == "validate-schema":
        return cmd_validate_schema(args.goals_dir, as_json=args.json)
    if args.cmd == "validate-dag":
        return cmd_validate_dag(args.goals_dir, strict=args.strict, as_json=args.json)
    if args.cmd == "render-index":
        return cmd_render_index(args.goals_dir)
    if args.cmd == "render-tree":
        return cmd_render_tree(args.goals_dir)
    if args.cmd == "render-graph":
        return cmd_render_graph(args.goals_dir)
    if args.cmd == "validate":
        return cmd_validate(args.goals_dir, strict=args.strict)
    if args.cmd == "build-views":
        return cmd_build_views(args.goals_dir)
    if args.cmd == "scan-code-tags":
        return cmd_scan_code_tags(args.root, as_json=args.json)
    if args.cmd == "validate-bidirectional":
        return cmd_validate_bidirectional(args.goals_dir, args.project_root, strict=args.strict)
    if args.cmd == "sync-realizes":
        return cmd_sync_realizes(args.goals_dir, args.project_root, dry_run=args.dry_run)
    if args.cmd == "next-id":
        return cmd_next_id(args.category, args.goals_dir)
    if args.cmd == "new-goal":
        return cmd_new_goal(
            args.category,
            args.goals_dir,
            title=args.title,
            parents=_split_csv(args.parents),
            constraints=_split_csv(args.constraints),
            tags=_split_csv(args.tags),
        )
    if args.cmd == "verify-goal":
        return cmd_verify_goal(args.goal_id, args.goals_dir, as_json=args.json)
    if args.cmd == "new-task":
        return cmd_new_task(
            args.tasks_dir,
            title=args.title,
            goal_ids=args.goal_ids,
            description=args.description,
            constraint_violation=args.constraint_violation,
        )
    if args.cmd == "start-task":
        return cmd_start_task(args.task_id, args.tasks_dir)
    if args.cmd == "close-task":
        return cmd_close_task(
            args.task_id,
            args.tasks_dir,
            final_status="cancelled" if args.cancelled else "done",
            commit=args.commit,
            pr=args.pr,
        )
    if args.cmd == "list-tasks":
        return cmd_list_tasks(args.tasks_dir, status=args.status, goal_id=args.goal_id)
    if args.cmd == "validate-tasks":
        return cmd_validate_tasks(args.tasks_dir, args.goals_dir)
    if args.cmd == "render-task-index":
        return cmd_render_task_index(args.tasks_dir, args.goals_dir)

    parser.error(f"unknown command: {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
