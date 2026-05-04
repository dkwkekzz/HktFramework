"""Task 2.2 — `@goal:` 인라인 태그 / `GOALS.md` 스캐너 테스트."""

from __future__ import annotations

from pathlib import Path

from goalsys.scanner import (
    DEFAULT_CODE_SUFFIXES,
    DEFAULT_EXCLUDE_DIRS,
    scan_repo,
    scan_text,
)


def test_scan_text_basic() -> None:
    text = """// @goal: G-0142 (대량 적 렌더링 60fps)
// @goal: G-0001 (결정성 보존)  // 제약
int x = 0; // @goal G-0150
"""
    tags = scan_text(text, "Foo.cpp")
    assert len(tags) == 3
    ids = sorted(t.goal_id for t in tags)
    assert ids == ["G-0001", "G-0142", "G-0150"]
    constraint_ids = [t.goal_id for t in tags if t.kind == "constraint"]
    assert constraint_ids == ["G-0001"]
    realizes_ids = sorted(t.goal_id for t in tags if t.kind == "realizes")
    assert realizes_ids == ["G-0142", "G-0150"]


def test_scan_text_ignores_garbage() -> None:
    text = "no tag here\n@goalfoo G-0001\n@goal G-12 (too short)\n"
    tags = scan_text(text)
    assert tags == []


def test_scan_repo_inline(tmp_path: Path) -> None:
    src = tmp_path / "Source/Module/File.cpp"
    src.parent.mkdir(parents=True)
    src.write_text("// @goal: G-0142\nvoid foo() {}\n", encoding="utf-8")

    tags = scan_repo(tmp_path)
    assert len(tags) == 1
    t = tags[0]
    assert t.goal_id == "G-0142"
    assert str(t.file_path).replace("\\", "/") == "Source/Module/File.cpp"
    assert t.line_no == 1
    assert t.source_kind == "inline"


def test_scan_repo_excludes_default_dirs(tmp_path: Path) -> None:
    # Saved 디렉토리는 기본 제외 — 그 안의 태그는 무시되어야 한다.
    saved = tmp_path / "Saved/cache.cpp"
    saved.parent.mkdir(parents=True)
    saved.write_text("// @goal: G-9999\n", encoding="utf-8")

    src = tmp_path / "Source/A.cpp"
    src.parent.mkdir(parents=True)
    src.write_text("// @goal: G-0010\n", encoding="utf-8")

    tags = scan_repo(tmp_path)
    ids = [t.goal_id for t in tags]
    assert "G-9999" not in ids
    assert "G-0010" in ids


def test_scan_repo_filters_by_suffix(tmp_path: Path) -> None:
    txt = tmp_path / "notes.txt"
    txt.write_text("// @goal: G-0001\n", encoding="utf-8")
    cs = tmp_path / "App.cs"
    cs.write_text("// @goal: G-0002\n", encoding="utf-8")

    tags = scan_repo(tmp_path)
    ids = sorted(t.goal_id for t in tags)
    assert ids == ["G-0002"]  # .txt 는 기본 확장자 외 → 제외


def test_scan_repo_goals_md(tmp_path: Path) -> None:
    md = tmp_path / "Source/HktVoxelCore/GOALS.md"
    md.parent.mkdir(parents=True)
    md.write_text(
        """# Module: HktVoxelCore

## Realizes
- G-0142: 대량 적 렌더링 60fps
- G-0150: 청크 단위 가시 영역 관리

## Respects (Constraints)
- G-0003: UE5는 표현 계층
""",
        encoding="utf-8",
    )

    tags = scan_repo(tmp_path)
    by_kind = {(t.goal_id, t.kind, t.source_kind) for t in tags}
    assert ("G-0142", "realizes", "goals_md") in by_kind
    assert ("G-0150", "realizes", "goals_md") in by_kind
    assert ("G-0003", "constraint", "goals_md") in by_kind


def test_scan_repo_disable_goals_md(tmp_path: Path) -> None:
    md = tmp_path / "GOALS.md"
    md.write_text("## Realizes\n- G-0142\n", encoding="utf-8")
    tags = scan_repo(tmp_path, include_goals_md=False)
    assert tags == []


def test_default_constants_consistent() -> None:
    # 회귀 방지 — 기본값이 사라지면 설계와 어긋남.
    assert ".cpp" in DEFAULT_CODE_SUFFIXES
    assert ".h" in DEFAULT_CODE_SUFFIXES
    assert "Saved" in DEFAULT_EXCLUDE_DIRS
    assert ".git" in DEFAULT_EXCLUDE_DIRS
