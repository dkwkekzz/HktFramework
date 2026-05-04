"""Goal 시스템 — Phase 1: 스키마 및 검증기.

Docs/goal-system-design.md 9.1 절 명세 구현체.
"""

from .parser import Goal, GoalParseError, parse_goal_file, parse_goal_text, load_goals
from .schema import SchemaError, validate_goal, validate_goals
from .dag import DagError, DagWarning, validate_dag
from .views import generate_index, generate_tree, generate_graph

__all__ = [
    "Goal",
    "GoalParseError",
    "parse_goal_file",
    "parse_goal_text",
    "load_goals",
    "SchemaError",
    "validate_goal",
    "validate_goals",
    "DagError",
    "DagWarning",
    "validate_dag",
    "generate_index",
    "generate_tree",
    "generate_graph",
]
