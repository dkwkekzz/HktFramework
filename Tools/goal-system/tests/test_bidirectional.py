"""Phase 2 — `validate-bidirectional` + `sync-realizes` 테스트."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import yaml

from goalsys.bidirectional import (
    BidirectionalViolation,
    sync_realizes,
    validate_bidirectional,
)
from goalsys.codescan import CodeTagIndex, scan_code_tags
from goalsys.parser import Goal, load_goals, parse_goal_file


def _seed_workspace(tmp_path: Path, goals_md: Dict[str, str], code_files: Dict[str, str]) -> Path:
    """프로젝트 루트 picture: ``goals/`` + 코드 파일 트리. 루트 경로 반환."""

    goals_dir = tmp_path / "goals"
    goals_dir.mkdir()
    for name, text in goals_md.items():
        (goals_dir / name).write_text(text, encoding="utf-8")
    for rel, text in code_files.items():
        target = tmp_path / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
    return tmp_path


_GOAL_TEMPLATE = (
    "---\n"
    "id: {gid}\n"
    "title: t\n"
    "status: active\n"
    "created_at: 2026-05-04\n"
    "updated_at: 2026-05-04\n"
    "parents: {parents}\n"
    "children: []\n"
    "constraints: []\n"
    "tags: {tags}\n"
    "{extra}"
    "---\n\n"
    "## Intent\n어떤 의도\n\n"
    "## Success Criteria\n"
    "- description: x\n  measurable: false\n"
)


def _goal_md(
    gid: str,
    *,
    parents: List[str] | None = None,
    tags: List[str] | None = None,
    realizes: List[Dict[str, str]] | None = None,
) -> str:
    parents = parents if parents is not None else []
    tags = tags if tags is not None else ["pillar:test"]
    extra = ""
    if realizes:
        extra = "realizes:\n"
        for r in realizes:
            extra += f"  - path: {r['path']}\n    role: {r['role']}\n"
    return _GOAL_TEMPLATE.format(
        gid=gid,
        parents=parents,
        tags=tags,
        extra=extra,
    )


def test_c1_missing_realizes_path(tmp_path: Path) -> None:
    root = _seed_workspace(
        tmp_path,
        goals_md={
            "G-0010.md": _goal_md(
                "G-0010", realizes=[{"path": "src/missing.cpp", "role": "x"}]
            ),
        },
        code_files={},
    )
    goals = load_goals(root / "goals")
    code_index = scan_code_tags(root)
    violations = validate_bidirectional(goals, code_index, root)
    assert any(v.condition == "C1" and v.path == "src/missing.cpp" for v in violations)


def test_c2_unknown_goal_id_in_code(tmp_path: Path) -> None:
    root = _seed_workspace(
        tmp_path,
        goals_md={"G-0010.md": _goal_md("G-0010")},
        code_files={"src/Foo.cpp": "// @goal: G-9999\nvoid f() {}\n"},
    )
    goals = load_goals(root / "goals")
    code_index = scan_code_tags(root)
    violations = validate_bidirectional(goals, code_index, root)
    assert any(v.condition == "C2" and v.goal_id == "G-9999" for v in violations)


def test_c3_realizes_without_code_tag(tmp_path: Path) -> None:
    root = _seed_workspace(
        tmp_path,
        goals_md={
            "G-0010.md": _goal_md(
                "G-0010", realizes=[{"path": "src/Foo.cpp", "role": "x"}]
            ),
        },
        code_files={"src/Foo.cpp": "void f() {}\n"},  # 태그 없음
    )
    goals = load_goals(root / "goals")
    code_index = scan_code_tags(root)
    violations = validate_bidirectional(goals, code_index, root)
    assert any(v.condition == "C3" and v.goal_id == "G-0010" for v in violations)


def test_c4_code_tag_without_realizes(tmp_path: Path) -> None:
    root = _seed_workspace(
        tmp_path,
        goals_md={"G-0010.md": _goal_md("G-0010")},
        code_files={"src/Foo.cpp": "// @goal: G-0010\nvoid f() {}\n"},
    )
    goals = load_goals(root / "goals")
    code_index = scan_code_tags(root)
    violations = validate_bidirectional(goals, code_index, root)
    assert any(v.condition == "C4" and v.goal_id == "G-0010" for v in violations)


def test_full_consistency_no_violations(tmp_path: Path) -> None:
    root = _seed_workspace(
        tmp_path,
        goals_md={
            "G-0010.md": _goal_md(
                "G-0010", realizes=[{"path": "src/Foo.cpp", "role": "core"}]
            ),
        },
        code_files={"src/Foo.cpp": "// @goal: G-0010\nvoid f() {}\n"},
    )
    goals = load_goals(root / "goals")
    code_index = scan_code_tags(root)
    violations = validate_bidirectional(goals, code_index, root)
    assert violations == []


def test_directory_goals_md_satisfies_c4(tmp_path: Path) -> None:
    """디렉토리 GOALS.md 가 Goal 을 가리키면 ``A.realizes`` 에 디렉토리(또는 그 하위) 가 있어야 한다."""

    root = _seed_workspace(
        tmp_path,
        goals_md={
            "G-0010.md": _goal_md(
                "G-0010", realizes=[{"path": "src", "role": "module"}]
            ),
        },
        code_files={
            "src/GOALS.md": "## Realizes\n- G-0010\n",
            "src/Foo.cpp": "void f() {}\n",
        },
    )
    goals = load_goals(root / "goals")
    code_index = scan_code_tags(root)
    violations = validate_bidirectional(goals, code_index, root)
    # C4 위반 없어야 한다 — 디렉토리 봉사로 충족.
    assert not any(v.condition == "C4" for v in violations)


def test_sync_realizes_dry_run(tmp_path: Path) -> None:
    root = _seed_workspace(
        tmp_path,
        goals_md={"G-0010.md": _goal_md("G-0010")},
        code_files={"src/Foo.cpp": "// @goal: G-0010\nvoid f() {}\n"},
    )
    goals = load_goals(root / "goals")
    code_index = scan_code_tags(root)
    actions = sync_realizes(goals, code_index, dry_run=True)
    assert len(actions) == 1
    assert actions[0].applied is False
    # 파일이 수정되지 않았는지 확인.
    text = (root / "goals" / "G-0010.md").read_text(encoding="utf-8")
    assert "src/Foo.cpp" not in text


def test_sync_realizes_writes_back(tmp_path: Path) -> None:
    root = _seed_workspace(
        tmp_path,
        goals_md={"G-0010.md": _goal_md("G-0010")},
        code_files={"src/Foo.cpp": "// @goal: G-0010\nvoid f() {}\n"},
    )
    goals = load_goals(root / "goals")
    code_index = scan_code_tags(root)
    actions = sync_realizes(goals, code_index, dry_run=False)
    assert len(actions) == 1
    assert actions[0].applied is True

    updated = parse_goal_file(root / "goals" / "G-0010.md")
    assert any(r["path"] == "src/Foo.cpp" and r["role"] == "TODO" for r in updated.realizes)
    # 본문이 보존되어야 한다.
    text = (root / "goals" / "G-0010.md").read_text(encoding="utf-8")
    assert "## Intent" in text
    assert "어떤 의도" in text


def test_sync_realizes_does_not_remove_existing(tmp_path: Path) -> None:
    """``sync-realizes`` 는 한쪽 방향만 — Goal 측에 있는 항목을 제거하지 않는다."""

    root = _seed_workspace(
        tmp_path,
        goals_md={
            "G-0010.md": _goal_md(
                "G-0010", realizes=[{"path": "src/Old.cpp", "role": "legacy"}]
            ),
        },
        code_files={"src/New.cpp": "// @goal: G-0010\nvoid f() {}\n"},
    )
    goals = load_goals(root / "goals")
    code_index = scan_code_tags(root)
    sync_realizes(goals, code_index, dry_run=False)
    updated = parse_goal_file(root / "goals" / "G-0010.md")
    paths = {r["path"] for r in updated.realizes}
    assert "src/Old.cpp" in paths  # 유지
    assert "src/New.cpp" in paths  # 추가
