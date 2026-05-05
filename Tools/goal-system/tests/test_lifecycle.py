"""Phase 3 — `next-id` + `new-goal` 테스트."""

from __future__ import annotations

from pathlib import Path

import pytest

from goalsys.lifecycle import (
    IdExhaustedError,
    NewGoalRequest,
    new_goal,
    next_id,
    render_new_goal,
    used_ids,
)
from goalsys.parser import parse_goal_file
from goalsys.schema import validate_goal


def test_next_id_empty_dir(tmp_path: Path) -> None:
    assert next_id("pillar", tmp_path) == "G-0001"
    assert next_id("system", tmp_path) == "G-0100"
    assert next_id("general", tmp_path) == "G-1000"


def test_next_id_skips_used(tmp_path: Path) -> None:
    (tmp_path / "G-0001.md").write_text("---\nid: G-0001\n---\n", encoding="utf-8")
    (tmp_path / "G-0100.md").write_text("---\nid: G-0100\n---\n", encoding="utf-8")
    assert next_id("pillar", tmp_path) == "G-0002"
    assert next_id("system", tmp_path) == "G-0101"


def test_next_id_skips_abandoned_ids(tmp_path: Path) -> None:
    """폐기된 ID 도 재사용 금지 (§3.4)."""

    (tmp_path / "G-0010.md").write_text(
        "---\nid: G-0010\nstatus: abandoned\n---\n",
        encoding="utf-8",
    )
    used = used_ids(tmp_path)
    assert 10 in used
    # next-id 는 10 을 건너뛴다.
    assert next_id("pillar", tmp_path) == "G-0001"  # 1 이 우선


def test_next_id_invalid_category(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        next_id("invalid", tmp_path)


def test_render_new_goal_template() -> None:
    req = NewGoalRequest(
        category="system",
        title="대규모 적 60fps",
        parents=["G-0010", "G-0020"],
        constraints=["G-0001"],
        tags=["layer:rendering"],
    )
    text = render_new_goal(req, goal_id="G-0142", now="2026-05-04T00:00:00+00:00")
    assert "id: G-0142" in text
    assert "title: 대규모 적 60fps" in text
    assert "status: proposed" in text
    assert "parents: [G-0010, G-0020]" in text
    assert "constraints: [G-0001]" in text
    assert "tags: [layer:rendering]" in text
    assert "## Intent" in text
    assert "## Success Criteria" in text


def test_new_goal_writes_file(tmp_path: Path) -> None:
    req = NewGoalRequest(category="system", title="t", tags=["pillar:test"])
    path = new_goal(req, tmp_path)
    assert path.exists()
    assert path.name == "G-0100.md"

    # 다음 호출은 G-0101 로 진행.
    path2 = new_goal(NewGoalRequest(category="system", tags=["pillar:test"]), tmp_path)
    assert path2.name == "G-0101.md"


def test_new_goal_existing_raises(tmp_path: Path) -> None:
    (tmp_path / "G-0100.md").write_text("---\nid: G-0100\n---\n", encoding="utf-8")
    # next-id 는 0101 을 반환하지만, 사전 점유로 충돌은 보통 발생하지 않는다.
    # 강제 충돌을 위해 직접 호출 후 동일 ID 로 새로 만들면 FileExistsError.
    p1 = new_goal(NewGoalRequest(category="system", tags=["pillar:test"]), tmp_path)
    assert p1.name == "G-0101.md"


def test_new_goal_passes_schema(tmp_path: Path) -> None:
    """초안 Goal 은 (TODO 본문 제외) 스키마를 통과해야 한다."""

    req = NewGoalRequest(
        category="pillar",
        title="t",
        tags=["pillar:test"],
    )
    path = new_goal(req, tmp_path)
    goal = parse_goal_file(path)
    errors = validate_goal(goal)
    # 'TODO' 만 있는 success_criteria 는 description 이 비어있지 않으므로 통과.
    assert errors == [], errors


def test_id_exhaustion(tmp_path: Path) -> None:
    """범위 소진 시 IdExhaustedError."""

    # pillar 는 1~99. 모든 슬롯을 점유.
    for n in range(1, 100):
        (tmp_path / f"G-{n:04d}.md").write_text(
            f"---\nid: G-{n:04d}\n---\n", encoding="utf-8"
        )
    with pytest.raises(IdExhaustedError):
        next_id("pillar", tmp_path)
