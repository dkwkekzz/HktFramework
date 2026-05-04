"""CLI 통합 테스트."""

from __future__ import annotations

import json
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


# ---------------------------------------------------------------------------
# Phase 2 명령들 — check-realizes / scan-tags / check-consistency
# ---------------------------------------------------------------------------


def _setup_repo(tmp_path: Path) -> tuple[Path, Path]:
    """tmp_path 안에 'repo/Docs/goals/' + 코드 파일 한 벌을 만든다."""

    repo = tmp_path / "repo"
    goals_dir = repo / "Docs/goals"
    goals_dir.mkdir(parents=True)

    (goals_dir / "G-0010.md").write_text(
        """---
id: G-0010
title: 모험심
status: active
created_at: 2026-05-04
updated_at: 2026-05-04
parents: []
children: [G-0142]
tags: [pillar:exploration]
---

## Intent
탐험.

## Success Criteria
- description: 탐험 만족도
""",
        encoding="utf-8",
    )
    (goals_dir / "G-0142.md").write_text(
        """---
id: G-0142
title: 200+ 적 60fps
status: active
created_at: 2026-05-04
updated_at: 2026-05-04
parents: [G-0010]
realizes:
  - path: Source/Module/Crowd.cpp
    role: 대량 렌더
tags: [layer:rendering]
---

## Intent
대량 렌더.

## Success Criteria
- description: 60fps 유지
""",
        encoding="utf-8",
    )
    code = repo / "Source/Module/Crowd.cpp"
    code.parent.mkdir(parents=True)
    code.write_text("// @goal: G-0142\nvoid f(){}\n", encoding="utf-8")
    return repo, goals_dir


def test_check_realizes_passes(tmp_path: Path, capsys) -> None:
    repo, goals_dir = _setup_repo(tmp_path)
    rc = main(["check-realizes", str(goals_dir), "--repo-root", str(repo)])
    assert rc == 0
    assert "OK" in capsys.readouterr().out


def test_check_realizes_fails_on_missing(tmp_path: Path) -> None:
    repo, goals_dir = _setup_repo(tmp_path)
    (repo / "Source/Module/Crowd.cpp").unlink()
    rc = main(["check-realizes", str(goals_dir), "--repo-root", str(repo)])
    assert rc == 1


def test_scan_tags_text_output(tmp_path: Path, capsys) -> None:
    repo, _ = _setup_repo(tmp_path)
    rc = main(["scan-tags", str(repo)])
    assert rc == 0
    captured = capsys.readouterr()
    assert "G-0142" in captured.out


def test_scan_tags_json_output(tmp_path: Path, capsys) -> None:
    repo, _ = _setup_repo(tmp_path)
    rc = main(["scan-tags", str(repo), "--json"])
    assert rc == 0
    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert any(item["goal_id"] == "G-0142" for item in payload)


def test_check_consistency_passes(tmp_path: Path, capsys) -> None:
    repo, goals_dir = _setup_repo(tmp_path)
    rc = main(["check-consistency", str(goals_dir), "--repo-root", str(repo)])
    assert rc == 0
    assert "OK" in capsys.readouterr().out


def test_check_consistency_fails_on_unknown_tag(tmp_path: Path) -> None:
    repo, goals_dir = _setup_repo(tmp_path)
    rogue = repo / "Source/Module/Rogue.cpp"
    rogue.write_text("// @goal: G-9999\n", encoding="utf-8")
    rc = main(["check-consistency", str(goals_dir), "--repo-root", str(repo)])
    assert rc == 1


def test_check_consistency_strict_warns(tmp_path: Path) -> None:
    repo, goals_dir = _setup_repo(tmp_path)
    # 코드의 @goal 태그를 지워 MissingTag 경고만 발생시킨다.
    (repo / "Source/Module/Crowd.cpp").write_text("void f(){}\n", encoding="utf-8")
    rc_default = main(["check-consistency", str(goals_dir), "--repo-root", str(repo)])
    assert rc_default == 0  # 경고만 → 통과
    rc_strict = main([
        "check-consistency", str(goals_dir), "--repo-root", str(repo), "--strict",
    ])
    assert rc_strict == 1
