"""Goal 시스템 도구 패키지.

Docs/goal-system-design.md / Docs/goal-system-tooling.md 명세 구현체.

Phase 1 — 파서·스키마·DAG·뷰 (parse / validate-schema / validate-dag /
render-index / render-tree / render-graph).
Phase 2 — 코드 ↔ Goal 양방향 연결 (scan-code-tags / validate-bidirectional).
Phase 3 — 라이프사이클 보조 (next-id / new-goal).
Phase 4 — 자동화 (sync-realizes / verify-goal).
"""

from .parser import Goal, GoalParseError, parse_goal_file, parse_goal_text, load_goals
from .schema import SchemaError, validate_goal, validate_goals
from .dag import DagError, DagWarning, validate_dag
from .views import generate_index, generate_tree, generate_graph
from .codescan import (
    CodeTagIndex,
    extract_header_tags,
    normalize_rel,
    parse_goals_md,
    scan_code_tags,
)
from .bidirectional import (
    BidirectionalViolation,
    Condition,
    SyncAction,
    sync_realizes,
    validate_bidirectional,
)
from .lifecycle import (
    Category,
    IdExhaustedError,
    NewGoalRequest,
    new_goal,
    next_id,
    render_new_goal,
    used_ids,
)
from .verify import (
    MeasureHandler,
    VerifyReport,
    format_report,
    register_measure_handler,
    reset_measure_handlers,
    verify_goal,
    verify_goals,
)

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
    # codescan
    "CodeTagIndex",
    "extract_header_tags",
    "normalize_rel",
    "parse_goals_md",
    "scan_code_tags",
    # bidirectional
    "BidirectionalViolation",
    "Condition",
    "SyncAction",
    "sync_realizes",
    "validate_bidirectional",
    # lifecycle
    "Category",
    "IdExhaustedError",
    "NewGoalRequest",
    "new_goal",
    "next_id",
    "render_new_goal",
    "used_ids",
    # verify
    "MeasureHandler",
    "VerifyReport",
    "format_report",
    "register_measure_handler",
    "reset_measure_handlers",
    "verify_goal",
    "verify_goals",
]
