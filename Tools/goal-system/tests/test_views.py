"""Task 1.4 — 자동 생성 뷰 테스트."""

from __future__ import annotations

from pathlib import Path

from goalsys.parser import load_goals
from goalsys.views import generate_graph, generate_index, generate_tree


FIXTURES = Path(__file__).parent / "fixtures"


def test_index_lists_pillars_and_multi_parent_marker() -> None:
    goals = load_goals(FIXTURES)
    index = generate_index(goals, generated_at="2026-05-04T00:00:00")
    assert "## By Pillar" in index
    assert "G-0010" in index
    assert "G-0020" in index
    # G-0142 는 두 Pillar 모두에 등장하고 'also under' 마커가 붙어야 한다.
    assert "G-0142" in index
    assert "also under" in index


def test_index_groups_by_status_and_tag() -> None:
    goals = load_goals(FIXTURES)
    index = generate_index(goals, generated_at="2026-05-04T00:00:00")
    assert "## By Status" in index
    assert "Active" in index
    assert "## By Tag" in index
    assert "pillar:exploration" in index
    assert "constraint" in index


def test_tree_renders_hierarchy_and_dedups_multi_parent() -> None:
    goals = load_goals(FIXTURES)
    tree = generate_tree(goals, generated_at="2026-05-04T00:00:00")
    # 첫 등장은 펼치고, 두 번째는 참조만 → 'G-0142' 단어 자체는 두 번 이상 등장 가능하나
    # '→' 기호로 시작하는 참조 라인이 정확히 1번 있어야 한다.
    ref_lines = [ln for ln in tree.splitlines() if "→ G-0142" in ln]
    assert len(ref_lines) == 1


def test_tree_lists_constraints_section() -> None:
    goals = load_goals(FIXTURES)
    tree = generate_tree(goals, generated_at="2026-05-04T00:00:00")
    assert "Constraints" in tree
    assert "G-0001" in tree


def test_graph_emits_mermaid_with_edges_and_classes() -> None:
    goals = load_goals(FIXTURES)
    graph = generate_graph(goals, generated_at="2026-05-04T00:00:00")
    assert graph.startswith("%% 자동 생성") or "graph TD" in graph
    assert "graph TD" in graph
    # parent → child 엣지.
    assert "G0010 --> G0142" in graph
    assert "G0020 --> G0142" in graph
    # 제약 점선 엣지 (G-0001 -. 제약 .-> G-0142).
    assert "G0001 -. 제약 .-> G0142" in graph
    # classDef 정의.
    assert "classDef pillar" in graph
    assert "classDef constraint" in graph


def test_views_handle_empty_goal_set() -> None:
    # 빈 입력에서도 예외 없이 문자열을 반환해야 한다.
    assert "Goals Index" in generate_index([], generated_at="2026-05-04T00:00:00")
    assert "Goal Tree" in generate_tree([], generated_at="2026-05-04T00:00:00")
    assert "graph TD" in generate_graph([], generated_at="2026-05-04T00:00:00")
