"""Phase 4 — `verify-goal` 테스트."""

from __future__ import annotations

from pathlib import Path

import pytest

from goalsys.parser import parse_goal_file
from goalsys.verify import (
    register_measure_handler,
    reset_measure_handlers,
    verify_goal,
)


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _reset_handlers():
    reset_measure_handlers()
    yield
    reset_measure_handlers()


def test_unmeasurable_criterion_marked_manual() -> None:
    goal = parse_goal_file(FIXTURES / "G-0142.md")
    report = verify_goal(goal)
    # 핸들러 미등록 — 모든 항목 manual_required.
    for crit in report.criteria:
        assert crit["result"] == "manual_required"
    assert report.summary["passed"] == 0
    assert report.summary["failed"] == 0
    assert report.summary["total"] == len(goal.success_criteria)


def test_handler_invoked_on_match() -> None:
    """``measure`` 텍스트가 패턴에 매칭되면 핸들러 결과 사용."""

    register_measure_handler(
        r"stat unit",
        lambda goal, sc: {"result": "pass", "current_value": "15.4ms"},
    )
    goal = parse_goal_file(FIXTURES / "G-0142.md")
    report = verify_goal(goal)
    # G-0142 는 'UE5 stat unit' 측정 — 매칭됨.
    matched = [c for c in report.criteria if "stat unit" in (c.get("measure") or "")]
    assert matched
    for crit in matched:
        assert crit["result"] == "pass"
        assert crit["current_value"] == "15.4ms"
        assert crit["automated"] is True


def test_summary_counts() -> None:
    # G-0142 의 measure: "UE5 stat unit, 5분 평균" / "UE5 stat unit, 1% low".
    # 두 핸들러를 등록하되 첫 매칭이 우선이므로, 더 구체적인 패턴을 먼저 등록.
    register_measure_handler(
        r"1% low",
        lambda goal, sc: {"result": "fail", "current_value": "30ms"},
    )
    register_measure_handler(
        r"5분 평균",
        lambda goal, sc: {"result": "pass"},
    )
    goal = parse_goal_file(FIXTURES / "G-0142.md")
    report = verify_goal(goal)
    assert report.summary["passed"] == 1
    assert report.summary["failed"] == 1
    assert report.summary["total"] == 2


def test_status_is_not_modified() -> None:
    """verify-goal 은 status 를 변경하지 않는다 (도구 §6.3)."""

    goal = parse_goal_file(FIXTURES / "G-0142.md")
    original_status = goal.status
    verify_goal(goal)
    assert goal.status == original_status
