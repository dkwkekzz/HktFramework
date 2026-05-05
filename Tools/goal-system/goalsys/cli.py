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
from typing import List, Sequence

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
from .verify import format_report, verify_goal
from .views import generate_graph, generate_index, generate_tree


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
            payload = [_goal_to_payload(g) for g in goals]
        elif path.is_file():
            goal = parse_goal_file(path)
            payload = _goal_to_payload(goal)
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

    # 중복 ID 도 스키마 단계에서 보고.
    duplicate_violation: dict | None = None
    try:
        goals_by_id(goals)
    except GoalParseError as exc:
        duplicate_violation = {"issue": "duplicate_id", "message": str(exc)}

    schema_errors = validate_goals(goals)
    violations = [
        {
            "goal": err.goal_id,
            "field": err.field,
            "issue": "schema_violation",
            "message": err.message,
            "source": err.source,
        }
        for err in schema_errors
    ]
    if duplicate_violation is not None:
        violations.append(duplicate_violation)

    passed = not violations
    payload = {"passed": passed, "violations": violations}
    if as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        for err in schema_errors:
            print(f"[Schema] {err}", file=sys.stderr)
        if duplicate_violation is not None:
            print(f"[Duplicate] {duplicate_violation['message']}", file=sys.stderr)
        if passed:
            print(f"OK — {len(goals)} goals, schema 위반 없음")
        else:
            print(f"검증 실패 — schema 위반 {len(violations)}개", file=sys.stderr)
    return 0 if passed else 1


def cmd_validate_dag(goals_dir: Path, *, strict: bool, as_json: bool) -> int:
    """tooling §3.3 — DAG 단독 검증. 기본 exit 0 (경고), --strict 시 exit 1."""

    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc

    dag_errors, dag_warnings = validate_dag(goals)
    violations = [
        {
            "rule": e.rule,
            "goal": e.goal_id,
            "issue": "dag_error",
            "message": e.message,
        }
        for e in dag_errors
    ] + [
        {
            "rule": w.rule,
            "goal": w.goal_id,
            "issue": "dag_warning",
            "message": w.message,
        }
        for w in dag_warnings
    ]
    passed = not dag_errors and not dag_warnings
    payload = {"passed": passed, "violations": violations}

    if as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        for err in dag_errors:
            print(f"[DAG] {err}", file=sys.stderr)
        for warn in dag_warnings:
            print(f"[DAG/warn] {warn}", file=sys.stderr)
        print(
            f"DAG — {len(goals)} goals, errors={len(dag_errors)}, warnings={len(dag_warnings)}"
        )

    # tooling §7.2: validate-dag 는 기본 차단 X. --strict 시에만 exit 1.
    if strict and (dag_errors or dag_warnings):
        return 1
    return 0


def cmd_render_index(goals_dir: Path) -> int:
    """tooling §4.2 — INDEX.md 단독 생성."""

    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc
    (goals_dir / "INDEX.md").write_text(generate_index(goals), encoding="utf-8")
    print(f"생성 완료: INDEX.md ({len(goals)} goals)")
    return 0


def cmd_render_tree(goals_dir: Path) -> int:
    """tooling §4.3 — TREE.md 단독 생성."""

    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc
    (goals_dir / "TREE.md").write_text(generate_tree(goals), encoding="utf-8")
    print(f"생성 완료: TREE.md ({len(goals)} goals)")
    return 0


def cmd_render_graph(goals_dir: Path) -> int:
    """tooling §4.4 — graph.mmd 단독 생성."""

    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc
    (goals_dir / "graph.mmd").write_text(generate_graph(goals), encoding="utf-8")
    print(f"생성 완료: graph.mmd ({len(goals)} goals)")
    return 0


def cmd_validate(goals_dir: Path, *, strict: bool) -> int:
    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc
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
    print(f"OK — {len(goals)} goals, dag_warnings={len(dag_warnings)}")
    return 0


def cmd_build_views(goals_dir: Path) -> int:
    goals, rc = _load_or_exit(goals_dir)
    if goals is None:
        return rc
    if not goals:
        print(f"경고: {goals_dir} 에 Goal 파일이 없다.", file=sys.stderr)
    (goals_dir / "INDEX.md").write_text(generate_index(goals), encoding="utf-8")
    (goals_dir / "TREE.md").write_text(generate_tree(goals), encoding="utf-8")
    (goals_dir / "graph.mmd").write_text(generate_graph(goals), encoding="utf-8")
    print(f"생성 완료: INDEX.md / TREE.md / graph.mmd ({len(goals)} goals)")
    return 0


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
    parents: List[str] | None,
    constraints: List[str] | None,
    tags: List[str] | None,
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


def _split_csv(value: str | None) -> List[str] | None:
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

    parser.error(f"unknown command: {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
