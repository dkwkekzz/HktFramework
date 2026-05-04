"""CLI 통합 테스트."""

from __future__ import annotations

import shutil
from pathlib import Path

from goalsys.cli import main


FIXTURES = Path(__file__).parent / "fixtures"


def test_validate_passes_on_fixtures(capsys) -> None:
    rc = main(["validate", str(FIXTURES)])
    assert rc == 0
    captured = capsys.readouterr()
    assert "OK" in captured.out


def test_validate_fails_on_dangling_reference(tmp_path, capsys) -> None:
    # 픽스처 디렉토리에 원본 보존 — tmp_path 로 복사 후 한 파일에 dangling ref 추가.
    for f in FIXTURES.glob("*.md"):
        shutil.copy(f, tmp_path / f.name)
    bad = tmp_path / "G-0010.md"
    text = bad.read_text(encoding="utf-8").replace(
        "children: [G-0142]",
        "children: [G-0142, G-9999]",
    )
    bad.write_text(text, encoding="utf-8")

    rc = main(["validate", str(tmp_path)])
    assert rc == 1


def test_build_views_writes_three_files(tmp_path) -> None:
    for f in FIXTURES.glob("*.md"):
        shutil.copy(f, tmp_path / f.name)

    rc = main(["build-views", str(tmp_path)])
    assert rc == 0
    assert (tmp_path / "INDEX.md").exists()
    assert (tmp_path / "TREE.md").exists()
    assert (tmp_path / "graph.mmd").exists()
