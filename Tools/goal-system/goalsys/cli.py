"""Goal 시스템 CLI 진입점.

사용 예:
    python -m goalsys.cli validate Docs/goals
    python -m goalsys.cli build-views Docs/goals
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Sequence

from .dag import validate_dag
from .parser import GoalParseError, goals_by_id, load_goals
from .schema import validate_goals
from .views import generate_graph, generate_index, generate_tree


def cmd_validate(goals_dir: Path, *, strict: bool) -> int:
    try:
        goals = load_goals(goals_dir)
    except (GoalParseError, FileNotFoundError) as exc:
        print(f"파싱 오류: {exc}", file=sys.stderr)
        return 2
    if not goals:
        print(f"경고: {goals_dir} 에 Goal 파일이 없다.", file=sys.stderr)
        return 0

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
    print(
        f"OK — {len(goals)} goals, dag_warnings={len(dag_warnings)}",
    )
    return 0


def cmd_build_views(goals_dir: Path) -> int:
    try:
        goals = load_goals(goals_dir)
    except (GoalParseError, FileNotFoundError) as exc:
        print(f"파싱 오류: {exc}", file=sys.stderr)
        return 2
    if not goals:
        print(f"경고: {goals_dir} 에 Goal 파일이 없다.", file=sys.stderr)
        # 빈 인덱스라도 생성한다.
    (goals_dir / "INDEX.md").write_text(generate_index(goals), encoding="utf-8")
    (goals_dir / "TREE.md").write_text(generate_tree(goals), encoding="utf-8")
    (goals_dir / "graph.mmd").write_text(generate_graph(goals), encoding="utf-8")
    print(f"생성 완료: INDEX.md / TREE.md / graph.mmd ({len(goals)} goals)")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="goalsys", description="Goal 시스템 CLI (Phase 1)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_val = sub.add_parser("validate", help="스키마 + DAG 검증")
    p_val.add_argument("goals_dir", type=Path, help="Goal 파일 디렉토리 (예: Docs/goals)")
    p_val.add_argument("--strict", action="store_true", help="경고도 실패로 취급")

    p_build = sub.add_parser("build-views", help="INDEX/TREE/graph.mmd 자동 생성")
    p_build.add_argument("goals_dir", type=Path)

    args = parser.parse_args(argv)
    if args.cmd == "validate":
        return cmd_validate(args.goals_dir, strict=args.strict)
    if args.cmd == "build-views":
        return cmd_build_views(args.goals_dir)
    parser.error(f"unknown command: {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
