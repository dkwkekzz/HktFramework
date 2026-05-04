"""Task 1.1 — 파서 테스트."""

from __future__ import annotations

from pathlib import Path

import pytest

from goalsys.parser import GoalParseError, parse_goal_file, parse_goal_text, load_goals


FIXTURES = Path(__file__).parent / "fixtures"


def test_parses_pillar_goal() -> None:
    goal = parse_goal_file(FIXTURES / "G-0010.md")
    assert goal.id == "G-0010"
    assert goal.title.startswith("플레이어가")
    assert goal.status == "active"
    assert goal.parents == []
    assert "G-0142" in goal.children
    assert goal.tags == ["pillar:exploration"]
    assert "미지의" in goal.intent or "미지(未知)" in goal.intent
    assert len(goal.success_criteria) == 2
    assert goal.success_criteria[0]["measurable"] is True


def test_parses_multi_parent_goal() -> None:
    goal = parse_goal_file(FIXTURES / "G-0142.md")
    assert goal.parents == ["G-0010", "G-0020"]
    assert goal.constraints == ["G-0001"]
    assert goal.realizes[0]["path"].endswith("HktVoxelCrowdRenderer.h")
    assert len(goal.alternatives_considered) == 1
    assert "UE5 Mass" in goal.alternatives_considered[0]["option"]


def test_parses_constraint_goal() -> None:
    goal = parse_goal_file(FIXTURES / "G-0001.md")
    assert "constraint" in goal.tags
    assert goal.parents == []
    assert goal.children == []


def test_load_goals_finds_all_fixtures() -> None:
    goals = load_goals(FIXTURES)
    ids = {g.id for g in goals}
    assert {"G-0001", "G-0010", "G-0020", "G-0142"} <= ids


def test_missing_frontmatter_raises() -> None:
    with pytest.raises(GoalParseError):
        parse_goal_text("no frontmatter here")


def test_malformed_frontmatter_raises() -> None:
    text = "---\nid: G-0001\ntitle: [unclosed\n---\n"
    with pytest.raises(GoalParseError):
        parse_goal_text(text)


def test_empty_success_criteria_section_yields_empty_list() -> None:
    text = (
        "---\n"
        "id: G-0099\n"
        "title: t\n"
        "status: proposed\n"
        "created_at: 2026-05-04\n"
        "updated_at: 2026-05-04\n"
        "---\n"
        "## Intent\nx\n## Success Criteria\n\n"
    )
    goal = parse_goal_text(text)
    assert goal.success_criteria == []


def test_frontmatter_must_be_mapping() -> None:
    text = "---\n- not\n- a\n- mapping\n---\n## Intent\nx\n"
    with pytest.raises(GoalParseError):
        parse_goal_text(text)
