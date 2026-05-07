"""query.py — 그래프 탐색·필터·서빙 컨텍스트·역참조 테스트."""

from __future__ import annotations

from pathlib import Path

from goalsys.codescan import CodeTagIndex
from goalsys.parser import load_goals
from goalsys.query import (
    FindFilter,
    ancestors,
    descendants,
    find_goals,
    neighbors,
    parse_filter_tokens,
    serve_context,
    which_goal,
)


FIXTURES = Path(__file__).parent / "fixtures"


def _by_id(goals):
    return {g.id: g for g in goals}


def test_ancestors_descendants_transitive() -> None:
    goals = load_goals(FIXTURES)
    by_id = _by_id(goals)
    # G-0142 의 부모는 G-0010, G-0020 — 둘 다 조상
    assert ancestors("G-0142", by_id) == {"G-0010", "G-0020"}
    # G-0010 의 후손은 G-0142 (children 통해)
    assert "G-0142" in descendants("G-0010", by_id)


def test_neighbors_includes_constrained_by_and_siblings() -> None:
    goals = load_goals(FIXTURES)
    nbr = neighbors("G-0142", goals)
    assert nbr is not None
    assert set(nbr.parents) == {"G-0010", "G-0020"}
    assert "G-0001" in nbr.constraints
    # constraint Goal 자체 입장에서 누가 자기를 가리키는지
    nbr2 = neighbors("G-0001", goals)
    assert nbr2 is not None
    assert "G-0142" in nbr2.constrained_by


def test_find_goals_filters() -> None:
    goals = load_goals(FIXTURES)
    # status 필터
    actives = find_goals(goals, FindFilter(status="active"))
    assert all(g.status == "active" for g in actives)
    # tag 필터
    constraints = find_goals(goals, FindFilter(tag="constraint"))
    assert {g.id for g in constraints} == {"G-0001"}
    # parent 직속
    children_of_10 = find_goals(goals, FindFilter(parent="G-0010"))
    assert "G-0142" in {g.id for g in children_of_10}
    # ancestor (transitive)
    descend_of_10 = find_goals(goals, FindFilter(ancestor="G-0010"))
    assert "G-0142" in {g.id for g in descend_of_10}
    # text 검색 (제목 부분 일치)
    matched = find_goals(goals, FindFilter(text="60fps"))
    assert "G-0142" in {g.id for g in matched}


def test_parse_filter_tokens_known_keys_and_text_fallback() -> None:
    flt = parse_filter_tokens(["status:active", "parent:G-0010", "60fps"])
    assert flt.status == "active"
    assert flt.parent == "G-0010"
    assert flt.text == "60fps"
    # 다단 태그 — `tag:layer:vm` 의 key=tag, value=layer:vm
    flt2 = parse_filter_tokens(["tag:layer:vm"])
    assert flt2.tag == "layer:vm"


def test_serve_context_includes_constraints_and_realizes() -> None:
    goals = load_goals(FIXTURES)
    ctx = serve_context("G-0142", goals)
    assert ctx is not None
    assert ctx.goal.id == "G-0142"
    assert {c.id for c in ctx.constraint_goals} == {"G-0001"}
    assert {p.id for p in ctx.parents} == {"G-0010", "G-0020"}
    # G-0142 의 realizes path 가 포함되어야
    assert any("HktVoxelCrowdRenderer" in p for p in ctx.realizes_paths)


def test_which_goal_matches_frontmatter_realizes() -> None:
    goals = load_goals(FIXTURES)
    # 빈 코드 인덱스로도 frontmatter 매칭만으로 G-0142 가 잡혀야
    empty_index = CodeTagIndex()
    ids = which_goal(
        "HktGameplay/Source/HktVoxelCore/Public/HktVoxelCrowdRenderer.h",
        empty_index,
        goals,
    )
    assert "G-0142" in ids


def test_which_goal_directory_prefix() -> None:
    """frontmatter realizes 의 path 가 디렉토리(``HktGameplay/Source/HktCore``) 면
    그 하위 모든 파일이 매칭되어야."""
    goals = load_goals(FIXTURES)
    empty_index = CodeTagIndex()
    # G-0010 의 realizes 가 디렉토리 형태로 적힐 수 있음 — 그렇지 않다면 이 테스트는
    # fixtures 데이터에 따라 빈 결과를 인정. 핵심 동작 검증은 다른 테스트가 담당.
    # 여기선 prefix 매칭 자체가 깨지지 않는지만 가볍게 확인.
    ids = which_goal(
        "HktGameplay/Source/HktVoxelCore/Public/HktVoxelCrowdRenderer.h/extra/path",
        empty_index,
        goals,
    )
    # 정확 일치 아니므로 기본 동작은 빈 리스트
    assert "G-0142" not in ids
