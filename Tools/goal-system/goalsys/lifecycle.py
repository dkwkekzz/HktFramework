"""Phase 3 — `next-id` + `new-goal`.

설계 §3.6 (ID 범위) + §6.7 (라이프사이클) + 도구 §6.1~§6.2 명세 구현.

ID 는 영구 불변, 폐기·대체된 ID 도 재사용 금지. 카테고리별 가용한 가장 작은 ID 를 반환한다.
``new-goal`` 은 frontmatter 가 채워진 초안 파일을 ``goals/`` 디렉토리에 생성한다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Literal, Optional, Sequence


Category = Literal["pillar", "system", "general"]

_CATEGORY_RANGES: dict[str, tuple[int, int]] = {
    # category: (min, max). 폐기 ID 도 재사용 금지이므로 max 는 충분히 크게 잡는다.
    "pillar": (1, 99),
    "system": (100, 999),
    "general": (1000, 9999),
}

_ID_NUM_RE = re.compile(r"G-(\d{4,})")


class IdExhaustedError(RuntimeError):
    """카테고리 내 가용 ID 가 모두 소진되었을 때."""


# ---------------------------------------------------------------------------
# next-id
# ---------------------------------------------------------------------------


def used_ids(goals_dir: Path | str) -> set[int]:
    """``goals_dir`` 내 모든 Goal 파일의 ID 정수부 집합.

    ID 가 영구 불변이라는 전제(§3.4)에서 파일명만 신뢰한다 — frontmatter 와의
    불일치는 ``validate-schema`` 가 따로 차단한다.
    """

    base = Path(goals_dir)
    if not base.is_dir():
        return set()
    used: set[int] = set()
    for f in base.glob("**/G-*.md"):
        m = _ID_NUM_RE.search(f.name)
        if m:
            used.add(int(m.group(1)))
    return used


def next_id(category: Category | str, goals_dir: Path | str) -> str:
    """카테고리 범위 내에서 가장 작은 미사용 ID 를 반환한다.

    Args:
        category: ``pillar`` | ``system`` | ``general``.
        goals_dir: Goal 파일 디렉토리.

    Returns:
        ``G-XXXX`` 형식의 ID 문자열.

    Raises:
        ValueError: 알 수 없는 카테고리.
        IdExhaustedError: 범위 내 가용 ID 없음.
    """

    if category not in _CATEGORY_RANGES:
        raise ValueError(f"알 수 없는 카테고리: {category!r} (허용: {list(_CATEGORY_RANGES)})")
    lo, hi = _CATEGORY_RANGES[category]
    used = used_ids(goals_dir)
    for n in range(lo, hi + 1):
        if n not in used:
            return f"G-{n:04d}"
    raise IdExhaustedError(f"카테고리 {category} 의 ID 범위({lo}~{hi})가 소진되었다")


# ---------------------------------------------------------------------------
# new-goal
# ---------------------------------------------------------------------------


@dataclass
class NewGoalRequest:
    """``new-goal`` 호출 인자."""

    category: Category | str
    title: Optional[str] = None
    parents: Optional[Sequence[str]] = None
    constraints: Optional[Sequence[str]] = None
    tags: Optional[Sequence[str]] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _format_list(items: Optional[Iterable[str]]) -> str:
    items = list(items or [])
    if not items:
        return "[]"
    return "[" + ", ".join(items) + "]"


def render_new_goal(req: NewGoalRequest, *, goal_id: str, now: Optional[str] = None) -> str:
    """초안 파일의 텍스트를 생성한다 (디스크 쓰기 X)."""

    timestamp = now or _now_iso()
    title = req.title or "TODO"

    lines: List[str] = []
    lines.append("---")
    lines.append(f"id: {goal_id}")
    lines.append(f"title: {title}")
    lines.append("status: proposed")
    lines.append(f"created_at: {timestamp}")
    lines.append(f"updated_at: {timestamp}")
    lines.append(f"parents: {_format_list(req.parents)}")
    lines.append("children: []")
    lines.append(f"constraints: {_format_list(req.constraints)}")
    lines.append(f"tags: {_format_list(req.tags)}")
    lines.append("---")
    lines.append("")
    lines.append("## Intent")
    lines.append("")
    lines.append("TODO")
    lines.append("")
    lines.append("## Success Criteria")
    lines.append("")
    lines.append("- description: TODO")
    lines.append("  measurable: false")
    lines.append("  measure: null")
    lines.append("")
    return "\n".join(lines)


def new_goal(
    req: NewGoalRequest,
    goals_dir: Path | str,
    *,
    overwrite: bool = False,
) -> Path:
    """초안 Goal 파일을 생성하고 경로를 반환한다.

    Raises:
        FileExistsError: ``overwrite=False`` 인데 파일이 이미 존재.
    """

    base = Path(goals_dir)
    base.mkdir(parents=True, exist_ok=True)
    goal_id = next_id(req.category, base)
    target = base / f"{goal_id}.md"
    if target.exists() and not overwrite:
        raise FileExistsError(f"이미 존재한다: {target}")
    text = render_new_goal(req, goal_id=goal_id)
    target.write_text(text, encoding="utf-8")
    return target
