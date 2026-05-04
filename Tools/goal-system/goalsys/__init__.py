"""Goal 시스템 — Phase 1 (스키마/DAG/뷰) + Phase 2 (코드 ↔ Goal 연결).

Docs/goal-system-design.md §9.1 / §9.2 명세 구현체.
"""

from .parser import Goal, GoalParseError, parse_goal_file, parse_goal_text, load_goals
from .schema import SchemaError, validate_goal, validate_goals
from .dag import DagError, DagWarning, validate_dag
from .views import generate_index, generate_tree, generate_graph
from .realizes import RealizesError, validate_realizes, collect_realizes_paths
from .scanner import (
    CodeTag,
    DEFAULT_CODE_SUFFIXES,
    DEFAULT_EXCLUDE_DIRS,
    scan_repo,
    scan_text,
)
from .consistency import ConsistencyIssue, check_consistency

__all__ = [
    # parser
    "Goal",
    "GoalParseError",
    "parse_goal_file",
    "parse_goal_text",
    "load_goals",
    # schema
    "SchemaError",
    "validate_goal",
    "validate_goals",
    # dag
    "DagError",
    "DagWarning",
    "validate_dag",
    # views
    "generate_index",
    "generate_tree",
    "generate_graph",
    # phase 2 — realizes
    "RealizesError",
    "validate_realizes",
    "collect_realizes_paths",
    # phase 2 — scanner
    "CodeTag",
    "DEFAULT_CODE_SUFFIXES",
    "DEFAULT_EXCLUDE_DIRS",
    "scan_repo",
    "scan_text",
    # phase 2 — consistency
    "ConsistencyIssue",
    "check_consistency",
]
