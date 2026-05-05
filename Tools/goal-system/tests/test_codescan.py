"""Phase 2 — `scan-code-tags` 테스트."""

from __future__ import annotations

from pathlib import Path

from goalsys.codescan import (
    extract_header_tags,
    parse_goals_md,
    scan_code_tags,
)


def test_header_tag_extracted_from_cpp_comment() -> None:
    text = (
        "// @goal: G-0142\n"
        "// @goal: G-0001\n"
        "#include <something>\n"
        "void code() { /* @goal: G-9999 — 본문이라 무시 */ }\n"
    )
    tags = extract_header_tags(text)
    assert tags == ["G-0142", "G-0001"]


def test_header_tag_python_comment() -> None:
    text = (
        "# @goal: G-0142\n"
        '"""module docstring"""\n'
        "import os  # @goal: G-9999 — 헤더 종료 후라 인식되지 말아야 한다\n"
    )
    tags = extract_header_tags(text)
    assert tags == ["G-0142"]


def test_header_tag_stops_at_first_code_line() -> None:
    text = (
        "// @goal: G-0001\n"
        "int main() { return 0; }\n"
        "// @goal: G-9999\n"
    )
    tags = extract_header_tags(text)
    assert tags == ["G-0001"]


def test_no_header_tags_returns_empty() -> None:
    assert extract_header_tags("int main() {}\n") == []


def test_parse_goals_md_realizes_section() -> None:
    text = (
        "# Module: HktVoxelCore\n\n"
        "## Realizes\n"
        "- G-0142\n"
        "- G-0150\n\n"
        "## Respects\n"
        "- G-0001\n"
    )
    assert parse_goals_md(text) == ["G-0142", "G-0150"]


def test_parse_goals_md_handles_missing_section() -> None:
    assert parse_goals_md("# nothing here\n## Respects\n- G-0001\n") == []


def test_scan_walks_directory_and_finds_tags(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "Foo.cpp").write_text(
        "// @goal: G-0142\n#include <h>\nvoid f() {}\n", encoding="utf-8")
    (tmp_path / "src" / "Bar.cpp").write_text("void g() {}\n", encoding="utf-8")
    (tmp_path / "src" / "GOALS.md").write_text(
        "## Realizes\n- G-0001\n", encoding="utf-8")

    index = scan_code_tags(tmp_path)
    assert index.file_tags == {"src/Foo.cpp": ["G-0142"]}
    assert index.dir_tags == {"src": ["G-0001"]}


def test_scan_skips_ignored_directories(tmp_path: Path) -> None:
    (tmp_path / "Binaries").mkdir()
    (tmp_path / "Binaries" / "X.cpp").write_text(
        "// @goal: G-9999\nvoid x() {}\n", encoding="utf-8")
    (tmp_path / "Intermediate").mkdir()
    (tmp_path / "Intermediate" / "Y.cpp").write_text(
        "// @goal: G-9999\nvoid y() {}\n", encoding="utf-8")

    index = scan_code_tags(tmp_path)
    assert index.file_tags == {}


def test_scan_ignores_non_code_extensions(tmp_path: Path) -> None:
    (tmp_path / "image.png").write_bytes(b"\x89PNG fake")
    (tmp_path / "docs.txt").write_text("@goal: G-9999\n", encoding="utf-8")
    index = scan_code_tags(tmp_path)
    assert index.file_tags == {}


def test_tags_for_combines_file_and_dir(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "GOALS.md").write_text(
        "## Realizes\n- G-0001\n", encoding="utf-8")
    (tmp_path / "src" / "Foo.cpp").write_text(
        "// @goal: G-0142\nvoid f() {}\n", encoding="utf-8")
    index = scan_code_tags(tmp_path)
    # 파일 헤더 태그 + 부모 디렉토리 GOALS.md 태그가 합쳐진다.
    assert index.tags_for("src/Foo.cpp") == ["G-0142", "G-0001"]
