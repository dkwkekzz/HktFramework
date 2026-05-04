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


def test_scan_code_tags_outputs(tmp_path, capsys) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "Foo.cpp").write_text(
        "// @goal: G-0142\nvoid f() {}\n", encoding="utf-8")
    rc = main(["scan-code-tags", str(tmp_path)])
    assert rc == 0
    out = capsys.readouterr().out
    assert "src/Foo.cpp" in out
    assert "G-0142" in out


def test_validate_bidirectional_reports_violations(tmp_path, capsys) -> None:
    goals_dir = tmp_path / "goals"
    goals_dir.mkdir()
    (goals_dir / "G-0010.md").write_text(
        "---\nid: G-0010\ntitle: t\nstatus: active\n"
        "created_at: 2026-05-04\nupdated_at: 2026-05-04\n"
        "parents: []\nchildren: []\nconstraints: []\n"
        "tags: [pillar:test]\n"
        "---\n## Intent\nx\n## Success Criteria\n- description: x\n  measurable: false\n",
        encoding="utf-8",
    )
    src = tmp_path / "src"
    src.mkdir()
    (src / "Foo.cpp").write_text("// @goal: G-0010\nvoid f() {}\n", encoding="utf-8")

    rc = main(["validate-bidirectional", str(goals_dir), str(tmp_path)])
    assert rc == 0  # 위반 있어도 기본은 0 (도구 §5.2: warning)
    err = capsys.readouterr().err
    assert "Bidirectional" in err

    rc_strict = main(["validate-bidirectional", str(goals_dir), str(tmp_path), "--strict"])
    assert rc_strict == 1


def test_sync_realizes_dry_run(tmp_path, capsys) -> None:
    goals_dir = tmp_path / "goals"
    goals_dir.mkdir()
    (goals_dir / "G-0010.md").write_text(
        "---\nid: G-0010\ntitle: t\nstatus: active\n"
        "created_at: 2026-05-04\nupdated_at: 2026-05-04\n"
        "parents: []\nchildren: []\nconstraints: []\n"
        "tags: [pillar:test]\n"
        "---\n## Intent\nx\n## Success Criteria\n- description: x\n  measurable: false\n",
        encoding="utf-8",
    )
    (tmp_path / "Foo.cpp").write_text(
        "// @goal: G-0010\nvoid f() {}\n", encoding="utf-8")

    rc = main(["sync-realizes", str(goals_dir), str(tmp_path), "--dry-run"])
    assert rc == 0
    # 드라이런이므로 파일 미수정.
    text = (goals_dir / "G-0010.md").read_text(encoding="utf-8")
    assert "Foo.cpp" not in text


def test_next_id_command(tmp_path, capsys) -> None:
    rc = main(["next-id", "system", str(tmp_path)])
    assert rc == 0
    assert capsys.readouterr().out.strip() == "G-0100"


def test_new_goal_command(tmp_path) -> None:
    rc = main([
        "new-goal", "system", str(tmp_path),
        "--title", "테스트", "--tags", "pillar:test",
    ])
    assert rc == 0
    assert (tmp_path / "G-0100.md").exists()


def test_verify_goal_command(tmp_path, capsys) -> None:
    for f in FIXTURES.glob("*.md"):
        shutil.copy(f, tmp_path / f.name)
    rc = main(["verify-goal", "G-0142", str(tmp_path)])
    assert rc == 0
    out = capsys.readouterr().out
    assert "G-0142 검증 결과" in out
