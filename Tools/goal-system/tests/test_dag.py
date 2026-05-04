"""Task 1.3 — DAG 무결성 검증 테스트."""

from __future__ import annotations

from pathlib import Path
from typing import List

from goalsys.dag import validate_dag
from goalsys.parser import Goal, load_goals


FIXTURES = Path(__file__).parent / "fixtures"


def _g(
    gid: str,
    *,
    parents: List[str] | None = None,
    children: List[str] | None = None,
    constraints: List[str] | None = None,
    status: str = "active",
    tags: List[str] | None = None,
    superseded_by: str | None = None,
) -> Goal:
    return Goal(
        id=gid,
        title=f"goal {gid}",
        status=status,
        created_at="2026-05-04",
        updated_at="2026-05-04",
        parents=list(parents or []),
        children=list(children or []),
        constraints=list(constraints or []),
        tags=list(tags or []),
        superseded_by=superseded_by,
        intent="x",
        success_criteria=[{"description": "x"}],
    )


def test_fixtures_pass_dag() -> None:
    goals = load_goals(FIXTURES)
    errors, warnings = validate_dag(goals)
    assert errors == [], errors


def test_referential_integrity_missing_id() -> None:
    goals = [
        _g("G-0010", children=["G-9999"], tags=["pillar:x"]),
    ]
    errors, _ = validate_dag(goals)
    assert any(e.rule == "ReferentialIntegrity" for e in errors)


def test_self_reference_in_parents() -> None:
    goals = [_g("G-0010", parents=["G-0010"], tags=["pillar:x"])]
    errors, _ = validate_dag(goals)
    assert any(e.rule == "ReferentialIntegrity" for e in errors)


def test_bidirectional_inconsistency() -> None:
    goals = [
        _g("G-0010", children=["G-0100"], tags=["pillar:x"]),
        _g("G-0100", parents=[]),  # parents 비어있어 양방향 깨짐
    ]
    errors, _ = validate_dag(goals)
    assert any(e.rule == "Bidirectional" for e in errors)


def test_acyclicity_detects_cycle() -> None:
    # G-0100 ↔ G-0200 양방향 children 으로 순환 형성.
    goals = [
        _g("G-0010", children=["G-0100"], tags=["pillar:x"]),
        _g("G-0100", parents=["G-0010", "G-0200"], children=["G-0200"]),
        _g("G-0200", parents=["G-0100"], children=["G-0100"]),
    ]
    errors, _ = validate_dag(goals)
    assert any(e.rule == "Acyclicity" for e in errors)


def test_no_orphans_pillar_allowed() -> None:
    goals = [_g("G-0010", tags=["pillar:x"])]
    errors, _ = validate_dag(goals)
    assert not any(e.rule == "NoOrphan" for e in errors)


def test_no_orphans_constraint_allowed() -> None:
    goals = [_g("G-0001", tags=["constraint"])]
    errors, _ = validate_dag(goals)
    assert not any(e.rule == "NoOrphan" for e in errors)


def test_no_orphans_general_goal_rejected() -> None:
    # G-1000 는 일반 ID 범위, parents 없으면 고아.
    goals = [_g("G-1000")]
    errors, _ = validate_dag(goals)
    assert any(e.rule == "NoOrphan" for e in errors)


def test_status_consistency_abandoned_with_active_child() -> None:
    goals = [
        _g("G-0010", children=["G-0100"], tags=["pillar:x"]),
        _g("G-0010b", children=["G-0100"], tags=["pillar:y"]),
        _g(
            "G-0010",
            children=["G-0100"],
            tags=["pillar:x"],
            status="abandoned",
        ),
    ]
    # 위 setup 은 동일 ID 가 두 번 들어가 있어 invalid — 별도로 깔끔히 작성.
    goals = [
        _g("G-0010", children=["G-0100"], tags=["pillar:x"], status="abandoned"),
        _g("G-0100", parents=["G-0010"], status="active"),
    ]
    errors, _ = validate_dag(goals)
    assert any(e.rule == "StatusConsistency" for e in errors)


def test_status_consistency_abandoned_with_reparented_child() -> None:
    goals = [
        _g("G-0010", children=["G-0100"], tags=["pillar:x"], status="abandoned"),
        _g("G-0011", children=["G-0100"], tags=["pillar:y"], status="active"),
        _g("G-0100", parents=["G-0010", "G-0011"], status="active"),
    ]
    errors, _ = validate_dag(goals)
    # 자식이 다른 활성 부모로 재배치되었으므로 StatusConsistency 위반 아님.
    assert not any(
        e.rule == "StatusConsistency" and "G-0100" in e.message for e in errors
    )


def test_achieved_without_marker_warns() -> None:
    goal = _g("G-0010", tags=["pillar:x"], status="achieved")
    # success_criteria 가 충족 표시 없음.
    _, warnings = validate_dag([goal])
    assert any(w.rule == "StatusConsistency" for w in warnings)


def test_constraint_target_must_be_constraint_goal() -> None:
    """R6 — ``constraints`` 가 가리키는 Goal 은 ``tags`` 에 ``constraint`` 가 있어야 한다."""

    goals = [
        _g("G-0001", tags=["constraint"]),  # 진짜 constraint
        _g("G-0010", tags=["pillar:x"]),    # constraint 가 아님
        _g("G-1000", parents=["G-0010"], constraints=["G-0010"]),  # 위반
    ]
    errors, _ = validate_dag(goals)
    assert any(e.rule == "ConstraintTarget" and e.goal_id == "G-1000" for e in errors)


def test_constraint_target_valid() -> None:
    goals = [
        _g("G-0001", tags=["constraint"]),
        _g("G-0010", tags=["pillar:x"]),
        _g("G-1000", parents=["G-0010"], constraints=["G-0001"]),
    ]
    errors, _ = validate_dag(goals)
    assert not any(e.rule == "ConstraintTarget" for e in errors)
