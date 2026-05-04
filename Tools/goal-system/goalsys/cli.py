"""Goal 시스템 CLI 진입점.

사용 예:
    python -m goalsys.cli validate Docs/goals
    python -m goalsys.cli build-views Docs/goals
    python -m goalsys.cli check-realizes Docs/goals --repo-root .
    python -m goalsys.cli scan-tags . --json
    python -m goalsys.cli check-consistency Docs/goals --repo-root .
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List, Sequence

from .consistency import check_consistency
from .dag import validate_dag
from .parser import GoalParseError, goals_by_id, load_goals
from .realizes import validate_realizes
from .scanner import scan_repo
from .schema import validate_goals
from .views import generate_graph, generate_index, generate_tree


def _load_or_exit(goals_dir: Path) -> List | None:
    try:
        goals = load_goals(goals_dir)
    except (GoalParseError, FileNotFoundError) as exc:
        print(f"파싱 오류: {exc}", file=sys.stderr)
        return None
    if not goals:
        print(f"경고: {goals_dir} 에 Goal 파일이 없다.", file=sys.stderr)
    return goals


def cmd_validate(goals_dir: Path, *, strict: bool) -> int:
    goals = _load_or_exit(goals_dir)
    if goals is None:
        return 2

    schema_errors = validate_goals(goals)
    for err in schema_errors:
        print(f"[Schema] {err}", file=sys.stderr)

    try:
        goals_by_id(goals)
    except GoalParseError as exc:
        print(f"[Duplicate] {exc}", file=sys.stderr)
        return 2

    dag_errors, dag_warnings = validate_dag(goals)
    for err in dag_errors:
        print(f"[DAG] {err}", file=sys.stderr)
    for warn in dag_warnings:
        print(f"[DAG/warn] {warn}", file=sys.stderr)

    failed = bool(schema_errors) or bool(dag_errors) or (strict and bool(dag_warnings))
    if failed:
        print(
            f"검증 실패 — schema={len(schema_errors)}, dag_errors={len(dag_errors)}, "
            f"dag_warnings={len(dag_warnings)}",
            file=sys.stderr,
        )
        return 1
    print(f"OK — {len(goals)} goals, dag_warnings={len(dag_warnings)}")
    return 0


def cmd_build_views(goals_dir: Path) -> int:
    goals = _load_or_exit(goals_dir)
    if goals is None:
        return 2
    (goals_dir / "INDEX.md").write_text(generate_index(goals), encoding="utf-8")
    (goals_dir / "TREE.md").write_text(generate_tree(goals), encoding="utf-8")
    (goals_dir / "graph.mmd").write_text(generate_graph(goals), encoding="utf-8")
    print(f"생성 완료: INDEX.md / TREE.md / graph.mmd ({len(goals)} goals)")
    return 0


# ---------------------------------------------------------------------------
# Phase 2 명령들
# ---------------------------------------------------------------------------


def cmd_check_realizes(goals_dir: Path, repo_root: Path) -> int:
    """Task 2.1 — Goal 의 ``realizes`` 경로가 저장소에 실재하는지 검사."""

    goals = _load_or_exit(goals_dir)
    if goals is None:
        return 2
    errors = validate_realizes(goals, repo_root)
    for err in errors:
        print(f"[Realizes] {err}", file=sys.stderr)
    if errors:
        print(f"realizes 경로 검증 실패 — {len(errors)} 건", file=sys.stderr)
        return 1
    print(f"OK — {len(goals)} goals, realizes 경로 모두 실재")
    return 0


def cmd_scan_tags(repo_root: Path, *, as_json: bool) -> int:
    """Task 2.2 — 저장소 내 ``@goal:`` 태그 / ``GOALS.md`` 항목을 스캔하여 출력."""

    tags = scan_repo(repo_root)
    if as_json:
        payload = [
            {
                "goal_id": t.goal_id,
                "file_path": str(t.file_path),
                "line_no": t.line_no,
                "kind": t.kind,
                "source_kind": t.source_kind,
                "raw": t.raw,
            }
            for t in tags
        ]
        json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    else:
        for t in tags:
            print(t)
        print(f"# {len(tags)} tags", file=sys.stderr)
    return 0


def cmd_check_consistency(goals_dir: Path, repo_root: Path, *, strict: bool) -> int:
    """Task 2.3 — Goal ↔ Code 양방향 일관성 검사."""

    goals = _load_or_exit(goals_dir)
    if goals is None:
        return 2
    issues = check_consistency(goals, repo_root)
    errors = [i for i in issues if i.severity == "error"]
    warnings = [i for i in issues if i.severity == "warning"]
    for issue in issues:
        stream = sys.stderr
        print(f"[Consistency] {issue}", file=stream)
    if errors or (strict and warnings):
        print(
            f"양방향 일관성 검증 실패 — errors={len(errors)}, warnings={len(warnings)}",
            file=sys.stderr,
        )
        return 1
    print(f"OK — {len(goals)} goals, errors=0, warnings={len(warnings)}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="goalsys",
        description="Goal 시스템 CLI (Phase 1 + Phase 2)",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_val = sub.add_parser("validate", help="스키마 + DAG 검증")
    p_val.add_argument("goals_dir", type=Path, help="Goal 파일 디렉토리 (예: Docs/goals)")
    p_val.add_argument("--strict", action="store_true", help="경고도 실패로 취급")

    p_build = sub.add_parser("build-views", help="INDEX/TREE/graph.mmd 자동 생성")
    p_build.add_argument("goals_dir", type=Path)

    p_real = sub.add_parser("check-realizes", help="realizes 경로 실재성 검증 (Task 2.1)")
    p_real.add_argument("goals_dir", type=Path)
    p_real.add_argument("--repo-root", type=Path, default=Path("."), help="저장소 루트 (기본: 현재 디렉토리)")

    p_scan = sub.add_parser("scan-tags", help="@goal 태그 / GOALS.md 스캔 (Task 2.2)")
    p_scan.add_argument("repo_root", type=Path, help="스캔 루트 디렉토리")
    p_scan.add_argument("--json", dest="as_json", action="store_true", help="JSON 으로 출력")

    p_cons = sub.add_parser("check-consistency", help="Goal ↔ Code 양방향 일관성 (Task 2.3)")
    p_cons.add_argument("goals_dir", type=Path)
    p_cons.add_argument("--repo-root", type=Path, default=Path("."), help="저장소 루트 (기본: 현재 디렉토리)")
    p_cons.add_argument("--strict", action="store_true", help="경고도 실패로 취급")

    args = parser.parse_args(argv)
    if args.cmd == "validate":
        return cmd_validate(args.goals_dir, strict=args.strict)
    if args.cmd == "build-views":
        return cmd_build_views(args.goals_dir)
    if args.cmd == "check-realizes":
        return cmd_check_realizes(args.goals_dir, args.repo_root)
    if args.cmd == "scan-tags":
        return cmd_scan_tags(args.repo_root, as_json=args.as_json)
    if args.cmd == "check-consistency":
        return cmd_check_consistency(args.goals_dir, args.repo_root, strict=args.strict)
    parser.error(f"unknown command: {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
