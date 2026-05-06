"""Task 1.2 — Goal 스키마 검증.

설계 §3 (필수/관계/선택 필드), §3.4 (ID 규칙) 명세 검증.
오류는 한 파일당 여러 개를 모아 보고하기 위해 :class:`SchemaError` 리스트로 반환한다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable, List, Optional

from .parser import Goal


VALID_STATUSES = frozenset({"proposed", "active", "achieved", "abandoned", "superseded"})
ID_PATTERN = re.compile(r"^G-\d{4,}$")
TITLE_MAX_LEN = 80


@dataclass
class SchemaError:
    """단일 검증 오류. 위반 위치(goal_id, field) 와 사유를 포함한다."""

    goal_id: str
    field: str
    message: str
    source: Optional[str] = None

    def __str__(self) -> str:
        loc = f"{self.goal_id}.{self.field}"
        if self.source:
            return f"[{self.source}] {loc}: {self.message}"
        return f"{loc}: {self.message}"

    def to_dict(self) -> dict:
        """tooling §3.2 — JSON 페이로드용 직렬화."""

        return {
            "issue": "schema_violation",
            "goal": self.goal_id,
            "field": self.field,
            "message": self.message,
            "source": self.source,
        }


def _is_iso8601(value: str) -> bool:
    """ISO8601 (date 또는 datetime) 인지 검증."""

    if not isinstance(value, str) or not value:
        return False
    # Python 3.11+ 의 fromisoformat 은 'Z' 도 허용. 보수적으로 'Z' → '+00:00' 치환 후 시도.
    candidate = value.replace("Z", "+00:00")
    try:
        datetime.fromisoformat(candidate)
        return True
    except ValueError:
        pass
    try:
        # 날짜만 (created_at: 2026-05-04) 인 경우.
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def _check_string_list(
    errors: List[SchemaError],
    goal: Goal,
    field_name: str,
    values: Any,
    *,
    pattern: Optional[re.Pattern[str]] = None,
) -> None:
    """리스트 필드의 각 원소가 문자열(+선택적 정규식)인지 검사."""

    if not isinstance(values, list):
        errors.append(SchemaError(goal.id, field_name, f"리스트가 아님 (실제: {type(values).__name__})",
                                  source=str(goal.source_path) if goal.source_path else None))
        return
    for i, v in enumerate(values):
        if not isinstance(v, str):
            errors.append(SchemaError(
                goal.id, f"{field_name}[{i}]",
                f"문자열이어야 함 (실제: {type(v).__name__})",
                source=str(goal.source_path) if goal.source_path else None,
            ))
            continue
        if pattern is not None and not pattern.match(v):
            errors.append(SchemaError(
                goal.id, f"{field_name}[{i}]",
                f"형식 위반 (값: {v!r}, 패턴: {pattern.pattern})",
                source=str(goal.source_path) if goal.source_path else None,
            ))


def validate_goal(goal: Goal) -> List[SchemaError]:
    """단일 Goal 의 스키마 검증. 오류 목록을 반환 (빈 리스트 = 통과)."""

    errors: List[SchemaError] = []
    src = str(goal.source_path) if goal.source_path else None

    def add(field: str, message: str) -> None:
        errors.append(SchemaError(goal.id or "<unknown>", field, message, source=src))

    # --- 필수 필드 ---
    if not goal.id:
        add("id", "필수 필드 누락")
    elif not ID_PATTERN.match(goal.id):
        add("id", f"ID 형식 위반 (값: {goal.id!r}, 기대: G-NNNN[NN...])")

    if not goal.title:
        add("title", "필수 필드 누락")
    elif len(goal.title) > TITLE_MAX_LEN:
        add("title", f"80자 초과 ({len(goal.title)}자)")

    if not goal.status:
        add("status", "필수 필드 누락")
    elif goal.status not in VALID_STATUSES:
        add("status", f"허용되지 않은 값 (값: {goal.status!r}, 허용: {sorted(VALID_STATUSES)})")

    if not goal.created_at:
        add("created_at", "필수 필드 누락")
    elif not _is_iso8601(goal.created_at):
        add("created_at", f"ISO8601 형식 아님 (값: {goal.created_at!r})")

    if not goal.updated_at:
        add("updated_at", "필수 필드 누락")
    elif not _is_iso8601(goal.updated_at):
        add("updated_at", f"ISO8601 형식 아님 (값: {goal.updated_at!r})")

    # --- success_criteria — abandoned/superseded 가 아닌 한 1개 이상 필수 ---
    if goal.status not in {"abandoned", "superseded"}:
        if not goal.success_criteria:
            add("success_criteria", "1개 이상의 검증 조건이 필요하다")
    if not isinstance(goal.success_criteria, list):
        add("success_criteria", "리스트여야 함")
    else:
        for i, sc in enumerate(goal.success_criteria):
            if not isinstance(sc, dict):
                add(f"success_criteria[{i}]", f"dict 여야 함 (실제: {type(sc).__name__})")
                continue
            if not isinstance(sc.get("description"), str) or not sc.get("description"):
                add(f"success_criteria[{i}].description", "비어있지 않은 문자열 필요")
            if "measurable" in sc and not isinstance(sc["measurable"], bool):
                add(f"success_criteria[{i}].measurable", "bool 이어야 함")
            if "measure" in sc and sc["measure"] is not None and not isinstance(sc["measure"], str):
                add(f"success_criteria[{i}].measure", "문자열 또는 null 이어야 함")

    # --- 관계 필드 ---
    _check_string_list(errors, goal, "parents", goal.parents, pattern=ID_PATTERN)
    _check_string_list(errors, goal, "children", goal.children, pattern=ID_PATTERN)
    _check_string_list(errors, goal, "constraints", goal.constraints, pattern=ID_PATTERN)
    _check_string_list(errors, goal, "tags", goal.tags)
    _check_string_list(errors, goal, "related_docs", goal.related_docs)
    _check_string_list(errors, goal, "risks", goal.risks)

    if goal.superseded_by is not None and not ID_PATTERN.match(goal.superseded_by):
        add("superseded_by", f"ID 형식 위반 (값: {goal.superseded_by!r})")

    # superseded 상태는 superseded_by 를 가져야 한다 (§3.4).
    if goal.status == "superseded" and not goal.superseded_by:
        add("superseded_by", "status=superseded 인 Goal 은 superseded_by 가 필요하다")

    # --- realizes ---
    if not isinstance(goal.realizes, list):
        add("realizes", "리스트여야 함")
    else:
        for i, r in enumerate(goal.realizes):
            if not isinstance(r, dict):
                add(f"realizes[{i}]", f"dict 여야 함 (실제: {type(r).__name__})")
                continue
            if not isinstance(r.get("path"), str) or not r.get("path"):
                add(f"realizes[{i}].path", "비어있지 않은 문자열 필요")
            if not isinstance(r.get("role"), str) or not r.get("role"):
                add(f"realizes[{i}].role", "비어있지 않은 문자열 필요")

    # --- intent (§3.1: markdown 본문 — 비어있지 않아야 함) ---
    # abandoned/superseded 는 의도 보존이 필수 아님 → 경고 수준이지만 여기선 강제.
    if goal.status not in {"abandoned", "superseded"} and not goal.intent.strip():
        add("intent", "Intent 본문이 비어있다 (## Intent 섹션 필요)")

    return errors


def validate_goals(goals: Iterable[Goal]) -> List[SchemaError]:
    """여러 Goal 의 스키마 검증을 모아 반환한다."""

    out: List[SchemaError] = []
    for g in goals:
        out.extend(validate_goal(g))
    return out
