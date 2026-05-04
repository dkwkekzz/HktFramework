"""Task 1.2 — 스키마 검증 테스트."""

from __future__ import annotations

from pathlib import Path

from goalsys.parser import parse_goal_file, parse_goal_text
from goalsys.schema import validate_goal


FIXTURES = Path(__file__).parent / "fixtures"


def _make_goal_text(**override: str) -> str:
    base = {
        "id": "G-0050",
        "title": "테스트 Goal",
        "status": "active",
        "created_at": "2026-05-04T00:00:00+09:00",
        "updated_at": "2026-05-04T00:00:00+09:00",
        "tags": "[pillar:test]",
    }
    base.update(override)
    fm = "\n".join(f"{k}: {v}" for k, v in base.items())
    return (
        f"---\n{fm}\n---\n\n"
        "## Intent\n어떤 의도\n\n"
        "## Success Criteria\n"
        "- description: 어떤 조건\n  measurable: true\n"
    )


def test_valid_fixture_passes() -> None:
    goal = parse_goal_file(FIXTURES / "G-0142.md")
    assert validate_goal(goal) == []


def test_all_fixtures_pass_schema() -> None:
    for name in ["G-0001.md", "G-0010.md", "G-0020.md", "G-0142.md"]:
        goal = parse_goal_file(FIXTURES / name)
        errors = validate_goal(goal)
        assert errors == [], f"{name}: {errors}"


def test_bad_id_format() -> None:
    goal = parse_goal_text(_make_goal_text(id="GOAL-1"))
    errors = validate_goal(goal)
    assert any(e.field == "id" for e in errors)


def test_bad_status() -> None:
    goal = parse_goal_text(_make_goal_text(status="cool"))
    errors = validate_goal(goal)
    assert any(e.field == "status" for e in errors)


def test_long_title_rejected() -> None:
    goal = parse_goal_text(_make_goal_text(title="x" * 81))
    errors = validate_goal(goal)
    assert any(e.field == "title" for e in errors)


def test_missing_intent_rejected() -> None:
    text = (
        "---\nid: G-0051\ntitle: t\nstatus: active\n"
        "created_at: 2026-05-04\nupdated_at: 2026-05-04\n---\n"
        "## Success Criteria\n- description: x\n  measurable: true\n"
    )
    goal = parse_goal_text(text)
    errors = validate_goal(goal)
    assert any(e.field == "intent" for e in errors)


def test_superseded_requires_superseded_by() -> None:
    text = (
        "---\nid: G-0052\ntitle: t\nstatus: superseded\n"
        "created_at: 2026-05-04\nupdated_at: 2026-05-04\n---\n## Intent\nx\n"
    )
    goal = parse_goal_text(text)
    errors = validate_goal(goal)
    assert any(e.field == "superseded_by" for e in errors)


def test_active_without_success_criteria_rejected() -> None:
    text = (
        "---\nid: G-0053\ntitle: t\nstatus: active\n"
        "created_at: 2026-05-04\nupdated_at: 2026-05-04\n---\n## Intent\nx\n"
    )
    goal = parse_goal_text(text)
    errors = validate_goal(goal)
    assert any(e.field == "success_criteria" for e in errors)


def test_bad_iso_date() -> None:
    goal = parse_goal_text(_make_goal_text(created_at="not-a-date"))
    errors = validate_goal(goal)
    assert any(e.field == "created_at" for e in errors)
