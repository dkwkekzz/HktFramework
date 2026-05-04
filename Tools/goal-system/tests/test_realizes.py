"""Task 2.1 — `realizes` 경로 실재성 검증 테스트."""

from __future__ import annotations

from pathlib import Path

from goalsys.parser import Goal
from goalsys.realizes import collect_realizes_paths, validate_realizes


def _goal(gid: str, paths: list[str] | None = None) -> Goal:
    return Goal(
        id=gid,
        title=f"goal {gid}",
        status="active",
        created_at="2026-05-04",
        updated_at="2026-05-04",
        intent="x",
        success_criteria=[{"description": "x"}],
        realizes=[{"path": p, "role": "x"} for p in (paths or [])],
    )


def test_validate_realizes_existing_file(tmp_path: Path) -> None:
    src = tmp_path / "Source/Module/File.cpp"
    src.parent.mkdir(parents=True)
    src.write_text("// hi\n", encoding="utf-8")

    g = _goal("G-0142", ["Source/Module/File.cpp"])
    errors = validate_realizes([g], tmp_path)
    assert errors == []


def test_validate_realizes_missing_file(tmp_path: Path) -> None:
    g = _goal("G-0142", ["Source/Module/Missing.cpp"])
    errors = validate_realizes([g], tmp_path)
    assert len(errors) == 1
    assert "Missing.cpp" in errors[0].path


def test_validate_realizes_directory_ok(tmp_path: Path) -> None:
    (tmp_path / "Source/Module").mkdir(parents=True)
    g = _goal("G-0150", ["Source/Module"])
    errors = validate_realizes([g], tmp_path)
    assert errors == []


def test_validate_realizes_glob(tmp_path: Path) -> None:
    (tmp_path / "Source/Module").mkdir(parents=True)
    (tmp_path / "Source/Module/A.cpp").write_text("", encoding="utf-8")
    (tmp_path / "Source/Module/B.cpp").write_text("", encoding="utf-8")

    g_ok = _goal("G-0160", ["Source/Module/*.cpp"])
    g_bad = _goal("G-0161", ["Source/Module/*.cs"])

    assert validate_realizes([g_ok], tmp_path) == []
    bad = validate_realizes([g_bad], tmp_path)
    assert len(bad) == 1


def test_validate_realizes_backslash_normalized(tmp_path: Path) -> None:
    src = tmp_path / "Source/Module/File.h"
    src.parent.mkdir(parents=True)
    src.write_text("", encoding="utf-8")
    g = _goal("G-0142", ["Source\\Module\\File.h"])
    assert validate_realizes([g], tmp_path) == []


def test_collect_realizes_paths() -> None:
    g = _goal("G-0142", ["A/B.cpp", "C/D.cpp"])
    out = collect_realizes_paths([g])
    assert out == {"G-0142": ["A/B.cpp", "C/D.cpp"]}


def test_validate_realizes_empty_realizes_skipped(tmp_path: Path) -> None:
    g = _goal("G-0010", [])
    assert validate_realizes([g], tmp_path) == []
